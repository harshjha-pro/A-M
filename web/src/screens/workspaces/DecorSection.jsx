// Theme & decoration on a workspace page (1.0.19): the theme (name, colours) with its own board
// from the Vault, and decor items (Stage, Entry gate, Mandap…) — each opens a page like an
// outfit's: timeline, moodboard, props, notes, tasks and the decorator.
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Pencil, Palette, Image } from 'lucide-react';
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
    <section id="decor" aria-labelledby="ws-decor" className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm border border-black/5">
      <h2 id="ws-decor" className="text-lg font-bold text-gray-900">{title}</h2>
      
      {/* Theme summary */}
      <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-2/60 p-3 border border-black/5">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#F3E8FF] text-[#7E22CE]" aria-hidden="true">
            <Palette size={20} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-xs font-semibold text-text-muted">{t('decor.theme')}</span>
            {ws.themeName || ws.themeColours ? (
              <>
                <span className="truncate font-bold text-gray-900 text-sm">{ws.themeName || '—'}</span>
                {ws.themeColours && <span className="text-xs text-text-muted">{t('decor.colours')}: {ws.themeColours}</span>}
              </>
            ) : (
              <span className="text-sm text-text-muted">{t('decor.noTheme')}</span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={t('decor.editTheme')}
          className="tap size-9 rounded-full grid place-items-center text-[#861C32] hover:bg-[#861C32]/10 transition shrink-0"
        >
          <Pencil aria-hidden="true" size={18} />
        </button>
      </div>

      {/* Theme Board */}
      <div className="flex flex-col gap-2.5 border-t border-gray-100 pt-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#EFF6FF] text-[#1D4ED8]" aria-hidden="true">
            <Image size={20} />
          </span>
          <div className="flex flex-col">
            <h3 className="text-sm font-bold text-gray-900">{t('decor.board')}</h3>
            {(!ws.boards?.decor || ws.boards.decor.length === 0) && (
              <span className="text-xs text-text-muted">Nothing attached yet.</span>
            )}
          </div>
        </div>
        <AttachBlock place={{ workspaceId: ws.id, section: 'decor' }} attachments={ws.boards?.decor ?? []} refresh={refresh} grid />
      </div>

      {/* Decor Items */}
      <div className="flex flex-col gap-2.5 border-t border-gray-100 pt-3">
        <OutfitCards
          ws={ws}
          person="decor"
          heading={t('decor.items')}
          level={3}
          addLabel={t('decor.add')}
          nameLabel={t('decor.nameLabel')}
          none={t('decor.none')}
        />
      </div>

      {editing && <ThemeSheet ws={ws} onClose={() => setEditing(false)} />}
    </section>
  );
}
