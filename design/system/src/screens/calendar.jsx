// 4 · Calendar & events: /calendar, /calendar/events/new, /calendar/events/:id, /calendar/events/:id/edit
import React from 'react';
import { PhoneFrame, DesktopFrame, TopBar, IconButton, Segmented, Chip, ChipRow, Icon, ListRow, StatusBadge, Card, Photo, Button, TextField, SelectField, TextArea, Switch, MoreDetails, StickyActions, SavedIndicator, Banner, QuickAdd, Avatar, BottomSheet, Dialog, ProgressBar, Hint } from '../components.jsx';
import { EVENTS } from '../data.js';
import { useGo, cx } from '../core.jsx';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MARKS = { 3: ['task'], 7: ['task'], 12: ['task', 'task'], 17: ['event'], 18: ['task'], 22: ['event', 'task'], 26: ['task'], 30: ['task'] };

export function MonthGrid({ month = 'November 2026', sel = 22, today = 17, startPad = 6, days = 30, compact }) {
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push({ d: 26 + i, out: true });
  for (let d = 1; d <= days; d++) cells.push({ d });
  while (cells.length % 7) cells.push({ d: cells.length - days - startPad + 1, out: true });
  return (
    <div className="am-col" style={{ gap: 8 }}>
      <div className="am-row-flex" style={{ justifyContent: 'space-between' }}>
        <IconButton icon="ChevronLeft" label="Previous month" variant="outline" />
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>{month}</h2>
        <IconButton icon="ChevronRight" label="Next month" variant="outline" />
      </div>
      <div className="am-cal" role="grid" aria-label={month}>
        {DOW.map((d) => <div key={d} className="am-cal__dow" role="columnheader">{d}</div>)}
        {cells.map((c, i) => (
          <button key={i} type="button" role="gridcell" className={cx('am-cal__day', c.out && 'is-out', !c.out && c.d === today && 'is-today', !c.out && c.d === sel && 'is-sel')}
            aria-label={`${c.d} ${month}${MARKS[c.d] && !c.out ? `, ${MARKS[c.d].length} items` : ''}${!c.out && c.d === today ? ', today' : ''}`} style={compact ? { minHeight: 42 } : undefined}>
            {c.d}
            {!c.out && MARKS[c.d] && <span className="am-cal__marks">{MARKS[c.d].map((m, j) => <span key={j} className={`am-cal__mark am-cal__mark--${m}`} />)}</span>}
          </button>
        ))}
      </div>
      <div className="am-row-flex am-small am-muted" style={{ gap: 16, justifyContent: 'center' }}>
        <span className="am-row-flex" style={{ gap: 6 }}><span className="am-cal__mark am-cal__mark--event" /> Event</span>
        <span className="am-row-flex" style={{ gap: 6 }}><span className="am-cal__mark am-cal__mark--task" /> Task</span>
        <span className="am-row-flex" style={{ gap: 6 }}><span style={{ width: 14, height: 14, borderRadius: 4, boxShadow: 'inset 0 0 0 2px var(--primary)' }} /> Today</span>
      </div>
    </div>
  );
}

function CalFilters() {
  return (
    <div className="am-col" style={{ gap: 10 }}>
      <Segmented options={['Month', 'Agenda']} value="Month" label="View" />
      <ChipRow><Chip selected>Events</Chip><Chip selected>Tasks</Chip><Chip>Payments</Chip><span style={{ width: 1, background: 'var(--border)', margin: '4px 2px' }} /><Chip selected icon="User">Only mine</Chip><Chip icon="Users">Everyone</Chip></ChipRow>
    </div>
  );
}

function DayItems() {
  return (
    <div className="am-col" style={{ gap: 8 }}>
      <h3 style={{ fontSize: 17, fontWeight: 700 }}>Sun 22 Nov · 2 items</h3>
      <div className="am-list">
        <ListRow to="event" title="Engagement" lead={<span className="am-stat__icon" style={{ margin: 0 }}><Icon name="Heart" /></span>} sub={<><span className="am-meta"><Icon name="Clock" size={14} />6:30 pm</span><span className="am-meta"><Icon name="MapPin" size={14} />Shree Vatika</span></>} trail={<StatusBadge status="normal" size="sm">Event</StatusBadge>} />
        <ListRow to="task" title="Collect engagement rings" lead={<span className="am-stat__icon" style={{ margin: 0, background: 'var(--warning-soft)', color: 'var(--warning)' }}><Icon name="ListChecks" /></span>} sub={<><span className="am-meta"><Icon name="Clock" size={14} />Due 12:00 pm</span><span>Ayush</span></>} trail={<StatusBadge status="todo" size="sm" />} />
      </div>
    </div>
  );
}

export function CalendarMonth() {
  return (
    <PhoneFrame nav="Calendar" label="Calendar · month" fab={<QuickAdd />}>
      <TopBar title="Calendar" large actions={<IconButton icon="Search" label="Search" />} />
      <div className="am-pad am-col" style={{ gap: 16, paddingBottom: 20 }}>
        <CalFilters />
        <div className="am-card"><MonthGrid /></div>
        <DayItems />
      </div>
    </PhoneFrame>
  );
}

export function CalendarAgenda() {
  const groups = [
    ['Today · Sat 17 Oct', [['task', 'Book mehndi artist for 40 guests', 'Due 5:00 pm · Riya didi', 'today']]],
    ['Mon 26 Oct', [['task', 'Send engagement invitations', 'Due · Ayush', 'urgent']]],
    ['Sun 22 Nov', [['event', 'Engagement', '6:30 pm · Shree Vatika, Bhilwara'], ['task', 'Collect engagement rings', 'Due 12:00 pm · Ayush', 'todo']]],
    ['Sun 14 Feb 2027', [['event', 'Mehndi', '11:00 am · Porwal Haveli'], ['event', 'Carnival', '4:00 pm · Porwal Haveli lawn'], ['event', 'DJ Night', '8:30 pm · Porwal Haveli terrace']]],
  ];
  return (
    <PhoneFrame nav="Calendar" label="Calendar · agenda (IST)" fab={<QuickAdd />}>
      <TopBar title="Calendar" large actions={<IconButton icon="Search" label="Search" />} />
      <div className="am-pad am-col" style={{ gap: 14, paddingBottom: 20 }}>
        <div className="am-col" style={{ gap: 10 }}>
          <Segmented options={['Month', 'Agenda']} value="Agenda" label="View" />
          <ChipRow><Chip selected>Events</Chip><Chip selected>Tasks</Chip><Chip>Payments</Chip><Chip icon="User" selected>Only mine</Chip><Chip icon="Users">Everyone</Chip></ChipRow>
        </div>
        <Button variant="ghost" size="sm" icon="ChevronUp">Show past</Button>
        {groups.map(([d, items]) => (
          <div key={d} className="am-col" style={{ gap: 6 }}>
            <h3 className="am-small am-strong" style={{ color: d.startsWith('Today') ? 'var(--primary)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{d}</h3>
            <div className="am-list">
              {items.map(([k, t, s, st]) => (
                <ListRow key={t} dense to={k} title={t} sub={s} lead={<span className={`am-cal__mark am-cal__mark--${k}`} style={{ width: 10, height: 10 }} />} trail={k === 'task' ? <StatusBadge status={st} size="sm" /> : <StatusBadge status="normal" size="sm">Event</StatusBadge>} />
              ))}
            </div>
          </div>
        ))}
        <div className="am-col" style={{ gap: 6 }}>
          <h3 className="am-small am-strong am-muted" style={{ textTransform: 'uppercase', letterSpacing: '.06em' }}>Date not set</h3>
          <div className="am-list"><ListRow dense to="event" title="Haldi" sub="Ask the pandit ji for a date" lead={<span className="am-cal__mark am-cal__mark--event" style={{ width: 10, height: 10 }} />} trail={<StatusBadge status="waiting" size="sm">No date</StatusBadge>} /></div>
        </div>
        <Button variant="ghost" size="sm" icon="ChevronDown">Show later</Button>
      </div>
    </PhoneFrame>
  );
}

export function CalendarAddSheet() {
  return (
    <PhoneFrame nav="Calendar" label="Calendar · Quick Add (Ayush & Mahi only)" overlay={
      <BottomSheet title="Add to calendar">
        <ListRow to="eventNew" title="Event" sub="Engagement, Mehndi, Reception…" lead={<span className="am-stat__icon" style={{ margin: 0 }}><Icon name="CalendarHeart" /></span>} />
        <ListRow to="taskNew" title="Task" sub="Something to do by a date" lead={<span className="am-stat__icon" style={{ margin: 0 }}><Icon name="ListChecks" /></span>} />
        <Hint>Family editors see tasks and can tick them. Only Ayush and Mahi can add events and tasks.</Hint>
      </BottomSheet>}>
      <TopBar title="Calendar" large />
      <div className="am-pad"><MonthGrid compact /></div>
    </PhoneFrame>
  );
}

export function EventDetail({ role = 'owner' }) {
  const e = EVENTS[0];
  return (
    <PhoneFrame darkStatus label={role === 'owner' ? 'Event details' : 'Event details · family editor (read only)'}>
      <div className="am-col" style={{ marginTop: -50, paddingBottom: 24 }}>
        <Photo name={e.photo} ratio="auto" radius="none" overlay="scrim-top" style={{ height: 300 }}>
          <div className="am-row-flex" style={{ justifyContent: 'space-between', padding: '54px 12px 0' }}>
            <IconButton icon="ChevronLeft" label="Back" variant="glass" />
            {role === 'owner' && <div className="am-row-flex" style={{ gap: 8 }}><IconButton icon="Share2" label="Share on WhatsApp" variant="glass" /><IconButton icon="Pencil" label="Edit" variant="glass" to="eventEdit" /></div>}
          </div>
          <div style={{ marginTop: 'auto', padding: '0 16px 18px', color: '#fff' }}>
            <span className="am-glass am-glass--white" style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Engagement · Both sides</span>
            <h1 className="am-display" style={{ fontSize: 40, lineHeight: 1.05, marginTop: 8 }}>{e.name}</h1>
            <div style={{ fontWeight: 700 }}>in 36 days</div>
          </div>
        </Photo>
        <div className="am-pad am-col" style={{ gap: 14, marginTop: 14 }}>
          <Card>
            <div className="am-col" style={{ gap: 12 }}>
              <div className="am-meta" style={{ fontSize: 16, color: 'var(--text)' }}><Icon name="CalendarDays" /> <b>{e.date}</b></div>
              <div className="am-meta" style={{ fontSize: 16, color: 'var(--text)' }}><Icon name="Clock" /> 6:30 pm – 11:00 pm IST</div>
              <div className="am-meta" style={{ fontSize: 16, color: 'var(--text)' }}><Icon name="MapPin" /> {e.venue}</div>
              <div className="am-meta" style={{ fontSize: 16, color: 'var(--text)' }}><Icon name="Shirt" /> Dress code: Pastels</div>
            </div>
            <div className="am-row-flex" style={{ gap: 8 }}><Button variant="secondary" icon="Map" size="sm">Open map</Button><Button variant="whatsapp" icon="MessageCircle" size="sm">Share on WhatsApp</Button></div>
          </Card>
          <Card title="Headcount" icon="Users" action="Guests" to="guests">
            <div className="am-grid3" style={{ textAlign: 'center' }}>
              <div><div className="am-strong" style={{ fontSize: 24 }}>186</div><div className="am-small am-muted">Coming</div></div>
              <div><div className="am-strong" style={{ fontSize: 24 }}>240</div><div className="am-small am-muted">Up to</div></div>
              <div><div className="am-strong" style={{ fontSize: 24 }}>72</div><div className="am-small am-muted">Families</div></div>
            </div>
            <ProgressBar value={64} label="Coming?" detail="46 of 72 families answered" />
          </Card>
          <Card title="Workspace" icon="LayoutGrid" action="Open" to="workspace"><p className="am-muted">Engagement workspace · 68% · 7 open tasks</p></Card>
          <Card title="Tasks for this event" icon="ListChecks" pad={false}>
            <div style={{ paddingTop: 6 }}>
              <ListRow dense to="task" title="Send engagement invitations" sub="Due Mon 26 Oct · Ayush" trail={<StatusBadge status="urgent" size="sm" />} />
              <ListRow dense to="task" title="Collect engagement rings" sub="Due Sun 22 Nov · Ayush" trail={<StatusBadge status="todo" size="sm" />} />
            </div>
          </Card>
          <Card title="Notes" icon="StickyNote"><p>Ring ceremony at 7:15 pm. Dinner after. Keep 20 seats for Nanihal.</p></Card>
          {role !== 'owner' && <Hint>Only Ayush and Mahi can change events.</Hint>}
          <Button variant="ghost" icon="History" to="history">History</Button>
        </div>
      </div>
    </PhoneFrame>
  );
}

export function EventForm({ mode = 'add', state }) {
  return (
    <PhoneFrame label={`${mode === 'add' ? 'Add event' : 'Edit event'}${state ? ' · ' + state : ''}`} overlay={state === 'conflict' ? (
      <Dialog title="Mahi changed this at 9:32 am while you were editing." icon="GitMerge" actions={<><Button block>Choose for each field</Button><Button block variant="outline">Keep Mahi’s, discard mine</Button></>}>
        <p>Your typing is kept. Pick which version to keep for each changed field.</p>
      </Dialog>) : null}>
      <TopBar title={mode === 'add' ? 'Add event' : 'Edit event'} back actions={state === 'saving' ? <SavedIndicator state="saving" /> : null} />
      <div className="am-pad am-col" style={{ gap: 16, paddingBottom: 150 }}>
        {state === 'error' && <Banner tone="error" title="Please fix 1 thing below." />}
        {state === 'server' && <Banner tone="error" title="Couldn’t save — the server didn’t answer." action="Try again">Nothing was lost. Your typing is still here.</Banner>}
        <TextField label="Name" value={state === 'error' ? '' : mode === 'add' ? '' : 'Engagement'} placeholder="e.g. Haldi" error={state === 'error' ? 'Please type a name.' : undefined} required />
        <SelectField label="Type" value={mode === 'add' ? 'Haldi' : 'Engagement'} />
        <div className="am-grid2"><TextField label="Date" value={mode === 'add' ? '13 Feb 2027' : '22 Nov 2026'} icon="CalendarDays" /><TextField label="Starts at" value="6:30 pm" icon="Clock" /></div>
        <Switch label="All day" />
        <Switch on label="Guests are invited" sub="Families get invitations and a headcount for this event." />
        <MoreDetails open count={6}>
          <SelectField label="Side" value="Both sides" />
          <TextField label="Ends at" optional value="11:00 pm" icon="Clock" />
          <TextField label="Venue" value="Shree Vatika, Bhilwara" icon="MapPin" />
          <TextField label="Map link" help="Paste the Google Maps link (starts with https://)." value="https://maps.app.goo.gl/…" />
          <TextField label="Dress code" value="Pastels" />
          <TextArea label="Notes" value="Ring ceremony at 7:15 pm." />
        </MoreDetails>
      </div>
      <StickyActions note={mode === 'edit' ? <SavedIndicator state="saved" /> : null}>
        <Button variant="outline">Cancel</Button><Button busy={state === 'saving'}>{state === 'saving' ? 'Saving…' : 'Save event'}</Button>
      </StickyActions>
    </PhoneFrame>
  );
}

export function CalendarDesktop() {
  return (
    <DesktopFrame active="Calendar" title="Calendar" actions={<><Segmented options={['Month', 'Agenda']} value="Month" /><Button icon="Plus">Add event</Button></>}
      aside={<><h2 style={{ fontSize: 20, fontWeight: 700 }}>Sun 22 Nov</h2><DayItems /><EventCardMini /></>} label="Calendar · desktop with day panel">
      <ChipRow><Chip selected>Events</Chip><Chip selected>Tasks</Chip><Chip>Payments</Chip><Chip selected icon="User">Only mine</Chip><Chip icon="Users">Everyone</Chip></ChipRow>
      <div className="am-card"><MonthGrid /></div>
    </DesktopFrame>
  );
}

function EventCardMini() {
  return <Photo name="engagement" ratio="16/9" radius="lg" overlay="scrim"><div style={{ marginTop: 'auto', padding: 14, color: '#fff' }}><div className="am-display" style={{ fontSize: 28 }}>Engagement</div><div className="am-small am-strong">6:30 pm · Shree Vatika</div></div></Photo>;
}
