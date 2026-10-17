// 5 · Tasks: /tasks, /tasks/new, /tasks/:id, /tasks/:id/edit
import React from 'react';
import { PhoneFrame, DesktopFrame, TopBar, IconButton, TextField, Chip, ChipRow, Icon, ListRow, StatusBadge, Card, Button, Checkbox, Avatar, QuickAdd, UndoBar, EmptyState, MoreDetails, DateShortcuts, SelectField, TextArea, StickyActions, SavedIndicator, Banner, Dialog, Hint, Segmented, Toast } from '../components.jsx';
import { TASKS } from '../data.js';
import { useGo, cx, isAdmin } from '../core.jsx';

export function TaskRow({ t, done }) {
  const isDone = done || t.status === 'done';
  return (
    <ListRow to="task" tone={t.overdue && !isDone ? 'overdue' : undefined}
      lead={<Checkbox size="lg" checked={isDone} label="" />}
      title={<span style={isDone ? { textDecoration: 'line-through', color: 'var(--text-muted)' } : undefined}>{t.title}</span>}
      sub={<>
        <span className="am-meta" style={{ color: t.overdue && !isDone ? 'var(--danger)' : t.today ? 'var(--warning)' : undefined, fontWeight: t.overdue || t.today ? 700 : 400 }}><Icon name={t.overdue ? 'TriangleAlert' : t.today ? 'Clock' : 'CalendarDays'} size={14} />{t.due}</span>
        <span className="am-meta"><Icon name="User" size={14} />{t.who}</span>
        {t.items && <span className="am-meta"><Icon name="ListTodo" size={14} />{t.items}</span>}
        <span className="am-code">{t.code}</span>
      </>}
      trail={<>{t.priority === 'urgent' && !isDone && <StatusBadge status="urgent" size="sm" />}<StatusBadge status={isDone ? 'done' : t.status} size="sm" /></>} chevron={false} />
  );
}

function Filters({ value = 'My tasks' }) {
  return (
    <ChipRow>
      {[['My tasks', 6], ['All', 112], ['Today', 2], ['This week', 5], ['Overdue', 3], ['No date', 9], ['Done & cancelled', 65]].map(([l, n]) => <Chip key={l} selected={l === value} count={n} tone={l === 'Overdue' ? 'danger' : undefined}>{l}</Chip>)}
    </ChipRow>
  );
}

export function TaskList({ role = 'owner' }) {
  return (
    <PhoneFrame nav="Tasks" label={isAdmin(role) ? 'Task list' : 'Task list · family editor (no Add)'} fab={isAdmin(role) ? <QuickAdd label="Add task" /> : null}>
      <TopBar title="Tasks" large actions={<IconButton icon="SlidersHorizontal" label="Filters" />} />
      <div className="am-pad am-col" style={{ gap: 12, paddingBottom: 20 }}>
        <TextField placeholder="Search tasks or ID" icon="Search" />
        <Filters />
        <ChipRow><Chip>To do</Chip><Chip>Doing</Chip><Chip>Waiting</Chip><Chip>Done</Chip><Chip>Cancelled</Chip></ChipRow>
        {!isAdmin(role) && <Hint>Only Ayush and Mahi can add tasks. You can still edit and tick tasks.</Hint>}
        <h3 className="am-small am-strong" style={{ color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Overdue · 1</h3>
        <div className="am-list"><TaskRow t={TASKS[0]} /></div>
        <h3 className="am-small am-strong am-muted" style={{ textTransform: 'uppercase', letterSpacing: '.06em' }}>Today · 1</h3>
        <div className="am-list"><TaskRow t={TASKS[1]} /></div>
        <h3 className="am-small am-strong am-muted" style={{ textTransform: 'uppercase', letterSpacing: '.06em' }}>Coming up · 4</h3>
        <div className="am-list">{TASKS.slice(2, 6).map((t) => <TaskRow key={t.code} t={t} />)}</div>
      </div>
    </PhoneFrame>
  );
}

export function TaskDone() {
  return (
    <PhoneFrame nav="Tasks" label="Task ticked · Undo for 10 seconds" toast={<UndoBar seconds={8}>Done: “Book mehndi artist for 40 guests”</UndoBar>}>
      <TopBar title="Tasks" large />
      <div className="am-pad am-col" style={{ gap: 12 }}>
        <Filters />
        <div className="am-list"><TaskRow t={TASKS[0]} /><TaskRow t={TASKS[1]} done /><TaskRow t={TASKS[2]} /><TaskRow t={TASKS[3]} /></div>
      </div>
    </PhoneFrame>
  );
}

export function TaskEmpty({ kind = 'first' }) {
  return (
    <PhoneFrame nav="Tasks" label={kind === 'first' ? 'Tasks · empty' : 'Tasks · no search results'} fab={<QuickAdd label="Add task" />}>
      <TopBar title="Tasks" large />
      <div className="am-pad am-col" style={{ gap: 12 }}>
        <TextField placeholder="Search tasks or ID" icon="Search" value={kind === 'first' ? '' : 'TSK-ZZZ'} />
        <Filters value={kind === 'first' ? 'My tasks' : 'All'} />
        {kind === 'first'
          ? <EmptyState photo="petals" title="No tasks yet" action="Add your first task">Tap + to add your first task. Ayush and Mahi can add tasks; family can tick them.</EmptyState>
          : <EmptyState icon="SearchX" title="No tasks match “TSK-ZZZ”" action="Clear search" actionIcon="X">Check the ID, or search by title.</EmptyState>}
      </div>
    </PhoneFrame>
  );
}

export function TaskDetail({ role = 'owner' }) {
  const t = TASKS[0];
  return (
    <PhoneFrame label={role === 'viewer' ? 'Task details · viewer (Nani)' : 'Task details'}>
      <TopBar back title="" actions={canEditRole(role) ? <><IconButton icon="MessageCircle" label="Send to Mahi on WhatsApp" /><IconButton icon="Pencil" label="Edit" to="taskEdit" /><IconButton icon="EllipsisVertical" label="More" /></> : null} />
      <div className="am-pad am-col" style={{ gap: 14, paddingBottom: 130 }}>
        <div className="am-col" style={{ gap: 8 }}>
          <div className="am-row-flex" style={{ gap: 8, flexWrap: 'wrap' }}><StatusBadge status="overdue" /><StatusBadge status="urgent" /><StatusBadge status="todo" /></div>
          <h1 style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.25 }}>{t.title}</h1>
          <span className="am-code" style={{ alignSelf: 'flex-start' }} aria-label={`Task ID ${t.code}`}>{t.code}</span>
        </div>
        <Card>
          <dl className="am-kv" style={{ margin: 0 }}>
            <dt>Due</dt><dd style={{ color: 'var(--danger)' }}>Mon 12 Oct · 5:00 pm <span className="am-small">(5 days late)</span></dd>
            <dt>Priority</dt><dd>Urgent</dd>
            <dt>Assigned to</dt><dd className="am-row-flex" style={{ gap: 8 }}><Avatar name="Mahi" size={28} /> Mahi <Avatar name="Ayush" size={28} /> Ayush</dd>
            <dt>Event</dt><dd>Reception</dd>
            <dt>Linked to</dt><dd>Reception › Menu › Paneer tikka</dd>
            <dt>Tags</dt><dd className="am-row-flex" style={{ gap: 6 }}><StatusBadge status="normal" size="sm">Food</StatusBadge><StatusBadge status="normal" size="sm">Vendor</StatusBadge></dd>
          </dl>
          {canEditRole(role) && <div className="am-row-flex" style={{ gap: 8, flexWrap: 'wrap' }}><span className="am-small am-strong am-muted">Move date:</span><Chip>Tomorrow</Chip><Chip>Next Monday</Chip><Chip icon="CalendarDays">Pick date</Chip></div>}
        </Card>
        <Card title="Checklist · 2 of 5" icon="ListTodo">
          <Checkbox checked strike label="Call Gopal ji for a date" />
          <Checkbox checked strike label="Share guest count (240)" />
          <Checkbox label="Taste Jain dishes separately" />
          <Checkbox label="Decide dessert counter" />
          <Checkbox label="Get final quotation in writing" />
          {canEditRole(role) && <TextField placeholder="Add an item, e.g. 20 mehndi cones" icon="Plus" />}
        </Card>
        <Card title="Notes" icon="StickyNote"><p>Tasting at Annapurna kitchen, Pur Road. Take Mummy ji and Nani.</p></Card>
        <Card title="Files" icon="Paperclip" action="Add"><ListRow dense to="attachment" title="Caterer quotation.pdf" sub="ATT-3HVN8P · 412 KB" lead={<Icon name="FileText" />} /></Card>
        {role === 'viewer' && <Hint>You can see tasks. Ayush or Mahi can give you edit access.</Hint>}
        <Button variant="ghost" icon="History" to="history">History</Button>
      </div>
      {canEditRole(role) && <StickyActions><Button icon="CircleCheck" size="lg">Mark as done</Button></StickyActions>}
    </PhoneFrame>
  );
}

const canEditRole = (r) => r !== 'viewer';

export function TaskForm({ mode = 'add', state }) {
  return (
    <PhoneFrame label={`${mode === 'add' ? 'Add task' : 'Edit task'}${state ? ' · ' + state : ''}`} overlay={state === 'duplicate' ? (
      <Dialog title="A similar task exists" icon="Copy" tone="warning" actions={<><Button block variant="outline" icon="ExternalLink">Open it</Button><Button block>Add anyway</Button></>}>
        <p><b>“Book mehndi artist for 40 guests”</b> · Due today · Riya didi</p>
      </Dialog>) : null}>
      <TopBar back title={mode === 'add' ? 'Add task' : 'Edit task'} actions={mode === 'edit' ? <SavedIndicator state={state === 'queued' ? 'queued' : 'saved'} /> : null} />
      <div className="am-pad am-col" style={{ gap: 16, paddingBottom: 150 }}>
        {state === 'draft' && <Banner tone="info" icon="FileClock" title="You have unsaved changes from 9:12 am." action="Use them" />}
        {state === 'error' && <Banner tone="error" title="Please fix 1 thing below." />}
        <TextField label="What needs doing?" value={state === 'error' ? '' : mode === 'add' ? 'Book the mehndi cones' : 'Confirm caterer menu tasting'} required error={state === 'error' ? 'Please type what needs doing.' : undefined} />
        <div className="am-field"><span className="am-field__label">Due date</span><DateShortcuts value={mode === 'add' ? 'This week' : 'Pick date'} /></div>
        <div className="am-field">
          <span className="am-field__label">Assigned to</span>
          <ChipRow wrap><Chip selected icon="User">Mahi</Chip><Chip selected icon="User">Ayush</Chip><Chip>Papa ji</Chip><Chip>Riya didi</Chip><Chip icon="Plus">More</Chip></ChipRow>
        </div>
        <MoreDetails open={mode === 'edit'} count={8}>
          <TextField label="Time" optional value="5:00 pm" icon="Clock" />
          <Segmented options={['Urgent', 'Normal', 'Low']} value="Urgent" label="Priority" />
          <SelectField label="Status" value="To do" />
          <SelectField label="Event" optional value="Reception" icon="CalendarHeart" />
          <SelectField label="Workspace" optional value="Reception › Menu" icon="LayoutGrid" />
          <div className="am-field"><span className="am-field__label">Tags</span><ChipRow wrap><Chip selected>Food</Chip><Chip selected>Vendor</Chip><Chip icon="Plus">New tag</Chip></ChipRow></div>
          <TextArea label="Notes" value="Tasting at Annapurna kitchen, Pur Road." />
          <TextField label="Task ID" value="TSK-4KQ7RM" help="Unique across tasks. Letters, numbers, - and _. Leave empty for a random ID." />
        </MoreDetails>
      </div>
      <StickyActions note={state === 'queued' ? <SavedIndicator state="queued" /> : null}>
        <Button variant="outline">Cancel</Button><Button busy={state === 'saving'}>{state === 'saving' ? 'Saving…' : 'Save task'}</Button>
      </StickyActions>
    </PhoneFrame>
  );
}

export function TasksDesktop() {
  return (
    <DesktopFrame active="Tasks" title="Tasks" actions={<><div style={{ width: 320 }}><TextField placeholder="Search tasks or ID" icon="Search" /></div><Button icon="Plus">Add task</Button></>} aside={<TaskAside />} label="Tasks · desktop list + detail panel">
      <Filters value="All" />
      <div className="am-list">{TASKS.map((t) => <TaskRow key={t.code} t={t} />)}</div>
    </DesktopFrame>
  );
}

function TaskAside() {
  return (
    <>
      <div className="am-row-flex" style={{ gap: 8 }}><StatusBadge status="overdue" /><StatusBadge status="urgent" /></div>
      <h2 style={{ fontSize: 24, fontWeight: 700 }}>Confirm caterer menu tasting</h2>
      <span className="am-code" style={{ alignSelf: 'flex-start' }}>TSK-4KQ7RM</span>
      <dl className="am-kv" style={{ margin: 0 }}><dt>Due</dt><dd style={{ color: 'var(--danger)' }}>Mon 12 Oct</dd><dt>Assigned</dt><dd>Mahi, Ayush</dd><dt>Event</dt><dd>Reception</dd></dl>
      <Card title="Checklist · 2 of 5" icon="ListTodo"><Checkbox checked strike label="Call Gopal ji for a date" /><Checkbox label="Taste Jain dishes separately" /></Card>
      <div className="am-row-flex" style={{ gap: 8 }}><Button icon="CircleCheck">Mark as done</Button><Button variant="outline" icon="Pencil">Edit</Button></div>
    </>
  );
}
