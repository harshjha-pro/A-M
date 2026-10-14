// One workspace (1.0.17, step A; outfits 1.0.18; family outfits, decoration and menu 1.0.19;
// contacts, guest details and event timeline 1.0.20): tasks strip at the top (tap a task; + Add task links it
// here), the Files section (attachments used here; add one), and the sections that come in
// the next updates. Edit name / calendar event; delete with Undo (tasks stay).
import { canSeeWorkspace } from '../../api/workspaceAccess.js';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Pencil, Plus, Trash2 } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import Button from '../../components/Button.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import { Notice } from '../../components/Field.jsx';
import { api, newIdemKey } from '../../api/client.js';
import { withRelogin } from '../../api/auth.js';
import { useSession } from '../../api/session.js';
import { showUndo, showToast } from '../../undo/undoStore.js';
import { useWorkspace, useAttachments, SECTIONS } from '../../data/vault.js';
import { formatDate, formatDateOnly } from '../../format/ist.js';
import AttachmentRow from '../vault/AttachmentRow.jsx';
import AttachmentAddSheet from '../vault/AttachmentAddSheet.jsx';
import WorkspaceSheet from './WorkspaceSheet.jsx';
import OutfitSection, { FamilySection } from '../outfits/OutfitSection.jsx';
import DecorSection from './DecorSection.jsx';
import MenuSection from './MenuSection.jsx';
import { ContactsSection, GuestsSection, TimelineSection } from './PlanningSections.jsx';
import { t } from '../../i18n/strings.en.js';


function TaskStrip({ ws }) {
  return (
    <section aria-labelledby="ws-tasks" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 id="ws-tasks" className="text-lg font-bold">{t('workspace.tasks')}</h2>
        <Link to={`/tasks/new?workspace=${ws.id}`} className="tap inline-flex items-center gap-1 font-bold text-primary"><Plus aria-hidden="true" size={20} />{t('workspace.addTask')}</Link>
      </div>
      {ws.tasks.length === 0 ? <p className="text-text-muted">{t('workspace.noTasks')}</p> : (
        <ul className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1" aria-label={t('workspace.tasks')}>
          {ws.tasks.map((task) => {
            const done = task.status === 'done' || task.status === 'cancelled';
            return (
              <li key={task.id} className="snap-start">
                <Link to={`/tasks/${task.id}`} className={`flex h-24 w-48 flex-col justify-between rounded-md p-3 shadow-card ${done ? 'bg-surface-2 text-text-muted' : 'bg-surface'}`}>
                  <span className={`line-clamp-2 font-bold ${done ? 'line-through' : ''}`}>{task.title}</span>
                  <span className={`text-sm ${task.overdue ? 'font-bold text-danger' : 'text-text-muted'}`}>
                    {task.dueDate ? formatDateOnly(task.dueDate).replace(/^\w+, /, '') : t('tasks.noDate')}
                    {task.workspaceSection && task.workspaceSection !== 'general' ? ` · ${SECTIONS[task.workspaceSection]}` : ''}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function FilesSection({ ws }) {
  const [adding, setAdding] = useState(false);
  const q = useAttachments({ workspace: ws.id, section: 'general', limit: 200 });
  return (
    <section id="general" aria-labelledby="ws-files" className="flex flex-col gap-3 rounded-md bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between">
        <h2 id="ws-files" className="text-lg font-bold">{SECTIONS.general}</h2>
        <Button variant="secondary" needsInternet onClick={() => setAdding(true)}><Plus aria-hidden="true" size={20} />{t('vault.addHere')}</Button>
      </div>
      {q.isPending && <p aria-busy="true">…</p>}
      {q.data?.items.length === 0 && <p className="text-text-muted">{t('vault.empty')}</p>}
      {q.data?.items.length > 0 && <ul className="-mx-4 border-t border-border">{q.data.items.map((a) => <AttachmentRow key={a.id} a={a} showPaths={false} />)}</ul>}
      {adding && <AttachmentAddSheet workspaceId={ws.id} section="general" onClose={() => setAdding(false)} />}
    </section>
  );
}

export default function WorkspaceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { permissions } = useSession();
  const q = useWorkspace(canSeeWorkspace(permissions) ? id : null);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  if (!canSeeWorkspace(permissions)) return <Screen title={t('workspace.title')} back="/workspaces"><Notice>{t('workspace.onlyAdmins')}</Notice></Screen>;
  if (q.isPending) return <Screen title={t('workspace.title')} back="/workspaces"><p aria-busy="true">…</p></Screen>;
  if (q.isError) return <Screen title={t('workspace.title')} back="/workspaces"><Notice kind="danger">{q.error.message || t('errors.loadFailed')}</Notice></Screen>;
  const ws = q.data;

  async function remove() {
    setConfirm(false);
    try {
      const res = await withRelogin(() => api('DELETE', `/workspaces/${id}`, { ifMatch: ws.version, idemKey: newIdemKey() }));
      qc.invalidateQueries({ queryKey: ['workspaces'] });
      if (res.meta.undo) showUndo({ batchId: res.meta.undo.batchId, summary: res.meta.undo.summary });
      navigate('/workspaces', { replace: true });
    } catch (e) { showToast(e.message || t('errors.server')); }
  }

  return (
    <Screen title={ws.name} back="/workspaces"
      actions={<button type="button" onClick={() => setEditing(true)} aria-label={t('workspace.edit')} className="tap grid place-items-center text-primary"><Pencil aria-hidden="true" size={22} /></button>}>
      {ws.event && (
        <Link to={`/calendar/events/${ws.event.id}`} className="inline-flex items-center gap-2 font-bold text-primary">
          <CalendarDays aria-hidden="true" size={20} />{t('workspace.onCalendar', { name: ws.event.name })}{ws.event.startAt ? ` · ${formatDate(ws.event.startAt)}` : ''}
        </Link>
      )}
      <TaskStrip ws={ws} />
      <OutfitSection ws={ws} sectionKey="bride_outfit" person="bride" title={SECTIONS.bride_outfit} />
      <OutfitSection ws={ws} sectionKey="groom_outfit" person="groom" title={SECTIONS.groom_outfit} />
      <FamilySection ws={ws} title={SECTIONS.family_outfit} />
      <DecorSection ws={ws} title={SECTIONS.decor} />
      <MenuSection ws={ws} title={SECTIONS.menu} />
      <FilesSection ws={ws} />
      <ContactsSection ws={ws} title={SECTIONS.contacts} />
      <GuestsSection key={ws.version} ws={ws} title={SECTIONS.guests} />
      <TimelineSection ws={ws} title={SECTIONS.timeline} />
      <Button variant="danger" needsInternet onClick={() => setConfirm(true)}><Trash2 aria-hidden="true" size={20} />{t('workspace.delete')}</Button>
      {editing && <WorkspaceSheet workspace={ws} onClose={() => setEditing(false)} />}
      {confirm && <ConfirmDialog title={t('workspace.delete')} body={t('workspace.deleteBody')} confirmLabel={t('workspace.delete')} danger onConfirm={remove} onCancel={() => setConfirm(false)} />}
    </Screen>
  );
}
