// db.js — one IndexedDB database on the phone: the read cache (PWA.md §5.1) and the
// outbox (§5.2). Stores:
//   records    rows from /sync and from detail screens, keyed [kind, id] (camelCase, as screens use them)
//   snapshots  whole GET replies as they came, keyed by "path?query" (any screen seen online)
//   meta       small values: userId, nextSince, lastSyncedAt
//   outbox     changes waiting to be sent, keyed by their Idempotency-Key (see outbox.js)
import { openDB } from 'idb';

const DB_NAME = 'am-wedding';
const DB_VERSION = 3; // 2: create any missing store · 3: the outbox
let dbPromise = null;

function open() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        // { kind: 'households', id, row } — the row kept whole (rows have their own "type" fields)
        if (!d.objectStoreNames.contains('records')) {
          const rec = d.createObjectStore('records', { keyPath: ['kind', 'id'] });
          rec.createIndex('kind', 'kind');
        }
        if (!d.objectStoreNames.contains('snapshots')) d.createObjectStore('snapshots');
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
        if (!d.objectStoreNames.contains('outbox')) d.createObjectStore('outbox', { keyPath: 'key' });
      },
      terminated() { dbPromise = null; }, // iOS can close it when the app comes back from the background
    });
  }
  return dbPromise;
}

/** Runs fn(db); if iOS closed the connection under us, reopen once and retry. */
export async function withDb(fn) {
  try {
    return await fn(await open());
  } catch (e) {
    const lost = e && (e.name === 'InvalidStateError' || /connection|closing|lost/i.test(String(e.message)));
    if (!lost) throw e;
    dbPromise = null;
    return fn(await open());
  }
}

/**
 * Logout: nothing of theirs stays on this phone (the outbox too, after the "changes
 * haven't been sent" dialog). A different person logging in keeps the outbox: those
 * changes stay unsent until their owner logs in here again (PWA §5.4).
 */
export async function wipeAll({ keepOutbox = false } = {}) {
  await withDb(async (d) => {
    const stores = keepOutbox ? ['records', 'snapshots', 'meta'] : ['records', 'snapshots', 'meta', 'outbox'];
    const tx = d.transaction(stores, 'readwrite');
    await Promise.all(stores.map((n) => tx.objectStore(n).clear()));
    await tx.done;
  });
}

/** Tests only: forget the open connection (fake-indexeddb is reset between tests). */
export function _resetForTests() {
  dbPromise = null;
}
