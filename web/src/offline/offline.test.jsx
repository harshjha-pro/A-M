// Reading without internet (PWA.md §5.1; IMPLEMENTATION Session 13 front-end tests):
// /sync fills the phone's copy; offline the lists render from it with their age and
// search works; advanced filters say "Needs internet"; never-opened screens say so;
// a different person on the same phone sees nothing of the previous one; logout wipes;
// the app opens offline as the last person; writes never pretend.
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, test, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routes } from '../routes.jsx';
import { fakeApi, ok, signInAs, signOut, PEOPLE } from '../test/helpers.js';
import { _resetForTests } from './db.js';
import { runSync } from './sync.js';
import { getRecords, getMeta, setMeta, ensureUser, putRecords } from './cache.js';
import { markOnline } from './state.js';
import { api } from '../api/client.js';
import { loadSession, logout } from '../api/auth.js';
import { getState, resetSession } from '../api/session.js';
import { OfflineError } from '../api/errors.js';
import { taskInView } from './local.js';

const FAM = '01JA7Q3M2K8V5R1T9W4X6Y0H01';
const FAM2 = '01JA7Q3M2K8V5R1T9W4X6Y0H02';
const MEHNDI = '01M4DK5T3E6QZBMNQ0V7KQWW23';
const inv = (over = {}) => ({ household_id: FAM, event: { id: MEHNDI, name: 'Mehndi' }, version: 1, rsvp: 'coming', expected_adults: null, expected_children: null, people: 3, rsvp_note: null, rsvp_updated_at: null, rsvp_updated_by: null, last_reminder_opened_at: null, ...over });
const family = (over = {}) => ({
  id: FAM, version: 1, name: 'Ramesh Sharma & family', phone: '+919829012345', alt_phone: null, side: 'groom', group_name: 'Papa office',
  relation: null, area: 'Shastri Nagar', city: 'Bhilwara', address: null, adults: 2, children: 1, people: 3, food: 'veg', jain_count: 0,
  is_vip: true, notes: null, possible_duplicate: false, created_at: 'x', created_by: { id: 'u', name: 'Mummy' }, updated_at: 'x', updated_by: null,
  invitations: [inv()], ...over,
});
const events = [{ id: MEHNDI, name: 'Mehndi', version: 1, guests_invited: true, start_at: '2027-02-14T12:30:00Z', venue_name: 'Sukhadia Bhawan', type: 'mehndi', side: 'both', all_day: false }];
const syncPage = (changes, over = {}) => ok({
  server_time: '2026-10-08T09:12:31Z', next_since: '2026-10-08T09:10:31Z', has_more: false, cursor: null, full_resync_required: false,
  changes: { settings: null, members: [], events, tags: [], households: [], tasks: [], vendors: [], documents: [], ...changes }, deleted: [], ...over,
});
const sessionReply = (who) => ok({ user: { id: PEOPLE[who].id, name: PEOPLE[who].name, phone: PEOPLE[who].phone, role: PEOPLE[who].role, can_see_money: PEOPLE[who].canSeeMoney },
  permissions: { money: PEOPLE[who].canSeeMoney, edit: true, admin: false }, csrf_token: 'csrf', settings_brief: null });

function goOffline() {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
}

function renderAt(path) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>);
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory(); // a fresh phone for each test
  _resetForTests();
  try { localStorage.clear(); } catch { /* none */ }
});
afterEach(() => { signOut(); act(() => markOnline()); vi.restoreAllMocks(); });

describe('Sync fills the phone', () => {
  test('a full sync stores every row; the next one asks since next_since; deletions are removed', async () => {
    const asked = [];
    let n = 0;
    fakeApi({
      'GET /sync': (_b, init) => {
        asked.push(init);
        n += 1;
        return n === 1
          ? syncPage({ households: [family(), family({ id: FAM2, name: 'Gupta ji' })] })
          : syncPage({ households: [family({ version: 2, name: 'Ramesh Sharma ji' })] }, { deleted: [{ type: 'household', id: FAM2, deleted_at: 'x' }] });
      },
    });
    const fetchFn = globalThis.fetch;
    expect((await runSync(PEOPLE.ayush.id)).ok).toBe(true);
    expect((await getRecords('households')).map((h) => h.name).sort()).toEqual(['Gupta ji', 'Ramesh Sharma & family']);
    expect(await getMeta('nextSince')).toBe('2026-10-08T09:10:31Z');
    await runSync(PEOPLE.ayush.id);
    expect(String(fetchFn.mock.calls.at(-1)[0])).toContain('since=2026-10-08T09%3A10%3A31Z');
    expect((await getRecords('households')).map((h) => h.name)).toEqual(['Ramesh Sharma ji']);
  });

  test('a full sync cut off halfway keeps the old copy whole; a complete one drops rows no longer sent', async () => {
    await ensureUser(PEOPLE.ayush.id);
    await putRecords('households', [family({ name: 'Old copy' }), family({ id: 'gone', name: 'Removed on the server' })]);
    let n = 0;
    fakeApi({
      'GET /sync': () => {
        n += 1;
        if (n === 1) return syncPage({ households: [family({ name: 'Page one' })] }, { has_more: true, cursor: 'c2' });
        if (n === 2) return new Response('busy', { status: 503 }); // the phone lost the connection mid-way
        if (n === 3) return syncPage({ households: [family({ name: 'Fresh' })] }, { has_more: true, cursor: 'c2' });
        return syncPage({ households: [family({ id: FAM2, name: 'Gupta ji' })] });
      },
    });
    expect((await runSync(PEOPLE.ayush.id)).ok).toBe(false);
    expect((await getRecords('households')).map((h) => h.name).sort()).toEqual(['Page one', 'Removed on the server']); // nothing lost
    expect(await getMeta('lastSyncedAt')).toBeUndefined();
    expect((await runSync(PEOPLE.ayush.id)).ok).toBe(true);
    expect((await getRecords('households')).map((h) => h.name).sort()).toEqual(['Fresh', 'Gupta ji']); // "Removed" pruned
  });

  test('logging out while a sync is downloading: nothing is written after the wipe', async () => {
    let release;
    fakeApi({ 'GET /sync': () => new Promise((r) => { release = () => r(syncPage({ households: [family()] })); }) });
    const pending = runSync(PEOPLE.ayush.id);
    await waitFor(() => expect(release).toBeTypeOf('function'));
    const { wipe } = await import('./cache.js');
    await wipe();
    release();
    expect((await pending).ok).toBe(false);
    expect(await getRecords('households')).toEqual([]);
  });

  test('full_resync_required → the copy is cleared and filled again from nothing', async () => {
    await ensureUser(PEOPLE.papa.id);
    await setMeta('nextSince', '2026-09-01T00:00:00Z');
    await putRecords('payments', [{ id: 'p1', title: 'Tent advance', amountPaise: 100 }]);
    let n = 0;
    fakeApi({ 'GET /sync': () => { n += 1; return n === 1 ? syncPage({}, { full_resync_required: true }) : syncPage({ households: [family()] }); } });
    await runSync(PEOPLE.papa.id);
    expect(await getRecords('payments')).toEqual([]); // money access ended: nothing of it stays
    expect(await getRecords('households')).toHaveLength(1);
  });
});

describe('Reading without internet', () => {
  async function synced(who = 'mummy') {
    signInAs(who);
    fakeApi({ 'GET /sync': () => syncPage({ households: [family(), family({ id: FAM2, name: 'Gupta ji', side: 'bride', phone: '+919414011111', invitations: [] })] }) });
    await runSync(PEOPLE[who].id);
  }

  test('the guest list shows the saved families with "No internet · from …"; search by name works', async () => {
    await synced();
    goOffline();
    const user = userEvent.setup();
    renderAt('/guests');
    expect(await screen.findByText('Ramesh Sharma & family')).toBeInTheDocument();
    expect(screen.getByText('Gupta ji')).toBeInTheDocument();
    expect(screen.getByText(/^No internet · from /)).toBeInTheDocument();
    await user.type(screen.getByRole('searchbox'), 'gupta');
    expect(await screen.findByText('Gupta ji')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Ramesh Sharma & family')).toBeNull());
  });

  test('a family page opens offline from the saved row', async () => {
    await synced();
    goOffline();
    renderAt(`/guests/${FAM}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Ramesh Sharma & family' })).toBeInTheDocument();
    expect(screen.getByText(/^No internet · from /)).toBeInTheDocument();
  });

  test('advanced filters say "Needs internet"; a screen never opened says "Open this once with internet"', async () => {
    await synced();
    goOffline();
    await expect(api('GET', '/households', { query: { food: 'jain' } })).rejects.toMatchObject({ code: 'needs_internet' });
    await expect(api('GET', '/money/summary')).rejects.toMatchObject({ code: 'not_cached', message: 'Open this once with internet to see it offline.' });
    const found = await api('GET', '/households', { query: { q: 'gupta' } });
    expect(found.data.map((h) => h.name)).toEqual(['Gupta ji']);
    const side = await api('GET', '/households', { query: { side: 'bride' } });
    expect(side.meta).toMatchObject({ offline: true, total: 1 });
    expect(side.data.map((h) => h.name)).toEqual(['Gupta ji']);
    const ev = await api('GET', '/households', { query: { event: MEHNDI, rsvp: 'coming' } });
    expect(ev.data.map((h) => h.invitation?.rsvp)).toEqual(['coming']);
    expect(ev.meta.totals.people).toBe(3);
  });

  test('any screen seen online is kept: Home offline shows the saved reply with its age', async () => {
    signInAs('mummy');
    fakeApi({ 'GET /dashboard': () => ok({ cards: [{ type: 'today', items: [] }] }) });
    const online = await api('GET', '/dashboard');
    await waitFor(async () => expect(await getMeta('userId')).toBeUndefined()); // no user check needed for replies
    goOffline();
    const off = await api('GET', '/dashboard');
    expect(off.data).toEqual(online.data);
    expect(off.meta.offline).toBe(true);
    expect(off.meta.savedAt).toMatch(/^\d{4}-/);
  });

  test('saving with no internet never pretends: it fails for real', async () => {
    signInAs('mummy');
    fakeApi({});
    goOffline();
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(api('POST', '/tasks', { body: { title: 'x' } })).rejects.toBeInstanceOf(OfflineError);
  });

  test('task views offline follow the server rules', () => {
    const today = '2026-10-08';
    const tk = (over) => ({ status: 'todo', dueDate: null, dueTime: null, assignees: [], ...over });
    expect(taskInView(tk({ dueDate: '2026-10-07' }), 'overdue', 'me', today, '10:00')).toBe(true);
    expect(taskInView(tk({ dueDate: today, dueTime: '09:00' }), 'overdue', 'me', today, '10:00')).toBe(true);
    expect(taskInView(tk({ dueDate: today, dueTime: '11:00' }), 'overdue', 'me', today, '10:00')).toBe(false);
    expect(taskInView(tk({ dueDate: today }), 'today', 'me', today)).toBe(true);
    expect(taskInView(tk({ dueDate: '2026-10-11' }), 'week', 'me', today)).toBe(true); // Sunday of the same week
    expect(taskInView(tk({ dueDate: '2026-10-12' }), 'week', 'me', today)).toBe(false);
    expect(taskInView(tk({ assignees: [{ id: 'me' }] }), 'mine', 'me', today)).toBe(true);
    expect(taskInView(tk({ status: 'cancelled' }), 'all', 'me', today)).toBe(false);
    expect(taskInView(tk({ status: 'done' }), 'closed', 'me', today)).toBe(true);
    expect(taskInView(tk({}), 'no_date', 'me', today)).toBe(true);
  });
});

describe('Privacy and starting offline', () => {
  test('a different person logs in on the same phone → the previous person\'s copy is wiped first', async () => {
    await ensureUser(PEOPLE.ayush.id);
    await putRecords('households', [family()]);
    await setMeta('nextSince', '2026-10-08T09:10:31Z');
    fakeApi({ 'GET /session': () => sessionReply('nani') });
    resetSession();
    await loadSession();
    expect(await getRecords('households')).toEqual([]);
    expect(await getMeta('nextSince')).toBeUndefined();
    expect(await getMeta('userId')).toBe(PEOPLE.nani.id);
  });

  test('logout wipes everything saved on the phone', async () => {
    fakeApi({ 'GET /session': () => sessionReply('mummy'), 'POST /auth/logout': () => ok(null) });
    resetSession();
    await loadSession();
    await putRecords('households', [family()]);
    await logout();
    expect(await getRecords('households')).toEqual([]);
    expect(await getMeta('lastSession')).toBeUndefined();
  });

  test('opening the app with no internet: the last person on this phone, with the saved copy', async () => {
    fakeApi({ 'GET /session': () => sessionReply('mummy') });
    resetSession();
    await loadSession();
    signOut();
    resetSession();
    goOffline();
    await loadSession();
    expect(getState()).toMatchObject({ status: 'in', user: { id: PEOPLE.mummy.id } });
  });

  test('never opened on this phone and no internet → the start screen offers Try again, not a login', async () => {
    goOffline();
    resetSession();
    await expect(loadSession()).rejects.toBeInstanceOf(OfflineError);
  });
});
