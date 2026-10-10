// Deleted items (FEATURES B9): one row per delete, newest first; Restore brings
// the whole batch back. Admins only. Nothing is purged in R1.
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import { Notice } from '../../components/Field.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { api, newIdemKey } from '../../api/client.js';
import { withRelogin } from '../../api/auth.js';
import { showToast } from '../../undo/undoStore.js';
import { formatDateTime } from '../../format/ist.js';
import { t } from '../../i18n/strings.en.js';

export default function DeletedItems() {
  const qc = useQueryClient();
  const q = useInfiniteQuery({
    queryKey: ['trash'],
    queryFn: ({ pageParam }) => api('GET', '/trash', { query: { cursor: pageParam } }),
    initialPageParam: undefined,
    getNextPageParam: (last) => (last.meta.hasMore ? last.meta.nextCursor : undefined),
  });

  async function restore(b) {
    const idemKey = newIdemKey();
    try {
      const res = await withRelogin(() => api('POST', `/trash/${b.batchId}/restore`, { body: {}, idemKey }));
      const r = res.data;
      showToast(r.blocked?.length ? r.blocked.map((x) => `${x.name}: ${x.reason}`).join(' ') : [r.message || t('trash.restored'), ...(r.warnings ?? [])].join(' '));
      await qc.invalidateQueries();
    } catch (e) {
      showToast(e.message || t('errors.server'));
    }
  }

  const rows = q.data?.pages.flatMap((p) => p.data) ?? [];
  return (
    <Screen title={t('trash.title')} back="/settings">
      <p className="text-text-muted">{t('trash.note')}</p>
      {q.isPending && <p aria-busy="true">…</p>}
      {q.isError && <Notice kind="danger">{q.error.message || t('errors.loadFailed')}</Notice>}
      {q.isSuccess && rows.length === 0 && <EmptyState Icon={Trash2} text={t('trash.empty')} />}
      {rows.length > 0 && (
        <ul className="flex flex-col overflow-hidden rounded-md bg-surface shadow-card">
          {rows.map((b) => (
            <li key={b.batchId} className="flex items-center gap-3 border-b border-border p-4 last:border-b-0">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="break-words font-bold">{b.summary}</span>
                <span className="text-sm text-text-muted">{t('trash.by', { name: b.user?.name ?? '—', when: formatDateTime(b.deletedAt) })}</span>
              </div>
              <button type="button" className="tap rounded-md border-[1.5px] border-primary px-4 font-bold text-primary" onClick={() => restore(b)} aria-label={`${t('trash.restore')}: ${b.summary}`}>
                {t('trash.restore')}
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.hasNextPage && <button type="button" className="tap font-bold text-primary" onClick={() => q.fetchNextPage()}>{t('trash.more')}</button>}
    </Screen>
  );
}
