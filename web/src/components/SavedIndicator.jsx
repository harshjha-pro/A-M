// 🕒 Saving… → ✓ Saved 10:42 → ⚠ Couldn't save (DESIGN §7). Announced politely.
import { Clock, Check, TriangleAlert } from 'lucide-react';
import { OfflineError, ServerError } from '../api/errors.js';
import { t } from '../i18n/strings.en.js';

export default function SavedIndicator({ status, savedAt, error }) {
  let content = null;
  if (status === 'saving') {
    content = <span className="inline-flex items-center gap-1 text-text-muted"><Clock aria-hidden="true" size={18} />{t('saving')}</span>;
  } else if (status === 'saved') {
    content = <span className="inline-flex items-center gap-1 text-success"><Check aria-hidden="true" size={18} />{t('saved', { time: savedAt })}</span>;
  } else if (status === 'error' && (error instanceof OfflineError || error instanceof ServerError)) {
    content = (
      <span className="inline-flex items-center gap-1 text-danger">
        <TriangleAlert aria-hidden="true" size={18} />
        {error instanceof OfflineError ? t('errors.offline') : t('errors.server')}
      </span>
    );
  }
  return <p role="status" aria-live="polite" className="min-h-6 text-sm">{content}</p>;
}
