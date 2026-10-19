// Settings › Home photos (1.0.16): cover slideshow (up to 8), couple photos (up to 4)
// and the monogram (1). Ayush and Mahi add, reorder and remove; Remove has Undo.
// Photos are made small on the phone first (a monogram PNG keeps its see-through background).
import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ImagePlus, ChevronLeft, ChevronRight, X } from 'lucide-react';
import Screen, { ScreenLoader } from '../../components/Screen.jsx';
import Button from '../../components/Button.jsx';
import { Notice } from '../../components/Field.jsx';
import { api, newIdemKey } from '../../api/client.js';
import { withRelogin } from '../../api/auth.js';
import { useSession } from '../../api/session.js';
import { useHomePhotos, prepareHomePhoto, uploadHomePhoto, MAX, ACCEPT } from '../../data/homePhotos.js';
import { showUndo, showToast } from '../../undo/undoStore.js';
import { t } from '../../i18n/strings.en.js';

const SECTIONS = [
  { slot: 'cover', title: 'homePhotos.cover', hint: 'homePhotos.coverHint', aspect: 'aspect-[4/3]' },
  { slot: 'couple', title: 'homePhotos.couple', hint: 'homePhotos.coupleHint', aspect: 'aspect-square' },
  { slot: 'monogram', title: 'homePhotos.monogram', hint: 'homePhotos.monogramHint', aspect: 'aspect-square' },
];

export default function HomePhotos() {
  const { permissions } = useSession();
  const admin = Boolean(permissions?.admin);
  const q = useHomePhotos();
  return (
    <Screen title={t('homePhotos.title')} back="/settings">
      <p className="text-text-muted">{t('homePhotos.intro')}</p>
      {!admin && <Notice>{t('homePhotos.onlyAdmins')}</Notice>}
      {q.isPending && <ScreenLoader />}
      {q.isError && <Notice kind="danger">{q.error.message || t('errors.loadFailed')}</Notice>}
      {q.data && SECTIONS.map((s) => <Section key={s.slot} {...s} photos={q.data[s.slot]} admin={admin} />)}
    </Screen>
  );
}

function Section({ slot, title, hint, aspect, photos, admin }) {
  const qc = useQueryClient();
  const input = useRef(null);
  const [progress, setProgress] = useState(null); // { n, total }
  const [busy, setBusy] = useState(false);
  const max = MAX[slot];
  const left = max - photos.length;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['home-photos'] });
  };

  async function add(list) {
    const files = Array.from(list || []).slice(0, left);
    if (!files.length) return;
    setBusy(true);
    let ok = 0;
    for (let i = 0; i < files.length; i++) {
      setProgress({ n: i + 1, total: files.length });
      try {
        const prepared = await prepareHomePhoto(files[i], slot);
        await uploadHomePhoto(prepared, slot);
        ok++;
      } catch (e) {
        showToast(t('homePhotos.notAdded', { why: e?.message || t('errors.server') }));
        break;
      }
    }
    setProgress(null);
    setBusy(false);
    if (ok) showToast(t('homePhotos.added'));
    refresh();
  }

  async function remove(p) {
    setBusy(true);
    try {
      const res = await withRelogin(() => api('DELETE', `/home-photos/${p.id}`, { ifMatch: p.version, idemKey: newIdemKey() }));
      if (res.meta.undo) showUndo({ batchId: res.meta.undo.batchId, summary: res.meta.undo.summary, onUndone: refresh });
    } catch (e) { showToast(e.message || t('errors.server')); }
    setBusy(false);
    refresh();
  }

  /** Swap with a neighbour; each photo whose place changed is saved with its new order. */
  async function move(i, dir) {
    const order = [...photos];
    const j = i + dir;
    [order[i], order[j]] = [order[j], order[i]];
    setBusy(true);
    try {
      for (let k = 0; k < order.length; k++) {
        if (order[k].sortOrder !== k) {
          await withRelogin(() => api('PATCH', `/home-photos/${order[k].id}`, { body: { sortOrder: k }, ifMatch: order[k].version, idemKey: newIdemKey() }));
        }
      }
    } catch (e) { showToast(e.message || t('errors.server')); }
    setBusy(false);
    refresh();
  }

  const name = t(title).toLowerCase();
  return (
    <section aria-labelledby={`hp-${slot}`} className="flex flex-col gap-3 rounded-md bg-surface p-4 shadow-card">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id={`hp-${slot}`} className="text-lg font-bold">{t(title)}</h2>
        <span className="text-text-muted">{t('homePhotos.count', { n: photos.length, max })}</span>
      </div>
      <p className="text-text-muted">{t(hint)}</p>
      {photos.length === 0 && <p className="text-text-muted">{t('homePhotos.empty')}</p>}
      {photos.length > 0 && (
        <ul className={`grid gap-3 ${slot === 'monogram' ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
          {photos.map((p, i) => (
            <li key={p.id} className="flex flex-col gap-2">
              <img src={p.url} alt={`${t(title)} ${i + 1}`} loading="lazy" decoding="async" width={p.widthPx || undefined} height={p.heightPx || undefined}
                className={`w-full rounded-md bg-surface-2 object-cover ${aspect} ${slot === 'monogram' ? 'object-contain' : ''}`} />
              {admin && (
                <div className="flex items-center justify-between gap-1">
                  {slot !== 'monogram' ? (
                    <span className="flex gap-1">
                      <button type="button" className="tap grid min-h-12 min-w-12 place-items-center rounded-md border border-border disabled:opacity-40" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={`${t('homePhotos.earlier')}: ${name} ${i + 1}`}><ChevronLeft aria-hidden="true" size={20} /></button>
                      <button type="button" className="tap grid min-h-12 min-w-12 place-items-center rounded-md border border-border disabled:opacity-40" disabled={busy || i === photos.length - 1} onClick={() => move(i, 1)} aria-label={`${t('homePhotos.later')}: ${name} ${i + 1}`}><ChevronRight aria-hidden="true" size={20} /></button>
                    </span>
                  ) : <span />}
                  <button type="button" className="tap grid min-h-12 min-w-12 place-items-center rounded-md border border-danger text-danger disabled:opacity-40" disabled={busy} onClick={() => remove(p)} aria-label={t('homePhotos.removeNamed', { name, n: i + 1 })}><X aria-hidden="true" size={20} /></button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {admin && (left > 0 ? (
        <>
          <input ref={input} type="file" accept={ACCEPT} multiple={left > 1} hidden data-testid={`hp-input-${slot}`} onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
          <Button needsInternet variant="secondary" loading={busy && progress != null} loadingLabel={progress ? t('homePhotos.uploading', progress) : '…'} disabled={busy} onClick={() => input.current?.click()}>
            <ImagePlus aria-hidden="true" size={20} />{t('homePhotos.add')}
          </Button>
        </>
      ) : <p className="text-text-muted">{t('homePhotos.full')}</p>)}
    </section>
  );
}
