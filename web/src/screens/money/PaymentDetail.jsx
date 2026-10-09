// One payment (FEATURES B6): amount, status (red Overdue / amber No date), paid to,
// category, event; Mark as paid, Pay part, Edit, Delete (Undo), History.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, History, Pencil, SplitSquareHorizontal, Trash2 } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import Button from '../../components/Button.jsx';
import { Notice } from '../../components/Field.jsx';
import { api, newIdemKey } from '../../api/client.js';
import { withRelogin } from '../../api/auth.js';
import { showUndo, showToast } from '../../undo/undoStore.js';
import { formatInr } from '../../format/inr.js';
import { paymentWhen, payee, useMoneyGuard } from '../../data/money.js';
import MarkPaidSheet from './MarkPaidSheet.jsx';
import { t } from '../../i18n/strings.en.js';

export default function PaymentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['payment', id], queryFn: () => api('GET', `/payments/${id}`).then((r) => r.data) });
  const [sheet, setSheet] = useState(null); // 'paid' | 'part'
  const lost = useMoneyGuard(q.error);
  const p = q.data;
  const refresh = () => {
    setSheet(null);
    ['payments', 'money-summary', 'dashboard', 'calendar'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    qc.invalidateQueries({ queryKey: ['payment', id] });
  };

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
      {p.status === 'due' && (
        <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
          <Button onClick={() => setSheet('paid')}><CircleCheck aria-hidden="true" size={20} />{t('money.markPaid')}</Button>
          <Button variant="secondary" onClick={() => setSheet('part')}><SplitSquareHorizontal aria-hidden="true" size={20} />{t('money.payPart')}</Button>
        </div>
      )}
      <div className="flex flex-col gap-3">
        <Link to={`/history/payments/${id}`} className="tap inline-flex items-center justify-center gap-2 font-bold text-primary"><History aria-hidden="true" size={20} />{t('money.history')}</Link>
        <Button variant="secondary" onClick={() => navigate(`/money/payments/${id}/edit`)}><Pencil aria-hidden="true" size={20} />{t('money.edit')}</Button>
        <Button variant="danger" onClick={remove}><Trash2 aria-hidden="true" size={20} />{t('money.delete')}</Button>
      </div>
      {sheet && <MarkPaidSheet payment={p} part={sheet === 'part'} onClose={() => setSheet(null)} onDone={refresh} />}
    </Screen>
  );
}
