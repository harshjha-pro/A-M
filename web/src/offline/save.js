// save.js — the screens' door to the outbox. The sender (outbox.js) is loaded the first time
// something is saved or waiting, so it never weighs on the first screen (Lighthouse budget).
export { useOutbox, useWaiting, refreshOutbox } from './outboxState.js';

const sender = () => import('./outbox.js');
const START_DELAY_MS = 3000;

/** See outbox.js saveViaOutbox: online → the reply; no internet → { queued: true, data }. */
export const saveViaOutbox = async (...args) => (await sender()).saveViaOutbox(...args);
export const flushOutbox = async (opts) => (await sender()).flushOutbox(opts);

/** AppShell: starts the outbox triggers once the page has loaded. Returns a stop function. */
export function startOutboxLoop() {
  let stop = null;
  let cancelled = false;
  let timer = null;
  const idle = (fn) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 2000 }) : fn());
  const start = () => sender().then((m) => { if (!cancelled) stop = m.startOutboxLoop(); });
  // 3 s after load and an idle moment: the first screen is drawn first (Lighthouse budget).
  const begin = () => { timer = setTimeout(() => idle(start), START_DELAY_MS); };
  if (document.readyState === 'complete') begin(); else window.addEventListener('load', begin, { once: true });
  return () => { cancelled = true; clearTimeout(timer); window.removeEventListener('load', begin); stop?.(); };
}
