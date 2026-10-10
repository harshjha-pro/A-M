// Home cards 2–8 (FEATURES B2). Each shows at most 5 items and links to the full list.
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { TriangleAlert, CircleCheck, CircleAlert, CircleMinus, Users } from 'lucide-react';
import Card from './Card.jsx';
import { TaskRow, markDone } from '../tasks/TaskList.jsx';
import { useSession } from '../../api/session.js';
import { formatInr, formatInrCompact } from '../../format/inr.js';
import { formatDateOnly } from '../../format/ist.js';
import { t } from '../../i18n/strings.en.js';

export function MyTasksCard({ data }) {
  const qc = useQueryClient();
  const { permissions } = useSession();
  return (
    <Card title={data.upcoming ? `${t('home.myTasks')} · ${t('home.upcoming')}` : t('home.myTasks')} to="/tasks?view=mine"
      seeAll={data.total > data.items.length ? t('home.seeAll', { n: data.total }) : null}>
      {data.items.length === 0
        ? <p className="text-text-muted">{t('home.myTasksNone')}</p>
        : <ul className="-mx-4 border-t border-border">{data.items.map((task) => <TaskRow key={task.id} task={task} canEdit={permissions?.edit} onTick={async (x) => { await markDone(qc, x); qc.invalidateQueries({ queryKey: ['dashboard'] }); }} />)}</ul>}
    </Card>
  );
}

export function OverdueCard({ data }) {
  const n = data.total;
  return (
    <Card title={t('home.overdueAll')}>
      {n === 0 ? <p className="text-text-muted">{t('home.overdueNone')}</p> : (
        <Link to="/tasks?view=overdue" className="tap inline-flex items-center gap-2 text-lg font-bold text-danger">
          <TriangleAlert aria-hidden="true" size={22} />{n === 1 ? t('home.overdueOne') : t('home.overdueN', { n })} →
        </Link>
      )}
    </Card>
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

export function ActivityCard({ data }) {
  return (
    <Card title={t('home.recent')} to="/settings/activity">
      <ul className="flex flex-col gap-2">
        {data.slice(0, 5).map((l, i) => <li key={`${l.at}-${i}`} className="text-sm">{l.sentence}</li>)}
      </ul>
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
