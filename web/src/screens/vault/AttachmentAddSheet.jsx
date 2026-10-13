// Add an attachment (1.0.17): photo, video, document (any size, sent in pieces), link or text.
// Optional editable ID (checked while typing; empty = next ATT number), note, favourite,
// vendor. Called from the Vault (no place) or a workspace section (used there at once).
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileUp, Camera } from 'lucide-react';
import Sheet from '../../components/Sheet.jsx';
import Button from '../../components/Button.jsx';
import { TextField, ChoiceChips, Toggle, Notice } from '../../components/Field.jsx';
import { api } from '../../api/client.js';
import { ValidationError } from '../../api/errors.js';
import { showToast } from '../../undo/undoStore.js';
import { sendFile, createAttachment, CODE_RE, kindOf } from '../../data/vault.js';
import { t } from '../../i18n/strings.en.js';

export function CodeField({ value, onChange, except, error }) {
  const [check, setCheck] = useState(null);
  useEffect(() => {
    const code = value.trim();
    if (!code) { setCheck(null); return undefined; }
    if (!CODE_RE.test(code)) { setCheck({ available: false, message: t('vault.codeHelp') }); return undefined; }
    const id = setTimeout(() => {
      api('GET', '/attachments/check-code', { query: { code, except } }).then((r) => setCheck(r.data)).catch(() => setCheck(null));
    }, 350);
    return () => clearTimeout(id);
  }, [value, except]);
  return (
    <TextField label={t('vault.code')} value={value} onChange={onChange} autoCapitalize="characters" spellCheck={false}
      help={check?.available ? t('vault.codeFree') : t('vault.codeHelp')} error={error || (check && !check.available ? check.message : null)} />
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
  const [file, setFile] = useState(null);
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

  function pick(list) {
    const f = list?.[0];
    if (!f) return;
    setFile(f);
    setKind(kindOf(f));
    if (!title) setTitle((f.name || '').replace(/\.[^.]+$/, '').slice(0, 160));
  }

  async function save() {
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
        workspaceId, section: workspaceId ? section : undefined,
        ...(target ?? {}), // 1.0.18: an outfit's moodboard, an accessory or a timeline step
      });
      qc.invalidateQueries({ queryKey: ['attachments'] });
      qc.invalidateQueries({ queryKey: ['workspace'] });
      qc.invalidateQueries({ queryKey: ['workspaces'] });
      qc.invalidateQueries({ queryKey: ['outfit'] });
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

  const label = busy === 'preparing' ? t('vault.preparing') : typeof busy === 'number' ? t('vault.uploading', { pct: Math.round(busy * 100) }) : '…';
  return (
    <Sheet title={t('vault.add')} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <ChoiceChips label={t('vault.type')} value={kind} onChange={(v) => { setKind(v); setErrors({}); }}
          options={['photo', 'video', 'document', 'link', 'text'].map((k) => ({ value: k, label: t(`vault.kinds.${k}`) }))} />
        {['photo', 'video', 'document'].includes(kind) && (
          <div className="flex flex-col gap-2">
            <input ref={chooser} type="file" hidden data-testid="vault-file" onChange={(e) => pick(e.target.files)}
              accept={kind === 'photo' ? 'image/*' : kind === 'video' ? 'video/*' : undefined} />
            <input ref={camera} type="file" hidden accept="image/*" capture="environment" onChange={(e) => pick(e.target.files)} />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => chooser.current?.click()}><FileUp aria-hidden="true" size={20} />{t('vault.chooseFile')}</Button>
              {kind === 'photo' && <Button variant="secondary" onClick={() => camera.current?.click()}><Camera aria-hidden="true" size={20} />{t('vault.takePhoto')}</Button>}
            </div>
            {file && <p className="text-sm">{file.name}</p>}
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
        <TextField label={t('vault.titleLabel')} value={title} onChange={setTitle} error={errors.title} maxLength={160} />
        <CodeField value={code} onChange={setCode} error={errors.code} />
        <TextField label={t('vault.note')} value={note} onChange={setNote} />
        <VendorSelect value={vendor} onChange={setVendor} />
        <Toggle label={t('vault.favourite')} checked={fav} onChange={setFav} />
        <Button needsInternet onClick={save} loading={busy !== null} loadingLabel={label}>{t('vault.save')}</Button>
      </div>
    </Sheet>
  );
}
