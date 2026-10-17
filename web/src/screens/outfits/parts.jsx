// Pieces shared by the outfit page and its sheets (1.0.18): notes, attachments and tasks
// for one place (an outfit, an accessory or a timeline step).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Archive, CheckSquare, Unlink } from 'lucide-react';
import Button from '../../components/Button.jsx';
import { api, newIdemKey } from '../../api/client.js';
import { withRelogin } from '../../api/auth.js';
import { showUndo, showToast } from '../../undo/undoStore.js';
import { formatDateTime } from '../../format/ist.js';
import { AttachmentThumb } from '../vault/AttachmentRow.jsx';
import AttachmentAddSheet from '../vault/AttachmentAddSheet.jsx';
import VaultPickSheet from '../vault/VaultPickSheet.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import { bulkLinks } from '../../data/vault.js';
import { t } from '../../i18n/strings.en.js';

/** Re-read the outfit page and everything that shows its parts. */
export function useRefresh(outfitId) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['outfit', outfitId] });
    qc.invalidateQueries({ queryKey: ['workspace'] });
    qc.invalidateQueries({ queryKey: ['attachments'] });
    qc.invalidateQueries({ queryKey: ['tasks'] });
  };
}

/** target: { outfitId } | { accessoryId } | { outfitStepId } (notes); attachments also { menuItemId } (1.0.19) */
export function NotesBlock({ target, notes, refresh }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  async function add() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await withRelogin(() => api('POST', '/notes', { body: { ...target, body: text.trim() }, idemKey: newIdemKey() }));
      setText('');
      refresh();
    } catch (e) { showToast(e.message || t('errors.server')); } finally { setBusy(false); }
  }
  async function remove(n) {
    try {
      const res = await withRelogin(() => api('DELETE', `/notes/${n.id}`, { ifMatch: n.version, idemKey: newIdemKey() }));
      if (res.meta.undo) showUndo({ batchId: res.meta.undo.batchId, summary: res.meta.undo.summary, onUndone: refresh });
      refresh();
    } catch (e) { showToast(e.message || t('errors.server')); }
  }
  return (
    <div className="flex flex-col gap-2">
      {notes.length === 0 && <p className="text-text-muted">{t('outfit.noNotes')}</p>}
      <ul className="flex flex-col gap-2">
        {notes.map((n) => (
          <li key={n.id} className="flex items-start gap-2 rounded-sm bg-surface-2 p-3">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="whitespace-pre-wrap">{n.body}</span>
              <span className="text-sm text-text-muted">{n.createdBy?.name ?? ''} · {formatDateTime(n.createdAt)}</span>
            </span>
            <button type="button" onClick={() => remove(n)} aria-label={`${t('documents.delete')}: ${n.body.slice(0, 30)}`} className="tap grid min-h-12 min-w-12 place-items-center text-danger"><Trash2 aria-hidden="true" size={18} /></button>
          </li>
        ))}
      </ul>
      <label className="flex flex-col gap-1">
        <span className="sr-only">{t('outfit.addNote')}</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder={t('outfit.notePlaceholder')} aria-label={t('outfit.addNote')}
          className="rounded-sm border-[1.5px] border-border-strong bg-surface p-3 text-base text-text" />
      </label>
      <Button variant="secondary" needsInternet onClick={add} loading={busy} disabled={!text.trim()}><Plus aria-hidden="true" size={20} />{t('outfit.addNote')}</Button>
    </div>
  );
}

/** target for an outfit / accessory / step / dish, or place = { workspaceId, section } for a section's own board (1.0.19). */
/**
 * Attachments of one place. 1.0.24: "From Vault" picks many at once; Select → "Remove from here"
 * takes the chosen ones out of this place only (they stay in the Vault and anywhere else), one Undo.
 */
export function AttachBlock({ target = null, place = null, attachments, refresh, grid = false }) {
  const [sheet, setSheet] = useState(null); // add | pick | confirm
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const where = target ?? place ?? {};
  const toggle = (id) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const stop = () => { setSelecting(false); setPicked(new Set()); };

  async function remove() {
    setBusy(true);
    try {
      const res = await bulkLinks('remove', [...picked], where);
      if (res.meta.undo) showUndo({ batchId: res.meta.undo.batchId, summary: res.meta.undo.summary, onUndone: refresh });
      setSheet(null);
      stop();
      refresh?.();
    } catch (e) {
      showToast(e.message || t('errors.server'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {attachments.length === 0 && <p className="text-text-muted">{t('outfit.noAttachments')}</p>}
      {attachments.length > 0 && (
        <ul className={grid ? 'grid grid-cols-3 gap-2' : 'flex flex-col gap-2'}>
          {attachments.map((a) => (
            <li key={a.id}>
              {selecting ? (
                <label className={`relative flex cursor-pointer items-center gap-3 rounded-sm ${grid ? 'flex-col' : ''} ${picked.has(a.id) ? 'ring-2 ring-primary' : ''}`}>
                  <input type="checkbox" checked={picked.has(a.id)} onChange={() => toggle(a.id)} aria-label={t('bulk.choose', { name: a.title })}
                    className={`size-6 shrink-0 accent-[var(--c-primary)] ${grid ? 'absolute left-1 top-1 z-10' : ''}`} />
                  <AttachmentThumb a={a} size={grid ? 'aspect-square w-full' : 'h-12 w-12'} />
                  {!grid && <span className="truncate font-bold">{a.title}</span>}
                </label>
              ) : (
                <Link to={`/vault/${a.id}`} className={grid ? 'relative block' : 'flex items-center gap-3'} aria-label={`${a.code} ${a.title}`}>
                  <AttachmentThumb a={a} size={grid ? 'aspect-square w-full' : 'h-12 w-12'} />
                  {grid
                    ? <span className="absolute inset-x-0 bottom-0 truncate rounded-b-sm bg-black/55 px-1 text-xs text-white">{a.isFavourite ? '⭐ ' : ''}{a.title}</span>
                    : <span className="flex min-w-0 flex-col"><span className="font-mono text-sm text-text-muted">{a.code}{a.isFavourite ? ' ⭐' : ''}</span><span className="truncate font-bold">{a.title}</span></span>}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
      {selecting ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold" aria-live="polite">{t('bulk.selectedN', { n: picked.size })}</span>
          <Button variant="danger" needsInternet disabled={picked.size === 0} onClick={() => setSheet('confirm')}><Unlink aria-hidden="true" size={18} />{t('vault.removeHere')}</Button>
          <Button variant="text" onClick={stop}>{t('bulk.done')}</Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" needsInternet onClick={() => setSheet('add')}><Plus aria-hidden="true" size={20} />{t('vault.addHere')}</Button>
          <Button variant="text" needsInternet onClick={() => setSheet('pick')}><Archive aria-hidden="true" size={18} />{t('outfit.fromVault')}</Button>
          {attachments.length > 0 && <Button variant="text" onClick={() => setSelecting(true)}><CheckSquare aria-hidden="true" size={18} />{t('tasks.select')}</Button>}
        </div>
      )}
      {sheet === 'add' && <AttachmentAddSheet target={target} workspaceId={place?.workspaceId} section={place?.section} onClose={() => setSheet(null)} onAdded={refresh} />}
      {sheet === 'pick' && <VaultPickSheet place={where} here={attachments.map((a) => a.id)} onClose={() => setSheet(null)} onDone={refresh} />}
      {sheet === 'confirm' && (
        <ConfirmDialog title={t('vault.removeHereTitle', { n: picked.size })} body={t('vault.removeHereBody')} confirmLabel={t('vault.removeHere')}
          danger onConfirm={busy ? () => {} : remove} onCancel={() => setSheet(null)} />
      )}
    </div>
  );
}

/** Tasks for one place, with Add task (the form comes back to the outfit page, or to `back`). */
export function TasksBlock({ tasks, query, outfitId, back = null }) {
  return (
    <div className="flex flex-col gap-2">
      {tasks.length === 0 && <p className="text-text-muted">{t('outfit.noTasks')}</p>}
      <ul className="flex flex-col gap-1">
        {tasks.map((task) => (
          <li key={task.id}>
            <Link to={`/tasks/${task.id}`} className={`tap flex items-center justify-between gap-2 rounded-sm px-2 ${task.status === 'done' ? 'text-text-muted line-through' : ''}`}>
              <span className="truncate">{task.title}</span>
              {task.overdue && <span className="text-sm font-bold text-danger">{t('tasks.overdue')}</span>}
            </Link>
          </li>
        ))}
      </ul>
      <Link to={`/tasks/new?${query}&back=${encodeURIComponent(back ?? `/outfits/${outfitId}`)}`} className="tap inline-flex items-center gap-1 self-start font-bold text-primary"><Plus aria-hidden="true" size={20} />{t('outfit.addTask')}</Link>
    </div>
  );
}
