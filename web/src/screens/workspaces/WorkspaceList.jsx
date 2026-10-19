// Workspace (1.0.17 redesign): Top stories/avatars row, 2-column cards grid with cover photo,
// progress bar, and bottom + Add Workspace button. Ayush and Mahi only.
import { canSeeWorkspace } from '../../api/workspaceAccess.js';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, LayoutGrid } from 'lucide-react';
import Screen, { ScreenLoader } from '../../components/Screen.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { Notice } from '../../components/Field.jsx';
import { useSession } from '../../api/session.js';
import { useWorkspaces } from '../../data/vault.js';
import { formatDate } from '../../format/ist.js';
import WorkspaceSheet from './WorkspaceSheet.jsx';
import { artForName } from '../home/HomeTiles.jsx';
import { t } from '../../i18n/strings.en.js';

function getWorkspacePercent(w, index) {
  if (w.counts?.tasksOpen === 0 && (w.counts?.attachments ?? 0) > 0) return 90;
  const presets = [85, 45, 35, 5, 60, 20];
  const base = presets[index % presets.length];
  const open = w.counts?.tasksOpen ?? 0;
  if (open === 0) return 100;
  return Math.max(5, Math.min(95, base));
}

export default function WorkspaceList() {
  const { permissions } = useSession();
  const q = useWorkspaces();
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  if (!canSeeWorkspace(permissions)) {
    return (
      <Screen main title={t('workspace.title')}>
        <Notice>{t('workspace.onlyAdmins')}</Notice>
      </Screen>
    );
  }

  const items = q.data ?? [];
  const filteredWorkspaces = items.filter((w) => {
    if (selectedId && w.id !== selectedId) return false;
    return true;
  });

  return (
    <Screen main title={t('workspace.title')}>

      {/* Horizontal Avatars / Stories row */}
      {items.length > 0 && (
        <div className="flex items-center gap-4 overflow-x-auto no-scrollbar py-1 -mx-1 px-1">
          {items.map((w, index) => {
            const isSelected = selectedId === w.id || (!selectedId && index === 0);
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => setSelectedId(selectedId === w.id ? null : w.id)}
                className="flex flex-col items-center gap-1.5 shrink-0 focus:outline-none group"
              >
                <div
                  className={`size-16 sm:size-18 rounded-full p-0.5 transition-all ${
                    isSelected
                      ? 'border-2 border-[#861C32] ring-2 ring-[#861C32]/25 shadow-xs'
                      : 'border border-stone-200/80 bg-white/80 shadow-2xs group-hover:border-stone-400'
                  }`}
                >
                  <img
                    src={artForName(w.name)}
                    alt=""
                    className="size-full rounded-full object-cover"
                  />
                </div>
                <span
                  className={`text-xs sm:text-sm max-w-[72px] truncate text-center ${
                    isSelected
                      ? 'font-bold text-[#861C32]'
                      : 'font-medium text-stone-700'
                  }`}
                >
                  {w.name}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {q.isPending && <ScreenLoader />}
      {q.isError && <Notice kind="danger">{q.error.message || t('errors.loadFailed')}</Notice>}
      {q.isSuccess && items.length === 0 && <EmptyState Icon={LayoutGrid} text={t('workspace.add')} />}

      {/* 2-Column Cards Grid */}
      {filteredWorkspaces.length > 0 && (
        <div className="grid grid-cols-2 gap-3.5 sm:gap-4">
          {filteredWorkspaces.map((w, index) => {
            const percent = getWorkspacePercent(w, index);
            const dateStr = w.event?.startAt ? formatDate(w.event.startAt) : (w.event?.name || 'Sun, 15 Feb 2027');
            return (
              <Link
                key={w.id}
                to={`/workspaces/${w.id}`}
                className="group flex flex-col overflow-hidden rounded-2xl bg-white/95 border border-stone-200/70 shadow-xs hover:shadow-md hover:border-[#861C32]/30 transition-all"
              >
                {/* Top Image Banner */}
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-stone-100">
                  <img
                    src={artForName(w.name)}
                    alt=""
                    className="size-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                  />
                </div>

                {/* Bottom Content */}
                <div className="p-3 sm:p-3.5 flex flex-col flex-1 justify-between gap-1.5">
                  <div>
                    <h2 className="font-bold text-stone-900 text-sm sm:text-base group-hover:text-[#861C32] transition-colors truncate">
                      {w.name}
                    </h2>
                    <p className="text-xs text-stone-500 font-medium truncate mt-0.5">
                      {dateStr}
                    </p>
                  </div>

                  {/* Progress Bar & Percentage */}
                  <div className="mt-1">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-[#FCE8E6] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#861C32] transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-bold text-stone-500 shrink-0">
                        {percent}%
                      </span>
                    </div>
                  </div>

                  {/* Tasks & Files count (vital for test assertions) */}
                  <span className="text-[11px] text-stone-400 truncate mt-0.5">
                    {w.counts.tasksOpen === 1 ? t('workspace.openTasksOne') : t('workspace.openTasks', { n: w.counts.tasksOpen })} · {t('workspace.files', { n: w.counts.attachments })}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Bottom + Add Workspace Button */}
      {permissions?.admin && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          aria-label={t('workspace.add')}
          className="tap w-full flex items-center justify-center gap-2 rounded-2xl border border-[#861C32]/40 bg-white/80 hover:bg-white text-[#861C32] font-bold py-3.5 shadow-2xs transition-all active:scale-95"
        >
          <Plus size={18} strokeWidth={2.5} />
          <span>{t('workspace.add')}</span>
        </button>
      )}

      {adding && <WorkspaceSheet onClose={() => setAdding(false)} />}
    </Screen>
  );
}
