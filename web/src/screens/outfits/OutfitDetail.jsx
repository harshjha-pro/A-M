// One outfit (1.0.18, Workspace step B): timeline (tap a step: done + date, notes,
// attachments, tasks, rename, delete; add your own steps), moodboard from the Vault (add or
// pick), accessories (each with notes, attachments, tasks), notes and tasks. Rename; delete
// with Undo (tasks stay). Ayush and Mahi only. 1.0.19: also family outfits and decor items
// (props instead of accessories), and the vendor (tailor / decorator).
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronRight, Pencil, Plus, Trash2, Archive } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import Button from '../../components/Button.jsx';
import Sheet from '../../components/Sheet.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import { TextField, Toggle, Notice } from '../../components/Field.jsx';
import { api, newIdemKey } from '../../api/client.js';
import { withRelogin } from '../../api/auth.js';
import { ValidationError } from '../../api/errors.js';
import { useSession } from '../../api/session.js';
import { showUndo, showToast } from '../../undo/undoStore.js';
import { todayIst, formatDateOnly } from '../../format/ist.js';
import { useAttachments } from '../../data/vault.js';
import { AttachmentThumb } from '../vault/AttachmentRow.jsx';
import { VendorSelect } from '../vault/AttachmentAddSheet.jsx';
import { NotesBlock, AttachBlock, TasksBlock, useRefresh } from './parts.jsx';
import { t } from '../../i18n/strings.en.js';

const short = (ymd) => formatDateOnly(ymd).replace(/^\w+, /, '').replace(/ \d{4}$/, '');

/** One-field sheet: add a step / accessory, rename. */
export function NameSheet({ title, label, initial = '', max = 120, onSave, onClose }) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!name.trim()) { setError(t('errors.required')); return; }
    setBusy(true);
    try { await onSave(name.trim()); onClose(); } catch (e) {
      if (e instanceof ValidationError) setError(Object.values(e.fields)[0] ?? e.message); else showToast(e.message || t('errors.server'));
    } finally { setBusy(false); }
  }
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <TextField label={label} value={name} onChange={setName} error={error} maxLength={max} />
        <Button needsInternet onClick={save} loading={busy}>{t('outfit.save2')}</Button>
      </div>
    </Sheet>
  );
}

function StepSheet({ outfit, step, onClose, refresh }) {
  const [doneOn, setDoneOn] = useState(step.doneOn ?? '');
  const [done, setDone] = useState(step.done); // moves at once; the server's reply follows
  const [renaming, setRenaming] = useState(false);
  const [error, setError] = useState(null);
  async function patch(body) {
    try {
      await withRelogin(() => api('PATCH', `/outfit-steps/${step.id}`, { body, ifMatch: step.version, idemKey: newIdemKey() }));
      setError(null); refresh();
    } catch (e) { if (e instanceof ValidationError) setError(e.fields.doneOn ?? e.message); else showToast(e.message || t('errors.server')); }
  }
  async function remove() {
    try {
      const res = await withRelogin(() => api('DELETE', `/outfit-steps/${step.id}`, { ifMatch: step.version, idemKey: newIdemKey() }));
      if (res.meta.undo) showUndo({ batchId: res.meta.undo.batchId, summary: res.meta.undo.summary, onUndone: refresh });
      refresh(); onClose();
    } catch (e) { showToast(e.message || t('errors.server')); }
  }
  return (
    <Sheet title={step.name} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <Toggle label={t('outfit.stepDone')} checked={done} onChange={(on) => { const d = on ? (doneOn || todayIst()) : null; setDone(on); setDoneOn(d ?? ''); patch({ doneOn: d }); }} />
        {done && (
          <TextField type="date" label={t('outfit.doneOn')} value={doneOn} max={todayIst()} error={error}
            onChange={(v) => { setDoneOn(v); if (v) patch({ doneOn: v }); }} />
        )}
        <section className="flex flex-col gap-2"><h3 className="font-bold">{t('outfit.notes')}</h3><NotesBlock target={{ outfitStepId: step.id }} notes={step.notes ?? []} refresh={refresh} /></section>
        <section className="flex flex-col gap-2"><h3 className="font-bold">{t('outfit.attachments')}</h3><AttachBlock target={{ outfitStepId: step.id }} attachments={step.attachments ?? []} refresh={refresh} /></section>
        <section className="flex flex-col gap-2"><h3 className="font-bold">{t('outfit.tasks')}</h3><TasksBlock tasks={step.tasks ?? []} query={`outfitStep=${step.id}`} outfitId={outfit.id} /></section>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" needsInternet onClick={() => setRenaming(true)}><Pencil aria-hidden="true" size={18} />{t('outfit.rename')}</Button>
          <Button variant="danger" needsInternet onClick={remove}><Trash2 aria-hidden="true" size={18} />{t('outfit.deleteStep')}</Button>
        </div>
      </div>
      {renaming && <NameSheet title={t('outfit.rename')} label={t('outfit.stepName')} initial={step.name} max={60} onClose={() => setRenaming(false)}
        onSave={(name) => withRelogin(() => api('PATCH', `/outfit-steps/${step.id}`, { body: { name }, ifMatch: step.version, idemKey: newIdemKey() })).then(refresh)} />}
    </Sheet>
  );
}

function AccessorySheet({ outfit, acc, onClose, refresh, L }) {
  const [renaming, setRenaming] = useState(false);
  async function remove() {
    try {
      const res = await withRelogin(() => api('DELETE', `/accessories/${acc.id}`, { ifMatch: acc.version, idemKey: newIdemKey() }));
      if (res.meta.undo) showUndo({ batchId: res.meta.undo.batchId, summary: res.meta.undo.summary, onUndone: refresh });
      refresh(); onClose();
    } catch (e) { showToast(e.message || t('errors.server')); }
  }
  return (
    <Sheet title={acc.name} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-2"><h3 className="font-bold">{t('outfit.attachments')}</h3><AttachBlock target={{ accessoryId: acc.id }} attachments={acc.attachments} refresh={refresh} grid /></section>
        <section className="flex flex-col gap-2"><h3 className="font-bold">{t('outfit.notes')}</h3><NotesBlock target={{ accessoryId: acc.id }} notes={acc.notes} refresh={refresh} /></section>
        <section className="flex flex-col gap-2"><h3 className="font-bold">{t('outfit.tasks')}</h3><TasksBlock tasks={acc.tasks} query={`accessory=${acc.id}`} outfitId={outfit.id} /></section>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" needsInternet onClick={() => setRenaming(true)}><Pencil aria-hidden="true" size={18} />{t('outfit.rename')}</Button>
          <Button variant="danger" needsInternet onClick={remove}><Trash2 aria-hidden="true" size={18} />{L.deleteAccessory}</Button>
        </div>
      </div>
      {renaming && <NameSheet title={t('outfit.rename')} label={L.accessoryName} initial={acc.name} onClose={() => setRenaming(false)}
        onSave={(name) => withRelogin(() => api('PATCH', `/accessories/${acc.id}`, { body: { name }, ifMatch: acc.version, idemKey: newIdemKey() })).then(refresh)} />}
    </Sheet>
  );
}

function VaultPickSheet({ outfit, onClose, refresh }) {
  const [q, setQ] = useState('');
  const list = useAttachments({ q: q.trim() || undefined, limit: 50 });
  const on = new Set(outfit.moodboard.map((a) => a.id));
  async function pick(a) {
    try {
      await withRelogin(() => api('POST', `/attachments/${a.id}/links`, { body: { outfitId: outfit.id }, idemKey: newIdemKey() }));
      refresh(); onClose();
    } catch (e) { showToast(e.message || t('errors.server')); }
  }
  return (
    <Sheet title={t('outfit.pickTitle')} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('vault.search')} aria-label={t('vault.search')}
          className="tap w-full rounded-sm border-[1.5px] border-border-strong bg-surface px-3 text-base text-text" />
        <ul className="flex flex-col gap-2">
          {(list.data?.items ?? []).filter((a) => !on.has(a.id)).map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => pick(a)} className="tap flex w-full items-center gap-3 rounded-sm border border-border p-2 text-left">
                <AttachmentThumb a={a} size="h-12 w-12" />
                <span className="flex min-w-0 flex-1 flex-col"><span className="font-mono text-sm text-text-muted">{a.code}</span><span className="truncate font-bold">{a.title}</span></span>
                <Plus aria-hidden="true" size={20} className="text-primary" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  );
}

export default function OutfitDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { permissions } = useSession();
  const q = useQuery({ queryKey: ['outfit', id], queryFn: () => api('GET', `/outfits/${id}`).then((r) => r.data), enabled: Boolean(permissions?.admin) });
  const refresh = useRefresh(id);
  const [sheet, setSheet] = useState(null); // {kind, item}
  const [confirm, setConfirm] = useState(false);
  if (!permissions?.admin) return <Screen title={t('workspace.title')} back="/workspaces"><Notice>{t('workspace.onlyAdmins')}</Notice></Screen>;
  if (q.isPending) return <Screen title={t('workspace.title')} back="/workspaces"><p aria-busy="true">…</p></Screen>;
  if (q.isError) return <Screen title={t('workspace.title')} back="/workspaces"><Notice kind="danger">{q.error.message || t('errors.loadFailed')}</Notice></Screen>;
  const o = q.data;
  const back = o.workspace ? `/workspaces/${o.workspace.id}` : '/workspaces';
  const done = o.steps.filter((s) => s.done).length;
  const step = sheet?.kind === 'step' ? o.steps.find((s) => s.id === sheet.id) : null;
  const acc = sheet?.kind === 'acc' ? o.accessories.find((a) => a.id === sheet.id) : null;
  const decor = o.person === 'decor';
  const L = decor
    ? { accessories: t('decor.props'), addAccessory: t('decor.addProp'), accessoryName: t('decor.propName'), deleteAccessory: t('decor.deleteProp'), delete: t('decor.delete'), deleteBody: t('decor.deleteBody'), rename: t('decor.rename'), nameLabel: t('decor.nameLabel') }
    : { accessories: t('outfit.accessories'), addAccessory: t('outfit.addAccessory'), accessoryName: t('outfit.accessoryName'), deleteAccessory: t('outfit.deleteAccessory'), delete: t('outfit.delete'), deleteBody: t('outfit.deleteBody'), rename: t('outfit.rename'), nameLabel: t('outfit.nameLabel') };

  async function setVendor(vendorId) {
    try {
      await withRelogin(() => api('PATCH', `/outfits/${id}`, { body: { vendorId: vendorId || null }, ifMatch: o.version, idemKey: newIdemKey() }));
      refresh();
    } catch (e) { showToast(e.message || t('errors.server')); }
  }

  async function remove() {
    setConfirm(false);
    try {
      const res = await withRelogin(() => api('DELETE', `/outfits/${id}`, { ifMatch: o.version, idemKey: newIdemKey() }));
      qc.invalidateQueries({ queryKey: ['workspace'] });
      if (res.meta.undo) showUndo({ batchId: res.meta.undo.batchId, summary: res.meta.undo.summary });
      navigate(back, { replace: true });
    } catch (e) { showToast(e.message || t('errors.server')); }
  }

  return (
    <Screen title={o.title} back={back}
      actions={<button type="button" onClick={() => setSheet({ kind: 'rename' })} aria-label={L.rename} className="tap grid place-items-center text-primary"><Pencil aria-hidden="true" size={22} /></button>}>
      <p className="text-text-muted">{o.workspace?.name} · {t(`outfit.persons.${o.person}`)}</p>
      <VendorSelect value={o.vendor?.id ?? ''} onChange={setVendor} />

      <section aria-labelledby="o-timeline" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 id="o-timeline" className="text-lg font-bold">{t('outfit.timeline')}</h2>
          <span className="text-sm text-text-muted">{t('outfit.stepsDone', { done, total: o.steps.length })}</span>
        </div>
        <ol className="flex flex-col gap-0" aria-label={t('outfit.timeline')}>
          {o.steps.map((s, i) => (
            <li key={s.id} className="flex items-stretch gap-3">
              <span className="flex flex-col items-center" aria-hidden="true">
                <span className={`grid size-8 place-items-center rounded-full border-2 ${s.done ? 'border-success bg-success text-on-primary' : 'border-border-strong bg-surface'}`}>{s.done ? <Check size={18} /> : i + 1}</span>
                {i < o.steps.length - 1 && <span className={`w-0.5 flex-1 ${s.done ? 'bg-success' : 'bg-border'}`} />}
              </span>
              <button type="button" onClick={() => setSheet({ kind: 'step', id: s.id })} className="tap mb-2 flex flex-1 items-center justify-between rounded-md bg-surface px-3 text-left shadow-card"
                aria-label={`${s.name}, ${s.done ? `${t('outfit.doneOn')} ${formatDateOnly(s.doneOn)}` : t('outfit.notDone')}`}>
                <span className="flex flex-col"><span className="font-bold">{s.name}</span><span className="text-sm text-text-muted">{s.done ? short(s.doneOn) : t('outfit.notDone')}</span></span>
                <ChevronRight aria-hidden="true" size={20} className="text-text-muted" />
              </button>
            </li>
          ))}
        </ol>
        <Button variant="secondary" needsInternet onClick={() => setSheet({ kind: 'addStep' })}><Plus aria-hidden="true" size={20} />{t('outfit.addStep')}</Button>
      </section>

      <section aria-labelledby="o-mood" className="flex flex-col gap-3 rounded-md bg-surface p-4 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <h2 id="o-mood" className="text-lg font-bold">{t('outfit.moodboard')}</h2>
          <Button variant="text" onClick={() => setSheet({ kind: 'pick' })}><Archive aria-hidden="true" size={18} />{t('outfit.fromVault')}</Button>
        </div>
        <AttachBlock target={{ outfitId: o.id }} attachments={o.moodboard} refresh={refresh} grid />
      </section>

      <section aria-labelledby="o-acc" className="flex flex-col gap-3 rounded-md bg-surface p-4 shadow-card">
        <h2 id="o-acc" className="text-lg font-bold">{L.accessories}</h2>
        <ul className="-mx-4 border-t border-border">
          {o.accessories.map((a) => (
            <li key={a.id} className="border-b border-border">
              <button type="button" onClick={() => setSheet({ kind: 'acc', id: a.id })} className="flex min-h-14 w-full items-center gap-3 px-4 text-left">
                <span className="flex-1 font-bold">{a.name}</span>
                <span className="text-sm text-text-muted">{a.attachments.length ? `📎 ${a.attachments.length} ` : ''}{a.notes.length ? `📝 ${a.notes.length} ` : ''}{a.tasks.length ? `✓ ${a.tasks.length}` : ''}</span>
                <ChevronRight aria-hidden="true" size={20} className="text-text-muted" />
              </button>
            </li>
          ))}
        </ul>
        <Button variant="secondary" needsInternet onClick={() => setSheet({ kind: 'addAcc' })}><Plus aria-hidden="true" size={20} />{L.addAccessory}</Button>
      </section>

      <section aria-labelledby="o-notes" className="flex flex-col gap-3 rounded-md bg-surface p-4 shadow-card">
        <h2 id="o-notes" className="text-lg font-bold">{t('outfit.notes')}</h2>
        <NotesBlock target={{ outfitId: o.id }} notes={o.notes} refresh={refresh} />
      </section>

      <section aria-labelledby="o-tasks" className="flex flex-col gap-3 rounded-md bg-surface p-4 shadow-card">
        <h2 id="o-tasks" className="text-lg font-bold">{t('outfit.tasks')}</h2>
        <TasksBlock tasks={o.tasks} query={`outfit=${o.id}`} outfitId={o.id} />
      </section>

      <Button variant="danger" needsInternet onClick={() => setConfirm(true)}><Trash2 aria-hidden="true" size={20} />{L.delete}</Button>
      {o.workspace && <Link to={back} className="tap self-start font-bold text-primary">← {o.workspace.name}</Link>}

      {step && <StepSheet outfit={o} step={step} refresh={refresh} onClose={() => setSheet(null)} />}
      {acc && <AccessorySheet outfit={o} acc={acc} refresh={refresh} L={L} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'pick' && <VaultPickSheet outfit={o} refresh={refresh} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'addStep' && <NameSheet title={t('outfit.addStep')} label={t('outfit.stepName')} max={60} onClose={() => setSheet(null)}
        onSave={(name) => withRelogin(() => api('POST', `/outfits/${o.id}/steps`, { body: { name }, idemKey: newIdemKey() })).then(refresh)} />}
      {sheet?.kind === 'addAcc' && <NameSheet title={L.addAccessory} label={L.accessoryName} onClose={() => setSheet(null)}
        onSave={(name) => withRelogin(() => api('POST', `/outfits/${o.id}/accessories`, { body: { name }, idemKey: newIdemKey() })).then(refresh)} />}
      {sheet?.kind === 'rename' && <NameSheet title={L.rename} label={L.nameLabel} initial={o.title} onClose={() => setSheet(null)}
        onSave={(title) => withRelogin(() => api('PATCH', `/outfits/${o.id}`, { body: { title }, ifMatch: o.version, idemKey: newIdemKey() })).then(refresh)} />}
      {confirm && <ConfirmDialog title={L.delete} body={L.deleteBody} confirmLabel={L.delete} danger onConfirm={remove} onCancel={() => setConfirm(false)} />}
    </Screen>
  );
}
