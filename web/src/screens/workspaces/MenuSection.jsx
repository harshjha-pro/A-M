// Menu on a workspace page (1.0.19): the caterer, categories (Welcome drinks, Starters, …) with
// their dishes — each Normal or Jain, ⭐ must-have, a note, attachments and tasks — menu files
// from the Vault, and Copy menu from another workspace (one Undo).
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Copy, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import Sheet from '../../components/Sheet.jsx';
import Button from '../../components/Button.jsx';
import { TextField, ChoiceChips, Toggle } from '../../components/Field.jsx';
import { api, newIdemKey } from '../../api/client.js';
import { withRelogin } from '../../api/auth.js';
import { ValidationError } from '../../api/errors.js';
import { showUndo, showToast } from '../../undo/undoStore.js';
import { useWorkspaces } from '../../data/vault.js';
import { NameSheet } from '../outfits/OutfitDetail.jsx';
import { AttachBlock, TasksBlock } from '../outfits/parts.jsx';
import { VendorSelect } from '../vault/AttachmentAddSheet.jsx';
import { t } from '../../i18n/strings.en.js';

function DishSheet({ ws, dish = null, categoryId, onClose, refresh }) {
  const [name, setName] = useState(dish?.name ?? '');
  const [diet, setDiet] = useState(dish?.diet ?? 'normal');
  const [must, setMust] = useState(dish?.isMustHave ?? false);
  const [note, setNote] = useState(dish?.note ?? '');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!name.trim()) { setErrors({ name: t('errors.required') }); return; }
    setBusy(true);
    try {
      const body = { name: name.trim(), diet, isMustHave: must, note: note.trim() || null };
      if (dish) await withRelogin(() => api('PATCH', `/menu-items/${dish.id}`, { body, ifMatch: dish.version, idemKey: newIdemKey() }));
      else await withRelogin(() => api('POST', `/menu-categories/${categoryId}/items`, { body, idemKey: newIdemKey() }));
      refresh(); onClose();
    } catch (e) { if (e instanceof ValidationError) setErrors(e.fields); else showToast(e.message || t('errors.server')); } finally { setBusy(false); }
  }
  async function remove() {
    try {
      const res = await withRelogin(() => api('DELETE', `/menu-items/${dish.id}`, { ifMatch: dish.version, idemKey: newIdemKey() }));
      if (res.meta.undo) showUndo({ batchId: res.meta.undo.batchId, summary: res.meta.undo.summary, onUndone: refresh });
      refresh(); onClose();
    } catch (e) { showToast(e.message || t('errors.server')); }
  }
  return (
    <Sheet title={dish ? dish.name : t('menu.addDish')} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <TextField label={t('menu.dishName')} value={name} onChange={setName} error={errors.name} maxLength={120} placeholder={t('menu.dishPlaceholder')} />
        <ChoiceChips label={t('menu.diet')} value={diet} onChange={setDiet} error={errors.diet}
          options={[{ value: 'normal', label: t('menu.diets.normal') }, { value: 'jain', label: t('menu.diets.jain') }]} />
        <Toggle label={`⭐ ${t('menu.mustHave')}`} checked={must} onChange={setMust} />
        <TextField label={t('menu.note')} value={note} onChange={setNote} error={errors.note} maxLength={500} placeholder={t('menu.notePlaceholder')} />
        <Button needsInternet onClick={save} loading={busy}>{t('menu.saveDish')}</Button>
        {dish && (
          <>
            <section className="flex flex-col gap-2"><h3 className="font-bold">{t('outfit.attachments')}</h3><AttachBlock target={{ menuItemId: dish.id }} attachments={dish.attachments} refresh={refresh} grid /></section>
            <section className="flex flex-col gap-2"><h3 className="font-bold">{t('outfit.tasks')}</h3><TasksBlock tasks={dish.tasks} query={`menuItem=${dish.id}`} back={`/workspaces/${ws.id}#menu`} /></section>
            <Button variant="danger" needsInternet onClick={remove}><Trash2 aria-hidden="true" size={18} />{t('menu.deleteDish')}</Button>
          </>
        )}
      </div>
    </Sheet>
  );
}

function CopySheet({ ws, onClose, refresh }) {
  const all = useWorkspaces();
  const others = (all.data ?? []).filter((w) => w.id !== ws.id);
  const [from, setFrom] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!from) { setError(t('errors.required')); return; }
    setBusy(true);
    try {
      const res = await withRelogin(() => api('POST', `/workspaces/${ws.id}/menu/copy`, { body: { fromWorkspaceId: from }, idemKey: newIdemKey() }));
      if (res.meta.undo) showUndo({ batchId: res.meta.undo.batchId, summary: `${res.meta.undo.summary} · ${t('menu.copied', { n: res.data.copied })}`, onUndone: refresh });
      else showToast(t('menu.copiedNone'));
      refresh(); onClose();
    } catch (e) { if (e instanceof ValidationError) setError(e.fields.fromWorkspaceId ?? e.message); else showToast(e.message || t('errors.server')); } finally { setBusy(false); }
  }
  return (
    <Sheet title={t('menu.copyTitle')} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-bold">{t('menu.copyFrom')}</span>
          <select value={from} onChange={(e) => setFrom(e.target.value)} className="tap rounded-sm border-[1.5px] border-border-strong bg-surface px-3 text-base text-text">
            <option value="">—</option>
            {others.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          {error && <span className="text-sm text-danger">{error}</span>}
        </label>
        <p className="text-sm text-text-muted">{t('menu.copyHelp')}</p>
        <Button needsInternet onClick={go} loading={busy}><Copy aria-hidden="true" size={18} />{t('menu.copyGo')}</Button>
      </div>
    </Sheet>
  );
}

function CategorySheet({ cat, onClose, refresh }) {
  const [renaming, setRenaming] = useState(false);
  async function remove() {
    try {
      const res = await withRelogin(() => api('DELETE', `/menu-categories/${cat.id}`, { ifMatch: cat.version, idemKey: newIdemKey() }));
      if (res.meta.undo) showUndo({ batchId: res.meta.undo.batchId, summary: res.meta.undo.summary, onUndone: refresh });
      refresh(); onClose();
    } catch (e) { showToast(e.message || t('errors.server')); }
  }
  return (
    <Sheet title={cat.name} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <Button variant="secondary" needsInternet onClick={() => setRenaming(true)}><Pencil aria-hidden="true" size={18} />{t('menu.renameCategory')}</Button>
        <p className="text-sm text-text-muted">{t('menu.deleteCategoryBody')}</p>
        <Button variant="danger" needsInternet onClick={remove}><Trash2 aria-hidden="true" size={18} />{t('menu.deleteCategory')}</Button>
      </div>
      {renaming && <NameSheet title={t('menu.renameCategory')} label={t('menu.categoryName')} initial={cat.name} max={80} onClose={() => { setRenaming(false); onClose(); }}
        onSave={(name) => withRelogin(() => api('PATCH', `/menu-categories/${cat.id}`, { body: { name }, ifMatch: cat.version, idemKey: newIdemKey() })).then(refresh)} />}
    </Sheet>
  );
}

export default function MenuSection({ ws, title }) {
  const qc = useQueryClient();
  const menu = ws.menu ?? { categories: [], counts: { items: 0, jain: 0 }, caterer: null };
  const [sheet, setSheet] = useState(null); // {kind, …}
  const refresh = () => { qc.invalidateQueries({ queryKey: ['workspace'] }); qc.invalidateQueries({ queryKey: ['attachments'] }); qc.invalidateQueries({ queryKey: ['tasks'] }); };
  const findDish = (id) => menu.categories.flatMap((c) => c.items).find((i) => i.id === id);
  const dish = sheet?.kind === 'dish' && sheet.id ? findDish(sheet.id) : null;
  const cat = sheet?.kind === 'cat' ? menu.categories.find((c) => c.id === sheet.id) : null;

  async function setCaterer(vendorId) {
    try {
      await withRelogin(() => api('PATCH', `/workspaces/${ws.id}`, { body: { catererId: vendorId || null }, ifMatch: ws.version, idemKey: newIdemKey() }));
      refresh();
    } catch (e) { showToast(e.message || t('errors.server')); }
  }

  return (
    <section id="menu" aria-labelledby="ws-menu" className="flex flex-col gap-4 rounded-md bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h2 id="ws-menu" className="text-lg font-bold">{title}</h2>
        <Button variant="text" onClick={() => setSheet({ kind: 'copy' })}><Copy aria-hidden="true" size={18} />{t('menu.copy')}</Button>
      </div>
      <VendorSelect label={t('menu.caterer')} none={t('menu.noCaterer')} value={menu.caterer?.id ?? ''} onChange={setCaterer} />
      {menu.counts.items > 0 && <p className="text-sm text-text-muted">{t('menu.summary', { items: menu.counts.items, jain: menu.counts.jain })}</p>}
      {menu.categories.length === 0 && <p className="text-text-muted">{t('menu.empty')}</p>}
      {menu.categories.map((c) => (
        <div key={c.id} className="flex flex-col gap-2 border-t border-border pt-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold">{c.name}</h3>
            <button type="button" onClick={() => setSheet({ kind: 'cat', id: c.id })} aria-label={t('menu.moreOptions', { name: c.name })} className="tap grid min-h-12 min-w-12 place-items-center text-primary"><Pencil aria-hidden="true" size={18} /></button>
          </div>
          {c.items.length === 0 && <p className="text-sm text-text-muted">{t('menu.noDishes')}</p>}
          <ul className="flex flex-col" aria-label={c.name}>
            {c.items.map((i) => (
              <li key={i.id}>
                <button type="button" onClick={() => setSheet({ kind: 'dish', id: i.id })} className="flex min-h-12 w-full items-center gap-2 rounded-sm px-1 text-left">
                  {i.isMustHave && <Star aria-label={t('menu.mustHave')} size={16} className="shrink-0 fill-current text-warning" />}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{i.name}</span>
                    {i.note && <span className="truncate text-sm text-text-muted">{i.note}</span>}
                  </span>
                  {i.diet === 'jain' && <span className="rounded-full bg-success-soft px-2 text-sm font-bold text-success">{t('menu.diets.jain')}</span>}
                  <span className="text-sm text-text-muted">{i.attachments.length ? `📎 ${i.attachments.length} ` : ''}{i.tasks.length ? `✓ ${i.tasks.length}` : ''}</span>
                  <ChevronRight aria-hidden="true" size={18} className="text-text-muted" />
                </button>
              </li>
            ))}
          </ul>
          <Button variant="secondary" needsInternet onClick={() => setSheet({ kind: 'dish', categoryId: c.id })} aria-label={`${t('menu.addDish')}: ${c.name}`}><Plus aria-hidden="true" size={20} />{t('menu.addDish')}</Button>
        </div>
      ))}
      <Button variant="secondary" needsInternet onClick={() => setSheet({ kind: 'addCat' })}><Plus aria-hidden="true" size={20} />{t('menu.addCategory')}</Button>
      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <h3 className="font-bold">{t('menu.board')}</h3>
        <AttachBlock place={{ workspaceId: ws.id, section: 'menu' }} attachments={ws.boards?.menu ?? []} refresh={refresh} />
      </div>

      {sheet?.kind === 'dish' && (dish || sheet.categoryId) && <DishSheet ws={ws} dish={dish} categoryId={sheet.categoryId} refresh={refresh} onClose={() => setSheet(null)} />}
      {cat && <CategorySheet cat={cat} refresh={refresh} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'copy' && <CopySheet ws={ws} refresh={refresh} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'addCat' && <NameSheet title={t('menu.addCategory')} label={t('menu.categoryName')} max={80} onClose={() => setSheet(null)}
        onSave={(name) => withRelogin(() => api('POST', `/workspaces/${ws.id}/menu-categories`, { body: { name }, idemKey: newIdemKey() })).then(refresh)} />}
    </section>
  );
}
