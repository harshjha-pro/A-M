// Workspace step A + Attachment Vault (1.0.17): Workspace tab for Ayush and Mahi (Guests and
// the Vault move into More), workspace cards, the tasks strip with Add task, Files with
// Add attachment (used there at once), the Vault (filters, storage, where it is used,
// editable unique ID checked while typing, remove from one place), files sent in 2 MB pieces.
import { describe, test, expect, afterEach, vi } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from '../../test/axe.js';
import { routes } from '../../routes.jsx';
import { fakeApi, ok, signInAs, signOut } from '../../test/helpers.js';
import { dismiss } from '../../undo/undoStore.js';
import { sendFile } from '../../data/vault.js';

const MEHNDI = '01JC0WS0000000000000000002';
const A1 = '01JC0VA0000000000000000001';
const ws = (over = {}) => ({ id: MEHNDI, version: 1, name: 'Mehndi', sort_order: 20, notes: null, event: { id: '01M4DK5T3E6QZBMNQ0V7KQWW23', name: 'Mehndi', start_at: '2027-02-14T10:30:00Z' }, counts: { tasks_open: 2, attachments: 1 }, ...over });
const task = (id, title, over = {}) => ({ id, version: 1, title, status: 'todo', priority: 'normal', due_date: '2026-12-01', due_time: null, overdue: false, due_today: false,
  postpone_count: 0, assignees: [], tags: [], item_count: 0, items_done: 0, event: null, workspace: { id: MEHNDI, name: 'Mehndi' }, workspace_section: null, ...over });
const att = (over = {}) => ({ id: A1, version: 1, code: 'MEHNDI-DECOR-01', kind: 'link', title: 'Mehndi decor idea', note: null, url: 'https://example.com/decor', body: null,
  is_favourite: true, vendor: null, task: null, file: null, file_url: null, document: null,
  used_in: [{ kind: 'link', link_id: '01JC0VN0000000000000000001', link_version: 1, workspace_id: MEHNDI, section: 'general', path: 'Mehndi › Files', to: `/workspaces/${MEHNDI}#general` }], ...over });
const withUndo = (data, summary) => new Response(JSON.stringify({ ok: true, data, meta: { request_id: 'r', server_time: 'x', undo: { batch_id: 'B7', until: 'x', summary } } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
const page = (data, meta = {}) => new Response(JSON.stringify({ ok: true, data, meta: { has_more: false, next_cursor: null, storage: { database_bytes: 52428800, vault_bytes: 1000, limit_bytes: 3221225472, warn: false }, ...meta } }), { status: 200, headers: { 'Content-Type': 'application/json' } });

function renderAt(path) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>);
  return { router, ...utils };
}

afterEach(() => { act(() => dismiss()); signOut(); vi.restoreAllMocks(); });

describe('Navigation', () => {
  test('Ayush: Workspace in the bottom bar; Guests and the Vault in More', async () => {
    signInAs('ayush');
    fakeApi({});
    renderAt('/more');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: /Workspace/ })).toHaveAttribute('href', '/workspaces');
    expect(within(nav).queryByRole('link', { name: /Guests/ })).toBeNull();
    expect(await screen.findByRole('link', { name: /Guests/ })).toHaveAttribute('href', '/guests');
    expect(screen.getByRole('link', { name: /Attachment Vault/ })).toHaveAttribute('href', '/vault');
  });

  test('1.0.21: Papa (Family) and Nani (view only) get Workspace too; Guests and the Vault in More', async () => {
    for (const who of ['papa', 'nani']) {
      signInAs(who);
      fakeApi({});
      const { unmount } = renderAt('/more');
      const nav = screen.getByRole('navigation', { name: 'Main' });
      expect(within(nav).getByRole('link', { name: /Workspace/ })).toHaveAttribute('href', '/workspaces');
      expect(within(nav).queryByRole('link', { name: /Guests/ })).toBeNull();
      expect(screen.getByRole('link', { name: /Guests/ })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Attachment Vault/ })).toBeInTheDocument();
      unmount();
    }
  });
});

describe('Workspaces', () => {
  test('cards with calendar date, open tasks and attachments; + adds one', async () => {
    signInAs('mahi');
    const user = userEvent.setup();
    const calls = fakeApi({
      'GET /workspaces': () => ok([ws(), ws({ id: '01JC0WS0000000000000000003', name: 'Carnival', event: null, counts: { tasks_open: 1, attachments: 0 } })]),
      'GET /events': () => ok([{ id: '01M4DK5T3E6QZBMNQ0V7KQWW23', name: 'Mehndi' }]),
      'POST /workspaces': (body) => ok(ws({ id: '01JC0WS0000000000000000009', name: body.name, event: null }), 201),
    });
    const { container } = renderAt('/workspaces');
    const mehndi = await screen.findByRole('link', { name: /Mehndi/ });
    expect(mehndi).toHaveAttribute('href', `/workspaces/${MEHNDI}`);
    expect(mehndi).toHaveTextContent('2 open tasks · 1 attachments');
    expect(screen.getByRole('link', { name: /Carnival/ })).toHaveTextContent('1 open task');
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole('button', { name: 'Add workspace' }));
    await user.type(within(screen.getByRole('dialog')).getByLabelText('Name'), 'Haldi');
    await user.click(screen.getByRole('button', { name: 'Save workspace' }));
    await vi.waitFor(() => expect(calls.mock.calls.some(([, i]) => i?.method === 'POST')).toBe(true));
    expect(JSON.parse(calls.mock.calls.find(([, i]) => i?.method === 'POST')[1].body)).toEqual({ name: 'Haldi', event_id: null });
  });

  test('a workspace: calendar link, tasks strip with Add task, Files with Add attachment used here at once', async () => {
    signInAs('ayush');
    const user = userEvent.setup();
    const calls = fakeApi({
      'GET /workspaces/{id}': () => ok({ ...ws(), tasks: [task('01JA7Q3M2K8V5R1T9W4X6Y0T01', 'Book mehndi artist', { overdue: true, workspace_section: 'bride_outfit' }), task('01JA7Q3M2K8V5R1T9W4X6Y0T02', 'Cones', { status: 'done' })], sections: {} }),
      'GET /attachments': () => page([att()]),
      'GET /vendors': () => ok([]),
      'POST /attachments': (body) => ok(att({ id: '01JC0VA0000000000000000002', code: 'ATT-000003', title: body.title, kind: 'link' }), 201),
    });
    const { container } = renderAt(`/workspaces/${MEHNDI}`);
    expect(await screen.findByRole('link', { name: /On the calendar: Mehndi/ })).toBeInTheDocument();
    const strip = screen.getByRole('list', { name: 'Tasks' });
    expect(within(strip).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/tasks/01JA7Q3M2K8V5R1T9W4X6Y0T01', '/tasks/01JA7Q3M2K8V5R1T9W4X6Y0T02']);
    expect(within(strip).getByText(/Bride outfit/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add task' })).toHaveAttribute('href', `/tasks/new?workspace=${MEHNDI}`);
    expect(await screen.findByText('Mehndi decor idea')).toBeInTheDocument();
    const fileCall = calls.mock.calls.find(([u]) => u.startsWith('/api/v1/attachments'))[0];
    expect(fileCall).toContain(`workspace=${MEHNDI}`);
    expect(fileCall).toContain('section=general');
    for (const later of ['Bride outfit', 'Groom outfit', 'Menu', 'Event timeline']) expect(screen.getByRole('heading', { name: later })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    await user.click(within(screen.getByRole('region', { name: 'Files' })).getByRole('button', { name: 'Add attachment' }));
    const sheet = screen.getByRole('dialog');
    await user.click(within(sheet).getByRole('radio', { name: 'Link' }));
    await user.type(within(sheet).getByLabelText('Link (https://…)'), 'https://example.com/haath');
    await user.type(within(sheet).getByLabelText('Title'), 'Haath design');
    await user.click(within(sheet).getByRole('button', { name: 'Save attachment' }));
    await vi.waitFor(() => expect(calls.mock.calls.some(([, i]) => i?.method === 'POST')).toBe(true));
    expect(JSON.parse(calls.mock.calls.find(([, i]) => i?.method === 'POST')[1].body)).toEqual({ kind: 'link', title: 'Haath design', note: null, url: 'https://example.com/haath', workspace_id: MEHNDI, section: 'general' });
  });

  test('1.0.21: Family opens a workspace', async () => {
    signInAs('papa');
    fakeApi({ [`GET /workspaces/${MEHNDI}`]: () => ok(ws({ tasks: [], sections: {} })), 'GET /attachments': () => ok([]) });
    renderAt(`/workspaces/${MEHNDI}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Mehndi' })).toBeInTheDocument();
  });

  test('the database update message from the server is shown as it is', async () => {
    signInAs('mahi');
    const msg = 'The database needs an update before this works: import migrations 005 to 008 in phpMyAdmin, in order. Nothing was saved.';
    fakeApi({ 'GET /workspaces': () => new Response(JSON.stringify({ ok: false, error: { code: 'db_update_needed', message: msg }, meta: {} }), { status: 503, headers: { 'Content-Type': 'application/json' } }) });
    renderAt('/workspaces');
    expect(await screen.findByText(msg)).toBeInTheDocument();
  });
});

describe('Many files and the Vault (1.0.24)', () => {
  const pdf = (name) => new File([`%PDF ${name}`], name, { type: 'application/pdf' });

  test('pick two files → a queue; one fails and keeps Retry with the same request key; the other is saved', async () => {
    signInAs('ayush');
    const user = userEvent.setup();
    let creates = 0;
    const calls = fakeApi({
      'GET /workspaces/{id}': () => ok({ ...ws(), tasks: [], sections: {} }),
      'GET /attachments': () => page([]),
      'GET /vendors': () => ok([]),
      'POST /attachment-uploads': () => ok({ upload_id: 'U9', complete: true, chunk_size: 2097152, chunk_count: 1, received: [0] }, 201),
      'POST /attachments': (body) => {
        creates += 1;
        if (body.title === 'quote-b' && creates === 2) return new Response(JSON.stringify({ ok: false, error: { code: 'server_error', message: 'Something went wrong.' }, meta: {} }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        return ok(att({ title: body.title }), 201);
      },
    });
    renderAt(`/workspaces/${MEHNDI}`);
    const files = await screen.findByRole('region', { name: 'Files' });
    await user.click(await within(files).findByRole('button', { name: 'Add attachment' }));
    const sheet = screen.getByRole('dialog');
    await user.click(within(sheet).getByRole('radio', { name: 'Document' }));
    await user.upload(within(sheet).getByTestId('vault-file'), [pdf('quote-a.pdf'), pdf('quote-b.pdf')]);
    const queue = within(sheet).getByRole('list', { name: '2 files to add' });
    expect(within(queue).getByText('quote-a.pdf')).toBeInTheDocument();
    expect(within(sheet).queryByLabelText('Title')).not.toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: 'Add 2 files' }));
    expect(await within(queue).findByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(within(queue).getByLabelText('Added')).toBeInTheDocument();
    const posts = () => calls.mock.calls.filter(([u, i]) => u === '/api/v1/attachments' && i?.method === 'POST');
    expect(JSON.parse(posts()[0][1].body)).toMatchObject({ kind: 'document', upload_id: 'U9', title: 'quote-a', workspace_id: MEHNDI, section: 'general' });
    const firstKey = posts()[1][1].headers['Idempotency-Key'];

    await user.click(within(queue).getByRole('button', { name: 'Try again: quote-b.pdf' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(posts()).toHaveLength(3);
    expect(posts()[2][1].headers['Idempotency-Key']).toBe(firstKey);
  });

  test('From Vault: tick two → one request with one Undo; Select → Remove from here', async () => {
    signInAs('ayush');
    const user = userEvent.setup();
    const A2 = '01JC0VA0000000000000000002';
    const A3 = '01JC0VA0000000000000000003';
    const calls = fakeApi({
      'GET /workspaces/{id}': () => ok({ ...ws(), tasks: [], sections: {} }),
      'GET /attachments': (_b, _i, url) => page(url.includes('workspace=') ? [att()] : [att(), att({ id: A2, title: 'Stage photo', used_in: [] }), att({ id: A3, title: 'Cone design', used_in: [] })]),
      'POST /attachment-links/bulk': (body) => withUndo({ affected: body.ids.length, skipped: [], batch_id: 'B7' }, body.action === 'add' ? 'Added 2 files to Mehndi › Files' : 'Removed 1 file from Mehndi › Files'),
    });
    renderAt(`/workspaces/${MEHNDI}`);
    const files = await screen.findByRole('region', { name: 'Files' });
    expect(await within(files).findByText('Mehndi decor idea')).toBeInTheDocument();
    await user.click(within(files).getByRole('button', { name: 'From Vault' }));
    const sheet = await screen.findByRole('dialog', { name: 'Pick from the Vault' });
    await user.click(within(sheet).getByRole('checkbox', { name: 'Select Stage photo' }));
    await user.click(within(sheet).getByRole('checkbox', { name: 'Select Cone design' }));
    await user.click(within(sheet).getByRole('button', { name: 'Use 2 here' }));
    expect(await screen.findByText('Added 2 files to Mehndi › Files')).toBeInTheDocument();
    const bulk = () => calls.mock.calls.filter(([u]) => u === '/api/v1/attachment-links/bulk');
    expect(JSON.parse(bulk()[0][1].body)).toEqual({ action: 'add', ids: [A2, A3], workspace_id: MEHNDI, section: 'general' });

    await user.click(within(files).getByRole('button', { name: 'Select' }));
    await user.click(within(files).getByRole('checkbox', { name: 'Select Mehndi decor idea' }));
    await user.click(within(files).getByRole('button', { name: 'Remove from here' }));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('They stay in the Vault');
    await user.click(within(confirm).getByRole('button', { name: 'Remove from here' }));
    await vi.waitFor(() => expect(bulk()).toHaveLength(2));
    expect(JSON.parse(bulk()[1][1].body)).toEqual({ action: 'remove', ids: [A1], workspace_id: MEHNDI, section: 'general' });
  });
});

describe('Storage health (1.0.24)', () => {
  test('near the limit: a warning with what to do, on the Vault and in Settings', async () => {
    signInAs('ayush');
    fakeApi({ 'GET /attachments': () => page([], { server_time: '2026-10-08T09:12:31Z', storage: { database_bytes: 2800000000, vault_bytes: 2500000000, limit_bytes: 3221225472, warn: true } }), 'GET /workspaces': () => ok([]) });
    renderAt('/vault');
    expect(await screen.findByRole('alert')).toHaveTextContent('nearly full');
    expect(screen.getByRole('meter', { name: 'Storage' })).toHaveAttribute('aria-valuenow', '87');
    expect(screen.getByText(/checked/)).toBeInTheDocument();
  });
});

describe('Attachment Vault', () => {
  test('list with where it is used, storage, and filters as query', async () => {
    signInAs('ayush');
    const user = userEvent.setup();
    const calls = fakeApi({ 'GET /attachments': () => page([att()]), 'GET /workspaces': () => ok([ws()]) });
    const { container } = renderAt('/vault');
    const row = await screen.findByRole('link', { name: /Mehndi decor idea/ });
    expect(row).toHaveAttribute('href', `/vault/${A1}`);
    expect(row).toHaveTextContent('MEHNDI-DECOR-01');
    expect(row).toHaveTextContent('Mehndi › Files');
    expect(screen.getByText('Database 50 MB of 3 GB')).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Storage' })).toHaveAttribute('aria-valuenow', '2');
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole('radio', { name: 'Video' }));
    await user.click(screen.getByRole('radio', { name: /Favourites/ }));
    await user.selectOptions(screen.getByLabelText('Workspace'), MEHNDI);
    await vi.waitFor(() => {
      const last = calls.mock.calls.filter(([u]) => u.startsWith('/api/v1/attachments')).at(-1)[0];
      expect(last).toContain('kind=video');
      expect(last).toContain('favourite=1');
      expect(last).toContain(`workspace=${MEHNDI}`);
    });
  });

  test('an attachment: the ID is checked while typing; where it is used; remove from one place with Undo', async () => {
    signInAs('mahi');
    const user = userEvent.setup();
    const calls = fakeApi({
      [`GET /attachments/${A1}`]: () => ok(att()),
      'GET /attachments/check-code': () => ok({ available: false, message: "ID TENT-1 is already used by 'Tent photo' (Reception › Files)." }),
      'GET /workspaces': () => ok([ws()]), 'GET /vendors': () => ok([]),
      'GET /attachments/{id}/history': () => page([]),
      'DELETE /attachment-links/{id}': () => new Response(JSON.stringify({ ok: true, data: {}, meta: { undo: { batch_id: 'B1', until: 'x', summary: 'Deleted Link to Files' } } }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    });
    renderAt(`/vault/${A1}`);
    expect(await screen.findByRole('link', { name: 'Mehndi › Files' })).toHaveAttribute('href', `/workspaces/${MEHNDI}#general`);
    const id = screen.getByLabelText('ID');
    await user.clear(id);
    await user.type(id, 'TENT-1');
    expect(await screen.findByText("ID TENT-1 is already used by 'Tent photo' (Reception › Files).")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove from Mehndi › Files' }));
    expect(await screen.findByText('Deleted Link to Files')).toBeInTheDocument();
    const del = calls.mock.calls.find(([, i]) => i?.method === 'DELETE');
    expect(del[0]).toBe('/api/v1/attachment-links/01JC0VN0000000000000000001');
    expect(del[1].headers['If-Match']).toBe('"1"');
  });
});

describe('Sending a file', () => {
  test('a 5 MB video goes in 3 pieces (2 MB each, the last smaller), then finish', async () => {
    signInAs('ayush');
    const sent = [];
    fakeApi({
      'POST /attachment-uploads': (body) => ok({ upload_id: 'U1', complete: false, chunk_size: 2097152, chunk_count: Math.ceil(body.size_bytes / 2097152), received: [], mime_type: body.mime_type, size_bytes: body.size_bytes }, 201),
      'POST /attachment-uploads/U1/chunks': (form) => { sent.push([form.get('seq'), form.get('chunk').size]); return ok({ upload_id: 'U1', complete: false, received: [] }); },
      'POST /attachment-uploads/U1/finish': () => ok({ upload_id: 'U1', complete: true }),
    });
    const file = new File([new Uint8Array(5 * 1024 * 1024)], 'trial.mp4', { type: 'video/mp4' });
    const progress = [];
    const out = await sendFile(file, { onProgress: (p) => progress.push(p) });
    expect(out).toEqual({ uploadId: 'U1', kind: 'video', name: 'trial.mp4' });
    expect(sent).toEqual([['0', 2097152], ['1', 2097152], ['2', 5 * 1024 * 1024 - 2 * 2097152]]);
    expect(progress.at(-1)).toBe(1);
  });

  test('a file already in the Vault is not sent again', async () => {
    signInAs('ayush');
    const calls = fakeApi({ 'POST /attachment-uploads': () => ok({ upload_id: 'U2', complete: true, chunk_size: 2097152, chunk_count: 1, received: [0] }) });
    const out = await sendFile(new File(['%PDF-1.4'], 'menu.pdf', { type: 'application/pdf' }));
    expect(out.uploadId).toBe('U2');
    expect(calls.mock.calls.filter(([u]) => String(u).includes('/chunks'))).toEqual([]);
  });
});
