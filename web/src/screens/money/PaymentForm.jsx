// Add / edit a payment or expense (FEATURES B6). Amount in ₹ (exact paise), Paid to
// (a vendor, a new one typed in, or none = expense), "Paid already" → date + how.
// Same vendor + amount within 2 days → "Looks like a duplicate" [Open it] [Save anyway].
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Screen from '../../components/Screen.jsx';
import { TextField, ChoiceChips, Toggle, FixSummary, Notice } from '../../components/Field.jsx';
import MoneyField, { readAmount } from '../../components/MoneyField.jsx';
import Button from '../../components/Button.jsx';
import SavedIndicator from '../../components/SavedIndicator.jsx';
import DraftBanner from '../../components/DraftBanner.jsx';
import ConflictScreen from '../../components/ConflictScreen.jsx';
import { api } from '../../api/client.js';
import { DuplicateError } from '../../api/errors.js';
import { useEntityForm } from '../../forms/useEntityForm.js';
import { showToast } from '../../undo/undoStore.js';
import { todayIst, formatDateOnly } from '../../format/ist.js';
import { formatInr } from '../../format/inr.js';
import { METHODS, useCategories, useAllVendors, useMoneyGuard } from '../../data/money.js';
import { t } from '../../i18n/strings.en.js';

const FIELDS = ['title', 'amount', 'vendorId', 'newVendor', 'categoryId', 'eventId', 'paid', 'dueDate', 'paidOn', 'method', 'paidBy', 'reference', 'notes'];
const NEVER_AUTO = ['amount', 'paid', 'paidOn', 'method']; // amount and status clashes are always chosen (B6)
const LABELS = {
  title: t('money.titleLabel'), amount: t('money.amount'), vendorId: t('money.paidTo'), newVendor: t('money.newVendorName'), categoryId: t('money.category'),
  eventId: t('money.event'), paid: t('money.paidAlready'), dueDate: t('money.dueDate'), paidOn: t('money.paidOnLabel'), method: t('money.method'),
  paidBy: t('money.paidBy'), reference: t('money.reference'), notes: t('money.notes'),
};
const NEW = '__new__';

function toForm(p) {
  return {
    title: p.title ?? '', amount: p.amountPaise ? String(p.amountPaise / 100) : '', vendorId: p.vendor?.id ?? '', newVendor: '',
    categoryId: p.category?.id ?? '', eventId: p.event?.id ?? '', paid: p.status === 'paid', dueDate: p.dueDate ?? '',
    paidOn: p.paidOn ?? todayIst(), method: p.method ?? 'upi', paidBy: p.paidBy ?? '', reference: p.reference ?? '', notes: p.notes ?? '',
  };
}

export default function PaymentForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['payment', id], queryFn: () => api('GET', `/payments/${id}`).then((r) => r.data), enabled: Boolean(id) });
  const cats = useCategories();
  const vendors = useAllVendors();
  const events = useQuery({ queryKey: ['events'], queryFn: () => api('GET', '/events').then((r) => r.data), staleTime: 60_000 });
  const [dup, setDup] = useState(null);
  const allowDup = useRef(false);
  const lost = useMoneyGuard(q.error, cats.error);
  const record = id ? q.data : { version: 0, status: 'due' };

  const f = useEntityForm({
    form: 'payment',
    recordId: id ?? null,
    record,
    fields: FIELDS,
    neverAuto: NEVER_AUTO,
    fromServer: toForm,
    toBody(keys, v) {
      const errors = {};
      const body = {};
      const amt = readAmount(v.amount);
      if (!v.title.trim()) errors.title = t('money.titleRequired');
      if (amt.error) errors.amountPaise = amt.error;
      if (v.vendorId === NEW && !v.newVendor.trim()) errors.newVendor = t('money.vendorNameRequired');
      if (Object.keys(errors).length) return { errors };
      const all = !id;
      for (const k of keys) {
        if (k === 'amount') body.amountPaise = amt.paise;
        else if (k === 'vendorId' || k === 'newVendor') {
          if (v.vendorId === NEW) { body.newVendor = { name: v.newVendor.trim() }; } else body.vendorId = v.vendorId || null;
        } else if (k === 'categoryId') { if (v.categoryId) body.categoryId = v.categoryId; }
        else if (k === 'eventId') body.eventId = v.eventId || null;
        else if (['paid', 'paidOn', 'method', 'dueDate'].includes(k)) { /* below */ }
        else body[k] = typeof v[k] === 'string' ? (v[k].trim() === '' ? null : v[k].trim()) : v[k];
      }
      if (all || keys.some((k) => ['paid', 'paidOn', 'method', 'dueDate'].includes(k))) {
        body.status = v.paid ? 'paid' : 'due';
        if (v.paid) { body.paidOn = v.paidOn; body.method = v.method; } else body.dueDate = v.dueDate || null;
      }
      if (all) { body.title = v.title.trim(); body.amountPaise = amt.paise; }
      if (allowDup.current) body.allowDuplicate = true;
      return body;
    },
    send: (body, version, idemKey) => (id
      ? api('PATCH', `/payments/${id}`, { body, ifMatch: version, idemKey })
      : api('POST', '/payments', { body, idemKey })).then((r) => r.data),
    mapError: (err) => (err instanceof DuplicateError ? (setDup(err), {}) : null),
    onSaved(saved) {
      ['payments', 'money-summary', 'dashboard', 'vendors', 'calendar'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      if (!saved) return;
      qc.setQueryData(['payment', saved.id], saved);
      if (!id) showToast(t('money.added'));
      navigate(`/money/payments/${saved.id}`, { replace: true });
    },
  });

  useEffect(() => {
    if (record && !f.editing && !f.conflict && f.save.status !== 'saved') f.start();
  });

  const title = id ? t('money.editTitle') : t('money.addTitle');
  const back = id ? `/money/payments/${id}` : '/money/payments';
  if (lost) return <Screen title={title} back="/money"><Notice kind="danger">{t('money.noAccess')}</Notice></Screen>;
  if (id && q.isError) return <Screen title={title} back={back}><Notice kind="danger">{q.error.message || t('errors.loadFailed')}</Notice></Screen>;
  if (!f.editing) return <Screen title={title} back={back}><p aria-busy="true">…</p></Screen>;
  if (f.conflict) {
    const show = (field, v) => (field === 'amount' ? (readAmount(v).paise != null ? formatInr(readAmount(v).paise) : v) : field === 'paid' ? (v ? t('money.filters.paid') : t('money.filters.due'))
      : ['dueDate', 'paidOn'].includes(field) ? formatDateOnly(v) : field === 'method' ? t(`money.methods.${v}`) : v);
    return <ConflictScreen conflict={f.conflict} labels={LABELS} longText={['notes']} format={show} saving={f.save.status === 'saving'} onSave={f.resolve} onKeepTheirs={f.keepTheirs} />;
  }
  if (f.deleted) return <Screen title={title} back="/money/payments"><Notice kind="danger">{f.deleted.message}</Notice></Screen>;

  const v = f.values;
  const errors = f.fieldErrors;
  const select = 'tap rounded-sm border-[1.5px] border-border-strong bg-surface px-3 text-base text-text';
  return (
    <Screen title={title} back={back}>
      {f.draft && <DraftBanner time={f.draftTime} onUse={f.useDraft} onDiscard={f.discardDraft} />}
      <form onSubmit={(e) => { e.preventDefault(); allowDup.current = false; setDup(null); f.submit(e); }} className="flex flex-col gap-5" noValidate>
        <FixSummary fields={errors} />
        {dup && (
          <div role="alert" className="flex flex-col gap-3 rounded-md bg-warning-soft p-3">
            <p>{dup.message}</p>
            {dup.matches[0] && <Link to={`/money/payments/${dup.matches[0].id}`} className="tap inline-flex items-center font-bold text-primary">{t('money.openIt')}</Link>}
            <Button onClick={() => { allowDup.current = true; setDup(null); f.submit(); }}>{t('money.saveAnyway')}</Button>
          </div>
        )}
        <TextField label={t('money.titleLabel')} help={t('money.titleHelp')} value={v.title} onChange={f.set('title')} error={errors.title} maxLength={120} />
        <MoneyField label={t('money.amount')} value={v.amount} onChange={f.set('amount')} error={errors.amountPaise} />
        <label className="flex flex-col gap-1">
          <span className="font-bold">{t('money.paidTo')}</span>
          <select value={v.vendorId} onChange={(e) => f.set('vendorId')(e.target.value)} className={select}>
            <option value="">{t('money.noVendor')}</option>
            {(vendors.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            {!id && <option value={NEW}>{t('money.newVendor')}</option>}
          </select>
        </label>
        {v.vendorId === NEW && <TextField label={t('money.newVendorName')} value={v.newVendor} onChange={f.set('newVendor')} error={errors.newVendor} maxLength={120} />}
        <Toggle label={t('money.paidAlready')} checked={v.paid} onChange={f.set('paid')} />
        {v.paid ? (
          <>
            <TextField type="date" label={t('money.paidOnLabel')} value={v.paidOn} onChange={f.set('paidOn')} max={todayIst()} error={errors.paidOn} />
            <ChoiceChips label={t('money.method')} value={v.method} onChange={f.set('method')} options={METHODS.map((m) => ({ value: m, label: t(`money.methods.${m}`) }))} error={errors.method} />
            <TextField label={t('money.paidBy')} value={v.paidBy} onChange={f.set('paidBy')} maxLength={60} />
          </>
        ) : (
          <TextField type="date" label={t('money.dueDate')} value={v.dueDate} onChange={f.set('dueDate')} error={errors.dueDate} />
        )}
        <label className="flex flex-col gap-1">
          <span className="font-bold">{t('money.category')}</span>
          <select value={v.categoryId} onChange={(e) => f.set('categoryId')(e.target.value)} className={select} aria-describedby="cat-help">
            <option value="">{t('money.categoryAuto')}</option>
            {(cats.data ?? []).filter((c) => !c.deleted).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {errors.categoryId && <span id="cat-help" className="text-sm text-danger">{errors.categoryId}</span>}
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-bold">{t('money.event')}</span>
          <select value={v.eventId} onChange={(e) => f.set('eventId')(e.target.value)} className={select}>
            <option value="">{t('money.noEvent')}</option>
            {(events.data ?? []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
        <TextField label={t('money.reference')} help={t('money.referenceHelp')} value={v.reference} onChange={f.set('reference')} maxLength={60} />
        <label className="flex flex-col gap-1">
          <span className="font-bold">{t('money.notes')}</span>
          <textarea value={v.notes} onChange={(e) => f.set('notes')(e.target.value)} rows={3} maxLength={5000} className="w-full rounded-sm border-[1.5px] border-border-strong bg-surface p-3 text-base text-text" />
        </label>
        <SavedIndicator {...f.save} />
        <Button type="submit" loading={f.save.status === 'saving'}>{t('money.save')}</Button>
        <Button variant="secondary" onClick={() => { f.cancel(); navigate(back); }}>{t('login.cancel')}</Button>
      </form>
    </Screen>
  );
}
