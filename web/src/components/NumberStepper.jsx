// − 2 + for small counts (adults, children). Big buttons, the number is typed too.
import { useId } from 'react';
import { Minus, Plus } from 'lucide-react';
import { t } from '../i18n/strings.en.js';

export default function NumberStepper({ label, value, onChange, min = 0, max = 50, error, help }) {
  const id = useId();
  const n = Number.isFinite(value) ? value : min;
  const set = (v) => onChange(Math.max(min, Math.min(max, v)));
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-bold">{label}</label>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => set(n - 1)} disabled={n <= min} aria-label={t('stepper.minus', { label })}
          className="tap flex w-14 items-center justify-center rounded-sm border-[1.5px] border-border-strong bg-surface disabled:opacity-40">
          <Minus aria-hidden="true" size={22} />
        </button>
        <input id={id} type="number" inputMode="numeric" min={min} max={max} value={n}
          onChange={(e) => set(e.target.value === '' ? min : Math.trunc(Number(e.target.value)) || 0)}
          aria-invalid={error ? 'true' : undefined} aria-describedby={error ? `${id}-error` : help ? `${id}-help` : undefined}
          className={`tap w-20 rounded-sm border-[1.5px] bg-surface text-center text-lg text-text ${error ? 'border-danger' : 'border-border-strong'}`} />
        <button type="button" onClick={() => set(n + 1)} disabled={n >= max} aria-label={t('stepper.plus', { label })}
          className="tap flex w-14 items-center justify-center rounded-sm border-[1.5px] border-border-strong bg-surface disabled:opacity-40">
          <Plus aria-hidden="true" size={22} />
        </button>
      </div>
      {help && !error && <p id={`${id}-help`} className="text-sm text-text-muted">{help}</p>}
      {error && <p id={`${id}-error`} className="text-sm text-danger" aria-live="polite">{error}</p>}
    </div>
  );
}
