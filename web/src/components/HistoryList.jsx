// Plain-sentence change lines, newest first, with "Show older" (FEATURES A5).
// Used by record History, Wedding details history and the Activity feed.
import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { Notice } from './Field.jsx';
import { formatDateTime } from '../format/ist.js';
import { t } from '../i18n/strings.en.js';

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
      <ol className="flex flex-col overflow-hidden rounded-md bg-surface shadow-card">
        {lines.map((l, i) => (
          <li key={`${l.at}-${i}`} className="flex flex-col gap-1 border-b border-border p-4 last:border-b-0">
            <span>{l.sentence}</span>
            <span className="text-sm text-text-muted">{formatDateTime(l.at)}{l.device ? ` · ${l.device}` : ''}</span>
          </li>
        ))}
      </ol>
      {q.hasNextPage && (
        <button type="button" className="tap font-bold text-primary" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
          {q.isFetchingNextPage ? '…' : t('history.more')}
        </button>
      )}
    </>
  );
}
