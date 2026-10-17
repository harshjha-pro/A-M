// 12 · System states (reusable) and the clickable prototype
import React from 'react';
import { PhoneFrame, TopBar, Icon, ListRow, StatusBadge, Card, Button, Banner, Dialog, Hint, ProgressBar, EmptyState, Skeleton, Toast, UndoBar, SavedIndicator, TextField, BottomSheet, Photo, Monogram, Avatar } from '../components.jsx';
import { GoContext } from '../core.jsx';
import * as Home from './home.jsx';
import * as Tasks from './tasks.jsx';
import * as Guests from './guests.jsx';
import * as WS from './workspaces.jsx';
import * as Cal from './calendar.jsx';
import * as Auth from './auth.jsx';
import * as Settings from './settings.jsx';

/* A state card: one reusable pattern shown on its own, labelled with its number from the brief. */
export function StateCard({ n, title, children }) {
  return (
    <div className="am-card" style={{ width: 360, flex: 'none', gap: 10, background: 'var(--bg)' }}>
      <div className="am-row-flex" style={{ gap: 8 }}><span className="am-step-num" style={{ width: 28, height: 28, fontSize: 13 }}>{n}</span><b>{title}</b></div>
      {children}
    </div>
  );
}

export function StatesGrid({ part = 1 }) {
  const A = [
    [1, 'Loading skeletons', <div className="am-list"><Skeleton avatar /><Skeleton avatar /><Skeleton avatar lines={2} /></div>],
    [2, 'Initial empty state', <EmptyState icon="Users" title="No families yet" action="Add a family">Add one, or import your list.</EmptyState>],
    [3, 'No search results', <EmptyState icon="SearchX" title="No families match “Shrma”" action="Clear filters" actionIcon="X">Try fewer letters, or search by phone.</EmptyState>],
    [4, 'No internet · read-only', <><div className="am-offline-strip" style={{ position: 'static', borderRadius: 12 }}><Icon name="WifiOff" size={16} /> No internet · from 9:12 am</div><Banner tone="offline" title="Needs internet">Search by name and the main chips work offline. Money, events and imports need internet.</Banner></>],
    [5, 'A change waiting to sync', <><div className="am-list"><ListRow tone="queued" title="Tick “Order 20 mehndi cones”" sub="Waiting to send" lead={<Icon name="CloudUpload" style={{ color: 'var(--warning)' }} />} /></div><Toast tone="warning">Kept on this phone. It will be sent when the internet is back.</Toast></>],
    [6, 'Successful save', <><Toast tone="success">Family added.</Toast><SavedIndicator state="saved" /><p className="am-small am-muted">Shown only after the server confirms.</p></>],
    [7, 'Failed save with “Try again”', <Banner tone="error" title="Couldn’t save — the server didn’t answer." action="Try again">Nothing was lost. Your typing is still here.</Banner>],
    [8, 'Session expired · draft kept', <div className="am-card am-glass am-glass--white" style={{ gap: 10 }}><b style={{ fontSize: 19 }}>Please log in again</b><p className="am-small">Your changes are safe. Log in to save them.</p><TextField label="Password" type="password" value="" /><Button block>Log in</Button><Button block variant="ghost">Cancel</Button></div>],
    [9, 'Stale-write conflict', <div className="am-col" style={{ gap: 8 }}><Banner tone="warning" icon="GitMerge" title="Mahi changed this at 9:32 am while you were editing.">Choose which version to keep for each item below.</Banner>
      <div className="am-card" style={{ gap: 6 }}><b className="am-small am-muted">Due date</b><label className="am-row-flex" style={{ gap: 8 }}><input type="radio" name="c" defaultChecked /> Your version: <b>Mon 12 Oct</b></label><label className="am-row-flex" style={{ gap: 8 }}><input type="radio" name="c" /> Mahi’s version: <b>Fri 16 Oct</b></label></div>
      <Button block>Save my choices</Button></div>],
    [10, '“Someone changed this” · reload', <Banner tone="info" icon="RefreshCw" title="Papa ji changed this family 2 min ago." action="Show latest">Your screen shows an older version.</Banner>],
  ];
  const B = [
    [11, 'Task completion with Undo', <UndoBar seconds={8}>Done: “Book mehndi artist”</UndoBar>],
    [12, 'Deleted record with Undo', <><UndoBar>Deleted “Mahesh Agarwal & family”.</UndoBar><p className="am-small am-muted">After 10 minutes, Ayush or Mahi can restore it from Deleted items.</p></>],
    [13, 'Duplicate payment warning', <div className="am-card am-glass am-glass--white" style={{ gap: 8 }}><span className="am-dialog__icon am-dialog__icon--warning"><Icon name="Copy" /></span><b>This looks like a payment you already have</b><span className="am-small">Tent advance · ₹1,50,000 · Paid 2 Oct</span><Button block variant="outline">Open existing</Button><Button block>Save anyway</Button></div>],
    [14, 'File upload progress and failure', <><div className="am-card" style={{ gap: 6 }}><b className="am-small">Uploading receipt.jpg</b><ProgressBar value={64} /></div><Banner tone="error" title="Not uploaded — no internet." action="Try again" compact /></>],
    [15, 'Permission-restricted action', <><Button disabled icon="Lock">Add task</Button><Hint>Only Ayush and Mahi can add tasks. You can still edit and tick tasks.</Hint></>],
    [16, 'Not found / unknown route', <EmptyState icon="Compass" title="Not found" action="Go to Home" actionIcon="House">This page does not exist.</EmptyState>],
    [17, 'Import preview errors', <div className="am-list"><ListRow tone="overdue" title="Row 27 · (no name)" sub="Will be skipped. Fix it and tap Check again." trail={<StatusBadge status="overdue" size="sm">Problem</StatusBadge>} /><ListRow title="Row 14 · Dinesh Maheshwari" sub="Same as an existing family" trail={<StatusBadge status="waiting" size="sm">Duplicate</StatusBadge>} /></div>],
    [18, 'Backup / storage warning', <><Banner tone="warning" title="The last good backup is more than 26 hours old.">Check the backup job.</Banner><Banner tone="warning" title="Database nearly full (2.7 of 3 GB)." compact /></>],
    [19, 'Update available · safe refresh', <Banner tone="update" title="New version available." action="Refresh">Save or close the open form first. Your typing is kept.</Banner>],
    [20, 'Import/export completed', <><Banner tone="success" title="Imported 182 families.">12 filled in · 24 skipped.</Banner><Banner tone="success" title="Export ready" action="Download">84 MB · link works for 24 hours.</Banner></>],
  ];
  return <div className="am-framerow__frames" style={{ flexWrap: 'wrap', gap: 20 }}>{(part === 1 ? A : B).map(([n, t, c]) => <StateCard key={n} n={n} title={t}>{c}</StateCard>)}</div>;
}

export function OfflineSync({ state = 'offline' }) {
  return (
    <PhoneFrame nav="Home" offline={state === 'offline'} label={state === 'offline' ? 'Offline · items waiting' : state === 'syncing' ? 'Back online · sending' : 'All caught up'}>
      <TopBar title="Sync" back />
      <div className="am-pad am-col" style={{ gap: 14 }}>
        <div className="am-card am-card--blush" style={{ alignItems: 'center', textAlign: 'center', gap: 8, padding: 24 }}>
          <span className="am-empty__icon" style={{ background: 'var(--surface)' }}><Icon name={state === 'offline' ? 'WifiOff' : state === 'syncing' ? 'RefreshCw' : 'CloudCheck'} size={34} /></span>
          <b style={{ fontSize: 21 }}>{state === 'offline' ? 'You’re offline' : state === 'syncing' ? 'Sending 3 changes…' : 'All caught up'}</b>
          <p className="am-small">{state === 'offline' ? 'You can still see and tick things. 3 changes are waiting on this phone.' : state === 'syncing' ? 'Keep the app open for a moment.' : 'Everything has been sent. Last updated 9:41 am.'}</p>
          {state === 'syncing' && <div style={{ width: '100%' }}><ProgressBar value={66} /></div>}
          {state === 'offline' && <Button icon="RefreshCw" disabled>Send now</Button>}
        </div>
        {state !== 'done' && (
          <div className="am-list">
            {['Tick “Order 20 mehndi cones”', 'Sharma family: Mehndi → Coming', 'Add “Mehndi cones” to the checklist'].map((t, i) => (
              <ListRow key={t} tone={state === 'syncing' && i === 0 ? undefined : 'queued'} title={t} sub={state === 'syncing' && i === 0 ? 'Sent' : 'Waiting to send'} lead={<Icon name={state === 'syncing' && i === 0 ? 'CircleCheck' : 'CloudUpload'} style={{ color: state === 'syncing' && i === 0 ? 'var(--success)' : 'var(--warning)' }} />} />
            ))}
          </div>
        )}
        <p className="am-small am-muted">Saved on this phone: 412 families · 112 tasks · 9 events · 23 vendors · 31 documents</p>
      </div>
    </PhoneFrame>
  );
}

export function NotFound() {
  return (
    <PhoneFrame nav="Home" label="Not found (unknown route)">
      <TopBar title="Not found" back />
      <EmptyState photo="petals" title="This page does not exist." action="Go to Home" actionIcon="House">The link may be old. Everything else is safe.</EmptyState>
    </PhoneFrame>
  );
}

/* ---------- Clickable prototype ---------- */
const ROUTES = {
  login: () => <Auth.Login />, home: () => <Home.HomeFold />, tasks: () => <Tasks.TaskList />, task: () => <Tasks.TaskDetail />, taskDone: () => <Tasks.TaskDone />,
  taskNew: () => <Tasks.TaskForm />, taskEdit: () => <Tasks.TaskForm mode="edit" />, calendar: () => <Cal.CalendarMonth />, event: () => <Cal.EventDetail />, eventEdit: () => <Cal.EventForm mode="edit" />, eventNew: () => <Cal.EventForm />,
  guests: () => <Guests.GuestList />, family: () => <Guests.FamilyDetail />, familyEdit: () => <Guests.FamilyForm mode="edit" />, rsvp: () => <Guests.RsvpSheet />,
  workspaces: () => <WS.WorkspaceList />, workspace: () => <WS.WorkspaceDetail />, outfit: () => <WS.OutfitDetail />, decor: () => <WS.DecorSection />, menu: () => <WS.MenuSection />,
  contacts: () => <WS.ContactsSection />, timeline: () => <WS.TimelineSection />, guestsWs: () => <WS.GuestDetailsSection />, more: () => <Settings.More />, settings: () => <Settings.SettingsHome />,
};

export function Prototype() {
  const [stack, setStack] = React.useState(['login']);
  const go = React.useCallback((to) => setStack((s) => (to === 'back' ? (s.length > 1 ? s.slice(0, -1) : s) : ROUTES[to] ? [...s, to] : s)), []);
  const cur = stack[stack.length - 1];
  const journeys = [['Log in → Home', 'login'], ['Tasks → detail', 'tasks'], ['Guests → family → edit', 'guests'], ['Workspace → outfit', 'workspaces'], ['Calendar → event', 'calendar']];
  return (
    <div className="am-framerow" style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
      <GoContext.Provider value={go}>
        <div onClickCapture={(e) => { if (cur === 'task' && e.target.closest && e.target.closest('.am-sticky .am-btn--primary')) { e.stopPropagation(); go('taskDone'); } }}>
          {ROUTES[cur]()}
        </div>
      </GoContext.Provider>
      <div className="am-col" style={{ gap: 12, width: 300 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Clickable prototype</h2>
        <p className="am-muted" style={{ margin: 0 }}>Tap cards, rows, the bottom navigation and Back. “Mark as done” on a task shows the Undo state.</p>
        {journeys.map(([l, r]) => <Button key={l} variant={stack[1] === r || stack[0] === r ? 'primary' : 'outline'} onClick={() => setStack([r])}>{l}</Button>)}
        <div className="am-card am-card--cream" style={{ gap: 4 }}><b className="am-small">Path</b><span className="am-small am-muted">{stack.join(' → ')}</span></div>
        <Button variant="ghost" icon="ChevronLeft" onClick={() => go('back')}>Back</Button>
      </div>
    </div>
  );
}
