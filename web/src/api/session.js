// The CSRF token lives in memory ONLY (API.md §3.1): never localStorage,
// never a cookie the page can read. After a reload it is fetched again with
// GET /session (Session 2).

let csrfToken = null;

export function setCsrfToken(token) {
  csrfToken = typeof token === 'string' && token !== '' ? token : null;
}

export function getCsrfToken() {
  return csrfToken;
}

export function clearSession() {
  csrfToken = null;
}
