// Select mode bar (1.0.24, admin-operations brief §14): "8 selected", Select visible, Deselect all,
// then the actions this person may use. Sticky under the top bar so it stays in reach.
import { formatCount } from '../format/inr.js';
import { t } from '../i18n/strings.en.js';

export default function SelectBar({ count, visible, onSelectVisible, onClear, children, label }) {
  return (
    <section aria-label={label || t('bulk.pick')} className="glass-sheet sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 -mx-1 flex flex-col gap-2 rounded-lg p-3 shadow-card">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-bold" aria-live="polite">{t('bulk.selectedN', { n: formatCount(count) })}</span>
        {visible > 0 && count < visible && (
          <button type="button" className="tap font-bold text-primary" onClick={onSelectVisible}>{t('bulk.selectVisible', { n: formatCount(visible) })}</button>
        )}
        {count > 0 && <button type="button" className="tap font-bold text-primary" onClick={onClear}>{t('bulk.clear')}</button>}
      </div>
      {children}
    </section>
  );
}

/** One action button in the bar; danger = red outline (delete). */
export function BulkButton({ Icon, label, onClick, disabled, danger = false }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className={`tap inline-flex items-center gap-2 rounded-full border-[1.5px] bg-surface px-4 font-bold disabled:opacity-40 ${danger ? 'border-danger text-danger' : 'border-border text-text'}`}>
      <Icon aria-hidden="true" size={18} /> {label}
    </button>
  );
}
