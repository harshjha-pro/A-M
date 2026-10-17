// 6 · Guests & families: /guests, /guests/new, /guests/:id, /guests/:id/edit, /guests/remind, /guests/import
import React from 'react';
import { PhoneFrame, DesktopFrame, TopBar, IconButton, TextField, Chip, ChipRow, Icon, ListRow, StatusBadge, Card, Button, Checkbox, Avatar, QuickAdd, MoreDetails, SelectField, TextArea, StickyActions, Stepper, Banner, Dialog, Hint, Segmented, ProgressRing, BottomSheet, UndoBar, Toast, Switch } from '../components.jsx';
import { FAMILIES, EVENTS } from '../data.js';
import { cx } from '../core.jsx';

export function FamilyRow({ f, select, selected }) {
  return (
    <ListRow to={select ? undefined : 'family'} chevron={!select}
      lead={select ? <Checkbox size="lg" checked={selected} label="" /> : <Avatar name={f.name} size={44} />}
      title={<span className="am-row-flex" style={{ gap: 6 }}>{f.name}{f.vip && <Icon name="Star" size={16} style={{ color: 'var(--warning)', fill: 'var(--accent)' }} label="Important" />}</span>}
      sub={<>
        <StatusBadge status={f.rsvp} size="sm" /><span>{f.side}</span><span>{f.adults} adults{f.children ? ` · ${f.children} children` : ''}</span><span>{f.area}</span>
        {f.noPhone && <span className="am-meta" style={{ color: 'var(--warning)', fontWeight: 700 }}><Icon name="PhoneOff" size={14} />No phone</span>}
        {f.dup && <span className="am-meta" style={{ color: 'var(--warning)', fontWeight: 700 }}><Icon name="Copy" size={14} />Possible duplicate</span>}
      </>} />
  );
}

function Header() {
  return (
    <div className="am-card am-card--blush" style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <ProgressRing value={64} size={70} label="64% of families answered Coming?" />
      <div className="am-col" style={{ gap: 2 }}>
        <div className="am-strong" style={{ fontSize: 19 }}>412 families · 1,806 people</div>
        <div className="am-small">Coming 238 · Waiting 96 · Not asked 61 · Not coming 17</div>
      </div>
    </div>
  );
}

function GuestFilters() {
  return (
    <div className="am-col" style={{ gap: 8 }}>
      <ChipRow><Chip selected>All</Chip><Chip>Bride</Chip><Chip>Groom</Chip><Chip>Both</Chip><Chip icon="CalendarHeart">All events</Chip></ChipRow>
      <ChipRow><Chip icon="CircleHelp">Coming?</Chip><Chip icon="Star">Important</Chip><Chip icon="PhoneOff">No phone</Chip><Chip icon="Copy" count={4}>Possible duplicates</Chip><Chip icon="SlidersHorizontal">More filters</Chip></ChipRow>
    </div>
  );
}

export function GuestList() {
  return (
    <PhoneFrame nav="More" label="Families & guests" fab={<QuickAdd label="Add a family" />}>
      <TopBar back title="Guests" actions={<><IconButton icon="SquareCheckBig" label="Select" /><IconButton icon="EllipsisVertical" label="Import, remind, export" /></>} />
      <div className="am-pad am-col" style={{ gap: 12, paddingBottom: 20 }}>
        <Header />
        <TextField placeholder="Search name, phone, group or area" icon="Search" />
        <GuestFilters />
        <div className="am-list">{FAMILIES.map((f) => <FamilyRow key={f.name} f={f} />)}</div>
      </div>
    </PhoneFrame>
  );
}

export function GuestSelect() {
  return (
    <PhoneFrame nav="More" label="Families · select mode with bulk actions" overlay={
      <div className="am-sticky" style={{ bottom: 0, paddingBottom: 30, zIndex: 35 }}>
        <div className="am-row-flex" style={{ justifyContent: 'space-between' }}><b>3 selected</b><button className="am-link">Select all 412 filtered</button></div>
        <div className="am-grid4" style={{ gap: 6 }}>
          {[['Invite to', 'MailPlus'], ['Set Coming?', 'CircleHelp'], ['Change side', 'ArrowLeftRight'], ['Delete', 'Trash2']].map(([l, ic]) => (
            <button key={l} className="am-col" style={{ alignItems: 'center', gap: 4, minHeight: 64, border: 0, borderRadius: 12, background: l === 'Delete' ? 'var(--danger-soft)' : 'var(--surface)', color: l === 'Delete' ? 'var(--danger)' : 'var(--primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}><Icon name={ic} />{l}</button>
          ))}
        </div>
      </div>}>
      <TopBar title="Select families" actions={<Button variant="ghost" size="sm">Done</Button>} />
      <div className="am-pad am-col" style={{ gap: 12 }}>
        <GuestFilters />
        <div className="am-list">{FAMILIES.map((f, i) => <FamilyRow key={f.name} f={f} select selected={i < 3} />)}</div>
      </div>
    </PhoneFrame>
  );
}

export function FamilyDetail({ readOnly }) {
  const f = FAMILIES[0];
  const inv = [['Engagement', 'coming', '6 people'], ['Mehndi', 'waiting', '4 people'], ['Varmala & Phere', 'coming', '6 people'], ['Reception', 'not_asked', '6 people']];
  return (
    <PhoneFrame label={readOnly ? 'Family details · viewer' : 'Family details'}>
      <TopBar back title="Family" actions={readOnly ? null : <><IconButton icon="Pencil" label="Edit family" to="familyEdit" /><IconButton icon="EllipsisVertical" label="More" /></>} />
      <div className="am-pad am-col" style={{ gap: 14, paddingBottom: 24 }}>
        <div className="am-row-flex" style={{ gap: 14 }}>
          <Avatar name={f.name} size={64} tone="blush" />
          <div className="am-col" style={{ gap: 4 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>{f.name}</h1>
            <div className="am-row-flex" style={{ gap: 6, flexWrap: 'wrap' }}><StatusBadge status="normal" size="sm">Groom’s side</StatusBadge><StatusBadge status="vip" size="sm" /><StatusBadge status="normal" size="sm">Papa office</StatusBadge></div>
          </div>
        </div>
        <div className="am-grid2"><Button variant="secondary" icon="Phone">Call</Button><Button variant="whatsapp" icon="MessageCircle">WhatsApp</Button></div>
        <Card>
          <div className="am-grid3" style={{ textAlign: 'center' }}>
            <div><div className="am-strong" style={{ fontSize: 24 }}>4</div><div className="am-small am-muted">Adults</div></div>
            <div><div className="am-strong" style={{ fontSize: 24 }}>2</div><div className="am-small am-muted">Children</div></div>
            <div><div className="am-strong" style={{ fontSize: 24 }}>0</div><div className="am-small am-muted">Jain</div></div>
          </div>
          <div className="am-divider" />
          <dl className="am-kv" style={{ margin: 0 }}><dt>Phone</dt><dd>98290 12345</dd><dt>Food</dt><dd>Veg</dd><dt>Area</dt><dd>Shastri Nagar, Bhilwara</dd><dt>Relation</dt><dd>Papa’s colleague</dd></dl>
        </Card>
        <Card title="Invitations · Coming?" icon="MailCheck">
          <div className="am-col" style={{ gap: 0, margin: '0 -16px' }}>
            {inv.map(([ev, st, ppl]) => (
              <ListRow key={ev} title={ev} sub={`${ppl} for this event`} trail={<StatusBadge status={st} size="sm" />} to={readOnly ? undefined : 'rsvp'} />
            ))}
          </div>
          {!readOnly && <Button variant="outline" icon="Plus" size="sm">Invite to another event</Button>}
          <p className="am-small am-muted">WhatsApp opened 2 days ago for Mehndi.</p>
        </Card>
        <Card title="Notes" icon="StickyNote"><p>Seat near the stage. Uncle uses a wheelchair.</p></Card>
        {readOnly && <Hint>You can see this family. Ayush or Mahi can give you edit access.</Hint>}
        <Button variant="ghost" icon="History" to="history">History</Button>
      </div>
    </PhoneFrame>
  );
}

export function RsvpSheet() {
  return (
    <PhoneFrame label="Coming? · change answer" overlay={
      <BottomSheet title="Mehndi · Coming?" actions={<Button block>Save</Button>}>
        <div className="am-col" style={{ gap: 8 }}>
          {[['coming', 'Coming'], ['waiting', 'Waiting'], ['not_coming', 'Not coming'], ['not_asked', 'Not asked yet']].map(([k, l]) => (
            <label key={k} className="am-card" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: '10px 14px', borderColor: k === 'coming' ? 'var(--primary)' : undefined, background: k === 'coming' ? 'var(--blush)' : undefined }}>
              <span className="am-check__box" style={{ borderRadius: '50%', background: k === 'coming' ? 'var(--primary)' : undefined, borderColor: k === 'coming' ? 'var(--primary)' : undefined }}>{k === 'coming' && <Icon name="Check" size={16} stroke={3} />}</span>
              <StatusBadge status={k}>{l}</StatusBadge>
            </label>
          ))}
        </div>
        <Stepper label="Adults" value={4} /><Stepper label="Children" value={1} />
        <TextField label="Note" optional placeholder="e.g. Coming only for lunch" />
      </BottomSheet>}>
      <TopBar back title="Family" />
    </PhoneFrame>
  );
}

export function FamilyForm({ mode = 'add', state }) {
  return (
    <PhoneFrame label={`${mode === 'add' ? 'Add a family' : 'Edit family'}${state ? ' · ' + state : ''}`} overlay={state === 'duplicate' ? (
      <Dialog title="Already on the list" icon="Copy" tone="warning" actions={<><Button block variant="outline" icon="ExternalLink">Open that family</Button><Button block>Add anyway</Button></>}>
        <p>This phone is already on the list: <b>Ramesh Sharma &amp; family</b> (Shastri Nagar).</p>
      </Dialog>) : null}>
      <TopBar back title={mode === 'add' ? 'Add a family' : 'Edit family'} />
      <div className="am-pad am-col" style={{ gap: 16, paddingBottom: 170 }}>
        {state === 'error' && <Banner tone="error" title="Please fix 2 things below." />}
        <TextField label="Family name" value={state === 'error' ? '' : mode === 'add' ? 'Mahesh Agarwal & family' : 'Ramesh Sharma & family'} help="As you say it at home, e.g. Ramesh Sharma & family" error={state === 'error' ? 'Enter a name.' : undefined} />
        <TextField label="Phone" value={mode === 'add' ? '97845 10023' : '98290 12345'} icon="Phone" inputMode="tel" />
        <div className="am-field"><span className="am-field__label">Side</span><Segmented options={['Bride', 'Groom', 'Both']} value={state === 'error' ? '' : 'Groom'} label="Side" />{state === 'error' && <p className="am-field__error"><Icon name="CircleAlert" size={16} /> Pick a side.</p>}</div>
        <Card><Stepper label="Adults" value={3} /><div className="am-divider" /><Stepper label="Children" value={0} /></Card>
        <div className="am-field"><span className="am-field__label">Invite to</span><ChipRow wrap>{EVENTS.map((e, i) => <Chip key={e.id} selected={[0, 3, 5, 6].includes(i)}>{e.name}</Chip>)}</ChipRow></div>
        <MoreDetails count={10}>
          <SelectField label="Food" value="Veg" />
          <Stepper label="Jain people" value={0} help="At most the family total." />
          <Switch label="Important" sub="Shown with a star on the list." />
          <TextField label="Group" help="e.g. Nanihal (Mama ji), Papa office" />
          <TextField label="Relation" /><TextField label="Area" /><TextField label="City" value="Bhilwara" />
          <TextArea label="Address" /><TextField label="Other phone" /><TextArea label="Notes" />
        </MoreDetails>
      </div>
      <StickyActions>
        {mode === 'add' ? <><Button variant="outline">Save &amp; add another</Button><Button>Save family</Button></> : <><Button variant="outline">Cancel</Button><Button>Save family</Button></>}
      </StickyActions>
    </PhoneFrame>
  );
}

export function GuestRemind() {
  return (
    <PhoneFrame label="Reminders one by one (opens WhatsApp)">
      <TopBar back title="Reminders one by one" sub="Mehndi · 96 families waiting" />
      <div className="am-pad am-col" style={{ gap: 14, paddingBottom: 150 }}>
        <div className="am-row-flex" style={{ justifyContent: 'space-between' }}><b>12 of 96</b><span className="am-muted am-small">Message language</span></div>
        <Segmented options={['English', 'Hinglish']} value="Hinglish" label="Message language" />
        <Card>
          <div className="am-row-flex" style={{ gap: 12 }}><Avatar name="Suresh Jagetiya" size={48} /><div><div className="am-strong">Suresh Jagetiya &amp; family</div><div className="am-small am-muted">94140 22871 · Bride · 4 people</div></div></div>
          <div className="am-card am-card--cream" style={{ fontSize: 15, lineHeight: 1.5 }}>Namaste Suresh ji, Ayush aur Mahi ke Mehndi mein aap sab zaroor padhariye — Sun 14 Feb, Porwal Haveli. Kitne log aayenge, reply karke batayein. – Ayush</div>
        </Card>
        <Banner tone="info" icon="Info">WhatsApp opens with this message ready. <b>You</b> press Send there — nothing is sent automatically.</Banner>
      </div>
      <StickyActions>
        <Button variant="outline" icon="ChevronLeft">Back</Button><Button variant="whatsapp" icon="MessageCircle">Open WhatsApp</Button><Button variant="outline" iconRight="ChevronRight">Next</Button>
      </StickyActions>
    </PhoneFrame>
  );
}

export function GuestImport({ step = 2 }) {
  const steps = ['Choose file', 'Review rows', 'Confirm import'];
  return (
    <PhoneFrame label={`Import · step ${step} of 3 · ${steps[step - 1]}`} toast={step === 4 ? <UndoBar>Imported 182 families.</UndoBar> : null}>
      <TopBar back title="Import a list" />
      <div className="am-pad am-col" style={{ gap: 14, paddingBottom: 150 }}>
        <div className="am-steps">{steps.map((s, i) => <React.Fragment key={s}><span className={`am-step-num ${i + 1 < step ? 'is-done' : ''}`}>{i + 1 < step ? <Icon name="Check" size={16} stroke={3} /> : i + 1}</span>{i < 2 && <span className={`am-steps__bar ${i + 1 < step ? 'is-done' : ''}`} />}</React.Fragment>)}</div>
        {step === 1 && (
          <>
            <Card title="1 · Get the template" icon="FileSpreadsheet"><p className="am-muted">Fill it in Excel or Google Sheets: one row per family.</p><Button variant="outline" icon="Download" size="sm">Download the Excel template</Button></Card>
            <button className="am-card" style={{ alignItems: 'center', borderStyle: 'dashed', borderWidth: 2, borderColor: 'var(--border-strong)', padding: 28, cursor: 'pointer' }}>
              <span className="am-empty__icon" style={{ width: 60, height: 60 }}><Icon name="Upload" size={28} /></span>
              <b>Choose a file (Excel, CSV or contacts)</b><span className="am-small am-muted">Up to 3,000 rows</span>
            </button>
            <Button variant="ghost" icon="ClipboardPaste">Paste names and numbers</Button>
          </>
        )}
        {step === 2 && (
          <>
            <Banner tone="info" title="218 rows found in guest-list.xlsx" />
            <div className="am-grid3">
              <div className="am-card" style={{ alignItems: 'center', gap: 2, padding: 10 }}><b style={{ fontSize: 22, color: 'var(--success)' }}>182</b><span className="am-small">New</span></div>
              <div className="am-card" style={{ alignItems: 'center', gap: 2, padding: 10 }}><b style={{ fontSize: 22, color: 'var(--warning)' }}>31</b><span className="am-small">Duplicates</span></div>
              <div className="am-card" style={{ alignItems: 'center', gap: 2, padding: 10 }}><b style={{ fontSize: 22, color: 'var(--danger)' }}>5</b><span className="am-small">Problems</span></div>
            </div>
            <ChipRow><Chip selected>All</Chip><Chip>New</Chip><Chip>Duplicates</Chip><Chip tone="danger">Problems</Chip></ChipRow>
            <div className="am-list">
              <ListRow title="Row 14 · Dinesh Maheshwari" sub={<><StatusBadge status="waiting" size="sm">Possible duplicate</StatusBadge><span>Same as Dinesh Maheshwari &amp; family</span></>}><SelectField label="What to do" value="Fill in Dinesh Maheshwari & family" /></ListRow>
              <ListRow title="Row 27 · (no name)" sub="No name in this row" tone="overdue" trail={<StatusBadge status="overdue" size="sm">Problem</StatusBadge>}><span className="am-small am-muted">Will be skipped. Fix it and tap Check again to include it.</span></ListRow>
              <ListRow title="Row 31 · Kamla Devi Porwal" sub="98281 00321 · Bride" trail={<StatusBadge status="coming" size="sm">New</StatusBadge>} />
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <Card title="Ready to import" icon="ClipboardCheck">
              <dl className="am-kv" style={{ margin: 0 }}><dt>New families</dt><dd>182</dd><dt>Filled in</dt><dd>12 existing families</dd><dt>Skipped</dt><dd>24 (19 duplicates, 5 problems)</dd><dt>Invited to</dt><dd>Varmala &amp; Phere</dd></dl>
            </Card>
            <Banner tone="info" icon="Undo2">You can undo this import later from Settings › Imports. Families changed since are kept.</Banner>
            <Banner tone="offline">Import needs internet.</Banner>
          </>
        )}
        {step === 4 && <><Banner tone="success" title="Imported 182 families.">12 filled in · 24 skipped.</Banner><Button variant="outline" icon="Undo2">Undo this import</Button></>}
      </div>
      {step < 4 && <StickyActions><Button variant="outline">Back</Button><Button>{step === 1 ? 'Check the list' : step === 2 ? 'Next' : 'Import 182 families'}</Button></StickyActions>}
    </PhoneFrame>
  );
}

export function GuestsDesktop() {
  return (
    <DesktopFrame active="Guests" title="Guests" actions={<><Button variant="outline" icon="Upload">Import</Button><Button variant="outline" icon="MessageCircle">Remind</Button><Button icon="Plus">Add a family</Button></>} label="Guests · desktop table">
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: 16, alignItems: 'center' }}><Header /><TextField placeholder="Search name, phone, group or area" icon="Search" /></div>
      <GuestFilters />
      <div className="am-card am-card--flush">
        <table className="am-table">
          <thead><tr><th style={{ width: 40 }} /><th>Family</th><th>Side</th><th>Phone</th><th>People</th><th>Food</th><th>Area</th><th>Engagement</th></tr></thead>
          <tbody>
            {FAMILIES.map((f, i) => (
              <tr key={f.name} className={i === 1 ? 'is-selected' : ''}>
                <td><Checkbox checked={i === 1} label="" /></td>
                <td><div className="am-row-flex" style={{ gap: 10 }}><Avatar name={f.name} size={34} /><b>{f.name}</b>{f.vip && <Icon name="Star" size={14} style={{ color: 'var(--warning)' }} />}</div></td>
                <td>{f.side}</td><td className="am-num">{f.phone || <span style={{ color: 'var(--warning)', fontWeight: 700 }}>No phone</span>}</td>
                <td className="am-num">{f.adults} + {f.children}</td><td>{f.food}{f.jain ? ` · Jain ${f.jain}` : ''}</td><td>{f.area}</td><td><StatusBadge status={f.rsvp} size="sm" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DesktopFrame>
  );
}
