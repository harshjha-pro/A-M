// One calendar line (FEATURES B4): each type has its own icon AND word, never colour alone.
import { Link } from 'react-router-dom';
import { PartyPopper, ListChecks, IndianRupee, TriangleAlert } from 'lucide-react';
import { timeLabel, formatDateOnly } from '../../format/ist.js';
import { t } from '../../i18n/strings.en.js';

const KIND = {
  event: { Icon: PartyPopper, cls: 'bg-primary-soft text-primary', to: (i) => `/calendar/events/${i.id}` },
  task: { Icon: ListChecks, cls: 'bg-info-soft text-text', to: (i) => `/tasks/${i.id}` },
  payment: { Icon: IndianRupee, cls: 'bg-warning-soft text-text', to: () => '/money' },
};

export function ItemRow({ item }) {
  const k = KIND[item.type];
  return (
    <li className="border-b border-border last:border-b-0">
      <Link to={k.to(item)} className="flex min-h-16 items-center gap-3 px-4 py-2">
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${k.cls}`} aria-hidden="true"><k.Icon size={20} /></span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-lg font-bold">{item.title}</span>
          <span className="flex flex-wrap gap-x-2 text-sm text-text-muted">
            <span className="font-bold">{t(`calendar.type.${item.type}`)}</span>
            <span>{item.time ? timeLabel(item.time) : item.type === 'event' ? t('calendar.allDay') : ''}</span>
            {item.overdue && <span className="inline-flex items-center gap-1 font-bold text-danger"><TriangleAlert aria-hidden="true" size={14} />{t('tasks.overdue')}</span>}
            {item.linkedEvent && <span>· {item.linkedEvent.name}{item.linkedEvent.deleted ? ' (deleted event)' : ''}</span>}
          </span>
        </span>
      </Link>
    </li>
  );
}

export function DayList({ day }) {
  return (
    <section className="flex flex-col gap-2" aria-label={formatDateOnly(day.date)}>
      <h2 className="text-lg font-bold">{formatDateOnly(day.date)}</h2>
      <ul className="overflow-hidden rounded-md bg-surface shadow-card">
        {day.items.map((i) => <ItemRow key={`${i.type}-${i.id}`} item={i} />)}
      </ul>
    </section>
  );
}

export function UndatedList({ events }) {
  if (!events?.length) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-bold">{t('calendar.dateNotSet')}</h2>
      <ul className="overflow-hidden rounded-md bg-surface shadow-card">
        {events.map((e) => (
          <ItemRow key={e.id} item={{ type: 'event', id: e.id, title: e.name, time: null, overdue: false, linkedEvent: null, allDay: true, dateNotSet: true }} />
        ))}
      </ul>
    </section>
  );
}
