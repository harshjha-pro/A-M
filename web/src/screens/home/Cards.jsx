import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { TriangleAlert, CircleCheck, CircleAlert, CircleMinus, Users, ChevronDown, ChevronUp, ChevronRight, CalendarDays, Sun, Flag, Hourglass, Check, Shirt, Camera, UtensilsCrossed, Mail, Music, Sparkles, ListChecks, LogIn, LogOut, Activity } from 'lucide-react';
import Card from './Card.jsx';
import { eventArt, artForName } from './HomeTiles.jsx';
import HistoryList, { ActivityRow } from '../../components/HistoryList.jsx';
import { markDone } from '../tasks/TaskList.jsx';
import { useSession } from '../../api/session.js';
import { formatInr, formatInrCompact } from '../../format/inr.js';
import { formatDate, formatDateOnly, istParts, timeLabel } from '../../format/ist.js';
import { isClosed, dueText } from '../../data/tasks.js';
import { t } from '../../i18n/strings.en.js';

function TaskTimelineRow({ task, canEdit, onTick, isLast = false }) {
  const closed = isClosed(task);
  return (
    <li className={`relative flex items-start gap-3.5 ${!isLast ? 'pb-5' : 'pb-1'}`}>
      {/* Vertical connecting timeline line */}
      {!isLast && (
        <span
          className="absolute left-[11px] top-6 bottom-0 w-[2px] bg-[#861C32]/25"
          aria-hidden="true"
        />
      )}
      {/* Circle / Tick Node */}
      {canEdit && !closed ? (
        <button
          type="button"
          onClick={() => onTick(task)}
          aria-label={t('tasks.markDone', { title: task.title })}
          className="tap relative z-10 grid size-6 shrink-0 place-items-center rounded-full border-2 border-[#861C32] bg-white ring-4 ring-[#861C32]/10 transition-transform hover:scale-110 active:scale-95 mt-0.5"
        >
          <span className="size-1.5 rounded-full bg-transparent" />
        </button>
      ) : (
        <span
          className={`relative z-10 grid size-6 shrink-0 place-items-center rounded-full border-2 mt-0.5 ${
            task.status === 'done'
              ? 'border-success bg-success text-white'
              : 'border-[#861C32] bg-white'
          }`}
          aria-hidden="true"
        >
          {task.status === 'done' ? (
            <Check size={14} strokeWidth={3} />
          ) : (
            <span className="size-1.5 rounded-full bg-transparent" />
          )}
        </span>
      )}
      {/* Task Content */}
      <Link to={`/tasks/${task.id}`} className="group flex min-w-0 flex-1 flex-col">
        {/* Title */}
        <span className={`text-base font-bold leading-snug text-text transition group-hover:text-primary ${closed ? 'text-text-muted line-through' : ''}`}>
          {task.title}
        </span>
        {/* Code */}
        <span className="font-mono text-xs text-text-muted tracking-wide mt-0.5">
          {task.code || `TSK-${task.id.slice(-6).toUpperCase()}`}
        </span>
        {/* Badges */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs">
          {task.overdue && (
            <span className="inline-flex items-center gap-1 font-bold text-danger">
              <TriangleAlert aria-hidden="true" size={13} strokeWidth={2.5} />
              {t('tasks.overdue')}
            </span>
          )}
          {!task.overdue && task.dueToday && (
            <span className="inline-flex items-center gap-1 font-bold text-warning">
              <Sun aria-hidden="true" size={13} strokeWidth={2.5} />
              {t('tasks.today')}
            </span>
          )}
          {task.priority === 'urgent' && (
            <span className="inline-flex items-center gap-1 font-bold text-[#861C32]">
              <Flag aria-hidden="true" size={13} strokeWidth={2.5} />
              {t('tasks.priority.urgent')}
            </span>
          )}
          {task.status === 'waiting' && (
            <span className="inline-flex items-center gap-1 text-text-muted">
              <Hourglass aria-hidden="true" size={13} />
              {t('tasks.status.waiting')}
            </span>
          )}
        </div>
        {/* Date & Assignees */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-text-muted">
          {(task.dueDate || dueText(task)) && (
            <span className="inline-flex items-center gap-1">
              <CalendarDays aria-hidden="true" size={13} />
              {task.dueDate ? formatDateOnly(task.dueDate) : dueText(task)}
            </span>
          )}
          {task.assignees?.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Users aria-hidden="true" size={13} />
              {task.assignees.map((a) => a.name).join(', ')}
            </span>
          )}
          {task.itemCount > 0 && (
            <span>
              · ☑ {t('tasks.items', { done: task.itemsDone, n: task.itemCount })}
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}

export function MyTasksCard({ data }) {
  const qc = useQueryClient();
  const { permissions } = useSession();
  const title = data.upcoming ? `${t('home.myTasks')} · ${t('home.upcoming')}` : t('home.myTasks');
  const countLabel = data.total === 1 ? '1 task' : `${data.total} tasks`;
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-surface p-4 sm:p-5 shadow-card border border-black/5" aria-label={title}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-xl sm:text-2xl font-bold text-text">
          <Link to="/tasks?view=mine" className="hover:underline">
            {title}
          </Link>
        </h2>
        <Link to="/tasks?view=mine" className="text-sm font-medium text-text-muted hover:text-primary hover:underline">
          {countLabel}
        </Link>
      </div>
      {data.items.length === 0 ? (
        <p className="text-text-muted">{t('home.myTasksNone')}</p>
      ) : (
        <ul className="flex flex-col pt-1">
          {data.items.map((task, i) => (
            <TaskTimelineRow
              key={task.id}
              task={task}
              canEdit={permissions?.edit}
              isLast={i === data.items.length - 1}
              onTick={async (x) => {
                await markDone(qc, x);
                qc.invalidateQueries({ queryKey: ['dashboard'] });
              }}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function getOverdueTaskIcon(title = '') {
  const t = title.toLowerCase();
  if (t.includes('guest') || t.includes('family') || t.includes('people') || t.includes('attendee') || t.includes('headcount')) return Users;
  if (t.includes('sherwani') || t.includes('fitting') || t.includes('outfit') || t.includes('dress') || t.includes('cloth') || t.includes('lehenga') || t.includes('suit')) return Shirt;
  if (t.includes('photo') || t.includes('camera') || t.includes('video') || t.includes('shoot') || t.includes('film')) return Camera;
  if (t.includes('cater') || t.includes('menu') || t.includes('food') || t.includes('dinner') || t.includes('lunch') || t.includes('cake') || t.includes('sweet') || t.includes('tasting')) return UtensilsCrossed;
  if (t.includes('invit') || t.includes('card') || t.includes('mail') || t.includes('send') || t.includes('whatsapp') || t.includes('rsvp') || t.includes('letter')) return Mail;
  if (t.includes('music') || t.includes('dj') || t.includes('sound') || t.includes('dance') || t.includes('song') || t.includes('band')) return Music;
  if (t.includes('decor') || t.includes('flower') || t.includes('stage') || t.includes('light') || t.includes('jewel') || t.includes('ring') || t.includes('boutique') || t.includes('makeup')) return Sparkles;
  return ListChecks;
}

function formatOverdueDate(dateStr) {
  if (!dateStr) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr));
  if (!m) return dateStr;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = parseInt(m[3], 10);
  const month = months[parseInt(m[2], 10) - 1];
  return `${day} ${month}`;
}

export function OverdueCard({ data }) {
  const n = data?.total ?? 0;
  const items = data?.items ?? [];

  return (
    <section
      className="flex flex-col gap-3 rounded-3xl bg-white/70 p-4 sm:p-5 shadow-xs border border-black/5"
      aria-label={t('home.overdueAll')}
    >
      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg font-bold text-text tracking-tight">{t('home.overdueAll')}</h2>
        {n === 0 ? (
          <p className="text-text-muted text-sm">{t('home.overdueNone')}</p>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <Link
              to="/tasks?view=overdue"
              className="inline-flex items-center gap-1.5 font-bold text-danger hover:underline text-sm sm:text-base"
            >
              <TriangleAlert aria-hidden="true" size={18} className="shrink-0 text-danger stroke-[2.2]" />
              <span>{n === 1 ? t('home.overdueOne') : t('home.overdueN', { n })}</span>
            </Link>
            <Link
              to="/tasks?view=overdue"
              className="text-xs sm:text-sm font-semibold text-[#861C32] hover:underline shrink-0"
            >
              See all overdue tasks →
            </Link>
          </div>
        )}
      </div>

      {n > 0 && items.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 pt-1">
          {items.slice(0, 6).map((task) => {
            const Icon = getOverdueTaskIcon(task.title);
            const dueLabel = formatOverdueDate(task.dueDate || task.due_date);
            const code = task.code || (task.id ? `TSK-${task.id.slice(-6).toUpperCase()}` : '');
            return (
              <Link
                key={task.id}
                to={`/tasks/${task.id}`}
                className="group flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-2xl bg-white/80 border border-stone-200/70 shadow-xs hover:border-[#861C32]/30 hover:shadow-sm transition-all min-w-0"
              >
                <div className="size-10 sm:size-11 rounded-full bg-[#FBE4E2] text-[#E03137] flex items-center justify-center shrink-0">
                  <Icon size={18} className="sm:size-5" />
                </div>
                <div className="flex flex-col min-w-0 flex-1 leading-snug">
                  <span className="font-bold text-xs sm:text-sm text-text truncate group-hover:text-[#861C32] transition-colors">
                    {task.title}
                  </span>
                  {code && (
                    <span className="text-[11px] sm:text-xs text-text-muted font-mono tracking-tight">
                      {code}
                    </span>
                  )}
                  {dueLabel && (
                    <span className="text-xs font-bold text-[#E03137]">
                      {dueLabel}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function HeadcountCard({ data }) {
  const any = data.some((h) => h.familiesInvited > 0);
  return (
    <Card title={t('home.headcount')}>
      {!any ? <p className="text-text-muted">{t('home.noGuestsYet')}</p> : (
        <ul className="flex flex-col gap-2">
          {data.filter((h) => h.familiesInvited > 0).slice(0, 5).map((h) => (
            <li key={h.event.id}>
              <Link to={`/calendar/events/${h.event.id}`} className="flex flex-col">
                <span className="inline-flex items-center gap-2 font-bold"><Users aria-hidden="true" size={18} />{h.event.name}</span>
                <span className="text-sm">{t('home.headcountLine', { coming: h.peopleComing, waiting: h.peopleWaiting, notAsked: h.peopleNotAsked })}{h.jainComing > 0 && ` · ${t('home.jain', { n: h.jainComing })}`}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function PaymentsCard({ data }) {
  return (
    <Card title={t('home.paymentsDue')} to="/money" seeAll={data.total > data.items.length ? t('home.seeAll', { n: data.total }) : null}>
      {data.total === 0 ? <p className="text-text-muted">{t('home.paymentsNone', { days: data.windowDays })}</p> : (
        <>
          <p className="font-bold">{t('home.paymentsDueTotal', { n: data.total, days: data.windowDays, total: formatInr(data.totalPaise) })}</p>
          <ul className="flex flex-col gap-1">
            {data.items.map((p) => (
              <li key={p.id} className="flex justify-between gap-2">
                <span className="min-w-0 truncate">{p.vendor?.name ?? p.title}{p.overdue && <span className="ml-2 font-bold text-danger">{t('tasks.overdue')}</span>}</span>
                <span className="shrink-0 text-right">{formatInrCompact(p.amountPaise)} · <span className="text-text-muted">{formatDateOnly(p.dueDate).slice(5, 11)}</span></span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

export function BudgetCard({ data }) {
  const used = data.plannedPaise > 0 ? Math.min(100, Math.round(((data.spentPaise + data.stillToPayPaise) * 100) / data.plannedPaise)) : 0;
  const spent = data.plannedPaise > 0 ? Math.min(100, Math.round((data.spentPaise * 100) / data.plannedPaise)) : 0;
  return (
    <Card title={t('home.budget')} to="/money">
      <dl className="grid grid-cols-2 gap-2">
        <div><dt className="text-sm text-text-muted">{t('home.planned')}</dt><dd className="font-bold">{formatInrCompact(data.plannedPaise)}</dd></div>
        <div><dt className="text-sm text-text-muted">{t('home.spent')}</dt><dd className="font-bold">{formatInrCompact(data.spentPaise)}</dd></div>
        <div><dt className="text-sm text-text-muted">{t('home.stillToPay')}</dt><dd className="font-bold">{formatInrCompact(data.stillToPayPaise)}</dd></div>
        <div><dt className="text-sm text-text-muted">{t('home.free')}</dt>
          <dd className={`font-bold ${data.freePaise < 0 ? 'text-danger' : ''}`}>{data.freePaise < 0 ? t('home.overBy', { amount: formatInrCompact(-data.freePaise) }) : formatInrCompact(data.freePaise)}</dd></div>
      </dl>
      <div className="h-3 overflow-hidden rounded-full bg-bg" role="img" aria-label={`${t('home.spent')} ${spent}%, ${t('home.stillToPay')} ${used - spent}%`}>
        <div className="flex h-full"><div className="bg-primary" style={{ width: `${spent}%` }} /><div className="bg-warning" style={{ width: `${used - spent}%` }} /></div>
      </div>
    </Card>
  );
}

const TONE = { green: ['text-success', CircleCheck], amber: ['text-warning', TriangleAlert], red: ['text-danger', CircleAlert], not_in_use: ['text-text-muted', CircleMinus] };

function Line({ status, children }) {
  const [cls, Icon] = TONE[status] ?? TONE.not_in_use;
  return <li className={`flex items-center gap-2 ${status === 'red' ? 'font-bold' : ''}`}><Icon aria-hidden="true" size={20} className={`shrink-0 ${cls}`} /><span>{children}</span></li>;
}

export function SafetyCard({ data }) {
  const b = data.checks.backup ?? { status: 'not_in_use' };
  const d = data.checks.restoreDrill ?? { status: 'not_in_use' };
  return (
    <Card title={t('home.safety')} to="/settings/safety">
      <ul className="flex flex-col gap-2">
        <Line status={b.status}>{b.status === 'not_in_use' && !b.lastOkAt ? t('home.backupOff') : b.lastOkAt ? t('home.lastBackup', { hours: Math.round(b.hoursAgo) }) : t('home.noBackup')}</Line>
        <Line status={d.status}>{d.lastPassedOn ? t('home.lastDrill', { days: d.daysAgo }) : t('home.noDrill')}</Line>
        <Line status={data.checks.database?.status ?? 'green'}>{t('home.server')}: {data.checks.database?.status === 'red' ? t('home.serverFail') : t('home.serverOk')}</Line>
        {data.trashBatches > 0 && <li><Link to="/settings/deleted" className="text-primary underline">{t('home.trashItems', { n: data.trashBatches })}</Link></li>}
      </ul>
    </Card>
  );
}

/** Home: upcoming dated events in an alternating zig-zag pill layout matching reference design */
export function UpcomingEventsCard({ data }) {
  return (
    <section className="flex flex-col gap-3" aria-label={t('home.upcomingEvents')}>
      <div className="flex items-baseline justify-between px-1">
        <h2 className="font-display text-xl sm:text-2xl font-bold text-[#861C32]">
          <Link to="/calendar" className="hover:underline">
            {t('home.upcomingEvents')}
          </Link>
        </h2>
      </div>
      {data.length === 0 ? (
        <p className="text-text-muted px-1">{t('home.noUpcoming')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((e, i) => {
            const isEven = i % 2 === 0;
            const img = e.coverUrl || e.imageUrl || artForName(e.name, e.type);
            return (
              <li key={e.id} className={`w-full ${isEven ? 'flex justify-end' : 'flex justify-start'}`}>
                <Link
                  to={`/calendar/events/${e.id}`}
                  className="group flex items-center gap-3 w-[94%] sm:w-[90%] rounded-[1.75rem] bg-surface/90 p-2.5 sm:p-3 shadow-card border border-white/70 backdrop-blur-sm transition-all duration-200 hover:shadow-md active:scale-[0.99]"
                >
                  {isEven ? (
                    <>
                      <div className="flex min-w-0 flex-1 flex-col items-end text-right">
                        <span className="w-full truncate font-bold text-base text-[#861C32] leading-tight">
                          {e.name}
                        </span>
                        <span className="w-full truncate text-xs sm:text-[0.82rem] text-[#5E5048] leading-tight mt-0.5">
                          {formatDate(e.startAt)}{!e.allDay && ` · ${timeLabel(istParts(e.startAt).time)}`}
                        </span>
                        {e.venueName && (
                          <span className="w-full truncate text-xs text-[#8C7A68] leading-tight mt-0.5">
                            {e.venueName}
                          </span>
                        )}
                      </div>
                      <img
                        src={img}
                        alt=""
                        width={56}
                        height={56}
                        className="size-14 sm:size-16 shrink-0 rounded-2xl object-cover shadow-xs border border-white/60 transition-transform duration-300 group-hover:scale-105"
                      />
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#861C32]/10 text-[#861C32]">
                        <ChevronRight aria-hidden="true" size={15} strokeWidth={2.5} />
                      </span>
                    </>
                  ) : (
                    <>
                      <img
                        src={img}
                        alt=""
                        width={56}
                        height={56}
                        className="size-14 sm:size-16 shrink-0 rounded-2xl object-cover shadow-xs border border-white/60 transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="flex min-w-0 flex-1 flex-col items-start text-left">
                        <span className="w-full truncate font-bold text-base text-[#861C32] leading-tight">
                          {e.name}
                        </span>
                        <span className="w-full truncate text-xs sm:text-[0.82rem] text-[#5E5048] leading-tight mt-0.5">
                          {formatDate(e.startAt)}{!e.allDay && ` · ${timeLabel(istParts(e.startAt).time)}`}
                        </span>
                        {e.venueName && (
                          <span className="w-full truncate text-xs text-[#8C7A68] leading-tight mt-0.5">
                            {e.venueName}
                          </span>
                        )}
                      </div>
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#861C32]/10 text-[#861C32] ml-auto">
                        <ChevronRight aria-hidden="true" size={15} strokeWidth={2.5} />
                      </span>
                    </>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Ayush and Mahi only: the last 3 changes; Show more opens a scrolling list with older ones. */
function getActivityIcon(sentence = '') {
  const s = sentence.toLowerCase();
  if (s.includes('wrong password') || s.includes('failed') || s.includes('alert') || s.includes('warn') || s.includes('error')) {
    return { Icon: TriangleAlert, tone: 'danger' };
  }
  if (s.includes('done') || s.includes('marked') || s.includes('complete')) {
    return { Icon: Check, tone: 'primary' };
  }
  if (s.includes('sherwani') || s.includes('fitting') || s.includes('outfit') || s.includes('dress') || s.includes('cloth') || s.includes('lehenga') || s.includes('suit')) {
    return { Icon: Shirt, tone: 'primary' };
  }
  if (s.includes('guest') || s.includes('member') || s.includes('family') || s.includes('user') || s.includes('people') || s.includes('headcount')) {
    return { Icon: Users, tone: 'primary' };
  }
  if (s.includes('logged in') || s.includes('login') || s.includes('signed in')) {
    return { Icon: LogIn, tone: 'primary' };
  }
  if (s.includes('logged out') || s.includes('logout') || s.includes('signed out')) {
    return { Icon: LogOut, tone: 'primary' };
  }
  if (s.includes('photo') || s.includes('image') || s.includes('cover')) {
    return { Icon: Camera, tone: 'primary' };
  }
  return { Icon: Activity, tone: 'primary' };
}

function CompactTimelineRow({ line, isLast = false }) {
  const { Icon, tone } = getActivityIcon(line.sentence);
  const isDanger = tone === 'danger';

  return (
    <li className={`relative flex items-center gap-3.5 ${!isLast ? 'pb-4' : 'pb-1'}`}>
      {/* Vertical connecting line */}
      {!isLast && (
        <span
          className="absolute left-[4.5px] top-3.5 bottom-0 w-[1.5px] bg-[#861C32]/25"
          aria-hidden="true"
        />
      )}

      {/* Solid burgundy node dot */}
      <span
        className="relative z-10 size-2.5 rounded-full bg-[#861C32] shrink-0 ring-4 ring-[#FAF6F0]"
        aria-hidden="true"
      />

      {/* Circular blush pink icon badge */}
      <div
        className={`size-10 sm:size-11 rounded-full flex items-center justify-center shrink-0 shadow-xs ${
          isDanger
            ? 'bg-red-100 text-[#E03137]'
            : 'bg-[#FBE4E2] text-[#861C32]'
        }`}
      >
        <Icon size={19} className="stroke-[2.2]" />
      </div>

      {/* Activity Sentence */}
      <p className="text-xs sm:text-sm text-text font-normal leading-snug flex-1 min-w-0">
        {line.sentence}
      </p>
    </li>
  );
}

export function ActivityCard({ data }) {
  const [open, setOpen] = useState(false);
  const topItems = data.slice(0, 3);

  return (
    <Card title={t('home.recent')} to="/settings/activity">
      {!open && (
        <ul className="flex flex-col pt-1">
          {topItems.map((l, i) => (
            <CompactTimelineRow key={`${l.at}-${i}`} line={l} isLast={i === topItems.length - 1} />
          ))}
        </ul>
      )}
      {open && (
        <div className="-mx-1 max-h-96 overflow-y-auto overscroll-contain px-1" data-testid="activity-scroll" tabIndex={0} aria-label={t('home.recent')}>
          <HistoryList path="/activity" />
        </div>
      )}
      <button
        type="button"
        className="tap inline-flex items-center gap-1.5 self-start font-bold text-xs sm:text-sm text-[#861C32] hover:underline pt-2"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronUp aria-hidden="true" size={18} strokeWidth={2.5} /> : <ChevronDown aria-hidden="true" size={18} strokeWidth={2.5} />}
        {open ? t('home.showLess') : t('home.showMore')}
      </button>
    </Card>
  );
}

const START_LINKS = { event_dates: '/calendar', members: '/settings/members/new', guests: '/guests', payment: '/money' };

export function StartHere({ data }) {
  if (data.every((s) => s.done)) return null;
  return (
    <Card title={t('home.startHere')}>
      <ul className="flex flex-col gap-2">
        {data.map((s) => (
          <li key={s.key}>
            <Link to={START_LINKS[s.key]} className={`tap inline-flex items-center gap-2 ${s.done ? 'text-text-muted line-through' : 'font-bold text-primary'}`}>
              <span aria-hidden="true">{s.done ? '✓' : '○'}</span>{t(`home.start.${s.key}`)}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
