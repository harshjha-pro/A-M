// Date picker (DESIGN §7): quick chips first — Today · Tomorrow · This week · Pick date · No date —
// then the native date input. Values are IST calendar dates "YYYY-MM-DD".
import { useId, useState } from 'react';
import { todayIst, formatDateOnly } from '../format/ist.js';
import { t } from '../i18n/strings.en.js';

export function addDays(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** Sunday of this week (Mon–Sun, IST). */
export function endOfWeek(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sun
  return addDays(ymd, dow === 0 ? 0 : 7 - dow);
}

export function nextMonday(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(ymd, dow === 1 ? 7 : (8 - dow) % 7 || 7);
}

export default function DateField({ label, value, onChange, error }) {
  const id = useId();
  const today = todayIst();
  const [picking, setPicking] = useState(false);
  const chips = [
    { key: 'today', label: t('tasks.today'), v: today },
    { key: 'tomorrow', label: t('tasks.tomorrow'), v: addDays(today, 1) },
    { key: 'week', label: t('tasks.thisWeek'), v: endOfWeek(today) },
  ];
  const chosen = chips.find((c) => c.v === value)?.key ?? (value ? 'pick' : 'none');
  const chip = (key, text, onTap) => (
    <button key={key} type="button" aria-pressed={chosen === key} onClick={onTap}
      className={`tap inline-flex items-center gap-1 rounded-sm border-[1.5px] px-3 ${chosen === key ? 'border-primary bg-primary-soft font-bold text-primary' : 'border-border-strong bg-surface'}`}>
      {chosen === key && <span aria-hidden="true">✓</span>}{text}
    </button>
  );
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 font-bold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => chip(c.key, c.label, () => { setPicking(false); onChange(c.v); }))}
        {chip('pick', t('tasks.pickDate'), () => setPicking(true))}
        {chip('none', t('tasks.noDate'), () => { setPicking(false); onChange(''); })}
      </div>
      {(picking || chosen === 'pick') && (
        <label htmlFor={id} className="flex flex-col gap-1">
          <span className="sr-only">{t('tasks.pickDate')}</span>
          <input id={id} type="date" value={value || ''} onChange={(e) => onChange(e.target.value)}
            className="tap w-full rounded-sm border-[1.5px] border-border-strong bg-surface px-3 text-base text-text" />
        </label>
      )}
      {value && <p className="text-sm text-text-muted">{formatDateOnly(value)}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
    </fieldset>
  );
}
