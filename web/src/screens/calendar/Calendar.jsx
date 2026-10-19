// Calendar (FEATURES B4; defaults changed in 1.0.16, owner's request): Month view first,
// with up to 3 dots per day and "+n"; Agenda from today, grouped by IST day, "Date not
// set" events on top, 60 days at a time with Show past / Show later. Filters Events and
// Tasks (both on); Only mine / All (Only mine first). The + (Ayush and Mahi) offers
// Add event or Add task.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, CalendarDays, PartyPopper, ListChecks } from 'lucide-react';
import Sheet from '../../components/Sheet.jsx';
import Screen, { ScreenLoader } from '../../components/Screen.jsx';
import ChipFilter from '../../components/ChipFilter.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import AddButton from '../../components/AddButton.jsx';
import { Notice } from '../../components/Field.jsx';
import { addDays } from '../../components/DateField.jsx';
import { api } from '../../api/client.js';
import { useSession } from '../../api/session.js';
import { todayIst, formatMonth, formatDateOnly } from '../../format/ist.js';
import { DayList, UndatedList, AgendaDayList, AgendaUndatedList } from './CalendarItems.jsx';
import { t } from '../../i18n/strings.en.js';

const PAGE = 60;

function useCalendar(from, to, types, mine, undated) {
  return useQuery({
    queryKey: ['calendar', from, to, types.join(','), mine, undated],
    queryFn: () => api('GET', '/calendar', { query: { from, to, types: types.join(','), mine: mine ? 'true' : undefined, includeUndated: undated ? 'true' : undefined } }).then((r) => r.data),
    enabled: types.length > 0,
  });
}

function Toggles({ types, setTypes }) {
  const all = ['event', 'task'];
  const toggle = (k) => setTypes(types.includes(k) ? types.filter((x) => x !== k) : [...types, k]);
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={t('calendar.show')}>
      {all.map((k) => (
        <button key={k} type="button" aria-pressed={types.includes(k)} onClick={() => toggle(k)}
          className={`tap inline-flex items-center gap-1 rounded-sm border-[1.5px] px-3 ${types.includes(k) ? 'border-primary bg-primary-soft font-bold text-primary' : 'border-border-strong bg-surface'}`}>
          {types.includes(k) && <span aria-hidden="true">✓</span>}{t(`calendar.${k}s`)}
        </button>
      ))}
    </div>
  );
}

function shiftMonth(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

function AgendaPage({ from, to, types, mine, undated, first }) {
  const q = useCalendar(from, to, types, mine, undated && types.includes('event'));
  if (q.isPending) return <ScreenLoader />;
  if (q.isError) return <Notice kind="danger">{q.error.message || t('errors.loadFailed')}</Notice>;
  const nothing = q.data.days.length === 0 && !(q.data.undated ?? []).length;
  return (
    <>
      <AgendaUndatedList events={q.data.undated} />
      {q.data.days.map((d) => <AgendaDayList key={d.date} day={d} />)}
      {nothing && first && <EmptyState Icon={CalendarDays} text={t('calendar.empty')} />}
    </>
  );
}

function Agenda({ types, mine, onSwitchToMonth }) {
  const today = todayIst();
  const [ym, setYm] = useState(today.slice(0, 7));
  const [past, setPast] = useState(0);   // pages of 60 days before today
  const [later, setLater] = useState(0); // extra pages after the first
  const ranges = useMemo(() => {
    const out = [];
    for (let i = past; i >= 1; i--) out.push([addDays(today, -PAGE * i), addDays(today, -PAGE * (i - 1) - 1)]);
    for (let i = 0; i <= later; i++) out.push([addDays(today, PAGE * i), addDays(today, PAGE * (i + 1) - 1)]);
    return out;
  }, [today, past, later]);

  return (
    <div className="flex flex-col gap-4">
      {/* Month Navigation Row matching reference */}
      <div className="flex items-center justify-between px-1 pt-1">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="tap grid size-8 place-items-center rounded-full text-[#861C32] dark:text-[#F2A7AF] hover:bg-white/40 transition-colors"
            aria-label={t('calendar.prevMonth')}
            onClick={() => setYm(shiftMonth(ym, -1))}
          >
            <ChevronLeft size={20} className="stroke-[2.5]" />
          </button>
          <span className="font-bold text-base text-[#861C32] dark:text-[#F2A7AF]">
            {formatMonth(ym)}
          </span>
          <button
            type="button"
            className="tap grid size-8 place-items-center rounded-full text-[#861C32] dark:text-[#F2A7AF] hover:bg-white/40 transition-colors"
            aria-label={t('calendar.nextMonth')}
            onClick={() => setYm(shiftMonth(ym, 1))}
          >
            <ChevronRight size={20} className="stroke-[2.5]" />
          </button>
        </div>

        {/* Calendar Switcher Button on the right */}
        <button
          type="button"
          onClick={onSwitchToMonth}
          aria-label={t('calendar.month')}
          className="tap size-9 rounded-xl bg-white/70 dark:bg-stone-900/60 backdrop-blur-md border border-[#861C32]/25 flex items-center justify-center text-[#861C32] dark:text-[#F2A7AF] shadow-2xs hover:bg-white hover:scale-105 active:scale-95 transition-all"
        >
          <CalendarDays size={18} className="stroke-[2.2]" />
        </button>
      </div>

      {/* Timeline with vertical stem line */}
      <div className="relative flex flex-col gap-5 pl-2 pt-1">
        {/* Continuous vertical timeline stem */}
        <div
          className="absolute left-[7px] top-3 bottom-6 w-[2px] bg-[#861C32]/25 dark:bg-rose-500/25 pointer-events-none"
          aria-hidden="true"
        />

        <button
          type="button"
          className="tap self-start pl-6 font-bold text-xs sm:text-sm text-[#861C32] dark:text-[#F2A7AF] hover:underline"
          onClick={() => setPast(past + 1)}
        >
          {t('calendar.showPast')}
        </button>

        {ranges.map(([from, to], i) => (
          <AgendaPage
            key={from}
            from={from}
            to={to}
            types={types}
            mine={mine}
            undated={from === today}
            first={i === past}
          />
        ))}

        <button
          type="button"
          className="tap self-start pl-6 font-bold text-xs sm:text-sm text-[#861C32] dark:text-[#F2A7AF] hover:underline"
          onClick={() => setLater(later + 1)}
        >
          {t('calendar.showLater')}
        </button>
      </div>
    </div>
  );
}

function monthGrid(ym) {
  const [y, m] = ym.split('-').map(Number);
  const first = `${ym}-01`;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); // Sunday first (matches reference)
  return { first, last: `${ym}-${String(days).padStart(2, '0')}`, days, lead };
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
    <div className="flex flex-col gap-5">
      {/* Transparent Frosted Glass Calendar Card */}
      <div className="flex flex-col gap-4 rounded-[2rem] bg-white/45 dark:bg-stone-900/40 backdrop-blur-2xl border border-white/60 dark:border-white/10 p-4 sm:p-6 shadow-xl shadow-stone-900/5">
        {/* Month Navigation */}
        <div className="flex items-center justify-between px-2">
          <button
            type="button"
            className="tap grid size-9 place-items-center rounded-full text-[#861C32] dark:text-[#F2A7AF] hover:bg-white/40 transition-colors"
            aria-label={t('calendar.prevMonth')}
            onClick={() => { setYm(shiftMonth(ym, -1)); setPicked(null); }}
          >
            <ChevronLeft aria-hidden="true" size={24} strokeWidth={2.5} />
          </button>
          <h2 className="text-xl sm:text-2xl font-bold font-serif text-[#3B2C27] dark:text-stone-100 tracking-tight">
            {formatMonth(ym)}
          </h2>
          <button
            type="button"
            className="tap grid size-9 place-items-center rounded-full text-[#861C32] dark:text-[#F2A7AF] hover:bg-white/40 transition-colors"
            aria-label={t('calendar.nextMonth')}
            onClick={() => { setYm(shiftMonth(ym, 1)); setPicked(null); }}
          >
            <ChevronRight aria-hidden="true" size={24} strokeWidth={2.5} />
          </button>
        </div>

        {/* Days of Week and Day Grid */}
        <div className="grid grid-cols-7 gap-1 text-center" role="group" aria-label={formatMonth(ym)}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="text-xs sm:text-sm font-semibold text-stone-500 dark:text-stone-400 py-1" aria-hidden="true">
              {d}
            </div>
          ))}
          {Array.from({ length: g.lead }).map((_, i) => (
            <div key={`x${i}`} aria-hidden="true" />
          ))}
          {Array.from({ length: g.days }).map((_, i) => {
            const dayNum = i + 1;
            const date = `${ym}-${String(dayNum).padStart(2, '0')}`;
            const items = byDate[date]?.items ?? [];
            const isSelected = picked === date;
            const isToday = date === today;
            const label = `${dayNum}${items.length ? `, ${t('calendar.dayItems', { n: items.length })}` : ''}`;

            return (
              <button
                key={date}
                type="button"
                aria-label={label}
                aria-pressed={isSelected}
                onClick={() => setPicked(isSelected ? null : date)}
                className="tap relative flex flex-col items-center justify-start min-h-[50px] sm:min-h-[56px] p-0.5 sm:p-1 group rounded-xl transition-all"
              >
                <span
                  className={`size-8 sm:size-9 rounded-xl flex items-center justify-center text-xs sm:text-sm transition-all ${
                    isSelected
                      ? 'bg-[#861C32] text-white font-bold shadow-md scale-105'
                      : isToday
                      ? 'border-2 border-[#861C32] font-bold text-[#861C32] dark:text-[#F2A7AF]'
                      : 'font-medium text-stone-800 dark:text-stone-200 group-hover:bg-white/40'
                  }`}
                >
                  {dayNum}
                </span>
                <span className="flex items-center gap-0.5 mt-1 min-h-[6px]" aria-hidden="true">
                  {items.slice(0, 3).map((it, dotIdx) => {
                    let dotColor = 'bg-emerald-500';
                    if (it.type === 'task') {
                      dotColor = dotIdx % 2 === 0 ? 'bg-amber-500' : 'bg-rose-500';
                    }
                    return (
                      <span
                        key={`${it.type}-${it.id}`}
                        className={`size-1.5 rounded-full ${dotColor}`}
                      />
                    );
                  })}
                  {items.length > 3 && (
                    <span className="text-[10px] font-bold text-[#861C32] dark:text-[#F2A7AF] leading-none">
                      +{items.length - 3}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        {q.isError && <Notice kind="danger">{q.error.message || t('errors.loadFailed')}</Notice>}
        {q.isSuccess && q.data.days.length === 0 && <p className="text-text-muted text-center py-2">{t('calendar.emptyMonth')}</p>}
      </div>
      {picked && (
        day ? (
          <DayList day={day} />
        ) : (
          <section
            className="flex flex-col overflow-hidden rounded-[1.75rem] bg-white/80 dark:bg-stone-900/80 backdrop-blur-xl border border-stone-200/60 dark:border-white/10 shadow-lg shadow-stone-900/5 transition-all"
            aria-label={formatDateOnly(picked)}
          >
            <div className="bg-[#861C32] px-4 py-3 sm:px-5 sm:py-3.5 flex items-center gap-2.5 text-white shadow-xs">
              <CalendarDays size={20} className="text-white/95 shrink-0 stroke-[2]" aria-hidden="true" />
              <h2 className="text-base sm:text-lg font-semibold text-white tracking-normal font-sans">
                {formatDateOnly(picked)}
              </h2>
            </div>
            <div className="bg-[#FAF7F2]/90 dark:bg-stone-900/70 p-6 text-center text-sm text-stone-500 dark:text-stone-400">
              No events or tasks on this day.
            </div>
          </section>
        )
      )}
    </div>
  );
}

function AddSheet({ onClose }) {
  const navigate = useNavigate();
  const item = (to, Icon, label) => (
    <li>
      <button type="button" onClick={() => navigate(to)} className="tap flex w-full items-center gap-3 rounded-md border-[1.5px] border-border px-4 text-lg">
        <Icon aria-hidden="true" size={24} className="text-primary" /> {label}
      </button>
    </li>
  );
  return (
    <Sheet title={t('calendar.add')} onClose={onClose}>
      <ul className="flex flex-col gap-2">
        {item('/calendar/events/new', PartyPopper, t('calendar.addEvent'))}
        {item('/tasks/new', ListChecks, t('calendar.addTask'))}
      </ul>
    </Sheet>
  );
}

export default function Calendar() {
  const { permissions } = useSession();
  const [view, setView] = useState('month');
  const [types, setTypes] = useState(['event', 'task']);
  const [mine, setMine] = useState(true);
  const [adding, setAdding] = useState(false);

  return (
    <Screen main title={view === 'agenda' ? t('calendar.agenda') : t('calendar.title')}>
      {/* Horizontal Filter Pills row matching reference design */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 -mx-2 px-2">
        {/* View toggle (Month / Agenda) */}
        <div role="radiogroup" aria-label={t('calendar.view')} className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            role="radio"
            aria-checked={view === 'month'}
            onClick={() => setView('month')}
            className={`tap inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs sm:text-sm transition-all ${
              view === 'month'
                ? 'bg-[#861C32] text-white font-bold shadow-xs'
                : 'bg-white/80 dark:bg-white/10 text-[#861C32] dark:text-[#F2A7AF] font-semibold border border-white/80 dark:border-white/10 hover:bg-white'
            }`}
          >
            {view === 'month' && <span aria-hidden="true">✓</span>}
            <span>{t('calendar.month')}</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={view === 'agenda'}
            onClick={() => setView('agenda')}
            className={`tap inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs sm:text-sm transition-all ${
              view === 'agenda'
                ? 'bg-[#861C32] text-white font-bold shadow-xs'
                : 'bg-white/80 dark:bg-white/10 text-[#861C32] dark:text-[#F2A7AF] font-semibold border border-white/80 dark:border-white/10 hover:bg-white'
            }`}
          >
            {view === 'agenda' && <span aria-hidden="true">✓</span>}
            <span>{t('calendar.agenda')}</span>
          </button>
        </div>

        {/* Events / Tasks toggles */}
        <div role="group" aria-label={t('calendar.show')} className="flex items-center gap-1.5 shrink-0">
          {['event', 'task'].map((k) => {
            const on = types.includes(k);
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() => setTypes(on ? types.filter((x) => x !== k) : [...types, k])}
                className={`tap inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs sm:text-sm transition-all ${
                  on
                    ? 'bg-white/90 dark:bg-white/15 text-[#861C32] dark:text-[#F2A7AF] font-bold border border-white/80 dark:border-white/10 shadow-xs'
                    : 'bg-white/60 dark:bg-white/5 text-stone-500 dark:text-stone-400 font-medium border border-white/40 dark:border-white/5'
                }`}
              >
                {on && <span aria-hidden="true">✓</span>}
                <span>{t(`calendar.${k}s`)}</span>
              </button>
            );
          })}
        </div>

        {/* Whose toggle (Only mine / All) */}
        <div role="radiogroup" aria-label={t('calendar.whose')} className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            role="radio"
            aria-checked={mine}
            onClick={() => setMine(true)}
            className={`tap inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs sm:text-sm transition-all ${
              mine
                ? 'bg-white/90 dark:bg-white/15 text-[#861C32] dark:text-[#F2A7AF] font-bold border border-white/80 dark:border-white/10 shadow-xs'
                : 'bg-white/60 dark:bg-white/5 text-stone-500 dark:text-stone-400 font-medium border border-white/40 dark:border-white/5'
            }`}
          >
            {mine && <span aria-hidden="true">✓</span>}
            <span>{t('calendar.onlyMine')}</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={!mine}
            onClick={() => setMine(false)}
            className={`tap inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs sm:text-sm transition-all ${
              !mine
                ? 'bg-white/95 dark:bg-white/15 text-[#861C32] dark:text-[#F2A7AF] font-bold border border-[#861C32]/40 shadow-xs'
                : 'bg-white/60 dark:bg-white/5 text-stone-500 dark:text-stone-400 font-medium border border-white/40 dark:border-white/5'
            }`}
          >
            {!mine && <span aria-hidden="true">✓</span>}
            <span>{t('calendar.all')}</span>
          </button>
        </div>
      </div>

      {view === 'agenda' ? <Agenda types={types} mine={mine} onSwitchToMonth={() => setView('month')} /> : <Month types={types} mine={mine} />}
      {permissions?.admin && <AddButton label={t('calendar.add')} onClick={() => setAdding(true)} />}
      {adding && <AddSheet onClose={() => setAdding(false)} />}
    </Screen>
  );
}
