// save.js — the screens' door to the outbox. The sender (outbox.js) is loaded the first time
// something is saved or waiting, so it never weighs on the first screen (Lighthouse budget).
export { useOutbox, useWaiting, refreshOutbox } from './outboxState.js';

const sender = () => import('./outbox.js');

/** See outbox.js saveViaOutbox: online → the reply; no internet → { queued: true, data }. */
export const saveViaOutbox = async (...args) => (await sender()).saveViaOutbox(...args);
export const flushOutbox = async (opts) => (await sender()).flushOutbox(opts);

/** AppShell: starts the outbox triggers once the page has loaded. Returns a stop function. */
export function startOutboxLoop() {
  let stop = null;
  let cancelled = false;
  const begin = () => sender().then((m) => { if (!cancelled) stop = m.startOutboxLoop(); });
  if (document.readyState === 'complete') begin(); else window.addEventListener('load', begin, { once: true });
  return () => { cancelled = true; window.removeEventListener('load', begin); stop?.(); };
}
