// Top of Home (1.0.16; 1.0.23 redesign): the cover slideshow with the monogram in the
// top-right corner, the headline and the frosted countdown over it, then the couple photos. Until photos are added, soft placeholders hold their place
// (Ayush and Mahi see a link to Settings › Home photos).
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ImagePlus, Menu, Heart } from 'lucide-react';
import { useHomePhotos } from '../../data/homePhotos.js';
import Countdown from './Countdown.jsx';
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
    <section className="relative overflow-hidden rounded-b-[2rem] shadow-card sm:rounded-[2rem]" aria-roledescription="carousel" aria-label={t('home.coverPhotos')}>
      {n === 0 ? (
        <div className="flex aspect-[4/5] w-full flex-col items-center gap-1 bg-gradient-to-br from-primary-soft to-surface-2 px-4 pt-24 text-center sm:aspect-[16/10]" data-testid="cover-placeholder">
          <span className="font-display text-4xl text-primary">{t('home.coupleNames')}</span>
          <span className="text-text-muted">{t('home.subtitle')}</span>
        </div>
      ) : (
        <div ref={track} onScroll={onScroll} className="no-scrollbar flex aspect-[4/5] max-h-[78dvh] w-full snap-x snap-mandatory overflow-x-auto sm:aspect-[16/10]" tabIndex={0} aria-live="off">
          {covers.map((p, i) => (
            <img key={p.id} src={p.url} alt={t('home.coverN', { n: i + 1, total: n })} width={p.widthPx || 1600} height={p.heightPx || 1200}
              loading={i === 0 ? 'eager' : 'lazy'} fetchpriority={i === 0 ? 'high' : undefined} decoding="async"
              className="h-full w-full shrink-0 snap-center object-cover" />
          ))}
        </div>
      )}
      {n > 0 && <div className="scrim-tb pointer-events-none absolute inset-0" aria-hidden="true" />}
      <div className={`absolute inset-x-0 top-0 flex items-center gap-2 px-3 pt-[calc(0.5rem+env(safe-area-inset-top))] ${n > 0 ? 'text-white' : 'text-text'}`}>
        <Link to="/more" aria-label={t('home.menu')} className="glass tap grid size-12 place-items-center rounded-full text-text"><Menu aria-hidden="true" size={22} /></Link>
        <h1 aria-label={t('home.title')} className="pointer-events-none flex flex-1 flex-col items-center leading-none">
          <span className="inline-flex items-center gap-1 font-display text-[1.75rem] drop-shadow">A&amp;M<Heart aria-hidden="true" size={16} className="fill-current text-primary-soft" /></span>
          <span className="mt-0.5 text-[0.7rem] font-bold uppercase tracking-[0.18em] drop-shadow">{t('home.logoSub')}</span>
        </h1>
        <span className="size-12" aria-hidden="true" />
      </div>
      <div className="glass pointer-events-none absolute right-3 top-[calc(0.5rem+env(safe-area-inset-top))] grid size-12 place-items-center overflow-hidden rounded-full" data-testid="monogram">
        {monogram
          ? <img src={monogram.url} alt={t('home.monogram')} width={48} height={48} decoding="async" className="size-11 object-contain" />
          : <span className="font-display text-base text-primary" aria-label={t('home.monogram')}>A&amp;M</span>}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-3 p-4 pb-14">
        <div className={n > 0 ? 'text-white' : 'text-text'}>
          {name && <p className="mb-1 text-sm font-bold">{t('home.hello', { name })}</p>}
          <p className="whitespace-pre-line font-display text-[2.25rem] leading-[1.02] drop-shadow sm:text-5xl">{t('home.headline').replace(', ', ',\n')}</p>
          {n > 0 && <p className="mt-1 text-sm font-bold">{t('home.subtitle')}</p>}
        </div>
        {overlay}
      </div>
      {n > 1 && (
        <div className="absolute inset-x-0 top-20 flex justify-center gap-1">
          {covers.map((p, i) => (
            <button key={p.id} type="button" onClick={() => go(i)} aria-label={t('home.coverN', { n: i + 1, total: n })} aria-current={i === index || undefined}
              className="grid h-6 w-6 place-items-center">
              <span className={`block h-2 rounded-full transition-all ${i === index ? 'w-5 bg-on-primary' : 'w-2 bg-on-primary/60'}`} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export function CouplePhotos({ photos = [], admin = false }) {
  const slots = photos.length ? photos : [null, null, null];
  return (
    <section aria-label={t('home.couplePhotos')} className="flex flex-col gap-2">
      <ul className={`grid gap-2 ${slots.length === 4 ? 'grid-cols-4' : slots.length === 2 ? 'grid-cols-2' : slots.length === 1 ? 'grid-cols-1' : 'grid-cols-3'}`}>
        {slots.map((p, i) => (
          <li key={p?.id ?? `empty-${i}`} className="aspect-square overflow-hidden rounded-lg bg-surface-2 shadow-card">
            {p
              ? <img src={p.url} alt={t('home.coupleN', { n: i + 1 })} width={p.widthPx || 400} height={p.heightPx || 400} loading="lazy" decoding="async" className="h-full w-full object-cover" />
              : <span className="grid h-full w-full place-items-center text-text-muted" aria-hidden="true"><ImagePlus size={24} /></span>}
          </li>
        ))}
      </ul>
      {admin && photos.length === 0 && (
        <Link to="/settings/home-photos" className="tap inline-flex items-center gap-2 self-start font-bold text-primary">{t('home.addPhotos')} →</Link>
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
