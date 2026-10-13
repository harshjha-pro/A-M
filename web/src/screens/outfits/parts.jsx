// Pieces shared by the outfit page and its sheets (1.0.18): notes, attachments and tasks
// for one place (an outfit, an accessory or a timeline step).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import Button from '../../components/Button.jsx';
import { api, newIdemKey } from '../../api/client.js';
import { withRelogin } from '../../api/auth.js';
import { showUndo, showToast } from '../../undo/undoStore.js';
import { formatDateTime } from '../../format/ist.js';
import { AttachmentThumb } from '../vault/AttachmentRow.jsx';
import AttachmentAddSheet from '../vault/AttachmentAddSheet.jsx';
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

/** target: { outfitId } | { accessoryId } | { outfitStepId } */
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

export function AttachBlock({ target, attachments, refresh, grid = false }) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      {attachments.length === 0 && <p className="text-text-muted">{t('outfit.noAttachments')}</p>}
      {attachments.length > 0 && (
        <ul className={grid ? 'grid grid-cols-3 gap-2' : 'flex flex-col gap-2'}>
          {attachments.map((a) => (
            <li key={a.id}>
              <Link to={`/vault/${a.id}`} className={grid ? 'relative block' : 'flex items-center gap-3'} aria-label={`${a.code} ${a.title}`}>
                <AttachmentThumb a={a} size={grid ? 'aspect-square w-full' : 'h-12 w-12'} />
                {grid
                  ? <span className="absolute inset-x-0 bottom-0 truncate rounded-b-sm bg-black/55 px-1 text-xs text-white">{a.isFavourite ? '⭐ ' : ''}{a.title}</span>
                  : <span className="flex min-w-0 flex-col"><span className="font-mono text-sm text-text-muted">{a.code}{a.isFavourite ? ' ⭐' : ''}</span><span className="truncate font-bold">{a.title}</span></span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Button variant="secondary" needsInternet onClick={() => setAdding(true)}><Plus aria-hidden="true" size={20} />{t('vault.addHere')}</Button>
      {adding && <AttachmentAddSheet target={target} onClose={() => setAdding(false)} onAdded={refresh} />}
    </div>
  );
}

/** Tasks for one place, with Add task (the form comes back to the outfit page). */
export function TasksBlock({ tasks, query, outfitId }) {
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
      <Link to={`/tasks/new?${query}&back=${encodeURIComponent(`/outfits/${outfitId}`)}`} className="tap inline-flex items-center gap-1 self-start font-bold text-primary"><Plus aria-hidden="true" size={20} />{t('outfit.addTask')}</Link>
    </div>
  );
}
