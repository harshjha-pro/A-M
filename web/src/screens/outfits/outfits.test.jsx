// Outfits (1.0.18, Workspace step B): outfit cards on the workspace; the outfit page with the
// timeline (tap a step → done + date), moodboard grid, accessories, notes and tasks.
import { describe, test, expect, afterEach, vi } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from '../../test/axe.js';
import { routes } from '../../routes.jsx';
import { fakeApi, ok, signInAs, signOut } from '../../test/helpers.js';
import { dismiss } from '../../undo/undoStore.js';
import { todayIst } from '../../format/ist.js';

const WS = '01JC0WS0000000000000000002';
const O = '01JD0OF0000000000000000001';
const step = (n, name, done_on = null) => ({ id: `01JD0ST000000000000000000${n}`, version: 1, name, sort_order: n * 10, done_on, done: Boolean(done_on), notes: [], attachments: [], tasks: [] });
const att = { id: '01JC0VA0000000000000000009', version: 1, code: 'LEHENGA-01', kind: 'link', title: 'Lehenga idea', is_favourite: true, url: 'https://example.com', file: null, file_url: null, used_in: [] };
const outfit = (over = {}) => ({
  id: O, version: 1, workspace: { id: WS, name: 'Mehndi' }, person: 'bride', person_label: 'Bride', section: 'bride_outfit', title: 'Mehndi lehenga', sort_order: 10,
  steps: [step(1, 'Selected', '2026-10-05'), step(2, 'Stitched'), step(3, 'Trial done'), step(4, 'Final approved')],
  moodboard: [att], accessories: [{ id: '01JD0AC0000000000000000001', version: 1, name: 'Maang tikka', sort_order: 10, notes: [{ id: 'N1', version: 1, body: 'Kundan', created_at: '2026-10-08T09:00:00Z', created_by: { name: 'Mahi' } }], attachments: [], tasks: [] }],
  notes: [{ id: '01JD0NO0000000000000000001', version: 1, body: 'Pastel green', created_at: '2026-10-08T09:00:00Z', created_by: { id: 'x', name: 'Mahi' } }],
  tasks: [{ id: '01JA7Q3M2K8V5R1T9W4X6Y0T01', version: 1, title: 'Book tailor', status: 'todo', overdue: false }],
  cover_url: null, counts: { attachments: 1, accessories: 1, tasks_open: 1 }, ...over,
});

function renderAt(path) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>);
  return { router, ...utils };
}

afterEach(() => { act(() => dismiss()); signOut(); vi.restoreAllMocks(); });

describe('Outfits on a workspace', () => {
  test('Bride / Groom outfit sections: cards with progress; + Add outfit opens the new outfit', async () => {
    signInAs('mahi');
    const user = userEvent.setup();
    const calls = fakeApi({
      [`GET /workspaces/${WS}`]: () => ok({ id: WS, version: 1, name: 'Mehndi', event: null, counts: { tasks_open: 0, attachments: 0 }, tasks: [], sections: {}, outfits: [outfit()] }),
      'GET /attachments': () => ok([]),
      'POST /outfits': (body) => ok(outfit({ id: '01JD0OF0000000000000000002', title: body.title, person: body.person }), 201),
      'GET /outfits/{id}': () => ok(outfit({ id: '01JD0OF0000000000000000002', title: 'Sherwani', person: 'groom' })),
    });
    const { router } = renderAt(`/workspaces/${WS}`);
    const bride = await screen.findByRole('region', { name: 'Bride outfit' });
    expect(within(bride).getByRole('link', { name: /Mehndi lehenga/ })).toHaveTextContent('Selected · 1 of 4 steps done');
    const groom = screen.getByRole('region', { name: 'Groom outfit' });
    expect(within(groom).getByText('No outfit yet.')).toBeInTheDocument();
    await user.click(within(groom).getByRole('button', { name: 'Add outfit' }));
    await user.type(within(screen.getByRole('dialog')).getByLabelText('Outfit name'), 'Sherwani');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/outfits/01JD0OF0000000000000000002'));
    expect(JSON.parse(calls.mock.calls.find(([, i]) => i?.method === 'POST')[1].body)).toEqual({ workspace_id: WS, person: 'groom', title: 'Sherwani' });
  });
});

describe('Outfit page', () => {
  test('timeline, moodboard, accessories, notes and tasks; tap a step → Done with today\'s date', async () => {
    signInAs('ayush');
    const user = userEvent.setup();
    const calls = fakeApi({
      [`GET /outfits/${O}`]: () => ok(outfit()),
      'PATCH /outfit-steps/{id}': (body) => ok({ ...step(2, 'Stitched', body.done_on) }),
    });
    const { container } = renderAt(`/outfits/${O}`);
    const timeline = await screen.findByRole('list', { name: 'Timeline' });
    expect(within(timeline).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Selected, Done on Mon, 5 Oct 2026', 'Stitched, Not done yet', 'Trial done, Not done yet', 'Final approved, Not done yet',
    ]);
    expect(screen.getByText('1 of 4 steps done')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Moodboard' })).getByRole('link', { name: 'LEHENGA-01 Lehenga idea' })).toHaveAttribute('href', `/vault/${att.id}`);
    expect(within(screen.getByRole('region', { name: 'Accessories' })).getByRole('button', { name: /Maang tikka/ })).toBeInTheDocument();
    expect(screen.getByText('Pastel green')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Tasks' })).getByRole('link', { name: /Add task/ })).toHaveAttribute('href', `/tasks/new?outfit=${O}&back=${encodeURIComponent(`/outfits/${O}`)}`);
    expect(await axe(container)).toHaveNoViolations();

    await user.click(within(timeline).getByRole('button', { name: /^Stitched/ }));
    const sheet = screen.getByRole('dialog');
    await user.click(within(sheet).getByRole('switch', { name: 'Done' }));
    await vi.waitFor(() => expect(calls.mock.calls.some(([, i]) => i?.method === 'PATCH')).toBe(true));
    const patch = calls.mock.calls.find(([, i]) => i?.method === 'PATCH');
    expect(patch[0]).toBe('/api/v1/outfit-steps/01JD0ST0000000000000000002');
    expect(JSON.parse(patch[1].body)).toEqual({ done_on: todayIst() });
    expect(patch[1].headers['If-Match']).toBe('"1"');
  });

  test('add an accessory and a note', async () => {
    signInAs('mahi');
    const user = userEvent.setup();
    const calls = fakeApi({
      [`GET /outfits/${O}`]: () => ok(outfit()),
      [`POST /outfits/${O}/accessories`]: () => ok(outfit(), 201),
      'POST /notes': () => ok(outfit(), 201),
    });
    renderAt(`/outfits/${O}`);
    await user.click(await screen.findByRole('button', { name: 'Add accessory' }));
    await user.type(within(screen.getByRole('dialog')).getByLabelText('Accessory'), 'Kaleere');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(calls.mock.calls.some(([u, i]) => i?.method === 'POST' && u.endsWith('/accessories'))).toBe(true));
    const notes = screen.getByRole('region', { name: 'Notes' });
    await user.type(within(notes).getByLabelText('Add note'), 'Light dupatta');
    await user.click(within(notes).getByRole('button', { name: 'Add note' }));
    await vi.waitFor(() => expect(calls.mock.calls.some(([u, i]) => i?.method === 'POST' && u.endsWith('/notes'))).toBe(true));
    expect(JSON.parse(calls.mock.calls.find(([u, i]) => i?.method === 'POST' && u.endsWith('/notes'))[1].body)).toEqual({ outfit_id: O, body: 'Light dupatta' });
  });

  test('Family never opens an outfit', async () => {
    signInAs('papa');
    const calls = fakeApi({});
    renderAt(`/outfits/${O}`);
    expect(await screen.findByText('Only Ayush and Mahi can open workspaces.')).toBeInTheDocument();
    expect(calls.mock.calls.filter(([u]) => u.includes('/outfits'))).toEqual([]);
  });
});
