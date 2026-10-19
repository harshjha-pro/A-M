// View chips with counts (FEATURES B3): one chosen at a time, wraps, never scrolls sideways.
export default function ChipFilter({ label, options, value, onChange }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`tap shrink-0 inline-flex items-center justify-center rounded-2xl px-4 sm:px-5 py-2 text-sm font-semibold transition-all ${
              on
                ? 'bg-[#861C32] text-white font-bold border border-[#861C32] shadow-xs'
                : 'bg-white/95 dark:bg-stone-900/80 text-stone-800 dark:text-stone-200 border border-stone-200/80 dark:border-white/10 hover:bg-white'
            }`}
          >
            {o.label}
            {o.count != null && (
              <span
                className={`ml-1.5 rounded-full px-1.5 text-xs font-bold ${
                  on ? 'bg-white/25 text-white' : 'bg-stone-100 dark:bg-white/10 text-stone-500 dark:text-stone-400'
                }`}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Many chosen (assignees, tags). */
export function MultiChips({ label, options, value, onChange, error, legendClass = 'font-bold text-stone-900 dark:text-stone-100 text-sm sm:text-base' }) {
  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={`mb-1 ${legendClass}`}>{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <label
              key={o.value}
              className={`tap inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-all ${
                on
                  ? 'bg-[#861C32] text-white font-bold border-[#861C32] shadow-xs'
                  : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border-stone-200/90 dark:border-white/10 hover:border-stone-400'
              }`}
            >
              <input type="checkbox" checked={on} onChange={() => toggle(o.value)} className="sr-only" />
              <span aria-hidden="true">{on ? '✓' : ''}</span>
              <span>{o.label}</span>
            </label>
          );
        })}
      </div>
      {error && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>}
    </fieldset>
  );
}
