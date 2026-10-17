// 8 · Workspaces (/workspaces, /workspaces/:id) and 9 · Outfits, menu & decoration (/outfits/:id + workspace sections)
import React from 'react';
import { PhoneFrame, DesktopFrame, TopBar, IconButton, TextField, Chip, ChipRow, Icon, ListRow, StatusBadge, Card, Button, Avatar, QuickAdd, SelectField, TextArea, StickyActions, Banner, Dialog, Hint, ProgressRing, ProgressBar, EmptyState, Segmented, Photo, Timeline, BottomSheet, UndoBar, Checkbox, Switch, Stepper, GlassPanel, SectionHeader } from '../components.jsx';
import { WORKSPACES, VENDORS } from '../data.js';
import { useGo, isAdmin } from '../core.jsx';

export function WorkspaceCard({ w, wide }) {
  const go = useGo();
  return (
    <button type="button" className="am-card am-card--flush" onClick={() => go('workspace')} style={{ textAlign: 'left', cursor: 'pointer', width: '100%' }}>
      <Photo name={w.photo} ratio={wide ? '16/9' : '21/9'} radius="none" overlay="scrim">
        <div style={{ marginTop: 'auto', padding: '12px 14px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ color: '#fff' }}><div className="am-display" style={{ fontSize: 28, lineHeight: 1 }}>{w.name}</div><div className="am-small am-strong">{w.event}</div></div>
          <GlassPanel style={{ borderRadius: 14, padding: 4 }}><ProgressRing value={w.pct} size={54} stroke={6} glass /></GlassPanel>
        </div>
      </Photo>
      <div className="am-row-flex" style={{ padding: '10px 14px', gap: 10, justifyContent: 'space-between' }}>
        <span className="am-meta"><Icon name="ListChecks" size={16} /> {w.open} open tasks</span>
        {w.overdue ? <StatusBadge status="overdue" size="sm">{w.overdue} overdue</StatusBadge> : <StatusBadge status="coming" size="sm">On track</StatusBadge>}
        <span className="am-link" style={{ minHeight: 0 }}>Open <Icon name="ChevronRight" size={16} /></span>
      </div>
    </button>
  );
}

export function WorkspaceList({ role = 'owner' }) {
  return (
    <PhoneFrame nav="Workspace" label="Workspace list" fab={isAdmin(role) ? <QuickAdd label="Add workspace" /> : null}>
      <TopBar title="Workspace" large sub="Everything for each function in one place." />
      <div className="am-pad am-col" style={{ gap: 14, paddingBottom: 20 }}>
        {WORKSPACES.map((w) => <WorkspaceCard key={w.id} w={w} />)}
      </div>
    </PhoneFrame>
  );
}

const SECTIONS = [
  ['Bride outfit', 'Sparkles', '3 of 4 steps', 75, 'outfit'], ['Groom outfit', 'Shirt', '2 of 4 steps', 50, 'outfit'], ['Family outfits', 'Users', '5 outfits', 40, 'outfit'],
  ['Theme & decoration', 'Flower2', 'Blush & gold · 3 items', 33, 'decor'], ['Menu', 'UtensilsCrossed', '18 dishes · 6 Jain', 60, 'menu'], ['Contacts', 'Contact', '4 vendors', null, 'contacts'],
  ['Guest details', 'Users', '186 coming · 24 waiting', 64, 'guestsWs'], ['Event timeline', 'Clock', '9 steps · 4 h 30 min', null, 'timeline'],
];

export function WorkspaceDetail({ role = 'owner' }) {
  const go = useGo();
  return (
    <PhoneFrame darkStatus height={1900} label={`Engagement workspace · full scroll${role === 'viewer' ? ' (viewer)' : ''}`} nav="Workspace">
      <div className="am-col" style={{ marginTop: -50, paddingBottom: 24 }}>
        <Photo name="engagement" ratio="auto" radius="none" overlay="scrim-top" style={{ height: 340 }}>
          <div className="am-row-flex" style={{ justifyContent: 'space-between', padding: '54px 12px 0' }}>
            <IconButton icon="ChevronLeft" label="Back" variant="glass" />
            {role !== 'viewer' && <IconButton icon="Pencil" label="Edit workspace" variant="glass" />}
          </div>
          <div style={{ marginTop: 'auto', padding: '0 16px 16px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ color: '#fff' }}>
              <div className="am-small am-strong">On the calendar: Engagement</div>
              <h1 className="am-display" style={{ fontSize: 42, lineHeight: 1 }}>Engagement</h1>
              <div className="am-strong">Sun 22 Nov 2026 · Shree Vatika</div>
            </div>
            <GlassPanel style={{ borderRadius: 18, padding: '10px 14px', textAlign: 'center' }}><div className="am-display" style={{ fontSize: 34, lineHeight: 1 }}>36</div><div className="am-small am-strong">days to go</div></GlassPanel>
          </div>
        </Photo>
        <div className="am-pad am-col" style={{ gap: 14, marginTop: 14 }}>
          <div className="am-card" style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <ProgressRing value={68} size={68} />
            <div className="am-col" style={{ gap: 2, flex: 1 }}><b>17 of 25 tasks done</b><span className="am-small" style={{ color: 'var(--danger)', fontWeight: 700 }}><Icon name="TriangleAlert" size={14} /> 1 overdue</span><span className="am-small am-muted">12 attachments</span></div>
          </div>
          <ChipRow>{SECTIONS.map(([n], i) => <Chip key={n} selected={i === 0}>{n}</Chip>)}</ChipRow>
          <div className="am-grid2">
            {SECTIONS.map(([n, ic, sub, pct, to]) => (
              <button key={n} type="button" onClick={() => go(to)} className="am-card" style={{ textAlign: 'left', gap: 8, padding: 14, cursor: 'pointer' }}>
                <div className="am-row-flex" style={{ justifyContent: 'space-between' }}><span className="am-stat__icon" style={{ margin: 0 }}><Icon name={ic} /></span>{pct != null && <span className="am-small am-strong am-muted">{pct}%</span>}</div>
                <b style={{ fontSize: 16 }}>{n}</b>
                <span className="am-small am-muted">{sub}</span>
                {pct != null && <ProgressBar value={pct} />}
              </button>
            ))}
          </div>
          <Card title="Tasks" icon="ListChecks" action="Add task" pad={false}>
            <div style={{ paddingTop: 6 }}>
              <ListRow dense to="task" title="Send engagement invitations" sub="Due Mon 26 Oct · Ayush" trail={<StatusBadge status="urgent" size="sm" />} />
              <ListRow dense to="task" title="Book ring-ceremony pandit ji" sub="Overdue · 14 Oct · Papa ji" tone="overdue" trail={<StatusBadge status="overdue" size="sm" />} />
            </div>
          </Card>
          <Card title="Files" icon="Paperclip" action="Add attachment">
            <div className="am-grid3">{['lehenga', 'stage', 'petals'].map((p) => <Photo key={p} name={p} ratio="1/1" radius="md" />)}</div>
          </Card>
          {role === 'viewer' && <Hint>You can see this workspace. Ayush, Mahi or family editors can change it.</Hint>}
        </div>
      </div>
    </PhoneFrame>
  );
}

export function WorkspaceEmpty() {
  return (
    <PhoneFrame nav="Workspace" label="Workspace · new, nothing added yet">
      <TopBar back title="Haldi" sub="Not linked to the calendar" actions={<IconButton icon="Pencil" label="Edit workspace" />} />
      <div className="am-pad am-col" style={{ gap: 14 }}>
        <EmptyState photo="drapes" title="Start planning Haldi" action="Add task">Add outfits, decor, a menu and a timeline. Link a calendar event (✏️ at the top) to see its guests.</EmptyState>
        <div className="am-grid2">{SECTIONS.slice(0, 4).map(([n, ic]) => <div key={n} className="am-card" style={{ padding: 12, gap: 6 }}><Icon name={ic} style={{ color: 'var(--primary)' }} /><b className="am-small">{n}</b><span className="am-small am-muted">Nothing yet</span></div>)}</div>
      </div>
    </PhoneFrame>
  );
}

/* ---------- Outfits ---------- */
const OUTFIT_STEPS = [
  { title: 'Selected', state: 'done', meta: 'Done 2 Sep · Sabyasachi-style blush lehenga' },
  { title: 'Stitched', state: 'done', meta: 'Done 30 Sep · Tailor: Lalit Boutique' },
  { title: 'Trial done', state: 'current', meta: 'Fri 23 Oct · 1 task', extra: <span className="am-small" style={{ color: 'var(--primary)', fontWeight: 700 }}>Final fitting — bridal lehenga</span> },
  { title: 'Final approved', state: 'next', meta: 'Not done yet' },
];

export function OutfitDetail({ tab = 'Bride' }) {
  return (
    <PhoneFrame darkStatus height={1760} label={`Outfit details · ${tab}`}>
      <div className="am-col" style={{ marginTop: -50, paddingBottom: 24 }}>
        <Photo name={tab === 'Groom' ? 'sherwani' : 'lehenga'} ratio="auto" radius="none" overlay="scrim-top" style={{ height: 320 }} label="Moodboard cover" labelStyle={{ top: 'auto', bottom: 100, left: 16 }}>
          <div className="am-row-flex" style={{ justifyContent: 'space-between', padding: '54px 12px 0' }}>
            <IconButton icon="ChevronLeft" label="Back" variant="glass" /><div className="am-row-flex" style={{ gap: 8 }}><IconButton icon="Heart" label="Favourite" variant="glass" /><IconButton icon="EllipsisVertical" label="Rename or delete outfit" variant="glass" /></div>
          </div>
          <div style={{ marginTop: 'auto', padding: '0 16px 16px', color: '#fff' }}>
            <div className="am-small am-strong">Engagement · {tab === 'Groom' ? 'Groom' : 'Bride'}</div>
            <h1 className="am-display" style={{ fontSize: 38, lineHeight: 1 }}>{tab === 'Groom' ? 'Ivory sherwani' : 'Blush lehenga'}</h1>
          </div>
        </Photo>
        <div className="am-pad am-col" style={{ gap: 14, marginTop: 14 }}>
          <Segmented options={['Bride', 'Groom', 'Family']} value={tab} label="Outfit for" />
          <Card>
            <div className="am-row-flex" style={{ gap: 12 }}><Avatar name="Lalit Boutique" size={44} tone="champagne" /><div style={{ flex: 1 }}><b>Lalit Boutique</b><div className="am-small am-muted">Tailor · vendor</div></div><IconButton icon="Phone" label="Call Lalit Boutique" variant="call" /><IconButton icon="MessageCircle" label="WhatsApp Lalit Boutique" variant="wa" /></div>
          </Card>
          <Card title="Timeline" icon="Route" action="Add step"><ProgressBar value={50} label="2 of 4 steps done" /><Timeline steps={OUTFIT_STEPS} /></Card>
          <Card title="Moodboard" icon="Images" action="From Vault">
            <div className="am-grid3">
              {['lehenga', 'petals', 'engagement'].map((p, i) => <Photo key={p} name={p} ratio="3/4" radius="md">{i === 0 && <div style={{ padding: 6 }}><span className="am-glass am-glass--white" style={{ borderRadius: 999, padding: '2px 6px', display: 'inline-flex' }}><Icon name="Heart" size={14} style={{ color: 'var(--primary)', fill: 'var(--primary)' }} /></span></div>}</Photo>)}
            </div>
            <div className="am-row-flex" style={{ gap: 8 }}><Button variant="outline" size="sm" icon="Plus">Add attachment</Button><Button variant="ghost" size="sm" icon="Archive">From Vault</Button></div>
          </Card>
          <Card title="Accessories" icon="Gem" action="Add accessory" pad={false}>
            <div style={{ paddingTop: 6 }}>
              <ListRow dense title="Kundan necklace set" sub="From Nani · polish needed" trail={<StatusBadge status="done" size="sm">Ready</StatusBadge>} />
              <ListRow dense title="Blush juttis" sub="1 task · size 37" trail={<StatusBadge status="waiting" size="sm" />} />
              <ListRow dense title="Dupatta pins" sub="2 photos" trail={<Icon name="Paperclip" size={18} />} />
            </div>
          </Card>
          <Card title="Notes" icon="StickyNote" action="Add note"><p>Keep the dupatta light — outdoor lawn. <span className="am-small am-muted">· Mahi, 2 Oct</span></p></Card>
          <Card title="Tasks" icon="ListChecks" action="Add task"><ListRow dense to="task" title="Final fitting — bridal lehenga" sub="Fri 23 Oct · Mahi" trail={<StatusBadge status="waiting" size="sm" />} /></Card>
        </div>
      </div>
    </PhoneFrame>
  );
}

export function FamilyOutfits() {
  const groups = [['Close family · Female', [['Mummy ji – Banarasi saree', 75], ['Riya didi – Lehenga', 50]]], ['Close family · Male', [['Papa ji – Bandhgala', 50], ['Mama ji – Safa', 25]]], ['Extended family · Female', [['Bua ji – Saree', 0]]], ['Extended family · Male', []]];
  return (
    <PhoneFrame nav="Workspace" label="Family outfits (same layout for every group)">
      <TopBar back title="Family outfits" sub="Engagement" actions={<IconButton icon="Plus" label="Add outfit" variant="soft" />} />
      <div className="am-pad am-col" style={{ gap: 14, paddingBottom: 20 }}>
        <Segmented options={['Bride', 'Groom', 'Family']} value="Family" label="Outfit for" />
        {groups.map(([g, items]) => (
          <div key={g} className="am-col" style={{ gap: 8 }}>
            <SectionHeader title={g} count={items.length} />
            {items.length ? (
              <div className="am-list">{items.map(([n, p]) => <ListRow key={n} to="outfit" lead={<Photo name={p > 40 ? 'lehenga' : 'sherwani'} ratio="1/1" radius="md" style={{ width: 52 }} />} title={n} sub={<ProgressBar value={p} />} trail={<span className="am-small am-strong am-muted">{p}%</span>} />)}</div>
            ) : <div className="am-card am-card--cream" style={{ alignItems: 'center', padding: 14 }}><span className="am-muted am-small">No outfit yet.</span><Button variant="ghost" size="sm" icon="Plus">Add outfit</Button></div>}
          </div>
        ))}
      </div>
    </PhoneFrame>
  );
}

/* ---------- Theme & decoration ---------- */
export function DecorSection() {
  return (
    <PhoneFrame nav="Workspace" height={1500} label="Theme & decoration">
      <TopBar back title="Theme & decoration" sub="Varmala & Phere" actions={<IconButton icon="Pencil" label="Edit theme" />} />
      <div className="am-pad am-col" style={{ gap: 14, paddingBottom: 24 }}>
        <Photo name="stage" ratio="16/9" radius="xl" overlay="scrim">
          <div style={{ marginTop: 'auto', padding: 14, color: '#fff' }}><div className="am-small am-strong">Theme</div><div className="am-display" style={{ fontSize: 30 }}>Blush &amp; gold garden</div>
            <div className="am-row-flex" style={{ gap: 6, marginTop: 6 }}>{['#f7e4e6', '#e8a317', '#ffffff', '#8a1c2b'].map((c) => <span key={c} className="am-swatch" style={{ background: c }} />)}<span className="am-small am-strong">Blush, gold, ivory, wine</span></div></div>
        </Photo>
        <Card title="Theme board" icon="Images" action="Add"><div className="am-grid3">{['stage', 'petals', 'drapes'].map((p) => <Photo key={p} name={p} ratio="1/1" radius="md" />)}</div></Card>
        <SectionHeader title="Decor items" count={3} action="Add decor item" icon="Flower2" />
        {[['Stage', 'Shree Tent House', 2, 'stage'], ['Entry gate', 'Shree Tent House', 1, 'phere'], ['Mandap', 'Not assigned', 0, 'drapes']].map(([n, v, done, ph]) => (
          <Card key={n} pad={false}>
            <div className="am-row-flex" style={{ gap: 12, padding: 14 }}>
              <Photo name={ph} ratio="1/1" radius="md" style={{ width: 64 }} />
              <div style={{ flex: 1 }}><b>{n}</b><div className="am-small am-muted">{v}</div><div className="am-small">{done} of 4 steps done</div></div>
              <Icon name="ChevronRight" style={{ color: 'var(--text-muted)' }} />
            </div>
            {n === 'Stage' && (
              <div style={{ padding: '0 14px 14px' }}>
                <Timeline steps={[{ title: 'Booked', state: 'done', meta: '1 Oct' }, { title: 'Sample seen', state: 'done', meta: '10 Oct · 3 photos' }, { title: 'Final approved', state: 'current', meta: 'Waiting for Mahi' }, { title: 'Set up', state: 'next', meta: 'Mon 15 Feb' }]} />
                <div className="am-row-flex" style={{ gap: 6, flexWrap: 'wrap' }}><StatusBadge status="normal" size="sm">Props: Marigold strings</StatusBadge><StatusBadge status="normal" size="sm">2 tasks</StatusBadge></div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </PhoneFrame>
  );
}

/* ---------- Menu ---------- */
function Dish({ n, diet, must, note, photo }) {
  return (
    <ListRow dense lead={<Photo name={photo || 'feast'} ratio="1/1" radius="md" style={{ width: 48 }} />} title={<span className="am-row-flex" style={{ gap: 6 }}>{n}{must && <Icon name="Heart" size={15} style={{ color: 'var(--primary)', fill: 'var(--primary)' }} label="Must-have" />}</span>}
      sub={note} trail={<StatusBadge status={diet === 'Jain' ? 'jain' : 'normalDiet'} size="sm">{diet}</StatusBadge>} chevron={false} />
  );
}

export function MenuSection() {
  return (
    <PhoneFrame nav="Workspace" height={1320} label="Menu" fab={<QuickAdd label="Add dish" />}>
      <TopBar back title="Menu" sub="Reception · 18 dishes · 6 Jain" actions={<IconButton icon="Copy" label="Copy menu from another workspace" />} />
      <div className="am-pad am-col" style={{ gap: 14, paddingBottom: 24 }}>
        <Card>
          <div className="am-row-flex" style={{ gap: 12 }}><Avatar name="Annapurna Caterers" size={46} tone="champagne" /><div style={{ flex: 1 }}><div className="am-small am-muted am-strong">Caterer</div><b>Annapurna Caterers</b><div className="am-small am-muted">Gopal ji</div></div><IconButton icon="Phone" label="Call Annapurna Caterers" variant="call" /><IconButton icon="MessageCircle" label="WhatsApp Annapurna Caterers" variant="wa" /></div>
        </Card>
        <ChipRow><Chip selected>All</Chip><Chip icon="Leaf">Jain</Chip><Chip icon="Heart">Must-have</Chip></ChipRow>
        <SectionHeader title="Welcome drinks" count={3} action="Add dish" />
        <div className="am-list"><Dish n="Kesar badam milk" diet="Normal" must /><Dish n="Aam panna" diet="Jain" note="No onion, no garlic" /><Dish n="Rose sharbat" diet="Jain" /></div>
        <SectionHeader title="Starters" count={4} action="Add dish" />
        <div className="am-list"><Dish n="Paneer tikka" diet="Normal" must note="2 tasks · tasting on 24 Oct" /><Dish n="Raw banana tikki" diet="Jain" /><Dish n="Dahi kebab" diet="Normal" /></div>
        <Card title="Menu files" icon="Paperclip" action="Add"><ListRow dense to="attachment" title="Caterer quotation.pdf" sub="ATT-3HVN8P" lead={<Icon name="FileText" />} /></Card>
      </div>
    </PhoneFrame>
  );
}

export function MenuCopy() {
  return (
    <PhoneFrame nav="Workspace" label="Copy a menu (undo-friendly)" overlay={
      <BottomSheet title="Copy a menu" actions={<Button block icon="Copy">Copy menu</Button>}>
        <SelectField label="Copy from" value="Varmala & Phere · 22 dishes" />
        <Banner tone="info" icon="Undo2">Dishes already here are skipped. You can Undo.</Banner>
      </BottomSheet>}>
      <TopBar back title="Menu" sub="Reception" />
    </PhoneFrame>
  );
}

export function MenuEmpty() {
  return (
    <PhoneFrame nav="Workspace" label="Menu · empty" toast={<UndoBar>Menu copied · 22 added</UndoBar>}>
      <TopBar back title="Menu" sub="Mayra" />
      <div className="am-pad"><EmptyState photo="feast" title="No menu yet" action="Add category">Add a category (Welcome drinks, Starters, Main course, Desserts…) or copy a menu from another workspace.</EmptyState><Button block variant="outline" icon="Copy">Copy menu from…</Button></div>
    </PhoneFrame>
  );
}

export function DishSheet() {
  return (
    <PhoneFrame nav="Workspace" label="Add / edit dish" overlay={
      <BottomSheet title="Add dish" actions={<Button block>Save dish</Button>}>
        <TextField label="Dish" placeholder="e.g. Paneer tikka" value="Malai kofta" />
        <div className="am-field"><span className="am-field__label">Normal or Jain</span><Segmented options={['Normal', 'Jain']} value="Jain" /></div>
        <Switch on label="Must-have" sub="Shown with a heart." />
        <TextField label="Note" optional placeholder="e.g. No onion, no garlic" />
        <SelectField label="Category" value="Main course" />
      </BottomSheet>}>
      <TopBar back title="Menu" sub="Reception" />
    </PhoneFrame>
  );
}

/* ---------- Contacts ---------- */
export function ContactsSection() {
  return (
    <PhoneFrame nav="Workspace" label="Contacts (vendors for this function)" overlay={null}>
      <TopBar back title="Contacts" sub="Mehndi" actions={<IconButton icon="Plus" label="Add contact" variant="soft" />} />
      <div className="am-pad am-col" style={{ gap: 14, paddingBottom: 20 }}>
        <p className="am-small am-muted">Tap a contact to change their role or remove them from this workspace.</p>
        <div className="am-list">
          {[[VENDORS[3], 'Mehndi for 40 guests'], [VENDORS[2], 'Candid photos'], [VENDORS[0], 'Stage & lights']].map(([v, role]) => (
            <ListRow key={v.name} lead={<Avatar name={v.name} size={44} />} title={v.name} sub={<><span>{role}</span><span>{v.contact}</span></>} chevron={false}
              trail={<div className="am-row-flex" style={{ gap: 4 }}><IconButton icon="Phone" label={`Call ${v.name}`} variant="call" /><IconButton icon="MessageCircle" label={`WhatsApp ${v.name}`} variant="wa" /></div>} />
          ))}
        </div>
        <SectionHeader title="Also used here" icon="Link" />
        <p className="am-small am-muted" style={{ marginTop: -8 }}>Linked through a caterer, decor item, outfit, task or attachment.</p>
        <div className="am-list"><ListRow lead={<Avatar name="Lalit Boutique" size={40} />} title="Lalit Boutique" sub="Bride outfit · tailor" trail={<Button size="sm" variant="secondary" icon="Plus">Add as contact</Button>} chevron={false} /></div>
      </div>
    </PhoneFrame>
  );
}

export function ContactRemove() {
  return (
    <PhoneFrame nav="Workspace" label="Remove a contact ≠ delete the vendor" overlay={
      <Dialog title="Remove Click Studio from Mehndi?" icon="UserMinus" actions={<><Button block>Remove from this workspace</Button><Button block variant="outline">Cancel</Button></>}>
        <p>The vendor stays in Money › Vendors with its payments. You can Undo.</p>
      </Dialog>}>
      <TopBar back title="Contacts" sub="Mehndi" />
    </PhoneFrame>
  );
}

/* ---------- Event timeline ---------- */
export function TimelineSection({ empty }) {
  const steps = [['Couple entry', '7:30 pm', '15 min', true], ['Varmala', '7:45 pm', '20 min', true], ['Photos with family', 'about 8:05 pm', '45 min', false], ['Dinner opens', '9:00 pm', '90 min', true], ['Pheras', 'about 10:30 pm', '120 min', false]];
  return (
    <PhoneFrame nav="Workspace" label={empty ? 'Event timeline · empty with suggestions' : 'Event timeline'} toast={!empty ? <UndoBar>Deleted “Cake cutting”.</UndoBar> : null}>
      <TopBar back title="Event timeline" sub="Varmala & Phere" actions={<IconButton icon="Plus" label="Add step" variant="soft" />} />
      <div className="am-pad am-col" style={{ gap: 14, paddingBottom: 20 }}>
        {empty ? (
          <EmptyState icon="Clock" title="No steps yet" action="Add suggested steps" actionIcon="Sparkles">We can start you with Couple entry, Varmala, Photos, Dinner and Pheras. Change anything after.</EmptyState>
        ) : (
          <>
            <div className="am-card am-card--blush" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><b>Total 4 h 50 min</b><span className="am-small">7:30 pm → about 12:20 am</span></div>
            <ol className="am-col" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 8 }}>
              {steps.map(([p, t, d, exact], i) => (
                <li key={p} className="am-card" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: '10px 8px 10px 12px' }}>
                  <span className="am-step-num" aria-hidden="true">{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b>{p}</b>
                    <div className="am-small" style={{ color: exact ? 'var(--text)' : 'var(--text-muted)', fontStyle: exact ? 'normal' : 'italic' }}>{t}{!exact && ' (follows the step before)'} · {d}</div>
                  </div>
                  <div className="am-row-flex"><IconButton icon="ArrowUp" label={`Move ${p} up`} /><IconButton icon="ArrowDown" label={`Move ${p} down`} /></div>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </PhoneFrame>
  );
}

export function TimelineStepSheet() {
  return (
    <PhoneFrame nav="Workspace" label="Add / edit timeline step" overlay={
      <BottomSheet title="Edit step" actions={<><Button block>Save step</Button><Button block variant="destructive-outline" icon="Trash2">Delete step</Button></>}>
        <TextField label="Purpose" value="Varmala" />
        <TextField label="Time" optional value="7:45 pm" icon="Clock" help="Leave empty to follow the step before." />
        <TextField label="Duration (minutes)" value="20" inputMode="numeric" error={undefined} />
        <TextArea label="Note" value="Flower showers from the balcony." />
        <div className="am-row-flex" style={{ gap: 8 }}><Button variant="outline" size="sm" icon="Paperclip">Attach</Button><Button variant="outline" size="sm" icon="ListChecks">Add task</Button></div>
      </BottomSheet>}>
      <TopBar back title="Event timeline" />
    </PhoneFrame>
  );
}

/* ---------- Guest details ---------- */
export function GuestDetailsSection({ noEvent }) {
  return (
    <PhoneFrame nav="Workspace" label={noEvent ? 'Guest details · no event linked' : 'Guest details'}>
      <TopBar back title="Guest details" sub="Mehndi" />
      <div className="am-pad am-col" style={{ gap: 14, paddingBottom: 20 }}>
        {noEvent ? <Banner tone="info" icon="Link">Link a calendar event to this workspace (✏️ at the top) to see its guests.</Banner> : (
          <>
            <div className="am-grid2">
              {[['Families invited', '72', 'Users'], ['Coming', '46', 'CircleCheck'], ['Waiting', '20', 'Hourglass'], ['Not coming', '6', 'CircleX']].map(([l, n, ic]) => (
                <div key={l} className="am-card" style={{ padding: 12, gap: 4 }}><span className="am-meta"><Icon name={ic} size={16} /> {l}</span><b style={{ fontSize: 26 }}>{n}</b></div>
              ))}
            </div>
            <Card title="186 people coming" icon="Users"><p>142 adults · 44 children · 38 Jain</p><p className="am-small am-muted">Up to 240 with those still waiting</p><Button variant="outline" icon="ExternalLink" size="sm" to="guests">Open in Guests</Button></Card>
            <TextArea label="Guest notes" value="Seat Nanihal near the stage. Pickup from station for Udaipur family at 9 am." rows={4} />
            <Button>Save notes</Button>
          </>
        )}
      </div>
    </PhoneFrame>
  );
}

export function WorkspaceDesktop() {
  return (
    <DesktopFrame active="Workspace" label="Engagement workspace · desktop with section rail" title="Engagement" actions={<><Button variant="outline" icon="Pencil">Edit</Button><Button icon="Plus">Add task</Button></>}
      aside={<><Card title="Tasks" icon="ListChecks"><ListRow dense title="Send engagement invitations" sub="Due Mon 26 Oct" trail={<StatusBadge status="urgent" size="sm" />} /><ListRow dense title="Book ring-ceremony pandit ji" sub="Overdue" tone="overdue" /></Card><Card title="Contacts" icon="Contact"><ListRow dense title="Click Studio Bhilwara" sub="Candid photos" /></Card></>}>
      <Photo name="engagement" ratio="auto" radius="xl" overlay="scrim" style={{ height: 240 }}>
        <div style={{ marginTop: 'auto', padding: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', color: '#fff' }}>
          <div><div className="am-display" style={{ fontSize: 44 }}>Engagement</div><b>Sun 22 Nov 2026 · Shree Vatika</b></div>
          <GlassPanel style={{ borderRadius: 18, padding: '10px 16px', textAlign: 'center', color: 'var(--text)' }}><div className="am-display" style={{ fontSize: 36, lineHeight: 1 }}>36</div><b className="am-small">days to go</b></GlassPanel>
        </div>
      </Photo>
      <div className="am-grid4">
        {SECTIONS.map(([n, ic, sub, pct]) => <div key={n} className="am-card" style={{ padding: 14, gap: 6 }}><span className="am-stat__icon" style={{ margin: 0 }}><Icon name={ic} /></span><b>{n}</b><span className="am-small am-muted">{sub}</span>{pct != null && <ProgressBar value={pct} />}</div>)}
      </div>
    </DesktopFrame>
  );
}
