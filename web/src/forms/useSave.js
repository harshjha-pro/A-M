// One save button's life (DESIGN §7 Saved indicator): idle → Saving… → Saved ✓ 10:42,
// or an error. "Saved" only after a 2xx. The Idempotency-Key stays the same for
// every retry of the same action and is renewed only after a success.
import { useRef, useState } from 'react';
import { newIdemKey } from '../api/client.js';
import { withRelogin } from '../api/auth.js';
import { formatTime } from '../format/ist.js';

export function useSave() {
  const key = useRef(newIdemKey());
  const [state, setState] = useState({ status: 'idle', savedAt: null, error: null });

  async function run(send) {
    setState({ status: 'saving', savedAt: null, error: null });
    try {
      const res = await withRelogin(() => send(key.current));
      key.current = newIdemKey();
      setState({ status: 'saved', savedAt: formatTime(new Date()), error: null });
      return res;
    } catch (e) {
      setState({ status: 'error', savedAt: null, error: e });
      throw e;
    }
  }

  return {
    ...state,
    run,
    reset: () => setState({ status: 'idle', savedAt: null, error: null }),
    /** A different body (after a merge) needs a new key, or the server says "doesn't match the first try". */
    renew: () => { key.current = newIdemKey(); },
  };
}
