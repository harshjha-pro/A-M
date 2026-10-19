// Top of Home (1.0.16; 1.0.23 redesign): the cover slideshow with the monogram in the
// top-right corner, the headline and the frosted countdown over it, then the couple photos. Until photos are added, soft placeholders hold their place
// (Ayush and Mahi see a link to Settings › Home photos).
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ImagePlus, Menu } from 'lucide-react';
import { useHomePhotos } from '../../data/homePhotos.js';
import Countdown, { HeartDivider } from './Countdown.jsx';
import { t } from '../../i18n/strings.en.js';

const SLIDE_MS = 5000;

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function CoverCarousel({ covers = [], monogram = null, overlay = null, name = null }) {
  const track = useRef(null);
  const [index, setIndex] = useState(0);
  const n = covers.length;

  // Slide by itself every 5 s (not with reduced motion, not with one photo).
  useEffect(() => {
    if (n < 2 || reducedMotion()) return undefined;
    const id = setInterval(() => {
      const el = track.current;
      if (!el || document.hidden) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % n;
      el.scrollTo?.({ left: next * el.clientWidth, behavior: 'smooth' });
    }, SLIDE_MS);
    return () => clearInterval(id);
  }, [n]);

  const onScroll = () => {
    const el = track.current;
    if (el && el.clientWidth) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };
  const go = (i) => {
    const el = track.current;
    el?.scrollTo?.({ left: i * el.clientWidth, behavior: reducedMotion() ? 'auto' : 'smooth' });
    setIndex(i);
  };

  return (
    <section
      className="relative flex flex-col justify-between h-[calc(100dvh-5rem)] max-h-[85dvh] min-h-[520px] sm:h-[85vh] sm:max-h-[860px] w-full overflow-hidden bg-bg"
      aria-roledescription="carousel"
      aria-label={t('home.coverPhotos')}
    >
      {/* Top Header Bar */}
      <div className="z-20 flex w-full items-center justify-between px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <Link
          to="/more"
          aria-label={t('home.menu')}
          className="tap grid size-11 place-items-center rounded-full bg-white/85 border border-white/60 shadow-xs text-[#861C32] transition hover:bg-white active:scale-95"
        >
          <Menu aria-hidden="true" size={20} strokeWidth={2.2} />
        </Link>
        <h1 aria-label={t('home.title')} className="pointer-events-none flex flex-1 flex-col items-center leading-none">
          <img
            src="/art/loading-monogram.png"
            alt=""
            aria-hidden="true"
            className="h-10 sm:h-12 w-auto object-contain"
          />
          <span className="mt-0.5 text-[0.62rem] sm:text-[0.68rem] font-bold tracking-[0.22em] text-[#C7A16A] uppercase">
            {t('home.logoSub')}
          </span>
        </h1>
        <div
          className="pointer-events-none relative grid size-11 place-items-center rounded-full bg-white/85 border border-white/60 shadow-xs"
          data-testid="monogram"
        >
          {monogram ? (
            <img
              src={monogram.url}
              alt={t('home.monogram')}
              width={44}
              height={44}
              decoding="async"
              className="size-9 rounded-full object-contain"
            />
          ) : (
            <span className="font-display text-base font-semibold text-[#861C32]" aria-label={t('home.monogram')}>
              A&amp;M
            </span>
          )}
          <span className="absolute top-1 right-1 size-2 rounded-full bg-[#861C32] ring-2 ring-[#FAF6F0]" aria-hidden="true" />
        </div>
      </div>

      {/* Middle: Carousel / Photo Area */}
      {n === 0 ? (
        <div className="flex flex-1 w-full flex-col items-center justify-center bg-transparent" data-testid="cover-placeholder">
          <span className="sr-only">Ayush &amp; Mahi</span>
        </div>
      ) : (
        <div className="relative flex-1 w-full overflow-hidden my-auto min-h-[220px]">
          <div
            ref={track}
            onScroll={onScroll}
            className="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto"
            tabIndex={0}
            aria-live="off"
          >
            {covers.map((p, i) => (
              <img
                key={p.id}
                src={p.url}
                alt={t('home.coverN', { n: i + 1, total: n })}
                width={p.widthPx || 1600}
                height={p.heightPx || 1200}
                loading={i === 0 ? 'eager' : 'lazy'}
                fetchpriority={i === 0 ? 'high' : undefined}
                decoding="async"
                className="h-full w-full shrink-0 snap-center object-cover"
              />
            ))}
          </div>
          {n > 1 && (
            <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5 z-10">
              {covers.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={t('home.coverN', { n: i + 1, total: n })}
                  aria-current={i === index || undefined}
                  className="grid h-6 w-6 place-items-center"
                >
                  <span
                    className={`block h-1.5 rounded-full transition-all ${
                      i === index ? 'w-5 bg-[#861C32]' : 'w-1.5 bg-[#861C32]/40'
                    }`}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom Typography & Countdown Block */}
      <div className="z-10 flex w-full flex-col items-center px-4 pb-4 sm:pb-6 text-center">
        {name && (
          <p className="text-[0.72rem] sm:text-xs font-bold uppercase tracking-[0.24em] text-[#C7A16A]">
            {t('home.hello', { name })}
          </p>
        )}
        <HeartDivider className="my-1" />
        <p className="whitespace-pre-line font-display text-[1.85rem] sm:text-[2.2rem] font-bold leading-tight text-[#861C32]">
          {t('home.headline').replace(', ', ',\n')}
        </p>
        <div className="mt-1 flex flex-col items-center">
          <p className="font-serif text-sm font-semibold tracking-wide text-[#493C38]">
            {t('home.coupleNames')}
          </p>
          <p className="text-[0.75rem] text-[#5E5048]">
            Bhilwara · 14–16 Feb 2027
          </p>
        </div>
        {overlay && <div className="mt-3 w-full max-w-sm">{overlay}</div>}
      </div>
    </section>
  );
}

const ROTATIONS = [
  '-rotate-3 hover:rotate-0',
  'rotate-0.5 hover:rotate-0',
  'rotate-3 hover:rotate-0',
  'rotate-2 hover:rotate-0',
  '-rotate-2.5 hover:rotate-0',
];

function PolaroidItem({ photo, index, rotation, className = '' }) {
  return (
    <li
      className={`relative flex flex-col rounded-sm bg-white p-2 sm:p-2.5 pb-4 sm:pb-6 shadow-md shadow-stone-900/10 border border-stone-200/60 transition-transform duration-200 hover:scale-105 hover:z-20 ${rotation} ${className}`}
    >
      {/* Washi tape at top center */}
      <span
        className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-7 sm:w-9 h-2.5 sm:h-3 bg-[#EADCC8]/85 border border-[#D9CBB0]/60 shadow-xs z-10 rounded-[1px] rotate-[-1deg]"
        aria-hidden="true"
      />
      {/* Photo frame */}
      <div className="aspect-square w-full overflow-hidden rounded-xs bg-[#FAF5EE] flex items-center justify-center">
        {photo ? (
          <img
            src={photo.url}
            alt={t('home.coupleN', { n: index + 1 })}
            width={photo.widthPx || 400}
            height={photo.heightPx || 400}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <ImagePlus
            aria-hidden="true"
            className="size-5 sm:size-6 text-[#861C32]/35 stroke-[1.6]"
          />
        )}
      </div>
    </li>
  );
}

export function CouplePhotos({ photos = [], admin = false }) {
  const count = Math.max(5, photos.length);
  const slots = Array.from({ length: count }, (_, i) => photos[i] ?? null);

  return (
    <section
      aria-label={t('home.couplePhotos')}
      className="relative flex flex-col gap-3 rounded-3xl bg-white/70 p-4 sm:p-5 shadow-xs border border-black/5 overflow-hidden"
    >
      {/* Decorative corner botanicals */}
      <img
        src="/art/welcome-floral-br-clean.webp"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -top-4 -right-4 w-24 sm:w-28 opacity-25 select-none rotate-180"
      />
      <img
        src="/art/welcome-floral-bl-clean.webp"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-4 -left-4 w-24 sm:w-28 opacity-25 select-none"
      />

      <h2 className="text-lg font-bold text-text tracking-tight relative z-10">
        {t('home.moments')}
      </h2>

      {/* 5 Polaroids: 3 on top row, 2 centered on bottom row */}
      <div className="relative z-10 flex flex-col gap-2.5 sm:gap-3 py-1">
        <ul className="grid grid-cols-3 gap-2.5 sm:gap-3.5 px-1 pt-1">
          {slots.slice(0, 3).map((p, i) => (
            <PolaroidItem key={p?.id ?? `empty-${i}`} photo={p} index={i} rotation={ROTATIONS[i % ROTATIONS.length]} />
          ))}
        </ul>
        <ul className="flex justify-center gap-2.5 sm:gap-3.5 -mt-1 sm:-mt-1.5 px-1">
          {slots.slice(3, 5).map((p, i) => (
            <PolaroidItem
              key={p?.id ?? `empty-${i + 3}`}
              photo={p}
              index={i + 3}
              rotation={ROTATIONS[(i + 3) % ROTATIONS.length]}
              className="w-[31%] max-w-[130px]"
            />
          ))}
        </ul>
      </div>

      {admin && (
        <Link
          to="/settings/home-photos"
          className="tap relative z-10 inline-flex items-center gap-1.5 self-start font-bold text-sm sm:text-base text-[#861C32] hover:underline mt-2"
        >
          {t('home.addPhotos')} →
        </Link>
      )}
    </section>
  );
}

export default function HomeHero({ admin, countdown = null, name = null, couple = true }) {
  const q = useHomePhotos();
  const g = q.data ?? { cover: [], couple: [], monogram: [] };
  return (
    <>
      <CoverCarousel covers={g.cover} monogram={g.monogram[0] ?? null} name={name}
        overlay={countdown ? <Countdown data={countdown} hero /> : null} />
      {couple && <CouplePhotos photos={g.couple} admin={admin && q.isSuccess && g.cover.length === 0} />}
    </>
  );
}
