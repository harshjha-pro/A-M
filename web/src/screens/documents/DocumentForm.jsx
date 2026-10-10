// Edit a document's details (FEATURES B7): title, type, vendor, event, notes; private
// for Owner/Partner only. The file itself never changes. Same edit rules as every
// form (A3/A4): only changed fields, If-Match, drafts, conflict screen.
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Screen from '../../components/Screen.jsx';
import { TextField, ChoiceChips, Toggle, FixSummary, Notice } from '../../components/Field.jsx';
import Button from '../../components/Button.jsx';
import SavedIndicator from '../../components/SavedIndicator.jsx';
import DraftBanner from '../../components/DraftBanner.jsx';
import ConflictScreen from '../../components/ConflictScreen.jsx';
import { api } from '../../api/client.js';
import { useSession } from '../../api/session.js';
import { useEntityForm } from '../../forms/useEntityForm.js';
import { useAllVendors } from '../../data/money.js';
import { DOC_TYPES } from '../../data/documents.js';
import { t } from '../../i18n/strings.en.js';

const BASE = ['title', 'type', 'vendorId', 'eventId', 'notes'];
const LABELS = { title: t('documents.titleLabel'), type: t('documents.type'), vendorId: t('documents.vendor'), eventId: t('documents.event'), notes: t('documents.notes'), isPrivate: t('documents.private') };

export default function DocumentForm() {
  const { id } = useParams();
  const { permissions } = useSession();
  const fields = permissions?.admin ? [...BASE, 'isPrivate'] : BASE;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['document', id], queryFn: () => api('GET', `/documents/${id}`).then((r) => r.data) });
  const vendors = useAllVendors();
  const events = useQuery({ queryKey: ['events'], queryFn: () => api('GET', '/events').then((r) => r.data), staleTime: 60_000 });
  const back = `/documents/${id}`;

  const f = useEntityForm({
    form: 'document',
    recordId: id,
    record: q.data,
    fields,
    fromServer: (d) => ({
      title: d.title ?? '', type: d.type ?? 'other', vendorId: d.vendor?.id ?? '', eventId: d.event?.id ?? '', notes: d.notes ?? '',
      ...(permissions?.admin ? { isPrivate: Boolean(d.isPrivate) } : {}),
    }),
    toBody(keys, v) {
      if (!v.title.trim()) return { errors: { title: t('documents.titleRequired') } };
      const body = {};
      for (const k of keys) body[k] = typeof v[k] === 'string' ? (v[k].trim() === '' ? null : v[k].trim()) : v[k];
      return body;
    },
    send: (body, version, idemKey) => api('PATCH', `/documents/${id}`, { body, ifMatch: version, idemKey }).then((r) => r.data),
    onSaved(saved) {
      qc.invalidateQueries({ queryKey: ['documents'] });
      if (saved) qc.setQueryData(['document', id], saved);
      navigate(back, { replace: true });
    },
  });

  useEffect(() => {
    if (q.data && !f.editing && !f.conflict && f.save.status !== 'saved') f.start();
  });

  const title = t('documents.edit');
  if (q.isError) return <Screen title={title} back="/documents"><Notice kind="danger">{q.error.message || t('errors.loadFailed')}</Notice></Screen>;
  if (!f.editing) return <Screen title={title} back={back}><p aria-busy="true">…</p></Screen>;
  const vendorName = (x) => vendors.data?.find((o) => o.id === x)?.name ?? x;
  const eventName = (x) => events.data?.find((o) => o.id === x)?.name ?? x;
  if (f.conflict) {
    const show = (field, x) => (field === 'type' ? t(`documents.types.${x}`) : field === 'vendorId' ? vendorName(x) : field === 'eventId' ? eventName(x) : typeof x === 'boolean' ? (x ? t('yes') : t('no')) : x);
    return <ConflictScreen conflict={f.conflict} labels={LABELS} longText={['notes']} format={show} saving={f.save.status === 'saving'} onSave={f.resolve} onKeepTheirs={f.keepTheirs} />;
  }
  const v = f.values;
  const errors = f.fieldErrors;
  const select = (label, key, options) => (
    <label className="flex flex-col gap-1">
      <span className="font-bold">{label}</span>
      <select value={v[key]} onChange={(e) => f.set(key)(e.target.value)} className="tap rounded-sm border-[1.5px] border-border-strong bg-surface px-3 text-base text-text">
        <option value="">{t('documents.none')}</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      {errors[key] && <span className="text-sm text-danger">{errors[key]}</span>}
    </label>
  );
  return (
    <Screen title={title} back={back}>
      {f.draft && <DraftBanner time={f.draftTime} onUse={f.useDraft} onDiscard={f.discardDraft} />}
      <form onSubmit={f.submit} className="flex flex-col gap-5" noValidate>
        <FixSummary fields={errors} />
        <TextField label={t('documents.titleLabel')} value={v.title} onChange={f.set('title')} error={errors.title} maxLength={120} />
        <ChoiceChips label={t('documents.type')} value={v.type} onChange={f.set('type')} options={DOC_TYPES.map((d) => ({ value: d, label: t(`documents.types.${d}`) }))} error={errors.type} />
        {select(t('documents.vendor'), 'vendorId', vendors.data ?? [])}
        {select(t('documents.event'), 'eventId', events.data ?? [])}
        {permissions?.admin && <Toggle label={t('documents.private')} help={t('documents.privateHelp')} checked={v.isPrivate} onChange={f.set('isPrivate')} />}
        <label className="flex flex-col gap-1">
          <span className="font-bold">{t('documents.notes')}</span>
          <textarea value={v.notes} onChange={(e) => f.set('notes')(e.target.value)} rows={3} maxLength={5000} className="w-full rounded-sm border-[1.5px] border-border-strong bg-surface p-3 text-base text-text" />
        </label>
        <SavedIndicator {...f.save} />
        <Button needsInternet type="submit" loading={f.save.status === 'saving'}>{t('documents.saveDetails')}</Button>
        <Button variant="secondary" onClick={() => { f.cancel(); navigate(back); }}>{t('login.cancel')}</Button>
      </form>
    </Screen>
  );
}
