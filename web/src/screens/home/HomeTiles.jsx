// Home under the photo (1.0.23 redesign, owner's reference): the next event card and the
// four tiles (Tasks · Guests · Budget · Vendors). Budget only for people who see money.
import { Link } from 'react-router-dom';
import { ListChecks, Users, Coins, Store } from 'lucide-react';
import { formatDate, istParts, timeLabel } from '../../format/ist.js';
import { t } from '../../i18n/strings.en.js';

const ART = ['engagement', 'roka', 'haldi', 'mehndi', 'sangeet', 'mayra', 'wedding', 'reception'];
/** Drawn picture for an event type (public/art), used until events have photos. */
export const eventArt = (type) => `/art/${ART.includes(type) ? type : 'other'}.webp`;

const BY_NAME = [[/engage|ring|sagai/i, 'engagement'], [/roka|tilak/i, 'roka'], [/haldi|ban/i, 'haldi'], [/mehndi|mehendi/i, 'mehndi'],
  [/sangeet|dj|night|carnival|party/i, 'sangeet'], [/mayra|mamera|bhaat/i, 'mayra'], [/phere|varmala|wedding|shaadi|vivah/i, 'wedding'], [/reception/i, 'reception']];
/** Picture for a workspace or event by its name (Mehndi, DJ Night, Varmala & Phere…). */
export const artForName = (name, type = null) => eventArt(type ?? BY_NAME.find(([re]) => re.test(name || ''))?.[1]);

function daysUntil(iso) {
  const today = istParts(new Date().toISOString()).date;
  const day = istParts(iso).date;
  return Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

export function NextEventCard({ event }) {
  if (!event?.startAt) return null;
  const n = daysUntil(event.startAt);
  const bgImg = event.coverUrl || event.imageUrl || artForName(event.name, event.type);
  return (
    <Link
      to={`/calendar/events/${event.id}`}
      className="group relative block w-full overflow-hidden rounded-2xl shadow-card transition-all duration-300 hover:shadow-lg active:scale-[0.99] aspect-[16/9] min-h-[160px] max-h-[220px]"
      aria-label={`${t('home.nextEvent2')}: ${event.name}`}
    >
      <img
        src={bgImg}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none"
        aria-hidden="true"
      />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-white sm:p-5">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs sm:text-sm font-medium text-white/90 drop-shadow-xs">
            {t('home.nextEvent2')}
          </span>
          <span className="truncate text-lg sm:text-xl font-bold text-white drop-shadow-sm leading-snug">
            {event.name}
          </span>
          <span className="truncate text-xs sm:text-sm text-white/85 drop-shadow-xs mt-0.5">
            {formatDate(event.startAt)}{!event.allDay && ` • ${timeLabel(istParts(event.startAt).time)}`}
          </span>
        </div>
        <span className="shrink-0 rounded-full bg-[#861C32]/80 border border-white/40 px-3.5 py-1 text-xs sm:text-sm font-semibold text-white shadow-xs backdrop-blur-md">
          {n <= 0 ? t('home.today2') : n === 1 ? t('home.inDay') : t('home.inDays', { n })}
        </span>
      </div>
    </Link>
  );
}

function SegmentedProgress({ percent = 0 }) {
  const p = Math.min(100, Math.max(0, percent));
  const segments = [0, 1, 2, 3].map((i) => {
    const start = i * 25;
    return Math.min(100, Math.max(0, ((p - start) / 25) * 100));
  });
  return (
    <div className="flex w-full gap-1.5 mt-3" aria-hidden="true">
      {segments.map((fill, i) => (
        <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#F3DCD7]">
          <div
            className="h-full rounded-full bg-[#861C32] transition-all duration-500"
            style={{ width: `${fill}%` }}
          />
        </div>
      ))}
    </div>
  );
}

function Tile({ to, Icon, value, label, sub, percent = 0, className = '' }) {
  return (
    <li className={className}>
      <Link
        to={to}
        className="group flex h-full flex-col justify-between rounded-2xl bg-surface p-3.5 sm:p-4 shadow-card border border-black/5 transition-all duration-200 hover:shadow-md active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-soft text-primary transition-transform duration-300 group-hover:scale-105">
            <Icon aria-hidden="true" size={22} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="sr-only">{value}</span>
            <span className="truncate text-sm sm:text-base font-bold text-text">
              {label}
            </span>
            <span className="truncate text-xs sm:text-[0.82rem] text-text-muted mt-0.5">
              {sub}
            </span>
          </div>
        </div>
        <SegmentedProgress percent={percent} />
      </Link>
    </li>
  );
}

export function StatTiles({ stats, budget }) {
  if (!stats) return null;
  const spent = budget?.plannedPaise > 0 ? Math.min(999, Math.round((budget.spentPaise * 100) / budget.plannedPaise)) : null;

  // Calculate progress percentages for the 4 tiles
  const totalTasks = (stats.tasksOpen || 0) + (stats.tasksDone || 0);
  const tasksPercent = totalTasks > 0 ? Math.round(((stats.tasksDone || 0) / totalTasks) * 100) : 0;
  const guestsPercent = stats.families > 0 ? Math.min(100, Math.round(((stats.people || 0) / (stats.families * 4)) * 100)) : 50;
  const budgetPercent = spent == null ? 0 : Math.min(100, spent);
  const vendorsPercent = Math.min(100, (stats.vendors || 0) * 8);

  return (
    <section aria-label={t('home.tiles')}>
      <ul className="grid grid-cols-2 gap-2.5 sm:gap-3">
        <Tile
          to="/tasks"
          Icon={ListChecks}
          value={stats.tasksOpen}
          label={t('home.tileTasks')}
          sub={`${stats.tasksOpen} open · ${t('home.tileTasksSub', { n: stats.tasksDone })}`}
          percent={tasksPercent}
        />
        <Tile
          to="/guests"
          Icon={Users}
          value={stats.families}
          label={t('home.tileGuests')}
          sub={`${stats.families} families · ${t('home.tileGuestsSub', { n: stats.people })}`}
          percent={guestsPercent}
        />
        {budget && (
          <Tile
            to="/money"
            Icon={Coins}
            value={spent == null ? '—' : `${spent}%`}
            label={t('home.tileBudget')}
            sub={spent == null ? '—' : `${spent}% ${t('home.tileBudgetSub')}`}
            percent={budgetPercent}
          />
        )}
        <Tile
          to="/vendors"
          Icon={Store}
          value={stats.vendors}
          label={t('home.tileVendors')}
          sub={`${stats.vendors} booked`}
          percent={vendorsPercent}
          className={!budget ? 'col-span-2 sm:col-span-1' : ''}
        />
      </ul>
    </section>
  );
}

