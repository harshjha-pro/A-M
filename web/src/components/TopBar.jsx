// Top bar (DESIGN §4.4): 56 px + safe area. Non-root screens show "← Back",
// because the iPhone Home Screen app has no browser Back button.
import { ArrowLeft, Menu } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { t } from '../i18n/strings.en.js';

// back: true (go back, or Home if this was the first screen) or a path to fall back to.
export default function TopBar({ title, back = false, actions = null, main = false, variant = 'default' }) {
  const navigate = useNavigate();
  const location = useLocation();
  // "default" = the first screen opened in this app (e.g. a link from WhatsApp):
  // going back would leave the app, so go to the parent screen instead.
  const goBack = () => (location.key !== 'default' ? navigate(-1) : navigate(typeof back === 'string' ? back : '/'));

  if (variant === 'burgundy') {
    return (
      <header className="sticky top-0 z-20 bg-gradient-to-r from-[#861C32] via-[#751327] to-[#5b0e1d] text-white pt-safe shadow-sm relative overflow-hidden">
        {/* Subtle Decorative Floral Motif in Top Right matching reference image */}
        <div className="absolute right-0 top-0 bottom-0 w-36 pointer-events-none opacity-25 flex items-center justify-end pr-1 overflow-hidden" aria-hidden="true">
          <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="1.2" className="h-32 w-32 text-white">
            <path d="M60 25 C75 12, 100 18, 100 45 C100 70, 60 100, 60 100 C60 100, 20 70, 20 45 C20 18, 45 12, 60 25 Z" />
            <path d="M60 40 C70 30, 88 35, 88 52 C88 70, 60 88, 60 88 C60 88, 32 70, 32 52 C32 35, 50 30, 60 40 Z" />
            <path d="M60 100 Q85 75 105 88" />
            <path d="M60 100 Q35 75 15 88" />
            <circle cx="60" cy="55" r="8" />
          </svg>
        </div>

        <div className="mx-auto flex min-h-14 max-w-xl items-center justify-between gap-2 px-4 relative z-10">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {back && (
              <button
                type="button"
                onClick={goBack}
                aria-label={t('back')}
                className="tap -ml-1 inline-flex items-center justify-center size-9 rounded-full font-bold text-white hover:bg-white/15 active:scale-95 transition-colors"
              >
                <ArrowLeft aria-hidden="true" size={22} strokeWidth={2.4} />
                <span className="sr-only sm:inline text-sm font-semibold">{t('back')}</span>
              </button>
            )}
            <h1 className="min-w-0 flex-1 truncate font-serif text-xl sm:text-2xl font-bold text-white">
              {title}
            </h1>
          </div>
          {actions && <div className="flex items-center gap-1 shrink-0">{actions}</div>}
        </div>
      </header>
    );
  }

  if (main) {
    return (
      <header className="sticky top-0 z-20 border-b border-black/5 dark:border-white/10 bg-white/55 dark:bg-[#211A16]/65 pt-safe backdrop-blur-2xl">
        <div className="mx-auto flex min-h-14 max-w-xl items-center justify-between gap-2 px-4 py-1.5">
          <Link
            to="/more"
            aria-label={t('home.menu')}
            className="tap grid size-10 sm:size-11 place-items-center rounded-full bg-white/85 border border-white/60 shadow-xs text-[#861C32] transition hover:bg-white active:scale-95 dark:bg-[#2A1F1A]/85 dark:border-white/10 dark:text-[#F2A7AF]"
          >
            <Menu aria-hidden="true" size={20} strokeWidth={2.2} />
          </Link>
          <h1 aria-label={title || t('home.title')} className="pointer-events-none flex flex-1 flex-col items-center leading-none">
            <span className="sr-only">{title}</span>
            <img
              src="/art/loading-monogram.png"
              alt=""
              aria-hidden="true"
              className="h-9 sm:h-11 w-auto object-contain"
            />
            <span className="mt-0.5 text-[0.62rem] sm:text-[0.68rem] font-bold tracking-[0.22em] text-[#C7A16A] uppercase">
              {t('home.logoSub')}
            </span>
          </h1>
          <div className="flex items-center gap-2">
            {actions}
            <div
              className="pointer-events-none relative grid size-10 sm:size-11 place-items-center rounded-full bg-white/85 border border-white/60 shadow-xs dark:bg-[#2A1F1A]/85 dark:border-white/10"
              data-testid="monogram"
            >
              <span className="font-display text-base font-semibold text-[#861C32] dark:text-[#F2A7AF]" aria-label={t('home.monogram')}>
                A&amp;M
              </span>
              <span className="absolute top-1 right-1 size-2 rounded-full bg-[#861C32] ring-2 ring-[#FAF6F0]" aria-hidden="true" />
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-20 border-b border-black/5 dark:border-white/10 bg-white/55 dark:bg-[#211A16]/65 pt-safe backdrop-blur-2xl">
      <div className="mx-auto flex min-h-14 max-w-xl items-center justify-between gap-2 px-4">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {back && (
            <button
              type="button"
              onClick={goBack}
              aria-label={t('back')}
              className="tap -ml-1 inline-flex items-center justify-center size-9 rounded-full font-bold text-[#861C32] dark:text-[#F2A7AF] hover:bg-white/40 active:scale-95 transition-colors"
            >
              <ArrowLeft aria-hidden="true" size={22} strokeWidth={2.4} />
              <span className="sr-only sm:inline text-sm font-semibold">{t('back')}</span>
            </button>
          )}
          <h1 className="min-w-0 flex-1 truncate font-serif text-xl sm:text-2xl font-bold text-[#861C32] dark:text-[#F2A7AF]">
            {title}
          </h1>
        </div>
        {actions && <div className="flex items-center gap-1 shrink-0">{actions}</div>}
      </div>
    </header>
  );
}
