// Add an attachment (1.0.17): photo, video, document (any size, sent in pieces), link or text.
// Optional editable ID (checked while typing; empty = next ATT number), note, favourite,
// vendor. Called from the Vault (no place) or a workspace section (used there at once).
// 1.0.24: pick many photos or files at once → a queue with a thumbnail, progress and Retry per
// file; each gets its own next ID and keeps its own request key, so a retry never makes two.
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileUp, Camera, X, RotateCcw, CircleCheck } from 'lucide-react';
import Sheet from '../../components/Sheet.jsx';
import Button from '../../components/Button.jsx';
import { TextField, ChoiceChips, Toggle, Notice } from '../../components/Field.jsx';
import { api, newIdemKey } from '../../api/client.js';
import { ValidationError } from '../../api/errors.js';
import { showToast } from '../../undo/undoStore.js';
import { sendFile, createAttachment, CODE_RE, kindOf } from '../../data/vault.js';
import { t } from '../../i18n/strings.en.js';

/** The editable unique ID, checked while typing. endpoint: attachments (default) or tasks (1.0.22). */
export function CodeField({ value, onChange, except, error, endpoint = '/attachments/check-code', help = t('vault.codeHelp'), label = t('vault.code'), placeholder }) {
  const [check, setCheck] = useState(null);
  useEffect(() => {
    const code = value.trim();
    if (!code) { setCheck(null); return undefined; }
    if (!CODE_RE.test(code)) { setCheck({ available: false, message: help }); return undefined; }
    const id = setTimeout(() => {
      api('GET', endpoint, { query: { code, except } }).then((r) => setCheck(r.data)).catch(() => setCheck(null));
    }, 350);
    return () => clearTimeout(id);
  }, [value, except, endpoint, help]);
  return (
    <TextField label={label} value={value} onChange={onChange} autoCapitalize="characters" spellCheck={false} placeholder={placeholder}
      help={check?.available ? t('vault.codeFree') : help} error={error || (check && !check.available ? check.message : null)} />
  );
}

export function VendorSelect({ value, onChange, label = t('vault.vendor'), none = t('vault.noVendor') }) {
  const vendors = useQuery({ queryKey: ['vendors'], queryFn: () => api('GET', '/vendors').then((r) => r.data), staleTime: 60_000 });
  return (
    <label className="flex flex-col gap-1">
      <span className="font-bold">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="tap rounded-sm border-[1.5px] border-border-strong bg-surface px-3 text-base text-text">
        <option value="">{none}</option>
        {(vendors.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
      </select>
    </label>
  );
}

export default function AttachmentAddSheet({ workspaceId, section = 'general', target = null, onClose, onAdded }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState('photo');
  const [files, setFiles] = useState([]); // [{ key, file, preview, state: waiting|sending|done|failed, pct, error, idem }]
  const file = files[0]?.file ?? null;
  const many = files.length > 1;
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [body, setBody] = useState('');
  const [note, setNote] = useState('');
  const [code, setCode] = useState('');
  const [fav, setFav] = useState(false);
  const [vendor, setVendor] = useState('');
  const [busy, setBusy] = useState(null); // null | 'preparing' | number (0..1)
  const [errors, setErrors] = useState({});
  const chooser = useRef(null);
  const camera = useRef(null);
  const needsFile = ['photo', 'video', 'document'].includes(kind) && !(kind === 'video' && url.trim());

  const titleOf = (f) => (f.name || '').replace(/\.[^.]+$/, '').slice(0, 160) || t('vault.kinds.document');
  function pick(list, add = false) {
    const picked = Array.from(list ?? []);
    if (!picked.length) return;
    const items = picked.map((f) => ({ key: newIdemKey(), file: f, state: 'waiting', pct: 0, error: null, idem: newIdemKey(),
      preview: /^image\//.test(f.type) && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(f) : null }));
    const next = add ? [...files, ...items] : items;
    setFiles(next);
    setKind(kindOf(next[0].file));
    if (!title && next.length === 1) setTitle(titleOf(next[0].file));
  }
  const patch = (key, p) => setFiles((list) => list.map((x) => (x.key === key ? { ...x, ...p } : x)));
  const drop = (key) => setFiles((list) => list.filter((x) => x.key !== key));
  useEffect(() => () => files.forEach((x) => x.preview && URL.revokeObjectURL?.(x.preview)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const placeBody = () => ({ workspaceId, section: workspaceId ? section : undefined, ...(target ?? {}) });
  const refreshAll = () => ['attachments', 'workspace', 'workspaces', 'outfit'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  // Many files: one after another; a failed one stays in the list with Retry, the rest carry on.
  async function saveMany() {
    setBusy('preparing');
    let failed = 0;
    for (const item of files) {
      if (item.state === 'done') continue;
      patch(item.key, { state: 'sending', pct: 0, error: null });
      try {
        const sent = await sendFile(item.file, { onProgress: (p) => patch(item.key, { pct: p }) });
        await createAttachment({ kind: sent.kind, uploadId: sent.uploadId, title: titleOf(item.file), note: note.trim() || null,
          isFavourite: fav || undefined, vendorId: vendor || undefined, ...placeBody() }, item.idem);
        patch(item.key, { state: 'done', pct: 1 });
      } catch (e) {
        failed += 1;
        patch(item.key, { state: 'failed', error: e.message || t('errors.server') });
      }
    }
    setBusy(null);
    refreshAll();
    if (failed === 0) {
      showToast(t('vault.savedN', { n: files.length }));
      onAdded?.();
      onClose();
    } else {
      showToast(t('vault.someFailed', { n: failed }));
    }
  }

  async function save() {
    if (many) { await saveMany(); return; }
    const errs = {};
    if (!title.trim()) errs.title = t('errors.required');
    if (needsFile && !file) errs.file = t('vault.chooseFile');
    if (kind === 'link' && !url.trim()) errs.url = t('errors.required');
    if (kind === 'text' && !body.trim()) errs.body = t('errors.required');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      let uploadId;
      if (needsFile) {
        setBusy('preparing');
        uploadId = (await sendFile(file, { onProgress: (p) => setBusy(p) })).uploadId;
      }
      setBusy(1);
      const a = await createAttachment({
        kind, uploadId, title: title.trim(), note: note.trim() || null,
        url: ['link', 'video'].includes(kind) && url.trim() ? url.trim() : undefined,
        body: kind === 'text' ? body : undefined,
        code: code.trim() || undefined, isFavourite: fav || undefined, vendorId: vendor || undefined,
        ...placeBody(), // 1.0.18: an outfit's moodboard, an accessory or a timeline step
      }, files[0]?.idem);
      refreshAll();
      showToast(t('vault.saved'));
      onAdded?.(a);
      onClose();
    } catch (e) {
      if (e instanceof ValidationError) setErrors(e.fields);
      else showToast(e.message || t('errors.server'));
    } finally {
      setBusy(null);
    }
  }

  const label = many && busy !== null ? t('vault.qSending') : busy === 'preparing' ? t('vault.preparing') : typeof busy === 'number' ? t('vault.uploading', { pct: Math.round(busy * 100) }) : '…';
  return (
    <Sheet title={t('vault.add')} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <ChoiceChips label={t('vault.type')} value={kind} onChange={(v) => { setKind(v); setErrors({}); }}
          options={['photo', 'video', 'document', 'link', 'text'].map((k) => ({ value: k, label: t(`vault.kinds.${k}`) }))} />
        {['photo', 'video', 'document'].includes(kind) && (
          <div className="flex flex-col gap-2">
            <input ref={chooser} type="file" hidden multiple data-testid="vault-file" onChange={(e) => { pick(e.target.files, files.length > 0 && e.target.dataset.add === '1'); e.target.value = ''; delete e.target.dataset.add; }}
              accept={kind === 'photo' ? 'image/*' : kind === 'video' ? 'video/*' : undefined} />
            <input ref={camera} type="file" hidden accept="image/*" capture="environment" onChange={(e) => { pick(e.target.files, files.length > 0); e.target.value = ''; }} />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => chooser.current?.click()}><FileUp aria-hidden="true" size={20} />{t(kind === 'photo' ? 'vault.choosePhotos' : 'vault.chooseFiles')}</Button>
              {kind === 'photo' && <Button variant="secondary" onClick={() => camera.current?.click()}><Camera aria-hidden="true" size={20} />{t('vault.takePhoto')}</Button>}
              {files.length > 0 && busy === null && <Button variant="text" onClick={() => { if (chooser.current) { chooser.current.dataset.add = '1'; chooser.current.click(); } }}>{t('vault.addMore')}</Button>}
            </div>
            {files.length === 1 && <p className="text-sm">{file.name}</p>}
            {many && (
              <ul aria-label={t('vault.queue', { n: files.length })} className="flex flex-col divide-y divide-border rounded-md border border-border">
                {files.map((x) => (
                  <li key={x.key} className="flex items-center gap-3 p-2">
                    {x.preview ? <img src={x.preview} alt="" className="size-12 shrink-0 rounded-sm object-cover" /> : <span className="grid size-12 shrink-0 place-items-center rounded-sm bg-surface-2"><FileUp aria-hidden="true" size={20} /></span>}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-bold">{x.file.name}</span>
                      <span className={`text-sm ${x.state === 'failed' ? 'text-danger' : 'text-text-muted'}`} role={x.state === 'failed' ? 'alert' : undefined}>
                        {x.state === 'waiting' ? t('vault.qWaiting') : x.state === 'sending' ? t('vault.uploading', { pct: Math.round(x.pct * 100) }) : x.state === 'done' ? t('vault.qDone') : x.error}
                      </span>
                    </span>
                    {x.state === 'done' && <CircleCheck aria-label={t('vault.qDone')} size={22} className="text-success" />}
                    {x.state === 'failed' && busy === null && <button type="button" onClick={save} aria-label={t('vault.retryFile', { name: x.file.name })} className="tap grid place-items-center text-primary"><RotateCcw aria-hidden="true" size={20} /></button>}
                    {['waiting', 'failed'].includes(x.state) && busy === null && <button type="button" onClick={() => drop(x.key)} aria-label={t('vault.removeFile', { name: x.file.name })} className="tap grid place-items-center text-text-muted"><X aria-hidden="true" size={20} /></button>}
                  </li>
                ))}
              </ul>
            )}
            {errors.file && <Notice kind="danger">{errors.file}</Notice>}
          </div>
        )}
        {(kind === 'link' || kind === 'video') && <TextField label={t('vault.url')} type="url" value={url} onChange={setUrl} error={errors.url} inputMode="url" />}
        {kind === 'text' && (
          <label className="flex flex-col gap-1">
            <span className="font-bold">{t('vault.body')}</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className="rounded-sm border-[1.5px] border-border-strong bg-surface p-3 text-base text-text" />
            {errors.body && <span className="text-sm text-danger">{errors.body}</span>}
          </label>
        )}
        {many ? <p className="text-sm text-text-muted">{t('vault.manyHelp')}</p> : (
          <>
            <TextField label={t('vault.titleLabel')} value={title} onChange={setTitle} error={errors.title} maxLength={160} />
            <CodeField value={code} onChange={setCode} error={errors.code} />
          </>
        )}
        <TextField label={t('vault.note')} value={note} onChange={setNote} />
        <VendorSelect value={vendor} onChange={setVendor} />
        <Toggle label={t('vault.favourite')} checked={fav} onChange={setFav} />
        <Button needsInternet onClick={save} loading={busy !== null} loadingLabel={label}>{many ? t('vault.saveN', { n: files.filter((x) => x.state !== 'done').length }) : t('vault.save')}</Button>
      </div>
    </Sheet>
  );
}
