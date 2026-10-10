// One-time illustrated "Add to Home Screen" guide for iPhone (PWA.md §3.3). Opens by
// itself once after the first login in Safari (never in the installed app); always at
// More › Install Guide. In Chrome or another app on iPhone: "Please open this in Safari".
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { isIOS, iosVersion, isIOSNonSafari, isStandalone, local, MIN_IOS } from './platform.js';
import { t } from '../i18n/strings.en.js';

export const SEEN_KEY = 'am.iosGuideSeen';

export const IOS_STEPS = [
  { img: '/install-guide/ios-1-share.svg', text: 'install.ios1', alt: 'install.ios1Alt' },
  { img: '/install-guide/ios-2-add.svg', text: 'install.ios2', alt: 'install.ios2Alt' },
  { img: '/install-guide/ios-3-confirm.svg', text: 'install.ios3', alt: 'install.ios3Alt' },
  { img: '/install-guide/ios-4-open.svg', text: 'install.ios4', alt: 'install.ios4Alt' },
];

/** Open by itself? Only in Safari on iPhone, not installed, once. */
export function shouldAutoOpenIosGuide(ios = isIOS) {
  return ios && !isStandalone() && !isIOSNonSafari && !local.get(SEEN_KEY);
}

/** The steps, usable inside a sheet or a page. */
export function IosSteps({ onDone, nonSafari = isIOSNonSafari, version = iosVersion }) {
  const [step, setStep] = useState(0);
  const textRef = useRef(null);
  useEffect(() => { if (step > 0) textRef.current?.focus(); }, [step]); // screen readers hear the new step

  if (isStandalone()) return <p>{t('install.alreadyHome')}</p>;
  if (nonSafari) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-lg font-bold">{t('install.openInSafari')}</p>
        <p>{t('install.openInSafariHow')}</p>
      </div>
    );
  }
  const s = IOS_STEPS[step];
  const last = step === IOS_STEPS.length - 1;
  return (
    <div className="flex flex-col gap-4">
      <p className="font-bold text-text-muted">{t('install.stepOf', { n: step + 1, of: IOS_STEPS.length })}</p>
      {step === 0 && <p className="rounded-md bg-info-soft p-3 text-sm">{t('install.fromWhatsapp')}</p>}
      {version !== null && version < MIN_IOS && <p role="alert" className="rounded-md bg-warning-soft p-3 text-sm">{t('install.updateIos')}</p>}
      <img src={s.img} alt={t(s.alt)} width="390" height="520" className="mx-auto h-auto max-h-[50dvh] w-auto rounded-md border border-border" />
      <p ref={textRef} tabIndex={-1} className="text-lg outline-none">{t(s.text)}</p>
      <div className="flex gap-3">
        {step > 0 && <button type="button" className="tap flex-1 rounded-md border-[1.5px] border-border-strong bg-surface" onClick={() => setStep(step - 1)}>{t('install.back')}</button>}
        <button type="button" className="tap flex-1 rounded-md bg-primary font-bold text-on-primary" onClick={() => (last ? onDone?.() : setStep(step + 1))}>
          {last ? t('install.doneButton') : t('install.next')}
        </button>
      </div>
      {last && <p className="text-sm text-text-muted">{t('install.iconOnly')}</p>}
    </div>
  );
}

/** Full-screen one-time version, opened by AppShell after the first login in Safari. */
export default function IosInstallGuide({ onClose }) {
  const headingRef = useRef(null);
  useEffect(() => {
    local.set(SEEN_KEY, new Date().toISOString());
    headingRef.current?.focus();
  }, []);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="ios-guide-title" className="fixed inset-0 z-50 overflow-y-auto bg-bg px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(0.5rem+env(safe-area-inset-top))]">
      <div className="mx-auto flex max-w-xl flex-col gap-3">
        <div className="flex items-center justify-between gap-2 py-2">
          <h2 id="ios-guide-title" ref={headingRef} tabIndex={-1} className="text-xl font-bold outline-none">{t('install.iosTitle')}</h2>
          <button type="button" className="tap inline-flex items-center gap-1 px-2 text-primary" onClick={onClose}><X aria-hidden="true" size={22} />{t('tasks.close')}</button>
        </div>
        <IosSteps onDone={onClose} />
      </div>
    </div>
  );
}
