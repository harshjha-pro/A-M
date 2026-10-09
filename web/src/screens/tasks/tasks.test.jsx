// Tasks screens: list (chips, tick, Viewer read-only), add (3 taps, duplicate), detail
// (checklist, "mark done too?", move date, delete with Undo, WhatsApp).
import { describe, test, expect, afterEach, vi } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from '../../test/axe.js';
import { routes } from '../../routes.jsx';
import { fakeApi, ok, fail, signInAs, signOut, PEOPLE } from '../../test/helpers.js';
import { dismiss } from '../../undo/undoStore.js';

const ayush = { id: PEOPLE.ayush.id, name: 'Ayush' };
const mummy = { id: PEOPLE.mummy.id, name: 'Mummy' };
const T1 = '01JA7Q3M2K8V5R1T9W4X6Y0T01';
const task = (over = {}) => ({
  id: T1, version: 3, title: 'Book tent wala', status: 'todo', priority: 'urgent', due_date: '2026-10-07', due_time: null,
  overdue: true, due_today: false, postpone_count: 1, event: null, vendor: null, household: null,
  assignees: [mummy], tags: [{ id: '01M4DK5T41SEEQHBHV1XDA0R7D', name: 'Shopping' }], item_count: 2, items_done: 1,
  completed_at: null, completed_by: null, created_by: ayush, updated_by: ayush, ...over,
});
const full = (over = {}) => ({ ...task(), notes: 'Ask for 2 quotes', items: [
  { key: '11111111-1111-4111-8111-111111111111', version: 1, text: 'Get quote', is_done: true, sort_order: 0, done_by: ayush, done_at: '2026-10-08T05:00:00Z' },
  { key: '22222222-2222-4222-8222-222222222222', version: 4, text: 'Pay advance', is_done: false, sort_order: 1, done_by: null, done_at: null },
], ...over });
const listReply = (rows, meta = {}) => new Response(JSON.stringify({ ok: true, data: rows, meta: {
  request_id: 'r_1', server_time: '2026-10-08T09:12:31Z', has_more: false, total: rows.length, view: 'all',
  chip_counts: { mine: 1, today: 0, week: 1, overdue: 1, no_date: 0 }, ...meta } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
const withMeta = (data, meta) => new Response(JSON.stringify({ ok: true, data, meta: { request_id: 'r', server_time: 'x', ...meta } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
const members = [{ id: PEOPLE.ayush.id, name: 'Ayush', phone: '+919829000101', role: 'owner', left: false }, { id: PEOPLE.mummy.id, name: 'Mummy', phone: '+919829000104', role: 'family', left: false }];

function renderAt(path) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>);
  return { router, ...utils };
}

afterEach(() => { act(() => dismiss()); signOut(); localStorage.clear(); });

describe('Task list', () => {
  test('chips show server counts; a tick marks done with If-Match and offers Undo', async () => {
    signInAs('ayush');
    const user = userEvent.setup();
    const calls = fakeApi({
      'GET /tasks': () => listReply([task()]),
      'GET /tags': () => ok([]),
      'POST /tasks/{id}/done': () => withMeta(full({ status: 'done', version: 4 }), { undo: { batch_id: 'B1', until: 'x', summary: 'Done: Book tent wala' } }),
    });
    const { container } = renderAt('/tasks');
    expect(await screen.findByText('Book tent wala')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^All\s*1$/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /^Overdue\s*1$/ })).toBeInTheDocument();
    expect(screen.getByText('Overdue', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText(/Wed, 7 Oct 2026/)).toBeInTheDocument();
    expect(screen.getByText(/☑ 1\/2/)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    await user.click(screen.getByRole('button', { name: 'Mark done: Book tent wala' }));
    expect(await screen.findByText('Done: Book tent wala')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    const [, init] = calls.mock.calls.find(([u, i]) => u.endsWith('/done') && i.method === 'POST');
    expect(init.headers['If-Match']).toBe('"3"');
    expect(init.headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
  });

  test('Family opens My tasks; the chip changes the view', async () => {
    signInAs('mummy');
    const user = userEvent.setup();
    const calls = fakeApi({ 'GET /tasks': () => listReply([], { view: 'mine' }), 'GET /tags': () => ok([]) });
    renderAt('/tasks');
    expect(await screen.findByText('Nothing for you today.')).toBeInTheDocument();
    expect(calls.mock.calls.find(([u]) => u.startsWith('/api/v1/tasks?'))[0]).toContain('view=mine');
    await user.click(screen.getByRole('radio', { name: /Today/ }));
    await vi.waitFor(() => expect(calls.mock.calls.some(([u]) => u.includes('view=today'))).toBe(true));
  });

  test('AC-TASK-08: a Viewer sees no + and no tick circles', async () => {
    signInAs('nani');
    fakeApi({ 'GET /tasks': () => listReply([task()]), 'GET /tags': () => ok([]) });
    renderAt('/tasks');
    expect(await screen.findByText('Book tent wala')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mark done/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add task' })).toBeNull();
    expect(screen.queryByRole('radio', { name: /My tasks/ })).toBeNull();
  });
});

describe('Add a task', () => {
  test('AC-TASK-01: + → type → Save sends only the title, once', async () => {
    signInAs('papa');
    const user = userEvent.setup();
    const calls = fakeApi({
      'GET /tasks': () => listReply([]), 'GET /tags': () => ok([]), 'GET /members': () => ok(members),
      'POST /tasks': (body) => ok(full({ title: body.title, version: 1, items: [] }), 201),
    });
    renderAt('/tasks');
    await user.click(await screen.findByRole('button', { name: 'Add task' }));
    await user.type(await screen.findByLabelText('What needs doing?'), 'Call tent wala');
    await user.click(screen.getByRole('button', { name: 'Save task' }));
    expect(await screen.findByText('Task added.')).toBeInTheDocument();
    const posts = calls.mock.calls.filter(([, i]) => i.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(JSON.parse(posts[0][1].body)).toEqual({ title: 'Call tent wala' });
  });

  test('empty title is caught on the phone; a similar task offers Open / Add anyway', async () => {
    signInAs('papa');
    const user = userEvent.setup();
    let n = 0;
    const calls = fakeApi({
      'GET /tasks': () => listReply([]), 'GET /tags': () => ok([]), 'GET /members': () => ok(members),
      'POST /tasks': (body) => (++n === 1
        ? fail(409, { code: 'duplicate_found', message: 'A similar task exists: Book tent wala', matches: [{ id: T1, name: 'Book tent wala' }] })
        : ok(full({ title: body.title, version: 1 }), 201)),
    });
    renderAt('/tasks/new');
    await user.click(await screen.findByRole('button', { name: 'Save task' }));
    expect(screen.getByText('Please type what needs doing.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('What needs doing?'), 'book tent wala');
    await user.click(screen.getByText('Tomorrow'));
    await user.click(screen.getByRole('button', { name: 'Save task' }));
    expect(await screen.findByText('A similar task exists: Book tent wala')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add anyway' }));
    expect(await screen.findByText('Task added.')).toBeInTheDocument();
    const last = JSON.parse(calls.mock.calls.filter(([, i]) => i.method === 'POST').at(-1)[1].body);
    expect(last).toMatchObject({ title: 'book tent wala', allow_duplicate: true });
    expect(last.due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('Task detail', () => {
  test('checklist tick uses the item version; the last tick asks to mark the task done', async () => {
    signInAs('mummy');
    const user = userEvent.setup();
    const calls = fakeApi({
      'GET /tasks/{id}': () => ok(full()), 'GET /members': () => ok(members),
      'PATCH /tasks/{id}/items/{key}': () => withMeta({ key: '22222222-2222-4222-8222-222222222222', version: 5, text: 'Pay advance', is_done: true, sort_order: 1, done_by: mummy, done_at: 'x' }, { last_item_done: true }),
      'POST /tasks/{id}/done': () => withMeta(full({ status: 'done', version: 4, completed_by: mummy, completed_at: '2026-10-08T09:12:31Z' }), { undo: { batch_id: 'B2', until: 'x', summary: 'Done: Book tent wala' } }),
      'GET /tasks': () => listReply([]),
    });
    const { container } = renderAt(`/tasks/${T1}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Book tent wala' })).toBeInTheDocument();
    expect(screen.getByText('Moved 1×')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByLabelText('Pay advance'));
    const [, init] = calls.mock.calls.find(([u, i]) => i.method === 'PATCH');
    expect(init.headers['If-Match']).toBe('"4"');
    expect(JSON.parse(init.body)).toEqual({ is_done: true });
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('All items are ticked. Mark the task done too?')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Yes, mark done' }));
    expect(await screen.findByText(/Done by Mummy/)).toBeInTheDocument();
  });

  test('Move date → Tomorrow sends the new date; WhatsApp link to the assignee', async () => {
    signInAs('ayush');
    const user = userEvent.setup();
    const calls = fakeApi({
      'GET /tasks/{id}': () => ok(full()), 'GET /members': () => ok(members),
      'PATCH /tasks/{id}': (body) => ok(full({ ...body, version: 4, postpone_count: 2 })),
      'GET /tasks': () => listReply([]),
    });
    renderAt(`/tasks/${T1}`);
    const wa = await screen.findByRole('link', { name: 'Send to Mummy on WhatsApp' });
    expect(wa.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/919829000104\?text=/);
    expect(decodeURIComponent(wa.getAttribute('href'))).toContain('Book tent wala — due Wed, 7 Oct 2026. Please update it in the wedding app.');
    await user.click(screen.getByRole('button', { name: 'Move date' }));
    const sheet = screen.getByRole('dialog', { name: 'Move date' });
    await user.click(within(sheet).getByRole('button', { name: /Tomorrow/ }));
    expect(await screen.findByText('Moved 2×')).toBeInTheDocument();
    const [, init] = calls.mock.calls.find(([, i]) => i.method === 'PATCH');
    expect(Object.keys(JSON.parse(init.body))).toEqual(['due_date']);
    expect(init.headers['If-Match']).toBe('"3"');
  });

  test('Delete goes back to the list with Undo', async () => {
    signInAs('ayush');
    const user = userEvent.setup();
    fakeApi({
      'GET /tasks/{id}': () => ok(full()), 'GET /members': () => ok(members), 'GET /tags': () => ok([]),
      'DELETE /tasks/{id}': () => withMeta({}, { undo: { batch_id: 'B3', until: 'x', summary: 'Deleted Book tent wala' } }),
      'GET /tasks': () => listReply([]),
    });
    const { router } = renderAt(`/tasks/${T1}`);
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Deleted Book tent wala')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/tasks');
  });
});
