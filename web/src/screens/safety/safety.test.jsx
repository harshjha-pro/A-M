// Safety, Deleted items, Activity, History, the Undo snackbar and the member conflict screen.
import { describe, test, expect, afterEach, vi } from 'vitest';
import { render, screen, within, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from '../../test/axe.js';
import { routes } from '../../routes.jsx';
import { fakeApi, ok, fail, signInAs, signOut, PEOPLE } from '../../test/helpers.js';
import { showUndo, dismiss } from '../../undo/undoStore.js';
import { SNACK_MS } from '../../components/UndoSnackbar.jsx';

const ayush = { id: PEOPLE.ayush.id, name: 'Ayush' };
const drill = { id: '01JA7Q3M2K8V5R1T9W4X6Y0Z2B', version: 1, done_on: '2026-10-02', result: 'passed', backup_file: 'am.sql.gz', notes: 'All tables matched', done_by: ayush };
const health = {
  status: 'amber', checked_at: '2026-10-08T09:12:31Z', app_version: '1.0.3',
  checks: {
    database: { status: 'green' }, storage: { status: 'green', used_pct: 2.4 },
    backup: { status: 'red', last_ok_at: null, reason: 'no_backup_yet' },
    audit_log: { status: 'not_in_use' }, restore_drill: { status: 'green', last_passed_on: '2026-10-02' }, reminders: { status: 'not_in_use' },
  },
  trash_batches: 0,
};

function renderAt(path) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>);
  return { router, ...utils };
}

afterEach(() => { act(() => dismiss()); signOut(); vi.useRealTimers(); });

describe('Settings list', () => {
  test('admins see Safety, Activity and Deleted items; family do not', async () => {
    signInAs('mahi');
    fakeApi({});
    const { unmount } = renderAt('/settings');
    for (const name of ['Safety', 'Activity', 'Deleted items']) expect(await screen.findByRole('link', { name })).toBeInTheDocument();
    unmount();
    signInAs('papa');
    renderAt('/settings');
    await screen.findByRole('link', { name: 'Members' });
    expect(screen.queryByRole('link', { name: 'Safety' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Deleted items' })).toBeNull();
  });
});

describe('Safety', () => {
  test('shows checks, a red backup line, and logs a drill', async () => {
    signInAs('ayush');
    const user = userEvent.setup();
    const calls = fakeApi({
      'GET /health': () => ok(health),
      'GET /backups': () => ok([]),
      'GET /restore-drills': () => ok([drill]),
      'POST /restore-drills': (body) => ok({ ...drill, ...body, id: '01JA7Q3M2K8V5R1T9W4X6Y0Z2C' }, 201),
    });
    const { container } = renderAt('/settings/safety');
    expect(await screen.findByText('Backup: Problem')).toBeInTheDocument();
    expect(screen.getByText('No backup has run yet.', { exact: false })).toBeInTheDocument();
    expect(await screen.findByText('All tables matched')).toBeInTheDocument();
    expect(screen.getByText('Passed · by Ayush')).toBeInTheDocument();
    await user.click(screen.getByText('Failed', { selector: 'span' }));
    await user.type(screen.getByLabelText('Notes (optional)'), 'Drive file empty');
    await user.click(screen.getByRole('button', { name: 'Save drill' }));
    const [, init] = await vi.waitFor(() => {
      const c = calls.mock.calls.find(([u, i]) => u === '/api/v1/restore-drills' && i.method === 'POST');
      if (!c) throw new Error('not yet');
      return c;
    });
    expect(JSON.parse(init.body)).toMatchObject({ result: 'failed', notes: 'Drive file empty', backup_file: null });
    expect(init.body).toMatch(/"done_on":"\d{4}-\d{2}-\d{2}"/);
    expect(await axe(container)).toHaveNoViolations();
  });

  test('deleting a drill shows the Undo snackbar; Undo calls the server once', async () => {
    signInAs('ayush');
    const user = userEvent.setup();
    let list = [drill];
    const calls = fakeApi({
      'GET /health': () => ok(health),
      'GET /backups': () => ok([]),
      'GET /restore-drills': () => ok(list),
      'DELETE /restore-drills/{id}': () => { list = []; return new Response(JSON.stringify({ ok: true, data: {}, meta: { undo: { batch_id: '01JA7Q3M2K8V5R1T9W4X6Y0Z9Z', until: '2026-10-08T09:22:31Z', summary: 'Deleted Restore drill · 2 Oct 2026' } } }), { status: 200, headers: { 'Content-Type': 'application/json' } }); },
      'POST /undo/{batch}': () => { list = [drill]; return ok({ batch_id: '01JA7Q3M2K8V5R1T9W4X6Y0Z9Z', undone: 1, skipped: [], message: 'Undone.', already_undone: false }); },
    });
    renderAt('/settings/safety');
    await user.click(await screen.findByRole('button', { name: 'Delete: Fri, 2 Oct 2026' }));
    expect(await screen.findByText('Deleted Restore drill · 2 Oct 2026')).toBeInTheDocument();
    const [, del] = calls.mock.calls.find(([, i]) => i.method === 'DELETE');
    expect(del.headers['If-Match']).toBe('"1"');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByText('Undone.')).toBeInTheDocument();
    expect(calls.mock.calls.filter(([u]) => u.startsWith('/api/v1/undo/'))).toHaveLength(1);
    expect(await screen.findByText('All tables matched')).toBeInTheDocument();
  });
});

describe('Undo snackbar', () => {
  test('AC-UND-03: closes after 8 s, but not while a finger is on it', async () => {
    signInAs('ayush');
    fakeApi({ 'GET /health': () => ok({ status: 'ok' }) });
    renderAt('/more');
    await screen.findByRole('heading', { name: 'More' });
    vi.useFakeTimers();
    act(() => showUndo({ batchId: 'B1', summary: 'Deleted Book tent wala' }));
    const bar = screen.getByText('Deleted Book tent wala').closest('[role="status"]');
    fireEvent.pointerDown(bar);
    act(() => vi.advanceTimersByTime(20000));
    expect(screen.getByText('Deleted Book tent wala')).toBeInTheDocument();
    fireEvent.pointerUp(bar);
    act(() => vi.advanceTimersByTime(SNACK_MS - 100));
    expect(screen.getByText('Deleted Book tent wala')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByText('Deleted Book tent wala')).toBeNull();
  });

  test('too late: the server sentence is shown', async () => {
    signInAs('ayush');
    const user = userEvent.setup();
    fakeApi({ 'POST /undo/{b}': () => fail(403, { code: 'undo_expired', message: 'Too late to undo here. Ask Ayush or Mahi to restore it from Deleted items.' }) });
    renderAt('/more');
    await screen.findByRole('heading', { name: 'More' });
    act(() => showUndo({ batchId: 'B2', summary: 'Deleted x' }));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByText(/Too late to undo here/)).toBeInTheDocument();
  });
});

describe('Deleted items', () => {
  test('lists batches and restores one', async () => {
    signInAs('mahi');
    const user = userEvent.setup();
    let rows = [{ batch_id: '01JA7Q3M2K8V5R1T9W4X6Y0Z9Z', action: 'delete', entity_type: 'restore_drill', summary: 'Restore drill · 2 Oct 2026', item_count: 1, user: ayush, deleted_at: '2026-10-08T05:12:00Z', restorable: true }];
    const calls = fakeApi({
      'GET /trash': () => ok(rows),
      'POST /trash/{b}/restore': () => { rows = []; return ok({ restored: 1, blocked: [], warnings: [], already_restored: false, message: 'Restored.' }); },
    });
    const { container } = renderAt('/settings/deleted');
    expect(await screen.findByText('Restore drill · 2 Oct 2026')).toBeInTheDocument();
    expect(screen.getByText('Deleted by Ayush · Thu, 8 Oct 2026, 10:42 AM IST')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole('button', { name: 'Restore: Restore drill · 2 Oct 2026' }));
    expect(await screen.findByText('Restored.')).toBeInTheDocument();
    expect(await screen.findByText(/Nothing deleted/)).toBeInTheDocument();
    const [, init] = calls.mock.calls.find(([u]) => u.includes('/restore'));
    expect(init.headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('Activity and History', () => {
  const line = (sentence, at = '2026-10-08T05:12:00Z') => ({ at, action: 'update', user: ayush, device: 'Android · browser', entity: { type: 'settings', id: null, name: 'Wedding details' }, sentence, changes: [] });

  test('activity pages with Show older and filters by person', async () => {
    signInAs('ayush');
    const user = userEvent.setup();
    const calls = fakeApi({
      'GET /members': () => ok([{ id: PEOPLE.mahi.id, name: 'Mahi', phone: '+919829000102', role: 'partner', left: false }]),
      'GET /activity': (b, init) => ok([]),
    });
    calls.mockImplementation(async (url) => {
      const u = new URL(String(url), 'https://x');
      if (u.pathname.endsWith('/members')) return ok([{ id: PEOPLE.mahi.id, name: 'Mahi', phone: '+919829000102', role: 'partner', left: false }]);
      if (u.searchParams.get('cursor') === 'c2') return ok([line('Ayush added Restore drill · 2 Oct 2026.')]);
      const data = [line('Mahi changed City from Bhilwara to Udaipur.')];
      return new Response(JSON.stringify({ ok: true, data: [{ ...data[0], user: { id: PEOPLE.mahi.id, name: 'Mahi' } }], meta: { has_more: !u.searchParams.get('user'), next_cursor: 'c2' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    renderAt('/settings/activity');
    expect(await screen.findByText('Mahi changed City from Bhilwara to Udaipur.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show older' }));
    expect(await screen.findByText('Ayush added Restore drill · 2 Oct 2026.')).toBeInTheDocument();
    await user.selectOptions(await screen.findByLabelText('Person'), 'Mahi');
    await vi.waitFor(() => expect(calls.mock.calls.some(([u]) => String(u).includes(`user=${PEOPLE.mahi.id}`))).toBe(true));
  });

  test('wedding details history', async () => {
    signInAs('ayush');
    fakeApi({ 'GET /settings/history': () => ok([line('Ayush changed City from Bhilwara to Udaipur.')]) });
    renderAt('/settings/wedding/history');
    expect(await screen.findByText('Ayush changed City from Bhilwara to Udaipur.')).toBeInTheDocument();
    expect(screen.getByText('Thu, 8 Oct 2026, 10:42 AM IST · Android · browser')).toBeInTheDocument();
  });
});

describe('Member conflict', () => {
  test('role changed by both → conflict screen with plain values', async () => {
    signInAs('ayush');
    const user = userEvent.setup();
    const papa = { id: PEOPLE.papa.id, version: 2, name: 'Papa', phone: '+919829000103', role: 'family', can_see_money: true, is_active: true, access_ends_on: null, left: false };
    fakeApi({
      'GET /members/{id}': () => ok(papa),
      'PATCH /members/{id}': () => fail(409, { code: 'version_conflict', message: 'x', current_version: 3, your_version: 2, changed_by: { id: PEOPLE.mahi.id, name: 'Mahi' },
        changed_fields: ['role'], current: { ...papa, version: 3, role: 'viewer' } }),
    });
    renderAt(`/settings/members/${PEOPLE.papa.id}`);
    await user.click(await screen.findByText('Partner', { selector: 'span' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    const group = await screen.findByRole('group', { name: 'Role' });
    expect(within(group).getByText('Partner')).toBeInTheDocument();
    expect(within(group).getByText('Viewer')).toBeInTheDocument();
  });
});

describe('Log out with drafts', () => {
  test('"You have 2 unsaved drafts. Log out anyway?"', async () => {
    localStorage.clear();
    signInAs('ayush');
    const user = userEvent.setup();
    localStorage.setItem(`draft:${PEOPLE.ayush.id}:settings:new`, JSON.stringify({ savedAt: Date.now(), values: { city: 'x' } }));
    localStorage.setItem(`draft:${PEOPLE.ayush.id}:member:${PEOPLE.papa.id}`, JSON.stringify({ savedAt: Date.now(), values: { name: 'y' } }));
    fakeApi({ 'GET /me/sessions': () => ok([]) });
    renderAt('/settings/account');
    await user.click(await screen.findByRole('button', { name: 'Log out' }));
    expect(within(screen.getByRole('alertdialog')).getByText(/You have 2 unsaved drafts\. Log out anyway\?/)).toBeInTheDocument();
    localStorage.clear();
  });
});

describe('Home server line (bug found in Session 3)', () => {
  test('an admin whose checks are amber still sees Connected (Home now reads /dashboard)', async () => {
    signInAs('ayush');
    fakeApi({ 'GET /dashboard': () => ok({ countdown: { days_to_wedding: 129, next_event: null }, headcount: [], safety: { status: 'amber', checks: health.checks, trash_batches: 0 } }) });
    renderAt('/');
    expect(await screen.findByText(/^Connected · Updated/)).toBeInTheDocument();
  });
});
