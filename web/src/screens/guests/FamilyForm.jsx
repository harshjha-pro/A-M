// Add / edit a family (FEATURES B5, US-GST-01: under 30 s). Quick fields first (name,
// phone, side, people), the rest under "More details". Same phone as another family →
// "Already on the list" with [Open that family] [Add anyway]; same name + city → a hint.
// Shared form rules: changed fields only + If-Match, a draft, the conflict screen.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Screen from '../../components/Screen.jsx';
import { TextField, PhoneField, ChoiceChips, Toggle, FixSummary, Notice } from '../../components/Field.jsx';
import { MultiChips } from '../../components/ChipFilter.jsx';
import NumberStepper from '../../components/NumberStepper.jsx';
import Button from '../../components/Button.jsx';
import SavedIndicator from '../../components/SavedIndicator.jsx';
import DraftBanner from '../../components/DraftBanner.jsx';
import ConflictScreen from '../../components/ConflictScreen.jsx';
import { api } from '../../api/client.js';
import { saveViaOutbox } from '../../offline/save.js';
import { DuplicateError } from '../../api/errors.js';
import { useSession } from '../../api/session.js';
import { useEntityForm } from '../../forms/useEntityForm.js';
import { showToast } from '../../undo/undoStore.js';
import { normalizePhone, formatPhone } from '../../format/phone.js';
import { SIDES, FOODS, loadSticky, saveSticky } from '../../data/guests.js';
import { useGuestEvents } from './GuestList.jsx';
import { t } from '../../i18n/strings.en.js';

const FIELDS = ['name', 'phone', 'altPhone', 'side', 'adults', 'children', 'food', 'jainCount', 'isVip', 'groupName', 'relation', 'area', 'city', 'address', 'notes', 'inviteEventIds'];
const LABELS = {
  name: t('guests.name'), phone: t('guests.phone'), altPhone: t('guests.altPhone'), side: t('guests.side'), adults: t('guests.adults'),
  children: t('guests.children'), food: t('guests.foodLabel'), jainCount: t('guests.jainCount'), isVip: t('guests.important'),
  groupName: t('guests.group'), relation: t('guests.relation'), area: t('guests.area'), city: t('guests.city'), address: t('guests.address'), notes: t('guests.notes'),
};
const TEXT = ['name', 'phone', 'altPhone', 'groupName', 'relation', 'area', 'city', 'address', 'notes'];

function toForm(h) {
  return {
    name: h.name ?? '', phone: h.phone ? formatPhone(h.phone) : '', altPhone: h.altPhone ? formatPhone(h.altPhone) : '',
    side: h.side ?? '', adults: h.adults ?? 2, children: h.children ?? 0, food: h.food ?? 'veg', jainCount: h.jainCount ?? 0, isVip: Boolean(h.isVip),
    groupName: h.groupName ?? '', relation: h.relation ?? '', area: h.area ?? '', city: h.city ?? '', address: h.address ?? '', notes: h.notes ?? '',
    inviteEventIds: [],
  };
}

function Suggest({ id, field }) {
  const q = useQuery({ queryKey: ['household-suggestions', field], queryFn: () => api('GET', '/households/suggestions', { query: { field } }).then((r) => r.data), staleTime: 60_000 });
  return <datalist id={id}>{(q.data ?? []).map((v) => <option key={v} value={v} />)}</datalist>;
}

export default function FamilyForm() {
  const { id } = useParams();
  const { settingsBrief } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['household', id], queryFn: () => api('GET', `/households/${id}`).then((r) => r.data), enabled: Boolean(id) });
  const events = useGuestEvents();
  const [dup, setDup] = useState(null);
  const [hint, setHint] = useState(null);
  const [more, setMore] = useState(Boolean(id));
  const allowDup = useRef(false);
  const sticky = useRef(loadSticky());
  const record = id ? q.data : { version: 0, city: settingsBrief?.city ?? '' };

  const f = useEntityForm({
    form: 'household',
    recordId: id ?? null,
    record,
    fields: FIELDS,
    fromServer: toForm,
    initial: id ? null : { side: sticky.current.side || '', area: sticky.current.area || '' },
    toBody(keys, v) {
      const errors = {};
      const body = {};
      for (const k of keys) {
        if (k === 'inviteEventIds') { if (!id && v.inviteEventIds.length) body.inviteEventIds = v.inviteEventIds; continue; }
        body[k] = TEXT.includes(k) ? (v[k].trim() === '' ? null : v[k].trim()) : v[k];
      }
      for (const k of ['phone', 'altPhone']) {
        if (body[k]) {
          const n = normalizePhone(body[k]);
          if (!n.ok) errors[k] = n.error;
          else body[k] = n.e164;
        }
      }
      if (!v.name.trim()) errors.name = t('guests.nameRequired');
      if (!v.side) errors.side = t('guests.sideRequired');
      if (v.adults + v.children < 1) errors.adults = t('guests.peopleMin');
      if (v.food === 'mixed' && v.jainCount > v.adults + v.children) errors.jainCount = t('guests.jainTooMany');
      if (Object.keys(errors).length) return { errors };
      if (!id) { body.name = v.name.trim(); body.side = v.side; }
      if (body.food && body.food !== 'mixed') delete body.jainCount;
      if (allowDup.current) body.allowDuplicate = true;
      return body;
    },
    // Through the outbox: with no internet the family waits on the phone; the duplicate
    // check runs when it's sent (PWA §5.2).
    send: (body, version, idemKey) => (id
      ? saveViaOutbox('PATCH', `/households/${id}`, { body, ifMatch: version, idemKey, base: q.data, label: t('outbox.label.familyEdit', { name: body.name ?? q.data?.name ?? '' }) })
      : saveViaOutbox('POST', '/households', { body, idemKey, label: t('outbox.label.familyAdd', { name: body.name }) })).then((r) => (r.queued ? r : r.data)),
    mapError: (err) => (err instanceof DuplicateError ? (setDup(err), {}) : null),
    onSaved(saved) {
      qc.invalidateQueries({ queryKey: ['households'] });
      qc.invalidateQueries({ queryKey: ['events'] });
      if (!saved) return;
      qc.setQueryData(['household', saved.id], saved);
      if (!id) { saveSticky(saved); if (!saved.waiting) showToast(t('guests.added')); }
      navigate(`/guests/${saved.id}`, { replace: true });
    },
  });

  useEffect(() => {
    if (record && !f.editing && !f.conflict && f.save.status !== 'saved') f.start();
  });

  /** Hints while typing (never blocks): same phone, or same name in the same city. */
  async function check() {
    const v = f.values;
    const query = { name: v.name.trim(), city: v.city.trim(), exclude: id };
    for (const k of ['phone', 'altPhone']) { const n = normalizePhone(v[k] || ''); if (n.ok) query[k] = n.e164; }
    if (!query.name && !query.phone && !query.altPhone) { setHint(null); return; }
    try {
      const r = (await api('GET', '/households/duplicate-check', { query })).data;
      if (r.phoneMatches.length) setHint({ match: r.phoneMatches[0], text: t('guests.phoneHint', { name: r.phoneMatches[0].name }) });
      else if (r.nameMatches.length) setHint({ match: r.nameMatches[0], text: t('guests.nameHint', { name: r.nameMatches[0].name, city: query.city }) });
      else setHint(null);
    } catch { /* hints only */ }
  }

  const title = id ? t('guests.editTitle') : t('guests.addTitle');
  const back = id ? `/guests/${id}` : '/guests';
  if (id && q.isError) return <Screen title={title} back="/guests"><Notice kind="danger">{q.error.message || t('errors.loadFailed')}</Notice></Screen>;
  if (!f.editing) return <Screen title={title} back={back}><p aria-busy="true">…</p></Screen>;
  if (f.conflict) {
    const show = (field, v) => (field === 'side' ? t(`guests.sides.${v}`) : field === 'food' ? t(`guests.food.${v}`) : typeof v === 'boolean' ? (v ? t('yes') : t('no')) : v);
    return <ConflictScreen conflict={f.conflict} labels={LABELS} longText={['notes', 'address']} format={show} saving={f.save.status === 'saving'} onSave={f.resolve} onKeepTheirs={f.keepTheirs} />;
  }
  if (f.deleted) return <Screen title={title} back="/guests"><Notice kind="danger">{f.deleted.message}</Notice></Screen>;

  const v = f.values;
  const errors = f.fieldErrors;
  const landline = (p) => { const n = normalizePhone(p || ''); return n.ok && n.kind === 'landline' ? t('guests.landline') : undefined; };
  const total = v.adults + v.children;
  return (
    <Screen title={title} back={back}>
      {f.draft && <DraftBanner time={f.draftTime} onUse={f.useDraft} onDiscard={f.discardDraft} />}
      <form onSubmit={(ev) => { ev.preventDefault(); allowDup.current = false; setDup(null); f.submit(ev); }} className="flex flex-col gap-5" noValidate>
        <FixSummary fields={errors} />
        {dup && (
          <div role="alert" className="flex flex-col gap-3 rounded-md bg-warning-soft p-3">
            <p className="font-bold">{t('guests.dupTitle')}</p>
            <p>{dup.message}</p>
            {dup.matches[0] && <Link to={`/guests/${dup.matches[0].id}`} className="tap inline-flex items-center font-bold text-primary">{t('guests.openThat')}</Link>}
            <Button onClick={() => { allowDup.current = true; setDup(null); f.submit(); }}>{id ? t('guests.saveAnyway') : t('guests.addAnyway')}</Button>
          </div>
        )}
        <TextField label={t('guests.name')} help={t('guests.nameHelp')} value={v.name} onChange={f.set('name')} onBlur={check} error={errors.name} maxLength={120} autoComplete="off" />
        <PhoneField label={t('guests.phone')} value={v.phone} onChange={f.set('phone')} onBlur={check} error={errors.phone} help={landline(v.phone)} />
        {hint && (
          <p role="status" className="rounded-md bg-info-soft p-3">
            {hint.text} <Link to={`/guests/${hint.match.id}`} className="font-bold text-primary underline">{t('guests.openThat')}</Link>
          </p>
        )}
        <ChoiceChips label={t('guests.side')} options={SIDES.map((s) => ({ value: s, label: t(`guests.sides.${s}`) }))} value={v.side} onChange={f.set('side')} error={errors.side} />
        <div className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2">
          <NumberStepper label={t('guests.adults')} value={v.adults} onChange={f.set('adults')} error={errors.adults} />
          <NumberStepper label={t('guests.children')} value={v.children} onChange={f.set('children')} error={errors.children} />
        </div>
        <ChoiceChips label={t('guests.foodLabel')} options={FOODS.map((x) => ({ value: x, label: t(`guests.food.${x}`) }))} value={v.food} onChange={f.set('food')} error={errors.food} />
        {v.food === 'mixed' && <NumberStepper label={t('guests.jainCount')} value={v.jainCount} onChange={f.set('jainCount')} max={Math.max(total, 0)} error={errors.jainCount} />}
        {!id && (
          (events.data ?? []).length > 0
            ? <MultiChips label={t('guests.inviteTo')} options={events.data.map((e) => ({ value: e.id, label: e.name }))} value={v.inviteEventIds} onChange={f.set('inviteEventIds')} error={errors.inviteEventIds} />
            : events.isSuccess && <p className="text-text-muted">{t('guests.noGuestEvents')}</p>
        )}
        {!more ? (
          <button type="button" className="tap self-start font-bold text-primary" onClick={() => setMore(true)}>{t('guests.more')}</button>
        ) : (
          <>
            <Toggle label={t('guests.important')} help={t('guests.importantHelp')} checked={v.isVip} onChange={f.set('isVip')} />
            <PhoneField label={t('guests.altPhone')} value={v.altPhone} onChange={f.set('altPhone')} onBlur={check} error={errors.altPhone} help={landline(v.altPhone)} />
            <TextField label={t('guests.group')} help={t('guests.groupHelp')} value={v.groupName} onChange={f.set('groupName')} error={errors.groupName} maxLength={80} list="hh-groups" />
            <Suggest id="hh-groups" field="group_name" />
            <TextField label={t('guests.relation')} value={v.relation} onChange={f.set('relation')} error={errors.relation} maxLength={40} list="hh-relations" />
            <Suggest id="hh-relations" field="relation" />
            <TextField label={t('guests.area')} value={v.area} onChange={f.set('area')} error={errors.area} maxLength={80} list="hh-areas" />
            <Suggest id="hh-areas" field="area" />
            <TextField label={t('guests.city')} value={v.city} onChange={f.set('city')} onBlur={check} error={errors.city} maxLength={60} />
            <TextField label={t('guests.address')} value={v.address} onChange={f.set('address')} error={errors.address} maxLength={300} />
            <label className="flex flex-col gap-1">
              <span className="font-bold">{t('guests.notes')}</span>
              <textarea value={v.notes} onChange={(e) => f.set('notes')(e.target.value)} rows={3} maxLength={5000}
                className="w-full rounded-sm border-[1.5px] border-border-strong bg-surface p-3 text-base text-text" />
            </label>
          </>
        )}
        <SavedIndicator {...f.save} />
        <Button type="submit" loading={f.save.status === 'saving'}>{t('guests.save')}</Button>
        <Button variant="secondary" onClick={() => { f.cancel(); navigate(back); }}>{t('login.cancel')}</Button>
      </form>
    </Screen>
  );
}
