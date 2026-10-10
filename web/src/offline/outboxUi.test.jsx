// Saving without internet, on the screens (PWA.md §5.2–§5.5, TESTING §1.7 "Outbox"):
// tick with no internet → 🕒 Waiting to send + "1 change waiting to send." (Send now says it
// will send when online); back online → sent once, the bar goes; a clash → "needs your
// choice" → Yours / Theirs → Save my choices; logout with changes → the warning and a second
// confirm; online-only buttons say "Needs internet"; going offline with the app open still
// loads screens from the phone (Session 13 fix).
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, test, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { routes } from '../routes.jsx';
import { makeQueryClient } from '../queryClient.js';
import { fakeApi, ok, fail, signInAs, signOut, PEOPLE } from '../test/helpers.js';
import { _resetForTests } from './db.js';
import { putRecords, setMeta, ensureUser, getRecord } from './cache.js';
import { allEntries, enqueue, flushOutbox, _resetOutboxForTests, refreshOutbox } from './outbox.js';
import { markOnline } from './state.js';

const T1 = '01JA7Q3M2K8V5R1T9W4X6Y0T01';
const row = (over = {}) => ({ id: T1, version: 3, title: 'Book tent wala', status: 'todo', priority: 'normal', dueDate: null, dueTime: null, notes: null, assignees: [], tags: [], items: [], postponeCount: 0, event: null, vendor: null, household: null, ...over });
const snake = (r) => ({ ...r, due_date: r.dueDate, due_time: r.dueTime, postpone_count: r.postponeCount });
let online = true;

function setOnline(v) {
  online = v;
  act(() => { window.dispatchEvent(new Event(v ? 'online' : 'offline')); });
}

function renderAt(path) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<QueryClientProvider client={makeQueryClient()}><RouterProvider router={router} /></QueryClientProvider>);
  return router;
}

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  _resetForTests();
  _resetOutboxForTests();
  online = true;
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
  signInAs('papa');
  await ensureUser(PEOPLE.papa.id);
  await putRecords('tasks', [row()]);
  await setMeta('lastSyncedAt', new Date(Date.now() - 60000).toISOString());
});
afterEach(() => { signOut(); act(() => markOnline()); onlineManager.setOnline(true); vi.restoreAllMocks(); });

const noNet = () => { throw new TypeError('Failed to fetch'); };

describe('Tick with no internet', () => {
  test('🕒 Waiting to send on the row, the bar counts it; back online it is sent once and the bar goes', async () => {
    const user = userEvent.setup();
    let reachable = false;
    const f = fakeApi({
      'GET /tasks': noNet,
      'GET /tags': noNet,
      [`POST /tasks/${T1}/done`]: () => (reachable ? ok(snake(row({ status: 'done', version: 4 }))) : noNet()),
    });
    setOnline(false);
    renderAt('/tasks?view=all');
    await user.click(await screen.findByRole('button', { name: /Book tent wala/ }));
    expect(await screen.findByText('1 change waiting to send.')).toBeInTheDocument();
    expect(screen.getByText('Will send when online')).toBeInTheDocument();
    expect(await screen.findByText(/Kept on this phone/)).toBeInTheDocument();
    expect((await getRecord('tasks', T1)).status).toBe('done');
    expect((await allEntries())).toHaveLength(1);

    reachable = true;
    setOnline(true);
    await flushOutbox({ force: true }); // what the "online" event does once the loop has started (3 s after load)
    await waitFor(async () => expect(await allEntries()).toEqual([]));
    await waitFor(() => expect(screen.queryByText('1 change waiting to send.')).toBeNull());
    const posts = f.mock.calls.filter(([u, i]) => i?.method === 'POST' && String(u).includes('/done'));
    expect(new Set(posts.map(([, i]) => i.headers['Idempotency-Key'])).size).toBe(1);
  });

  test('the row shows 🕒 Waiting to send while its change is on the phone', async () => {
    fakeApi({ 'GET /tasks': noNet, 'GET /tags': noNet, [`PATCH /tasks/${T1}`]: noNet });
    await enqueue('PATCH', `/tasks/${T1}`, { body: { title: 'Book tent wala' }, ifMatch: 3, label: 'x' });
    setOnline(false);
    renderAt('/tasks?view=all');
    expect(await screen.findByText('Waiting to send')).toBeInTheDocument();
  });
});

describe('Needs your choice', () => {
  test('a clash found when sending → the bar → Yours / Theirs → Save my choices sends my pick', async () => {
    const user = userEvent.setup();
    const theirs = snake(row({ version: 5, title: 'Tent (Mummy)' }));
    const f = fakeApi({
      'GET /tasks': noNet, 'GET /tags': noNet,
      [`PATCH /tasks/${T1}`]: (body, init) => (init.headers['If-Match'] === '"5"'
        ? ok(snake(row({ ...body, version: 6 })))
        : fail(409, { code: 'version_conflict', message: 'Changed.', current: theirs, current_version: 5, your_version: 3, changed_by: { id: 'u', name: 'Mummy' }, changed_at: '2026-10-08T09:10:00Z', changed_fields: ['title'] })),
    });
    await enqueue('PATCH', `/tasks/${T1}`, { body: { title: 'Tent (Papa)' }, ifMatch: 3, base: row(), label: 'Change task “Tent (Papa)”' });
    await flushOutbox({ force: true });
    renderAt('/settings/waiting');
    expect(await screen.findByText('Someone else changed this')).toBeInTheDocument();
    expect(screen.getByText(/Mummy changed it at/)).toBeInTheDocument();
    expect(screen.getByText('Tent (Papa)')).toBeInTheDocument();
    expect(screen.getByText('Tent (Mummy)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save my choices' }));
    await waitFor(async () => expect(await allEntries()).toEqual([]));
    const last = f.mock.calls.filter(([, i]) => i?.method === 'PATCH').at(-1)[1];
    expect(last.headers['If-Match']).toBe('"5"');
    expect(JSON.parse(last.body)).toEqual({ title: 'Tent (Papa)' });
    expect(await screen.findByText('Nothing waiting. Everything has been sent.')).toBeInTheDocument();
  });

  test('the bar says "1 change needs your choice." with Open', async () => {
    fakeApi({ 'GET /dashboard': noNet, [`PATCH /tasks/${T1}`]: () => fail(409, { code: 'record_deleted', message: 'Deleted.', deleted_by: { name: 'Ayush' }, deleted_at: '2026-10-08T09:10:00Z' }) });
    await enqueue('PATCH', `/tasks/${T1}`, { body: { title: 'x' }, ifMatch: 3 });
    await flushOutbox({ force: true });
    renderAt('/');
    expect(await screen.findByText('1 change needs your choice.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/settings/waiting');
  });

  test('Discard asks first, then the change is gone', async () => {
    const user = userEvent.setup();
    fakeApi({ [`PATCH /tasks/${T1}`]: noNet });
    await enqueue('PATCH', `/tasks/${T1}`, { body: { title: 'x' }, ifMatch: 3, label: 'Change task “x”' });
    setOnline(false);
    renderAt('/settings/waiting');
    await user.click(await screen.findByRole('button', { name: 'Discard' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Undo can’t bring it back.');
    await user.click(screen.getAllByRole('button', { name: 'Discard' }).at(-1));
    await waitFor(async () => expect(await allEntries()).toEqual([]));
  });
});

describe('Logout with changes waiting (PWA §5.5)', () => {
  test('"1 change hasn’t been sent." → Log out and lose them → a second confirm → logged out, nothing left', async () => {
    const user = userEvent.setup();
    fakeApi({ [`POST /tasks/${T1}/done`]: noNet, [`GET /members/${PEOPLE.papa.id}`]: noNet, 'GET /me/sessions': noNet, 'POST /auth/logout': () => ok({}) });
    await enqueue('POST', `/tasks/${T1}/done`, { body: {}, ifMatch: 3 });
    setOnline(false);
    renderAt('/settings/account');
    await user.click(await screen.findByRole('button', { name: 'Log out' }));
    expect(await screen.findByText('1 change hasn’t been sent.')).toBeInTheDocument();
    expect(screen.getByText('If you log out now, they are lost.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send now' })).toBeDisabled();
    expect(screen.getByText('Connect to the internet first.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Log out and lose them' }));
    expect(await screen.findByText('Lose the changes and log out?')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Log out and lose them' }).at(-1));
    await waitFor(async () => expect(await allEntries()).toEqual([]));
  });
});

describe('Settings › This phone', () => {
  test('shows how many changes wait, and changes left by another login', async () => {
    fakeApi({ [`POST /tasks/${T1}/done`]: noNet });
    await enqueue('POST', `/tasks/${T1}/done`, { body: {}, ifMatch: 3 });
    signInAs('mummy');
    await ensureUser(PEOPLE.mummy.id);
    await refreshOutbox();
    renderAt('/settings/phone');
    expect(await screen.findByText('1 changes from Papa’s login are on this phone. Papa must log in here to send them.')).toBeInTheDocument();
  });
});

describe('Online-only actions', () => {
  test('with no internet, Delete on a task stays visible but greyed out, with "Needs internet"', async () => {
    fakeApi({ [`GET /tasks/${T1}`]: noNet, 'GET /members': noNet });
    setOnline(false);
    renderAt(`/tasks/${T1}`);
    const del = await screen.findByRole('button', { name: 'Delete' });
    expect(del).toBeDisabled();
    expect(screen.getByText('Needs internet')).toBeInTheDocument();
  });
});

describe('Session 13 fix: going offline with the app open', () => {
  test('screens still load from the phone after the "offline" event (reads are not paused)', async () => {
    fakeApi({ 'GET /tasks': noNet, 'GET /tags': noNet });
    renderAt('/settings');
    setOnline(false);
    onlineManager.setOnline(false); // what the browser's "offline" event does to React Query
    const router = renderAt('/tasks?view=all');
    expect(await screen.findByText('Book tent wala')).toBeInTheDocument();
    expect(router).toBeTruthy();
  });
});
