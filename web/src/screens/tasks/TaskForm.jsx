// Add / edit a task (FEATURES B3, DESIGN §6.2). Quick fields first (title, due date,
// assigned to), the rest under "More details". Shared form rules: changed fields
// only + If-Match, a draft on this phone, the conflict screen on a clash.
import { useEffect, useRef, useState } from 'react';
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
import { showToast } from '../../undo/undoStore.js';
import { useTags } from './TaskList.jsx';
import { formatDateOnly } from '../../format/ist.js';
import { t } from '../../i18n/strings.en.js';

const FIELDS = ['title', 'notes', 'status', 'priority', 'dueDate', 'dueTime', 'assigneeIds', 'tagIds', 'newTags', 'eventId'];
const LABELS = {
  title: t('tasks.titleLabel'), notes: t('tasks.notes'), status: t('tasks.statusLabel'), priority: t('tasks.priorityLabel'),
  dueDate: t('tasks.due'), dueTime: t('tasks.time'), assigneeIds: t('tasks.assignees'), tagIds: t('tasks.tags'), newTags: t('tasks.newTag'), eventId: t('tasks.eventLabel'),
};
const EMPTY = { version: 0, title: '', notes: '', status: 'todo', priority: 'normal', dueDate: null, dueTime: null, assignees: null, tags: [] };

function toForm(task, meId) {
  return {
    title: task.title ?? '', notes: task.notes ?? '', status: task.status, priority: task.priority,
    dueDate: task.dueDate ?? '', dueTime: task.dueTime ?? '',
    assigneeIds: task.assignees ? task.assignees.map((a) => a.id) : [meId],
    tagIds: (task.tags ?? []).map((g) => g.id), newTags: [], eventId: task.event?.id ?? '',
  };
}

export default function TaskForm() {
  const { id } = useParams();
  const { user } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['task', id], queryFn: () => api('GET', `/tasks/${id}`).then((r) => r.data), enabled: Boolean(id) });
  const members = useQuery({ queryKey: ['members'], queryFn: () => api('GET', '/members').then((r) => r.data) });
  const tags = useTags();
  const [dup, setDup] = useState(null);
  const [tagText, setTagText] = useState('');
  const allowDup = useRef(false);
  const presetEvent = new URLSearchParams(useLocation().search).get('event');
  const record = id ? q.data : EMPTY;
  const events = useQuery({ queryKey: ['events'], queryFn: () => api('GET', '/events').then((r) => r.data), staleTime: 60_000 });

  const f = useEntityForm({
    form: 'task',
    recordId: id ?? null,
    record,
    fields: FIELDS,
    fromServer: (r) => toForm(r, user?.id),
    initial: !id && presetEvent ? { eventId: presetEvent } : null,
    toBody(keys, v) {
      const body = {};
      for (const k of keys) {
        if (k === 'assigneeIds') body.assigneeIds = v.assigneeIds;
        else if (k === 'tagIds') body.tagIds = v.tagIds;
        else if (k === 'newTags') { if (v.newTags.length) body.newTags = v.newTags; }
        else if (k === 'dueDate' || k === 'dueTime' || k === 'eventId') body[k] = v[k] || null;
        else body[k] = v[k];
      }
      if (!id) {
        body.title = v.title;
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
      else { if (!saved.waiting) showToast(t('tasks.added')); navigate('/tasks', { replace: true }); }
    },
  });

  // The form is open from the start (add) or as soon as the task has loaded (edit).
  useEffect(() => {
    if (record && !f.editing && !f.conflict && f.save.status !== 'saved') f.start();
  });

  const title = id ? t('tasks.editTask') : t('tasks.addTask');
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
        <DateField label={t('tasks.due')} value={v.dueDate} onChange={(d) => { f.set('dueDate')(d); if (!d) f.set('dueTime')(''); }} error={errors.dueDate} />
        {activeMembers.length > 0 && (
          <MultiChips label={t('tasks.assignees')} options={activeMembers.map((m) => ({ value: m.id, label: m.id === user?.id ? `${m.name} (me)` : m.name }))}
            value={v.assigneeIds} onChange={f.set('assigneeIds')} error={errors.assigneeIds} />
        )}
        <details className="flex flex-col gap-5 rounded-md bg-surface p-4 shadow-card" open={Boolean(id || presetEvent)}>
          <summary className="tap cursor-pointer font-bold text-primary">{t('tasks.moreDetails')}</summary>
          <div className="mt-4 flex flex-col gap-5">
            {v.dueDate && <TextField type="time" label={t('tasks.time')} value={v.dueTime} onChange={f.set('dueTime')} error={errors.dueTime} />}
            {(events.data ?? []).length > 0 && (
              <label className="flex flex-col gap-1">
                <span className="font-bold">{t('tasks.eventLabel')}</span>
                <select value={v.eventId} onChange={(e) => f.set('eventId')(e.target.value)} className="tap rounded-sm border-[1.5px] border-border-strong bg-surface px-3 text-base text-text">
                  <option value="">{t('tasks.noEvent')}</option>
                  {events.data.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                </select>
              </label>
            )}
            <ChoiceChips label={t('tasks.priorityLabel')} options={['urgent', 'normal', 'low'].map((p) => ({ value: p, label: t(`tasks.priority.${p}`) }))} value={v.priority} onChange={f.set('priority')} />
            {id && <ChoiceChips label={t('tasks.statusLabel')} options={['todo', 'doing', 'waiting', 'done', 'cancelled'].map((s) => ({ value: s, label: t(`tasks.status.${s}`) }))} value={v.status} onChange={f.set('status')} />}
            {(tags.data ?? []).length > 0 && (
              <MultiChips label={t('tasks.tags')} options={(tags.data ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)).map((g) => ({ value: g.id, label: g.name }))}
                value={v.tagIds} onChange={f.set('tagIds')} error={errors.tagIds} />
            )}
            {v.newTags.length > 0 && <p className="text-sm">{t('tasks.newTag')}: {v.newTags.join(', ')}</p>}
            <div className="flex items-end gap-2">
              <div className="flex-1"><TextField label={t('tasks.newTag')} value={tagText} onChange={setTagText} maxLength={30} error={errors.newTags}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} /></div>
              <Button variant="secondary" onClick={addTag}>{t('tasks.addTag')}</Button>
            </div>
            <label className="flex flex-col gap-1">
              <span className="font-bold">{t('tasks.notes')}</span>
              <textarea value={v.notes} onChange={(e) => f.set('notes')(e.target.value)} rows={4} maxLength={5000}
                className="w-full rounded-sm border-[1.5px] border-border-strong bg-surface p-3 text-base text-text" />
            </label>
          </div>
        </details>
        <SavedIndicator {...f.save} />
        <Button type="submit" loading={f.save.status === 'saving'}>{t('tasks.save')}</Button>
        <Button variant="secondary" onClick={() => { f.cancel(); navigate(id ? `/tasks/${id}` : '/tasks'); }}>{t('login.cancel')}</Button>
      </form>
    </Screen>
  );
}
