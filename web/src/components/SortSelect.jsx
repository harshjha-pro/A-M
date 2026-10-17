// "Sort: Due date ▾" for a list (1.0.24). options: [{ value, label }]; the server does the sorting.
import { ArrowDownUp } from 'lucide-react';
import { t } from '../i18n/strings.en.js';

export default function SortSelect({ value, onChange, options }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <ArrowDownUp aria-hidden="true" size={18} className="text-text-muted" />
      <span className="sr-only">{t('sort.label')}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={t('sort.label')}
        className="tap rounded-full border-[1.5px] border-border bg-surface px-3 text-base text-text">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
