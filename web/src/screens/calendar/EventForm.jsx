// Add / edit an event (admins). Date + IST times; "All day"; https:// map link;
// same type on the same day → "Add anyway". Shared form rules (drafts, conflict screen).
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Screen from '../../components/Screen.jsx';
import { TextField, ChoiceChips, Toggle, FixSummary, Notice } from '../../components/Field.jsx';
import Button from '../../components/Button.jsx';
import SavedIndicator from '../../components/SavedIndicator.jsx';
import DraftBanner from '../../components/DraftBanner.jsx';
import ConflictScreen from '../../components/ConflictScreen.jsx';
import { api } from '../../api/client.js';
import { DuplicateError } from '../../api/errors.js';
import { useEntityForm } from '../../forms/useEntityForm.js';
import { showToast } from '../../undo/undoStore.js';
import { istParts, istIso, formatDateOnly, formatHhmm } from '../../format/ist.js';
import { t } from '../../i18n/strings.en.js';

const FIELDS = ['name', 'type', 'side', 'guestsInvited', 'date', 'startTime', 'endTime', 'allDay', 'venueName', 'venueAddress', 'mapUrl', 'dressCode', 'notes'];
const WHEN = ['date', 'startTime', 'endTime', 'allDay'];
const TYPES = ['engagement', 'roka', 'haldi', 'mehndi', 'sangeet', 'mayra', 'wedding', 'reception', 'other'];
const LABELS = {
  name: t('events.name'), type: t('events.type'), side: t('events.side'), guestsInvited: t('events.guestsInvited'), date: t('events.date'),
  startTime: t('events.start'), endTime: t('events.end'), allDay: t('events.allDay'), venueName: t('events.venue'), venueAddress: t('events.address'),
  mapUrl: t('events.map'), dressCode: t('events.dress'), notes: t('events.notes'),
};
const EMPTY = { version: 0, name: '', type: 'other', side: 'both', guestsInvited: false, startAt: null, endAt: null, allDay: false };

function toForm(e) {
  const s = e.startAt ? istParts(e.startAt) : null;
  const en = e.endAt ? istParts(e.endAt) : null;
  return {
    name: e.name ?? '', type: e.type, side: e.side, guestsInvited: Boolean(e.guestsInvited),
    date: s?.date ?? '', startTime: s && !e.allDay ? s.time : '', endTime: en ? en.time : '', allDay: Boolean(e.allDay),
    venueName: e.venueName ?? '', venueAddress: e.venueAddress ?? '', mapUrl: e.mapUrl ?? '', dressCode: e.dressCode ?? '', notes: e.notes ?? '',
  };
}

export default function EventForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['event', id], queryFn: () => api('GET', `/events/${id}`).then((r) => r.data), enabled: Boolean(id) });
  const [dup, setDup] = useState(null);
  const allowDup = useRef(false);
  const record = id ? q.data : EMPTY;

  const f = useEntityForm({
    form: 'event',
    recordId: id ?? null,
    record,
    fields: FIELDS,
    neverAuto: ['date', 'startTime'],
    fromServer: toForm,
    toBody(keys, v) {
      const body = {};
      for (const k of keys) if (!WHEN.includes(k)) body[k] = typeof v[k] === 'string' && v[k] === '' ? null : v[k];
      if (keys.some((k) => WHEN.includes(k))) {
        body.allDay = v.allDay;
        body.startAt = v.date ? istIso(v.date, v.allDay ? '00:00' : v.startTime || '00:00') : null;
        body.endAt = v.date && !v.allDay && v.endTime ? istIso(v.date, v.endTime) : null;
      }
      if (!id) {
        body.name = v.name;
        body.type = v.type;
        if (allowDup.current) body.allowDuplicate = true;
      }
      return body;
    },
    send: (body, version, idemKey) => (id
      ? api('PATCH', `/events/${id}`, { body, ifMatch: version, idemKey })
      : api('POST', '/events', { body, idemKey })).then((r) => r.data),
    mapError: (err) => (err instanceof DuplicateError ? (setDup(err.message), {}) : null),
    onSaved(saved) {
      qc.invalidateQueries({ queryKey: ['calendar'] });
      qc.invalidateQueries({ queryKey: ['events'] });
      if (!saved) return;
      qc.setQueryData(['event', saved.id], saved);
      if (!id) showToast(t('events.added'));
      navigate(`/calendar/events/${saved.id}`, { replace: true });
    },
  });

  useEffect(() => {
    if (record && !f.editing && !f.conflict && f.save.status !== 'saved') f.start();
  });

  const title = id ? t('events.editTitle') : t('events.addTitle');
  if (id && q.isError) return <Screen title={title} back="/calendar"><Notice kind="danger">{q.error.message || t('errors.loadFailed')}</Notice></Screen>;
  if (!f.editing) return <Screen title={title} back="/calendar"><p aria-busy="true">…</p></Screen>;
  if (f.conflict) {
    const show = (field, v) => (field === 'date' ? formatDateOnly(v) : ['startTime', 'endTime'].includes(field) ? formatHhmm(v)
      : field === 'type' ? t(`events.types.${v}`) : field === 'side' ? t(`events.sides.${v}`) : typeof v === 'boolean' ? (v ? t('yes') : t('no')) : v);
    return <ConflictScreen conflict={f.conflict} labels={LABELS} longText={['notes']} format={show} saving={f.save.status === 'saving'} onSave={f.resolve} onKeepTheirs={f.keepTheirs} />;
  }

  const v = f.values;
  const errors = f.fieldErrors;
  return (
    <Screen title={title} back={id ? `/calendar/events/${id}` : '/calendar'}>
      {f.draft && <DraftBanner time={f.draftTime} onUse={f.useDraft} onDiscard={f.discardDraft} />}
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          allowDup.current = false;
          setDup(null);
          if (!v.name.trim()) { f.setFieldErrors({ name: t('events.nameRequired') }); return; }
          f.submit(ev);
        }}
        className="flex flex-col gap-5" noValidate
      >
        <FixSummary fields={errors} />
        {dup && (
          <div role="alert" className="flex flex-col gap-3 rounded-md bg-warning-soft p-3">
            <p>{dup}</p>
            <Button onClick={() => { allowDup.current = true; setDup(null); f.submit(); }}>{t('events.addAnyway')}</Button>
          </div>
        )}
        <TextField label={t('events.name')} value={v.name} onChange={f.set('name')} error={errors.name} maxLength={80} />
        <label className="flex flex-col gap-1">
          <span className="font-bold">{t('events.type')}</span>
          <select value={v.type} onChange={(e) => f.set('type')(e.target.value)} className="tap rounded-sm border-[1.5px] border-border-strong bg-surface px-3 text-base text-text">
            {TYPES.map((k) => <option key={k} value={k}>{t(`events.types.${k}`)}</option>)}
          </select>
        </label>
        <ChoiceChips label={t('events.side')} options={['bride', 'groom', 'both'].map((s) => ({ value: s, label: t(`events.sides.${s}`) }))} value={v.side} onChange={f.set('side')} />
        <TextField type="date" label={t('events.date')} value={v.date} onChange={f.set('date')} error={errors.startAt} />
        <Toggle label={t('events.allDay')} checked={v.allDay} onChange={f.set('allDay')} />
        {v.date && !v.allDay && (
          <div className="grid grid-cols-2 gap-3">
            <TextField type="time" label={t('events.start')} value={v.startTime} onChange={f.set('startTime')} />
            <TextField type="time" label={t('events.end')} value={v.endTime} onChange={f.set('endTime')} error={errors.endAt} />
          </div>
        )}
        <TextField label={t('events.venue')} value={v.venueName} onChange={f.set('venueName')} error={errors.venueName} maxLength={120} />
        <TextField label={t('events.address')} value={v.venueAddress} onChange={f.set('venueAddress')} error={errors.venueAddress} maxLength={300} />
        <TextField type="url" inputMode="url" label={t('events.map')} help={t('events.mapHelp')} value={v.mapUrl} onChange={f.set('mapUrl')} error={errors.mapUrl} maxLength={500} />
        <TextField label={t('events.dress')} value={v.dressCode} onChange={f.set('dressCode')} maxLength={120} />
        <Toggle label={t('events.guestsInvited')} help={t('events.guestsHelp')} checked={v.guestsInvited} onChange={f.set('guestsInvited')} />
        <label className="flex flex-col gap-1">
          <span className="font-bold">{t('events.notes')}</span>
          <textarea value={v.notes} onChange={(e) => f.set('notes')(e.target.value)} rows={4} maxLength={5000}
            className="w-full rounded-sm border-[1.5px] border-border-strong bg-surface p-3 text-base text-text" />
        </label>
        <SavedIndicator {...f.save} />
        <Button type="submit" loading={f.save.status === 'saving'}>{t('events.save')}</Button>
        <Button variant="secondary" onClick={() => { f.cancel(); navigate(id ? `/calendar/events/${id}` : '/calendar'); }}>{t('login.cancel')}</Button>
      </form>
    </Screen>
  );
}
