// Bottom sheet (DESIGN §7): drag handle look, a visible Close, focus kept inside,
// Esc or a tap on the backdrop closes it. Max 90 dvh; content scrolls.
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { t } from '../i18n/strings.en.js';

export default function Sheet({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40" role="presentation" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabIndex={-1} ref={ref}
        className="flex max-h-[90dvh] w-full max-w-xl flex-col rounded-t-xl bg-surface shadow-sheet outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-border-strong" aria-hidden="true" />
        <div className="flex items-center gap-2 px-4 pt-2">
          <h2 id="sheet-title" className="flex-1 text-xl font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="tap inline-flex items-center gap-1 rounded-md px-3 text-primary">
            <X aria-hidden="true" size={22} /> {t('tasks.close')}
          </button>
        </div>
        <div className="overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3">{children}</div>
      </div>
    </div>
  );
}
