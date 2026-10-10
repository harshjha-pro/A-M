// Add / edit a vendor (FEATURES B6). The agreed amount only appears for money users
// (the server refuses it from anyone else). Same phone as another vendor → asks first.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Screen from '../../components/Screen.jsx';
import { TextField, PhoneField, Toggle, FixSummary, Notice } from '../../components/Field.jsx';
import MoneyField, { readAmount } from '../../components/MoneyField.jsx';
import Button from '../../components/Button.jsx';
import SavedIndicator from '../../components/SavedIndicator.jsx';
import DraftBanner from '../../components/DraftBanner.jsx';
import ConflictScreen from '../../components/ConflictScreen.jsx';
import { api } from '../../api/client.js';
import { DuplicateError } from '../../api/errors.js';
import { useSession } from '../../api/session.js';
import { useEntityForm } from '../../forms/useEntityForm.js';
import { showToast } from '../../undo/undoStore.js';
import { normalizePhone, formatPhone } from '../../format/phone.js';
import { formatInr } from '../../format/inr.js';
import { VENDOR_CATEGORIES } from '../../data/money.js';
import { t } from '../../i18n/strings.en.js';

const BASE = ['name', 'category', 'contactPerson', 'phone', 'altPhone', 'isBooked', 'notes'];
const LABELS = { name: t('money.vendorName'), category: t('money.vendorCategory'), contactPerson: t('money.contact'), phone: t('money.phone'),
  altPhone: t('money.altPhone'), agreedAmount: t('money.agreed'), isBooked: t('money.booked'), notes: t('money.notes') };

export default function VendorForm() {
  const { id } = useParams();
  const { permissions } = useSession();
  const money = Boolean(permissions?.money);
  const fields = money ? [...BASE, 'agreedAmount'] : BASE;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['vendor', id], queryFn: () => api('GET', `/vendors/${id}`).then((r) => r.data), enabled: Boolean(id) });
  const [dup, setDup] = useState(null);
  const allowDup = useRef(false);
  const record = id ? q.data : { version: 0 };

  const f = useEntityForm({
    form: 'vendor',
    recordId: id ?? null,
    record,
    fields,
    neverAuto: ['agreedAmount'],
    fromServer: (v) => ({
      name: v.name ?? '', category: v.category ?? 'other', contactPerson: v.contactPerson ?? '', phone: v.phone ? formatPhone(v.phone) : '',
      altPhone: v.altPhone ? formatPhone(v.altPhone) : '', isBooked: Boolean(v.isBooked), notes: v.notes ?? '',
      ...(money ? { agreedAmount: v.agreedAmountPaise != null ? String(v.agreedAmountPaise / 100) : '' } : {}),
    }),
    toBody(keys, v) {
      const errors = {};
      const body = {};
      if (!v.name.trim()) errors.name = t('money.vendorNameRequired');
      for (const k of keys) {
        if (k === 'agreedAmount') {
          const a = readAmount(v.agreedAmount, { required: false, max: 1e14 });
          if (a.error) errors.agreedAmountPaise = a.error; else body.agreedAmountPaise = a.paise;
        } else if (k === 'phone' || k === 'altPhone') {
          const s = v[k].trim();
          if (!s) body[k] = null;
          else { const n = normalizePhone(s); if (!n.ok) errors[k] = n.error; else body[k] = n.e164; }
        } else body[k] = typeof v[k] === 'string' ? (v[k].trim() === '' ? null : v[k].trim()) : v[k];
      }
      if (Object.keys(errors).length) return { errors };
      if (!id) { body.name = v.name.trim(); body.category = v.category; }
      if (allowDup.current) body.allowDuplicate = true;
      return body;
    },
    send: (body, version, idemKey) => (id
      ? api('PATCH', `/vendors/${id}`, { body, ifMatch: version, idemKey })
      : api('POST', '/vendors', { body, idemKey })).then((r) => r.data),
    mapError: (err) => (err instanceof DuplicateError ? (setDup(err), {}) : null),
    onSaved(saved) {
      qc.invalidateQueries({ queryKey: ['vendors'] });
      if (!saved) return;
      qc.setQueryData(['vendor', saved.id], saved);
      if (!id) showToast(t('money.vendorAdded'));
      navigate(`/vendors/${saved.id}`, { replace: true });
    },
  });

  useEffect(() => {
    if (record && !f.editing && !f.conflict && f.save.status !== 'saved') f.start();
  });

  const title = id ? t('money.vendorEdit') : t('money.vendorAdd');
  const back = id ? `/vendors/${id}` : '/vendors';
  if (id && q.isError) return <Screen title={title} back="/vendors"><Notice kind="danger">{q.error.message || t('errors.loadFailed')}</Notice></Screen>;
  if (!f.editing) return <Screen title={title} back={back}><p aria-busy="true">…</p></Screen>;
  if (f.conflict) {
    const show = (field, x) => (field === 'agreedAmount' ? (readAmount(x).paise != null ? formatInr(readAmount(x).paise) : x) : field === 'category' ? t(`money.vendorCategories.${x}`) : typeof x === 'boolean' ? (x ? t('yes') : t('no')) : x);
    return <ConflictScreen conflict={f.conflict} labels={LABELS} longText={['notes']} format={show} saving={f.save.status === 'saving'} onSave={f.resolve} onKeepTheirs={f.keepTheirs} />;
  }
  const v = f.values;
  const errors = f.fieldErrors;
  return (
    <Screen title={title} back={back}>
      {f.draft && <DraftBanner time={f.draftTime} onUse={f.useDraft} onDiscard={f.discardDraft} />}
      <form onSubmit={(e) => { e.preventDefault(); allowDup.current = false; setDup(null); f.submit(e); }} className="flex flex-col gap-5" noValidate>
        <FixSummary fields={errors} />
        {dup && (
          <div role="alert" className="flex flex-col gap-3 rounded-md bg-warning-soft p-3">
            <p>{dup.message}</p>
            {dup.matches[0] && <Link to={`/vendors/${dup.matches[0].id}`} className="tap inline-flex items-center font-bold text-primary">{t('money.openIt')}</Link>}
            <Button onClick={() => { allowDup.current = true; setDup(null); f.submit(); }}>{t('money.saveAnyway')}</Button>
          </div>
        )}
        <TextField label={t('money.vendorName')} value={v.name} onChange={f.set('name')} error={errors.name} maxLength={120} />
        <label className="flex flex-col gap-1">
          <span className="font-bold">{t('money.vendorCategory')}</span>
          <select value={v.category} onChange={(e) => f.set('category')(e.target.value)} className="tap rounded-sm border-[1.5px] border-border-strong bg-surface px-3 text-base text-text">
            {VENDOR_CATEGORIES.map((c) => <option key={c} value={c}>{t(`money.vendorCategories.${c}`)}</option>)}
          </select>
        </label>
        <TextField label={t('money.contact')} value={v.contactPerson} onChange={f.set('contactPerson')} maxLength={80} />
        <PhoneField label={t('money.phone')} value={v.phone} onChange={f.set('phone')} error={errors.phone} />
        <PhoneField label={t('money.altPhone')} value={v.altPhone} onChange={f.set('altPhone')} error={errors.altPhone} />
        {money && <MoneyField label={t('money.agreed')} value={v.agreedAmount} onChange={f.set('agreedAmount')} error={errors.agreedAmountPaise} required={false} />}
        <Toggle label={t('money.booked')} checked={v.isBooked} onChange={f.set('isBooked')} />
        <label className="flex flex-col gap-1">
          <span className="font-bold">{t('money.notes')}</span>
          <textarea value={v.notes} onChange={(e) => f.set('notes')(e.target.value)} rows={3} maxLength={5000} className="w-full rounded-sm border-[1.5px] border-border-strong bg-surface p-3 text-base text-text" />
        </label>
        <SavedIndicator {...f.save} />
        <Button needsInternet type="submit" loading={f.save.status === 'saving'}>{t('money.saveVendor')}</Button>
        <Button variant="secondary" onClick={() => { f.cancel(); navigate(back); }}>{t('login.cancel')}</Button>
      </form>
    </Screen>
  );
}
