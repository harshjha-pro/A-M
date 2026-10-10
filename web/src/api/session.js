// The logged-in person, in memory only (API.md §3.1):
// - the CSRF token is never written to localStorage or a readable cookie;
// - after a reload it comes back from GET /session (which also keeps the
//   90-day login alive).
// Screens read it with useSession(); forms wrap saves in withRelogin() so an
// expired login opens the login sheet over the form instead of losing typing.
import { useSyncExternalStore } from 'react';

let csrfToken = null;
let state = { status: 'unknown', user: null, permissions: null, settingsBrief: null, reason: null };
let loginRequest = null; // { reason, phone, resolve, reject }
const listeners = new Set();

const emit = () => listeners.forEach((fn) => fn());
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function getState() { return state; }
export function getLoginRequest() { return loginRequest; }

export function setCsrfToken(token) {
  csrfToken = typeof token === 'string' && token !== '' ? token : null;
}
export function getCsrfToken() { return csrfToken; }

function setState(next) {
  state = { ...state, ...next };
  emit();
}

/** Called with the data of GET /session. */
export function applySession(data) {
  setCsrfToken(data.csrfToken);
  setState({ status: 'in', user: data.user, permissions: data.permissions, settingsBrief: data.settingsBrief ?? null, reason: null });
}

/** Logged out (or never logged in). Clears everything held in memory. */
export function clearSession(reason = null) {
  csrfToken = null;
  setState({ status: 'out', user: null, permissions: null, settingsBrief: null, reason });
}

/** Back to "don't know yet" (a fresh app start): the next screen asks GET /session. */
export function resetSession() {
  csrfToken = null;
  loginRequest = null;
  setState({ status: 'unknown', user: null, permissions: null, settingsBrief: null, reason: null });
}

/** Login sheet over a form (FEATURES A0): resolves after a successful login, rejects on Cancel. */
export function askToLogin(reason) {
  if (loginRequest) return loginRequest.promise;
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  loginRequest = { reason, phone: state.user?.phone ?? '', resolve, reject, promise };
  emit();
  return promise;
}

export function finishLoginRequest(ok) {
  const req = loginRequest;
  loginRequest = null;
  emit();
  if (!req) return;
  if (ok) req.resolve();
  else req.reject(new Error('login_cancelled'));
}

export function useSession() {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function useLoginRequest() {
  return useSyncExternalStore(subscribe, getLoginRequest, getLoginRequest);
}
