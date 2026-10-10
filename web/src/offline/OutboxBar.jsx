// "3 changes waiting to send. [Send now]" / "Sending 3 changes…" / "1 change needs your
// choice. [Open]" (PWA.md §5.4). Shown only while something is on the phone unsent.
// Plain words only: no "sync", "queue" or "server" (DESIGN §8).
import { Link } from 'react-router-dom';
import { Clock, TriangleAlert } from 'lucide-react';
import { useOutbox, flushOutbox } from './save.js';
import { useOnline } from './useOnline.js';
import { t } from '../i18n/strings.en.js';

export default function OutboxBar() {
  const { waiting, needsYou, sending } = useOutbox();
  const online = useOnline();
  if (needsYou > 0) {
    return (
      <div role="status" className="flex items-center justify-between gap-3 bg-danger-soft px-4 py-2">
        <span className="flex items-center gap-2 font-bold"><TriangleAlert aria-hidden="true" size={18} className="shrink-0" />{needsYou === 1 ? t('outbox.needsOne') : t('outbox.needs', { n: needsYou })}</span>
        <Link to="/settings/waiting" className="tap inline-flex shrink-0 items-center rounded-md bg-surface px-4 font-bold text-primary">{t('outbox.open')}</Link>
      </div>
    );
  }
  if (waiting === 0) return null;
  const text = sending
    ? (waiting === 1 ? t('outbox.sendingOne') : t('outbox.sending', { n: waiting }))
    : (waiting === 1 ? t('outbox.barOne') : t('outbox.bar', { n: waiting }));
  return (
    <div role="status" className="flex items-center justify-between gap-3 bg-warning-soft px-4 py-2">
      <Link to="/settings/waiting" className="flex min-w-0 items-center gap-2 font-bold"><Clock aria-hidden="true" size={18} className="shrink-0" />{text}</Link>
      {online
        ? <button type="button" disabled={sending} onClick={() => flushOutbox({ force: true })} className="tap shrink-0 rounded-md bg-surface px-4 font-bold text-primary disabled:opacity-60">{t('outbox.sendNow')}</button>
        : <span className="shrink-0 text-sm">{t('outbox.willSend')}</span>}
    </div>
  );
}
