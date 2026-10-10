// Coming? chips for one invitation (FEATURES B5). Saves at once on the invitation's
// own version; if someone changed it first, an inline choice (B5 "Two editing").
import { useState } from 'react';
import { api, newIdemKey } from '../../api/client.js';
import { withRelogin } from '../../api/auth.js';
import { ConflictError } from '../../api/errors.js';
import { showToast } from '../../undo/undoStore.js';
import { formatTime } from '../../format/ist.js';
import { RSVPS } from '../../data/guests.js';
import { t } from '../../i18n/strings.en.js';

export default function RsvpChips({ familyId, invitation, disabled, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [clash, setClash] = useState(null); // { mine, current, by, at }
  const value = invitation.rsvp;

  async function send(rsvp, version) {
    setBusy(true);
    try {
      const res = await withRelogin(() => api('PATCH', `/households/${familyId}/invitations/${invitation.event.id}`, { body: { rsvp }, ifMatch: version, idemKey: newIdemKey() }));
      setClash(null);
      onSaved(res.data);
    } catch (e) {
      if (e instanceof ConflictError && e.current) setClash({ mine: rsvp, current: e.current, by: e.changedBy?.name ?? '', at: e.changedAt });
      else showToast(e.message || t('errors.server'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label={t('guests.rsvpFilter') + ' ' + invitation.event.name} className="flex flex-wrap gap-2">
        {RSVPS.map((r) => {
          const on = r === value;
          return (
            <button key={r} type="button" role="radio" aria-checked={on} disabled={disabled || busy} onClick={() => !on && send(r, invitation.version)}
              className={`tap inline-flex items-center gap-1 rounded-full border-[1.5px] px-3 ${on ? 'border-primary bg-primary-soft font-bold text-primary' : 'border-border-strong bg-surface'} disabled:opacity-60`}>
              {on && <span aria-hidden="true">✓</span>}{t(`guests.rsvp.${r}`)}
            </button>
          );
        })}
      </div>
      {clash && (
        <div role="alert" className="flex flex-col gap-2 rounded-md bg-warning-soft p-3">
          <p>{t('guests.rsvpConflict', { name: clash.by, theirs: t(`guests.rsvp.${clash.current.rsvp}`), time: clash.at ? formatTime(clash.at) : '' })}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="tap rounded-md border-[1.5px] border-border-strong bg-surface px-3 font-bold"
              onClick={() => { setClash(null); onSaved(clash.current); }}>
              {t('guests.keepTheirs', { value: t(`guests.rsvp.${clash.current.rsvp}`) })}
            </button>
            <button type="button" className="tap rounded-md bg-primary px-3 font-bold text-on-primary" disabled={busy}
              onClick={() => send(clash.mine, clash.current.version)}>
              {t('guests.useMine', { value: t(`guests.rsvp.${clash.mine}`) })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
