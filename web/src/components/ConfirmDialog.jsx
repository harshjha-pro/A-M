// Confirmations only where Undo can't help (DESIGN §8): log out, log out everywhere, reset password.
import { useEffect, useRef } from 'react';

export default function ConfirmDialog({ title, body, confirmLabel, cancelLabel = 'Cancel', danger = false, onConfirm, onCancel }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" role="presentation" onClick={onCancel}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="m-4 flex w-full max-w-md flex-col gap-4 rounded-lg bg-surface p-5 shadow-sheet" onClick={(e) => e.stopPropagation()}>
        <h2 id="confirm-title" className="text-xl font-bold" ref={ref} tabIndex={-1}>{title}</h2>
        {body && <p>{body}</p>}
        <div className="flex flex-col gap-3">
          <button type="button" onClick={onConfirm} className={`tap rounded-md px-5 font-bold ${danger ? 'border-[1.5px] border-danger bg-danger text-white' : 'bg-primary text-on-primary'}`}>{confirmLabel}</button>
          <button type="button" onClick={onCancel} className="tap rounded-md border-[1.5px] border-border-strong bg-surface px-5">{cancelLabel}</button>
        </div>
      </div>
    </div>
  );
}
