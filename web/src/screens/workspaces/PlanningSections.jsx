// Workspace step D (1.0.20): Contacts (vendors linked to this workspace, Call / WhatsApp, role;
// vendors already used here listed apart), Guest details (the linked event's headcount, Open in
// Guests, guest notes) and the Event timeline (time optional with estimated times after it,
// duration and purpose, note, attachments, tasks; move up/down; suggested steps).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ChevronRight, MessageCircle, Phone, Plus, Sparkles, Trash2, Users } from 'lucide-react';
import Sheet from '../../components/Sheet.jsx';
import Button from '../../components/Button.jsx';
import { TextField } from '../../components/Field.jsx';
import { api, newIdemKey } from '../../api/client.js';
import { withRelogin } from '../../api/auth.js';
import { ValidationError } from '../../api/errors.js';
import { showUndo, showToast } from '../../undo/undoStore.js';
import { formatHhmm } from '../../format/ist.js';
import { formatPhone } from '../../format/phone.js';
import { AttachBlock, TasksBlock } from '../outfits/parts.jsx';
import { t } from '../../i18n/strings.en.js';

/** 90 → "1 h 30 min" */
export function duration(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h} h` : '', m || !h ? `${m} min` : ''].filter(Boolean).join(' ');
}

function useRefresh() {
  const qc = useQueryClient();
  return () => { qc.invalidateQueries({ queryKey: ['workspace'] }); qc.invalidateQueries({ queryKey: ['attachments'] }); qc.invalidateQueries({ queryKey: ['tasks'] }); qc.invalidateQueries({ queryKey: ['vendors'] }); };
}

function ContactSheet({ ws, contact = null, presetVendor = '', onClose, refresh }) {
  const vendors = useQuery({ queryKey: ['vendors'], queryFn: () => api('GET', '/vendors').then((r) => r.data), staleTime: 60_000, enabled: !contact });
  const taken = new Set((ws.planning?.contacts ?? []).map((c) => c.vendor?.id));
  const choices = (vendors.data ?? []).filter((v) => !taken.has(v.id));
  const [vendorId, setVendorId] = useState(presetVendor);
  const [role, setRole] = useState(contact?.role ?? '');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!contact && !vendorId) { setErrors({ vendorId: t('errors.required') }); return; }
    setBusy(true);
    try {
      if (contact) await withRelogin(() => api('PATCH', `/workspace-contacts/${contact.id}`, { body: { role: role.trim() || null }, ifMatch: contact.version, idemKey: newIdemKey() }));
      else await withRelogin(() => api('POST', `/workspaces/${ws.id}/contacts`, { body: { vendorId, role: role.trim() || null }, idemKey: newIdemKey() }));
      refresh(); onClose();
    } catch (e) { if (e instanceof ValidationError) setErrors(e.fields); else showToast(e.message || t('errors.server')); } finally { setBusy(false); }
  }
  async function remove() {
    try {
      const res = await withRelogin(() => api('DELETE', `/workspace-contacts/${contact.id}`, { ifMatch: contact.version, idemKey: newIdemKey() }));
      if (res.meta.undo) showUndo({ batchId: res.meta.undo.batchId, summary: res.meta.undo.summary, onUndone: refresh });
      refresh(); onClose();
    } catch (e) { showToast(e.message || t('errors.server')); }
  }
  return (
    <Sheet title={contact ? contact.vendor?.name : t('contacts.add')} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {!contact && (
          <label className="flex flex-col gap-1">
            <span className="font-bold">{t('contacts.vendor')}</span>
            <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="tap rounded-sm border-[1.5px] border-border-strong bg-surface px-3 text-base text-text">
              <option value="">{t('contacts.pickVendor')}</option>
              {choices.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            {vendors.data && choices.length === 0 && <span className="text-sm text-text-muted">{vendors.data.length ? t('contacts.allAdded') : t('contacts.noVendors')}</span>}
            {errors.vendorId && <span className="text-sm text-danger">{errors.vendorId}</span>}
          </label>
        )}
        <TextField label={t('contacts.role')} value={role} onChange={setRole} error={errors.role} maxLength={120} placeholder={t('contacts.rolePlaceholder')} />
        <Button needsInternet onClick={save} loading={busy}>{t('contacts.save')}</Button>
        {contact && (
          <>
            <p className="text-sm text-text-muted">{t('contacts.removeHelp')}</p>
            <Button variant="danger" needsInternet onClick={remove}><Trash2 aria-hidden="true" size={18} />{t('contacts.remove')}</Button>
          </>
        )}
      </div>
    </Sheet>
  );
}

function VendorLine({ v, role, children }) {
  const wa = v.phone ? `https://wa.me/${v.phone.replace(/^\+/, '')}` : null;
  return (
    <div className="flex items-center gap-2 py-2">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-bold">{v.name}</span>
        <span className="truncate text-sm text-text-muted">{[v.categoryLabel, role, v.phone ? formatPhone(v.phone) : null].filter(Boolean).join(' · ')}</span>
      </div>
      {v.phone && <a href={`tel:${v.phone}`} aria-label={t('contacts.call', { name: v.name })} className="tap grid min-h-12 min-w-12 place-items-center text-primary"><Phone aria-hidden="true" size={20} /></a>}
      {wa && <a href={wa} target="_blank" rel="noreferrer" aria-label={t('contacts.whatsapp', { name: v.name })} className="tap grid min-h-12 min-w-12 place-items-center text-success"><MessageCircle aria-hidden="true" size={20} /></a>}
      {children}
    </div>
  );
}

export function ContactsSection({ ws, title }) {
  const refresh = useRefresh();
  const p = ws.planning ?? { contacts: [], alsoUsed: [] };
  const [sheet, setSheet] = useState(null); // {contact?, vendor?}
  return (
    <section id="contacts" aria-labelledby="ws-contacts" className="flex flex-col gap-3 rounded-md bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h2 id="ws-contacts" className="text-lg font-bold">{title}</h2>
        <Button variant="secondary" needsInternet onClick={() => setSheet({})}><Plus aria-hidden="true" size={20} />{t('contacts.add')}</Button>
      </div>
      {p.contacts.length === 0 && <p className="text-text-muted">{t('contacts.none')}</p>}
      {p.contacts.length > 0 && (
        <ul className="flex flex-col divide-y divide-border" aria-label={title}>
          {p.contacts.map((c) => c.vendor && (
            <li key={c.id}>
              <VendorLine v={c.vendor} role={c.role}>
                <button type="button" onClick={() => setSheet({ contact: c })} aria-label={`${t('outfit.rename')}: ${c.vendor.name}`} className="tap grid min-h-12 min-w-12 place-items-center text-text-muted"><ChevronRight aria-hidden="true" size={20} /></button>
              </VendorLine>
            </li>
          ))}
        </ul>
      )}
      {p.alsoUsed.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-border pt-3">
          <h3 className="font-bold">{t('contacts.alsoUsed')}</h3>
          <ul className="flex flex-col divide-y divide-border" aria-label={t('contacts.alsoUsed')}>
            {p.alsoUsed.map((a) => (
              <li key={a.vendor.id}>
                <VendorLine v={a.vendor} role={a.where.join(', ')}>
                  <Button variant="text" onClick={() => setSheet({ vendor: a.vendor.id })} aria-label={`${t('contacts.addThis')}: ${a.vendor.name}`}><Plus aria-hidden="true" size={18} /></Button>
                </VendorLine>
              </li>
            ))}
          </ul>
        </div>
      )}
      {sheet && <ContactSheet ws={ws} contact={sheet.contact} presetVendor={sheet.vendor ?? ''} refresh={refresh} onClose={() => setSheet(null)} />}
    </section>
  );
}

export function GuestsSection({ ws, title }) {
  const qc = useQueryClient();
  const g = ws.planning?.guests;
  const [notes, setNotes] = useState(ws.guestNotes ?? '');
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await withRelogin(() => api('PATCH', `/workspaces/${ws.id}`, { body: { guestNotes: notes.trim() || null }, ifMatch: ws.version, idemKey: newIdemKey() }));
      qc.invalidateQueries({ queryKey: ['workspace'] });
      showToast(t('guestsWs.saved'));
    } catch (e) { showToast(e.message || t('errors.server')); } finally { setBusy(false); }
  }
  const tiles = g ? [[t('guestsWs.invited'), g.familiesInvited], [t('guestsWs.coming'), g.familiesComing], [t('guestsWs.notComing'), g.familiesNotComing], [t('guestsWs.waiting'), g.familiesWaiting]] : [];
  return (
    <section id="guests" aria-labelledby="ws-guests" className="flex flex-col gap-3 rounded-md bg-surface p-4 shadow-card">
      <h2 id="ws-guests" className="text-lg font-bold">{title}</h2>
      {!ws.event && <p className="text-text-muted">{t('guestsWs.noEvent')}</p>}
      {ws.event && !g && <p className="text-text-muted">{t('guestsWs.noGuests')}</p>}
      {g && (
        <>
          <dl className="grid grid-cols-4 gap-2 text-center">
            {tiles.map(([label, n]) => (
              <div key={label} className="flex flex-col-reverse rounded-sm bg-surface-2 p-2">
                <dt className="text-xs text-text-muted">{label}</dt>
                <dd className="text-xl font-bold">{n}</dd>
              </div>
            ))}
          </dl>
          <p><span className="font-bold">{t('guestsWs.people', { n: g.peopleComing })}</span> · {t('guestsWs.peopleDetail', { adults: g.adultsComing, children: g.childrenComing, jain: g.jainComing })}</p>
          {g.peopleWaiting > 0 && <p className="text-sm text-text-muted">{t('guestsWs.upTo', { n: g.peopleUpTo })}</p>}
          <Link to={`/guests?event=${g.event.id}`} className="tap inline-flex items-center gap-2 self-start font-bold text-primary"><Users aria-hidden="true" size={20} />{t('guestsWs.open')}</Link>
        </>
      )}
      <label className="flex flex-col gap-1 border-t border-border pt-3">
        <span className="font-bold">{t('guestsWs.notes')}</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={5000} placeholder={t('guestsWs.notesPlaceholder')}
          className="rounded-sm border-[1.5px] border-border-strong bg-surface p-3 text-base text-text" />
      </label>
      <Button variant="secondary" needsInternet onClick={save} loading={busy} disabled={(notes.trim() || null) === (ws.guestNotes ?? null)}>{t('guestsWs.saveNotes')}</Button>
    </section>
  );
}

function StepSheet({ ws, step = null, first = false, last = false, onClose, refresh }) {
  const [purpose, setPurpose] = useState(step?.purpose ?? '');
  const [time, setTime] = useState(step?.startTime ?? '');
  const [minutes, setMinutes] = useState(step ? String(step.durationMin) : '');
  const [note, setNote] = useState(step?.note ?? '');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  async function save() {
    const errs = {};
    if (!purpose.trim()) errs.purpose = t('errors.required');
    if (!minutes.trim()) errs.durationMin = t('errors.required');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const body = { purpose: purpose.trim(), startTime: time || null, durationMin: Number(minutes), note: note.trim() || null };
      if (step) await withRelogin(() => api('PATCH', `/timeline-steps/${step.id}`, { body, ifMatch: step.version, idemKey: newIdemKey() }));
      else await withRelogin(() => api('POST', `/workspaces/${ws.id}/timeline`, { body, idemKey: newIdemKey() }));
      refresh(); onClose();
    } catch (e) { if (e instanceof ValidationError) setErrors(e.fields); else showToast(e.message || t('errors.server')); } finally { setBusy(false); }
  }
  async function move(direction) {
    try { await withRelogin(() => api('POST', `/timeline-steps/${step.id}/move`, { body: { direction }, idemKey: newIdemKey() })); refresh(); onClose(); } catch (e) { showToast(e.message || t('errors.server')); }
  }
  async function remove() {
    try {
      const res = await withRelogin(() => api('DELETE', `/timeline-steps/${step.id}`, { ifMatch: step.version, idemKey: newIdemKey() }));
      if (res.meta.undo) showUndo({ batchId: res.meta.undo.batchId, summary: res.meta.undo.summary, onUndone: refresh });
      refresh(); onClose();
    } catch (e) { showToast(e.message || t('errors.server')); }
  }
  return (
    <Sheet title={step ? step.purpose : t('timeline.add')} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <TextField label={t('timeline.purpose')} value={purpose} onChange={setPurpose} error={errors.purpose} maxLength={120} placeholder={t('timeline.purposePlaceholder')} />
        <TextField type="time" label={t('timeline.time')} help={t('timeline.timeHelp')} value={time} onChange={setTime} error={errors.startTime} />
        <TextField type="number" inputMode="numeric" min={1} max={1440} label={t('timeline.duration')} value={minutes} onChange={setMinutes} error={errors.durationMin} />
        <TextField label={t('timeline.note')} value={note} onChange={setNote} error={errors.note} maxLength={5000} />
        <Button needsInternet onClick={save} loading={busy}>{t('timeline.save')}</Button>
        {step && (
          <>
            <section className="flex flex-col gap-2"><h3 className="font-bold">{t('outfit.attachments')}</h3><AttachBlock target={{ timelineStepId: step.id }} attachments={step.attachments} refresh={refresh} /></section>
            <section className="flex flex-col gap-2"><h3 className="font-bold">{t('outfit.tasks')}</h3><TasksBlock tasks={step.tasks} query={`timelineStep=${step.id}`} back={`/workspaces/${ws.id}#timeline`} /></section>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" needsInternet disabled={first} onClick={() => move('up')}><ArrowUp aria-hidden="true" size={18} />{t('timeline.up')}</Button>
              <Button variant="secondary" needsInternet disabled={last} onClick={() => move('down')}><ArrowDown aria-hidden="true" size={18} />{t('timeline.down')}</Button>
              <Button variant="danger" needsInternet onClick={remove}><Trash2 aria-hidden="true" size={18} />{t('timeline.delete')}</Button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}

export function TimelineSection({ ws, title }) {
  const refresh = useRefresh();
  const tl = ws.planning?.timeline ?? { steps: [], totalMin: 0 };
  const [sheet, setSheet] = useState(null); // {id} | {add:true}
  const [busy, setBusy] = useState(false);
  const idx = sheet?.id ? tl.steps.findIndex((s) => s.id === sheet.id) : -1;
  async function suggested() {
    setBusy(true);
    try { await withRelogin(() => api('POST', `/workspaces/${ws.id}/timeline/suggested`, { body: {}, idemKey: newIdemKey() })); refresh(); } catch (e) { showToast(e.message || t('errors.server')); } finally { setBusy(false); }
  }
  return (
    <section id="timeline" aria-labelledby="ws-timeline" className="flex flex-col gap-3 rounded-md bg-surface p-4 shadow-card">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="ws-timeline" className="text-lg font-bold">{title}</h2>
        {tl.totalMin > 0 && <span className="text-sm text-text-muted">{t('timeline.total', { d: duration(tl.totalMin) })}</span>}
      </div>
      {tl.steps.length === 0 && (
        <>
          <p className="text-text-muted">{t('timeline.empty')}</p>
          <Button variant="secondary" needsInternet onClick={suggested} loading={busy}><Sparkles aria-hidden="true" size={18} />{t('timeline.suggested')}</Button>
        </>
      )}
      {tl.steps.length > 0 && (
        <ol className="flex flex-col gap-2" aria-label={title}>
          {tl.steps.map((s) => {
            const when = s.starts ? (s.estimated ? t('timeline.about', { time: formatHhmm(s.starts) }) : formatHhmm(s.starts)) : t('timeline.noTime');
            return (
              <li key={s.id}>
                <button type="button" onClick={() => setSheet({ id: s.id })} aria-label={`${s.purpose}, ${when}, ${duration(s.durationMin)}`}
                  className="flex min-h-14 w-full items-center gap-3 rounded-md border border-border px-3 py-2 text-left">
                  <span className={`w-20 shrink-0 text-sm ${s.estimated ? 'text-text-muted' : 'font-bold'}`}>{s.starts ? `${s.estimated ? '≈ ' : ''}${formatHhmm(s.starts)}` : '—'}</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-bold">{s.purpose}</span>
                    <span className="truncate text-sm text-text-muted">{duration(s.durationMin)}{s.note ? ` · ${s.note}` : ''}{s.attachments.length ? ` · 📎 ${s.attachments.length}` : ''}{s.tasks.length ? ` · ✓ ${s.tasks.length}` : ''}</span>
                  </span>
                  <ChevronRight aria-hidden="true" size={18} className="text-text-muted" />
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <Button variant="secondary" needsInternet onClick={() => setSheet({ add: true })}><Plus aria-hidden="true" size={20} />{t('timeline.add')}</Button>
      {sheet?.add && <StepSheet ws={ws} refresh={refresh} onClose={() => setSheet(null)} />}
      {idx >= 0 && <StepSheet ws={ws} step={tl.steps[idx]} first={idx === 0} last={idx === tl.steps.length - 1} refresh={refresh} onClose={() => setSheet(null)} />}
    </section>
  );
}
