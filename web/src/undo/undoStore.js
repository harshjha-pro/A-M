// One snackbar at a time (DESIGN §7 Snackbar with Undo). Screens call
// showUndo({ batchId, summary }) after a delete; plain messages use showToast.
import { useSyncExternalStore } from 'react';

let current = null;
let seq = 0;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

export function showUndo({ batchId, summary, onUndone }) {
  current = { id: ++seq, kind: 'undo', batchId, text: summary, onUndone };
  emit();
}

export function showToast(text) {
  current = { id: ++seq, kind: 'toast', text };
  emit();
}

export function dismiss(id) {
  if (current && (id === undefined || current.id === id)) {
    current = null;
    emit();
  }
}

export function useSnack() {
  return useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn); }, () => current);
}
