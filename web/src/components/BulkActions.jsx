// The actions row of select mode (1.0.24), shared by lists that bulk-change one field:
// pick an action → a sheet with the value and a preview of what changes → one request with
// `as_of`, one Undo; anything skipped is listed with why. A delete asks first.
// actions: [{ key, label, Icon, danger?, initial?, picker?(value, setValue), body?(value), what?(value), ready?(value), confirm?: { title, body } }]
import { useState } from 'react';
import { FileDown } from 'lucide-react';
import Sheet from './Sheet.jsx';
import Button from './Button.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import BulkResult from './BulkResult.jsx';
import { BulkButton } from './SelectBar.jsx';
import { api, newIdemKey, API_BASE } from '../api/client.js';
import { withRelogin } from '../api/auth.js';
import { showUndo, showToast } from '../undo/undoStore.js';
import { formatCount } from '../format/inr.js';
import { t } from '../i18n/strings.en.js';

export default function BulkActions({ endpoint, exportPath, ids, asOf, actions, noun, max = 500, onDone }) {
  const [open, setOpen] = useState(null);
  const [value, setValue] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const n = ids.length;
  const tooMany = n > max;
  const act = actions.find((a) => a.key === open);

  async function apply() {
    setBusy(true);
    try {
      const res = await withRelogin(() => api('POST', endpoint, { body: { action: act.key, ids, asOf, ...(act.body?.(value) ?? {}) }, idemKey: newIdemKey() }));
      setOpen(null);
      if (res.meta.undo) showUndo({ batchId: res.meta.undo.batchId, summary: res.meta.undo.summary, onUndone: onDone });
      else showToast(t('bulk.nothing'));
      if (res.data.skipped.length > 0) setResult(res.data);
      onDone();
    } catch (e) {
      showToast(e.message || t('errors.server'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div role="toolbar" aria-label={t('bulk.pick')} className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <BulkButton key={a.key} Icon={a.Icon} label={a.label} danger={a.danger} disabled={n === 0 || tooMany}
            onClick={() => { setOpen(a.key); setValue(a.initial ?? null); }} />
        ))}
        {exportPath && n > 0 && !tooMany && (
          <a href={`${API_BASE}${exportPath}?ids=${ids.join(',')}`} download className="tap inline-flex items-center gap-2 rounded-full border-[1.5px] border-border bg-surface px-4 font-bold">
            <FileDown aria-hidden="true" size={18} /> {t('bulk.exportSelected')}
          </a>
        )}
      </div>
      {tooMany && <p role="alert" className="font-bold text-danger">{t('tasks.bulk.tooMany', { max: formatCount(max) })}</p>}
      {act && !act.confirm && (
        <Sheet title={act.label} onClose={() => setOpen(null)}>
          <div className="flex flex-col gap-4">
            {act.picker?.(value, setValue)}
            <p className="rounded-md bg-surface-2 p-3" role="status">{t('bulk.preview', { n: noun(n), what: act.what?.(value) ?? act.label })}</p>
            <Button needsInternet onClick={apply} loading={busy} disabled={act.ready ? !act.ready(value) : false}>{t('bulk.apply', { n: formatCount(n) })}</Button>
          </div>
        </Sheet>
      )}
      {act?.confirm && (
        <ConfirmDialog title={act.confirm.title} body={act.confirm.body} confirmLabel={act.label} danger onConfirm={busy ? () => {} : apply} onCancel={() => setOpen(null)} />
      )}
      <BulkResult result={result} onClose={() => setResult(null)} />
    </>
  );
}

/** Select-mode state for a list: on/off, the chosen ids, toggle, all shown, clear. */
export function useSelection() {
  const [on, setOn] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  return {
    on,
    picked,
    ids: [...picked],
    start: () => { setOn(true); setPicked(new Set()); },
    stop: () => { setOn(false); setPicked(new Set()); },
    toggle: (id) => setPicked((s) => { const x = new Set(s); if (x.has(id)) x.delete(id); else x.add(id); return x; }),
    setAll: (ids) => setPicked(new Set(ids)),
    clear: () => setPicked(new Set()),
  };
}
