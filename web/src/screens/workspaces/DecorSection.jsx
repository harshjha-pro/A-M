// Theme & decoration on a workspace page (1.0.19): the theme (name, colours) with its own board
// from the Vault, and decor items (Stage, Entry gate, Mandap…) — each opens a page like an
// outfit's: timeline, moodboard, props, notes, tasks and the decorator.
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import Sheet from '../../components/Sheet.jsx';
import Button from '../../components/Button.jsx';
import { TextField } from '../../components/Field.jsx';
import { api, newIdemKey } from '../../api/client.js';
import { withRelogin } from '../../api/auth.js';
import { ValidationError } from '../../api/errors.js';
import { showToast } from '../../undo/undoStore.js';
import { OutfitCards } from '../outfits/OutfitSection.jsx';
import { AttachBlock } from '../outfits/parts.jsx';
import { t } from '../../i18n/strings.en.js';

function ThemeSheet({ ws, onClose }) {
  const qc = useQueryClient();
  const [name, setName] = useState(ws.themeName ?? '');
  const [colours, setColours] = useState(ws.themeColours ?? '');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await withRelogin(() => api('PATCH', `/workspaces/${ws.id}`, { body: { themeName: name.trim() || null, themeColours: colours.trim() || null }, ifMatch: ws.version, idemKey: newIdemKey() }));
      qc.invalidateQueries({ queryKey: ['workspace'] });
      onClose();
    } catch (e) { if (e instanceof ValidationError) setErrors(e.fields); else showToast(e.message || t('errors.server')); } finally { setBusy(false); }
  }
  return (
    <Sheet title={t('decor.editTheme')} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <TextField label={t('decor.themeName')} value={name} onChange={setName} error={errors.themeName} maxLength={80} placeholder={t('decor.themeNamePlaceholder')} />
        <TextField label={t('decor.colours')} value={colours} onChange={setColours} error={errors.themeColours} maxLength={120} placeholder={t('decor.coloursPlaceholder')} />
        <Button needsInternet onClick={save} loading={busy}>{t('decor.saveTheme')}</Button>
      </div>
    </Sheet>
  );
}

export default function DecorSection({ ws, title }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['workspace'] }); qc.invalidateQueries({ queryKey: ['attachments'] }); };
  return (
    <section id="decor" aria-labelledby="ws-decor" className="flex flex-col gap-4 rounded-md bg-surface p-4 shadow-card">
      <h2 id="ws-decor" className="text-lg font-bold">{title}</h2>
      <div className="flex items-start justify-between gap-2 rounded-sm bg-surface-2 p-3">
        <div className="flex min-w-0 flex-col">
          <span className="text-sm text-text-muted">{t('decor.theme')}</span>
          {ws.themeName || ws.themeColours
            ? <><span className="font-bold">{ws.themeName || '—'}</span>{ws.themeColours && <span>{t('decor.colours')}: {ws.themeColours}</span>}</>
            : <span className="text-text-muted">{t('decor.noTheme')}</span>}
        </div>
        <button type="button" onClick={() => setEditing(true)} aria-label={t('decor.editTheme')} className="tap grid min-h-12 min-w-12 place-items-center text-primary"><Pencil aria-hidden="true" size={20} /></button>
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="font-bold">{t('decor.board')}</h3>
        <AttachBlock place={{ workspaceId: ws.id, section: 'decor' }} attachments={ws.boards?.decor ?? []} refresh={refresh} grid />
      </div>
      <div className="border-t border-border pt-3">
        <OutfitCards ws={ws} person="decor" heading={t('decor.items')} level={3} addLabel={t('decor.add')} nameLabel={t('decor.nameLabel')} none={t('decor.none')} />
      </div>
      {editing && <ThemeSheet ws={ws} onClose={() => setEditing(false)} />}
    </section>
  );
}
