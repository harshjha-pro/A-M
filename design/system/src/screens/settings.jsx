// 11 · Settings & members: /more, /settings/*, /history/:resource/:id
import React from 'react';
import { PhoneFrame, DesktopFrame, TopBar, IconButton, TextField, Chip, ChipRow, Icon, ListRow, StatusBadge, Card, Button, Avatar, Banner, Dialog, Hint, ProgressBar, EmptyState, SelectField, TextArea, Switch, StickyActions, Segmented, UndoBar, Toast, SavedIndicator, Photo, Monogram, SectionHeader } from '../components.jsx';
import { useGo } from '../core.jsx';

function Group({ title, rows }) {
  return (
    <div className="am-col" style={{ gap: 6 }}>
      {title && <h3 className="am-small am-strong am-muted" style={{ textTransform: 'uppercase', letterSpacing: '.06em', paddingLeft: 4 }}>{title}</h3>}
      <div className="am-list">
        {rows.map(([t, s, ic, to, trail]) => <ListRow key={t} to={to || 'x'} title={t} sub={s} lead={<span className="am-stat__icon" style={{ margin: 0 }}><Icon name={ic} /></span>} trail={trail} />)}
      </div>
    </div>
  );
}

export function More({ role = 'owner' }) {
  return (
    <PhoneFrame nav="More" height={1060} label={role === 'owner' ? 'More (Ayush)' : 'More (family: no Money)'}>
      <TopBar title="More" large />
      <div className="am-pad am-col" style={{ gap: 18, paddingBottom: 20 }}>
        <div className="am-card" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Avatar name={role === 'owner' ? 'Ayush' : 'Riya didi'} size={52} tone="wine" /><div style={{ flex: 1 }}><b style={{ fontSize: 18 }}>{role === 'owner' ? 'Ayush' : 'Riya didi'}</b><div className="am-small am-muted">{role === 'owner' ? 'Owner' : 'Family editor'} · 98290 12345</div></div><Button variant="secondary" size="sm" to="account">My account</Button></div>
        <Group title="Planning" rows={[['Guests', '412 families · 1,806 people', 'Users', 'guests'], ['Attachment Vault', 'Photos, videos, documents and links', 'Archive', 'vault']]} />
        <Group title="Money & vendors" rows={[...(role === 'owner' ? [['Money', 'Budget and payments · only Ayush & Mahi', 'IndianRupee', 'money']] : []), ['Vendors', 'Contacts, call and WhatsApp', 'Store', 'vendors'], ['Documents', 'Receipts, contracts and IDs', 'FileText', 'documents']]} />
        <Group title="App" rows={[['Settings', 'Wedding, members, data and safety', 'Settings', 'settings'], ['Install Guide', 'Put A&M on your Home screen', 'Smartphone', 'install']]} />
        <Button variant="destructive-outline" icon="LogOut">Log out</Button>
        <p className="am-small am-muted" style={{ textAlign: 'center' }}>App version 1.0.22</p>
      </div>
    </PhoneFrame>
  );
}

export function SettingsHome() {
  return (
    <PhoneFrame nav="More" height={1260} label="Settings (Ayush)">
      <TopBar back title="Settings" />
      <div className="am-pad am-col" style={{ gap: 18, paddingBottom: 20 }}>
        <Group title="Wedding" rows={[['Wedding details', 'Names, dates, venue, budget', 'Heart', 'wedding'], ['Members', '9 people · 2 invited', 'Users', 'members'], ['Home photos', '4 cover · 3 couple · monogram', 'Images', 'homePhotos']]} />
        <Group title="You and this phone" rows={[['My account', 'Name, password, theme', 'CircleUser', 'account'], ['This phone', 'Version, offline, Fix the app', 'Smartphone', 'phone'], ['Waiting changes', '3 waiting to send', 'CloudUpload', 'waiting', <StatusBadge status="queued" size="sm">3</StatusBadge>]]} />
        <Group title="Data & privacy" rows={[['Export everything', 'Last export 3 days ago', 'Download', 'export'], ['Imports', '2 imports', 'Upload', 'imports'], ['Deleted items', '5 items you can restore', 'Trash2', 'deleted']]} />
        <Group title="Admin" rows={[['Activity', 'Who did what and when', 'History', 'activity'], ['Safety', 'Backups and health', 'ShieldCheck', 'safety', <StatusBadge status="coming" size="sm">Good</StatusBadge>]]} />
        <p className="am-small am-muted" style={{ textAlign: 'center' }}>Logged in as Ayush · App version 1.0.22</p>
      </div>
    </PhoneFrame>
  );
}

export function WeddingDetails({ state }) {
  return (
    <PhoneFrame label={`Wedding details${state ? ' · ' + state : ''}`} toast={state === 'saved' ? <Toast tone="success">Saved.</Toast> : null}>
      <TopBar back title="Wedding details" actions={<IconButton icon="History" label="History" to="history" />} />
      <div className="am-pad am-col" style={{ gap: 16, paddingBottom: 150 }}>
        <TextField label="Bride" value="Mahi Jagetiya" /><TextField label="Groom" value="Ayush Porwal" />
        <div className="am-grid2"><TextField label="First day" value="14 Feb 2027" icon="CalendarDays" /><TextField label="Last day" value="16 Feb 2027" icon="CalendarDays" error={state === 'error' ? 'Last day must be on or after the first day.' : undefined} /></div>
        <TextField label="City" value="Bhilwara" /><TextField label="Main venue" value="Shree Vatika" />
        <TextField label="Total budget (₹)" value="32,00,000" help="Only Ayush and Mahi see this." />
        <p className="am-small am-muted">All dates and times are India time (IST).</p>
      </div>
      <StickyActions note={state === 'saved' ? <SavedIndicator /> : null}><Button>Save</Button></StickyActions>
    </PhoneFrame>
  );
}

const MEMBERS = [['Ayush', 'owner', 'active', '98290 12345'], ['Mahi', 'partner', 'active', '94140 55321'], ['Papa ji', 'family', 'active', '98281 11002'], ['Riya didi', 'family', 'invited', '98290 77120'], ['Nani', 'viewer', 'active', '94141 99001']];

export function Members() {
  return (
    <PhoneFrame label="Members" fab={<Button icon="UserPlus" to="memberNew">Add member</Button>}>
      <TopBar back title="Members" />
      <div className="am-pad am-col" style={{ gap: 14, paddingBottom: 100 }}>
        <Card tone="cream">
          <div className="am-col" style={{ gap: 8, fontSize: 15 }}>
            <div className="am-row-flex" style={{ gap: 8 }}><StatusBadge status="owner" size="sm">Admin</StatusBadge> Ayush &amp; Mahi: everything, incl. money and members.</div>
            <div className="am-row-flex" style={{ gap: 8 }}><StatusBadge status="family" size="sm">Family editor</StatusBadge> Edits and ticks tasks, guests, workspaces. No money.</div>
            <div className="am-row-flex" style={{ gap: 8 }}><StatusBadge status="viewer" size="sm">Viewer</StatusBadge> Can look and call. Can’t change anything.</div>
          </div>
        </Card>
        <div className="am-list">
          {MEMBERS.map(([n, r, st, ph]) => <ListRow key={n} to="member" lead={<Avatar name={n} size={44} />} title={n} sub={ph} trail={<><StatusBadge status={r} size="sm" />{st === 'invited' && <StatusBadge status="invited" size="sm">Link not used</StatusBadge>}</>} />)}
        </div>
      </div>
    </PhoneFrame>
  );
}

export function MemberForm({ state }) {
  return (
    <PhoneFrame label={`Add / edit member${state ? ' · ' + state : ''}`} overlay={state === 'confirm' ? (
      <Dialog title="Make Riya didi a Viewer?" icon="ShieldAlert" tone="warning" actions={<><Button block>Yes, change access</Button><Button block variant="outline">Cancel</Button></>}>
        <p>She will only be able to look. Her open screens refresh with the new access.</p>
      </Dialog>) : null}>
      <TopBar back title="Riya didi" />
      <div className="am-pad am-col" style={{ gap: 16, paddingBottom: 150 }}>
        <TextField label="Name" value="Riya didi" /><TextField label="Phone number" value="98290 77120" icon="Phone" />
        <div className="am-field"><span className="am-field__label">Role</span>
          {[['Partner', 'Same as Ayush & Mahi: everything.'], ['Family', 'Edits and ticks tasks, guests, workspaces. No money.'], ['Viewer', 'Can look and call. Can’t change anything.']].map(([r, d]) => (
            <label key={r} className="am-card" style={{ flexDirection: 'row', gap: 12, padding: 12, borderColor: r === 'Family' ? 'var(--primary)' : undefined, background: r === 'Family' ? 'var(--blush)' : undefined }}>
              <span className="am-check__box" style={{ borderRadius: '50%', background: r === 'Family' ? 'var(--primary)' : undefined, borderColor: r === 'Family' ? 'var(--primary)' : undefined }}>{r === 'Family' && <Icon name="Check" size={16} stroke={3} />}</span>
              <span className="am-check__text"><b>{r}</b><span className="am-check__sub">{d}</span></span>
            </label>
          ))}
        </div>
        <Card title="Invitation link" icon="Link"><p className="am-small am-muted">One-time link. Works for 7 days. Send it on WhatsApp.</p><div className="am-row-flex" style={{ gap: 8 }}><Button variant="whatsapp" size="sm" icon="MessageCircle">Send on WhatsApp</Button><Button variant="outline" size="sm" icon="Copy">Copy</Button></div></Card>
        <Button variant="destructive-outline" icon="UserX">End access</Button>
      </div>
      <StickyActions><Button variant="outline">Cancel</Button><Button>Save member</Button></StickyActions>
    </PhoneFrame>
  );
}

export function Account() {
  return (
    <PhoneFrame label="My account (profile, theme)">
      <TopBar back title="My account" />
      <div className="am-pad am-col" style={{ gap: 16, paddingBottom: 24 }}>
        <div className="am-row-flex" style={{ gap: 14 }}><Avatar name="Ayush" size={64} tone="wine" /><div><b style={{ fontSize: 20 }}>Ayush</b><div className="am-muted">Owner · 98290 12345</div></div></div>
        <TextField label="Your name" value="Ayush" />
        <div className="am-field"><span className="am-field__label">Appearance</span><Segmented options={['Light', 'Dark', 'System']} value="System" label="Appearance" /></div>
        <div className="am-field"><span className="am-field__label">Language</span><Segmented options={['English', 'हिन्दी']} value="English" label="Language" /></div>
        <Card title="Password" icon="KeyRound"><TextField label="Current password" type="password" value="••••••" /><TextField label="New password" type="password" help="At least 6 letters or numbers. Not your phone number." /><Button variant="outline" size="sm">Change password</Button></Card>
        <Button variant="outline" icon="LogOut">Log out on all phones</Button>
      </div>
    </PhoneFrame>
  );
}

export function HomePhotos({ state }) {
  return (
    <PhoneFrame label={`Home photos${state ? ' · ' + state : ''}`} toast={state === 'removed' ? <UndoBar>Removed cover photo 2</UndoBar> : null}>
      <TopBar back title="Home photos" />
      <div className="am-pad am-col" style={{ gap: 16, paddingBottom: 24 }}>
        <p className="am-muted">Photos on the Home screen. Everyone sees them; only Ayush and Mahi can change them.</p>
        <SectionHeader title="Cover photos" count="4 of 8" />
        <p className="am-small am-muted" style={{ marginTop: -10 }}>Slide by themselves at the top of Home. Up to 8. Max 3 MB each.</p>
        {state === 'uploading' && <div className="am-card" style={{ gap: 6 }}><b>Uploading 2 of 3…</b><ProgressBar value={60} /></div>}
        <div className="am-grid2">
          {['hero', 'engagement', 'phere', 'reception'].map((p, i) => (
            <div key={p} className="am-col" style={{ gap: 6 }}>
              <Photo name={p} ratio="4/3" radius="md"><div style={{ padding: 6 }}><span className="am-glass am-glass--white" style={{ borderRadius: 999, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>{i + 1}</span></div></Photo>
              <div className="am-row-flex" style={{ justifyContent: 'space-between' }}><IconButton icon="ChevronLeft" label={`Move cover ${i + 1} earlier`} variant="outline" /><IconButton icon="Trash2" label={`Remove cover ${i + 1}`} variant="outline" /><IconButton icon="ChevronRight" label={`Move cover ${i + 1} later`} variant="outline" /></div>
            </div>
          ))}
        </div>
        <Button variant="outline" icon="ImagePlus">Add photo</Button>
        <SectionHeader title="Monogram" />
        <div className="am-row-flex" style={{ gap: 12 }}><Monogram size={64} /><p className="am-small am-muted">Sits in the top-right corner of the cover. A PNG with a see-through background looks best.</p></div>
      </div>
    </PhoneFrame>
  );
}

export function ThisPhone({ state }) {
  return (
    <PhoneFrame label={`This phone${state ? ' · ' + state : ''}`}>
      <TopBar back title="This phone" />
      <div className="am-pad am-col" style={{ gap: 14, paddingBottom: 24 }}>
        {state === 'update' && <Banner tone="update" title="New version available." action="Refresh">Your typing and waiting changes are kept.</Banner>}
        <Card>
          <dl className="am-kv" style={{ margin: 0 }}>
            <dt>App version</dt><dd>1.0.22 (12 Oct 2026)</dd><dt>Installed</dt><dd>On Home Screen ✓</dd><dt>Opens offline</dt><dd>Yes ✓</dd><dt>Offline data</dt><dd>Protected ✓</dd><dt>Space used</dt><dd>48 MB</dd><dt>Waiting to send</dt><dd style={{ color: 'var(--warning)' }}>3 changes</dd><dt>Last updated</dt><dd>9:41 am</dd>
          </dl>
        </Card>
        <Banner tone="warning" icon="TriangleAlert">Don’t delete the app icon while changes are waiting to be sent: deleting it deletes them too.</Banner>
        <Card title="Something not working?" icon="Wrench"><p className="am-small">“Fix the app” reloads the app files. Your waiting changes and drafts stay on this phone.</p><Button variant="outline" icon="RefreshCw">Fix the app</Button></Card>
      </div>
    </PhoneFrame>
  );
}

export function WaitingChanges({ empty }) {
  return (
    <PhoneFrame offline={!empty} label={empty ? 'Waiting changes · all sent' : 'Waiting changes (outbox)'}>
      <TopBar back title="Changes on this phone" />
      <div className="am-pad am-col" style={{ gap: 14, paddingBottom: 24 }}>
        {empty ? <EmptyState icon="CloudCheck" title="All caught up" >Nothing waiting. Everything has been sent.</EmptyState> : (
          <>
            <Banner tone="waiting" title="3 changes waiting to send." action="Send now">They send by themselves when the internet is back.</Banner>
            <div className="am-list">
              <ListRow tone="queued" title="Tick “Order 20 mehndi cones”" sub="9:14 am · Waiting to send" lead={<Icon name="CloudUpload" style={{ color: 'var(--warning)' }} />} />
              <ListRow tone="queued" title="Sharma family: Mehndi → Coming" sub="9:20 am · Waiting to send" lead={<Icon name="CloudUpload" style={{ color: 'var(--warning)' }} />} />
              <ListRow title="Change task “Book mehndi artist”" sub={<span style={{ color: 'var(--danger)', fontWeight: 700 }}>Someone else changed this · Mahi at 9:32 am</span>} lead={<Icon name="GitMerge" style={{ color: 'var(--danger)' }} />} trail={<Button size="sm" variant="outline">Choose</Button>} chevron={false} />
            </div>
            <Hint>Not everything can wait offline: money, events, imports, uploads and exports need internet.</Hint>
          </>
        )}
      </div>
    </PhoneFrame>
  );
}

export function ExportScreen({ state = 'ready' }) {
  return (
    <PhoneFrame label={`Export everything · ${state}`}>
      <TopBar back title="Export everything" />
      <div className="am-pad am-col" style={{ gap: 14, paddingBottom: 24 }}>
        <p>One ZIP with everything: every list as a spreadsheet (opens in Excel), all photos and PDFs, and a summary you can print.</p>
        <Hint>Private documents and money are included. Keep the file safe; the link works for 24 hours.</Hint>
        {state === 'preparing' && <div className="am-card" style={{ gap: 8 }}><b>Preparing export…</b><ProgressBar value={35} /></div>}
        {state === 'ready' && <Banner tone="success" title="Export ready">84 MB. The link works until tomorrow 9:41 am.</Banner>}
        {state === 'failed' && <Banner tone="error" title="Export failed — try again." action="Try again" />}
        {state === 'ready' ? <><Button icon="Download">Download</Button><Button variant="outline" icon="Printer">Print summary</Button><p className="am-small am-muted">On iPhone: tap Download, then Share → Save to Files.</p></> : <Button icon="Download" busy={state === 'preparing'}>Export everything</Button>}
        <SectionHeader title="Recent exports" />
        <div className="am-list"><ListRow dense title="14 Oct · 81 MB" sub="By Ayush" trail={<StatusBadge status="cancelled" size="sm">Expired</StatusBadge>} chevron={false} /></div>
      </div>
    </PhoneFrame>
  );
}

export function Imports() {
  return (
    <PhoneFrame label="Imports (history + undo)" overlay={
      <Dialog title="Undo this import?" icon="Undo2" tone="warning" actions={<><Button block variant="destructive">Undo this import</Button><Button block variant="outline">Keep it</Button></>}>
        <p>Families it added are deleted (you can restore them from Deleted items). Families changed since are kept.</p>
      </Dialog>}>
      <TopBar back title="Imports" />
      <div className="am-pad am-col" style={{ gap: 12 }}>
        <div className="am-list">
          <ListRow title="guest-list.xlsx" sub={<><span>182 added · 12 filled in · 24 skipped</span><span>Ayush · 15 Oct</span></>} trail={<Button size="sm" variant="outline" icon="Undo2">Undo</Button>} chevron={false} />
          <ListRow title="nanihal.csv" sub={<><span>41 added</span><span>Undone 2 Oct</span></>} trail={<StatusBadge status="cancelled" size="sm">Undone</StatusBadge>} chevron={false} />
        </div>
      </div>
    </PhoneFrame>
  );
}

export function Safety() {
  const checks = [['Database', 'coming', 'Good'], ['Storage', 'coming', 'Good'], ['Backup', 'coming', 'Last good backup: today 2:10 am'], ['Change log', 'coming', 'Good'], ['Restore drill', 'waiting', 'Last drill 34 days ago'], ['Reminders', 'coming', 'Good']];
  return (
    <PhoneFrame label="Data safety">
      <TopBar back title="Safety" />
      <div className="am-pad am-col" style={{ gap: 14, paddingBottom: 24 }}>
        <Banner tone="success" title="Nightly backups are working." >Last good backup: today 2:10 am.</Banner>
        <Card title="Health" icon="HeartPulse" pad={false}>
          <div style={{ paddingTop: 6 }}>{checks.map(([n, s, d]) => <ListRow key={n} dense title={n} sub={d} trail={<StatusBadge status={s} size="sm">{s === 'coming' ? 'Good' : 'Needs a look'}</StatusBadge>} chevron={false} />)}</div>
        </Card>
        <Card title="Restore drills" icon="RotateCcw"><p className="am-small am-muted">Once a month, restore last night’s backup into a spare database and check it. Log it here.</p><Button variant="outline" size="sm" icon="Plus">Log a restore drill</Button></Card>
      </div>
    </PhoneFrame>
  );
}

export function Activity() {
  const rows = [['Today', [['Riya didi', 'ticked “Order 20 mehndi cones”', '12 min ago', 'CircleCheck', 'task'], ['Papa ji', 'set Sharma family to Coming for Reception', '1 h ago', 'Users', 'family'], ['Mahi', 'paid ₹11,000 to Rekha Mehndi Art', '3 h ago', 'IndianRupee', 'payment']]], ['Yesterday', [['Ayush', 'changed Engagement start to 6:30 pm', '7:10 pm', 'CalendarDays', 'event'], ['Ayush', 'invited Riya didi as Family editor', '11:02 am', 'UserPlus', 'member']]]];
  return (
    <PhoneFrame label="Activity (admins only) · notifications style">
      <TopBar back title="Activity" />
      <div className="am-pad am-col" style={{ gap: 14, paddingBottom: 24 }}>
        <ChipRow><Chip selected>Everyone</Chip><Chip icon="User">Person</Chip><Chip>Tasks</Chip><Chip>Guests</Chip><Chip>Money</Chip></ChipRow>
        {rows.map(([d, items]) => (
          <div key={d} className="am-col" style={{ gap: 6 }}>
            <h3 className="am-small am-strong am-muted" style={{ textTransform: 'uppercase', letterSpacing: '.06em' }}>{d}</h3>
            <div className="am-list">
              {items.map(([who, what, when, ic, to], i) => (
                <ListRow key={what} to={to} lead={<span style={{ position: 'relative' }}><Avatar name={who} size={42} /><span style={{ position: 'absolute', right: -4, bottom: -4, width: 22, height: 22, borderRadius: '50%', background: 'var(--surface)', display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-card)' }}><Icon name={ic} size={13} style={{ color: 'var(--primary)' }} /></span></span>}
                  title={<span style={{ fontWeight: 400 }}><b>{who}</b> {what}</span>} sub={when} trail={d === 'Today' && i === 0 ? <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--primary)' }} aria-label="New" /> : null} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </PhoneFrame>
  );
}

export function History() {
  return (
    <PhoneFrame label="Record history (money hidden for family)">
      <TopBar back title="History" sub="Task · Confirm caterer menu tasting" />
      <div className="am-pad am-col" style={{ gap: 12, paddingBottom: 24 }}>
        {[['Mahi', 'Today 9:32 am', [['Due date', 'Sat 10 Oct', 'Mon 12 Oct'], ['Priority', 'Normal', 'Urgent']]], ['Ayush', '8 Oct, 7:15 pm', [['Assigned to', 'Ayush', 'Mahi, Ayush']]], ['Ayush', '2 Oct, 10:02 am', [['Created', '', '']]]].map(([who, when, ch]) => (
          <Card key={when}>
            <div className="am-row-flex" style={{ gap: 10 }}><Avatar name={who} size={34} /><div><b>{who}</b><div className="am-small am-muted">{when}</div></div></div>
            {ch.map(([f, a, b]) => f === 'Created' ? <p key={f} className="am-small">Added this task.</p> : (
              <div key={f} className="am-small" style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 4 }}><span className="am-muted am-strong">{f}</span><span><s className="am-muted">{a}</s> → <b>{b}</b></span></div>
            ))}
          </Card>
        ))}
        <Hint>Money amounts are hidden in history for family and viewers.</Hint>
        <Button variant="ghost">Show older</Button>
      </div>
    </PhoneFrame>
  );
}

export function DeletedItems() {
  return (
    <PhoneFrame label="Deleted items" toast={<Toast tone="success" action="Open">Restored “Mehndi playlist”.</Toast>}>
      <TopBar back title="Deleted items" />
      <div className="am-pad am-col" style={{ gap: 12 }}>
        <Banner tone="info" icon="ShieldCheck">Nothing is ever removed for good before 16 May 2027. Undo works for 10 minutes; after that, restore here.</Banner>
        <div className="am-list">
          {[['Family', 'Mahesh Agarwal & family', 'Deleted by Papa ji · 2 h ago', 'Users'], ['Task', 'Book dhol for baraat', 'Deleted by Ayush · yesterday', 'ListChecks'], ['Payment', '₹4,500 · Mehndi cones', 'Deleted by Mahi · 3 Oct', 'Receipt']].map(([ty, n, by, ic]) => (
            <ListRow key={n} lead={<span className="am-stat__icon" style={{ margin: 0 }}><Icon name={ic} /></span>} title={n} sub={<><StatusBadge status="normal" size="sm">{ty}</StatusBadge><span>{by}</span></>} trail={<Button size="sm" variant="outline" icon="RotateCcw">Restore</Button>} chevron={false} />
          ))}
        </div>
        <Button variant="ghost">Show older</Button>
      </div>
    </PhoneFrame>
  );
}

export function SettingsDesktop() {
  return (
    <DesktopFrame active="Settings" title="Settings" label="Settings · desktop two-pane" aside={null}>
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 24, alignItems: 'start' }}>
        <div className="am-col" style={{ gap: 16 }}>
          <Group title="Wedding" rows={[['Wedding details', 'Names, dates, venue', 'Heart'], ['Members', '9 people', 'Users'], ['Home photos', '4 cover', 'Images']]} />
          <Group title="Data & privacy" rows={[['Export everything', '3 days ago', 'Download'], ['Imports', '2', 'Upload'], ['Deleted items', '5', 'Trash2']]} />
        </div>
        <Card title="Members" icon="Users">
          <div className="am-list" style={{ boxShadow: 'none' }}>{MEMBERS.map(([n, r, st, ph]) => <ListRow key={n} lead={<Avatar name={n} size={40} />} title={n} sub={ph} trail={<StatusBadge status={r} size="sm" />} />)}</div>
          <Button icon="UserPlus" size="sm">Add member</Button>
        </Card>
      </div>
    </DesktopFrame>
  );
}
