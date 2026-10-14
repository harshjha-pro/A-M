// One attachment (1.0.17): preview (photo, video, document, link, text), its editable
// unique ID and details, where it is used (tap to go there; remove from one place with
// Undo), use it in another workspace section, delete everywhere (Undo). History below.
import { canSeeWorkspace } from '../../api/workspaceAccess.js';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Star, Trash2, X } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import Button from '../../components/Button.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import HistoryList from '../../components/HistoryList.jsx';
import { TextField, Toggle, Notice } from '../../components/Field.jsx';
import { api, newIdemKey } from '../../api/client.js';
import { withRelogin } from '../../api/auth.js';
import { ValidationError } from '../../api/errors.js';
import { useSession } from '../../api/session.js';
import { showUndo, showToast } from '../../undo/undoStore.js';
import { useWorkspaces, SECTIONS, formatBytes } from '../../data/vault.js';
import { CodeField, VendorSelect } from './AttachmentAddSheet.jsx';
import { AttachmentThumb } from './AttachmentRow.jsx';
import { t } from '../../i18n/strings.en.js';

function Preview({ a }) {
  if (a.kind === 'video' && a.fileUrl) return <video src={a.fileUrl} controls playsInline preload="metadata" className="w-full rounded-md bg-black" />;
  if (a.fileUrl && a.file?.mimeType?.startsWith('image/')) return <img src={a.fileUrl} alt={a.title} className="w-full rounded-md bg-surface-2 object-contain" />;
  if (a.kind === 'text') return <p className="whitespace-pre-wrap rounded-md bg-surface p-4 shadow-card">{a.body}</p>;
  return (
    <div className="flex items-center gap-3 rounded-md bg-surface p-4 shadow-card">
      <AttachmentThumb a={a} />
      <span className="flex min-w-0 flex-col">
        {a.url && <a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all font-bold text-primary">{a.url}<ExternalLink aria-hidden="true" size={16} /></a>}
        {a.fileUrl && <a href={a.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-primary">{a.file?.name || t('vault.open')}<ExternalLink aria-hidden="true" size={16} /></a>}
        {a.file && <span className="text-sm text-text-muted">{formatBytes(a.file.sizeBytes)}</span>}
      </span>
    </div>
  );
}

export default function AttachmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { permissions } = useSession();
  const q = useQuery({ queryKey: ['attachment', id], queryFn: () => api('GET', `/attachments/${id}`).then((r) => r.data), enabled: canSeeWorkspace(permissions) });
  const workspaces = useWorkspaces();
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [place, setPlace] = useState({ ws: '', section: 'general' });
  const a = q.data;
  if (!canSeeWorkspace(permissions)) return <Screen title={t('vault.title')} back="/more"><Notice>{t('workspace.onlyAdmins')}</Notice></Screen>;
  if (q.isPending) return <Screen title={t('vault.title')} back="/vault"><p aria-busy="true">…</p></Screen>;
  if (q.isError) return <Screen title={t('vault.title')} back="/vault"><Notice kind="danger">{q.error.message || t('errors.loadFailed')}</Notice></Screen>;
  const refresh = () => { qc.invalidateQueries({ queryKey: ['attachment', id] }); qc.invalidateQueries({ queryKey: ['attachments'] }); qc.invalidateQueries({ queryKey: ['workspace'] }); };
  const f = form ?? { code: a.code, title: a.title, note: a.note ?? '', url: a.url ?? '', body: a.body ?? '', isFavourite: a.isFavourite, vendorId: a.vendor?.id ?? '' };
  const set = (k) => (v) => setForm({ ...f, [k]: v });

  async function save() {
    const changed = {};
    if (f.code.trim() !== a.code) changed.code = f.code.trim();
    if (f.title.trim() !== a.title) changed.title = f.title.trim();
    if ((f.note || null) !== (a.note || null)) changed.note = f.note || null;
    if (a.kind === 'link' || a.kind === 'video') { if ((f.url || null) !== (a.url || null)) changed.url = f.url || null; }
    if (a.kind === 'text' && f.body !== a.body) changed.body = f.body;
    if (f.isFavourite !== a.isFavourite) changed.isFavourite = f.isFavourite;
    if ((f.vendorId || null) !== (a.vendor?.id ?? null)) changed.vendorId = f.vendorId || null;
    if (!Object.keys(changed).length) { setForm(null); return; }
    setSaving(true);
    try {
      const res = await withRelogin(() => api('PATCH', `/attachments/${id}`, { body: changed, ifMatch: a.version, idemKey: newIdemKey() }));
      qc.setQueryData(['attachment', id], res.data); // show the saved version at once
      setForm(null); setErrors({}); showToast(t('vault.saved')); refresh();
    } catch (e) {
      if (e instanceof ValidationError) setErrors(e.fields); else showToast(e.message || t('errors.server'));
    } finally { setSaving(false); }
  }

  async function unlink(u) {
    try {
      const res = await withRelogin(() => api('DELETE', `/attachment-links/${u.linkId}`, { ifMatch: u.linkVersion, idemKey: newIdemKey() }));
      if (res.meta.undo) showUndo({ batchId: res.meta.undo.batchId, summary: res.meta.undo.summary, onUndone: refresh });
      refresh();
    } catch (e) { showToast(e.message || t('errors.server')); }
  }

  async function linkHere() {
    if (!place.ws) return;
    try {
      await withRelogin(() => api('POST', `/attachments/${id}/links`, { body: { workspaceId: place.ws, section: place.section }, idemKey: newIdemKey() }));
      refresh();
    } catch (e) { showToast(e.message || t('errors.server')); }
  }

  async function remove() {
    setConfirm(false);
    try {
      const res = await withRelogin(() => api('DELETE', `/attachments/${id}`, { ifMatch: a.version, idemKey: newIdemKey() }));
      qc.invalidateQueries({ queryKey: ['attachments'] });
      if (res.meta.undo) showUndo({ batchId: res.meta.undo.batchId, summary: res.meta.undo.summary });
      navigate('/vault', { replace: true });
    } catch (e) { showToast(e.message || t('errors.server')); }
  }

  return (
    <Screen title={a.title} back="/vault">
      <p className="flex items-center gap-2 text-text-muted"><span className="font-mono font-bold text-text">{a.code}</span> · {t(`vault.kinds.${a.kind}`)}
        {a.isFavourite && <Star aria-label={t('vault.favourite')} size={16} className="fill-current text-warning" />}</p>
      <Preview a={a} />
      {a.document && <Notice>{t('vault.inDocuments')} <Link className="font-bold text-primary underline" to={`/documents/${a.document.id}`}>{t('vault.openDocument')}</Link></Notice>}

      <section aria-labelledby="used" className="flex flex-col gap-2 rounded-md bg-surface p-4 shadow-card">
        <h2 id="used" className="text-lg font-bold">{t('vault.usedIn')}</h2>
        {a.usedIn.length === 0 && <p className="text-text-muted">{t('vault.notLinked')}</p>}
        <ul className="flex flex-col gap-1">
          {a.usedIn.map((u) => (
            <li key={u.linkId ?? u.path} className="flex items-center justify-between gap-2">
              <Link to={u.to} className="tap inline-flex items-center font-bold text-primary underline-offset-4 hover:underline">{u.path}</Link>
              {u.linkId && (
                <button type="button" onClick={() => unlink(u)} aria-label={t('vault.unlinkNamed', { path: u.path })}
                  className="tap grid min-h-12 min-w-12 place-items-center rounded-md border border-border text-danger"><X aria-hidden="true" size={18} /></button>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-col gap-2">
          <span className="font-bold">{t('vault.linkTo')}</span>
          <div className="grid grid-cols-2 gap-2">
            <select aria-label={t('vault.workspace')} value={place.ws} onChange={(e) => setPlace({ ...place, ws: e.target.value })} className="tap rounded-sm border-[1.5px] border-border-strong bg-surface px-2 text-base text-text">
              <option value="">{t('vault.workspace')}…</option>
              {(workspaces.data ?? []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <select aria-label={t('vault.section')} value={place.section} onChange={(e) => setPlace({ ...place, section: e.target.value })} className="tap rounded-sm border-[1.5px] border-border-strong bg-surface px-2 text-base text-text">
              {Object.entries(SECTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <Button variant="secondary" needsInternet disabled={!place.ws} onClick={linkHere}>{t('vault.link')}</Button>
        </div>
      </section>

      <section aria-labelledby="details" className="flex flex-col gap-3 rounded-md bg-surface p-4 shadow-card">
        <h2 id="details" className="text-lg font-bold">{t('vault.details')}</h2>
        <CodeField value={f.code} onChange={set('code')} except={a.id} error={errors.code} />
        <TextField label={t('vault.titleLabel')} value={f.title} onChange={set('title')} error={errors.title} maxLength={160} />
        {(a.kind === 'link' || a.kind === 'video') && <TextField label={t('vault.url')} value={f.url} onChange={set('url')} error={errors.url} />}
        {a.kind === 'text' && (
          <label className="flex flex-col gap-1"><span className="font-bold">{t('vault.body')}</span>
            <textarea value={f.body} onChange={(e) => set('body')(e.target.value)} rows={4} className="rounded-sm border-[1.5px] border-border-strong bg-surface p-3 text-base text-text" /></label>
        )}
        <TextField label={t('vault.note')} value={f.note} onChange={set('note')} />
        <VendorSelect value={f.vendorId} onChange={set('vendorId')} />
        <Toggle label={t('vault.favourite')} checked={f.isFavourite} onChange={set('isFavourite')} />
        <Button needsInternet onClick={save} loading={saving}>{t('vault.save')}</Button>
      </section>

      {!a.document && <Button variant="danger" needsInternet onClick={() => setConfirm(true)}><Trash2 aria-hidden="true" size={20} />{t('vault.delete')}</Button>}
      <section className="flex flex-col gap-2"><h2 className="text-lg font-bold">{t('history.title')}</h2><HistoryList path={`/attachments/${id}/history`} /></section>
      {confirm && <ConfirmDialog title={t('vault.delete')} body={t('vault.deleteBody')} confirmLabel={t('vault.delete')} danger onConfirm={remove} onCancel={() => setConfirm(false)} />}
    </Screen>
  );
}
