// One document (FEATURES B7): the photo itself, or Open for a PDF (the phone's own
// viewer); Share; Download; type, links, who added it. Owner/Partner, or the Family
// member who uploaded it, edit details and delete (Undo). Files never change.
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, ExternalLink, History, Lock, Pencil, Share2, Trash2 } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import Button from '../../components/Button.jsx';
import { Notice } from '../../components/Field.jsx';
import { api, newIdemKey } from '../../api/client.js';
import { withRelogin } from '../../api/auth.js';
import { useSession } from '../../api/session.js';
import { showUndo, showToast } from '../../undo/undoStore.js';
import { canChange, formatBytes, isImageDoc } from '../../data/documents.js';
import { fileHref, shareFile } from '../../lib/shareFile.js';
import { formatDateTime } from '../../format/ist.js';
import { Thumb } from './DocumentRow.jsx';
import { t } from '../../i18n/strings.en.js';

const linkName = (r) => (r.deleted ? t('documents.deletedLink', { name: r.name }) : r.name);

export default function DocumentDetail() {
  const { id } = useParams();
  const { user, permissions } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['document', id], queryFn: () => api('GET', `/documents/${id}`).then((r) => r.data) });
  const d = q.data;
  if (q.isPending) return <Screen title={t('documents.title')} back="/documents"><p aria-busy="true">…</p></Screen>;
  if (q.isError) return <Screen title={t('documents.title')} back="/documents"><Notice kind="danger">{q.error.message || t('errors.loadFailed')}</Notice></Screen>;

  async function remove() {
    try {
      const res = await withRelogin(() => api('DELETE', `/documents/${id}`, { ifMatch: d.version, idemKey: newIdemKey() }));
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['payments'] });
      if (res.meta.undo) showUndo({ batchId: res.meta.undo.batchId, summary: res.meta.undo.summary });
      navigate('/documents', { replace: true });
    } catch (e) { showToast(e.message || t('errors.server')); }
  }

  async function share() {
    const how = await shareFile(d);
    if (how === 'opened') showToast(t('documents.openedToShare'));
  }

  const change = canChange(d, user, permissions);
  const row = (label, value) => (value ? <div><dt className="text-sm text-text-muted">{label}</dt><dd className="text-lg break-words">{value}</dd></div> : null);
  const isPdf = d.file?.mimeType === 'application/pdf';
  return (
    <Screen title={d.title} back="/documents">
      {isImageDoc(d) ? (
        <a href={fileHref(d)} target="_blank" rel="noopener" className="block overflow-hidden rounded-md bg-surface shadow-card">
          <img src={fileHref(d)} alt={d.title} width={d.file.widthPx || undefined} height={d.file.heightPx || undefined} className="h-auto max-h-[70dvh] w-full object-contain" />
        </a>
      ) : (
        <div className="flex items-center gap-3 rounded-md bg-surface p-4 shadow-card">
          <Thumb doc={d} />
          <span className="flex min-w-0 flex-col">
            <span className="break-all font-bold">{d.file?.originalName}</span>
            <span className="text-sm text-text-muted">{formatBytes(d.file?.sizeBytes ?? 0)}</span>
          </span>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
        {isPdf && <a href={fileHref(d)} target="_blank" rel="noopener" className="tap inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 font-bold text-on-primary"><ExternalLink aria-hidden="true" size={20} />{t('documents.open')}</a>}
        <Button variant={isPdf ? 'secondary' : 'primary'} onClick={share}><Share2 aria-hidden="true" size={20} />{t('documents.share')}</Button>
        <a href={fileHref(d, true)} download className="tap inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-border-strong bg-surface px-5 text-text"><Download aria-hidden="true" size={20} />{t('documents.download')}</a>
      </div>
      <section className="flex flex-col gap-3 rounded-md bg-surface p-4 shadow-card">
        <p className="flex flex-wrap gap-2">
          <span className="rounded-full bg-primary-soft px-3 py-1 font-bold text-primary">{t(`documents.types.${d.type}`)}</span>
          {d.isPrivate && <span className="inline-flex items-center gap-1 rounded-full bg-bg px-3 py-1"><Lock aria-hidden="true" size={16} />{t('documents.privateShort')}</span>}
        </p>
        <dl className="flex flex-col gap-2">
          {row(t('documents.payment'), d.payment && <Link to={`/money/payments/${d.payment.id}`} className="text-primary">{linkName(d.payment)}</Link>)}
          {row(t('documents.vendor'), d.vendor && <Link to={`/vendors/${d.vendor.id}`} className="text-primary">{linkName(d.vendor)}</Link>)}
          {row(t('documents.event'), d.event && <Link to={`/calendar/events/${d.event.id}`} className="text-primary">{linkName(d.event)}</Link>)}
          {row(t('documents.notes'), d.notes)}
          {row(t('documents.addedBy'), t('documents.addedLine', { name: d.createdBy?.name ?? '—', when: formatDateTime(d.createdAt) }))}
          {isImageDoc(d) && row(t('documents.size'), formatBytes(d.file?.sizeBytes ?? 0))}
        </dl>
      </section>
      <div className="flex flex-col gap-3">
        <Link to={`/history/documents/${id}`} className="tap inline-flex items-center justify-center gap-2 font-bold text-primary"><History aria-hidden="true" size={20} />{t('documents.history')}</Link>
        {change && <Button variant="secondary" onClick={() => navigate(`/documents/${id}/edit`)}><Pencil aria-hidden="true" size={20} />{t('documents.edit')}</Button>}
        {change && <Button variant="danger" onClick={remove}><Trash2 aria-hidden="true" size={20} />{t('documents.delete')}</Button>}
        {!change && permissions?.edit && <p className="text-center text-text-muted">{t('documents.onlyOwn')}</p>}
      </div>
    </Screen>
  );
}
