// Our own install prompt on Android (PWA.md §3.2, owner's answer 8 Oct): in Chrome, not
// in the installed app, once Chrome can install. "Not now" hides it for 7 days.
// It sits at the bottom above the nav and the page makes room (--am-install-h): it arrives
// after the page has drawn, and at the top it would push everything down (layout shift).
import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { useAndroidInstall } from './useAndroidInstall.js';
import { isAndroid, isStandalone, local } from './platform.js';
import { t } from '../i18n/strings.en.js';

export const SNOOZE_KEY = 'am.installSnoozedAt';
const SNOOZE_MS = 7 * 24 * 3600 * 1000;

export default function AndroidInstallBanner({ android = isAndroid }) {
  const { canPrompt, installed, prompt } = useAndroidInstall();
  const [hidden, setHidden] = useState(() => {
    const at = Date.parse(local.get(SNOOZE_KEY) || '');
    return !Number.isNaN(at) && Date.now() - at < SNOOZE_MS;
  });
  const [done, setDone] = useState(false);
  const boxRef = useRef(null);
  const show = done || (android && !isStandalone() && !installed && !hidden && canPrompt);

  useEffect(() => {
    const root = document.documentElement;
    const el = boxRef.current;
    if (!show || !el) {
      root.style.removeProperty('--am-install-h');
      return undefined;
    }
    const setH = () => root.style.setProperty('--am-install-h', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    setH();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(setH) : null;
    ro?.observe(el);
    return () => { ro?.disconnect(); root.style.removeProperty('--am-install-h'); };
  }, [show, done]);

  if (!show) return null;
  const place = 'fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom)+var(--am-update-h,0px))] z-30 px-4 pb-2';
  if (done) {
    return <div ref={boxRef} className={place}><p role="status" className="mx-auto max-w-xl rounded-md bg-success-soft px-4 py-3 shadow-card">{t('install.done')}</p></div>;
  }
  return (
    <div ref={boxRef} className={place}>
    <section aria-label={t('install.bannerLabel')} className="mx-auto flex max-w-xl flex-col gap-2 rounded-md bg-primary-soft px-4 py-3 shadow-card">
      <p className="text-base font-bold">{t('install.bannerTitle')}</p>
      <p className="text-sm text-text-muted">{t('install.bannerText')}</p>
      <div className="flex gap-3">
        <button type="button" className="tap inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-primary font-bold text-on-primary"
          onClick={async () => { if ((await prompt()) === 'accepted') setDone(true); }}>
          <Download aria-hidden="true" size={20} />{t('install.install')}
        </button>
        <button type="button" className="tap flex-1 rounded-md border-[1.5px] border-border-strong bg-surface"
          onClick={() => { local.set(SNOOZE_KEY, new Date().toISOString()); setHidden(true); }}>
          {t('install.notNow')}
        </button>
      </div>
    </section>
    </div>
  );
}
