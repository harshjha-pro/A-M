// dirtyForms.js — which forms have unsaved typing right now (PWA.md §6.2).
// The update prompt never reloads while one does.
import { useEffect } from 'react';

const dirty = new Set();

export function anyDirtyForm() {
  return dirty.size > 0;
}

/** In a form: useDirtyForm('task-form', isDirty) */
export function useDirtyForm(id, isDirty) {
  useEffect(() => {
    if (isDirty) dirty.add(id); else dirty.delete(id);
    return () => { dirty.delete(id); };
  }, [id, isDirty]);
}
