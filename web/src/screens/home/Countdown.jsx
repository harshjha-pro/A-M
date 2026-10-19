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
    <div className="flex flex-1 flex-col items-center">
      <span className="font-display text-[2rem] sm:text-[2.25rem] font-bold leading-none text-[#861C32] dark:text-[#F2A7AF]">
        {String(n).padStart(2, '0')}
      </span>
      <span className="mt-1 text-[0.68rem] sm:text-xs font-medium tracking-wider text-[#493C38] dark:text-[#C9BBAA]">
        {label}
      </span>
    </div>
  );
}

export function HeartDivider({ className = '' }) {
  return (
    <div className={`flex items-center justify-center gap-2 ${className}`} aria-hidden="true">
      <span className="h-[1px] w-12 bg-[#C7A16A]/50" />
      <svg width="10" height="9" viewBox="0 0 10 9" fill="none" className="text-[#C7A16A]/80">
        <path d="M5 8.5C5 8.5 1 5.5 1 3C1 1.62 2.12 0.5 3.5 0.5C4.24 0.5 4.91 0.82 5 1.34C5.09 0.82 5.76 0.5 6.5 0.5C7.88 0.5 9 1.62 9 3C9 5.5 5 8.5 5 8.5Z" stroke="currentColor" strokeWidth="0.8" fill="none"/>
      </svg>
      <span className="h-[1px] w-12 bg-[#C7A16A]/50" />
    </div>
  );
}

// hero: minimal airy layout matching reference design
export default function Countdown({ data, name, hero = false }) {
  const now = useNow();
  const { weddingDay: day, weddingDays: total, weddingStartsAt, weddingStartDate } = data;
  const left = weddingStartsAt ? monthsDaysHours(now, Date.parse(weddingStartsAt)) : null;
  if (!left && day == null && !name) return null;
  return (
    <section
      className={
        hero
          ? 'flex flex-col items-center gap-2 w-full max-w-sm mx-auto'
          : 'flex flex-col gap-3 rounded-2xl border border-white/60 bg-white/75 p-4 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-[#1E1714]/75'
      }
      aria-label={t('home.countdown')}
    >
      {name && !hero && <p className="text-lg">{t('home.hello', { name })}</p>}
      {left && (
        <>
          <div className="flex w-full items-center justify-between" role="timer" aria-label={t('home.countdownAria', left)}>
            <Unit n={left.months} label={left.months === 1 ? t('home.month') : t('home.months')} />
            <div className="h-8 w-[1px] shrink-0 bg-[#C7A16A]/50" />
            <Unit n={left.days} label={left.days === 1 ? t('home.day') : t('home.days')} />
            <div className="h-8 w-[1px] shrink-0 bg-[#C7A16A]/50" />
            <Unit n={left.hours} label={left.hours === 1 ? t('home.hour') : t('home.hours')} />
            {hero && (
              <>
                <div className="h-8 w-[1px] shrink-0 bg-[#C7A16A]/50" />
                <Unit n={left.minutes} label={left.minutes === 1 ? t('home.minute') : t('home.minutes')} />
              </>
            )}
          </div>
          {hero && <HeartDivider className="my-0.5" />}
          <p className="self-center text-xs sm:text-sm font-semibold tracking-wide text-[#861C32] dark:text-[#F2A7AF]">
            {t('home.toTheWedding', { date: formatDateOnly(weddingStartDate) })}
          </p>
        </>
      )}
      {day != null && (
        <p className="self-start font-display text-3xl font-bold text-[#861C32] dark:text-[#F2A7AF]">
          {t('home.weddingDay', { n: day, total })}
        </p>
      )}
    </section>
  );
}
