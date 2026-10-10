// Select mode actions (FEATURES B5): Invite to / Remove from / Set Coming? / Change side /
// Delete (Ayush and Mahi). One request, one batch, one Undo; rows someone changed after
// the list was opened are left alone and counted.
import { useState } from 'react';
import { UserPlus, UserMinus, CircleCheck, ArrowLeftRight, Trash2 } from 'lucide-react';
import Sheet from '../../components/Sheet.jsx';
import Button from '../../components/Button.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import { ChoiceChips } from '../../components/Field.jsx';
import { api, newIdemKey } from '../../api/client.js';
import { withRelogin } from '../../api/auth.js';
import { showUndo, showToast } from '../../undo/undoStore.js';
import { formatCount } from '../../format/inr.js';
import { RSVPS, SIDES } from '../../data/guests.js';
import { t } from '../../i18n/strings.en.js';

const ACTIONS = [
  { key: 'invite', Icon: UserPlus, needs: 'event' },
  { key: 'uninvite', Icon: UserMinus, needs: 'event' },
  { key: 'set_rsvp', Icon: CircleCheck, needs: 'event+rsvp' },
  { key: 'set_side', Icon: ArrowLeftRight, needs: 'side' },
  { key: 'delete', Icon: Trash2, needs: null, admin: true },
];
const LABEL = { invite: 'bulk.invite', uninvite: 'bulk.uninvite', set_rsvp: 'bulk.setRsvp', set_side: 'bulk.setSide', delete: 'bulk.delete' };

/** "3 left as they were: already invited" */
export function skippedText(skipped) {
  if (!skipped?.length) return null;
  const why = [...new Set(skipped.map((s) => t(`bulk.reasons.${s.reason}`)))].join('; ');
  return t('bulk.skipped', { n: skipped.length, why });
}

export default function BulkBar({ count, target, asOf, events, isAdmin, defaultEvent, onDone }) {
  const [action, setAction] = useState(null);
  const [eventId, setEventId] = useState(defaultEvent || '');
  const [rsvp, setRsvp] = useState('coming');
  const [side, setSide] = useState('both');
  const [busy, setBusy] = useState(false);
  const tooMany = count > 2000;

  async function apply() {
    setBusy(true);
    const body = { action, asOf, ...target };
    if (['invite', 'uninvite', 'set_rsvp'].includes(action)) body.eventId = eventId;
    if (action === 'set_rsvp') body.rsvp = rsvp;
    if (action === 'set_side') body.side = side;
    try {
      const res = await withRelogin(() => api('POST', '/households/bulk', { body, idemKey: newIdemKey() }));
      setAction(null);
      const extra = skippedText(res.data.skipped);
      if (res.meta.undo) showUndo({ batchId: res.meta.undo.batchId, summary: [res.meta.undo.summary, extra].filter(Boolean).join('. '), onUndone: onDone });
      else showToast(extra || t('bulk.nothing'));
      onDone();
    } catch (e) {
      showToast(e.message || t('errors.server'));
    } finally {
      setBusy(false);
    }
  }

  const def = ACTIONS.find((a) => a.key === action);
  return (
    <>
      <div role="toolbar" aria-label={t('bulk.pick')} className="flex flex-wrap gap-2">
        {ACTIONS.filter((a) => !a.admin || isAdmin).map(({ key, Icon }) => (
          <button key={key} type="button" disabled={count === 0} onClick={() => setAction(key)}
            className={`tap inline-flex items-center gap-2 rounded-sm border-[1.5px] px-3 disabled:opacity-50 ${key === 'delete' ? 'border-danger text-danger' : 'border-border-strong'} bg-surface`}>
            <Icon aria-hidden="true" size={20} /> {t(LABEL[key])}
          </button>
        ))}
      </div>
      {tooMany && <p role="alert" className="text-danger">{t('bulk.tooMany')}</p>}
      {def && def.key !== 'delete' && (
        <Sheet title={t(LABEL[def.key])} onClose={() => setAction(null)}>
          <div className="flex flex-col gap-4">
            {def.needs.includes('event') && (
              <label className="flex flex-col gap-1">
                <span className="font-bold">{t('bulk.event')}</span>
                <select value={eventId} onChange={(e) => setEventId(e.target.value)} className="tap rounded-sm border-[1.5px] border-border-strong bg-surface px-2 text-base text-text">
                  <option value="">—</option>
                  {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </label>
            )}
            {def.needs.includes('rsvp') && (
              <ChoiceChips label={t('bulk.answer')} value={rsvp} onChange={setRsvp} options={RSVPS.map((r) => ({ value: r, label: t(`guests.rsvp.${r}`) }))} />
            )}
            {def.needs === 'side' && (
              <ChoiceChips label={t('bulk.side')} value={side} onChange={setSide} options={SIDES.map((s) => ({ value: s, label: t(`guests.sides.${s}`) }))} />
            )}
            <Button needsInternet onClick={apply} loading={busy} disabled={tooMany || (def.needs.includes('event') && !eventId)}>
              {t('bulk.apply', { n: formatCount(count) })}
            </Button>
          </div>
        </Sheet>
      )}
      {def?.key === 'delete' && (
        <ConfirmDialog title={t('bulk.confirmDelete', { n: formatCount(count) })} body={t('bulk.confirmDeleteBody')}
          confirmLabel={t('bulk.delete')} danger onConfirm={apply} onCancel={() => setAction(null)} />
      )}
    </>
  );
}
