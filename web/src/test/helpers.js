// Test helpers: a pretend login, and a fake API keyed by "METHOD /path".
import { vi } from 'vitest';
import { applySession, clearSession } from '../api/session.js';

export const PEOPLE = {
  ayush: { id: '01JA6ZA0000000000000000001', name: 'Ayush', phone: '+919829000101', role: 'owner', canSeeMoney: true },
  mahi: { id: '01JA6ZA0000000000000000002', name: 'Mahi', phone: '+919829000102', role: 'partner', canSeeMoney: true },
  papa: { id: '01JA6ZA0000000000000000003', name: 'Papa', phone: '+919829000103', role: 'family', canSeeMoney: true },
  mummy: { id: '01JA6ZA0000000000000000004', name: 'Mummy', phone: '+919829000104', role: 'family', canSeeMoney: false },
  nani: { id: '01JA6ZA0000000000000000005', name: 'Nani', phone: '+919829000105', role: 'viewer', canSeeMoney: false },
};

export function permissionsFor(u) {
  const admin = u.role === 'owner' || u.role === 'partner';
  return { money: u.canSeeMoney, edit: u.role !== 'viewer', admin, owner: u.role === 'owner', eventsWrite: admin, trash: admin, export: admin, activity: admin };
}

export function signInAs(who) {
  const user = PEOPLE[who];
  applySession({ user, permissions: permissionsFor(user), csrfToken: `csrf-${who}`, settingsBrief: null });
  return user;
}

export function signOut() {
  clearSession();
}

export const ok = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify({ ok: true, data, meta: { request_id: 'r_0000000001', server_time: '2026-10-08T09:12:31Z' } }), { status, headers: { 'Content-Type': 'application/json', ...headers } });
export const fail = (status, error) =>
  new Response(JSON.stringify({ ok: false, error, meta: { request_id: 'r_0000000002', server_time: '2026-10-08T09:12:31Z' } }), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * fakeApi({ 'GET /health': () => ok(...), 'POST /members': (body, init) => ... })
 * Unknown routes answer 404. Returns the vi.fn so tests can read calls.
 */
export function fakeApi(handlers) {
  const fn = vi.fn(async (url, init = {}) => {
    const path = String(url).replace(/^\/api\/v1/, '').split('?')[0];
    const key = `${init.method || 'GET'} ${path}`;
    const h = handlers[key] ?? Object.entries(handlers).find(([k]) => new RegExp(`^${k.replace(/\{[^}]+\}/g, '[^/]+')}$`).test(key))?.[1];
    if (!h) return fail(404, { code: 'not_found', message: "This item doesn't exist or was removed." });
    return h(typeof init.body === 'string' ? JSON.parse(init.body) : init.body, init);
  });
  vi.stubGlobal('fetch', fn);
  vi.stubGlobal('XMLHttpRequest', fakeXhr(fn));
  return fn;
}

/**
 * XMLHttpRequest for uploads, answered by the same handlers (body = the FormData).
 * Reports upload progress at 50% and 100% before the reply.
 */
function fakeXhr(fetchFn) {
  return class FakeXhr {
    constructor() { this.upload = {}; this.headers = {}; this.status = 0; this.responseText = ''; this.replyHeaders = new Headers(); }
    open(method, url) { this.method = method; this.url = url; }
    setRequestHeader(k, v) { this.headers[k] = v; }
    getResponseHeader(k) { return this.replyHeaders.get(k); }
    abort() { this.aborted = true; this.onabort?.(); }
    async send(body) {
      const total = 1000;
      this.upload.onprogress?.({ lengthComputable: true, loaded: total / 2, total });
      await Promise.resolve();
      this.upload.onprogress?.({ lengthComputable: true, loaded: total, total });
      this.upload.onload?.();
      let res;
      try {
        res = await fetchFn(this.url, { method: this.method, headers: this.headers, body });
      } catch {
        this.onerror?.();
        return;
      }
      if (this.aborted) return;
      if (res === 'network-error') { this.onerror?.(); return; }
      this.status = res.status;
      this.replyHeaders = res.headers;
      this.responseText = await res.text();
      this.onload?.();
    }
  };
}
