// outbox.js — every queueable save goes through here, online or not (PWA.md §5.2).
//
//   const res = await saveViaOutbox('PATCH', `/tasks/${id}`, { body, ifMatch, idemKey, base, label });
//   res.queued → the change is kept on this phone and will be sent later (🕒 Waiting to send)
//   otherwise  → the server's reply, exactly as api() returns it
//
// Rules that keep it safe:
//  1. The entry is written to IndexedDB BEFORE anything is sent. Closing the app loses nothing.
//  2. An entry leaves the outbox ONLY on a 2xx reply, or when the user taps Discard.
//  3. Two edits to the same record that haven't been tried yet are merged into one request.
//     Already tried → the second waits ('chain') and takes the new version when the first lands.
//  4. A record added offline has the stand-in id "{new:<key>}"; its later changes wait, and
//     their paths are fixed up when the create lands.
//  5. A conflict holds back only that record. Other changes keep going.
//  6. No Background Sync. Sends on: app open, back online, app brought to the front, Send now,
//     right after each save, every 60 s while changes wait. Back-off 15 s → 5 min after failures.
//  7. One sender at a time (Web Locks, with an in-tab flag as well).
//  8. Entries carry v: 1. A new shape means a migration here, never dropping entries.
//  9. Each entry keeps one Idempotency-Key for every retry, so it is saved at most once.
// 10. Only the person who made a change can send it (their login, their entry).
import { withDb } from './db.js';
import { hasIndexedDb, setMeta } from './cache.js';
import { ENTRY_VERSION, allEntries, refreshOutbox, setSending, getOutboxState, patchOutboxState, _resetOutboxStateForTests } from './outboxState.js';
import { ruleFor, entityFor, placeholderId, hasPlaceholder, blockedReason } from './queueable.js';
import { applyLocally, landLocally, revertLocally } from './localApply.js';
import { api, newIdemKey } from '../api/client.js';
import { getState, getCsrfToken, askToLogin } from '../api/session.js';
import {
  OfflineError, AuthError, ConflictError, DeletedError, DuplicateError, InProgressError,
  ValidationError, RuleError, RateLimitedError, ServerError, UpdateRequiredError, ForbiddenError,
} from '../api/errors.js';
import { t } from '../i18n/strings.en.js';

export const EVERY_MS = 60 * 1000;
export const BACKOFF_FIRST_MS = 15 * 1000;
export const BACKOFF_MAX_MS = 5 * 60 * 1000;
const FIRST_DELAY_MS = 1500;

export { ENTRY_VERSION, allEntries, upgrade, refreshOutbox, getOutboxState, summarise, useOutbox, useWaiting } from './outboxState.js';

const putEntry = (e) => withDb((d) => d.put('outbox', e));
const deleteEntry = (key) => withDb((d) => d.delete('outbox', key));

/* ------------------------------------------------------------- saving */

const waiters = new Map(); // key → [{ resolve, reject }] — saves the person is waiting on

let seqLast = 0;
const nextSeq = (entries) => {
  seqLast = Math.max(Date.now(), seqLast + 1, ...entries.map((e) => e.seq + 1));
  return seqLast;
};

/**
 * Writes the change to the outbox (merging or chaining as needed) and returns the entry
 * that will carry it. The same key twice (Try again, login sheet) never makes a second entry.
 */
export async function enqueue(method, path, { body = {}, ifMatch = null, idemKey, base = null, label = '' } = {}) {
  const rule = ruleFor(method, path);
  if (!rule) throw new Error(`Needs internet, can't wait on the phone: ${method} ${path}`);
  const user = getState().user;
  if (!user) throw new AuthError(t('errors.loginNeeded'), { status: 401, code: 'not_logged_in' });
  const key = idemKey || newIdemKey();
  const entity = entityFor(rule, key);
  const entries = await allEntries();

  const same = entries.find((e) => e.key === key);
  if (same) return same;

  const mine = entries.filter((e) => e.userId === user.id);
  const open = mine.filter((e) => e.entity === entity);
  // Rule 3: merge into an edit of the same record that hasn't been tried yet — or into
  // the create of a record added offline (its first send then carries the edit too).
  const mergeInto = open.findLast((e) => e.status === 'pending' && !e.attempted
    && ((e.method === rule.method && e.path === path && rule.kind === 'update') || (e.kind === 'create' && rule.kind === 'update' && rule.type === e.type)));
  if (mergeInto) {
    const merged = { ...mergeInto, body: { ...mergeInto.body, ...body }, merged: true, label: label || mergeInto.label, mergedKeys: [...(mergeInto.mergedKeys ?? []), key] };
    await putEntry(merged);
    await refreshOutbox();
    return merged;
  }
  // Rule 3/4: anything else still open on this record goes first; this one takes its version.
  const chain = rule.kind !== 'create' && (open.length > 0 || hasPlaceholder(path));
  const entry = {
    v: ENTRY_VERSION,
    key,
    seq: nextSeq(entries),
    userId: user.id,
    userName: user.name,
    method: rule.method,
    path,
    body,
    ifMatch: rule.kind === 'create' ? null : (chain ? 'chain' : ifMatch),
    base,
    entity,
    type: rule.type,
    kind: rule.kind,
    status: 'pending',
    attempted: false,
    label,
    createdAt: new Date().toISOString(),
    error: null,
  };
  await putEntry(entry);
  await refreshOutbox();
  return entry;
}

/**
 * The one way screens save a queueable change. Online: sent at once and the reply returned,
 * with the usual errors (conflict screen, duplicate dialog, field errors) for the screen to
 * handle. No internet (or the server is down): kept on the phone → { queued: true, data }.
 * Not queueable → a plain api() call.
 */
export async function saveViaOutbox(method, path, opts = {}) {
  const reason = blockedReason(method, path);
  if (reason) throw new OfflineError(t(`outbox.${reason}`), { code: 'send_family_first' });
  if (!ruleFor(method, path) || !hasIndexedDb()) return api(method, path, opts);
  let entry;
  try {
    entry = await enqueue(method, path, opts);
  } catch (e) {
    if (e instanceof AuthError || /Needs internet/.test(String(e.message))) throw e;
    return api(method, path, opts); // storage refused (private window): the old online-only save
  }
  const outcome = new Promise((resolve, reject) => waiters.set(entry.key, [...(waiters.get(entry.key) ?? []), { resolve, reject }]));
  flushOutbox({ force: true });
  const res = await outcome;
  if (res?.queued) {
    const rule = ruleFor(method, path); // this change itself (it may have been merged into an earlier one)
    const local = await applyLocally({ key: opts.idemKey && entry.key !== opts.idemKey ? opts.idemKey : entry.key, method: rule.method, path, body: opts.body ?? {}, type: rule.type, kind: rule.kind }, getState().user);
    await setMeta('localChangedAt', new Date().toISOString());
    // Not on the phone's copy (never opened offline): the screen still gets its record back.
    const data = local ?? (opts.base ? { ...opts.base, ...(opts.body ?? {}), waiting: true } : { id: placeholderId(entry.key), ...(opts.body ?? {}), waiting: true });
    return { ...res, data };
  }
  return res;
}

/* ------------------------------------------------------------ sending */

let flushing = null;
let again = false;
let failures = 0;

/** Sends what's waiting, oldest first. `force` skips the back-off (Send now, online, a save). */
export function flushOutbox({ force = false } = {}) {
  if (flushing) {
    again = again || force;
    return flushing;
  }
  flushing = (async () => {
    try {
      do {
        const f = again || force;
        again = false;
        await withLock(() => drain(f));
      } while (again);
    } finally {
      flushing = null;
      setSending(false);
      settleWaiters();
      await refreshOutbox();
    }
  })();
  return flushing;
}

async function withLock(fn) {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request('am-outbox', { ifAvailable: true }, async (lock) => (lock ? fn() : undefined));
  }
  return fn();
}

/** Anyone still waiting on a save that didn't go out: it's kept on the phone. */
function settleWaiters() {
  for (const [key, list] of waiters) {
    for (const w of list) w.resolve({ queued: true, data: null, meta: {}, idemKey: key });
  }
  waiters.clear();
}

/** The saves waiting on this entry, as one { resolve, reject } (removed when used). */
function waiterFor(e) {
  const keys = [e.key, ...(e.mergedKeys ?? [])].filter((k) => waiters.has(k));
  if (!keys.length) return [null, null];
  const list = keys.flatMap((k) => waiters.get(k));
  return [keys, {
    resolve: (v) => list.forEach((w) => w.resolve(v)),
    reject: (err) => list.forEach((w) => w.reject(err)),
    move: (to) => { keys.forEach((k) => waiters.delete(k)); waiters.set(to, list); },
  }];
}
const dropWaiter = (keys) => (keys ?? []).forEach((k) => waiters.delete(k));

const RETRY = (err) => err instanceof OfflineError || err instanceof ServerError || err instanceof RateLimitedError || err instanceof InProgressError;

async function drain(force) {
  const user = getState().user;
  if (!user || getState().status !== 'in') return;
  if (!force && Date.now() < getOutboxState().nextTryAt) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  if (!getCsrfToken()) {
    // Opened with no internet: the login is checked first (it brings the CSRF token).
    const { loadSession } = await import('../api/auth.js');
    await loadSession().catch(() => null);
    if (!getCsrfToken()) return;
  }
  const tried = new Set();
  for (;;) {
    const entries = (await allEntries()).filter((e) => e.userId === user.id);
    const blocked = new Set();
    let next = null;
    for (const e of entries) {
      if (e.ifMatch === 'chain' && e.status === 'pending' && !hasPlaceholder(e.path) && !entries.some((x) => x.seq < e.seq && x.entity === e.entity)) {
        // Nothing left ahead of it (e.g. the one before was sent by another tab): its own loaded version.
        e.ifMatch = e.base?.version ?? null;
        await putEntry(e);
      }
      const sendable = e.status === 'pending' && !blocked.has(e.entity) && !hasPlaceholder(e.path) && e.ifMatch !== 'chain';
      if (sendable && !tried.has(e.key)) { next = e; break; }
      blocked.add(e.entity);
    }
    if (!next) return;
    tried.add(next.key);
    setSending(true);
    const stop = await sendOne(next, entries);
    if (stop) return;
  }
}

/** Sends one entry. Returns true when the whole queue should stop for now. */
async function sendOne(e, entries) {
  if (!e.attempted) await putEntry({ ...e, attempted: true }); // after this the body never changes under this key
  try {
    const res = await api(e.method, e.path, { body: e.body, ifMatch: typeof e.ifMatch === 'number' ? e.ifMatch : undefined, idemKey: e.key });
    failures = 0;
    patchOutboxState({ nextTryAt: 0 });
    await landed(e, res, entries);
    const [wk, w] = waiterFor(e);
    if (w) { dropWaiter(wk); w.resolve(res); }
    await refreshOutbox();
    return false;
  } catch (err) {
    return failed(e, err);
  }
}

/** A 2xx: the entry goes, stand-in ids and waiting versions of later entries are fixed up. */
async function landed(e, res, entries) {
  await deleteEntry(e.key);
  const data = res.data ?? {};
  const later = entries.filter((x) => x.seq > e.seq && x.key !== e.key);
  if (e.kind === 'create' && (e.type === 'tasks' || e.type === 'households')) {
    const stand = placeholderId(e.key);
    const realEntity = e.entity.replace(stand, data.id);
    let first = true;
    for (const x of later) {
      if (!x.path.includes(stand) && !x.entity.includes(stand)) continue;
      const fixed = { ...x, path: x.path.split(stand).join(data.id), entity: x.entity.split(stand).join(data.id) };
      if (fixed.entity === realEntity && fixed.ifMatch === 'chain' && first) { fixed.ifMatch = data.version; first = false; }
      await putEntry(fixed);
    }
  } else {
    const nextOne = later.find((x) => x.entity === e.entity && x.ifMatch === 'chain');
    if (nextOne && data.version !== undefined) await putEntry({ ...nextOne, ifMatch: data.version });
  }
  await landLocally(e, data);
}

async function failed(e, err) {
  if (RETRY(err)) {
    failures += 1;
    const wait = Math.min(BACKOFF_FIRST_MS * 2 ** (failures - 1), BACKOFF_MAX_MS);
    patchOutboxState({ nextTryAt: Date.now() + wait });
    return true; // no internet / server trouble: everything waits, nothing is lost
  }
  if (err instanceof UpdateRequiredError) return true; // the update prompt is showing; entries are kept for the new app
  if (err instanceof AuthError) {
    const [wk, w] = waiterFor(e);
    if (w) { dropWaiter(wk); w.reject(err); return true; } // the login sheet opens over the form, then the same key again
    askToLogin(err.details?.reason ?? err.code).then(() => flushOutbox({ force: true })).catch(() => {});
    return true;
  }
  if (err instanceof ForbiddenError && err.code === 'csrf_failed') {
    const { loadSession } = await import('../api/auth.js');
    await loadSession().catch(() => null);
    return true;
  }
  const [wk, w] = waiterFor(e);
  if (w && !e.merged) {
    // The person is looking at the form: it shows the conflict, duplicate or field errors
    // as it always has, and keeps their typing. Nothing was saved, so the entry goes.
    dropWaiter(wk);
    await deleteEntry(e.key);
    w.reject(err);
    return false;
  }
  if (err instanceof ConflictError && err.current) {
    const auto = autoMerge(e, err);
    if (auto) {
      await deleteEntry(e.key);
      await putEntry(auto);
      if (w) w.move(auto.key);
      return false; // sent again at once, with the server's version
    }
  }
  await putEntry({ ...e, status: statusFor(err), error: errorRecord(err) });
  return false;
}

export function statusFor(err) {
  if (err instanceof ConflictError) return 'conflict';
  if (err instanceof DeletedError) return 'deleted';
  if (err instanceof DuplicateError) return 'duplicate';
  if (err instanceof ValidationError || err instanceof RuleError) return 'needs_fix';
  return 'rejected';
}

function errorRecord(err) {
  return {
    name: err.name,
    status: err.status,
    code: err.code,
    message: err.message,
    fields: err.fields ?? null,
    current: err.current ?? null,
    currentVersion: err.currentVersion ?? null,
    changedBy: err.changedBy ?? err.deletedBy ?? null,
    changedAt: err.changedAt ?? err.deletedAt ?? null,
    matches: err.matches ?? null,
    at: new Date().toISOString(),
  };
}

/* ------------------------------------------------------ conflicts */

/** The value of a body field as it appears on a record (assigneeIds ↔ assignees[].id, eventId ↔ event.id). */
export function fieldOf(record, k) {
  if (!record) return undefined;
  if (k in record) return record[k];
  if (k.endsWith('Ids')) { const list = record[`${k.slice(0, -3)}s`]; return Array.isArray(list) ? list.map((x) => x?.id) : undefined; }
  if (k.endsWith('Id')) { const one = record[k.slice(0, -2)]; return one === undefined ? undefined : (one?.id ?? null); }
  return undefined;
}

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Fields I changed that they changed too, to something else. */
export function clashes(e, current) {
  const out = [];
  for (const [k, mine] of Object.entries(e.body)) {
    if (k === 'allowDuplicate' || k === 'key') continue;
    const theirs = fieldOf(current, k);
    if (theirs === undefined || same(theirs, mine)) continue;
    const before = fieldOf(e.base, k);
    if (e.base && before !== undefined && same(before, theirs)) continue; // only I changed it
    out.push({ field: k, mine, theirs, base: before });
  }
  return out;
}

/** Nothing clashing → the same change again with the server's version and a new key (AC-CON-01). */
function autoMerge(e, err) {
  if (clashes(e, err.current).length) return null;
  return { ...e, key: newIdemKey(), ifMatch: err.currentVersion, base: err.current, attempted: false, status: 'pending', error: null, mergedKeys: [...(e.mergedKeys ?? []), e.key] };
}

/* ------------------------------------------------- what the person decides */

async function findEntry(key) {
  return (await allEntries()).find((e) => e.key === key) ?? null;
}

/**
 * Discard: the change is dropped (the screen asks first — Undo can't bring it back).
 * Changes queued behind it get the server's version; changes to a record that was never
 * created go with it.
 */
export async function discardEntry(key) {
  const e = await findEntry(key);
  if (!e) return;
  const entries = await allEntries();
  await deleteEntry(key);
  if (e.kind === 'create' && (e.type === 'tasks' || e.type === 'households')) {
    const stand = placeholderId(e.key);
    for (const x of entries) if (x.key !== key && (x.path.includes(stand) || x.entity.includes(stand))) await deleteEntry(x.key);
  } else {
    const nextOne = entries.find((x) => x.seq > e.seq && x.entity === e.entity && x.ifMatch === 'chain');
    const version = e.error?.currentVersion ?? (typeof e.ifMatch === 'number' ? e.ifMatch : null);
    if (nextOne && version !== null) await putEntry({ ...nextOne, ifMatch: version });
  }
  await revertLocally(e);
  await refreshOutbox();
  flushOutbox({ force: true });
}

/** "Save my choices": choices[field] = 'mine' | 'theirs'. Only my picks are sent, with a new key. */
export async function resolveConflict(key, choices) {
  const e = await findEntry(key);
  if (!e || !e.error) return;
  const body = {};
  for (const [k, v] of Object.entries(e.body)) if ((choices[k] ?? 'mine') === 'mine') body[k] = v;
  if (Object.keys(body).length === 0) { await discardEntry(key); return; }
  await deleteEntry(key);
  await putEntry({ ...e, key: newIdemKey(), body, ifMatch: e.error.currentVersion, base: e.error.current, attempted: false, status: 'pending', error: null, merged: false, mergedKeys: [] });
  await refreshOutbox();
  await flushOutbox({ force: true });
}

/** "Add anyway" on a family that looked like a duplicate. The server kept nothing, so the key stays. */
export async function addAnyway(key) {
  const e = await findEntry(key);
  if (!e) return;
  await putEntry({ ...e, body: { ...e.body, allowDuplicate: true }, status: 'pending', error: null });
  await refreshOutbox();
  await flushOutbox({ force: true });
}

/** "Try again" (e.g. after Ayush restored a deleted record). */
export async function retryEntry(key) {
  const e = await findEntry(key);
  if (!e) return;
  await putEntry({ ...e, status: 'pending', error: null, ifMatch: e.status === 'deleted' && e.error?.currentVersion ? e.error.currentVersion : e.ifMatch });
  await refreshOutbox();
  await flushOutbox({ force: true });
}

/* ---------------------------------------------------------- the loop */

/** Starts the triggers once (AppShell, after login). Returns a stop function. */
export function startOutboxLoop() {
  const go = (force) => () => { refreshOutbox().then((list) => { if (list.some((e) => e.userId === getState().user?.id && e.status === 'pending')) flushOutbox({ force }); }); };
  const onOnline = go(true);
  const onVisible = () => { if (document.visibilityState === 'visible') go(false)(); };
  // The first look waits until the page has loaded, so it never slows the first screen.
  let first = null;
  const begin = () => { first = setTimeout(go(true), FIRST_DELAY_MS); };
  if (document.readyState === 'complete') begin(); else window.addEventListener('load', begin, { once: true });
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  const timer = setInterval(() => { if (document.visibilityState === 'visible') go(false)(); }, EVERY_MS);
  return () => {
    clearTimeout(first);
    window.removeEventListener('load', begin);
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
    clearInterval(timer);
  };
}

/** Tests only. */
export function _resetOutboxForTests() {
  _resetOutboxStateForTests();
  failures = 0;
  flushing = null;
  again = false;
  waiters.clear();
  seqLast = 0;
}
