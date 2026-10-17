// Pick many from the Vault (1.0.24, admin-operations brief §11): tick the files, then "Use N
// here" sends one request with one Undo. Files already here are not listed.
import { useState } from 'react';
import Sheet from '../../components/Sheet.jsx';
import Button from '../../components/Button.jsx';
import BulkResult from '../../components/BulkResult.jsx';
import { AttachmentThumb } from './AttachmentRow.jsx';
import { useAttachments, bulkLinks } from '../../data/vault.js';
import { showUndo, showToast } from '../../undo/undoStore.js';
import { t } from '../../i18n/strings.en.js';

export default function VaultPickSheet({ place, here = [], onClose, onDone }) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const list = useAttachments({ q: q.trim() || undefined, limit: 50 });
  const on = new Set(here);
  const toggle = (id) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function use() {
    setBusy(true);
    try {
      const res = await bulkLinks('add', [...picked], place);
      if (res.meta.undo) showUndo({ batchId: res.meta.undo.batchId, summary: res.meta.undo.summary, onUndone: onDone });
      onDone?.();
      if (res.data.skipped.length > 0) setResult(res.data);
      else onClose();
    } catch (e) {
      showToast(e.message || t('errors.server'));
    } finally {
      setBusy(false);
    }
  }

  if (result) return <BulkResult result={result} onClose={onClose} />;
  return (
    <Sheet title={t('vault.pickTitle')} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('vault.search')} aria-label={t('vault.search')}
          className="tap w-full rounded-sm border-[1.5px] border-border-strong bg-surface px-3 text-base text-text" />
        {list.isPending && <p aria-busy="true">…</p>}
        <ul className="flex flex-col gap-2">
          {(list.data?.items ?? []).filter((a) => !on.has(a.id)).map((a) => (
            <li key={a.id}>
              <label className={`tap flex w-full cursor-pointer items-center gap-3 rounded-sm border p-2 ${picked.has(a.id) ? 'border-primary bg-primary-soft' : 'border-border'}`}>
                <input type="checkbox" checked={picked.has(a.id)} onChange={() => toggle(a.id)} aria-label={t('bulk.choose', { name: a.title })} className="size-6 shrink-0 accent-[var(--c-primary)]" />
                <AttachmentThumb a={a} size="h-12 w-12" />
                <span className="flex min-w-0 flex-1 flex-col"><span className="font-mono text-sm text-text-muted">{a.code}</span><span className="truncate font-bold">{a.title}</span></span>
              </label>
            </li>
          ))}
        </ul>
        <Button needsInternet onClick={use} loading={busy} disabled={picked.size === 0}>{t('vault.useHere', { n: picked.size })}</Button>
      </div>
    </Sheet>
  );
}
