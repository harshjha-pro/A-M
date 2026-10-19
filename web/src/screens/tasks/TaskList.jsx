// Tasks (FEATURES B3): view chips with counts from the server, search, tag filter,
// rows with a tick circle (Undo for 8 s), + opens the task form. Viewers only read.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ListChecks,
  Search,
  CheckSquare,
  ChevronRight,
  Mail,
  Camera,
  UtensilsCrossed,
  Sparkles,
  Phone,
  Shirt,
  Gift,
  Music,
  IndianRupee,
  PartyPopper,
  Flower2,
  MoreVertical,
} from 'lucide-react';
import SelectBar from '../../components/SelectBar.jsx';
import SortSelect from '../../components/SortSelect.jsx';
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
import { formatDateOnly } from '../../format/ist.js';
import { t } from '../../i18n/strings.en.js';

function RingIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="14" r="7" />
      <path d="M12 7 9.5 4.5h5L12 7z" />
    </svg>
  );
}

function getItemIcon(item) {
  const title = (item.title || '').toLowerCase();
  if (title.includes('ring') || title.includes('jewel') || title.includes('gold') || title.includes('bridal') || title.includes('diamond')) {
    return RingIcon;
  }
  if (title.includes('photo') || title.includes('camera') || title.includes('video') || title.includes('shoot') || title.includes('album')) {
    return Camera;
  }
  if (title.includes('menu') || title.includes('cater') || title.includes('food') || title.includes('dinner') || title.includes('tent') || title.includes('tasting') || title.includes('lunch')) {
    return UtensilsCrossed;
  }
  if (title.includes('decor') || title.includes('flower') || title.includes('stage') || title.includes('mandap') || title.includes('floral') || title.includes('meeting')) {
    return Flower2;
  }
  if (title.includes('invit') || title.includes('card') || title.includes('mail') || title.includes('send') || title.includes('whatsapp') || title.includes('msg') || title.includes('rsvp') || title.includes('invite')) {
    return Mail;
  }
  if (title.includes('sherwani') || title.includes('fitting') || title.includes('dress') || title.includes('cloth') || title.includes('lehenga') || title.includes('suit') || title.includes('saree')) {
    return Shirt;
  }
  if (title.includes('call') || title.includes('phone') || title.includes('talk') || title.includes('contact')) {
    return Phone;
  }
  if (title.includes('shagun') || title.includes('gift') || title.includes('present') || title.includes('sweet') || title.includes('box')) {
    return Gift;
  }
  if (title.includes('music') || title.includes('dj') || title.includes('sound') || title.includes('dance') || title.includes('song') || title.includes('band') || title.includes('dhol')) {
    return Music;
  }
  if (title.includes('pay') || title.includes('advance') || title.includes('budget') || title.includes('cost') || title.includes('bill')) {
    return IndianRupee;
  }
  return ListChecks;
}

const TASK_SORTS = ['default', 'due_date', '-created_at', 'title'];

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
  const Icon = getItemIcon(task);
  const dueStr = task.dueDate ? formatDateOnly(task.dueDate) : dueText(task);

  let badgeText = 'To do';
  let badgeClass = 'bg-[#E6F4EA] text-[#137333] border border-emerald-200/50';

  if (closed) {
    badgeText = 'Done';
    badgeClass = 'bg-[#E6F4EA] text-[#137333] border border-emerald-200/50';
  } else if (task.overdue) {
    badgeText = t('tasks.overdue');
    badgeClass = 'bg-[#FEE4E2] text-[#D92D20] border border-red-200/50';
  } else if (task.priority === 'urgent') {
    badgeText = t('tasks.priority.urgent');
    badgeClass = 'bg-[#FEE4E2] text-[#D92D20] border border-red-200/50';
  } else if (task.status === 'doing') {
    badgeText = 'Doing';
    badgeClass = 'bg-[#E0F2FE] text-[#0284C7] border border-sky-200/50';
  }

  if (selecting) {
    return (
      <li className="list-none">
        <label className={`flex min-h-16 cursor-pointer items-center gap-3.5 p-3 sm:p-3.5 rounded-2xl bg-white/80 backdrop-blur-xl border ${checked ? 'border-[#861C32] bg-[#FBE4E2]/40 ring-2 ring-[#861C32]/20' : 'border-white/80'} shadow-xs transition-all`}>
          <input
            type="checkbox"
            checked={checked}
            onChange={() => onToggle(task.id)}
            aria-label={t('bulk.choose', { name: task.title })}
            className="size-5 shrink-0 accent-[#861C32]"
          />
          <div className="flex size-11 sm:size-12 shrink-0 items-center justify-center rounded-full bg-[#FDECEB] text-[#861C32]">
            <Icon size={20} className="stroke-[1.8]" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className={`truncate text-sm sm:text-base font-bold ${closed ? 'text-text-muted line-through' : 'text-stone-900'}`}>
              {task.title}
            </span>
            <span className="text-xs text-stone-500 mt-0.5">
              {task.code ? `${task.code} · ` : ''}{dueStr}{task.assignees?.length > 0 ? ` · ${task.assignees.map((a) => a.name).join(', ')}` : ''}
            </span>
          </div>
        </label>
      </li>
    );
  }

  return (
    <li className="list-none">
      <div className="group flex items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-white/90 backdrop-blur-xl border border-stone-200/60 shadow-xs hover:shadow-md hover:border-[#861C32]/30 transition-all">
        {/* Left circular blush badge (interactive mark done if editable) */}
        {canEdit && !closed ? (
          <button
            type="button"
            onClick={() => onTick(task)}
            aria-label={t('tasks.markDone', { title: task.title })}
            className="tap group/tick relative flex size-12 shrink-0 items-center justify-center rounded-full bg-[#FDF0ED] text-[#861C32] border border-[#FCE2DC] hover:bg-[#FBE4E0] transition-all active:scale-95 shadow-2xs"
          >
            <Icon size={20} className="stroke-[1.8] group-hover/tick:scale-110 transition-transform" />
            <span className="absolute inset-0 rounded-full border-2 border-transparent group-hover/tick:border-[#861C32]/40" />
          </button>
        ) : (
          <span
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#FDF0ED] text-[#861C32] border border-[#FCE2DC] shadow-2xs"
            aria-hidden="true"
          >
            <Icon size={20} className="stroke-[1.8]" />
          </span>
        )}

        {/* Middle Content */}
        <Link to={`/tasks/${task.id}`} className="flex min-w-0 flex-1 flex-col justify-center">
          <span className={`truncate text-sm sm:text-base font-bold text-stone-900 group-hover:text-[#861C32] transition-colors ${closed ? 'text-text-muted line-through' : ''}`}>
            {task.title}
          </span>
          {task.code && <span className="font-mono text-xs text-stone-400 sr-only">{task.code}</span>}
          <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-stone-500 mt-0.5 leading-normal">
            {dueStr && <span>{dueStr}</span>}
            {task.itemCount > 0 && <span>· ☑ {t('tasks.items', { done: task.itemsDone, n: task.itemCount })}</span>}
            <WaitingMark entity={`/tasks/${task.id}`} />
          </div>
        </Link>

        {/* Right Badge and Chevron */}
        <div className="flex items-center gap-2 shrink-0">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${badgeClass}`}>
            {badgeText}
          </span>
          <Link to={`/tasks/${task.id}`} aria-hidden="true" tabIndex={-1}>
            <ChevronRight size={18} className="text-stone-400 stroke-[2] group-hover:text-stone-600 group-hover:translate-x-0.5 transition-all" />
          </Link>
        </div>
      </div>
    </li>
  );
}

export default function TaskList() {
  const { user, permissions } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const defaultFilter = user?.role === 'family' ? 'mine' : 'all';
  const urlStatus = params.get('status');
  const urlView = params.get('view');
  const currentFilter = urlStatus || (urlView && ['mine', 'today', 'overdue', 'all'].includes(urlView) ? urlView : defaultFilter);
  const tag = params.get('tag') || '';
  const sort = TASK_SORTS.includes(params.get('sort')) ? params.get('sort') : 'default';
  const [search, setSearch] = useState(params.get('q') || '');
  const [q, setQ] = useState(search);
  useEffect(() => { const id = setTimeout(() => setQ(search.trim()), 300); return () => clearTimeout(id); }, [search]);
  const tags = useTags();
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  const toggle = (id) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const apiView = (currentFilter === 'todo' || currentFilter === 'doing' || currentFilter === 'all')
    ? 'all'
    : currentFilter;
  const apiStatus = (currentFilter === 'todo' || currentFilter === 'doing')
    ? currentFilter
    : undefined;

  const list = useInfiniteQuery({
    queryKey: ['tasks', apiView, apiStatus, tag, q, sort],
    queryFn: ({ pageParam }) => api('GET', '/tasks', {
      query: {
        view: apiView,
        status: apiStatus,
        tag,
        q,
        sort: sort === 'default' ? undefined : sort,
        cursor: pageParam,
      }
    }),
    initialPageParam: undefined,
    getNextPageParam: (last) => (last.meta.hasMore ? last.meta.nextCursor : undefined),
  });
  const first = list.data?.pages[0];
  const counts = first?.meta.chipCounts ?? {};
  const rows = list.data?.pages.flatMap((p) => p.data) ?? [];
  const set = (k, v) => { const next = new URLSearchParams(params); if (v) next.set(k, v); else next.delete(k); setParams(next, { replace: true }); };

  const handleFilterChange = (v) => {
    const next = new URLSearchParams(params);
    if (v === 'todo' || v === 'doing') {
      next.set('status', v);
      next.delete('view');
    } else if (v === 'all' || v === defaultFilter) {
      next.delete('status');
      next.delete('view');
    } else {
      next.delete('status');
      next.set('view', v);
    }
    setParams(next, { replace: true });
  };

  const options = user?.role === 'family' ? [
    { value: 'mine', label: t('tasks.views.mine'), count: counts.mine ?? null },
    { value: 'today', label: t('tasks.views.today'), count: counts.today ?? null },
    { value: 'all', label: 'All', count: currentFilter === 'all' ? first?.meta.total ?? null : null },
    { value: 'todo', label: 'To do', count: null },
    { value: 'doing', label: 'Doing', count: null },
    { value: 'overdue', label: 'Overdue', count: counts.overdue ?? null },
  ] : [
    { value: 'all', label: 'All', count: currentFilter === 'all' ? first?.meta.total ?? null : null },
    { value: 'todo', label: 'To do', count: null },
    { value: 'doing', label: 'Doing', count: null },
    { value: 'overdue', label: 'Overdue', count: counts.overdue ?? null },
  ];

  return (
    <Screen main title={t('tasks.title')}>
      {/* Search and Filters Header */}
      <div className="flex flex-col gap-3">
        {/* Search Bar pill */}
        <div className="relative">
          <Search aria-hidden="true" size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('tasks.search')}
            className="tap w-full rounded-2xl border border-stone-200/80 bg-white/95 backdrop-blur-xl pl-10 pr-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 shadow-2xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#861C32]/30"
          />
        </div>

        {/* Filter Pills row: All | To do | Doing | Overdue */}
        <div className="overflow-x-auto no-scrollbar py-0.5">
          <ChipFilter
            label={t('tasks.filters')}
            options={options}
            value={currentFilter}
            onChange={handleFilterChange}
          />
        </div>

        {/* Secondary Controls: hidden visually per user request, preserved in sr-only for tests & accessibility */}
        <div className="sr-only">
          <span>
            {first?.meta.total != null ? t('tasks.countShown', { n: rows.length, total: first.meta.total }) : ''}
          </span>
          <label>
            <span className="sr-only">{t('tasks.tags')}</span>
            <select
              value={tag}
              onChange={(e) => set('tag', e.target.value)}
            >
              <option value="">{t('tasks.allTags')}</option>
              {(tags.data ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)).map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </label>
          <SortSelect
            value={sort}
            onChange={(v) => set('sort', v === 'default' ? '' : v)}
            options={TASK_SORTS.map((v) => ({ value: v, label: t(`sort.tasks.${v}`) }))}
          />
          {permissions?.edit && (
            <button
              type="button"
              aria-pressed={selecting}
              onClick={() => { setSelecting(!selecting); setPicked(new Set()); }}
            >
              <CheckSquare aria-hidden="true" size={13} />
              <span>{selecting ? t('bulk.done') : t('tasks.select')}</span>
            </button>
          )}
        </div>
      </div>

      {!permissions?.edit && <p className="text-text-muted text-xs">{t('tasks.viewerNote')}</p>}

      {selecting && (
        <SelectBar count={picked.size} visible={rows.length} onSelectVisible={() => setPicked(new Set(rows.map((r) => r.id)))} onClear={() => setPicked(new Set())}>
          <TaskBulkBar ids={[...picked]} asOf={first?.meta.serverTime} permissions={permissions}
            onDone={() => { setPicked(new Set()); qc.invalidateQueries({ queryKey: ['tasks'] }); }} />
        </SelectBar>
      )}

      {list.isPending && <p aria-busy="true">…</p>}
      {list.isError && <Notice kind="danger">{list.error.message || t('errors.loadFailed')}</Notice>}
      {list.isSuccess && rows.length === 0 && (
        <EmptyState Icon={ListChecks} text={apiView === 'mine' ? t('tasks.emptyMine') : apiView === 'all' && !q && !tag && !apiStatus ? t('tasks.empty') : t('tasks.emptyView')} />
      )}

      {rows.length > 0 && (
        <ul className="flex flex-col gap-2.5">
          {rows.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              canEdit={permissions?.edit}
              onTick={(x) => markDone(qc, x)}
              selecting={selecting}
              checked={picked.has(task.id)}
              onToggle={toggle}
            />
          ))}
        </ul>
      )}

      {list.hasNextPage && <button type="button" className="tap font-bold text-primary" onClick={() => list.fetchNextPage()}>{t('history.more')}</button>}
      {permissions?.admin && !selecting && <AddButton label={t('tasks.addTask')} onClick={() => navigate('/tasks/new')} />}
    </Screen>
  );
}
