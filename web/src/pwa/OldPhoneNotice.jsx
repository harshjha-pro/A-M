// "Please update…" for phones below what we support (PWA.md §0.1): iPhone below iOS 17,
// Chrome below 120. Shown after login (dismissible for 30 days) and always in This phone.
import { useState } from 'react';
import { oldPhoneMessage, local } from './platform.js';
import { t } from '../i18n/strings.en.js';

const KEY = 'am.oldPhoneDismissedAt';
const DAYS30 = 30 * 24 * 3600 * 1000;

export default function OldPhoneNotice({ agent, dismissible = true }) {
  const kind = oldPhoneMessage(agent);
  const [hidden, setHidden] = useState(() => {
    const at = Date.parse(local.get(KEY) || '');
    return dismissible && !Number.isNaN(at) && Date.now() - at < DAYS30;
  });
  if (!kind || hidden) return null;
  return (
    <div role="note" className="flex flex-col gap-2 bg-warning-soft px-4 py-3">
      <p className="font-bold">{t(kind === 'ios' ? 'install.oldIos' : 'install.oldChrome')}</p>
      {dismissible && (
        <button type="button" className="tap self-start font-bold text-primary" onClick={() => { local.set(KEY, new Date().toISOString()); setHidden(true); }}>
          {t('install.gotIt')}
        </button>
      )}
    </div>
  );
}
