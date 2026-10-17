// Home under the photo (1.0.23 redesign, owner's reference): the next event card and the
// four tiles (Tasks · Guests · Budget · Vendors). Budget only for people who see money.
import { Link } from 'react-router-dom';
import { ListChecks, Users, IndianRupee, Store } from 'lucide-react';
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
  return (
    <Link to={`/calendar/events/${event.id}`} className="flex items-center gap-3 rounded-lg bg-surface p-3 shadow-card" aria-label={`${t('home.nextEvent2')}: ${event.name}`}>
      <img src={eventArt(event.type)} alt="" width={72} height={72} className="size-[4.5rem] shrink-0 rounded-md object-cover" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm text-text-muted">{t('home.nextEvent2')}</span>
        <span className="truncate text-lg font-bold">{event.name}</span>
        <span className="truncate text-sm text-text-muted">{formatDate(event.startAt)}{!event.allDay && ` · ${timeLabel(istParts(event.startAt).time)}`}</span>
      </span>
      <span className="shrink-0 rounded-full bg-primary-soft px-3 py-1 text-sm font-bold text-primary">
        {n <= 0 ? t('home.today2') : n === 1 ? t('home.inDay') : t('home.inDays', { n })}
      </span>
    </Link>
  );
}

function Tile({ to, Icon, value, label, sub }) {
  return (
    <li>
      <Link to={to} className="flex h-full flex-col items-center gap-1 rounded-lg bg-surface px-1 py-3 text-center shadow-card">
        <span className="grid size-11 place-items-center rounded-full bg-primary-soft text-primary"><Icon aria-hidden="true" size={22} /></span>
        <span className="font-display text-2xl leading-none text-primary">{value}</span>
        <span className="text-sm font-bold">{label}</span>
        {sub && <span className="text-xs text-text-muted">{sub}</span>}
      </Link>
    </li>
  );
}

export function StatTiles({ stats, budget }) {
  if (!stats) return null;
  const spent = budget?.plannedPaise > 0 ? Math.min(999, Math.round((budget.spentPaise * 100) / budget.plannedPaise)) : null;
  return (
    <section aria-label={t('home.tiles')}>
      <ul className={`grid gap-2 ${budget ? 'grid-cols-4' : 'grid-cols-3'}`}>
        <Tile to="/tasks" Icon={ListChecks} value={stats.tasksOpen} label={t('home.tileTasks')} sub={t('home.tileTasksSub', { n: stats.tasksDone })} />
        <Tile to="/guests" Icon={Users} value={stats.families} label={t('home.tileGuests')} sub={t('home.tileGuestsSub', { n: stats.people })} />
        {budget && <Tile to="/money" Icon={IndianRupee} value={spent == null ? '—' : `${spent}%`} label={t('home.tileBudget')} sub={t('home.tileBudgetSub')} />}
        <Tile to="/vendors" Icon={Store} value={stats.vendors} label={t('home.tileVendors')} />
      </ul>
    </section>
  );
}

