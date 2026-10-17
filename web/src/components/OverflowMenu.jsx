// "More actions" (1.0.24, admin-operations brief §3): the main action stays on the page; less
// common ones (History, Delete …) sit behind one ⋯ button. A disclosure, not a pop-up menu:
// the items are ordinary buttons and links, keep their "Needs internet" state, and Escape or
// tapping outside closes it.
import { useEffect, useId, useRef, useState } from 'react';
import { Ellipsis } from 'lucide-react';
import { t } from '../i18n/strings.en.js';

export default function OverflowMenu({ children, label = t('common.moreActions') }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div ref={ref} className="relative flex flex-col gap-2">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}
        className="tap inline-flex items-center justify-center gap-2 self-center rounded-full border-[1.5px] border-border bg-surface px-4 font-bold text-text">
        <Ellipsis aria-hidden="true" size={20} /> {label}
      </button>
      {open && <div id={id} className="glass-sheet flex flex-col gap-2 rounded-lg p-3 shadow-card">{children}</div>}
    </div>
  );
}
