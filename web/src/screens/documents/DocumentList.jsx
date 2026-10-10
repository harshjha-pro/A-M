// Documents (FEATURES B7, US-DOC-03): find by type or by name; paged 30; thumbnails
// lazy-load. Anyone who can edit adds with the + button (photo or file).
import { useEffect, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Search } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import AddButton from '../../components/AddButton.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import ChipFilter from '../../components/ChipFilter.jsx';
import { Notice } from '../../components/Field.jsx';
import { api } from '../../api/client.js';
import { useSession } from '../../api/session.js';
import { DOC_TYPES } from '../../data/documents.js';
import DocumentRow from './DocumentRow.jsx';
import UploadSheet from './UploadSheet.jsx';
import { t } from '../../i18n/strings.en.js';

export default function DocumentList() {
  const { permissions } = useSession();
  const qc = useQueryClient();
  const [type, setType] = useState('all');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  useEffect(() => { const id = setTimeout(() => setQ(search.trim()), 300); return () => clearTimeout(id); }, [search]);
  const list = useInfiniteQuery({
    queryKey: ['documents', 'list', type, q],
    queryFn: ({ pageParam }) => api('GET', '/documents', { query: { type: type === 'all' ? undefined : type, q, cursor: pageParam } }),
    initialPageParam: undefined,
    getNextPageParam: (last) => (last.meta.hasMore ? last.meta.nextCursor : undefined),
  });
  const rows = list.data?.pages.flatMap((p) => p.data) ?? [];
  const filtered = type !== 'all' || q !== '';
  return (
    <Screen title={t('documents.title')} back="/more">
      <label className="relative">
        <span className="sr-only">{t('documents.search')}</span>
        <Search aria-hidden="true" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('documents.search')}
          className="tap w-full rounded-sm border-[1.5px] border-border-strong bg-surface pl-10 pr-3 text-base text-text" />
      </label>
      <ChipFilter label={t('documents.type')} value={type} onChange={setType}
        options={[{ value: 'all', label: t('documents.all') }, ...DOC_TYPES.map((d) => ({ value: d, label: t(`documents.types.${d}`) }))]} />
      {list.isPending && <p aria-busy="true">…</p>}
      {list.isError && <Notice kind="danger">{list.error.message || t('errors.loadFailed')}</Notice>}
      {list.isSuccess && rows.length === 0 && <EmptyState Icon={FileText} text={filtered ? t('documents.emptyFilter') : t('documents.empty')} />}
      {rows.length > 0 && <ul className="overflow-hidden rounded-md bg-surface shadow-card">{rows.map((d) => <DocumentRow key={d.id} doc={d} />)}</ul>}
      {list.hasNextPage && <button type="button" className="tap font-bold text-primary" onClick={() => list.fetchNextPage()}>{t('history.more')}</button>}
      {permissions?.edit && <AddButton label={t('documents.add')} onClick={() => setAdding(true)} />}
      {adding && <UploadSheet onClose={() => setAdding(false)} onUploaded={() => qc.invalidateQueries({ queryKey: ['documents'] })} />}
    </Screen>
  );
}
