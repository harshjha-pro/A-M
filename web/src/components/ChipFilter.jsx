// View chips with counts (FEATURES B3): one chosen at a time, wraps, never scrolls sideways.
export default function ChipFilter({ label, options, value, onChange }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)}
            className={`tap inline-flex items-center gap-1 rounded-full border-[1.5px] px-3 text-base ${on ? 'border-primary bg-primary-soft font-bold text-primary' : 'border-border-strong bg-surface'}`}
          >
            {on && <span aria-hidden="true">✓</span>}
            {o.label}
            {o.count != null && <span className={`ml-1 rounded-full px-1.5 text-sm ${on ? 'bg-primary text-on-primary' : 'bg-bg text-text-muted'}`}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Many chosen (assignees, tags). */
export function MultiChips({ label, options, value, onChange, error }) {
  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 font-bold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <label key={o.value} className={`tap inline-flex cursor-pointer items-center gap-2 rounded-sm border-[1.5px] px-3 py-2 ${on ? 'border-primary bg-primary-soft font-bold text-primary' : 'border-border-strong bg-surface'}`}>
              <input type="checkbox" checked={on} onChange={() => toggle(o.value)} className="sr-only" />
              <span aria-hidden="true">{on ? '✓' : ''}</span>
              <span>{o.label}</span>
            </label>
          );
        })}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </fieldset>
  );
}
