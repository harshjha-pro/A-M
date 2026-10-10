// Log in / out and the session refresh. Everything goes through api().
import { api } from './client.js';
import { AuthError, OfflineError, TimeoutError } from './errors.js';
import { applySession, clearSession, askToLogin, setCsrfToken, getState } from './session.js';
import { ensureUser, getMeta, setMeta, wipe } from '../offline/cache.js';
import { markOffline } from '../offline/state.js';

/**
 * GET /session: who am I (also keeps the 90-day login alive). With no internet the app
 * opens as the person who last used it on this phone, showing the phone's copy (PWA §5.1);
 * the server checks the login for real as soon as the internet is back.
 */
export async function loadSession() {
  try {
    const res = await api('GET', '/session');
    applySession(res.data);
    await ensureUser(res.data.user?.id); // someone else's copy is wiped before anything is shown
    const { csrfToken: _c, ...who } = res.data;
    await setMeta('lastSession', { ...who, savedAt: new Date().toISOString() });
    return res.data;
  } catch (e) {
    if (e instanceof AuthError) {
      clearSession(e.details?.reason ?? null);
      return null;
    }
    if (e instanceof OfflineError || e instanceof TimeoutError) {
      const saved = await getMeta('lastSession');
      if (saved?.user) {
        applySession({ ...saved, csrfToken: null });
        markOffline((await getMeta('lastSyncedAt')) ?? saved.savedAt);
        window.addEventListener('online', () => { loadSession().catch(() => {}); }, { once: true });
        return saved;
      }
    }
    throw e;
  }
}

/** Login and the other routes that hand back {user, csrf_token} + a cookie. */
async function signIn(method, path, body) {
  const res = await api(method, path, { body, idempotent: false });
  setCsrfToken(res.data.csrfToken);
  await loadSession(); // permissions and wedding facts
  return res.data;
}

export const login = (phone, password) => signIn('POST', '/auth/login', { phone, password });
export const setupOwner = (body) => signIn('POST', '/setup/owner', body);
export const completeLink = (token, newPassword) => signIn('POST', '/auth/password-link/complete', { token, newPassword });

export async function logout() {
  try { await api('POST', '/auth/logout', { idempotent: false }); } finally { clearSession(); await wipe(); } // nothing of theirs stays on the phone
}

export async function logoutEverywhere() {
  try { await api('POST', '/auth/logout-all', { idempotent: false }); } finally { clearSession(); await wipe(); }
}

export async function changePassword(currentPassword, newPassword, idemKey) {
  const res = await api('POST', '/auth/password/change', { body: { currentPassword, newPassword }, idemKey });
  setCsrfToken(res.data.csrfToken); // this phone got a new login cookie
  return res.data;
}

/**
 * Run a save; if the login has ended, show the login sheet over the form and
 * try ONCE more. `run` must reuse the same Idempotency-Key, so a save that
 * did reach the server is never made twice (API.md §2.4).
 */
export async function withRelogin(run) {
  try {
    return await run();
  } catch (e) {
    if (!(e instanceof AuthError)) throw e;
    await askToLogin(e.details?.reason ?? e.code);
    return run();
  }
}

export function currentUser() {
  return getState().user;
}
