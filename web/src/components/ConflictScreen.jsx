// Conflict screen (FEATURES A4, DESIGN §7 Conflict dialog): full screen, one card
// per clashing field with Yours / Theirs (+ Keep both for long text), a collapsed
// "Merged automatically (n)" line, Save my choices (enabled once all are chosen)
// and Keep theirs.
import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n/strings.en.js';

export default function ConflictScreen({ conflict, labels, longText = [], format = (f, v) => v, onSave, onKeepTheirs, saving = false }) {
  const [choices, setChoices] = useState({});
  const [open, setOpen] = useState(false);
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const who = conflict.who ?? t('conflict.someone');
  const show = (f, v) => {
    const s = v == null || v === '' ? t('conflict.empty') : format(f, v);
    return String(s);
  };
  const ready = conflict.conflicts.every((f) => choices[f]);

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-bg" role="dialog" aria-modal="true" aria-labelledby="conflict-title">
      <div className="mx-auto flex max-w-xl flex-col gap-5 px-safe py-6 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <h1 id="conflict-title" ref={heading} tabIndex={-1} className="text-2xl font-bold">
          {conflict.at ? t('conflict.header', { name: who, time: conflict.at }) : t('conflict.headerNoTime', { name: who })}
        </h1>
        <p className="text-text-muted">{t('conflict.intro')}</p>

        {conflict.auto.length > 0 && (
          <div className="rounded-md bg-surface p-3 shadow-card">
            <button type="button" className="tap w-full text-left font-bold" aria-expanded={open} onClick={() => setOpen(!open)}>
              {t('conflict.auto', { n: conflict.auto.length })}
            </button>
            {open && (
              <ul className="mt-2 flex flex-col gap-1">
                {conflict.auto.map((f) => <li key={f}>{labels[f]}: {show(f, conflict.merged[f])}</li>)}
              </ul>
            )}
          </div>
        )}

        {conflict.conflicts.map((f) => {
          const opts = [
            ['mine', t('conflict.yours'), show(f, conflict.mine[f])],
            ['theirs', t('conflict.theirs', { name: who }), show(f, conflict.theirs[f])],
          ];
          if (longText.includes(f)) opts.push(['both', t('conflict.both'), `${show(f, conflict.theirs[f])}\n${show(f, conflict.mine[f])}`]);
          return (
            <fieldset key={f} className="flex flex-col gap-2 rounded-md bg-surface p-4 shadow-card">
              <legend className="px-1 text-lg font-bold">{labels[f]}</legend>
              {opts.map(([value, label, text]) => (
                <label key={value} className={`tap flex items-start gap-3 rounded-md border-[1.5px] p-3 ${choices[f] === value ? 'border-primary bg-primary-soft' : 'border-border'}`}>
                  <input type="radio" name={`conflict-${f}`} value={value} checked={choices[f] === value} onChange={() => setChoices({ ...choices, [f]: value })} className="mt-1 size-6 shrink-0 accent-[var(--color-primary)]" />
                  <span className="flex flex-col">
                    <span className="font-bold">{label}</span>
                    <span className="whitespace-pre-line break-words">{text}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          );
        })}

        <div className="flex flex-col gap-3">
          <button type="button" disabled={!ready || saving} onClick={() => onSave(choices)} className="tap rounded-md bg-primary px-5 font-bold text-on-primary disabled:opacity-50">
            {saving ? t('saving') : t('conflict.save')}
          </button>
          <button type="button" onClick={onKeepTheirs} className="tap rounded-md border-[1.5px] border-border-strong bg-surface px-5">
            {t('conflict.keepTheirs', { name: who })}
          </button>
        </div>
      </div>
    </div>
  );
}
