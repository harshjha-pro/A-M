// Countdown (1.0.16; minutes on the Home photo since 1.0.23): Months : Days : Hours to the wedding (midnight IST on the first day),
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
    <div className="glass flex flex-1 flex-col items-center rounded-md px-1 py-2">
      <span className="font-display text-[2rem] leading-none text-text">{String(n).padStart(2, '0')}</span>
      <span className="text-sm font-bold text-text">{label}</span>
    </div>
  );
}

// hero: frosted tiles over the cover photo (1.0.23 redesign); otherwise its own blush card.
export default function Countdown({ data, name, hero = false }) {
  const now = useNow();
  const { weddingDay: day, weddingDays: total, weddingStartsAt, weddingStartDate } = data;
  const left = weddingStartsAt ? monthsDaysHours(now, Date.parse(weddingStartsAt)) : null;
  if (!left && day == null && !name) return null;
  return (
    <section className={hero ? 'flex flex-col gap-2' : 'flex flex-col gap-3 rounded-md bg-primary-soft p-4'} aria-label={t('home.countdown')}>
      {name && !hero && <p className="text-lg">{t('home.hello', { name })}</p>}
      {left && (
        <>
          <div className="flex items-stretch gap-2" role="timer" aria-label={t('home.countdownAria', left)}>
            <Unit n={left.months} label={left.months === 1 ? t('home.month') : t('home.months')} />
            <Unit n={left.days} label={left.days === 1 ? t('home.day') : t('home.days')} />
            <Unit n={left.hours} label={left.hours === 1 ? t('home.hour') : t('home.hours')} />
            {hero && <Unit n={left.minutes} label={left.minutes === 1 ? t('home.minute') : t('home.minutes')} />}
          </div>
          <p className={hero ? 'glass self-center rounded-full px-3 py-0.5 text-sm font-bold text-text' : 'text-center text-text-muted'}>{t('home.toTheWedding', { date: formatDateOnly(weddingStartDate) })}</p>
        </>
      )}
      {day != null && <p className={hero ? 'glass self-start rounded-md px-4 py-2 font-display text-3xl text-text' : 'text-3xl font-bold text-primary'}>{t('home.weddingDay', { n: day, total })}</p>}
    </section>
  );
}
