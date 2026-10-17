// Tasks (FEATURES B3): view chips with counts from the server, search, tag filter,
// rows with a tick circle (Undo for 8 s), + opens the task form. Viewers only read.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Circle, CircleCheck, CircleX, ListChecks, TriangleAlert, Sun, Flag, Hourglass, Search, CheckSquare } from 'lucide-react';
import SelectBar from '../../components/SelectBar.jsx';
import SortSelect from '../../components/SortSelect.jsx';

const TASK_SORTS = ['default', 'due_date', '-created_at', 'title'];
import TaskBulkBar from './TaskBulkBar.jsx';
import Screen from '../../components/Screen.jsx';
import ChipFilter from '../../components/ChipFilter.jsx';
import AddButton from '../../components/AddButton.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { Notice } from '../../components/Field.jsx';
import { api, newIdemKey } from '../../api/client.js';
import { withRelogin } from '../../api/auth.js';
import { saveViaOutbox } from '../../offline/save.js';
import WaitingMark from '../../components/WaitingMark.jsx';
import { useSession } from '../../api/session.js';
import { showUndo, showToast } from '../../undo/undoStore.js';
import { VIEWS, dueText, isClosed } from '../../data/tasks.js';
import { addDays } from '../../components/DateField.jsx';
import { todayIst } from '../../format/ist.js';
import { t } from '../../i18n/strings.en.js';

export function useTags() {
  return useQuery({ queryKey: ['tags'], queryFn: () => api('GET', '/tags').then((r) => r.data), staleTime: 60_000 });
}

/** Tick a task done from anywhere; Undo for 8 s (AC-TASK-07). No internet: it waits on the phone. */
export async function markDone(qc, task) {
  try {
    const idemKey = newIdemKey();
    const res = await withRelogin(() => saveViaOutbox('POST', `/tasks/${task.id}/done`, { body: {}, ifMatch: task.version, idemKey, base: task, label: t('outbox.label.taskDone', { title: task.title }) }));
    qc.invalidateQueries({ queryKey: ['tasks'] });
    qc.setQueryData(['task', task.id], res.data);
    if (res.queued) showToast(t('outbox.queuedToast'));
    else if (res.meta.alreadyDone) showToast(res.meta.message);
    else if (res.meta.undo) showUndo({ batchId: res.meta.undo.batchId, summary: res.meta.undo.summary });
    return res.data;
  } catch (e) {
    showToast(e.message || t('errors.server'));
    return null;
  }
}

export function TaskRow({ task, canEdit, onTick, selecting = false, checked = false, onToggle }) {
  const closed = isClosed(task);
  const TickIcon = task.status === 'done' ? CircleCheck : task.status === 'cancelled' ? CircleX : Circle;
  if (selecting) {
    return (
      <li className="border-b border-border last:border-b-0">
        <label className={`flex min-h-16 cursor-pointer items-center gap-3 px-4 py-2 ${checked ? 'bg-primary-soft' : ''}`}>
          <input type="checkbox" checked={checked} onChange={() => onToggle(task.id)} aria-label={t('bulk.choose', { name: task.title })} className="size-6 shrink-0 accent-[var(--c-primary)]" />
          <span className="flex min-w-0 flex-col">
            <span className={`truncate text-lg font-bold ${closed ? 'text-text-muted line-through' : ''}`}>{task.title}</span>
            <span className="text-sm text-text-muted">{task.code ? `${task.code} · ` : ''}{dueText(task)}{task.assignees.length > 0 ? ` · ${task.assignees.map((a) => a.name).join(', ')}` : ''}</span>
          </span>
        </label>
      </li>
    );
  }
  return (
    <li className="flex items-center gap-2 border-b border-border last:border-b-0">
      {canEdit && !closed ? (
        <button type="button" onClick={() => onTick(task)} aria-label={t('tasks.markDone', { title: task.title })}
          className="tap flex shrink-0 items-center justify-center pl-3 text-text-muted hover:text-primary">
          <Circle aria-hidden="true" size={28} />
        </button>
      ) : (
        <span className="flex w-12 shrink-0 items-center justify-center pl-3 text-text-muted" aria-hidden="true"><TickIcon size={28} className={task.status === 'done' ? 'text-success' : ''} /></span>
      )}
      <Link to={`/tasks/${task.id}`} className="flex min-h-16 min-w-0 flex-1 flex-col justify-center py-2 pr-4">
        <span className={`truncate text-lg font-bold ${closed ? 'text-text-muted line-through' : ''}`}>{task.title}</span>
        {task.code && <span className="font-mono text-xs text-text-muted">{task.code}</span>}
        <span className="flex flex-wrap items-center gap-x-2 text-sm text-text-muted">
          {task.overdue && <span className="inline-flex items-center gap-1 font-bold text-danger"><TriangleAlert aria-hidden="true" size={14} />{t('tasks.overdue')}</span>}
          {!task.overdue && task.dueToday && <span className="inline-flex items-center gap-1 font-bold text-warning"><Sun aria-hidden="true" size={14} />{t('tasks.today')}</span>}
          {!isClosed(task) && task.dueDate === addDays(todayIst(), 1) && <span className="font-bold">{t('tasks.tomorrow')}</span>}
          {task.priority === 'urgent' && <span className="inline-flex items-center gap-1 text-danger"><Flag aria-hidden="true" size={14} />{t('tasks.priority.urgent')}</span>}
          {task.status === 'waiting' && <span className="inline-flex items-center gap-1"><Hourglass aria-hidden="true" size={14} />{t('tasks.status.waiting')}</span>}
          <WaitingMark entity={`/tasks/${task.id}`} />
          <span>{dueText(task)}</span>
          {task.assignees.length > 0 && <span>· {task.assignees.map((a) => a.name).join(', ')}</span>}
          {task.itemCount > 0 && <span>· ☑ {t('tasks.items', { done: task.itemsDone, n: task.itemCount })}</span>}
        </span>
      </Link>
    </li>
  );
}

export default function TaskList() {
  const { user, permissions } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const defaultView = user?.role === 'family' ? 'mine' : 'all';
  const view = VIEWS.includes(params.get('view')) ? params.get('view') : defaultView;
  const tag = params.get('tag') || '';
  const sort = TASK_SORTS.includes(params.get('sort')) ? params.get('sort') : 'default';
  const [search, setSearch] = useState(params.get('q') || '');
  const [q, setQ] = useState(search);
  useEffect(() => { const id = setTimeout(() => setQ(search.trim()), 300); return () => clearTimeout(id); }, [search]);
  const tags = useTags();
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  const toggle = (id) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const list = useInfiniteQuery({
    queryKey: ['tasks', view, tag, q, sort],
    queryFn: ({ pageParam }) => api('GET', '/tasks', { query: { view, tag, q, sort: sort === 'default' ? undefined : sort, cursor: pageParam } }),
    initialPageParam: undefined,
    getNextPageParam: (last) => (last.meta.hasMore ? last.meta.nextCursor : undefined),
  });
  const first = list.data?.pages[0];
  const counts = first?.meta.chipCounts ?? {};
  const rows = list.data?.pages.flatMap((p) => p.data) ?? [];
  const set = (k, v) => { const next = new URLSearchParams(params); if (v) next.set(k, v); else next.delete(k); setParams(next, { replace: true }); };

  const options = VIEWS
    .filter((v) => v !== 'mine' || user?.role !== 'viewer')
    .map((v) => ({ value: v, label: t(`tasks.views.${v}`), count: v === 'all' ? (view === 'all' ? first?.meta.total ?? null : null) : v === 'closed' ? null : counts[v] ?? null }));

  return (
    <Screen title={t('tasks.title')}>
      <ChipFilter label={t('tasks.filters')} options={options} value={view} onChange={(v) => set('view', v === defaultView ? '' : v)} />
      <div className="flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">{t('tasks.search')}</span>
          <Search aria-hidden="true" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('tasks.search')}
            className="tap w-full rounded-sm border-[1.5px] border-border-strong bg-surface pl-10 pr-3 text-base text-text" />
        </label>
        <label>
          <span className="sr-only">{t('tasks.tags')}</span>
          <select value={tag} onChange={(e) => set('tag', e.target.value)} className="tap max-w-36 rounded-sm border-[1.5px] border-border-strong bg-surface px-2 text-base text-text">
            <option value="">{t('tasks.allTags')}</option>
            {(tags.data ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>
      </div>
      {!permissions?.edit && <p className="text-text-muted">{t('tasks.viewerNote')}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-text-muted">{first?.meta.total != null ? t('tasks.countShown', { n: rows.length, total: first.meta.total }) : ''}</span>
        <span className="flex items-center gap-2">
          <SortSelect value={sort} onChange={(v) => set('sort', v === 'default' ? '' : v)} options={TASK_SORTS.map((v) => ({ value: v, label: t(`sort.tasks.${v}`) }))} />
          {permissions?.edit && <button type="button" aria-pressed={selecting} onClick={() => { setSelecting(!selecting); setPicked(new Set()); }}
            className={`tap inline-flex items-center gap-2 rounded-full border-[1.5px] px-4 font-bold ${selecting ? 'glass-blush text-primary' : 'border-border bg-surface'}`}>
            <CheckSquare aria-hidden="true" size={20} /> {selecting ? t('bulk.done') : t('tasks.select')}
          </button>}
        </span>
      </div>
      {selecting && (
        <SelectBar count={picked.size} visible={rows.length} onSelectVisible={() => setPicked(new Set(rows.map((r) => r.id)))} onClear={() => setPicked(new Set())}>
          <TaskBulkBar ids={[...picked]} asOf={first?.meta.serverTime} permissions={permissions}
            onDone={() => { setPicked(new Set()); qc.invalidateQueries({ queryKey: ['tasks'] }); }} />
        </SelectBar>
      )}
      {list.isPending && <p aria-busy="true">…</p>}
      {list.isError && <Notice kind="danger">{list.error.message || t('errors.loadFailed')}</Notice>}
      {list.isSuccess && rows.length === 0 && (
        <EmptyState Icon={ListChecks} text={view === 'mine' ? t('tasks.emptyMine') : view === 'all' && !q && !tag ? t('tasks.empty') : t('tasks.emptyView')} />
      )}
      {rows.length > 0 && (
        <ul className="overflow-hidden rounded-md bg-surface shadow-card">
          {rows.map((task) => <TaskRow key={task.id} task={task} canEdit={permissions?.edit} onTick={(x) => markDone(qc, x)} selecting={selecting} checked={picked.has(task.id)} onToggle={toggle} />)}
        </ul>
      )}
      {list.hasNextPage && <button type="button" className="tap font-bold text-primary" onClick={() => list.fetchNextPage()}>{t('history.more')}</button>}
      {permissions?.admin && !selecting && <AddButton label={t('tasks.addTask')} onClick={() => navigate('/tasks/new')} />}
    </Screen>
  );
}
