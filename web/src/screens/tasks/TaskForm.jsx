// Add / edit a task (FEATURES B3, DESIGN §6.2). Quick fields first (title, due date,
// assigned to), the rest under "More details". Shared form rules: changed fields
// only + If-Match, a draft on this phone, the conflict screen on a clash.
import { canEditWorkspace } from '../../api/workspaceAccess.js';
import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, Clock3, Flag, LayoutGrid, StickyNote, Tags as TagsIcon, X } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Screen from '../../components/Screen.jsx';
import { TextField, ChoiceChips, FixSummary, Notice } from '../../components/Field.jsx';
import { MultiChips } from '../../components/ChipFilter.jsx';
import DateField from '../../components/DateField.jsx';
import Button from '../../components/Button.jsx';
import SavedIndicator from '../../components/SavedIndicator.jsx';
import DraftBanner from '../../components/DraftBanner.jsx';
import ConflictScreen from '../../components/ConflictScreen.jsx';
import { api } from '../../api/client.js';
import { saveViaOutbox } from '../../offline/save.js';
import { DuplicateError } from '../../api/errors.js';
import { useSession } from '../../api/session.js';
import { useEntityForm } from '../../forms/useEntityForm.js';
import { CodeField } from '../vault/AttachmentAddSheet.jsx';
import { showToast } from '../../undo/undoStore.js';
import { useTags } from './TaskList.jsx';
import { formatDateOnly } from '../../format/ist.js';
import { t } from '../../i18n/strings.en.js';

const FIELDS = ['code', 'title', 'notes', 'status', 'priority', 'dueDate', 'dueTime', 'assigneeIds', 'tagIds', 'newTags', 'eventId', 'workspaceId'];
const LABELS = {
  code: t('tasks.codeLabel'), title: t('tasks.titleLabel'), notes: t('tasks.notes'), status: t('tasks.statusLabel'), priority: t('tasks.priorityLabel'),
  dueDate: t('tasks.due'), dueTime: t('tasks.time'), assigneeIds: t('tasks.assignees'), tagIds: t('tasks.tags'), newTags: t('tasks.newTag'), eventId: t('tasks.eventLabel'), workspaceId: t('nav.workspace'),
};
const EMPTY = { version: 0, title: '', notes: '', status: 'todo', priority: 'normal', dueDate: null, dueTime: null, assignees: null, tags: [] };

function toForm(task, meId) {
  return {
    code: task.code ?? '', title: task.title ?? '', notes: task.notes ?? '', status: task.status, priority: task.priority,
    dueDate: task.dueDate ?? '', dueTime: task.dueTime ?? '',
    assigneeIds: task.assignees ? task.assignees.map((a) => a.id) : [meId],
    tagIds: (task.tags ?? []).map((g) => g.id), newTags: [], eventId: task.event?.id ?? '', workspaceId: task.workspace?.id ?? '',
  };
}

export default function TaskForm() {
  const { id } = useParams();
  const { user, permissions } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['task', id], queryFn: () => api('GET', `/tasks/${id}`).then((r) => r.data), enabled: Boolean(id) });
  const members = useQuery({ queryKey: ['members'], queryFn: () => api('GET', '/members').then((r) => r.data) });
  const tags = useTags();
  const [dup, setDup] = useState(null);
  const [tagText, setTagText] = useState('');
  const allowDup = useRef(false);
  const search = new URLSearchParams(useLocation().search);
  const presetEvent = search.get('event');
  const presetWorkspace = search.get('workspace'); // + Add task inside a workspace (1.0.17)
  const presetSection = search.get('section');
  const [moreDetailsOpen, setMoreDetailsOpen] = useState(() => Boolean(id || presetEvent || presetWorkspace));
  // 1.0.18: + Add task on an outfit, an accessory or a timeline step; back = where to return
  const presetTarget = search.get('outfit') ? { outfitId: search.get('outfit') } : search.get('accessory') ? { accessoryId: search.get('accessory') }
    : search.get('outfitStep') ? { outfitStepId: search.get('outfitStep') } : search.get('menuItem') ? { menuItemId: search.get('menuItem') } // 1.0.19: a dish
    : search.get('timelineStep') ? { timelineStepId: search.get('timelineStep') } : null; // 1.0.20: an event step
  const backTo = search.get('back');
  const record = id ? q.data : EMPTY;
  const events = useQuery({ queryKey: ['events'], queryFn: () => api('GET', '/events').then((r) => r.data), staleTime: 60_000 });
  const workspaces = useQuery({ queryKey: ['workspaces'], queryFn: () => api('GET', '/workspaces').then((r) => r.data), staleTime: 60_000, enabled: canEditWorkspace(permissions) });

  const f = useEntityForm({
    form: 'task',
    recordId: id ?? null,
    record,
    fields: FIELDS,
    fromServer: (r) => toForm(r, user?.id),
    initial: !id && (presetEvent || presetWorkspace) ? { ...(presetEvent ? { eventId: presetEvent } : {}), ...(presetWorkspace ? { workspaceId: presetWorkspace } : {}) } : null,
    toBody(keys, v) {
      const body = {};
      for (const k of keys) {
        if (k === 'assigneeIds') body.assigneeIds = v.assigneeIds;
        else if (k === 'tagIds') body.tagIds = v.tagIds;
        else if (k === 'newTags') { if (v.newTags.length) body.newTags = v.newTags; }
        else if (k === 'dueDate' || k === 'dueTime' || k === 'eventId' || k === 'workspaceId') body[k] = v[k] || null;
        else if (k === 'code') { if (v.code.trim()) body.code = v.code.trim(); } // empty = a random ID (1.0.22)
        else body[k] = v[k];
      }
      if (!id) {
        body.title = v.title;
        if (presetSection && v.workspaceId) body.workspaceSection = presetSection;
        if (presetTarget) Object.assign(body, presetTarget);
        if (allowDup.current) body.allowDuplicate = true;
      }
      return body;
    },
    // Through the outbox: with no internet the task waits on the phone (PWA §5.2).
    send: (body, version, idemKey) => (id
      ? saveViaOutbox('PATCH', `/tasks/${id}`, { body, ifMatch: version, idemKey, base: q.data, label: t('outbox.label.taskEdit', { title: body.title ?? q.data?.title ?? '' }) })
      : saveViaOutbox('POST', '/tasks', { body, idemKey, label: t('outbox.label.taskAdd', { title: body.title }) })).then((r) => (r.queued ? r : r.data)),
    mapError: (err) => {
      if (err instanceof DuplicateError) { setDup(err.matches[0] ?? { name: '' }); return {}; }
      return null;
    },
    onSaved(saved) {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['tags'] });
      if (!saved) return;
      qc.setQueryData(['task', saved.id], saved);
      if (id) navigate(`/tasks/${id}`, { replace: true });
      else { if (!saved.waiting) showToast(t('tasks.added')); qc.invalidateQueries({ queryKey: ['workspace'] }); qc.invalidateQueries({ queryKey: ['outfit'] }); navigate(backTo?.startsWith('/') ? backTo : presetWorkspace ? `/workspaces/${presetWorkspace}` : '/tasks', { replace: true }); }
    },
  });

  // The form is open from the start (add) or as soon as the task has loaded (edit).
  useEffect(() => {
    if (record && !f.editing && !f.conflict && f.save.status !== 'saved') f.start();
  });

  const title = id ? t('tasks.editTask') : t('tasks.addTask');
  if (!id && permissions && !permissions.admin) return <Screen title={title} back="/tasks"><Notice>{t('tasks.onlyAdminsAdd')}</Notice></Screen>;
  if (id && q.isError) return <Screen title={title} back="/tasks"><Notice kind="danger">{q.error.message || t('errors.loadFailed')}</Notice></Screen>;
  if (!f.editing) return <Screen title={title} back="/tasks"><p aria-busy="true">…</p></Screen>;

  const tagName = Object.fromEntries((tags.data ?? []).map((g) => [g.id, g.name]));
  const memberName = Object.fromEntries((members.data ?? []).map((m) => [m.id, m.name]));
  if (f.conflict) {
    const show = (field, v) => {
      if (field === 'assigneeIds') return v.map((x) => memberName[x] ?? '?').join(', ');
      if (field === 'tagIds') return v.map((x) => tagName[x] ?? '?').join(', ');
      if (field === 'status') return t(`tasks.status.${v}`);
      if (field === 'priority') return t(`tasks.priority.${v}`);
      if (field === 'dueDate') return formatDateOnly(v);
      return Array.isArray(v) ? v.join(', ') : v;
    };
    return <ConflictScreen conflict={f.conflict} labels={LABELS} longText={['notes']} format={show} saving={f.save.status === 'saving'} onSave={f.resolve} onKeepTheirs={f.keepTheirs} />;
  }

  const v = f.values;
  const errors = f.fieldErrors;
  const activeMembers = (members.data ?? []).filter((m) => !m.left);
  const addTag = () => {
    const name = tagText.trim().replace(/\s+/g, ' ');
    if (!name) return;
    const existing = (tags.data ?? []).find((g) => g.name.toLowerCase() === name.toLowerCase());
    if (existing) f.set('tagIds')(v.tagIds.includes(existing.id) ? v.tagIds : [...v.tagIds, existing.id]);
    else if (!v.newTags.some((n) => n.toLowerCase() === name.toLowerCase())) f.set('newTags')([...v.newTags, name]);
    setTagText('');
  };

  return (
    <Screen title={title} back={id ? `/tasks/${id}` : '/tasks'}>
      {f.draft && <DraftBanner time={f.draftTime} onUse={f.useDraft} onDiscard={f.discardDraft} />}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          allowDup.current = false;
          setDup(null);
          if (!v.title.trim()) { f.setFieldErrors({ title: t('tasks.titleRequired') }); return; }
          f.submit(e);
        }}
        className="flex flex-col gap-5" noValidate
      >
        <FixSummary fields={errors} />
        {f.deleted && <Notice kind="warning">{f.deleted.message}</Notice>}
        {dup && (
          <div role="alert" className="flex flex-col gap-3 rounded-md bg-warning-soft p-3">
            <p>{t('tasks.similar', { title: dup.name })}</p>
            <div className="flex gap-3">
              {dup.id && <Button variant="secondary" className="flex-1" onClick={() => navigate(`/tasks/${dup.id}`)}>{t('tasks.open')}</Button>}
              <Button className="flex-1" onClick={() => { allowDup.current = true; setDup(null); f.submit(); }}>{t('tasks.addAnyway')}</Button>
            </div>
          </div>
        )}
        <TextField label={t('tasks.titleLabel')} value={v.title} onChange={f.set('title')} error={errors.title} maxLength={200} autoFocus={!id} />
        <CodeField value={v.code ?? ''} onChange={f.set('code')} except={id} error={errors.code} endpoint="/tasks/check-code" help={t('tasks.codeHelp')} label={t('tasks.codeLabel')} />
        <DateField label={t('tasks.due')} value={v.dueDate} onChange={(d) => { f.set('dueDate')(d); if (!d) f.set('dueTime')(''); }} error={errors.dueDate} />
        {activeMembers.length > 0 && (
          <MultiChips label={t('tasks.assignees')} options={activeMembers.map((m) => ({ value: m.id, label: m.id === user?.id ? `${m.name} (me)` : m.name }))}
            value={v.assigneeIds} onChange={f.set('assigneeIds')} error={errors.assigneeIds} />
        )}

        <details
          className="group overflow-hidden rounded-2xl border border-border bg-surface shadow-card"
          open={moreDetailsOpen}
          onToggle={(event) => setMoreDetailsOpen(event.currentTarget.open)}
        >
          <summary className="tap flex list-none cursor-pointer items-center justify-between gap-3 px-4 py-4 [&::marker]:hidden [&::-webkit-details-marker]:hidden">
            <span className="min-w-0">
              <span className="block font-bold text-text">{t('tasks.moreDetails')}</span>
              <span className="mt-1 block text-sm font-normal text-text-muted">{t('tasks.detailsIntro')}</span>
            </span>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
              <ChevronDown aria-hidden="true" size={20} className="transition-transform group-open:rotate-180" />
            </span>
          </summary>

          <div className="border-t border-border px-4 pb-5 pt-5">
            <div className="flex flex-col gap-6">
              {v.dueDate && (
                <section className="flex flex-col gap-3" aria-labelledby="task-time-heading">
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                      <Clock3 aria-hidden="true" size={18} />
                    </span>
                    <span className="min-w-0">
                      <h3 id="task-time-heading" className="font-bold text-text">{t('tasks.timingSection')}</h3>
                      <p className="text-sm text-text-muted">{t('tasks.timeHelp')}</p>
                    </span>
                  </div>
                  <TextField type="time" label={t('tasks.time')} value={v.dueTime} onChange={f.set('dueTime')} error={errors.dueTime} />
                </section>
              )}

              {((events.data ?? []).length > 0 || (canEditWorkspace(permissions) && (workspaces.data ?? []).length > 0)) && (
                <section className="flex flex-col gap-4 border-t border-border pt-5" aria-labelledby="task-links-heading">
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                      <CalendarDays aria-hidden="true" size={18} />
                    </span>
                    <span className="min-w-0">
                      <h3 id="task-links-heading" className="font-bold text-text">{t('tasks.linksSection')}</h3>
                      <p className="text-sm text-text-muted">{t('tasks.linksHelp')}</p>
                    </span>
                  </div>

                  {(events.data ?? []).length > 0 && (
                    <label className="flex flex-col gap-1.5">
                      <span className="font-bold">{t('tasks.eventLabel')}</span>
                      <select
                        value={v.eventId}
                        onChange={(e) => f.set('eventId')(e.target.value)}
                        aria-describedby="task-event-help"
                        className="tap min-h-[3.25rem] w-full rounded-xl border-[1.5px] border-border-strong bg-surface px-4 text-base text-text focus:border-primary focus:outline-none"
                      >
                        <option value="">{t('tasks.noEvent')}</option>
                        {events.data.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                      </select>
                      <span id="task-event-help" className="text-sm text-text-muted">{t('tasks.eventHelp')}</span>
                    </label>
                  )}

                  {canEditWorkspace(permissions) && (workspaces.data ?? []).length > 0 && (
                    <label className="flex flex-col gap-1.5">
                      <span className="font-bold">{t('nav.workspace')}</span>
                      <select
                        value={v.workspaceId}
                        onChange={(e) => f.set('workspaceId')(e.target.value)}
                        aria-describedby="task-workspace-help"
                        className="tap min-h-[3.25rem] w-full rounded-xl border-[1.5px] border-border-strong bg-surface px-4 text-base text-text focus:border-primary focus:outline-none"
                      >
                        <option value="">{t('tasks.noWorkspace')}</option>
                        {workspaces.data.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                      <span id="task-workspace-help" className="text-sm text-text-muted">{t('tasks.workspaceHelp')}</span>
                    </label>
                  )}
                </section>
              )}

              <section className="flex flex-col gap-4 border-t border-border pt-5" aria-labelledby="task-priority-heading">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                    <Flag aria-hidden="true" size={18} />
                  </span>
                  <span className="min-w-0">
                    <h3 id="task-priority-heading" className="font-bold text-text">{t('tasks.prioritySection')}</h3>
                    <p className="text-sm text-text-muted">{t('tasks.priorityHelp')}</p>
                  </span>
                </div>
                <ChoiceChips label={t('tasks.priorityLabel')} options={['urgent', 'normal', 'low'].map((p) => ({ value: p, label: t(`tasks.priority.${p}`) }))} value={v.priority} onChange={f.set('priority')} />
                {id && <ChoiceChips label={t('tasks.statusLabel')} options={['todo', 'doing', 'waiting', 'done', 'cancelled'].map((s) => ({ value: s, label: t(`tasks.status.${s}`) }))} value={v.status} onChange={f.set('status')} />}
              </section>

              <section className="flex flex-col gap-4 border-t border-border pt-5" aria-labelledby="task-tags-heading">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                    <TagsIcon aria-hidden="true" size={18} />
                  </span>
                  <span className="min-w-0">
                    <h3 id="task-tags-heading" className="font-bold text-text">{t('tasks.tagsSection')}</h3>
                    <p className="text-sm text-text-muted">{t('tasks.tagsHelp')}</p>
                  </span>
                </div>

                {(tags.data ?? []).length > 0 && (
                  <MultiChips
                    label={t('tasks.tags')}
                    options={(tags.data ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)).map((g) => ({ value: g.id, label: g.name }))}
                    value={v.tagIds}
                    onChange={f.set('tagIds')}
                    error={errors.tagIds}
                  />
                )}

                {v.newTags.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-bold text-text">{t('tasks.newTagsAdded')}</p>
                    <div className="flex flex-wrap gap-2">
                      {v.newTags.map((name) => (
                        <span key={name} className="inline-flex min-h-10 items-center gap-1 rounded-full border border-primary/30 bg-primary-soft pl-3 pr-1 text-sm font-bold text-primary">
                          <span>{name}</span>
                          <button
                            type="button"
                            className="tap inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface"
                            aria-label={t('tasks.removeNewTag', { name })}
                            onClick={() => f.set('newTags')(v.newTags.filter((tag) => tag !== name))}
                          >
                            <X aria-hidden="true" size={15} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <TextField
                      label={t('tasks.newTag')}
                      value={tagText}
                      onChange={setTagText}
                      maxLength={30}
                      error={errors.newTags}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                    />
                  </div>
                  <Button variant="secondary" className="shrink-0 px-4" onClick={addTag}>{t('tasks.addTag')}</Button>
                </div>
              </section>

              <section className="flex flex-col gap-3 border-t border-border pt-5" aria-labelledby="task-notes-heading">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                    <StickyNote aria-hidden="true" size={18} />
                  </span>
                  <span className="min-w-0">
                    <h3 id="task-notes-heading" className="font-bold text-text">{t('tasks.notesSection')}</h3>
                    <p id="task-notes-help" className="text-sm text-text-muted">{t('tasks.notesHelp')}</p>
                  </span>
                </div>
                <label htmlFor="task-notes-input" className="sr-only">{t('tasks.notes')}</label>
                <textarea
                  id="task-notes-input"
                  aria-describedby="task-notes-help"
                  value={v.notes}
                  onChange={(e) => f.set('notes')(e.target.value)}
                  rows={4}
                  maxLength={5000}
                  className="min-h-28 w-full resize-y rounded-xl border-[1.5px] border-border-strong bg-surface px-4 py-3 text-base text-text focus:border-primary focus:outline-none"
                />
              </section>
            </div>
          </div>
        </details>
        <SavedIndicator {...f.save} />
        <Button type="submit" loading={f.save.status === 'saving'}>{t('tasks.save')}</Button>
        <Button variant="secondary" onClick={() => { f.cancel(); navigate(id ? `/tasks/${id}` : '/tasks'); }}>{t('login.cancel')}</Button>
      </form>
    </Screen>
  );
}
