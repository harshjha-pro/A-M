// Export everything (FEATURES B8, API.md §9.1): one tap → a consistent snapshot on the
// server → Download (part 1 of n when files pass 200 MB). Links work 24 hours. Every
// export is a ZIP with CSVs for Excel, all photos and PDFs, json for a full restore and
// summary.html to print. Owner and Partner only. Needs internet.
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileDown, Printer, RotateCw } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import Button from '../../components/Button.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import { Notice } from '../../components/Field.jsx';
import { api, newIdemKey } from '../../api/client.js';
import { withRelogin } from '../../api/auth.js';
import { useSession } from '../../api/session.js';
import { isIOS } from '../../pwa/platform.js';
import { formatDateTime } from '../../format/ist.js';
import { formatBytes } from '../../data/documents.js';
import { useOnline } from '../documents/UploadSheet.jsx';
import { t } from '../../i18n/strings.en.js';

/** ".../download?part=1&t=abc" → ".../summary?t=abc" (same access: the session or the token). */
export function summaryHref(downloadUrl) {
  if (!downloadUrl) return null;
  const u = new URL(downloadUrl, 'https://app.invalid');
  u.pathname = u.pathname.replace(/\/download$/, '/summary');
  u.searchParams.delete('part');
  return u.pathname + u.search;
}

function DownloadLinks({ exp }) {
  const urls = exp.downloadUrls ?? [];
  const summary = summaryHref(urls[0]);
  return (
    <div className="flex flex-col gap-3">
      {urls.map((url, i) => (
        <a key={url} href={url} download className="tap inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 font-bold text-on-primary">
          <Download aria-hidden="true" size={20} />
          {urls.length > 1 ? t('exports.downloadPart', { n: i + 1, of: urls.length }) : t('exports.download')}
        </a>
      ))}
      {summary && (
        <a href={summary} target="_blank" rel="noopener" className="tap inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-border-strong bg-surface px-5 text-text">
          <Printer aria-hidden="true" size={20} />{t('exports.printSummary')}
        </a>
      )}
    </div>
  );
}

export default function Export() {
  const { permissions } = useSession();
  const qc = useQueryClient();
  const online = useOnline();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState(null); // the new export, with its token links
  const [error, setError] = useState(null);
  const [key, setKey] = useState(newIdemKey); // the same key for Try again: never two exports for one tap
  const list = useQuery({
    queryKey: ['exports'],
    queryFn: () => api('GET', '/exports'),
    enabled: Boolean(permissions?.admin),
  });

  if (!permissions?.admin) {
    return <Screen title={t('exports.title')} back="/settings"><Notice kind="info">{t('exports.adminsOnly')}</Notice></Screen>;
  }

  async function run() {
    setAsking(false);
    setBusy(true);
    setError(null);
    setMade(null);
    try {
      const res = await withRelogin(() => api('POST', '/exports', { body: { kind: 'full' }, idemKey: key, timeoutMs: 120000 }));
      setMade(res.data);
      setKey(newIdemKey());
      qc.invalidateQueries({ queryKey: ['exports'] });
    } catch (e) {
      setError(e.message || t('exports.failed'));
      if (e.status && e.status < 500) setKey(newIdemKey()); // refused (429, 403): a later tap is a new try
    } finally {
      setBusy(false);
    }
  }

  const last = list.data?.meta?.lastSuccess;
  const rows = (list.data?.data ?? []).filter((x) => x.id !== made?.id);
  return (
    <Screen title={t('exports.title')} back="/settings">
      <section className="flex flex-col gap-3 rounded-md bg-surface p-4 shadow-card">
        <p>{t('exports.intro')}</p>
        <p className="text-text-muted">{last ? t('exports.lastSuccess', { when: formatDateTime(last.createdAt) }) : t('exports.never')}</p>
        {!online && <Notice kind="warning">{t('exports.offline')}</Notice>}
        {busy
          ? <p role="status" aria-live="polite" aria-busy="true" className="font-bold">{t('exports.preparing')}</p>
          : <Button onClick={() => setAsking(true)} disabled={!online}><FileDown aria-hidden="true" size={20} />{t('exports.exportAll')}</Button>}
        {error && (
          <div role="alert" className="flex flex-col gap-2 rounded-md bg-danger-soft p-3">
            <p className="font-bold text-danger">{error}</p>
            <Button variant="secondary" onClick={run} disabled={!online}><RotateCw aria-hidden="true" size={20} />{t('exports.tryAgain')}</Button>
          </div>
        )}
      </section>

      {made && (
        <section className="flex flex-col gap-3 rounded-md bg-success-soft p-4" aria-labelledby="export-ready">
          <h2 id="export-ready" className="text-lg font-bold">{t('exports.ready')}</h2>
          <p>{t('exports.readyLine', { size: formatBytes(made.sizeBytes ?? 0), until: formatDateTime(made.expiresAt) })}</p>
          <DownloadLinks exp={made} />
          <p className="text-sm text-text-muted">{isIOS ? t('exports.iphoneTip') : t('exports.androidTip')}</p>
          <p className="text-sm text-text-muted">{t('exports.driveTip')}</p>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">{t('exports.recent')}</h2>
        {list.isError && <Notice kind="danger">{list.error.message || t('errors.loadFailed')}</Notice>}
        {list.isSuccess && rows.length === 0 && <p className="text-text-muted">{t('exports.none')}</p>}
        {rows.length > 0 && (
          <ul className="overflow-hidden rounded-md bg-surface shadow-card">
            {rows.map((x) => (
              <li key={x.id} className="flex flex-col gap-2 border-b border-border px-4 py-3 last:border-b-0">
                <span className="font-bold">{formatDateTime(x.createdAt)}</span>
                <span className="text-sm text-text-muted">
                  {x.requestedBy?.name ?? ''}
                  {x.sizeBytes ? ` · ${formatBytes(x.sizeBytes)}` : ''}
                  {' · '}
                  {x.status === 'ready' ? t('exports.until', { when: formatDateTime(x.expiresAt) }) : t(`exports.status.${x.status}`)}
                </span>
                {x.status === 'ready' && <DownloadLinks exp={x} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      {asking && (
        <ConfirmDialog title={t('exports.confirmTitle')} body={t('exports.confirmBody')} confirmLabel={t('exports.confirm')}
          cancelLabel={t('login.cancel')} onConfirm={run} onCancel={() => setAsking(false)} />
      )}
    </Screen>
  );
}
