// cache.js — reading and writing the phone's copy (PWA.md §5.1). Never throws to the
// caller: a phone that blocks storage simply has no offline copy.
import { withDb, wipeAll } from './db.js';

export const hasIndexedDb = () => typeof indexedDB !== 'undefined';

async function safe(fn, fallback = null) {
  if (!hasIndexedDb()) return fallback;
  try { return await fn(); } catch { return fallback; }
}

/**
 * Writes from a sync pass the generation they started in (`gen`). The check runs in the
 * same tick the transaction is created, after any wipe's generation bump: IndexedDB runs
 * write transactions in order, so nothing from before a wipe can land after it.
 */
const fresh = (gen) => gen === undefined || gen === generation;

export const getMeta = (k) => safe(() => withDb((d) => d.get('meta', k)));
export const setMeta = (k, v, gen) => safe(() => withDb((d) => (fresh(gen) ? d.put('meta', v, k) : undefined)));

/** The copy belongs to one person. Someone else logs in → wipe first (PWA §5.1 "One user per cache"). */
export async function ensureUser(userId) {
  if (!userId) return;
  const owner = await getMeta('userId');
  if (owner && owner !== userId) await wipe({ keepOutbox: true });
  if (owner !== userId) await setMeta('userId', userId);
}

/** Bumped by every wipe: a sync that started before a wipe must not write afterwards. */
let generation = 0;
export const currentGeneration = () => generation;

export const wipe = (opts) => { generation += 1; return safe(() => wipeAll(opts)); };

/** "path?query" with the query sorted, so the same screen always finds its copy. */
export function replyKey(path, query) {
  const q = Object.entries(query || {}).filter(([, v]) => v !== undefined && v !== null && v !== '').sort(([a], [b]) => a.localeCompare(b));
  return q.length ? `${path}?${q.map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(',') : v}`).join('&')}` : path;
}

export const saveReply = (key, data, meta, gen) => safe(() => withDb((d) => (fresh(gen) ? d.put('snapshots', { data, meta, savedAt: new Date().toISOString() }, key) : undefined)));
export const readReply = (key) => safe(() => withDb((d) => d.get('snapshots', key)));

export const putRecords = (type, rows, gen) => safe(() => withDb(async (d) => {
  if (!fresh(gen)) return;
  const tx = d.transaction('records', 'readwrite');
  for (const row of rows) if (row && row.id) tx.store.put({ kind: type, id: row.id, row });
  await tx.done;
}));

export const deleteRecords = (pairs, gen) => safe(() => withDb(async (d) => {
  if (!fresh(gen)) return;
  const tx = d.transaction('records', 'readwrite');
  for (const [type, id] of pairs) tx.store.delete([type, id]);
  await tx.done;
}));

export const clearRecords = (gen) => safe(() => withDb((d) => (fresh(gen) ? d.clear('records') : undefined)));

/** After a complete full sync: drop rows of these kinds that the server no longer sent. */
export const pruneRecords = (kinds, seen, gen) => safe(() => withDb(async (d) => {
  if (!fresh(gen)) return;
  const tx = d.transaction('records', 'readwrite');
  for (const kind of kinds) {
    for (const key of await tx.store.index('kind').getAllKeys(kind)) {
      if (!seen.has(`${key[0]}|${key[1]}`)) tx.store.delete(key);
    }
  }
  await tx.done;
}));

/** Rows of one kind ('households', 'tasks', …). */
export const getRecords = (type) => safe(async () => (await withDb((d) => d.getAllFromIndex('records', 'kind', type))).map((r) => r.row), []);
export const getRecord = async (type, id) => {
  const r = await safe(() => withDb((d) => d.get('records', [type, id])));
  return r ? r.row : null;
};

/** Counts for Settings › This phone. */
export async function cacheSummary() {
  const out = {};
  for (const t of ['households', 'tasks', 'events', 'vendors', 'payments', 'documents', 'members']) {
    out[t] = (await getRecords(t)).length;
  }
  out.lastSyncedAt = await getMeta('lastSyncedAt');
  return out;
}
