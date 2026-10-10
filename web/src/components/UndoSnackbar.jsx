// Snackbar with UNDO (DESIGN §7, FEATURES A2): 8 s, the timer pauses while a
// finger is on it and restarts when lifted (AC-UND-03). UNDO calls the server;
// the reply's sentence ("Undone.", or which items were skipped) is shown next.
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, newIdemKey } from '../api/client.js';
import { withRelogin } from '../api/auth.js';
import { useSnack, dismiss, showToast } from '../undo/undoStore.js';
import { t } from '../i18n/strings.en.js';

export const SNACK_MS = 8000;

export default function UndoSnackbar() {
  const snack = useSnack();
  const qc = useQueryClient();
  const [held, setHeld] = useState(false);
  const [busy, setBusy] = useState(false);
  const key = useRef(null);

  useEffect(() => {
    if (!snack || held || busy) return undefined;
    const id = snack.id;
    const timer = setTimeout(() => dismiss(id), SNACK_MS);
    return () => clearTimeout(timer);
  }, [snack, held, busy]);

  useEffect(() => { key.current = newIdemKey(); setHeld(false); }, [snack?.id]);

  if (!snack) return null;

  async function undo() {
    setBusy(true);
    try {
      const res = await withRelogin(() => api('POST', `/undo/${snack.batchId}`, { body: {}, idemKey: key.current }));
      await qc.invalidateQueries();
      snack.onUndone?.(res.data);
      showToast(res.data.message || t('undo.done'));
    } catch (e) {
      showToast(e.message || t('errors.server'));
    } finally {
      setBusy(false);
    }
  }

  const hold = () => setHeld(true);
  const release = () => setHeld(false);
  return (
    <div className="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-4">
      <div
        role="status"
        aria-live="polite"
        onPointerDown={hold} onPointerUp={release} onPointerCancel={release} onPointerLeave={release}
        onTouchStart={hold} onTouchEnd={release}
        className="flex w-full max-w-xl items-center gap-3 rounded-md bg-text px-4 py-2 text-bg shadow-sheet"
      >
        <span className="min-w-0 flex-1 truncate">{snack.text}</span>
        {snack.kind === 'undo' && (
          <button type="button" onClick={undo} disabled={busy} className="tap min-w-12 rounded-md px-3 font-bold uppercase text-primary-soft">
            {busy ? t('saving') : t('undo.button')}
          </button>
        )}
      </div>
    </div>
  );
}
