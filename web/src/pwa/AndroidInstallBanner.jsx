// Our own install prompt on Android (PWA.md §3.2, owner's answer 8 Oct): in Chrome, not
// in the installed app, once Chrome can install. "Not now" hides it for 7 days.
import { useState } from 'react';
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

  if (done) return <p role="status" className="bg-success-soft px-4 py-3">{t('install.done')}</p>;
  if (!android || isStandalone() || installed || hidden || !canPrompt) return null;
  return (
    <section aria-label={t('install.bannerLabel')} className="flex flex-col gap-2 bg-primary-soft px-4 py-3">
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
  );
}
