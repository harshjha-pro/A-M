// 3 · Home dashboard: /
import React from 'react';
import { PhoneFrame, DesktopFrame, Photo, Countdown, Monogram, Card, ListRow, StatusBadge, Checkbox, Icon, Avatar, ProgressRing, ProgressBar, SectionHeader, QuickAdd, EmptyState, Button, IconButton, Skeleton, Banner } from '../components.jsx';
import { EVENTS, TASKS, WEDDING } from '../data.js';
import { useGo, isAdmin } from '../core.jsx';

function Hero({ desktop }) {
  return (
    <Photo name="hero" ratio="auto" radius="xl" overlay="scrim-top" style={{ height: desktop ? 420 : 470 }} label="Cover photo 1 of 4 — replace with your couple photo" labelStyle={desktop ? { top: 'auto', bottom: 14, left: 'auto', right: 14 } : { top: 'auto', bottom: 124, left: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: desktop ? '20px 24px' : '58px 16px 0' }}>
        <div style={{ color: '#fff' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Namaste, Ayush</div>
          <div style={{ fontSize: 13, opacity: 0.95 }}>Updated 9:41 am</div>
        </div>
        <Monogram size={desktop ? 64 : 52} light />
      </div>
      <div style={{ marginTop: 'auto', padding: desktop ? '0 28px 24px' : '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ color: '#fff' }}>
          <div className="am-display" style={{ fontSize: desktop ? 48 : 38, lineHeight: 1.02 }}>Every Detail,<br />A Beautiful Tomorrow</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="MapPin" size={16} /> {WEDDING.couple} · {WEDDING.place} · {WEDDING.dates}</div>
        </div>
        <div style={desktop ? { maxWidth: 420 } : undefined}><Countdown {...WEDDING.countdown} /></div>
      </div>
      <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6 }} aria-hidden="true">
        {[1, 0, 0, 0].map((on, i) => <span key={i} style={{ width: on ? 18 : 6, height: 6, borderRadius: 3, background: '#fff', opacity: on ? 1 : 0.6 }} />)}
      </div>
    </Photo>
  );
}

export function EventCard({ e, wide }) {
  const go = useGo();
  return (
    <button type="button" className="am-card am-card--flush" onClick={() => go('event')} style={{ width: wide ? '100%' : 260, flex: 'none', textAlign: 'left', cursor: 'pointer' }}>
      <Photo name={e.photo} ratio="16/9" radius="none" overlay="scrim">
        <div style={{ marginTop: 'auto', padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <span className="am-glass am-glass--white" style={{ borderRadius: 12, padding: '4px 10px', fontWeight: 700, fontSize: 14 }}>in {e.in}</span>
        </div>
      </Photo>
      <div style={{ padding: '12px 14px 14px', display: 'flex', gap: 12, alignItems: 'center' }}>
        <div className="am-datebox"><div className="am-datebox__mon">{e.mon}</div><div className="am-datebox__day">{e.day}</div></div>
        <div style={{ minWidth: 0 }}>
          <div className="am-strong" style={{ fontSize: 17 }}>{e.name}</div>
          <div className="am-meta"><Icon name="Clock" size={14} /> {e.time}</div>
          <div className="am-meta" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><Icon name="MapPin" size={14} /> {e.venue}</div>
        </div>
      </div>
    </button>
  );
}

function TaskMini({ t }) {
  return (
    <ListRow to="task" title={t.title} lead={<Checkbox size="lg" checked={false} label="" />}
      sub={<><span className="am-meta" style={{ color: t.overdue ? 'var(--danger)' : t.today ? 'var(--warning)' : undefined, fontWeight: t.overdue || t.today ? 700 : 400 }}><Icon name={t.overdue ? 'TriangleAlert' : 'Clock'} size={14} />{t.due}</span><span>{t.event}</span></>} />
  );
}

const QUICK = [['Add task', 'SquarePlus', 'taskNew', true], ['Guests', 'Users', 'guests'], ['Calendar', 'CalendarDays', 'calendar'], ['Workspace', 'LayoutGrid', 'workspaces'], ['Vault', 'Archive', 'vault'], ['Vendors', 'Store', 'vendors']];

function QuickActions({ role }) {
  const go = useGo();
  return (
    <Card title="Quick actions" icon="Zap">
      <div className="am-grid3">
        {QUICK.filter((q) => !q[3] || isAdmin(role)).map(([l, ic, to]) => (
          <button key={l} type="button" onClick={() => go(to)} className="am-col" style={{ alignItems: 'center', gap: 6, padding: '12px 4px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', minHeight: 84 }}>
            <span className="am-stat__icon" style={{ margin: 0 }}><Icon name={ic} /></span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{l}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}

function Progress() {
  return (
    <Card title="Planning progress" icon="ChartPie" action="Tasks" to="tasks">
      <div className="am-row-flex" style={{ gap: 16 }}>
        <ProgressRing value={58} size={84} label="58% of tasks done" />
        <div className="am-col" style={{ gap: 10, flex: 1 }}>
          <div className="am-strong">65 of 112 tasks done</div>
          <ProgressBar value={72} label="Engagement" detail="18 of 25" />
          <ProgressBar value={47} label="Reception" detail="10 of 21" tone="accent" />
        </div>
      </div>
    </Card>
  );
}

function Moments() {
  return (
    <Card title="Our beautiful moments" icon="Images" action="View gallery" to="homePhotos">
      <div className="am-grid2" style={{ gridTemplateColumns: '1.3fr 1fr', gridTemplateRows: '1fr 1fr', height: 220 }}>
        <Photo name="engagement" ratio="auto" radius="md" style={{ gridRow: 'span 2' }} label="Couple photo" />
        <Photo name="petals" ratio="auto" radius="md" />
        <Photo name="phere" ratio="auto" radius="md" />
      </div>
    </Card>
  );
}

function Overdue() {
  return (
    <section className="am-card am-card--danger" style={{ gap: 8 }}>
      <div className="am-card__head">
        <h3 className="am-card__title" style={{ color: 'var(--danger)' }}><Icon name="TriangleAlert" size={20} /> Everyone’s overdue</h3>
        <button className="am-link" style={{ color: 'var(--danger)' }}>See all 3 <Icon name="ChevronRight" size={16} /></button>
      </div>
      <p style={{ fontSize: 15 }}><b>3 overdue tasks</b> · oldest is 5 days late</p>
      <div className="am-list" style={{ boxShadow: 'none' }}>
        <ListRow dense to="task" title="Confirm caterer menu tasting" sub="Mahi · was due 12 Oct" lead={<Avatar name="Mahi" size={32} />} />
        <ListRow dense to="task" title="Pay catering 2nd instalment" sub="Ayush · was due 12 Oct" lead={<Avatar name="Ayush" size={32} />} />
      </div>
    </section>
  );
}

function Activity() {
  const rows = [['Riya didi', 'ticked “Order 20 mehndi cones”', '12 min ago', 'CircleCheck'], ['Papa ji', 'set Sharma family to Coming for Reception', '1 h ago', 'Users'], ['Mahi', 'added 3 photos to Bride outfit moodboard', 'Yesterday', 'Image']];
  return (
    <Card title="Recent activity" icon="History" action="All" to="activity">
      <div className="am-col" style={{ gap: 12 }}>
        {rows.map(([who, what, when, ic]) => (
          <div key={what} className="am-row-flex" style={{ gap: 12, alignItems: 'flex-start' }}>
            <Avatar name={who} size={36} />
            <div style={{ flex: 1, fontSize: 15, lineHeight: 1.4 }}><b>{who}</b> {what}<div className="am-muted am-small">{when}</div></div>
            <Icon name={ic} size={18} style={{ color: 'var(--text-muted)' }} />
          </div>
        ))}
      </div>
      <p className="am-muted am-small" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="Lock" size={14} /> Only Ayush and Mahi see this card.</p>
    </Card>
  );
}

export function HomeContent({ role = 'owner' }) {
  return (
    <div className="am-col" style={{ gap: 18, padding: '0 12px 24px', marginTop: -50 }}>
      <div style={{ margin: '0 -12px' }}><Hero /></div>
      <SectionHeader title="Upcoming events" action="View all" to="calendar" icon="CalendarHeart" />
      <div className="am-scrollx" style={{ margin: '-8px -12px 0', padding: '2px 12px 8px' }}>{EVENTS.slice(0, 3).map((e) => <EventCard key={e.id} e={e} />)}</div>
      <Card title="My tasks" icon="ListChecks" action="See all 6" to="tasks" pad={false}>
        <div style={{ paddingTop: 8 }}>{TASKS.slice(0, 3).map((t) => <TaskMini key={t.code} t={t} />)}</div>
      </Card>
      <Progress />
      <QuickActions role={role} />
      <Moments />
      <Overdue />
      {isAdmin(role) && <Activity />}
    </div>
  );
}

export function Home({ role = 'owner' }) {
  return (
    <PhoneFrame nav="Home" darkStatus height={2620} label={`Home · full scroll (${role === 'family' ? 'family editor' : 'Ayush'})`} fab={isAdmin(role) ? <QuickAdd /> : null}>
      <HomeContent role={role} />
    </PhoneFrame>
  );
}

export function HomeFold() {
  return (
    <PhoneFrame nav="Home" darkStatus label="Home · first screen" fab={<QuickAdd />}>
      <HomeContent />
    </PhoneFrame>
  );
}

export function HomeStates() {
  return (
    <PhoneFrame nav="Home" label="Home · loading, no photos, no events">
      <div className="am-col" style={{ gap: 16, padding: '8px 12px 24px' }}>
        <div className="am-card am-card--blush" style={{ alignItems: 'center', textAlign: 'center', padding: 24 }}>
          <Monogram size={64} />
          <div className="am-display" style={{ fontSize: 30 }}>Ayush &amp; Mahi</div>
          <div className="am-muted">Bhilwara · 14–16 Feb 2027</div>
          <Button variant="outline" icon="ImagePlus" size="sm" to="homePhotos">Add Home photos</Button>
        </div>
        <Card title="Upcoming events" icon="CalendarHeart">
          <EmptyState icon="CalendarPlus" title="No dated events yet" action="Set your event dates" actionIcon="CalendarDays">Add dates in Calendar and they appear here with a countdown.</EmptyState>
        </Card>
        <Card title="My tasks" icon="ListChecks"><Skeleton lines={2} avatar /><Skeleton lines={2} avatar /></Card>
      </div>
    </PhoneFrame>
  );
}

export function HomeDesktop() {
  return (
    <DesktopFrame active="Home" label="Home · desktop (3 columns)">
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 20 }}>
        <Hero desktop />
        <div className="am-col" style={{ gap: 16 }}>
          <Card title="Next event" icon="CalendarHeart" action="Calendar"><EventCard e={EVENTS[0]} wide /></Card>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, alignItems: 'start' }}>
        <div className="am-col" style={{ gap: 20 }}>
          <Card title="My tasks" icon="ListChecks" action="See all 6" pad={false}><div style={{ paddingTop: 8 }}>{TASKS.slice(0, 4).map((t) => <TaskMini key={t.code} t={t} />)}</div></Card>
        </div>
        <div className="am-col" style={{ gap: 20 }}><Progress /><Overdue /></div>
        <div className="am-col" style={{ gap: 20 }}><QuickActions role="owner" /><Activity /></div>
      </div>
    </DesktopFrame>
  );
}
