// updateState.js — "the server wants a newer app" (426 update_required, or a reply whose
// X-Min-Client-Version is above ours). Turns the update prompt into its forced form
// (PWA.md §6.1): "Please refresh to keep saving. Your typing is kept."
import { useSyncExternalStore } from 'react';

let forced = false;
const subs = new Set();

/** "1.0.10" > "1.0.9" — numeric, part by part. */
export function versionGreater(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  }
  return false;
}

export function setForcedUpdate(on = true) {
  if (forced === on) return;
  forced = on;
  subs.forEach((fn) => fn());
}

export function isForcedUpdate() {
  return forced;
}

export function useForcedUpdate() {
  return useSyncExternalStore((fn) => { subs.add(fn); return () => subs.delete(fn); }, () => forced, () => false);
}
