// Log in / out and the session refresh. Everything goes through api().
import { api } from './client.js';
import { AuthError } from './errors.js';
import { applySession, clearSession, askToLogin, setCsrfToken, getState } from './session.js';

/** GET /session: who am I (also keeps the 90-day login alive). */
export async function loadSession() {
  try {
    const res = await api('GET', '/session');
    applySession(res.data);
    return res.data;
  } catch (e) {
    if (e instanceof AuthError) {
      clearSession(e.details?.reason ?? null);
      return null;
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
  try { await api('POST', '/auth/logout', { idempotent: false }); } finally { clearSession(); }
}

export async function logoutEverywhere() {
  try { await api('POST', '/auth/logout-all', { idempotent: false }); } finally { clearSession(); }
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
