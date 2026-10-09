// Calendar (FEATURES B4): Agenda (default) from today, grouped by IST day, "Date not
// set" events on top, 60 days at a time with Show past / Show later; Month view with up
// to 3 dots per day and "+n"; filters Events / Tasks / Payments ($) and Only mine.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import ChipFilter from '../../components/ChipFilter.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import AddButton from '../../components/AddButton.jsx';
import { Notice } from '../../components/Field.jsx';
import { addDays } from '../../components/DateField.jsx';
import { api } from '../../api/client.js';
import { useSession } from '../../api/session.js';
import { todayIst, formatMonth } from '../../format/ist.js';
import { DayList, UndatedList } from './CalendarItems.jsx';
import { t } from '../../i18n/strings.en.js';

const PAGE = 60;

function useCalendar(from, to, types, mine, undated) {
  return useQuery({
    queryKey: ['calendar', from, to, types.join(','), mine, undated],
    queryFn: () => api('GET', '/calendar', { query: { from, to, types: types.join(','), mine: mine ? 'true' : undefined, includeUndated: undated ? 'true' : undefined } }).then((r) => r.data),
    enabled: types.length > 0,
  });
}

function Toggles({ types, setTypes, mine, setMine, money }) {
  const all = ['event', 'task', ...(money ? ['payment'] : [])];
  const toggle = (k) => setTypes(types.includes(k) ? types.filter((x) => x !== k) : [...types, k]);
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={t('calendar.show')}>
      {all.map((k) => (
        <button key={k} type="button" aria-pressed={types.includes(k)} onClick={() => toggle(k)}
          className={`tap inline-flex items-center gap-1 rounded-sm border-[1.5px] px-3 ${types.includes(k) ? 'border-primary bg-primary-soft font-bold text-primary' : 'border-border-strong bg-surface'}`}>
          {types.includes(k) && <span aria-hidden="true">✓</span>}{t(`calendar.${k}s`)}
        </button>
      ))}
      <button type="button" aria-pressed={mine} onClick={() => setMine(!mine)}
        className={`tap inline-flex items-center gap-1 rounded-sm border-[1.5px] px-3 ${mine ? 'border-primary bg-primary-soft font-bold text-primary' : 'border-border-strong bg-surface'}`}>
        {mine && <span aria-hidden="true">✓</span>}{t('calendar.onlyMine')}
      </button>
    </div>
  );
}

function Agenda({ types, mine }) {
  const today = todayIst();
  const [past, setPast] = useState(0);   // pages of 60 days before today
  const [later, setLater] = useState(0); // extra pages after the first
  const ranges = useMemo(() => {
    const out = [];
    for (let i = past; i >= 1; i--) out.push([addDays(today, -PAGE * i), addDays(today, -PAGE * (i - 1) - 1)]);
    for (let i = 0; i <= later; i++) out.push([addDays(today, PAGE * i), addDays(today, PAGE * (i + 1) - 1)]);
    return out;
  }, [today, past, later]);
  return (
    <div className="flex flex-col gap-5">
      <button type="button" className="tap self-start font-bold text-primary" onClick={() => setPast(past + 1)}>{t('calendar.showPast')}</button>
      {ranges.map(([from, to], i) => <AgendaPage key={from} from={from} to={to} types={types} mine={mine} undated={from === today} first={i === past} />)}
      <button type="button" className="tap self-start font-bold text-primary" onClick={() => setLater(later + 1)}>{t('calendar.showLater')}</button>
    </div>
  );
}

function AgendaPage({ from, to, types, mine, undated, first }) {
  const q = useCalendar(from, to, types, mine, undated && types.includes('event'));
  if (q.isPending) return <p aria-busy="true">…</p>;
  if (q.isError) return <Notice kind="danger">{q.error.message || t('errors.loadFailed')}</Notice>;
  const nothing = q.data.days.length === 0 && !(q.data.undated ?? []).length;
  return (
    <>
      <UndatedList events={q.data.undated} />
      {q.data.days.map((d) => <DayList key={d.date} day={d} />)}
      {nothing && first && <EmptyState Icon={CalendarDays} text={t('calendar.empty')} />}
    </>
  );
}

function monthGrid(ym) {
  const [y, m] = ym.split('-').map(Number);
  const first = `${ym}-01`;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Monday first
  return { first, last: `${ym}-${String(days).padStart(2, '0')}`, days, lead };
}

function shiftMonth(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

function Month({ types, mine }) {
  const today = todayIst();
  const [ym, setYm] = useState(today.slice(0, 7));
  const [picked, setPicked] = useState(null);
  const g = monthGrid(ym);
  const q = useCalendar(g.first, g.last, types, mine, false);
  const byDate = Object.fromEntries((q.data?.days ?? []).map((d) => [d.date, d]));
  const day = picked && byDate[picked];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button type="button" className="tap inline-flex items-center px-2 text-primary" aria-label={t('calendar.prevMonth')} onClick={() => { setYm(shiftMonth(ym, -1)); setPicked(null); }}><ChevronLeft aria-hidden="true" /></button>
        <h2 className="text-xl font-bold">{formatMonth(ym)}</h2>
        <button type="button" className="tap inline-flex items-center px-2 text-primary" aria-label={t('calendar.nextMonth')} onClick={() => { setYm(shiftMonth(ym, 1)); setPicked(null); }}><ChevronRight aria-hidden="true" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center" role="grid" aria-label={formatMonth(ym)}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="text-sm font-bold text-text-muted" role="columnheader">{d}</div>)}
        {Array.from({ length: g.lead }).map((_, i) => <div key={`x${i}`} aria-hidden="true" />)}
        {Array.from({ length: g.days }).map((_, i) => {
          const date = `${ym}-${String(i + 1).padStart(2, '0')}`;
          const items = byDate[date]?.items ?? [];
          const label = `${i + 1}${items.length ? `, ${t('calendar.dayItems', { n: items.length })}` : ''}`;
          return (
            <button key={date} type="button" role="gridcell" aria-label={label} aria-pressed={picked === date} onClick={() => setPicked(date)}
              className={`flex min-h-14 flex-col items-center justify-start rounded-sm border-[1.5px] p-1 ${picked === date ? 'border-primary bg-primary-soft' : date === today ? 'border-primary' : 'border-transparent'}`}>
              <span className={date === today ? 'font-bold' : ''}>{i + 1}</span>
              <span className="flex items-center gap-0.5" aria-hidden="true">
                {items.slice(0, 3).map((it) => <span key={`${it.type}-${it.id}`} className={`size-1.5 rounded-full ${it.type === 'event' ? 'bg-primary' : it.type === 'task' ? 'bg-text' : 'bg-warning'}`} />)}
                {items.length > 3 && <span className="text-xs">{t('calendar.more', { n: items.length - 3 })}</span>}
              </span>
            </button>
          );
        })}
      </div>
      {q.isError && <Notice kind="danger">{q.error.message || t('errors.loadFailed')}</Notice>}
      {q.isSuccess && q.data.days.length === 0 && <p className="text-text-muted">{t('calendar.emptyMonth')}</p>}
      {day && <DayList day={day} />}
    </div>
  );
}

export default function Calendar() {
  const { permissions } = useSession();
  const navigate = useNavigate();
  const [view, setView] = useState('agenda');
  const [types, setTypes] = useState(['event', 'task', 'payment']);
  const [mine, setMine] = useState(false);
  const shown = types.filter((x) => x !== 'payment' || permissions?.money);
  return (
    <Screen title={t('calendar.title')}>
      <ChipFilter label={t('calendar.view')} options={[{ value: 'agenda', label: t('calendar.agenda') }, { value: 'month', label: t('calendar.month') }]} value={view} onChange={setView} />
      <Toggles types={types} setTypes={setTypes} mine={mine} setMine={setMine} money={permissions?.money} />
      {view === 'agenda' ? <Agenda types={shown} mine={mine} /> : <Month types={shown} mine={mine} />}
      {permissions?.admin && <AddButton label={t('calendar.addEvent')} onClick={() => navigate('/calendar/events/new')} />}
    </Screen>
  );
}
