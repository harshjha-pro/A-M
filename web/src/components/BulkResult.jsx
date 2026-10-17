// After a bulk change (1.0.24): how many changed, and each record left as it was, with why
// (never hidden — brief §14 "partial failures are reported individually").
import Sheet from './Sheet.jsx';
import { formatCount } from '../format/inr.js';
import { t } from '../i18n/strings.en.js';

export default function BulkResult({ result, onClose }) {
  if (!result) return null;
  return (
    <Sheet title={t('bulk.resultTitle')} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="font-bold">{t('bulk.resultChanged', { n: formatCount(result.affected) })}</p>
        {result.skipped.length > 0 && (
          <>
            <p>{t('bulk.resultSkipped', { n: formatCount(result.skipped.length) })}</p>
            <ul className="flex flex-col divide-y divide-border rounded-md bg-surface shadow-card">
              {result.skipped.map((s) => (
                <li key={s.id} className="flex flex-col px-3 py-2">
                  <span className="font-bold">{s.name}</span>
                  <span className="text-sm text-text-muted">{t(`bulk.reasons.${s.reason}`)}{s.changedBy?.name ? ` · ${s.changedBy.name}` : ''}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Sheet>
  );
}
