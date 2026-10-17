// 7 · Money & vendors: /money, /money/payments(/new|/:id|/:id/edit), /vendors(/new|/:id|/:id/edit)
import React from 'react';
import { PhoneFrame, DesktopFrame, TopBar, IconButton, TextField, Chip, ChipRow, Icon, ListRow, StatusBadge, Card, Button, Avatar, QuickAdd, MoreDetails, SelectField, TextArea, StickyActions, MoneyField, Switch, Banner, Dialog, Hint, ProgressBar, EmptyState, Segmented, StatTile, Toast } from '../components.jsx';
import { PAYMENTS, VENDORS } from '../data.js';
import { rupees } from '../core.jsx';

export function PaymentRow({ p }) {
  return (
    <ListRow to="payment" tone={p.status === 'overdue' ? 'overdue' : undefined}
      lead={<Avatar name={p.to} size={42} />}
      title={p.title}
      sub={<><span>{p.to}</span><span className="am-meta" style={{ color: p.status === 'overdue' ? 'var(--danger)' : undefined, fontWeight: p.status === 'overdue' ? 700 : 400 }}><Icon name={p.status === 'paid' ? 'CircleCheck' : p.status === 'overdue' ? 'TriangleAlert' : 'Clock'} size={14} />{p.date}</span></>}
      trail={<><span className="am-strong am-num" style={{ fontSize: 17 }}>{rupees(p.amount)}</span><StatusBadge status={p.status} size="sm" /></>} />
  );
}

function Totals() {
  return (
    <div className="am-grid3">
      <div className="am-card" style={{ padding: 12, gap: 2 }}><span className="am-small am-strong am-muted">Planned</span><b className="am-num" style={{ fontSize: 19 }}>₹32 L</b></div>
      <div className="am-card" style={{ padding: 12, gap: 2, background: 'var(--success-soft)', borderColor: 'transparent' }}><span className="am-small am-strong" style={{ color: 'var(--success)' }}>Paid</span><b className="am-num" style={{ fontSize: 19, color: 'var(--success)' }}>₹11.6 L</b></div>
      <div className="am-card" style={{ padding: 12, gap: 2, background: 'var(--warning-soft)', borderColor: 'transparent' }}><span className="am-small am-strong" style={{ color: 'var(--warning)' }}>Still to pay</span><b className="am-num" style={{ fontSize: 19, color: 'var(--warning)' }}>₹9.4 L</b></div>
    </div>
  );
}

export function MoneyOverview() {
  return (
    <PhoneFrame nav="More" label="Money · overview (Ayush & Mahi)">
      <TopBar back title="Money" actions={<IconButton icon="Settings2" label="Budget" />} />
      <div className="am-pad am-col" style={{ gap: 14, paddingBottom: 20 }}>
        <Totals />
        <Card><ProgressBar value={36} label="Spent ₹11.6 L of ₹32 L" detail="Free ₹11 L" /><p className="am-small am-muted">Not yet split into categories: ₹1.5 L</p></Card>
        <Card title="Due soon" icon="Clock" action="Payments" to="payments" pad={false}><div style={{ paddingTop: 6 }}><PaymentRow p={PAYMENTS[1]} /><PaymentRow p={PAYMENTS[2]} /></div></Card>
        <Card title="Categories" icon="ChartPie" pad={false}>
          <div style={{ paddingTop: 6 }}>
            {[['Tent & decor', 62, '₹4.2 L spent · ₹1.8 L due of ₹7 L'], ['Caterer / Halwai', 30, '₹2.5 L spent · ₹4.5 L due of ₹9 L'], ['Photo & video', 15, '₹0.4 L spent · ₹0.8 L due of ₹3 L']].map(([n, v, d]) => (
              <div key={n} style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}><ProgressBar value={v} label={n} /><div className="am-small am-muted" style={{ marginTop: 4 }}>{d}</div></div>
            ))}
          </div>
        </Card>
        <div className="am-grid2"><StatTile icon="Receipt" label="Payments" value="48" sub="7 due" to="payments" /><StatTile icon="Store" label="Vendors" value="23" sub="14 booked" to="vendors" /></div>
      </div>
    </PhoneFrame>
  );
}

export function MoneyRestricted() {
  return (
    <PhoneFrame nav="More" label="Money · no access (family / viewer)">
      <TopBar back title="Money" />
      <EmptyState icon="Lock" title="Money is private" action="Back to More" actionIcon="ChevronLeft">Only Ayush and Mahi see budgets and payments. Vendor contacts are in Vendors.</EmptyState>
    </PhoneFrame>
  );
}

export function PaymentList({ empty }) {
  return (
    <PhoneFrame nav="More" label={empty ? 'Payments · empty' : 'Payments'} fab={<QuickAdd label="Add payment" />}>
      <TopBar back title="Payments" />
      <div className="am-pad am-col" style={{ gap: 12, paddingBottom: 20 }}>
        <TextField placeholder="Search payments" icon="Search" />
        <ChipRow>{[['All', 48], ['Due', 7], ['Overdue', 1], ['Paid', 40], ['No date', 1]].map(([l, n]) => <Chip key={l} selected={l === 'All'} count={n} tone={l === 'Overdue' ? 'danger' : undefined}>{l}</Chip>)}</ChipRow>
        {empty ? <EmptyState icon="Receipt" title="No payments yet" action="Add payment">Tap + to add an advance or an expense.</EmptyState> : (
          <>
            <div className="am-row-flex am-small" style={{ justifyContent: 'space-between' }}><b>48 · ₹21 L</b><span className="am-muted">₹9.4 L due · ₹11.6 L paid</span></div>
            <div className="am-list">{PAYMENTS.map((p) => <PaymentRow key={p.title} p={p} />)}</div>
          </>
        )}
      </div>
    </PhoneFrame>
  );
}

export function PaymentDetail() {
  const p = PAYMENTS[2];
  return (
    <PhoneFrame label="Payment details">
      <TopBar back title="Payment" actions={<><IconButton icon="Pencil" label="Edit" to="paymentEdit" /><IconButton icon="EllipsisVertical" label="More" /></>} />
      <div className="am-pad am-col" style={{ gap: 14, paddingBottom: 140 }}>
        <div className="am-card am-card--blush" style={{ alignItems: 'center', textAlign: 'center', gap: 6, padding: 22 }}>
          <StatusBadge status="due">Due 30 Oct</StatusBadge>
          <div className="am-num" style={{ fontSize: 38, fontWeight: 700 }}>{rupees(p.amount)}</div>
          <div className="am-strong">{p.title}</div>
        </div>
        <div className="am-grid2">
          <div className="am-card" style={{ padding: 12, gap: 2 }}><span className="am-small am-muted am-strong">Paid so far</span><b className="am-num" style={{ color: 'var(--success)' }}>₹20,000</b></div>
          <div className="am-card" style={{ padding: 12, gap: 2 }}><span className="am-small am-muted am-strong">Still to pay</span><b className="am-num" style={{ color: 'var(--warning)' }}>₹60,000</b></div>
        </div>
        <Card>
          <dl className="am-kv" style={{ margin: 0 }}><dt>Paid to</dt><dd>{p.to}</dd><dt>Category</dt><dd>{p.category}</dd><dt>Event</dt><dd>{p.event}</dd><dt>How</dt><dd>Bank transfer</dd><dt>Reference</dt><dd>UTR 4421 0987</dd><dt>Paid by</dt><dd>Papa ji</dd></dl>
        </Card>
        <Card title="Receipts" icon="Receipt" action="Add receipt photo"><ListRow dense title="Advance receipt" sub="12 Oct · 380 KB" lead={<Icon name="FileImage" />} to="document" /></Card>
        <Card title="Part of" icon="Link"><p className="am-muted">Photography booking — split into 2 payments</p></Card>
        <Button variant="ghost" icon="History" to="history">History</Button>
      </div>
      <StickyActions><Button variant="outline">Pay part</Button><Button icon="CircleCheck">Mark as paid</Button></StickyActions>
    </PhoneFrame>
  );
}

export function PaymentForm({ mode = 'add', state }) {
  return (
    <PhoneFrame offline={state === 'offline'} label={`${mode === 'add' ? 'Add payment' : 'Edit payment'}${state ? ' · ' + state : ''}`} overlay={state === 'duplicate' ? (
      <Dialog title="This looks like a payment you already have" icon="Copy" tone="warning" actions={<><Button block variant="outline" icon="ExternalLink">Open existing</Button><Button block>Save anyway</Button></>}>
        <div className="am-card am-card--cream" style={{ padding: 12, gap: 2 }}><b>Tent advance · ₹1,50,000</b><span className="am-small">Shree Tent House · Paid 2 Oct · UPI</span></div>
        <p>Same vendor and amount within 7 days.</p>
      </Dialog>) : null}>
      <TopBar back title={mode === 'add' ? 'Add payment' : 'Edit payment'} />
      <div className="am-pad am-col" style={{ gap: 16, paddingBottom: 150 }}>
        {state === 'offline' && <Banner tone="offline" title="Money changes need internet.">Your typing is kept. Save when you’re back online.</Banner>}
        {state === 'error' && <Banner tone="error" title="Please fix 1 thing below." />}
        <SelectField label="Paid to" value="Shree Tent House" icon="Store" />
        <MoneyField value={state === 'error' ? '1.5 lakh rupees' : '1,50,000'} error={state === 'error' ? 'Enter an amount, like 50000 or 1.25 lakh.' : undefined} />
        <TextField label="What for?" value="Tent advance" help="e.g. Tent advance" />
        <Switch on label="Paid already" sub="Off = due later" />
        <div className="am-grid2"><TextField label="Paid on" value="2 Oct 2026" icon="CalendarDays" /><SelectField label="How" value="UPI" /></div>
        <MoreDetails count={6}>
          <SelectField label="Category" value="Tent & decor" help="Vendor’s usual category, or Miscellaneous" />
          <SelectField label="Event" optional value="Varmala & Phere" />
          <TextField label="Paid by" optional value="Papa ji" />
          <TextField label="Reference" optional help="UPI or cheque number" />
          <TextArea label="Notes" />
          <Button variant="outline" icon="Camera" size="sm">Add receipt photo</Button>
        </MoreDetails>
      </div>
      <StickyActions><Button variant="outline">Cancel</Button><Button disabled={state === 'offline'}>Save payment</Button></StickyActions>
    </PhoneFrame>
  );
}

export function VendorList() {
  return (
    <PhoneFrame nav="More" label="Vendors" fab={<QuickAdd label="Add vendor" />}>
      <TopBar back title="Vendors" />
      <div className="am-pad am-col" style={{ gap: 12, paddingBottom: 20 }}>
        <TextField placeholder="Search vendors" icon="Search" />
        <ChipRow><Chip selected>All</Chip><Chip>Caterer / Halwai</Chip><Chip>Tent &amp; decor</Chip><Chip>Photo &amp; video</Chip><Chip>Mehndi artist</Chip></ChipRow>
        <div className="am-list">
          {VENDORS.map((v) => (
            <ListRow key={v.name} to="vendor" chevron={false} lead={<Avatar name={v.name} size={44} />} title={v.name} sub={<><span>{v.type}</span><span>{v.contact}</span></>}
              trail={<div className="am-row-flex" style={{ gap: 4 }}><IconButton icon="Phone" label={`Call ${v.name}`} variant="call" /><IconButton icon="MessageCircle" label={`WhatsApp ${v.name}`} variant="wa" /></div>} />
          ))}
        </div>
      </div>
    </PhoneFrame>
  );
}

export function VendorDetail({ role = 'owner' }) {
  const v = VENDORS[0];
  return (
    <PhoneFrame label={role === 'owner' ? 'Vendor details' : 'Vendor details · family (no money)'}>
      <TopBar back title="Vendor" actions={role === 'owner' ? <IconButton icon="Pencil" label="Edit vendor" to="vendorEdit" /> : null} />
      <div className="am-pad am-col" style={{ gap: 14, paddingBottom: 24 }}>
        <div className="am-row-flex" style={{ gap: 14 }}><Avatar name={v.name} size={64} tone="champagne" /><div><h1 style={{ fontSize: 24, fontWeight: 700 }}>{v.name}</h1><div className="am-row-flex" style={{ gap: 6 }}><StatusBadge status="normal" size="sm">{v.type}</StatusBadge><StatusBadge status="coming" size="sm">Booked</StatusBadge></div></div></div>
        <div className="am-grid2"><Button variant="secondary" icon="Phone">Call</Button><Button variant="whatsapp" icon="MessageCircle">WhatsApp</Button></div>
        <Card><dl className="am-kv" style={{ margin: 0 }}><dt>Contact</dt><dd>{v.contact}</dd><dt>Phone</dt><dd>{v.phone}</dd><dt>Other phone</dt><dd>98290 77121</dd></dl></Card>
        <Card title="Contact in" icon="LayoutGrid">{v.workspaces.map((w) => <ListRow key={w} dense to="workspace" title={w} sub="Stage & lights" />)}</Card>
        {role === 'owner' ? (
          <Card title="Payments to this vendor" icon="IndianRupee" pad={false}>
            <div style={{ padding: '6px 16px 0' }}><p className="am-small"><b>Agreed ₹7,00,000</b> · paid ₹4,20,000 · due ₹1,80,000</p><p className="am-small am-muted">₹1,00,000 not yet scheduled</p></div>
            <PaymentRow p={PAYMENTS[0]} />
          </Card>
        ) : <Hint>You can see vendor contacts. Payments are visible to Ayush and Mahi only.</Hint>}
        <Card title="Notes" icon="StickyNote"><p>Mukesh ji prefers calls after 11 am.</p></Card>
      </div>
    </PhoneFrame>
  );
}

export function VendorForm() {
  return (
    <PhoneFrame label="Add / edit vendor">
      <TopBar back title="Add vendor" />
      <div className="am-pad am-col" style={{ gap: 16, paddingBottom: 150 }}>
        <TextField label="Name" value="DJ Sonu Beats" />
        <SelectField label="Type" value="Band / DJ" />
        <TextField label="Phone" value="97720 45123" icon="Phone" />
        <TextField label="Contact person" value="Sonu" />
        <MoreDetails open count={4}>
          <TextField label="Other phone" />
          <MoneyField label="Agreed amount (₹)" value="85,000" help="Only Ayush and Mahi see this." />
          <Switch on label="Booked" />
          <TextArea label="Notes" />
        </MoreDetails>
      </div>
      <StickyActions><Button variant="outline">Cancel</Button><Button>Save vendor</Button></StickyActions>
    </PhoneFrame>
  );
}

export function MoneyDesktop() {
  return (
    <DesktopFrame active="Money" title="Money" actions={<Button icon="Plus">Add payment</Button>} label="Money · desktop (payments table)"
      aside={<><h2 style={{ fontSize: 20, fontWeight: 700 }}>Due soon</h2><PaymentRow p={PAYMENTS[1]} /><PaymentRow p={PAYMENTS[2]} /><Card title="Categories" icon="ChartPie"><ProgressBar value={62} label="Tent & decor" /><ProgressBar value={30} label="Caterer / Halwai" /><ProgressBar value={15} label="Photo & video" /></Card></>}>
      <Totals />
      <ChipRow>{['All', 'Due', 'Overdue', 'Paid', 'No date'].map((l) => <Chip key={l} selected={l === 'All'}>{l}</Chip>)}</ChipRow>
      <div className="am-card am-card--flush">
        <table className="am-table">
          <thead><tr><th>Payment</th><th>Paid to</th><th>Category</th><th>Date</th><th style={{ textAlign: 'right' }}>Amount</th><th>Status</th></tr></thead>
          <tbody>{PAYMENTS.map((p) => <tr key={p.title}><td><b>{p.title}</b></td><td>{p.to}</td><td>{p.category}</td><td style={{ color: p.status === 'overdue' ? 'var(--danger)' : undefined, fontWeight: p.status === 'overdue' ? 700 : 400 }}>{p.date}</td><td className="am-num" style={{ textAlign: 'right', fontWeight: 700 }}>{rupees(p.amount)}</td><td><StatusBadge status={p.status} size="sm" /></td></tr>)}</tbody>
        </table>
      </div>
    </DesktopFrame>
  );
}
