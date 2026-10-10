// sync.js — keeps the phone's copy fresh from GET /sync (PWA.md §5.1, API.md §9.2).
// When: after login / app open, coming back online, returning to the app, and every
// 5 minutes while it is open. Never two at once. Never blocks a screen.
import { api } from '../api/client.js';
import { getMeta, setMeta, putRecords, deleteRecords, clearRecords, pruneRecords, ensureUser, currentGeneration } from './cache.js';

export const EVERY_MS = 5 * 60 * 1000;
const PLURAL = { task: 'tasks', household: 'households', event: 'events', vendor: 'vendors', payment: 'payments', document: 'documents', tag: 'tags', budget_category: 'budgetCategories' };
let running = null;
const subs = new Set();
let lastResult = null;

export function onSynced(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

/** One sync, all pages. Returns { ok, full, rows } or { ok: false } (offline, logged out…). */
export function runSync(userId) {
  if (!running) {
    running = doSync(userId).finally(() => { running = null; });
  }
  return running;
}

async function doSync(userId) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false };
  await ensureUser(userId);
  const gen = currentGeneration(); // logged out or wiped meanwhile → write nothing
  const stale = () => gen !== currentGeneration();
  let since = await getMeta('nextSince');
  let full = !since;
  let rows = 0;
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let cursor;
      let first = true;
      let nextSince = null;
      let restart = false;
      const seen = full ? new Set() : null; // a full sync replaces the copy only once it is complete
      const kinds = new Set();
      do {
        const res = await api('GET', '/sync', { query: { since: since || undefined, cursor, limit: 500 } });
        const d = res.data;
        if (stale()) return { ok: false };
        if (first && d.fullResyncRequired) {
          // My access changed (or the copy is too old): what I may no longer see goes at once.
          await clearRecords(gen);
          since = null;
          full = true;
          restart = true;
          break;
        }
        rows += await apply(d.changes, d.deleted ?? [], seen, kinds, gen);
        nextSince = d.nextSince;
        cursor = d.hasMore ? d.cursor : undefined;
        first = false;
      } while (cursor);
      if (restart) continue;
      if (stale()) return { ok: false };
      if (seen) await pruneRecords([...kinds], seen, gen); // rows the server no longer sends
      await setMeta('nextSince', nextSince, gen);
      await setMeta('lastSyncedAt', new Date().toISOString(), gen);
      if (stale()) return { ok: false };
      lastResult = { ok: true, full, rows, at: new Date().toISOString() };
      subs.forEach((fn) => fn(lastResult));
      return lastResult;
    }
  } catch {
    return { ok: false }; // offline or server busy: the copy stays as it was, with its age
  }
  return { ok: false };
}

async function apply(changes, deleted, seen, kinds, gen) {
  let n = 0;
  for (const [type, value] of Object.entries(changes || {})) {
    kinds.add(type);
    if (type === 'settings') {
      if (value) await putRecords('settings', [{ ...value, id: 'settings' }], gen);
      seen?.add('settings|settings');
      continue;
    }
    if (Array.isArray(value) && value.length) {
      await putRecords(type, value, gen);
      for (const r of value) seen?.add(`${type}|${r.id}`);
      n += value.length;
    }
  }
  if (deleted.length) await deleteRecords(deleted.filter((x) => x.id && PLURAL[x.type]).map((x) => [PLURAL[x.type], x.id]), gen);
  return n;
}

export function lastSync() {
  return lastResult;
}

/** Starts the triggers once (AppShell, after login). Returns a stop function. */
export function startSyncLoop(userId) {
  const go = () => { runSync(userId); };
  go();
  const onVisible = () => { if (document.visibilityState === 'visible') go(); };
  window.addEventListener('online', go);
  document.addEventListener('visibilitychange', onVisible);
  const timer = setInterval(() => { if (document.visibilityState === 'visible') go(); }, EVERY_MS);
  return () => {
    window.removeEventListener('online', go);
    document.removeEventListener('visibilitychange', onVisible);
    clearInterval(timer);
  };
}
