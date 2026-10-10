// Vendor page (FEATURES B6): call, WhatsApp vendor message (A7), and for money users
// agreed · paid · due with "₹x not yet scheduled" (AC-MON-10) and the payments.
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { History, Pencil, Phone, Trash2 } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import Button from '../../components/Button.jsx';
import WhatsAppButton from '../../components/WhatsAppButton.jsx';
import { Notice } from '../../components/Field.jsx';
import { api, newIdemKey } from '../../api/client.js';
import { withRelogin } from '../../api/auth.js';
import { useSession } from '../../api/session.js';
import { showUndo, showToast } from '../../undo/undoStore.js';
import { formatPhone } from '../../format/phone.js';
import { formatInr } from '../../format/inr.js';
import { PaymentRow } from './PaymentList.jsx';
import DocumentsSection from '../documents/DocumentsSection.jsx';
import { t } from '../../i18n/strings.en.js';

export default function VendorDetail() {
  const { id } = useParams();
  const { user, permissions } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['vendor', id], queryFn: () => api('GET', `/vendors/${id}`).then((r) => r.data) });
  const pays = useQuery({ queryKey: ['payments', 'vendor', id], queryFn: () => api('GET', '/payments', { query: { vendor: id } }).then((r) => r.data), enabled: Boolean(permissions?.money) });
  const v = q.data;
  if (q.isPending) return <Screen title={t('money.vendorTitle')} back="/vendors"><p aria-busy="true">…</p></Screen>;
  if (q.isError) return <Screen title={t('money.vendorTitle')} back="/vendors"><Notice kind="danger">{q.error.message || t('errors.loadFailed')}</Notice></Screen>;

  async function remove() {
    try {
      const res = await withRelogin(() => api('DELETE', `/vendors/${id}`, { ifMatch: v.version, idemKey: newIdemKey() }));
      qc.invalidateQueries({ queryKey: ['vendors'] });
      if (res.meta.undo) showUndo({ batchId: res.meta.undo.batchId, summary: res.meta.undo.summary });
      navigate('/vendors', { replace: true });
    } catch (e) { showToast(e.message || t('errors.server')); }
  }

  const b = v.balance;
  return (
    <Screen title={v.name} back="/vendors">
      <section className="flex flex-col gap-3 rounded-md bg-surface p-4 shadow-card">
        <p className="flex flex-wrap gap-2">
          <span className="rounded-full bg-primary-soft px-3 py-1 font-bold text-primary">{t(`money.vendorCategories.${v.category}`)}</span>
          {v.isBooked && <span className="rounded-full bg-success-soft px-3 py-1">{t('money.booked')}</span>}
        </p>
        {v.contactPerson && <p className="text-lg">{v.contactPerson}</p>}
        {[v.phone, v.altPhone].filter(Boolean).map((p) => (
          <a key={p} href={`tel:${p}`} className="tap inline-flex items-center gap-2 font-bold text-primary"><Phone aria-hidden="true" size={20} />{t('money.call', { phone: formatPhone(p) })}</a>
        ))}
        {v.notes && <p className="whitespace-pre-line break-words text-text-muted">{v.notes}</p>}
        {b && (
          <div className="flex flex-col gap-1 border-t border-border pt-3">
            {b.agreedPaise !== null && <p>{t('money.balance', { agreed: formatInr(b.agreedPaise), paid: formatInr(b.paidPaise), due: formatInr(b.duePaise) })}</p>}
            {b.agreedPaise !== null && b.notScheduledPaise > 0 && <p className="font-bold text-warning">{t('money.notScheduled', { amount: formatInr(b.notScheduledPaise) })}</p>}
            {b.agreedPaise !== null && b.notScheduledPaise < 0 && <p className="font-bold text-danger">{t('money.moreThanAgreed', { amount: formatInr(-b.notScheduledPaise) })}</p>}
          </div>
        )}
      </section>
      {v.phone && <WhatsAppButton phone={v.phone} label={t('money.message')} text={t('money.waVendor', { contact: v.contactPerson || v.name, sender: user?.name ?? '' })} />}
      {permissions?.money && pays.data?.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-bold">{t('money.vendorPayments')}</h2>
          <ul className="overflow-hidden rounded-md bg-surface shadow-card">{pays.data.map((p) => <PaymentRow key={p.id} p={p} />)}</ul>
        </section>
      )}
      <DocumentsSection link={{ vendor: id }} linkLabel={v.name} defaultType="contract" />
      <div className="flex flex-col gap-3">
        <Link to={`/history/vendors/${id}`} className="tap inline-flex items-center justify-center gap-2 font-bold text-primary"><History aria-hidden="true" size={20} />{t('money.history')}</Link>
        {permissions?.edit && <Button variant="secondary" onClick={() => navigate(`/vendors/${id}/edit`)}><Pencil aria-hidden="true" size={20} />{t('money.edit')}</Button>}
        {permissions?.admin && <Button variant="danger" onClick={remove}><Trash2 aria-hidden="true" size={20} />{t('money.deleteVendor')}</Button>}
      </div>
    </Screen>
  );
}
