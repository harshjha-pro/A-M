// Local drafts (FEATURES A3): saved 1 s after a change under
// draft:{user}:{form}:{recordId|new}. Holds the values, the base version and the
// base values (for the 3-way merge). 7 days, at most 50, never passwords.
// localStorage can be missing or full (private mode): drafts then just don't stick.

const PREFIX = 'draft:';
export const DRAFT_DAYS = 7;
export const MAX_DRAFTS = 50;
const TTL_MS = DRAFT_DAYS * 24 * 3600 * 1000;
const SECRET = /password|secret|token|csrf/i;

export function draftKey(userId, form, recordId) {
  return `${PREFIX}${userId}:${form}:${recordId ?? 'new'}`;
}

function store() {
  try { return window.localStorage; } catch { return null; }
}

function strip(values) {
  if (!values || typeof values !== 'object') return values ?? null;
  return Object.fromEntries(Object.entries(values).filter(([k]) => !SECRET.test(k)));
}

/** @param {{ values: object, baseVersion?: number|null, base?: object|null }} draft */
export function saveDraft(key, { values, baseVersion = null, base = null }, now = Date.now()) {
  const s = store();
  if (!s) return;
  try {
    s.setItem(key, JSON.stringify({ savedAt: now, values: strip(values), baseVersion, base: strip(base) }));
    pruneDrafts(now);
  } catch { /* full or blocked: the form still works */ }
}

export function loadDraft(key, now = Date.now()) {
  const s = store();
  if (!s) return null;
  try {
    const d = JSON.parse(s.getItem(key) ?? 'null');
    if (!d || typeof d !== 'object' || !d.values) return null;
    if (now - d.savedAt > TTL_MS) { s.removeItem(key); return null; }
    return d;
  } catch {
    return null;
  }
}

export function clearDraft(key) {
  try { store()?.removeItem(key); } catch { /* ignore */ }
}

function allDrafts() {
  const s = store();
  if (!s) return [];
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (!k?.startsWith(PREFIX)) continue;
    let savedAt = 0;
    try { savedAt = JSON.parse(s.getItem(k))?.savedAt ?? 0; } catch { /* broken → oldest */ }
    out.push({ key: k, savedAt });
  }
  return out;
}

/** Drop expired drafts, then the oldest ones past 50. */
export function pruneDrafts(now = Date.now()) {
  const all = allDrafts();
  const live = all.filter((d) => now - d.savedAt <= TTL_MS);
  all.filter((d) => now - d.savedAt > TTL_MS).forEach((d) => clearDraft(d.key));
  live.sort((a, b) => b.savedAt - a.savedAt).slice(MAX_DRAFTS).forEach((d) => clearDraft(d.key));
}

/** "You have 2 unsaved drafts. Log out anyway?" */
export function countDrafts(userId, now = Date.now()) {
  return allDrafts().filter((d) => d.key.startsWith(`${PREFIX}${userId}:`) && now - d.savedAt <= TTL_MS).length;
}

/** Money access ended (FEATURES B6): drafts holding amounts are thrown away. */
export function clearMoneyDrafts(userId) {
  const s = store();
  if (!s) return;
  const keys = [];
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (!k?.startsWith(`${PREFIX}${userId}:`)) continue;
    const form = k.split(':')[2];
    let values = null;
    try { values = JSON.parse(s.getItem(k))?.values ?? null; } catch { /* broken: drop it */ }
    if (form === 'payment' || form === 'category' || (form === 'vendor' && values?.agreedAmount)) keys.push(k);
  }
  keys.forEach((k) => { try { s.removeItem(k); } catch { /* ignore */ } });
}
