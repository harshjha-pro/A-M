// One payment (FEATURES B6): amount, status (red Overdue / amber No date), paid to,
// category, event; Mark as paid, Pay part, Edit, Delete (Undo), History; receipts
// (FEATURES B7 US-DOC-01). A receipt picked in Mark as paid uploads after the payment
// is saved; if it fails the payment stays Paid with "Receipt not uploaded — try again"
// and the photo stays in memory for the retry (AC-MON-09).
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, History, Pencil, RotateCw, SplitSquareHorizontal, Trash2 } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import Button from '../../components/Button.jsx';
import { Notice } from '../../components/Field.jsx';
import { api, newIdemKey } from '../../api/client.js';
import { withRelogin } from '../../api/auth.js';
import { showUndo, showToast } from '../../undo/undoStore.js';
import { formatInr } from '../../format/inr.js';
import { paymentWhen, payee, useMoneyGuard } from '../../data/money.js';
import { prepareFile, uploadDocument } from '../../data/documents.js';
import MarkPaidSheet from './MarkPaidSheet.jsx';
import DocumentsSection from '../documents/DocumentsSection.jsx';
import { failText } from '../documents/UploadSheet.jsx';
import { t } from '../../i18n/strings.en.js';

export default function PaymentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['payment', id], queryFn: () => api('GET', `/payments/${id}`).then((r) => r.data) });
  const [sheet, setSheet] = useState(null); // 'paid' | 'part'
  const [receipt, setReceipt] = useState(null); // { file, prepared, state: 'uploading'|'failed', progress, error }
  const lost = useMoneyGuard(q.error);
  const p = q.data;
  const refresh = (_saved, receiptFile) => {
    setSheet(null);
    ['payments', 'money-summary', 'dashboard', 'calendar'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    qc.invalidateQueries({ queryKey: ['payment', id] });
    if (receiptFile) sendReceipt({ file: receiptFile, prepared: null });
  };

  async function sendReceipt(r) {
    let prepared = r.prepared;
    setReceipt({ ...r, state: 'uploading', progress: 0, error: null });
    try {
      if (!prepared) prepared = await prepareFile(r.file);
      await uploadDocument(prepared, { type: 'receipt', paymentId: id }, (f) => setReceipt((cur) => cur && { ...cur, progress: f }));
      setReceipt(null);
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['payments'] });
      showToast(t('money.receiptSaved'));
    } catch (e) {
      setReceipt({ file: r.file, prepared, state: 'failed', progress: 0, error: failText(e) });
    }
  }

  if (lost) return <Screen title={t('money.payments')} back="/money/payments"><Notice kind="danger">{t('money.noAccess')}</Notice></Screen>;
  if (q.isPending) return <Screen title={t('money.payments')} back="/money/payments"><p aria-busy="true">…</p></Screen>;
  if (q.isError) return <Screen title={t('money.payments')} back="/money/payments"><Notice kind="danger">{q.error.message || t('errors.loadFailed')}</Notice></Screen>;

  async function remove() {
    try {
      const res = await withRelogin(() => api('DELETE', `/payments/${id}`, { ifMatch: p.version, idemKey: newIdemKey() }));
      ['payments', 'money-summary', 'dashboard'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      if (res.meta.undo) showUndo({ batchId: res.meta.undo.batchId, summary: res.meta.undo.summary });
      navigate('/money/payments', { replace: true });
    } catch (e) { showToast(e.message || t('errors.server')); }
  }

  const row = (label, value) => value ? <div><dt className="text-sm text-text-muted">{label}</dt><dd className="text-lg break-words">{value}</dd></div> : null;
  return (
    <Screen title={p.title} back="/money/payments">
      <section className="flex flex-col gap-3 rounded-md bg-surface p-4 shadow-card">
        <p className="text-3xl font-bold">{formatInr(p.amountPaise)}</p>
        <p className="flex flex-wrap gap-2">
          <span className={`rounded-full px-3 py-1 font-bold ${p.status === 'paid' ? 'bg-success-soft' : p.overdue ? 'bg-danger-soft text-danger' : 'bg-warning-soft'}`}>
            {p.status === 'paid' ? t('money.filters.paid') : p.overdue ? t('money.overdue') : t('money.filters.due')}
          </span>
          <span className="rounded-full bg-bg px-3 py-1">{paymentWhen(p)}</span>
        </p>
        <dl className="flex flex-col gap-2">
          {row(t('money.paidTo'), p.vendor ? <Link to={`/vendors/${p.vendor.id}`} className="text-primary">{payee(p)}</Link> : payee(p))}
          {row(t('money.category'), p.category && (p.category.deleted ? t('money.deletedCategory', { name: p.category.name }) : p.category.name))}
          {row(t('money.event'), p.event?.name)}
          {p.status === 'paid' && row(t('money.method'), p.method && t(`money.methods.${p.method}`))}
          {row(t('money.paidBy'), p.paidBy)}
          {row(t('money.reference'), p.reference)}
          {row(t('money.notes'), p.notes)}
          {p.splitFrom && row(t('money.partOf', { title: p.splitFrom.name }), <Link to={`/money/payments/${p.splitFrom.id}`} className="text-primary">{p.splitFrom.name}</Link>)}
        </dl>
      </section>
      {receipt?.state === 'uploading' && (
        <div className="flex flex-col gap-1">
          <span>{t('money.receiptUploading')}</span>
          <progress className="h-2 w-full accent-[var(--c-primary)]" max={1} value={receipt.progress} aria-label={t('money.receiptUploading')} />
        </div>
      )}
      {receipt?.state === 'failed' && (
        <p role="alert" className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => sendReceipt(receipt)} className="tap inline-flex items-center gap-2 rounded-full bg-danger-soft px-4 font-bold text-danger">
            <RotateCw aria-hidden="true" size={18} />{t('money.receiptFailed')}
          </button>
          {receipt.error && <span className="text-sm text-text-muted">{receipt.error}</span>}
        </p>
      )}
      {p.status === 'due' && (
        <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
          <Button onClick={() => setSheet('paid')}><CircleCheck aria-hidden="true" size={20} />{t('money.markPaid')}</Button>
          <Button variant="secondary" onClick={() => setSheet('part')}><SplitSquareHorizontal aria-hidden="true" size={20} />{t('money.payPart')}</Button>
        </div>
      )}
      <DocumentsSection link={{ payment: id }} linkLabel={p.title} defaultType="receipt" title={t('money.receiptsTitle')} addLabel={t('money.addReceipt')} />
      <div className="flex flex-col gap-3">
        <Link to={`/history/payments/${id}`} className="tap inline-flex items-center justify-center gap-2 font-bold text-primary"><History aria-hidden="true" size={20} />{t('money.history')}</Link>
        <Button variant="secondary" onClick={() => navigate(`/money/payments/${id}/edit`)}><Pencil aria-hidden="true" size={20} />{t('money.edit')}</Button>
        <Button variant="danger" onClick={remove}><Trash2 aria-hidden="true" size={20} />{t('money.delete')}</Button>
      </div>
      {sheet && <MarkPaidSheet payment={p} part={sheet === 'part'} onClose={() => setSheet(null)} onDone={refresh} />}
    </Screen>
  );
}
