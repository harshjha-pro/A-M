// One save button's life (DESIGN §7 Saved indicator): idle → Saving… → Saved ✓ 10:42,
// or an error. "Saved" only after a 2xx. A change kept on the phone for later (outbox,
// PWA §5.2) is 🕒 "Waiting to send" instead: status 'saved' with queued: true. The Idempotency-Key stays the same for
// every retry of the same action and is renewed only after a success.
import { useRef, useState } from 'react';
import { newIdemKey } from '../api/client.js';
import { withRelogin } from '../api/auth.js';
import { formatTime } from '../format/ist.js';
import { showToast } from '../undo/undoStore.js';
import { t } from '../i18n/strings.en.js';

export function useSave() {
  const key = useRef(newIdemKey());
  const [state, setState] = useState({ status: 'idle', savedAt: null, error: null, queued: false });

  /** send(idemKey) → the record (or { queued, data } from the outbox). Returns the record. */
  async function run(send) {
    setState({ status: 'saving', savedAt: null, error: null, queued: false });
    try {
      let res = await withRelogin(() => send(key.current));
      key.current = newIdemKey();
      const queued = Boolean(res && res.queued);
      if (queued) { showToast(t('outbox.queuedToast')); res = res.data; }
      setState({ status: 'saved', savedAt: formatTime(new Date()), error: null, queued });
      return res;
    } catch (e) {
      setState({ status: 'error', savedAt: null, error: e, queued: false });
      throw e;
    }
  }

  return {
    ...state,
    run,
    reset: () => setState({ status: 'idle', savedAt: null, error: null, queued: false }),
    /** A different body (after a merge) needs a new key, or the server says "doesn't match the first try". */
    renew: () => { key.current = newIdemKey(); },
  };
}
