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

const inputClass = 'tap w-full rounded-sm border-[1.5px] bg-surface px-3 text-base text-text min-h-[3.25rem]';

export function TextField({ label, help, error, value, onChange, type = 'text', ...rest }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} help={help} error={error}>
      <input
        id={id}
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : help ? `${id}-help` : undefined}
        className={`${inputClass} ${error ? 'border-danger' : 'border-border-strong'}`}
        {...rest}
      />
    </FieldShell>
  );
}

export function PhoneField(props) {
  return <TextField type="tel" inputMode="tel" autoComplete="tel" {...props} />;
}

export function PasswordField({ label, help, error, value, onChange, autoComplete = 'current-password', ...rest }) {
  const id = useId();
  const [shown, setShown] = useState(false);
  return (
    <FieldShell id={id} label={label} help={help} error={error}>
      <div className="flex gap-2">
        <input
          id={id}
          type={shown ? 'text' : 'password'}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck="false"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-error` : help ? `${id}-help` : undefined}
          className={`${inputClass} flex-1 ${error ? 'border-danger' : 'border-border-strong'}`}
          {...rest}
        />
        <button type="button" className="tap rounded-sm border-[1.5px] border-border-strong bg-surface px-3" onClick={() => setShown(!shown)} aria-pressed={shown}>
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
      <legend className="mb-1 font-bold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value === o.value;
          return (
            <label key={o.value} className={`tap inline-flex cursor-pointer items-center gap-2 rounded-sm border-[1.5px] px-3 py-2 ${on ? 'border-primary bg-primary-soft font-bold text-primary' : 'border-border-strong bg-surface'}`}>
              <input type="radio" name={id} value={o.value} checked={on} onChange={() => onChange(o.value)} className="sr-only" />
              <span aria-hidden="true">{on ? '✓' : ''}</span>
              <span>{o.label}</span>
            </label>
          );
        })}
      </div>
      {help && <p className="text-sm text-text-muted">{help}</p>}
      {error && <p id={`${id}-error`} className="text-sm text-danger">{error}</p>}
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
    <p role="alert" className="rounded-md bg-danger-soft p-3 font-bold text-danger">
      {n === 1 ? t('fixOne') : t('fixThings', { n })}
    </p>
  );
}

export function Notice({ kind = 'info', children }) {
  const cls = { info: 'bg-info-soft', danger: 'bg-danger-soft', success: 'bg-success-soft', warning: 'bg-warning-soft' }[kind];
  return <p role={kind === 'danger' ? 'alert' : 'status'} className={`rounded-md p-3 ${cls}`}>{children}</p>;
}
