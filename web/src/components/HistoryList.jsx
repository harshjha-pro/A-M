// Plain-sentence change lines, newest first, with "Show older" (FEATURES A5).
// Used by record History, Wedding details history and the Activity feed.
import { useInfiniteQuery } from '@tanstack/react-query';
import { LogIn, LogOut, TriangleAlert, ListChecks, Users, Camera, Activity } from 'lucide-react';
import { api } from '../api/client.js';
import { Notice } from './Field.jsx';
import { formatDateTime } from '../format/ist.js';
import { t } from '../i18n/strings.en.js';

function getActivityIcon(sentence = '') {
  const s = sentence.toLowerCase();
  if (s.includes('wrong password') || s.includes('failed') || s.includes('alert') || s.includes('warn') || s.includes('error')) {
    return { Icon: TriangleAlert, tone: 'danger' };
  }
  if (s.includes('logged in') || s.includes('login') || s.includes('signed in')) {
    return { Icon: LogIn, tone: 'primary' };
  }
  if (s.includes('logged out') || s.includes('logout') || s.includes('signed out')) {
    return { Icon: LogOut, tone: 'primary' };
  }
  if (s.includes('task') || s.includes('done') || s.includes('tick')) {
    return { Icon: ListChecks, tone: 'primary' };
  }
  if (s.includes('guest') || s.includes('member') || s.includes('family') || s.includes('user')) {
    return { Icon: Users, tone: 'primary' };
  }
  if (s.includes('photo') || s.includes('image') || s.includes('cover')) {
    return { Icon: Camera, tone: 'primary' };
  }
  return { Icon: Activity, tone: 'primary' };
}

export function ActivityRow({ line }) {
  const { Icon, tone } = getActivityIcon(line.sentence);
  const isDanger = tone === 'danger';

  return (
    <li className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white/80 dark:bg-white/5 border border-stone-200/60 dark:border-white/10 shadow-xs">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className={`size-10 sm:size-11 rounded-2xl flex items-center justify-center shrink-0 ${
            isDanger
              ? 'bg-red-100 text-[#E03137] dark:bg-rose-950/60 dark:text-rose-400'
              : 'bg-[#FBE4E2] text-[#861C32] dark:bg-rose-950/40 dark:text-[#F2A7AF]'
          }`}
        >
          <Icon size={19} className="stroke-[2.2]" />
        </div>
        <span className="font-semibold text-xs sm:text-sm text-text leading-snug min-w-0 flex-1">
          {line.sentence}
        </span>
      </div>

      <div className="flex items-center gap-2.5 shrink-0 pl-1">
        <div className="h-7 w-[1px] bg-stone-200 dark:bg-stone-700" aria-hidden="true" />
        <span className="text-[11px] sm:text-xs text-text-muted font-medium whitespace-nowrap">
          {formatDateTime(line.at)}{line.device ? ` · ${line.device}` : ''}
        </span>
      </div>
    </li>
  );
}

export default function HistoryList({ path, query = {}, emptyText = t('history.empty') }) {
  const q = useInfiniteQuery({
    queryKey: ['history', path, query],
    queryFn: ({ pageParam }) => api('GET', path, { query: { ...query, cursor: pageParam } }),
    initialPageParam: undefined,
    getNextPageParam: (last) => (last.meta.hasMore ? last.meta.nextCursor : undefined),
  });
  if (q.isPending) return <p aria-busy="true">…</p>;
  if (q.isError) return <Notice kind="danger">{q.error.message || t('errors.loadFailed')}</Notice>;
  const lines = q.data.pages.flatMap((p) => p.data);
  if (lines.length === 0) return <p className="text-text-muted">{emptyText}</p>;
  return (
    <>
      <ol className="flex flex-col gap-2.5">
        {lines.map((l, i) => (
          <ActivityRow key={`${l.at}-${i}`} line={l} />
        ))}
      </ol>
      {q.hasNextPage && (
        <button type="button" className="tap font-bold text-primary mt-2" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
          {q.isFetchingNextPage ? '…' : t('history.more')}
        </button>
      )}
    </>
  );
}
