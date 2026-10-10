// state.js — is the screen showing the phone's copy, and from when? (PWA.md §5.4)
// The offline banner reads it: "No internet · from Tue 13 Oct, 9:40 PM".
import { useSyncExternalStore } from 'react';

let state = { offline: false, from: null };
const subs = new Set();
const emit = () => subs.forEach((fn) => fn());

/** A screen was answered from the phone's copy saved at `from` (ISO). */
export function markOffline(from) {
  if (state.offline && state.from === from) return;
  state = { offline: true, from: from ?? state.from };
  emit();
}

/** A real reply arrived from the server. */
export function markOnline() {
  if (!state.offline) return;
  state = { offline: false, from: null };
  emit();
}

export function getOfflineState() {
  return state;
}

export function useOfflineState() {
  return useSyncExternalStore((fn) => { subs.add(fn); return () => subs.delete(fn); }, () => state, () => state);
}
