// Workspace (1.0.17): one card per function (Engagement, Mehndi, …), with its calendar
// date, open tasks and attachments. + adds one. Ayush and Mahi only.
import { canSeeWorkspace } from '../../api/workspaceAccess.js';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight, LayoutGrid } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import AddButton from '../../components/AddButton.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { Notice } from '../../components/Field.jsx';
import { useSession } from '../../api/session.js';
import { useWorkspaces } from '../../data/vault.js';
import { formatDate } from '../../format/ist.js';
import WorkspaceSheet from './WorkspaceSheet.jsx';
import { t } from '../../i18n/strings.en.js';

export default function WorkspaceList() {
  const { permissions } = useSession();
  const q = useWorkspaces();
  const [adding, setAdding] = useState(false);
  if (!canSeeWorkspace(permissions)) return <Screen title={t('workspace.title')}><Notice>{t('workspace.onlyAdmins')}</Notice></Screen>;
  return (
    <Screen title={t('workspace.title')}>
      <p className="text-text-muted">{t('workspace.intro')}</p>
      {q.isPending && <p aria-busy="true">…</p>}
      {q.isError && <Notice kind="danger">{q.error.message || t('errors.loadFailed')}</Notice>}
      {q.data?.length === 0 && <EmptyState Icon={LayoutGrid} text={t('workspace.add')} />}
      {q.data?.length > 0 && (
        <ul className="flex flex-col gap-3">
          {q.data.map((w) => (
            <li key={w.id}>
              <Link to={`/workspaces/${w.id}`} className="flex flex-col overflow-hidden rounded-lg bg-surface shadow-card">
                <span className="flex flex-col gap-1 bg-gradient-to-br from-primary-soft via-accent-soft to-surface-2 px-4 pb-3 pt-6">
                  <span className="font-display text-[1.75rem] leading-none text-text">{w.name}</span>
                  {w.event && <span className="inline-flex items-center gap-1 text-sm font-bold text-text-muted"><CalendarDays aria-hidden="true" size={16} />{w.event.name}{w.event.startAt ? ` · ${formatDate(w.event.startAt)}` : ''}</span>}
                </span>
                <span className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1 text-sm text-text-muted">
                    {w.counts.tasksOpen === 1 ? t('workspace.openTasksOne') : t('workspace.openTasks', { n: w.counts.tasksOpen })} · {t('workspace.files', { n: w.counts.attachments })}
                  </span>
                  <span className="inline-flex items-center font-bold text-primary">{t('workspace.openWorkspace')}<ChevronRight aria-hidden="true" size={20} /></span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <AddButton label={t('workspace.add')} onClick={() => setAdding(true)} />
      {adding && <WorkspaceSheet onClose={() => setAdding(false)} />}
    </Screen>
  );
}
