// answer.js — a GET with no internet: the phone's copy, never a pretend success.
// Order: the saved rows from /sync (searchable, PWA §5.1) or the saved reply of this exact
// screen, whichever is newer; nothing saved → "Open this once with internet to see it offline."
import { localAnswer } from './local.js';
import { readReply, replyKey, getMeta, saveReply, putRecords } from './cache.js';

/** Replies never kept (secrets, live-only, or the sync itself). */
const NEVER = [/^\/session$/, /^\/sync$/, /^\/exports/, /^\/health$/, /^\/client-log$/, /^\/me\/sessions/, /\/history$/, /^\/activity/, /^\/trash/];

export const keepable = (path) => !NEVER.some((re) => re.test(path));

/** Detail screens whose reply has the same shape as the /sync rows: refresh those rows too. */
const DETAIL_KIND = { households: 'households', tasks: 'tasks', events: 'events', vendors: 'vendors', payments: 'payments', documents: 'documents' };

/** `gen`: the wipe generation when the request started — a reply that lands after a logout is dropped. */
export async function rememberReply(path, query, data, meta, gen) {
  if (!keepable(path)) return;
  await saveReply(replyKey(path, query), data, meta, gen);
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 2 && DETAIL_KIND[parts[0]] && data && data.id === parts[1]) await putRecords(DETAIL_KIND[parts[0]], [data], gen);
}

/** @returns {Promise<{data, meta, from: string}|null>} — throws OfflineError('needs_internet') for advanced filters */
export async function offlineAnswer(path, query, user) {
  if (!keepable(path)) return null;
  const [snap, synced] = await Promise.all([readReply(replyKey(path, query)), getMeta('lastSyncedAt')]);
  let local = null;
  let localError = null;
  try {
    local = synced ? await localAnswer(path, query, user) : null;
  } catch (e) {
    localError = e;
  }
  if (snap && (!local || !synced || snap.savedAt > synced)) return { data: snap.data, meta: snap.meta ?? {}, from: snap.savedAt };
  if (local) return { ...local, from: synced };
  if (localError) throw localError;
  return null;
}
