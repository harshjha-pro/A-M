// Top of Home (1.0.16): the cover slideshow with the monogram in the top-right corner,
// then the couple photos. Until photos are added, soft placeholders hold their place
// (Ayush and Mahi see a link to Settings › Home photos).
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ImagePlus } from 'lucide-react';
import { useHomePhotos } from '../../data/homePhotos.js';
import { t } from '../../i18n/strings.en.js';

const SLIDE_MS = 5000;

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function CoverCarousel({ covers = [], monogram = null }) {
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
    <section className="relative overflow-hidden rounded-2xl shadow-card ring-1 ring-border/70" aria-roledescription="carousel" aria-label={t('home.coverPhotos')}>
      {n === 0 ? (
        <div className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-primary-soft to-surface-2 px-6 text-center sm:aspect-[16/10]" data-testid="cover-placeholder">
          <span className="font-serif text-4xl text-primary">{t('home.coupleNames')}</span>
          <span className="text-text-muted">{t('home.subtitle')}</span>
        </div>
      ) : (
        <div ref={track} onScroll={onScroll} className="no-scrollbar flex aspect-[4/5] w-full snap-x snap-mandatory overflow-x-auto sm:aspect-[16/10]" tabIndex={0} aria-live="off">
          {covers.map((p, i) => (
            <img key={p.id} src={p.url} alt={t('home.coverN', { n: i + 1, total: n })} width={p.widthPx || 1600} height={p.heightPx || 1200}
              loading={i === 0 ? 'eager' : 'lazy'} fetchpriority={i === 0 ? 'high' : undefined} decoding="async"
              className="h-full w-full shrink-0 snap-center object-cover" />
          ))}
        </div>
      )}
      <div className="pointer-events-none absolute right-3 top-3 grid h-12 w-12 place-items-center overflow-hidden rounded-full border border-white/70 bg-surface/85 shadow-card backdrop-blur-md sm:right-4 sm:top-4 sm:h-14 sm:w-14" data-testid="monogram">
        {monogram
          ? <img src={monogram.url} alt={t('home.monogram')} width={56} height={56} decoding="async" className="h-11 w-11 object-contain sm:h-12 sm:w-12" />
          : <span className="font-serif text-lg text-primary sm:text-xl" aria-label={t('home.monogram')}>A&amp;M</span>}
      </div>
      {n > 1 && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
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
      <ul className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
        {slots.map((p, i) => (
          <li key={p?.id ?? `empty-${i}`} className="aspect-square w-[5.25rem] shrink-0 snap-start overflow-hidden rounded-xl bg-surface-2 ring-1 ring-border/60 sm:w-24">
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

export default function HomeHero({ admin }) {
  const q = useHomePhotos();
  const g = q.data ?? { cover: [], couple: [], monogram: [] };
  return (
    <>
      <CoverCarousel covers={g.cover} monogram={g.monogram[0] ?? null} />
      <CouplePhotos photos={g.couple} admin={admin && q.isSuccess && g.cover.length === 0} />
    </>
  );
}
