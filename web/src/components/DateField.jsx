// Date picker (DESIGN §7): quick chips first — Today · Tomorrow · This week · Pick date · No date —
// then the native date input. Values are IST calendar dates "YYYY-MM-DD".
import { useId, useState } from 'react';
import { CalendarDays, Timer } from 'lucide-react';
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

  const btnClass = (active) =>
    `tap flex items-center justify-center gap-2 rounded-2xl py-3 px-3 text-sm font-semibold border transition-all ${
      active
        ? 'bg-[#861C32] text-white font-bold border-[#861C32] shadow-xs'
        : 'bg-white border-stone-200/90 text-stone-700 hover:border-stone-400'
    }`;

  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-0.5 font-bold text-stone-900 text-sm sm:text-base">{label}</legend>
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          aria-pressed={chosen === 'today'}
          onClick={() => { setPicking(false); onChange(today); }}
          className={btnClass(chosen === 'today')}
        >
          <CalendarDays size={16} className={chosen === 'today' ? 'text-white' : 'text-stone-500'} />
          <span>{t('tasks.today')}</span>
        </button>
        <button
          type="button"
          aria-pressed={chosen === 'tomorrow'}
          onClick={() => { setPicking(false); onChange(addDays(today, 1)); }}
          className={btnClass(chosen === 'tomorrow')}
        >
          <CalendarDays size={16} className={chosen === 'tomorrow' ? 'text-white' : 'text-stone-500'} />
          <span>{t('tasks.tomorrow')}</span>
        </button>
        <button
          type="button"
          aria-pressed={chosen === 'week'}
          onClick={() => { setPicking(false); onChange(endOfWeek(today)); }}
          className={btnClass(chosen === 'week')}
        >
          <CalendarDays size={16} className={chosen === 'week' ? 'text-white' : 'text-stone-500'} />
          <span>{t('tasks.thisWeek')}</span>
        </button>
        <button
          type="button"
          aria-pressed={chosen === 'pick'}
          onClick={() => setPicking(!picking)}
          className={btnClass(chosen === 'pick')}
        >
          <CalendarDays size={16} className={chosen === 'pick' ? 'text-white' : 'text-stone-500'} />
          <span>{t('tasks.pickDate')}</span>
        </button>
      </div>

      <button
        type="button"
        aria-pressed={chosen === 'none'}
        onClick={() => { setPicking(false); onChange(''); }}
        className={`tap w-full flex items-center justify-center gap-2 rounded-2xl py-3 px-4 text-sm font-semibold border transition-all ${
          chosen === 'none'
            ? 'border-rose-200/90 bg-[#FDF2F2] text-[#861C32] font-bold shadow-2xs'
            : 'bg-white border-stone-200/90 text-stone-700 hover:border-stone-400'
        }`}
      >
        <Timer size={16} className={chosen === 'none' ? 'text-[#861C32]' : 'text-stone-400'} />
        <span>{t('tasks.noDate')}</span>
      </button>

      {(picking || chosen === 'pick') && (
        <label htmlFor={id} className="flex flex-col gap-1 mt-1">
          <span className="sr-only">{t('tasks.pickDate')}</span>
          <input
            id={id}
            type="date"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="tap w-full rounded-2xl border border-stone-200/90 bg-white px-4 py-2.5 text-sm text-stone-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#861C32]/30"
          />
        </label>
      )}
      {value && <p className="text-xs font-medium text-stone-500">{formatDateOnly(value)}</p>}
      {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
    </fieldset>
  );
}
