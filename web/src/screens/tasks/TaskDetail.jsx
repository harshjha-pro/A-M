// One task (FEATURES B3): status, due, people, tags, checklist (tick with the item's
// version; "Mark the task done too?" after the last tick), Move date, WhatsApp to
// each assignee, History, Edit, Delete with Undo.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarArrowUp, CheckCircle2, History, MessageCircle, Pencil, Trash2, X, Plus } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import Button from '../../components/Button.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import { Notice } from '../../components/Field.jsx';
import { api, newIdemKey } from '../../api/client.js';
import { withRelogin } from '../../api/auth.js';
import { saveViaOutbox } from '../../offline/outbox.js';
import WaitingMark from '../../components/WaitingMark.jsx';
import { useSession } from '../../api/session.js';
import { showUndo, showToast } from '../../undo/undoStore.js';
import { markDone } from './TaskList.jsx';
import PostponeSheet from './PostponeSheet.jsx';
import { dueText, waLink, isClosed } from '../../data/tasks.js';
import { formatDateTime } from '../../format/ist.js';
import { t } from '../../i18n/strings.en.js';

export default function TaskDetail() {
  const { id } = useParams();
  const { permissions } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['task', id], queryFn: () => api('GET', `/tasks/${id}`).then((r) => r.data) });
  const members = useQuery({ queryKey: ['members'], queryFn: () => api('GET', '/members').then((r) => r.data) });
  const [moving, setMoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [askDone, setAskDone] = useState(false);
  const [itemText, setItemText] = useState('');
  const task = q.data;
  const canEdit = Boolean(permissions?.edit);

  if (q.isPending) return <Screen title={t('tasks.title')} back="/tasks"><p aria-busy="true">…</p></Screen>;
  if (q.isError) return <Screen title={t('tasks.title')} back="/tasks"><Notice kind="danger">{q.error.message || t('errors.loadFailed')}</Notice></Screen>;

  const queuedNote = (res) => { if (res.queued) showToast(t('outbox.queuedToast')); };
  const refresh = (data) => { qc.setQueryData(['task', id], data); qc.invalidateQueries({ queryKey: ['tasks'] }); };
  const run = async (fn) => {
    setBusy(true);
    try { return await withRelogin(fn); } catch (e) { showToast(e.message || t('errors.server')); qc.invalidateQueries({ queryKey: ['task', id] }); return null; } finally { setBusy(false); }
  };

  async function move(date) {
    const idemKey = newIdemKey();
    const res = await run(() => saveViaOutbox('PATCH', `/tasks/${id}`, { body: { dueDate: date }, ifMatch: task.version, idemKey, base: task, label: t('outbox.label.taskMove', { title: task.title }) }));
    if (res) { queuedNote(res); refresh(res.data); setMoving(false); }
  }

  async function tick(item) {
    const idemKey = newIdemKey();
    const res = await run(() => saveViaOutbox('PATCH', `/tasks/${id}/items/${item.key}`, { body: { isDone: !item.isDone }, ifMatch: item.version, idemKey, base: item, label: t('outbox.label.itemTick', { text: item.text }) }));
    if (!res) return;
    queuedNote(res);
    qc.setQueryData(['task', id], { ...task, items: task.items.map((i) => (i.key === item.key ? res.data : i)) });
    qc.invalidateQueries({ queryKey: ['tasks'] });
    if (res.meta.lastItemDone) setAskDone(true);
  }

  async function addItem(e) {
    e.preventDefault();
    const text = itemText.trim();
    if (!text) return;
    const key = newIdemKey();
    const res = await run(() => saveViaOutbox('POST', `/tasks/${id}/items`, { body: { key, text }, idemKey: key, label: t('outbox.label.itemAdd', { text }) }));
    if (res) { queuedNote(res); setItemText(''); qc.setQueryData(['task', id], { ...task, items: [...task.items, res.data] }); }
  }

  async function removeItem(item) {
    const res = await run(() => api('DELETE', `/tasks/${id}/items/${item.key}`, { ifMatch: item.version, idemKey: newIdemKey() }));
    if (!res) return;
    qc.setQueryData(['task', id], { ...task, items: task.items.filter((i) => i.key !== item.key) });
    if (res.meta.undo) showUndo({ batchId: res.meta.undo.batchId, summary: res.meta.undo.summary, onUndone: () => qc.invalidateQueries({ queryKey: ['task', id] }) });
  }

  async function remove() {
    const res = await run(() => api('DELETE', `/tasks/${id}`, { ifMatch: task.version, idemKey: newIdemKey() }));
    if (!res) return;
    qc.invalidateQueries({ queryKey: ['tasks'] });
    if (res.meta.undo) showUndo({ batchId: res.meta.undo.batchId, summary: res.meta.undo.summary });
    navigate('/tasks', { replace: true });
  }

  async function done() {
    setAskDone(false);
    setBusy(true);
    const data = await markDone(qc, task);
    setBusy(false);
    if (data) qc.setQueryData(['task', id], data);
  }

  const phone = Object.fromEntries((members.data ?? []).map((m) => [m.id, m.phone]));
  const closed = isClosed(task);
  return (
    <Screen title={task.title} back="/tasks">
      <section className="flex flex-col gap-3 rounded-md bg-surface p-4 shadow-card">
        <p className="flex flex-wrap gap-2">
          <span className="rounded-full bg-bg px-3 py-1 font-bold">{t(`tasks.status.${task.status}`)}</span>
          {task.priority !== 'normal' && <span className={`rounded-full px-3 py-1 ${task.priority === 'urgent' ? 'bg-danger-soft text-danger' : 'bg-bg text-text-muted'}`}>{t(`tasks.priority.${task.priority}`)}</span>}
          {task.overdue && <span className="rounded-full bg-danger-soft px-3 py-1 font-bold text-danger">{t('tasks.overdue')}</span>}
          {task.postponeCount > 0 && <span className="rounded-full bg-warning-soft px-3 py-1">{t('tasks.postponed', { n: task.postponeCount })}</span>}
          <WaitingMark entity={`/tasks/${task.id}`} className="px-1 py-1" />
        </p>
        <dl className="flex flex-col gap-2">
          <div><dt className="text-sm text-text-muted">{t('tasks.due')}</dt><dd className="text-lg">{dueText(task)}</dd></div>
          <div><dt className="text-sm text-text-muted">{t('tasks.assignees')}</dt><dd className="text-lg">{task.assignees.map((a) => a.name + (a.left ? ' (left)' : '')).join(', ') || '—'}</dd></div>
          {task.tags.length > 0 && <div><dt className="text-sm text-text-muted">{t('tasks.tags')}</dt><dd>{task.tags.map((g) => g.name).join(', ')}</dd></div>}
          {(task.event || task.vendor || task.household) && (
            <div><dt className="text-sm text-text-muted">{t('tasks.linked')}</dt>
              <dd>{[task.event, task.vendor, task.household].filter(Boolean).map((r) => r.name + (r.deleted ? ' (deleted)' : '')).join(' · ')}</dd></div>
          )}
          {task.notes && <div><dt className="text-sm text-text-muted">{t('tasks.notes')}</dt><dd className="whitespace-pre-line break-words">{task.notes}</dd></div>}
          {task.status === 'done' && task.completedBy && <div><dd className="text-success">{t('tasks.doneBy', { name: task.completedBy.name })} · {formatDateTime(task.completedAt)}</dd></div>}
        </dl>
      </section>

      {canEdit && !closed && (
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={done} disabled={busy}><CheckCircle2 aria-hidden="true" size={20} />{t('tasks.markDoneButton')}</Button>
          <Button variant="secondary" onClick={() => setMoving(true)} disabled={busy}><CalendarArrowUp aria-hidden="true" size={20} />{t('tasks.moveDate')}</Button>
        </div>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">{t('tasks.checklist')}</h2>
        {task.items.length > 0 && (
          <ul className="overflow-hidden rounded-md bg-surface shadow-card">
            {task.items.map((item) => (
              <li key={item.key} className="flex items-center gap-2 border-b border-border px-3 last:border-b-0">
                <label className="tap flex flex-1 cursor-pointer items-center gap-3 py-2">
                  <input type="checkbox" checked={item.isDone} disabled={!canEdit || busy} onChange={() => tick(item)} className="size-6 shrink-0 accent-[var(--c-primary)]" />
                  <span className={item.isDone ? 'text-text-muted line-through' : ''}>{item.text}</span>
                </label>
                {canEdit && (
                  <button type="button" onClick={() => removeItem(item)} disabled={busy} aria-label={t('tasks.removeItem', { text: item.text })} className="tap flex items-center justify-center px-2 text-text-muted">
                    <X aria-hidden="true" size={20} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <form onSubmit={addItem} className="flex gap-2">
            <label className="flex-1">
              <span className="sr-only">{t('tasks.addItem')}</span>
              <input value={itemText} onChange={(e) => setItemText(e.target.value)} maxLength={200} placeholder={t('tasks.itemPlaceholder')}
                className="tap w-full rounded-sm border-[1.5px] border-border-strong bg-surface px-3 text-base text-text" />
            </label>
            <Button type="submit" variant="secondary" disabled={busy || !itemText.trim()}><Plus aria-hidden="true" size={20} />{t('tasks.addItem')}</Button>
          </form>
        )}
      </section>

      {task.assignees.some((a) => phone[a.id]) && (
        <section className="flex flex-col gap-2">
          {task.assignees.filter((a) => phone[a.id]).map((a) => (
            <a key={a.id} href={waLink(phone[a.id], task)} target="_blank" rel="noopener noreferrer"
              className="tap inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-border-strong bg-surface px-4">
              <MessageCircle aria-hidden="true" size={20} /> {t('tasks.whatsapp', { name: a.name })}
            </a>
          ))}
        </section>
      )}

      <div className="flex flex-col gap-3">
        <Link to={`/history/tasks/${id}`} className="tap inline-flex items-center justify-center gap-2 font-bold text-primary"><History aria-hidden="true" size={20} />{t('tasks.history')}</Link>
        {canEdit && <Button variant="secondary" onClick={() => navigate(`/tasks/${id}/edit`)}><Pencil aria-hidden="true" size={20} />{t('tasks.edit')}</Button>}
        {canEdit && <Button needsInternet variant="danger" onClick={remove} disabled={busy}><Trash2 aria-hidden="true" size={20} />{t('tasks.delete')}</Button>}
      </div>

      {moving && <PostponeSheet task={task} saving={busy} onPick={move} onClose={() => setMoving(false)} />}
      {askDone && (
        <ConfirmDialog title={t('tasks.allTickedAsk')} confirmLabel={t('tasks.yesDone')} cancelLabel={t('tasks.notYet')} onConfirm={done} onCancel={() => setAskDone(false)} />
      )}
    </Screen>
  );
}
