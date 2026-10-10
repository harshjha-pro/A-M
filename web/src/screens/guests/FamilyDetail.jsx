// Family page (FEATURES B5): phones to call, people and food, each invitation with
// Coming? chips, numbers for that event, an RSVP reminder on WhatsApp, and Remove
// (Undo, no confirm). Editors edit and delete (Undo); admins restore from Deleted items.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { History, MessageCircle, Pencil, Phone, Plus, Star, Trash2, X } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import Button from '../../components/Button.jsx';
import Sheet from '../../components/Sheet.jsx';
import NumberStepper from '../../components/NumberStepper.jsx';
import { Notice, ChoiceChips } from '../../components/Field.jsx';
import { api, newIdemKey } from '../../api/client.js';
import { withRelogin } from '../../api/auth.js';
import { saveViaOutbox } from '../../offline/outbox.js';
import { useSession } from '../../api/session.js';
import { showUndo, showToast } from '../../undo/undoStore.js';
import { formatPhone } from '../../format/phone.js';
import { formatDateTime } from '../../format/ist.js';
import { mobileOf, reminderText, waUrl, getLang, setLang, peopleText } from '../../data/guests.js';
import { useGuestEvents } from './GuestList.jsx';
import RsvpChips from './RsvpChips.jsx';
import WaitingMark from '../../components/WaitingMark.jsx';
import { t } from '../../i18n/strings.en.js';

/** Record the tap (bookkeeping, never "sent"), then WhatsApp opens through the link itself. */
export function recordTap(familyId, eventId) {
  api('POST', `/households/${familyId}/invitations/${eventId}/whatsapp-opened`, { body: {}, idemKey: newIdemKey() }).catch(() => {});
}

export function ReminderButton({ family, invitation, events, sender, lang, onTap }) {
  const phone = mobileOf(family);
  const event = events.find((e) => e.id === invitation.event.id) ?? invitation.event;
  if (!phone) {
    return (
      <span className="flex flex-col gap-1">
        <button type="button" disabled className="tap inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-border bg-surface px-4 font-bold opacity-50">
          <MessageCircle aria-hidden="true" size={20} /> {t('guests.remind')}
        </button>
        <span className="text-sm text-text-muted">{t('guests.addMobile')}</span>
      </span>
    );
  }
  return (
    <a href={waUrl(phone, reminderText(family, [event], sender, lang))} target="_blank" rel="noopener noreferrer" onClick={() => onTap?.()}
      className="tap inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-border-strong bg-surface px-4 font-bold">
      <MessageCircle aria-hidden="true" size={20} /> {t('guests.remind')}
    </a>
  );
}

export default function FamilyDetail() {
  const { id } = useParams();
  const { user, permissions } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['household', id], queryFn: () => api('GET', `/households/${id}`).then((r) => r.data) });
  const events = useGuestEvents();
  const [numbers, setNumbers] = useState(null); // invitation being edited
  const [lang, setLangState] = useState(getLang);
  const h = q.data;
  const canEdit = Boolean(permissions?.edit);

  if (q.isPending) return <Screen title={t('guests.familyTitle')} back="/guests"><p aria-busy="true">…</p></Screen>;
  if (q.isError) return <Screen title={t('guests.familyTitle')} back="/guests"><Notice kind="danger">{q.error.message || t('errors.loadFailed')}</Notice></Screen>;

  const refresh = () => { qc.invalidateQueries({ queryKey: ['households'] }); qc.invalidateQueries({ queryKey: ['events'] }); qc.invalidateQueries({ queryKey: ['household', id] }); };
  const putInvitation = (inv) => {
    qc.setQueryData(['household', id], (old) => (old ? { ...old, invitations: old.invitations.map((i) => (i.event.id === inv.event.id ? inv : i)) } : old));
    qc.invalidateQueries({ queryKey: ['households'] });
    qc.invalidateQueries({ queryKey: ['events'] });
  };

  async function run(fn) {
    try { return await withRelogin(fn); } catch (e) { showToast(e.message || t('errors.server')); return null; }
  }

  async function invite(event) {
    const res = await run(() => api('PUT', `/households/${id}/invitations/${event.id}`, { body: {}, idemKey: newIdemKey() }));
    if (!res) return;
    refresh();
    if (res.meta.undo) showUndo({ batchId: res.meta.undo.batchId, summary: res.meta.undo.summary, onUndone: refresh });
  }

  async function uninvite(inv) {
    const res = await run(() => api('DELETE', `/households/${id}/invitations/${inv.event.id}`, { ifMatch: inv.version, idemKey: newIdemKey() }));
    if (!res) return;
    refresh();
    if (res.meta.undo) showUndo({ batchId: res.meta.undo.batchId, summary: res.meta.undo.summary, onUndone: refresh });
  }

  async function saveNumbers(inv, adults, children) {
    const idemKey = newIdemKey();
    const res = await run(() => saveViaOutbox('PATCH', `/households/${id}/invitations/${inv.event.id}`, {
      body: { expectedAdults: adults, expectedChildren: children }, ifMatch: inv.version, idemKey, base: inv, label: t('outbox.label.people', { name: h.name, event: inv.event.name }),
    }));
    if (res) { if (res.queued) showToast(t('outbox.queuedToast')); putInvitation(res.data); setNumbers(null); }
  }

  async function remove() {
    const res = await run(() => api('DELETE', `/households/${id}`, { ifMatch: h.version, idemKey: newIdemKey() }));
    if (!res) return;
    qc.invalidateQueries({ queryKey: ['households'] });
    qc.invalidateQueries({ queryKey: ['events'] });
    if (res.meta.undo) showUndo({ batchId: res.meta.undo.batchId, summary: res.meta.undo.summary });
    navigate('/guests', { replace: true });
  }

  const invitedIds = new Set(h.invitations.map((i) => i.event.id));
  const notInvited = (events.data ?? []).filter((e) => !invitedIds.has(e.id));
  const evs = events.data ?? [];
  return (
    <Screen title={h.name} back="/guests">
      <section className="flex flex-col gap-3 rounded-md bg-surface p-4 shadow-card">
        <p className="flex flex-wrap gap-2">
          <span className="rounded-full bg-primary-soft px-3 py-1 font-bold text-primary">{t(`guests.sides.${h.side}`)}</span>
          <span className="rounded-full bg-bg px-3 py-1">{peopleText(h.people)} ({h.adults} + {h.children})</span>
          <span className="rounded-full bg-bg px-3 py-1">{t(`guests.food.${h.food}`)}{h.food === 'mixed' ? ` · ${t('guests.jainCount')} ${h.jainCount}` : ''}</span>
          {h.isVip && <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-3 py-1"><Star aria-hidden="true" size={16} className="fill-current" />{t('guests.important')}</span>}
          <WaitingMark entity={`/households/${h.id}`} className="px-1 py-1" />
        </p>
        {h.possibleDuplicate && <Notice kind="warning">{t('guests.possibleDuplicate')}</Notice>}
        {[h.phone, h.altPhone].filter(Boolean).map((p) => (
          <a key={p} href={`tel:${p}`} className="tap inline-flex items-center gap-2 font-bold text-primary">
            <Phone aria-hidden="true" size={20} /> {t('guests.call', { phone: formatPhone(p) })}
          </a>
        ))}
        <dl className="flex flex-col gap-2">
          {[['group', h.groupName], ['relation', h.relation], ['area', h.area], ['city', h.city], ['address', h.address]].filter(([, v]) => v).map(([k, v]) => (
            <div key={k}><dt className="text-sm text-text-muted">{t(`guests.${k}`)}</dt><dd className="break-words">{v}</dd></div>
          ))}
          {h.notes && <div><dt className="text-sm text-text-muted">{t('guests.notes')}</dt><dd className="whitespace-pre-line break-words">{h.notes}</dd></div>}
        </dl>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">{t('guests.invitations')}</h2>
        {h.invitations.length === 0 && <p className="text-text-muted">{t('guests.noInvitations')}</p>}
        {h.invitations.length > 0 && canEdit && mobileOf(h) && (
          <ChoiceChips label={t('guests.language')} value={lang} onChange={(l) => { setLang(l); setLangState(l); }}
            options={['en', 'hi'].map((l) => ({ value: l, label: t(`guests.lang.${l}`) }))} />
        )}
        {h.invitations.map((inv) => (
          <article key={inv.event.id} className="flex flex-col gap-3 rounded-md bg-surface p-4 shadow-card">
            <div className="flex items-start gap-2">
              <h3 className="flex-1 text-lg font-bold"><Link to={`/calendar/events/${inv.event.id}`} className="text-primary">{inv.event.name}</Link></h3>
              {canEdit && (
                <button type="button" onClick={() => uninvite(inv)} aria-label={t('guests.remove', { event: inv.event.name })} className="tap inline-flex items-center justify-center px-2 text-text-muted">
                  <X aria-hidden="true" size={22} />
                </button>
              )}
            </div>
            <RsvpChips familyId={id} familyName={h.name} invitation={inv} disabled={!canEdit} onSaved={putInvitation} />
            <p className="flex flex-wrap items-center gap-2 text-text-muted">
              {t('guests.peopleFor', { n: inv.people })}
              {canEdit && <button type="button" className="tap font-bold text-primary" onClick={() => setNumbers(inv)}>{t('guests.changeNumbers')}</button>}
            </p>
            {inv.lastReminderOpenedAt && <p className="text-sm text-text-muted">{t('guests.lastReminder', { when: formatDateTime(inv.lastReminderOpenedAt) })}</p>}
            {canEdit && <ReminderButton family={h} invitation={inv} events={evs} sender={user?.name} lang={lang} onTap={() => { recordTap(id, inv.event.id); }} />}
          </article>
        ))}
        {canEdit && notInvited.map((e) => (
          <Button needsInternet key={e.id} variant="secondary" onClick={() => invite(e)}><Plus aria-hidden="true" size={20} />{t('guests.invite', { event: e.name })}</Button>
        ))}
      </section>

      <div className="flex flex-col gap-3">
        <Link to={`/history/households/${id}`} className="tap inline-flex items-center justify-center gap-2 font-bold text-primary"><History aria-hidden="true" size={20} />{t('guests.history')}</Link>
        {canEdit ? (
          <>
            <Button variant="secondary" onClick={() => navigate(`/guests/${id}/edit`)}><Pencil aria-hidden="true" size={20} />{t('guests.edit')}</Button>
            <Button needsInternet variant="danger" onClick={remove}><Trash2 aria-hidden="true" size={20} />{t('guests.delete')}</Button>
          </>
        ) : <p className="text-center text-text-muted">{t('guests.readOnly')}</p>}
      </div>

      {numbers && <NumbersSheet family={h} invitation={numbers} onClose={() => setNumbers(null)} onSave={saveNumbers} />}
    </Screen>
  );
}

function NumbersSheet({ family, invitation, onClose, onSave }) {
  const [adults, setAdults] = useState(invitation.expectedAdults ?? family.adults);
  const [children, setChildren] = useState(invitation.expectedChildren ?? family.children);
  return (
    <Sheet title={t('guests.numbersTitle', { event: invitation.event.name })} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <NumberStepper label={t('guests.adults')} value={adults} onChange={setAdults} />
        <NumberStepper label={t('guests.children')} value={children} onChange={setChildren} />
        <Button onClick={() => onSave(invitation, adults, children)}>{t('guests.save')}</Button>
        <Button variant="secondary" onClick={() => onSave(invitation, null, null)}>{t('guests.useFamily')}</Button>
      </div>
    </Sheet>
  );
}
