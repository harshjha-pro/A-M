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
    return h(init.body ? JSON.parse(init.body) : undefined, init);
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}
