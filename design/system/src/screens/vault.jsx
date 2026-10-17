// 10 · Documents & Vault: /vault, /vault/:id, /documents, /documents/:id, /documents/:id/edit
import React from 'react';
import { PhoneFrame, DesktopFrame, TopBar, IconButton, TextField, Chip, ChipRow, Icon, ListRow, StatusBadge, Card, Button, Photo, Banner, Dialog, Hint, ProgressBar, EmptyState, SelectField, TextArea, Switch, StickyActions, BottomSheet, Segmented, UndoBar, Toast, QuickAdd } from '../components.jsx';
import { ATTACHMENTS } from '../data.js';

const KIND_ICON = { Photo: 'Image', Video: 'Video', Document: 'FileText', Link: 'Link', Text: 'StickyNote' };

function Tile({ a }) {
  return (
    <div className="am-card am-card--flush" style={{ cursor: 'pointer' }}>
      {a.photo ? (
        <Photo name={a.photo} ratio="1/1" radius="none">
          <div style={{ padding: 6, display: 'flex', justifyContent: 'space-between' }}>
            <span className="am-glass am-glass--white" style={{ borderRadius: 999, padding: '2px 8px', fontSize: 12, fontWeight: 700, display: 'inline-flex', gap: 4, alignItems: 'center' }}><Icon name={KIND_ICON[a.kind]} size={12} />{a.kind}</span>
            {a.fav && <span className="am-glass am-glass--white" style={{ borderRadius: 999, padding: 4, display: 'inline-flex' }}><Icon name="Heart" size={14} style={{ color: 'var(--primary)', fill: 'var(--primary)' }} label="Favourite" /></span>}
          </div>
        </Photo>
      ) : (
        <div style={{ aspectRatio: '1/1', display: 'grid', placeItems: 'center', background: 'var(--surface-2)' }}><span className="am-col" style={{ alignItems: 'center', gap: 4, color: 'var(--primary)' }}><Icon name={KIND_ICON[a.kind]} size={34} /><b className="am-small" style={{ color: 'var(--text)' }}>{a.kind}</b></span></div>
      )}
      <div style={{ padding: '8px 10px 10px' }}>
        <div className="am-strong" style={{ fontSize: 14, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</div>
        <span className="am-code" style={{ fontSize: 11 }}>{a.code}</span>
        <div className="am-small" style={{ color: a.used.length ? 'var(--text-muted)' : 'var(--warning)', fontWeight: a.used.length ? 400 : 700, marginTop: 2 }}>{a.used.length ? `Used in ${a.used.length}` : 'Not linked yet'}</div>
      </div>
    </div>
  );
}

export function VaultList({ uploading }) {
  return (
    <PhoneFrame nav="More" label={uploading ? 'Attachment Vault · uploading + storage warning' : 'Attachment Vault'} fab={<QuickAdd label="Add attachment" />}>
      <TopBar back title="Attachment Vault" sub="Every attachment, with where it is used." />
      <div className="am-pad am-col" style={{ gap: 12, paddingBottom: 20 }}>
        <TextField placeholder="Search ID, title or note" icon="Search" />
        <ChipRow><Chip selected>All</Chip><Chip icon="Image">Photos</Chip><Chip icon="Video">Videos</Chip><Chip icon="FileText">Documents</Chip><Chip icon="Link">Links</Chip><Chip icon="StickyNote">Text</Chip></ChipRow>
        <ChipRow><Chip icon="Heart">Favourites</Chip><Chip icon="Unlink">Not linked yet</Chip><Chip icon="LayoutGrid">Any workspace</Chip></ChipRow>
        {uploading && (
          <>
            <Banner tone="warning" title="The database is nearly full (2.7 of 3 GB).">Use links for big videos.</Banner>
            <div className="am-card" style={{ gap: 8 }}><div className="am-row-flex" style={{ gap: 10 }}><Icon name="Upload" style={{ color: 'var(--primary)' }} /><b style={{ flex: 1 }}>Mehndi stage video.mp4</b><span className="am-small am-muted">64%</span></div><ProgressBar value={64} /><span className="am-small am-muted">Uploading… keep this screen open.</span></div>
            <Banner tone="error" title="Not uploaded — no internet." action="Try again">Reception entry.jpg</Banner>
          </>
        )}
        <p className="am-small am-muted">Database 1.2 of 3 GB</p>
        <div className="am-grid2">{ATTACHMENTS.slice(0, uploading ? 2 : 6).map((a) => <Tile key={a.code} a={a} />)}</div>
      </div>
    </PhoneFrame>
  );
}

export function AttachmentDetail({ state }) {
  const a = ATTACHMENTS[0];
  return (
    <PhoneFrame label={`Attachment details${state ? ' · ' + state : ''}`} overlay={state === 'delete' ? (
      <Dialog title="Delete everywhere?" icon="Trash2" tone="danger" actions={<><Button block variant="destructive">Delete everywhere</Button><Button block variant="outline">Cancel</Button></>}>
        <p>It is removed from <b>all 2 places</b> it is used. You can Undo.</p>
        <p className="am-small">To take it off just one place, use “Remove from here” instead.</p>
      </Dialog>) : null} toast={state === 'unlinked' ? <UndoBar>Removed from Engagement › Bride outfit</UndoBar> : null}>
      <TopBar back title="Attachment" actions={<><IconButton icon="Heart" label="Favourite" variant="soft" /><IconButton icon="Pencil" label="Edit" /></>} />
      <div className="am-pad am-col" style={{ gap: 14, paddingBottom: 24 }}>
        <Photo name={a.photo} ratio="4/5" radius="xl" />
        <div className="am-col" style={{ gap: 4 }}><h1 style={{ fontSize: 24, fontWeight: 700 }}>{a.title}</h1><div className="am-row-flex" style={{ gap: 8 }}><StatusBadge status="photo" size="sm" /><span className="am-small am-muted">JPEG · 1.4 MB · Mahi · 2 Oct</span></div></div>
        <Card>
          <TextField label="ID" value={state === 'taken' ? 'ATT-3HVN8P' : 'ATT-K7Q2MX'} help={state === 'taken' ? undefined : 'Unique across the app. Letters, numbers, - and _.'} error={state === 'taken' ? 'This ID is already used by “Caterer quotation.pdf”.' : undefined}
            suffix={state === 'taken' ? null : <span className="am-saved am-saved--saved"><Icon name="CircleCheck" size={16} /> Free</span>} />
          <SelectField label="Vendor (contact)" value="Lalit Boutique" />
          <SelectField label="Task" value="Final fitting — bridal lehenga" />
          <TextArea label="Note" value="Blush with gold zari border — show to tailor." />
        </Card>
        <Card title="Where it is used" icon="MapPin" pad={false}>
          <div style={{ paddingTop: 6 }}>
            {['Engagement › Bride outfit › Moodboard', 'Varmala & Phere › Theme board'].map((p) => (
              <ListRow key={p} dense to="workspace" title={p} trail={<Button size="sm" variant="ghost" icon="Unlink">Remove from here</Button>} chevron={false} />
            ))}
          </div>
          <div style={{ padding: 12 }}><Button variant="outline" size="sm" icon="Plus">Use in a workspace</Button></div>
        </Card>
        <Button variant="destructive-outline" icon="Trash2">Delete everywhere</Button>
      </div>
    </PhoneFrame>
  );
}

export function AttachmentAdd() {
  return (
    <PhoneFrame nav="More" label="Add attachment" overlay={
      <BottomSheet title="Add attachment" actions={<Button block>Save attachment</Button>}>
        <Segmented options={['Photo', 'Video', 'Document', 'Link', 'Text']} value="Photo" label="Type" />
        <div className="am-grid2"><Button variant="outline" icon="Camera">Take photo</Button><Button variant="outline" icon="FolderOpen">Choose file</Button></div>
        <TextField label="Title" value="Stage florals idea" />
        <TextField label="ID" value="" placeholder="Leave empty for a random ID" help="Unique across the app. Letters, numbers, - and _." />
        <Switch label="Favourite" />
      </BottomSheet>}>
      <TopBar back title="Attachment Vault" />
    </PhoneFrame>
  );
}

const DOCS = [['Tent booking contract', 'Contract', 'Shree Tent House', '2 Oct', '1.1 MB', false], ['Caterer quotation', 'Quotation', 'Annapurna Caterers', '28 Sep', '412 KB', false], ['Ayush Aadhaar', 'ID', 'Private', '12 Sep', '220 KB', true], ['Receipt – Rekha Mehndi Art – 8 Oct 2026', 'Receipt', 'Mehndi artist advance', '8 Oct', '380 KB', false]];

export function DocumentList({ role = 'owner' }) {
  return (
    <PhoneFrame nav="More" label={role === 'owner' ? 'Documents' : 'Documents · family (private hidden)'} fab={<QuickAdd label="Add document" />}>
      <TopBar back title="Documents" />
      <div className="am-pad am-col" style={{ gap: 12, paddingBottom: 20 }}>
        <TextField placeholder="Search documents" icon="Search" />
        <ChipRow><Chip selected>All</Chip><Chip>Receipt</Chip><Chip>Contract</Chip><Chip>Quotation</Chip><Chip>Booking</Chip><Chip>ID</Chip><Chip>Photo</Chip></ChipRow>
        <div className="am-list">
          {DOCS.filter((d) => role === 'owner' || !d[5]).map(([t, ty, link, date, size, priv]) => (
            <ListRow key={t} to="document" lead={<span className="am-stat__icon" style={{ margin: 0 }}><Icon name={ty === 'Receipt' ? 'Receipt' : ty === 'ID' ? 'IdCard' : 'FileText'} /></span>}
              title={t} sub={<><span>{ty}</span><span>{link}</span><span>{date} · {size}</span></>} trail={priv ? <StatusBadge status="private" size="sm" /> : null} />
          ))}
        </div>
      </div>
    </PhoneFrame>
  );
}

export function DocumentDetail({ state }) {
  return (
    <PhoneFrame label={`Document details${state ? ' · ' + state : ''}`} toast={state === 'saved' ? <Toast tone="success">Document saved</Toast> : null}>
      <TopBar back title="Document" actions={<IconButton icon="Pencil" label="Edit details" to="documentEdit" />} />
      <div className="am-pad am-col" style={{ gap: 14, paddingBottom: 24 }}>
        <div className="am-card am-card--cream" style={{ alignItems: 'center', padding: 28, gap: 8 }}>
          <span className="am-empty__icon"><Icon name="FileText" size={34} /></span>
          <b>Tent booking contract.pdf</b><span className="am-small am-muted">PDF · 1.1 MB · 4 pages</span>
        </div>
        <div className="am-grid3"><Button variant="primary" icon="ExternalLink" size="sm">Open file</Button><Button variant="outline" icon="Download" size="sm">Download</Button><Button variant="outline" icon="Share2" size="sm">Share</Button></div>
        <Card><dl className="am-kv" style={{ margin: 0 }}><dt>Type</dt><dd>Contract</dd><dt>Vendor</dt><dd>Shree Tent House</dd><dt>Payment</dt><dd>Tent advance</dd><dt>Event</dt><dd>Varmala &amp; Phere</dd><dt>Added</dt><dd>Ayush · 2 Oct</dd><dt>Who sees it</dt><dd>Everyone logged in</dd></dl></Card>
        <Card title="Where used" icon="MapPin"><ListRow dense to="vault" title="Attachment Vault" sub="ATT-6QHC3W" /><ListRow dense to="payment" title="Money › Tent advance" /></Card>
        <Button variant="ghost" icon="History" to="history">History</Button>
      </div>
    </PhoneFrame>
  );
}

export function DocumentForm({ state }) {
  return (
    <PhoneFrame label={`Add / edit document${state ? ' · ' + state : ''}`}>
      <TopBar back title="Add document" />
      <div className="am-pad am-col" style={{ gap: 16, paddingBottom: 150 }}>
        <div className="am-grid2"><Button variant="outline" icon="Camera">Take photo</Button><Button variant="outline" icon="FolderOpen">Choose file</Button></div>
        {state === 'uploading' && <div className="am-card" style={{ gap: 8 }}><b>Uploading receipt.jpg</b><ProgressBar value={42} /><span className="am-small am-muted">Making the photo smaller…</span></div>}
        {state === 'failed' && <Banner tone="error" title="Not uploaded — no internet." action="Try again">Pick the file again when online.</Banner>}
        {state === 'toobig' && <Banner tone="error" title="This file is too big (14 MB). Max 10 MB." />}
        <TextField label="Title" help='Leave empty and we name it, like "Receipt – Shree Tent House – 12 Oct 2026".' />
        <SelectField label="Type" value="Receipt" />
        <Switch label="Only Ayush and Mahi" sub="For IDs and other private papers. Nobody else sees it." />
        <SelectField label="Vendor" optional value="Shree Tent House" /><SelectField label="Payment" optional /><TextArea label="Notes" />
      </div>
      <StickyActions><Button variant="outline">Cancel</Button><Button busy={state === 'uploading'}>{state === 'uploading' ? 'Uploading…' : 'Upload'}</Button></StickyActions>
    </PhoneFrame>
  );
}

export function VaultDesktop() {
  return (
    <DesktopFrame active="Attachment Vault" title="Attachment Vault" actions={<Button icon="Plus">Add attachment</Button>} label="Vault · desktop grid + detail panel"
      aside={<><Photo name="lehenga" ratio="4/3" radius="lg" /><h2 style={{ fontSize: 22, fontWeight: 700 }}>Lehenga reference — blush</h2><TextField label="ID" value="ATT-K7Q2MX" /><Card title="Where it is used" icon="MapPin"><ListRow dense title="Engagement › Bride outfit" trail={<Button size="sm" variant="ghost" icon="Unlink">Remove</Button>} chevron={false} /></Card><Button variant="destructive-outline" icon="Trash2">Delete everywhere</Button></>}>
      <div style={{ display: 'flex', gap: 12 }}><div style={{ flex: 1 }}><TextField placeholder="Search ID, title or note" icon="Search" /></div></div>
      <ChipRow><Chip selected>All</Chip><Chip icon="Image">Photos</Chip><Chip icon="Video">Videos</Chip><Chip icon="FileText">Documents</Chip><Chip icon="Link">Links</Chip><Chip icon="StickyNote">Text</Chip><Chip icon="Heart">Favourites</Chip></ChipRow>
      <div className="am-grid4">{ATTACHMENTS.map((a) => <Tile key={a.code} a={a} />)}</div>
    </DesktopFrame>
  );
}
