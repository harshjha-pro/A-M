// Attachment Vault (1.0.17): every attachment in the app with where it is used.
// Search by ID, title or note; filter by type, favourites, not linked yet, workspace.
// Shows how full the database is (Hostinger: 3 GB). Ayush and Mahi only.
import { useState } from 'react';
import { Archive } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import ChipFilter from '../../components/ChipFilter.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import AddButton from '../../components/AddButton.jsx';
import { Notice } from '../../components/Field.jsx';
import { useSession } from '../../api/session.js';
import { useAttachments, useWorkspaces, formatBytes } from '../../data/vault.js';
import AttachmentRow from './AttachmentRow.jsx';
import AttachmentAddSheet from './AttachmentAddSheet.jsx';
import { t } from '../../i18n/strings.en.js';

export default function Vault() {
  const { permissions } = useSession();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const [only, setOnly] = useState('all');
  const [ws, setWs] = useState('');
  const [adding, setAdding] = useState(false);
  const workspaces = useWorkspaces();
  const query = {
    q: q.trim() || undefined, kind: kind === 'all' ? undefined : kind,
    favourite: only === 'fav' ? '1' : undefined, unlinked: only === 'unlinked' ? '1' : undefined, workspace: ws || undefined, limit: 200,
  };
  const list = useAttachments(query, Boolean(permissions?.admin));
  if (!permissions?.admin) return <Screen title={t('vault.title')} back="/more"><Notice>{t('workspace.onlyAdmins')}</Notice></Screen>;
  const storage = list.data?.meta?.storage;
  const filtered = Boolean(query.q || query.kind || query.favourite || query.unlinked || query.workspace);
  return (
    <Screen title={t('vault.title')} back="/more">
      <p className="text-text-muted">{t('vault.intro')}</p>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('vault.search')} aria-label={t('vault.search')}
        className="tap w-full rounded-sm border-[1.5px] border-border-strong bg-surface px-3 text-base text-text" />
      <ChipFilter label={t('vault.type')} value={kind} onChange={setKind}
        options={[{ value: 'all', label: t('vault.all') }, ...['photo', 'video', 'document', 'link', 'text'].map((k) => ({ value: k, label: t(`vault.kinds.${k}`) }))]} />
      <ChipFilter label={t('vault.favourites')} value={only} onChange={setOnly}
        options={[{ value: 'all', label: t('vault.all') }, { value: 'fav', label: `⭐ ${t('vault.favourites')}` }, { value: 'unlinked', label: t('vault.unlinked') }]} />
      <label className="flex flex-col gap-1">
        <span className="font-bold">{t('vault.workspace')}</span>
        <select value={ws} onChange={(e) => setWs(e.target.value)} className="tap rounded-sm border-[1.5px] border-border-strong bg-surface px-3 text-base text-text">
          <option value="">{t('vault.anyWorkspace')}</option>
          {(workspaces.data ?? []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </label>
      {storage && (storage.warn
        ? <Notice kind="warning">{t('vault.storageWarn', { used: formatBytes(storage.databaseBytes) })}</Notice>
        : <p className="text-sm text-text-muted">{t('vault.storage', { used: formatBytes(storage.databaseBytes) })}</p>)}
      {list.isPending && <p aria-busy="true">…</p>}
      {list.isError && <Notice kind="danger">{list.error.message || t('errors.loadFailed')}</Notice>}
      {list.data && list.data.items.length === 0 && <EmptyState Icon={Archive} text={filtered ? t('vault.emptyFilter') : t('vault.empty')} />}
      {list.data && list.data.items.length > 0 && (
        <ul className="overflow-hidden rounded-md bg-surface shadow-card">{list.data.items.map((a) => <AttachmentRow key={a.id} a={a} />)}</ul>
      )}
      <AddButton label={t('vault.add')} onClick={() => setAdding(true)} />
      {adding && <AttachmentAddSheet onClose={() => setAdding(false)} />}
    </Screen>
  );
}
