// Install Guide (PWA.md §3.2–3.3): put the app on the Home Screen. Android: our Install
// button when Chrome is ready, otherwise the ⋮ menu steps; links opened inside WhatsApp
// first go to Chrome. iPhone: the 4 illustrated steps (Safari only). On a computer both
// are shown with a choice. Fix the app is here too.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Wrench } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import ChipFilter from '../../components/ChipFilter.jsx';
import { Notice } from '../../components/Field.jsx';
import { IosSteps } from '../../pwa/IosInstallGuide.jsx';
import { useAndroidInstall } from '../../pwa/useAndroidInstall.js';
import { isAndroid, isIOS, isAndroidWebView, isAndroidNonChrome, isStandalone } from '../../pwa/platform.js';
import OldPhoneNotice from '../../pwa/OldPhoneNotice.jsx';
import { t } from '../../i18n/strings.en.js';

function AndroidSteps({ webView = isAndroidWebView, nonChrome = isAndroidNonChrome }) {
  const { canPrompt, installed, prompt } = useAndroidInstall();
  const [done, setDone] = useState(false);
  if (webView) return <Notice kind="info">{t('install.openInChrome')}</Notice>;
  if (nonChrome) return <Notice kind="info">{t('install.useChrome')}</Notice>;
  if (done || installed) return <Notice kind="success">{t('install.done')}</Notice>;
  return (
    <div className="flex flex-col gap-4">
      {canPrompt && (
        <button type="button" className="tap inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 font-bold text-on-primary"
          onClick={async () => { if ((await prompt()) === 'accepted') setDone(true); }}>
          <Download aria-hidden="true" size={20} />{t('install.install')}
        </button>
      )}
      <p className={canPrompt ? 'text-text-muted' : 'text-lg'}>{t(canPrompt ? 'install.orByHand' : 'install.androidSteps')}</p>
      <img src="/install-guide/android-menu.svg" alt={t('install.androidAlt')} width="390" height="520" className="mx-auto h-auto max-h-[50dvh] w-auto rounded-md border border-border" />
      <p className="text-sm text-text-muted">{t('install.androidShared')}</p>
    </div>
  );
}

export default function InstallGuide() {
  const [which, setWhich] = useState(isIOS ? 'iphone' : 'android');
  const computer = !isIOS && !isAndroid;
  return (
    <Screen title={t('install.title')} back="/more">
      <OldPhoneNotice dismissible={false} />
      {isStandalone() ? (
        <Notice kind="success">{t('install.alreadyHome')}</Notice>
      ) : (
        <section className="flex flex-col gap-4 rounded-md bg-surface p-4 shadow-card">
          <p>{t('install.why')}</p>
          {computer && (
            <ChipFilter label={t('install.whichPhone')} value={which} onChange={setWhich}
              options={[{ value: 'android', label: t('install.android') }, { value: 'iphone', label: t('install.iphone') }]} />
          )}
          {(computer ? which === 'iphone' : isIOS) ? <IosSteps /> : <AndroidSteps />}
        </section>
      )}
      <section className="flex flex-col gap-2 rounded-md bg-surface p-4 shadow-card">
        <h2 className="text-lg font-bold">{t('install.stuckTitle')}</h2>
        <p className="text-text-muted">{t('install.stuckText')}</p>
        <a href="/reset.html" className="tap inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-border-strong bg-surface px-5 text-text">
          <Wrench aria-hidden="true" size={20} />{t('phone.fix')}
        </a>
        <Link to="/settings/phone" className="tap inline-flex items-center justify-center font-bold text-primary">{t('phone.title')}</Link>
      </section>
    </Screen>
  );
}
