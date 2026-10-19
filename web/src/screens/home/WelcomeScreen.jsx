// WelcomeScreen.jsx — Personalized Wedding Welcome Screen matching reference.
// Features pencil-sketch rendering of Ayush & Mahi, botanical drawings, watercolor washes,
// Cormorant Garamond typography, 4-column minimal countdown, and editorial mobile layout.
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { monthsDaysHours } from './countdownMath.js';
import { t } from '../../i18n/strings.en.js';

function useNow(stepMs = 60000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), stepMs);
    return () => clearInterval(id);
  }, [stepMs]);
  return now;
}

export default function WelcomeScreen({
  countdown = null,
  onViewPlans = null,
  standalone = true,
  className = '',
}) {
  const now = useNow();
  const [activeDot, setActiveDot] = useState(0);

  // Compute countdown: either from dashboard data or fallback to reference numbers
  const weddingStartsAt = countdown?.weddingStartsAt || '2027-02-13T18:30:00Z';
  const liveLeft = monthsDaysHours(now, Date.parse(weddingStartsAt));
  const left = liveLeft ?? { months: 3, days: 26, hours: 3, minutes: 52 };

  const pad = (n) => String(Math.max(0, n)).padStart(2, '0');
  const accessibleTimerLabel = liveLeft
    ? t('home.countdownAria', liveLeft)
    : `${left.months} months, ${left.days} days, ${left.hours} hours and ${left.minutes} minutes to the wedding`;

  return (
    <div
      className={`relative mx-auto flex w-full max-w-[430px] flex-col justify-between overflow-hidden bg-[#FBF5ED] px-4 pt-safe pb-safe text-center select-none ${
        standalone ? 'min-h-dvh' : 'min-h-[820px]'
      } ${className}`}
      data-testid="welcome-screen"
    >
      {/* Background delicate watercolor & botanical accents */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse at 50% 25%, rgba(243, 220, 215, 0.5) 0%, rgba(251, 245, 237, 0) 70%)',
        }}
      />
      <img
        src="/art/welcome-floral-bl-clean.webp"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-2 -left-2 h-36 w-auto object-contain opacity-60"
      />
      <img
        src="/art/welcome-floral-br-clean.webp"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-2 -right-1 h-44 w-auto object-contain opacity-80"
      />

      {/* TOP HEADER: Hamburger Menu | A&M Monogram + Subtitle | Profile Photo */}
      <header className="relative z-10 flex min-h-14 w-full items-center justify-between pt-2">
        {/* Hamburger Menu (upper-left) */}
        <Link
          to="/more"
          aria-label={t('home.menu')}
          className="tap flex size-11 items-center justify-center rounded-full text-[#861C32] transition-transform active:scale-90"
        >
          <div className="flex flex-col gap-1.5 p-1" aria-hidden="true">
            <span className="h-[2px] w-5 rounded-full bg-[#861C32]" />
            <span className="h-[2px] w-5 rounded-full bg-[#861C32]" />
            <span className="h-[2px] w-5 rounded-full bg-[#861C32]" />
          </div>
        </Link>

        {/* Center: A&M Floral Monogram + WEDDING PLANNER */}
        <div className="flex flex-col items-center">
          <img
            src="/art/loading-monogram.png"
            alt="A&M Monogram"
            width={120}
            height={56}
            className="h-9 w-auto object-contain drop-shadow-[0_1px_4px_rgba(199,161,106,0.25)]"
          />
          <h1
            aria-label={t('appName')}
            className="mt-0.5 text-[0.62rem] font-bold uppercase tracking-[0.24em] text-[#9E7D47]"
          >
            {t('home.logoSub')}
          </h1>
        </div>

        {/* Profile Avatar with Notification Dot (upper-right) */}
        <Link
          to="/settings/account"
          aria-label="Profile"
          className="tap relative flex size-11 items-center justify-center"
        >
          <div className="relative size-9 overflow-hidden rounded-full ring-1 ring-white/80 shadow-xs">
            <img
              src="/art/mahi-avatar.png"
              alt="Mahi Profile"
              width={36}
              height={36}
              className="h-full w-full object-cover"
            />
          </div>
          <span
            aria-label="New update"
            className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-[#861C32] ring-2 ring-[#FBF5ED]"
          />
        </Link>
      </header>

      {/* CENTRAL ILLUSTRATION: Real couple pencil sketch with botanical line art */}
      <div className="relative z-10 my-auto flex w-full flex-col items-center px-1">
        <div className="relative w-full max-w-[370px]">
          <img
            src="/art/welcome-couple-perfect.webp"
            alt="Ayush & Mahi wedding pencil illustration"
            width={657}
            height={425}
            fetchpriority="high"
            className="h-auto w-full object-contain drop-shadow-[0_6px_20px_rgba(134,28,50,0.06)]"
          />
        </div>

        {/* HEADLINE: Two Hearts / One Journey */}
        <div className="mt-1 flex flex-col items-center">
          <h2 className="font-display text-[2.35rem] font-bold leading-tight tracking-[0.01em] text-[#861C32] sm:text-[2.65rem]">
            Two Hearts
          </h2>
          <div className="-mt-2 mb-1 flex items-center justify-center">
            <img
              src="/art/one-journey-script.png"
              alt="One Journey"
              width={380}
              height={85}
              className="h-11 w-auto object-contain sm:h-13"
            />
          </div>
          <p className="font-display text-lg font-medium tracking-[0.04em] text-[#493C38] sm:text-xl">
            {t('home.coupleNames')}
          </p>
          <p className="mt-0.5 text-xs font-semibold tracking-[0.16em] text-[#493C38]/80 sm:text-sm">
            14 &ndash; 16 Feb 2027
          </p>
        </div>

        {/* FOUR-PART COUNTDOWN: Minimal, airy columns separated by champagne-gold lines */}
        <div className="mt-5 w-full max-w-[340px]">
          <div
            role="timer"
            aria-label={accessibleTimerLabel}
            className="flex w-full items-center justify-between"
          >
            {/* Months */}
            <div className="flex flex-1 flex-col items-center">
              <span className="font-display text-[2.1rem] font-bold leading-none text-[#861C32] sm:text-4xl">
                {pad(left.months)}
              </span>
              <span className="mt-1 text-[0.68rem] font-medium tracking-wider text-[#493C38] sm:text-xs">
                {left.months === 1 ? t('home.month') : t('home.months')}
              </span>
            </div>

            {/* Vertical Champagne-Gold Divider */}
            <div className="h-9 w-[1px] shrink-0 bg-[#C7A16A]/60" />

            {/* Days */}
            <div className="flex flex-1 flex-col items-center">
              <span className="font-display text-[2.1rem] font-bold leading-none text-[#861C32] sm:text-4xl">
                {pad(left.days)}
              </span>
              <span className="mt-1 text-[0.68rem] font-medium tracking-wider text-[#493C38] sm:text-xs">
                {left.days === 1 ? t('home.day') : t('home.days')}
              </span>
            </div>

            {/* Vertical Champagne-Gold Divider */}
            <div className="h-9 w-[1px] shrink-0 bg-[#C7A16A]/60" />

            {/* Hours */}
            <div className="flex flex-1 flex-col items-center">
              <span className="font-display text-[2.1rem] font-bold leading-none text-[#861C32] sm:text-4xl">
                {pad(left.hours)}
              </span>
              <span className="mt-1 text-[0.68rem] font-medium tracking-wider text-[#493C38] sm:text-xs">
                {left.hours === 1 ? t('home.hour') : t('home.hours')}
              </span>
            </div>

            {/* Vertical Champagne-Gold Divider */}
            <div className="h-9 w-[1px] shrink-0 bg-[#C7A16A]/60" />

            {/* Minutes */}
            <div className="flex flex-1 flex-col items-center">
              <span className="font-display text-[2.1rem] font-bold leading-none text-[#861C32] sm:text-4xl">
                {pad(left.minutes)}
              </span>
              <span className="mt-1 text-[0.68rem] font-medium tracking-wider text-[#493C38] sm:text-xs">
                {left.minutes === 1 ? t('home.minute') : t('home.minutes')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER: Minimal Pagination Dots & View Our Plans CTA */}
      <footer className="relative z-10 flex flex-col items-center pb-4 pt-2">
        {/* 5 Minimal Carousel Pagination Dots */}
        <div
          role="tablist"
          aria-label="Carousel pagination"
          className="mb-3.5 flex items-center justify-center gap-2"
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === activeDot}
              aria-label={`Slide ${i + 1}`}
              onClick={() => setActiveDot(i)}
              className="flex size-4 items-center justify-center"
            >
              <span
                className={`block size-2 rounded-full transition-all duration-300 ${
                  i === activeDot ? 'bg-[#861C32] scale-110' : 'bg-[#F3DCD7] hover:bg-[#C7A16A]'
                }`}
              />
            </button>
          ))}
        </div>

        {/* View Our Plans CTA */}
        {onViewPlans ? (
          <button
            type="button"
            onClick={onViewPlans}
            className="group flex flex-col items-center tap px-4 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#861C32] rounded-sm"
          >
            <span className="font-display text-base font-bold tracking-[0.03em] text-[#861C32] sm:text-lg transition-transform duration-300 group-hover:translate-x-0.5">
              View Our Plans &rarr;
            </span>
            <span className="mt-0.5 h-[1px] w-full max-w-[145px] bg-[#861C32]/45 transition-colors group-hover:bg-[#861C32]" />
          </button>
        ) : (
          <Link
            to="/tasks"
            className="group flex flex-col items-center tap px-4 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#861C32] rounded-sm"
          >
            <span className="font-display text-base font-bold tracking-[0.03em] text-[#861C32] sm:text-lg transition-transform duration-300 group-hover:translate-x-0.5">
              View Our Plans &rarr;
            </span>
            <span className="mt-0.5 h-[1px] w-full max-w-[145px] bg-[#861C32]/45 transition-colors group-hover:bg-[#861C32]" />
          </Link>
        )}
      </footer>
    </div>
  );
}
