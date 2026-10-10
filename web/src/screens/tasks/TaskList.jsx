// Tasks (FEATURES B3): view chips with counts from the server, search, tag filter,
// rows with a tick circle (Undo for 8 s), + opens the task form. Viewers only read.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Circle, CircleCheck, CircleX, ListChecks, TriangleAlert, Sun, Flag, Hourglass, Search } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import ChipFilter from '../../components/ChipFilter.jsx';
import AddButton from '../../components/AddButton.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { Notice } from '../../components/Field.jsx';
import { api, newIdemKey } from '../../api/client.js';
import { withRelogin } from '../../api/auth.js';
import { useSession } from '../../api/session.js';
import { showUndo, showToast } from '../../undo/undoStore.js';
import { VIEWS, dueText, isClosed } from '../../data/tasks.js';
import { addDays } from '../../components/DateField.jsx';
import { todayIst } from '../../format/ist.js';
import { t } from '../../i18n/strings.en.js';

export function useTags() {
  return useQuery({ queryKey: ['tags'], queryFn: () => api('GET', '/tags').then((r) => r.data), staleTime: 60_000 });
}

/** Tick a task done from anywhere; Undo for 8 s (AC-TASK-07). */
export async function markDone(qc, task) {
  try {
    const res = await withRelogin(() => api('POST', `/tasks/${task.id}/done`, { body: {}, ifMatch: task.version, idemKey: newIdemKey() }));
    qc.invalidateQueries({ queryKey: ['tasks'] });
    qc.setQueryData(['task', task.id], res.data);
    if (res.meta.alreadyDone) showToast(res.meta.message);
    else if (res.meta.undo) showUndo({ batchId: res.meta.undo.batchId, summary: res.meta.undo.summary });
    return res.data;
  } catch (e) {
    showToast(e.message || t('errors.server'));
    return null;
  }
}

export function TaskRow({ task, canEdit, onTick }) {
  const closed = isClosed(task);
  const TickIcon = task.status === 'done' ? CircleCheck : task.status === 'cancelled' ? CircleX : Circle;
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
        <span className="flex flex-wrap items-center gap-x-2 text-sm text-text-muted">
          {task.overdue && <span className="inline-flex items-center gap-1 font-bold text-danger"><TriangleAlert aria-hidden="true" size={14} />{t('tasks.overdue')}</span>}
          {!task.overdue && task.dueToday && <span className="inline-flex items-center gap-1 font-bold text-warning"><Sun aria-hidden="true" size={14} />{t('tasks.today')}</span>}
          {!isClosed(task) && task.dueDate === addDays(todayIst(), 1) && <span className="font-bold">{t('tasks.tomorrow')}</span>}
          {task.priority === 'urgent' && <span className="inline-flex items-center gap-1 text-danger"><Flag aria-hidden="true" size={14} />{t('tasks.priority.urgent')}</span>}
          {task.status === 'waiting' && <span className="inline-flex items-center gap-1"><Hourglass aria-hidden="true" size={14} />{t('tasks.status.waiting')}</span>}
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
  const [search, setSearch] = useState(params.get('q') || '');
  const [q, setQ] = useState(search);
  useEffect(() => { const id = setTimeout(() => setQ(search.trim()), 300); return () => clearTimeout(id); }, [search]);
  const tags = useTags();

  const list = useInfiniteQuery({
    queryKey: ['tasks', view, tag, q],
    queryFn: ({ pageParam }) => api('GET', '/tasks', { query: { view, tag, q, cursor: pageParam } }),
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
      {list.isPending && <p aria-busy="true">…</p>}
      {list.isError && <Notice kind="danger">{list.error.message || t('errors.loadFailed')}</Notice>}
      {list.isSuccess && rows.length === 0 && (
        <EmptyState Icon={ListChecks} text={view === 'mine' ? t('tasks.emptyMine') : view === 'all' && !q && !tag ? t('tasks.empty') : t('tasks.emptyView')} />
      )}
      {rows.length > 0 && (
        <ul className="overflow-hidden rounded-md bg-surface shadow-card">
          {rows.map((task) => <TaskRow key={task.id} task={task} canEdit={permissions?.edit} onTick={(x) => markDone(qc, x)} />)}
        </ul>
      )}
      {list.hasNextPage && <button type="button" className="tap font-bold text-primary" onClick={() => list.fetchNextPage()}>{t('history.more')}</button>}
      <AddButton label={t('tasks.addTask')} onClick={() => navigate('/tasks/new')} />
    </Screen>
  );
}
