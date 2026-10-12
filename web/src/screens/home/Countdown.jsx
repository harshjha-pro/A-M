// Countdown (1.0.16): Months : Days : Hours to the wedding (midnight IST on the first day),
// ticking every minute; "Day 1 of 3" during it; hidden after.
import { useEffect, useState } from 'react';
import { monthsDaysHours } from './countdownMath.js';
import { formatDateOnly } from '../../format/ist.js';
import { t } from '../../i18n/strings.en.js';

function useNow(stepMs = 60000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), stepMs);
    return () => clearInterval(id);
  }, [stepMs]);
  return now;
}

function Unit({ n, label }) {
  return (
    <div className="flex flex-1 flex-col items-center rounded-md bg-surface px-2 py-3">
      <span className="text-4xl font-bold tabular-nums text-primary">{String(n).padStart(2, '0')}</span>
      <span className="text-sm text-text-muted">{label}</span>
    </div>
  );
}

export default function Countdown({ data, name }) {
  const now = useNow();
  const { weddingDay: day, weddingDays: total, weddingStartsAt, weddingStartDate } = data;
  const left = weddingStartsAt ? monthsDaysHours(now, Date.parse(weddingStartsAt)) : null;
  if (!left && day == null && !name) return null;
  return (
    <section className="flex flex-col gap-3 rounded-md bg-primary-soft p-4" aria-label={t('home.countdown')}>
      {name && <p className="text-lg">{t('home.hello', { name })}</p>}
      {left && (
        <>
          <div className="flex items-stretch gap-2" role="timer" aria-label={t('home.countdownAria', left)}>
            <Unit n={left.months} label={left.months === 1 ? t('home.month') : t('home.months')} />
            <span aria-hidden="true" className="self-center text-2xl font-bold text-primary">:</span>
            <Unit n={left.days} label={left.days === 1 ? t('home.day') : t('home.days')} />
            <span aria-hidden="true" className="self-center text-2xl font-bold text-primary">:</span>
            <Unit n={left.hours} label={left.hours === 1 ? t('home.hour') : t('home.hours')} />
          </div>
          <p className="text-center text-text-muted">{t('home.toTheWedding', { date: formatDateOnly(weddingStartDate) })}</p>
        </>
      )}
      {day != null && <p className="text-3xl font-bold text-primary">{t('home.weddingDay', { n: day, total })}</p>}
    </section>
  );
}
