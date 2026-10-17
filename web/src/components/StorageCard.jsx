// Storage health (1.0.24, admin-operations brief §11): how full the database is against the
// host's 3 GB, how much of it is Vault files, when it was checked and what to do next. Uses the
// server's own numbers and warning line (2.5 GB), never its own.
import { Database } from 'lucide-react';
import { formatBytes } from '../data/documents.js';
import { formatDateTime } from '../format/ist.js';
import { t } from '../i18n/strings.en.js';

export default function StorageCard({ storage, checkedAt }) {
  if (!storage) return null;
  const pct = Math.min(100, Math.round((storage.databaseBytes / storage.limitBytes) * 100));
  return (
    <section aria-labelledby="storage-h" className={`flex flex-col gap-2 rounded-md p-4 shadow-card ${storage.warn ? 'border-2 border-warning bg-surface' : 'bg-surface'}`}>
      <h2 id="storage-h" className="flex items-center gap-2 font-bold"><Database aria-hidden="true" size={20} />{t('storage.title')}</h2>
      <p>{t('vault.storage', { used: formatBytes(storage.databaseBytes) })}</p>
      <div role="meter" aria-label={t('storage.title')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={`${pct}%`}
        className="h-3 overflow-hidden rounded-full bg-surface-2">
        <div className={`h-full rounded-full ${storage.warn ? 'bg-warning' : 'bg-primary'}`} style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
      <p className="text-sm text-text-muted">{t('storage.files', { size: formatBytes(storage.vaultBytes) })}{checkedAt ? ` · ${t('storage.checked', { when: formatDateTime(checkedAt) })}` : ''}</p>
      <p className={storage.warn ? 'font-bold text-warning' : 'text-sm text-text-muted'} role={storage.warn ? 'alert' : undefined}>
        {storage.warn ? t('vault.storageWarn', { used: formatBytes(storage.databaseBytes) }) : t('storage.ok')}
      </p>
    </section>
  );
}
