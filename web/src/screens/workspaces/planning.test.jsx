// Workspace step D (1.0.20): Contacts (Call / WhatsApp, role, add from vendors, Also used here),
// Guest details (headcount of the linked event, Open in Guests, guest notes) and the Event
// timeline (estimated times, add a step, move, suggested steps for an empty timeline).
import { describe, test, expect, afterEach, vi } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from '../../test/axe.js';
import { routes } from '../../routes.jsx';
import { fakeApi, ok, signInAs, signOut } from '../../test/helpers.js';
import { dismiss } from '../../undo/undoStore.js';
import { duration } from './PlanningSections.jsx';

const WS = '01JC0WS0000000000000000006';
const TENT = { id: '01JA6ZB0000000000000000001', name: 'Shree Tent House', category: 'tent_decor', category_label: 'Tent & decor', contact_person: null, phone: '+919414012345', alt_phone: null };
const FLOWERS = { id: '01JA6ZB0000000000000000002', name: 'Fresh Flowers Co.', category: 'florist', category_label: 'Florist', contact_person: null, phone: '+919414099887', alt_phone: null };
const step = (n, purpose, over = {}) => ({ id: `01JE0TS000000000000000000${n}`, version: 1, purpose, start_time: null, duration_min: 30, note: null, sort_order: n * 10, attachments: [], tasks: [], starts: null, estimated: false, ends: null, ...over });
const planning = (over = {}) => ({
  contacts: [{ id: '01JE0CT0000000000000000001', version: 1, role: 'Stage & lights', sort_order: 10, vendor: TENT }],
  also_used: [{ vendor: FLOWERS, where: ['Caterer'] }],
  guests: { event: { id: '01M4DK5T3E6QZBMNQ0V7KQWW29', name: 'Reception' }, families_invited: 12, families_coming: 7, families_not_coming: 2, families_waiting: 3, people_coming: 25, adults_coming: 20, children_coming: 5, jain_coming: 4, people_waiting: 9, people_up_to: 34 },
  timeline: { total_min: 150, steps: [
    step(1, 'Couple entry', { start_time: '19:30', starts: '19:30', ends: '19:45', duration_min: 15 }),
    step(2, 'Stage greetings and photos', { starts: '19:45', ends: '21:45', estimated: true, duration_min: 120, note: 'Family first' }),
    step(3, 'Send-off', { starts: '21:45', ends: '22:00', estimated: true, duration_min: 15 }),
  ] },
  ...over,
});
const ws = (over = {}) => ({ id: WS, version: 4, name: 'Reception', event: { id: '01M4DK5T3E6QZBMNQ0V7KQWW29', name: 'Reception', start_at: '2027-02-16T13:30:00Z' }, guest_notes: null,
  counts: { tasks_open: 0, attachments: 0 }, tasks: [], sections: {}, outfits: [], menu: { categories: [], counts: { items: 0, jain: 0 }, caterer: null }, boards: { decor: [], menu: [] }, planning: planning(), ...over });

function renderAt(path) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>);
  return { router, ...utils };
}

afterEach(() => { act(() => dismiss()); signOut(); vi.restoreAllMocks(); });

test('duration reads like people talk', () => {
  expect([duration(15), duration(60), duration(90), duration(150)]).toEqual(['15 min', '1 h', '1 h 30 min', '2 h 30 min']);
});

describe('Contacts', () => {
  test('a contact with Call and WhatsApp; Also used here; add a vendor as a contact', async () => {
    signInAs('mahi');
    const user = userEvent.setup();
    const calls = fakeApi({
      [`GET /workspaces/${WS}`]: () => ok(ws()),
      'GET /attachments': () => ok([]),
      'GET /vendors': () => ok([TENT, FLOWERS]),
      [`POST /workspaces/${WS}/contacts`]: () => ok(planning(), 201),
    });
    const { container } = renderAt(`/workspaces/${WS}`);
    const sec = await screen.findByRole('region', { name: 'Contacts' });
    const list = within(sec).getByRole('list', { name: 'Contacts' });
    expect(list).toHaveTextContent('Shree Tent HouseTent & decor · Stage & lights · +91 94140 12345');
    expect(within(list).getByRole('link', { name: 'Call Shree Tent House' })).toHaveAttribute('href', 'tel:+919414012345');
    expect(within(list).getByRole('link', { name: 'WhatsApp Shree Tent House' })).toHaveAttribute('href', 'https://wa.me/919414012345');
    const also = within(sec).getByRole('list', { name: 'Also used here' });
    expect(also).toHaveTextContent('Fresh Flowers Co.Florist · Caterer');
    expect(await axe(container)).toHaveNoViolations();

    await user.click(within(also).getByRole('button', { name: 'Add as contact: Fresh Flowers Co.' }));
    const sheet = screen.getByRole('dialog');
    await within(sheet).findByRole('option', { name: 'Fresh Flowers Co.' });
    expect(within(sheet).getAllByRole('option').map((o) => o.textContent)).toEqual(['Pick a vendor', 'Fresh Flowers Co.'], 'vendors already here are not offered');
    expect(within(sheet).getByLabelText('Vendor')).toHaveValue(FLOWERS.id);
    await user.type(within(sheet).getByLabelText('Role here (optional)'), 'Flowers');
    await user.click(within(sheet).getByRole('button', { name: 'Save contact' }));
    await vi.waitFor(() => expect(calls.mock.calls.some(([u, i]) => i?.method === 'POST' && u.endsWith('/contacts'))).toBe(true));
    expect(JSON.parse(calls.mock.calls.find(([u, i]) => i?.method === 'POST' && u.endsWith('/contacts'))[1].body)).toEqual({ vendor_id: FLOWERS.id, role: 'Flowers' });
  });
});

describe('Guest details', () => {
  test('headcount of the linked event, Open in Guests, save guest notes', async () => {
    signInAs('ayush');
    const user = userEvent.setup();
    const calls = fakeApi({
      [`GET /workspaces/${WS}`]: () => ok(ws()),
      'GET /attachments': () => ok([]),
      [`PATCH /workspaces/${WS}`]: () => ok(ws({ guest_notes: 'Nani ji front row' })),
    });
    renderAt(`/workspaces/${WS}`);
    const sec = await screen.findByRole('region', { name: 'Guest details' });
    expect(within(sec).getAllByRole('definition').map((d) => d.textContent)).toEqual(['12', '7', '2', '3']);
    expect(sec).toHaveTextContent('25 people coming · 20 adults · 5 children · 4 Jain');
    expect(sec).toHaveTextContent('Up to 34 with those still waiting');
    expect(within(sec).getByRole('link', { name: 'Open in Guests' })).toHaveAttribute('href', '/guests?event=01M4DK5T3E6QZBMNQ0V7KQWW29');
    await user.type(within(sec).getByLabelText('Guest notes'), 'Nani ji front row');
    await user.click(within(sec).getByRole('button', { name: 'Save notes' }));
    await vi.waitFor(() => expect(calls.mock.calls.some(([, i]) => i?.method === 'PATCH')).toBe(true));
    const patch = calls.mock.calls.find(([, i]) => i?.method === 'PATCH');
    expect(JSON.parse(patch[1].body)).toEqual({ guest_notes: 'Nani ji front row' });
    expect(patch[1].headers['If-Match']).toBe('"4"');
  });

  test('no calendar event linked → a hint', async () => {
    signInAs('mahi');
    fakeApi({ [`GET /workspaces/${WS}`]: () => ok(ws({ event: null, planning: planning({ guests: null }) })), 'GET /attachments': () => ok([]) });
    renderAt(`/workspaces/${WS}`);
    const sec = await screen.findByRole('region', { name: 'Guest details' });
    expect(sec).toHaveTextContent('Link a calendar event to this workspace');
  });
});

describe('Event timeline', () => {
  test('times (≈ estimated), total, add a step, move one down', async () => {
    signInAs('mahi');
    const user = userEvent.setup();
    const calls = fakeApi({
      [`GET /workspaces/${WS}`]: () => ok(ws()),
      'GET /attachments': () => ok([]),
      [`POST /workspaces/${WS}/timeline`]: () => ok(planning(), 201),
      'POST /timeline-steps/{id}/move': () => ok(planning()),
    });
    const { container } = renderAt(`/workspaces/${WS}`);
    const sec = await screen.findByRole('region', { name: 'Event timeline' });
    expect(sec).toHaveTextContent('Total 2 h 30 min');
    const rows = within(within(sec).getByRole('list', { name: 'Event timeline' })).getAllByRole('button');
    expect(rows.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Couple entry, 7:30 PM, 15 min', 'Stage greetings and photos, about 7:45 PM, 2 h', 'Send-off, about 9:45 PM, 15 min',
    ]);
    expect(rows[1]).toHaveTextContent('≈ 7:45 PMStage greetings and photos2 h · Family first');
    expect(await axe(container)).toHaveNoViolations();

    await user.click(within(sec).getByRole('button', { name: 'Add step' }));
    let sheet = screen.getByRole('dialog');
    await user.type(within(sheet).getByLabelText('Purpose'), 'Cake cutting');
    await user.click(within(sheet).getByRole('button', { name: 'Save step' }));
    expect(within(sheet).getByText('Please fill this in.')).toBeInTheDocument(); // duration is required
    await user.type(within(sheet).getByLabelText('Duration (minutes)'), '10');
    await user.click(within(sheet).getByRole('button', { name: 'Save step' }));
    await vi.waitFor(() => expect(calls.mock.calls.some(([u, i]) => i?.method === 'POST' && u.endsWith('/timeline'))).toBe(true));
    expect(JSON.parse(calls.mock.calls.find(([u, i]) => i?.method === 'POST' && u.endsWith('/timeline'))[1].body)).toEqual({ purpose: 'Cake cutting', start_time: null, duration_min: 10, note: null });

    await user.click(rows[0]);
    sheet = screen.getByRole('dialog');
    expect(within(sheet).getByRole('button', { name: 'Move up' })).toBeDisabled();
    expect(within(sheet).getByRole('link', { name: /Add task/ })).toHaveAttribute('href', `/tasks/new?timelineStep=01JE0TS0000000000000000001&back=${encodeURIComponent(`/workspaces/${WS}#timeline`)}`);
    await user.click(within(sheet).getByRole('button', { name: 'Move down' }));
    await vi.waitFor(() => expect(calls.mock.calls.some(([u]) => u.endsWith('/move'))).toBe(true));
    const move = calls.mock.calls.find(([u]) => u.endsWith('/move'));
    expect([move[0], JSON.parse(move[1].body)]).toEqual(['/api/v1/timeline-steps/01JE0TS0000000000000000001/move', { direction: 'down' }]);
  });

  test('an empty timeline offers the suggested steps', async () => {
    signInAs('ayush');
    const user = userEvent.setup();
    const calls = fakeApi({
      [`GET /workspaces/${WS}`]: () => ok(ws({ planning: planning({ timeline: { steps: [], total_min: 0 } }) })),
      'GET /attachments': () => ok([]),
      [`POST /workspaces/${WS}/timeline/suggested`]: () => ok(planning(), 201),
    });
    renderAt(`/workspaces/${WS}`);
    const sec = await screen.findByRole('region', { name: 'Event timeline' });
    await user.click(within(sec).getByRole('button', { name: 'Add suggested steps' }));
    await vi.waitFor(() => expect(calls.mock.calls.some(([u]) => u.endsWith('/timeline/suggested'))).toBe(true));
  });
});
