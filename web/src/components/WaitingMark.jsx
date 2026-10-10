// 🕒 Waiting to send (PWA.md §5.4): this record has a change kept on the phone that
// hasn't reached the server yet. Gone as soon as it lands.
import { Clock } from 'lucide-react';
import { useWaiting } from '../offline/save.js';
import { t } from '../i18n/strings.en.js';

export default function WaitingMark({ entity, className = '' }) {
  if (!useWaiting(entity)) return null;
  return (
    <span className={`inline-flex items-center gap-1 font-bold text-warning ${className}`}>
      <Clock aria-hidden="true" size={14} />{t('outbox.waitingMark')}
    </span>
  );
}
