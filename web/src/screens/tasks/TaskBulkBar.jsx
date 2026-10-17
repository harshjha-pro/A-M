// Tasks select mode (1.0.24, admin-operations brief §6): one change for the chosen tasks,
// previewed first, one request, one Undo; tasks someone changed after the list loaded, or a
// Family member may not delete, are listed with why. Viewers never get here.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CircleCheck, ListTodo, Flag, CalendarDays, UserPlus, UserMinus, Tag, Tags, PartyPopper, LayoutGrid, FileDown, Trash2 } from 'lucide-react';
import Sheet from '../../components/Sheet.jsx';
import Button from '../../components/Button.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import { BulkButton } from '../../components/SelectBar.jsx';
import BulkResult from '../../components/BulkResult.jsx';
import { ChoiceChips } from '../../components/Field.jsx';
import { MultiChips } from '../../components/ChipFilter.jsx';
import { api, newIdemKey, API_BASE } from '../../api/client.js';
import { withRelogin } from '../../api/auth.js';
import { canEditWorkspace } from '../../api/workspaceAccess.js';
import { showUndo, showToast } from '../../undo/undoStore.js';
import { useTags } from './TaskList.jsx';
import { formatCount } from '../../format/inr.js';
import { t } from '../../i18n/strings.en.js';

const STATUSES = ['todo', 'doing', 'waiting', 'done', 'cancelled'];
const PRIORITIES = ['urgent', 'normal', 'low'];
export const TASK_BULK_MAX = 500;

const ACTIONS = [
  { key: 'done', Icon: CircleCheck },
  { key: 'set_status', Icon: ListTodo },
  { key: 'set_priority', Icon: Flag },
  { key: 'set_due', Icon: CalendarDays },
  { key: 'add_assignees', Icon: UserPlus },
  { key: 'remove_assignees', Icon: UserMinus },
  { key: 'add_tags', Icon: Tag },
  { key: 'remove_tags', Icon: Tags },
  { key: 'set_event', Icon: PartyPopper },
  { key: 'set_workspace', Icon: LayoutGrid, workspace: true },
];

export default function TaskBulkBar({ ids, asOf, permissions, onDone }) {
  const [action, setAction] = useState(null);
  const [value, setValue] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const members = useQuery({ queryKey: ['members'], queryFn: () => api('GET', '/members').then((r) => r.data), enabled: Boolean(action?.includes('assignees')) });
  const tags = useTags();
  const events = useQuery({ queryKey: ['events'], queryFn: () => api('GET', '/events').then((r) => r.data), staleTime: 60_000, enabled: action === 'set_event' });
  const workspaces = useQuery({ queryKey: ['workspaces'], queryFn: () => api('GET', '/workspaces').then((r) => r.data), staleTime: 60_000, enabled: action === 'set_workspace' });
  const n = ids.length;
  const tooMany = n > TASK_BULK_MAX;

  const open = (key) => {
    setAction(key);
    setValue({ set_status: 'doing', set_priority: 'urgent', set_due: '', set_event: '', set_workspace: '' }[key] ?? (key.endsWith('s') ? [] : null));
  };

  // What the preview says will change, in plain words.
  const what = () => {
    const name = (list, id) => (list ?? []).find((x) => x.id === id)?.name;
    switch (action) {
      case 'done': return t('tasks.bulk.whatDone');
      case 'set_status': return `${t('tasks.statusLabel')} → ${t(`tasks.status.${value}`)}`;
      case 'set_priority': return `${t('tasks.priorityLabel')} → ${t(`tasks.priority.${value}`)}`;
      case 'set_due': return `${t('tasks.due')} → ${value || t('tasks.noDate')}`;
      case 'set_event': return `${t('tasks.event')} → ${name(events.data, value) || t('tasks.noEvent')}`;
      case 'set_workspace': return `${t('workspace.title')} → ${name(workspaces.data, value) || t('tasks.bulk.noWorkspace')}`;
      case 'add_assignees': case 'remove_assignees':
        return `${t(`tasks.bulk.${action}`)}: ${(value ?? []).map((id) => name(members.data, id)).filter(Boolean).join(', ') || '—'}`;
      case 'add_tags': case 'remove_tags':
        return `${t(`tasks.bulk.${action}`)}: ${(value ?? []).map((id) => name(tags.data, id)).filter(Boolean).join(', ') || '—'}`;
      default: return '';
    }
  };

  async function apply() {
    setBusy(true);
    const body = { action, ids, asOf };
    const field = { set_status: 'status', set_priority: 'priority', set_due: 'dueDate', set_event: 'eventId', set_workspace: 'workspaceId',
      add_assignees: 'assigneeIds', remove_assignees: 'assigneeIds', add_tags: 'tagIds', remove_tags: 'tagIds' }[action];
    if (field) body[field] = ['set_due', 'set_event', 'set_workspace'].includes(action) ? (value || null) : value;
    try {
      const res = await withRelogin(() => api('POST', '/tasks/bulk', { body, idemKey: newIdemKey() }));
      setAction(null);
      if (res.meta.undo) showUndo({ batchId: res.meta.undo.batchId, summary: res.meta.undo.summary, onUndone: onDone });
      else showToast(t('bulk.nothing'));
      if (res.data.skipped.length > 0) setResult(res.data);
      onDone();
    } catch (e) {
      showToast(e.message || t('errors.server'));
    } finally {
      setBusy(false);
    }
  }

  const needsPick = ['add_assignees', 'remove_assignees', 'add_tags', 'remove_tags'].includes(action) && !(value ?? []).length;
  const memberOptions = (members.data ?? []).filter((m) => m.isActive !== false && m.role !== 'viewer').map((m) => ({ value: m.id, label: m.name }));
  const tagOptions = (tags.data ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)).map((g) => ({ value: g.id, label: g.name }));
  const select = (list, none) => (
    <select value={value ?? ''} onChange={(e) => setValue(e.target.value)} aria-label={t(`tasks.bulk.${action}`)}
      className="tap rounded-sm border-[1.5px] border-border-strong bg-surface px-3 text-base text-text">
      <option value="">{none}</option>
      {(list ?? []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
    </select>
  );

  return (
    <>
      <div role="toolbar" aria-label={t('bulk.pick')} className="flex flex-wrap gap-2">
        {ACTIONS.filter((a) => !a.workspace || canEditWorkspace(permissions)).map(({ key, Icon }) => (
          <BulkButton key={key} Icon={Icon} label={t(`tasks.bulk.${key}`)} disabled={n === 0 || tooMany} onClick={() => open(key)} />
        ))}
        {n > 0 && !tooMany && (
          <a href={`${API_BASE}/tasks/export?ids=${ids.join(',')}`} download className="tap inline-flex items-center gap-2 rounded-full border-[1.5px] border-border bg-surface px-4 font-bold">
            <FileDown aria-hidden="true" size={18} /> {t('bulk.exportSelected')}
          </a>
        )}
        <BulkButton Icon={Trash2} label={t('bulk.delete')} danger disabled={n === 0 || tooMany} onClick={() => open('delete')} />
      </div>
      {tooMany && <p role="alert" className="font-bold text-danger">{t('tasks.bulk.tooMany', { max: TASK_BULK_MAX })}</p>}
      {action && action !== 'delete' && (
        <Sheet title={t(`tasks.bulk.${action}`)} onClose={() => setAction(null)}>
          <div className="flex flex-col gap-4">
            {action === 'set_status' && <ChoiceChips label={t('tasks.statusLabel')} value={value} onChange={setValue} options={STATUSES.map((s) => ({ value: s, label: t(`tasks.status.${s}`) }))} />}
            {action === 'set_priority' && <ChoiceChips label={t('tasks.priorityLabel')} value={value} onChange={setValue} options={PRIORITIES.map((s) => ({ value: s, label: t(`tasks.priority.${s}`) }))} />}
            {action === 'set_due' && (
              <label className="flex flex-col gap-1">
                <span className="font-bold">{t('tasks.due')}</span>
                <input type="date" value={value ?? ''} onChange={(e) => setValue(e.target.value)} className="tap rounded-sm border-[1.5px] border-border-strong bg-surface px-3 text-base text-text" />
                <span className="text-sm text-text-muted">{t('tasks.bulk.dueHelp')}</span>
              </label>
            )}
            {action === 'set_event' && select(events.data, t('tasks.noEvent'))}
            {action === 'set_workspace' && select(workspaces.data, t('tasks.bulk.noWorkspace'))}
            {action.includes('assignees') && <MultiChips label={t('tasks.assignees')} options={memberOptions} value={value ?? []} onChange={setValue} />}
            {action.includes('tags') && <MultiChips label={t('tasks.tags')} options={tagOptions} value={value ?? []} onChange={setValue} />}
            <p className="rounded-md bg-surface-2 p-3" role="status">{t('bulk.preview', { n: t('tasks.bulk.nTasks', { n: formatCount(n) }), what: what() })}</p>
            <Button needsInternet onClick={apply} loading={busy} disabled={needsPick}>{t('bulk.apply', { n: formatCount(n) })}</Button>
          </div>
        </Sheet>
      )}
      {action === 'delete' && (
        <ConfirmDialog title={t('tasks.bulk.confirmDelete', { n: formatCount(n) })} body={t(permissions?.admin ? 'tasks.bulk.deleteBodyAdmin' : 'tasks.bulk.deleteBodyFamily')}
          confirmLabel={t('bulk.delete')} danger onConfirm={apply} onCancel={() => setAction(null)} />
      )}
      <BulkResult result={result} onClose={() => setResult(null)} />
    </>
  );
}
