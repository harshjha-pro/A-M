// Settings › Changes on this phone (PWA.md §5.2–§5.4): every change kept on the phone that
// hasn't reached the server, oldest first, with what it needs:
//   waiting → Send now / Discard
//   someone else changed it → pick Yours or Theirs per field → Save my choices / Keep theirs
//   deleted → ask Ayush or Mahi to restore it → Try again / Discard
//   looks like a family already on the list → Add anyway / Discard
//   couldn't send → the reason → Try again / Discard
// Discard always asks first: Undo can't bring it back.
import { useEffect, useState } from 'react';
import { Clock, CheckCircle2 } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import Button from '../../components/Button.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { Notice } from '../../components/Field.jsx';
import { useOutbox, refreshOutbox, flushOutbox, discardEntry, resolveConflict, addAnyway, retryEntry, clashes } from '../../offline/outbox.js';
import { useOnline } from '../../offline/useOnline.js';
import { formatDateTime, formatTime } from '../../format/ist.js';
import { t } from '../../i18n/strings.en.js';

/** "dueDate" → "Due date" */
const fieldLabel = (k) => k.replace(/Ids?$/, '').replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

function show(field, v, record) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? t('yes') : t('no');
  if (field === 'rsvp') return t(`guests.rsvp.${v}`);
  if (field === 'status') return t(`tasks.status.${v}`);
  if (Array.isArray(v)) {
    const list = record?.[`${field.replace(/Ids$/, '')}s`];
    return v.map((id) => list?.find?.((x) => x?.id === id)?.name ?? id).join(', ') || '—';
  }
  return String(v);
}

function Conflict({ e, busy, onSave, onKeep }) {
  const list = clashes(e, e.error.current);
  const [pick, setPick] = useState(() => Object.fromEntries(list.map((c) => [c.field, 'mine'])));
  const who = e.error.changedBy?.name;
  return (
    <div className="flex flex-col gap-3">
      {who && <p>{t('outbox.changedBy', { name: who, time: e.error.changedAt ? formatTime(e.error.changedAt) : '' })}</p>}
      {list.map((c) => (
        <fieldset key={c.field} className="flex flex-col gap-2 rounded-md border border-border p-3">
          <legend className="px-1 font-bold">{fieldLabel(c.field)}</legend>
          {[['mine', t('outbox.yours'), c.mine, e.base], ['theirs', who ? t('outbox.theirs', { name: who }) : t('outbox.theirsAnon'), c.theirs, e.error.current]].map(([side, label, v, rec]) => (
            <label key={side} className="tap flex cursor-pointer items-center gap-3">
              <input type="radio" name={`${e.key}-${c.field}`} checked={pick[c.field] === side} onChange={() => setPick({ ...pick, [c.field]: side })} className="h-5 w-5 accent-[var(--c-primary)]" />
              <span><span className="text-text-muted">{label}: </span><span className="font-bold">{show(c.field, v, rec)}</span></span>
            </label>
          ))}
        </fieldset>
      ))}
      <Button onClick={() => onSave(pick)} loading={busy}>{t('outbox.saveChoices')}</Button>
      <Button variant="secondary" onClick={onKeep} disabled={busy}>{t('outbox.keepTheirs')}</Button>
    </div>
  );
}

function Entry({ e, online, onDiscard }) {
  const [busy, setBusy] = useState(false);
  const act = (fn) => async (...a) => { setBusy(true); try { await fn(...a); } finally { setBusy(false); } };
  const err = e.error;
  return (
    <li className="flex flex-col gap-3 rounded-md bg-surface p-4 shadow-card">
      <div className="flex flex-col">
        <span className="text-lg font-bold">{e.label || `${e.method} ${e.path}`}</span>
        <span className="text-sm text-text-muted">{formatDateTime(e.createdAt)}</span>
      </div>
      <p className={`inline-flex items-center gap-1 font-bold ${e.status === 'pending' ? 'text-warning' : 'text-danger'}`}>
        {e.status === 'pending' && <Clock aria-hidden="true" size={16} />}{t(`outbox.status.${e.status}`)}
      </p>
      {e.status === 'conflict' && err?.current && (
        <Conflict e={e} busy={busy} onSave={act((pick) => resolveConflict(e.key, pick))}
          onKeep={act(() => resolveConflict(e.key, Object.fromEntries(Object.keys(e.body).map((k) => [k, 'theirs']))))} />
      )}
      {e.status === 'deleted' && (
        <>
          {err?.changedBy?.name && <p>{t('outbox.deletedBy', { name: err.changedBy.name, time: err.changedAt ? formatTime(err.changedAt) : '' })}</p>}
          <p>{t('outbox.deletedAsk')}</p>
        </>
      )}
      {e.status === 'duplicate' && (
        <>
          {(err?.matches ?? []).slice(0, 3).map((m) => <p key={m.id}>{t('outbox.sameAs', { name: m.name })}</p>)}
          <Button onClick={act(() => addAnyway(e.key))} loading={busy} disabled={!online}>{t('outbox.addAnyway')}</Button>
        </>
      )}
      {(e.status === 'needs_fix' || e.status === 'rejected') && (
        <Notice kind="danger">{[err?.message, ...Object.values(err?.fields ?? {})].filter(Boolean).join(' ')}</Notice>
      )}
      {['deleted', 'needs_fix', 'rejected'].includes(e.status) && (
        <Button variant="secondary" onClick={act(() => retryEntry(e.key))} loading={busy} disabled={!online}>{t('outbox.tryAgain')}</Button>
      )}
      <Button variant="danger" onClick={() => onDiscard(e)} disabled={busy}>{t('outbox.discard')}</Button>
    </li>
  );
}

export default function Waiting() {
  const { mine, waiting, others, sending } = useOutbox();
  const online = useOnline();
  const [confirm, setConfirm] = useState(null);
  useEffect(() => { refreshOutbox(); }, []);
  return (
    <Screen title={t('outbox.title')} back="/settings/phone">
      {others.map((o) => <Notice key={o.name} kind="info">{t('outbox.othersLine', { n: o.count, name: o.name })}</Notice>)}
      {mine.length === 0 ? <EmptyState Icon={CheckCircle2} text={t('outbox.empty')} /> : (
        <>
          {waiting > 0 && (online
            ? <Button onClick={() => flushOutbox({ force: true })} loading={sending}>{t('outbox.sendNow')}</Button>
            : <Notice kind="info">{t('outbox.connectFirst')}</Notice>)}
          <ul className="flex flex-col gap-3">
            {mine.map((e) => <Entry key={e.key} e={e} online={online} onDiscard={setConfirm} />)}
          </ul>
        </>
      )}
      {confirm && (
        <ConfirmDialog title={t('outbox.discardTitle')} body={t('outbox.discardBody')} confirmLabel={t('outbox.discard')} danger
          onConfirm={async () => { const k = confirm.key; setConfirm(null); await discardEntry(k); }} onCancel={() => setConfirm(null)} />
      )}
    </Screen>
  );
}
