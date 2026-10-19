// Form fields (DESIGN §7 Inputs): label above, helper below, error under the
// field with an icon and words, announced to screen readers. ≥ 52 px tall.
import { useId, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { t } from '../i18n/strings.en.js';

export function FieldShell({ id, label, help, error, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-bold">{label}</label>
      {children}
      {help && !error && <p id={`${id}-help`} className="text-sm text-text-muted">{help}</p>}
      {error && (
        <p id={`${id}-error`} className="flex items-start gap-1 text-sm text-danger" aria-live="polite">
          <TriangleAlert aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

const inputClass = 'tap w-full rounded-2xl border border-stone-200/90 dark:border-white/10 bg-white/95 dark:bg-stone-900/60 px-4 text-sm sm:text-base text-stone-900 dark:text-stone-100 min-h-[3rem] shadow-2xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#861C32]/30 transition-all';

// Icon (optional, 1.0.23): a decorative lucide icon inside the field on the left.
function WithIcon({ Icon, children }) {
  if (!Icon) return children;
  return (
    <div className="relative flex-1">
      <Icon aria-hidden="true" size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
      {children}
    </div>
  );
}

export function TextField({ label, help, error, value, onChange, type = 'text', Icon = null, ...rest }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} help={help} error={error}>
      <WithIcon Icon={Icon}><input
        id={id}
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : help ? `${id}-help` : undefined}
        className={`${inputClass} ${Icon ? 'pl-12' : ''} ${error ? 'border-danger' : 'border-border-strong'}`}
        {...rest}
      /></WithIcon>
    </FieldShell>
  );
}

export function PhoneField(props) {
  return <TextField type="tel" inputMode="tel" autoComplete="tel" {...props} />;
}

export function PasswordField({ label, help, error, value, onChange, autoComplete = 'current-password', Icon = null, ...rest }) {
  const id = useId();
  const [shown, setShown] = useState(false);
  return (
    <FieldShell id={id} label={label} help={help} error={error}>
      <div className="flex gap-2">
        <WithIcon Icon={Icon}><input
          id={id}
          type={shown ? 'text' : 'password'}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck="false"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-error` : help ? `${id}-help` : undefined}
          className={`${inputClass} flex-1 ${Icon ? 'pl-12' : ''} ${error ? 'border-danger' : 'border-border-strong'}`}
          {...rest}
        /></WithIcon>
        <button type="button" className="tap rounded-2xl border border-stone-200/90 dark:border-white/10 bg-white px-4 font-bold text-primary" onClick={() => setShown(!shown)} aria-pressed={shown}>
          {shown ? t('hide') : t('show')}
        </button>
      </div>
    </FieldShell>
  );
}

/** Single-choice chips (≤ 6 options): selected = soft fill + ✓ + bold (never colour alone). */
export function ChoiceChips({ label, options, value, onChange, error, help }) {
  const id = useId();
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="mb-1 font-bold text-stone-900 dark:text-stone-100 text-sm sm:text-base">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value === o.value;
          return (
            <label
              key={o.value}
              className={`tap inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-all ${
                on
                  ? 'bg-[#861C32] text-white font-bold border-[#861C32] shadow-xs'
                  : 'bg-white dark:bg-stone-900 border-stone-200/90 dark:border-white/10 text-stone-700 dark:text-stone-300 hover:border-stone-400'
              }`}
            >
              <input type="radio" name={id} value={o.value} checked={on} onChange={() => onChange(o.value)} className="sr-only" />
              <span aria-hidden="true">{on ? '✓' : ''}</span>
              <span>{o.label}</span>
            </label>
          );
        })}
      </div>
      {help && <p className="text-xs text-stone-500 dark:text-stone-400">{help}</p>}
      {error && <p id={`${id}-error`} className="text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>}
    </fieldset>
  );
}

export function Toggle({ label, help, checked, onChange, disabled }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="flex flex-col">
        <span className="font-bold">{label}</span>
        {help && <span className="text-sm text-text-muted">{help}</span>}
      </label>
      <input id={id} type="checkbox" role="switch" className="tap h-7 w-12 accent-[var(--c-primary)]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </div>
  );
}

/** "Please fix 2 things below." at the top of a form. */
export function FixSummary({ fields }) {
  const n = Object.keys(fields || {}).length;
  if (n === 0) return null;
  return (
    <p role="alert" className="rounded-lg bg-danger-soft p-3 font-bold text-danger">
      {n === 1 ? t('fixOne') : t('fixThings', { n })}
    </p>
  );
}

export function Notice({ kind = 'info', children }) {
  const cls = { info: 'bg-info-soft', danger: 'bg-danger-soft', success: 'bg-success-soft', warning: 'bg-warning-soft' }[kind];
  return <p role={kind === 'danger' ? 'alert' : 'status'} className={`rounded-lg p-3 ${cls}`}>{children}</p>;
}
