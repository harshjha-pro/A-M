// Event page (FEATURES B4): when, where (map), side, dress code, headcount, linked
// tasks, Share on WhatsApp. Admins edit and delete (counts first, then Undo).
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { History, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import Button from '../../components/Button.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import WhatsAppButton from '../../components/WhatsAppButton.jsx';
import { Notice } from '../../components/Field.jsx';
import { api, newIdemKey } from '../../api/client.js';
import { withRelogin } from '../../api/auth.js';
import { useSession } from '../../api/session.js';
import { showUndo, showToast } from '../../undo/undoStore.js';
import { TaskRow, markDone } from '../tasks/TaskList.jsx';
import { formatDate, formatTime, formatHhmm, istParts, timeLabel } from '../../format/ist.js';
import { t } from '../../i18n/strings.en.js';

/** "Sun, 14 Feb 2027, 6:00 PM IST" — the WhatsApp text always says IST. */
export function eventWhen(e) {
  if (!e.startAt) return t('calendar.dateNotSet');
  return e.allDay ? formatDate(e.startAt) : `${formatDate(e.startAt)}, ${formatTime(e.startAt)} IST`;
}

/** "Event details" template (FEATURES A7): "{event} · {date}, {time} IST · {venue} · {map link}". */
export function shareText(e) {
  return [e.name, eventWhen(e), [e.venueName, e.venueAddress].filter(Boolean).join(', '), e.mapUrl].filter(Boolean).join(' · ');
}

export default function EventDetail() {
  const { id } = useParams();
  const { permissions } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['event', id], queryFn: () => api('GET', `/events/${id}`).then((r) => r.data) });
  const tasks = useQuery({ queryKey: ['tasks', 'event', id], queryFn: () => api('GET', '/tasks', { query: { event: id, view: 'all' } }).then((r) => r.data) });
  const [preview, setPreview] = useState(null);
  const e = q.data;

  if (q.isPending) return <Screen title={t('events.title')} back="/calendar"><p aria-busy="true">…</p></Screen>;
  if (q.isError) return <Screen title={t('events.title')} back="/calendar"><Notice kind="danger">{q.error.message || t('errors.loadFailed')}</Notice></Screen>;

  async function askDelete() {
    try {
      const res = await withRelogin(() => api('GET', `/events/${id}/delete-preview`));
      setPreview(res.data);
    } catch (err) { showToast(err.message || t('errors.server')); }
  }

  async function remove() {
    setPreview(null);
    try {
      const res = await withRelogin(() => api('DELETE', `/events/${id}`, { ifMatch: e.version, idemKey: newIdemKey() }));
      qc.invalidateQueries({ queryKey: ['calendar'] });
      qc.invalidateQueries({ queryKey: ['events'] });
      if (res.meta.undo) showUndo({ batchId: res.meta.undo.batchId, summary: res.meta.undo.summary });
      navigate('/calendar', { replace: true });
    } catch (err) { showToast(err.message || t('errors.server')); }
  }

  const start = e.startAt ? istParts(e.startAt) : null;
  const end = e.endAt ? istParts(e.endAt) : null;
  const h = e.headcount;
  return (
    <Screen title={e.name} back="/calendar">
      <section className="flex flex-col gap-3 rounded-md bg-surface p-4 shadow-card">
        <p className="flex flex-wrap gap-2">
          <span className="rounded-full bg-primary-soft px-3 py-1 font-bold text-primary">{t(`events.types.${e.type}`)}</span>
          <span className="rounded-full bg-bg px-3 py-1">{t(`events.sides.${e.side}`)}</span>
        </p>
        <dl className="flex flex-col gap-2">
          <div>
            <dt className="text-sm text-text-muted">{t('events.date')}</dt>
            <dd className="text-lg">{e.startAt ? formatDate(e.startAt) : t('calendar.dateNotSet')}
              {start && !e.allDay && <> · {end ? `${formatHhmm(start.time)} – ${timeLabel(end.time)}` : timeLabel(start.time)}</>}
              {e.allDay && <> · {t('calendar.allDay')}</>}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-text-muted">{t('events.venue')}</dt>
            <dd className="text-lg">{[e.venueName, e.venueAddress].filter(Boolean).join(', ') || t('events.noVenue')}</dd>
          </div>
          {e.dressCode && <div><dt className="text-sm text-text-muted">{t('events.dress')}</dt><dd>{e.dressCode}</dd></div>}
          {e.notes && <div><dt className="text-sm text-text-muted">{t('events.notes')}</dt><dd className="whitespace-pre-line break-words">{e.notes}</dd></div>}
        </dl>
        {e.mapUrl && (
          <a href={e.mapUrl} target="_blank" rel="noopener noreferrer" className="tap inline-flex items-center gap-2 font-bold text-primary">
            <MapPin aria-hidden="true" size={20} /> {t('events.openMap')}
          </a>
        )}
      </section>

      <WhatsAppButton text={shareText(e)} label={t('events.share')} />

      {e.guestsInvited && (
        <section className="flex flex-col gap-1 rounded-md bg-surface p-4 shadow-card">
          <h2 className="text-lg font-bold">{t('events.headcount')}</h2>
          {h && h.familiesInvited > 0
            ? <p>{t('events.headcountLine', { coming: h.peopleComing, upTo: h.peopleUpTo, families: h.familiesInvited })}</p>
            : <p className="text-text-muted">{t('events.headcountSoon')}</p>}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">{t('events.tasks')}</h2>
        {tasks.data?.length > 0
          ? <ul className="overflow-hidden rounded-md bg-surface shadow-card">{tasks.data.map((task) => <TaskRow key={task.id} task={task} canEdit={permissions?.edit} onTick={(x) => markDone(qc, x)} />)}</ul>
          : tasks.isSuccess && <p className="text-text-muted">{t('events.noTasks')}</p>}
        {permissions?.edit && (
          <Button variant="secondary" onClick={() => navigate(`/tasks/new?event=${id}`)}><Plus aria-hidden="true" size={20} />{t('events.addTask')}</Button>
        )}
      </section>

      <div className="flex flex-col gap-3">
        <Link to={`/history/events/${id}`} className="tap inline-flex items-center justify-center gap-2 font-bold text-primary"><History aria-hidden="true" size={20} />{t('events.history')}</Link>
        {permissions?.admin ? (
          <>
            <Button variant="secondary" onClick={() => navigate(`/calendar/events/${id}/edit`)}><Pencil aria-hidden="true" size={20} />{t('events.edit')}</Button>
            <Button variant="danger" onClick={askDelete}><Trash2 aria-hidden="true" size={20} />{t('events.delete')}</Button>
          </>
        ) : <p className="text-center text-text-muted">{t('events.readOnly')}</p>}
      </div>

      {preview && (
        <ConfirmDialog
          title={t('events.deleteTitle', { name: e.name })}
          body={t('events.deleteBody', { tasks: preview.tasks, invitations: preview.invitations, payments: preview.payments })}
          confirmLabel={t('events.delete')} danger onConfirm={remove} onCancel={() => setPreview(null)}
        />
      )}
    </Screen>
  );
}
