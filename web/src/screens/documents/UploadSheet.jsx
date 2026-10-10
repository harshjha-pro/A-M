// Add documents (FEATURES B7): Take photo or Choose file (several at once → one document
// each, same links). Photos are compressed on the phone; each file shows a progress
// bar; a failure says "Not uploaded — [Try again]" and keeps the file in memory.
// Same file already stored → "This file is already saved as 'X'." [Open it] [Save again].
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, CircleCheck, FileUp, RotateCw } from 'lucide-react';
import Sheet from '../../components/Sheet.jsx';
import Button from '../../components/Button.jsx';
import { TextField, ChoiceChips, Toggle, Notice } from '../../components/Field.jsx';
import { useSession } from '../../api/session.js';
import { DuplicateError, OfflineError, TimeoutError } from '../../api/errors.js';
import { DOC_TYPES, ACCEPT, prepareFile, uploadDocument } from '../../data/documents.js';
import { showToast } from '../../undo/undoStore.js';
import { t } from '../../i18n/strings.en.js';

export function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine !== false);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

/** Why an upload failed, in the words FEATURES B7 uses. */
export function failText(e) {
  if (e instanceof OfflineError || e instanceof TimeoutError) return t('documents.notUploadedOffline');
  return e?.message || t('errors.server');
}

let seq = 0;

/**
 * @param {{ link?: { paymentId?: string, vendorId?: string, eventId?: string }, linkLabel?: string,
 *           defaultType?: string, onClose: () => void, onUploaded?: (doc: object) => void }} props
 */
export default function UploadSheet({ link = {}, linkLabel, defaultType = 'other', onClose, onUploaded }) {
  const { permissions } = useSession();
  const online = useOnline();
  const [type, setType] = useState(defaultType);
  const [title, setTitle] = useState('');
  const [isPrivate, setIsPrivate] = useState(defaultType === 'id');
  const [items, setItems] = useState([]); // { key, name, state, progress, error, prepared, doc, dup }
  const [busy, setBusy] = useState(false);
  const files = useRef(new Map()); // key → File, kept while the sheet is open
  const camera = useRef(null);
  const chooser = useRef(null);

  const patch = (key, p) => setItems((cur) => cur.map((it) => (it.key === key ? { ...it, ...p } : it)));

  function pick(list) {
    const picked = Array.from(list || []);
    if (!picked.length) return;
    const added = picked.map((f) => {
      const key = `f${++seq}`;
      files.current.set(key, f);
      return { key, name: f.name || t('documents.photo'), state: 'ready', progress: 0, error: null, prepared: null, doc: null, dup: null };
    });
    setItems((cur) => [...cur.filter((it) => it.state !== 'ready'), ...added]);
  }

  function chooseType(v) {
    setType(v);
    if (permissions?.admin) setIsPrivate(v === 'id');
  }

  async function send(item, allowDuplicate = false) {
    let prepared = item.prepared;
    try {
      if (!prepared) {
        patch(item.key, { state: 'preparing', error: null, dup: null });
        prepared = await prepareFile(files.current.get(item.key));
        patch(item.key, { prepared });
      }
      patch(item.key, { state: 'uploading', progress: 0, error: null, dup: null });
      const details = { type, title: items.length === 1 ? title : '', paymentId: link.paymentId, vendorId: link.vendorId, eventId: link.eventId, allowDuplicate };
      if (permissions?.admin) details.isPrivate = isPrivate;
      const res = await uploadDocument(prepared, details, (f) => patch(item.key, { progress: f }));
      patch(item.key, { state: 'done', progress: 1, doc: res.data });
      onUploaded?.(res.data);
      return true;
    } catch (e) {
      if (e instanceof DuplicateError) {
        patch(item.key, { state: 'duplicate', error: e.message, dup: e.details?.matches?.[0] ?? null });
      } else {
        // A photo that can't be read (HEIC, wrong type, too big) won't work on a retry either.
        patch(item.key, { state: 'failed', error: failText(e), retry: Boolean(prepared) });
      }
      return false;
    }
  }

  async function sendAll() {
    if (!online) return;
    setBusy(true);
    let okCount = 0;
    let all = true;
    for (const it of items) {
      if (it.state === 'done') continue;
      if (await send(it)) okCount += 1; else all = false;
    }
    setBusy(false);
    if (all) {
      showToast(okCount === 1 ? t('documents.savedOne') : t('documents.savedMany', { n: okCount }));
      onClose();
    }
  }

  const pending = items.filter((it) => it.state !== 'done');
  return (
    <Sheet title={t('documents.add')} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {!online && <Notice kind="warning">{t('documents.offline')}</Notice>}
        <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
          <Button needsInternet variant="secondary" onClick={() => camera.current?.click()} disabled={busy}><Camera aria-hidden="true" size={20} />{t('documents.takePhoto')}</Button>
          <Button needsInternet variant="secondary" onClick={() => chooser.current?.click()} disabled={busy}><FileUp aria-hidden="true" size={20} />{t('documents.chooseFile')}</Button>
        </div>
        <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-label={t('documents.takePhoto')}
          onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
        <input ref={chooser} type="file" accept={ACCEPT} multiple className="sr-only" tabIndex={-1} aria-label={t('documents.chooseFile')}
          onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />

        {items.length > 0 && (
          <ul className="flex flex-col gap-2" aria-label={t('documents.files')}>
            {items.map((it) => (
              <li key={it.key} className="flex flex-col gap-2 rounded-md border-[1.5px] border-border p-3">
                <span className="flex items-center gap-2 break-all font-bold">
                  {it.state === 'done' && <CircleCheck aria-hidden="true" size={18} className="shrink-0 text-success" />}
                  {it.name}
                </span>
                {(it.state === 'uploading' || it.state === 'preparing') && (
                  <progress className="h-2 w-full accent-[var(--c-primary)]" max={1} value={it.state === 'preparing' ? undefined : it.progress}
                    aria-label={t('documents.uploading', { name: it.name })} />
                )}
                {it.state === 'preparing' && <span className="text-sm text-text-muted">{t('documents.preparing')}</span>}
                {it.state === 'done' && <span className="text-sm text-success">{t('documents.uploaded')}</span>}
                {it.state === 'failed' && (
                  <span role="alert" className="flex flex-wrap items-center gap-x-2 text-danger">
                    <span>{t('documents.notUploaded')} — {it.error}</span>
                    {it.retry && (
                      <button type="button" className="tap inline-flex items-center gap-1 font-bold text-primary" disabled={busy || !online} onClick={() => send(it)}>
                        <RotateCw aria-hidden="true" size={18} />{t('documents.tryAgain')}
                      </button>
                    )}
                  </span>
                )}
                {it.state === 'duplicate' && (
                  <span role="alert" className="flex flex-col gap-2">
                    <span>{it.error}</span>
                    <span className="flex flex-wrap gap-3">
                      {it.dup && <Link to={`/documents/${it.dup.id}`} className="tap inline-flex items-center font-bold text-primary" onClick={onClose}>{t('documents.openIt')}</Link>}
                      <button type="button" className="tap font-bold text-primary" disabled={busy} onClick={() => send(it, true)}>{t('documents.saveAgain')}</button>
                    </span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        <ChoiceChips label={t('documents.type')} value={type} onChange={chooseType} options={DOC_TYPES.map((d) => ({ value: d, label: t(`documents.types.${d}`) }))} />
        {items.length <= 1 && <TextField label={t('documents.titleLabel')} help={t('documents.titleHelp')} value={title} onChange={setTitle} maxLength={120} />}
        {permissions?.admin && <Toggle label={t('documents.private')} help={t('documents.privateHelp')} checked={isPrivate} onChange={setIsPrivate} />}
        {linkLabel && <p className="text-text-muted">{t('documents.linkedTo', { name: linkLabel })}</p>}
        <Button onClick={sendAll} loading={busy} loadingLabel={t('documents.uploadingShort')} disabled={!online || pending.length === 0}>
          {pending.length > 1 ? t('documents.uploadMany', { n: pending.length }) : t('documents.upload')}
        </Button>
      </div>
    </Sheet>
  );
}
