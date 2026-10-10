// Card 1 (FEATURES B2): "129 days to the wedding", "Day 1 of 3" during it, hidden after.
// The next event with date, time and venue; tap to open.
import { Link } from 'react-router-dom';
import { PartyPopper } from 'lucide-react';
import { formatDate, istParts, timeLabel } from '../../format/ist.js';
import { t } from '../../i18n/strings.en.js';

export default function Countdown({ data, name }) {
  const { daysToWedding: days, weddingDay: day, weddingDays: total, nextEvent: e } = data;
  return (
    <section className="flex flex-col gap-2 rounded-md bg-primary-soft p-4" aria-label={t('home.title')}>
      {name && <p className="text-lg">{t('home.hello', { name })}</p>}
      {days != null && <p className="text-3xl font-bold text-primary">{days === 1 ? t('home.dayOne') : t('home.daysTo', { n: days })}</p>}
      {day != null && <p className="text-3xl font-bold text-primary">{t('home.weddingDay', { n: day, total })}</p>}
      <p className="text-text-muted">{t('home.subtitle')}</p>
      {e && (
        <Link to={`/calendar/events/${e.id}`} className="mt-1 flex items-center gap-3 rounded-md bg-surface p-3">
          <PartyPopper aria-hidden="true" size={24} className="shrink-0 text-primary" />
          <span className="flex flex-col">
            <span className="font-bold">{t('home.nextEvent', { name: e.name })}</span>
            <span className="text-sm text-text-muted">
              {formatDate(e.startAt)}{!e.allDay && ` · ${timeLabel(istParts(e.startAt).time)}`}{e.venueName && ` · ${e.venueName}`}
            </span>
          </span>
        </Link>
      )}
    </section>
  );
}
