// swClient.js — registers /sw.js and tells the app when a new version is waiting
// (PWA.md §6.1). Our own module, not an inline script (CSP script-src 'self').
// Never activates a new version by itself: only applyUpdate() does, from a tap.
import { Workbox } from 'workbox-window';

let wb = null;
let state = { supported: false, registered: false, failed: false, needRefresh: false, installing: false };
const subs = new Set();

function set(p) {
  state = { ...state, ...p };
  subs.forEach((fn) => fn());
}

export function getSwState() {
  return state;
}

export function subscribeSw(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

/** Called once from main.jsx (production builds only). */
export async function registerServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  set({ supported: true });
  wb = new Workbox('/sw.js', { scope: '/' });
  wb.addEventListener('waiting', () => set({ needRefresh: true, installing: false }));
  wb.addEventListener('installing', () => set({ installing: true }));
  try {
    const reg = await wb.register();
    set({ registered: Boolean(reg) });
    if (reg?.waiting) set({ needRefresh: true }); // a new version was already waiting from last time
    return reg;
  } catch {
    set({ failed: true }); // the app still works online; Settings › This phone shows it
    return null;
  }
}

/** Ask for a new sw.js now (after version.json said there is a new build). */
export async function checkForUpdate() {
  if (!wb) return;
  try { await wb.update(); } catch { /* offline: next time */ }
}

/** True when a new worker is installing or waiting. */
export async function updateArriving() {
  const reg = await navigator.serviceWorker?.getRegistration?.();
  return Boolean(reg && (reg.waiting || reg.installing)) || state.needRefresh;
}

/** The user tapped Refresh: activate the waiting version, then reload once it controls the page. */
export function applyUpdate() {
  if (!wb || !state.needRefresh) return false;
  wb.addEventListener('controlling', () => window.location.reload());
  wb.messageSkipWaiting();
  return true;
}
