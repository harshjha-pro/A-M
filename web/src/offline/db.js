// db.js — one IndexedDB database on the phone for the read cache (PWA.md §5.1); the
// outbox store arrives with Session 14. Stores:
//   records    rows from /sync and from detail screens, keyed [kind, id] (camelCase, as screens use them)
//   snapshots  whole GET replies as they came, keyed by "path?query" (any screen seen online)
//   meta       small values: userId, nextSince, lastSyncedAt
import { openDB } from 'idb';

const DB_NAME = 'am-wedding';
const DB_VERSION = 2; // 2: create any missing store (a database opened empty elsewhere stays usable)
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

/** Logout or a different person: nothing of theirs stays on this phone. */
export async function wipeAll() {
  await withDb(async (d) => {
    const stores = ['records', 'snapshots', 'meta'];
    const tx = d.transaction(stores, 'readwrite');
    await Promise.all(stores.map((n) => tx.objectStore(n).clear()));
    await tx.done;
  });
}

/** Tests only: forget the open connection (fake-indexeddb is reset between tests). */
export function _resetForTests() {
  dbPromise = null;
}
