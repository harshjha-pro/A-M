// Workspace step C (1.0.19): Family outfits (four groups), Theme & decoration (theme, board,
// decor items with their own page: props, vendor) and the Menu (caterer, categories, dishes
// Normal / Jain with ⭐ and a note, add dish, copy a menu from another workspace with Undo).
import { describe, test, expect, afterEach, vi } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from '../../test/axe.js';
import { routes } from '../../routes.jsx';
import { fakeApi, ok, signInAs, signOut } from '../../test/helpers.js';
import { dismiss } from '../../undo/undoStore.js';

const WS = '01JC0WS0000000000000000002';
const REC = '01JC0WS0000000000000000006';
const VENDOR = { id: '01JA6ZB0000000000000000001', name: 'Shree Tent House' };
const steps = (names) => names.map((name, i) => ({ id: `01JD0ST000000000000000000${i + 1}`, version: 1, name, sort_order: (i + 1) * 10, done_on: null, done: false }));
const card = (over) => ({ version: 1, workspace: { id: WS, name: 'Mehndi' }, vendor: null, sort_order: 10, cover_url: null, counts: { attachments: 0, accessories: 0, tasks_open: 0 }, ...over });
const dish = (id, name, over = {}) => ({ id, version: 1, name, diet: 'normal', is_must_have: false, note: null, sort_order: 10, attachments: [], tasks: [], ...over });
const menu = (over = {}) => ({
  workspace_id: WS, caterer: null, counts: { items: 2, jain: 1 },
  categories: [{ id: '01JD0MC0000000000000000001', version: 1, name: 'Starters', sort_order: 10, items: [
    dish('01JD0M10000000000000000001', 'Paneer tikka', { is_must_have: true }),
    dish('01JD0M10000000000000000002', 'Hara bhara kabab', { diet: 'jain', note: 'No onion, no garlic' }),
  ] }],
  ...over,
});
const ws = (over = {}) => ({
  id: WS, version: 3, name: 'Mehndi', event: null, theme_name: 'Garden mehndi', theme_colours: 'Pastel green, gold', caterer: null,
  counts: { tasks_open: 0, attachments: 0 }, tasks: [], sections: {},
  outfits: [
    card({ id: '01JD0QF0000000000000000005', person: 'close_male', title: 'Mama ji – Safa', steps: steps(['Selected', 'Stitched', 'Trial done', 'Final approved']) }),
    card({ id: '01JD0QF0000000000000000006', person: 'decor', title: 'Stage', vendor: VENDOR, steps: steps(['Booked', 'Sample seen', 'Final approved', 'Set up']) }),
  ],
  menu: menu(), boards: { decor: [], menu: [] }, ...over,
});

function renderAt(path) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>);
  return { router, ...utils };
}

afterEach(() => { act(() => dismiss()); signOut(); vi.restoreAllMocks(); });

describe('Family outfits and Theme & decoration', () => {
  test('four family groups; theme with Edit; decor items with + Add decor item', async () => {
    signInAs('mahi');
    const user = userEvent.setup();
    const calls = fakeApi({
      [`GET /workspaces/${WS}`]: () => ok(ws()),
      'GET /attachments': () => ok([]),
      'GET /vendors': () => ok([VENDOR]),
      [`PATCH /workspaces/${WS}`]: (body) => ok(ws({ theme_name: body.theme_name })),
      'POST /outfits': (body) => ok(card({ id: '01JD0QF0000000000000000007', person: body.person, title: body.title, steps: [] }), 201),
      'GET /outfits/{id}': () => ok({ ...card({ id: '01JD0QF0000000000000000007', person: 'decor', title: 'Entry gate', steps: [] }), moodboard: [], accessories: [], notes: [], tasks: [] }),
    });
    const { container, router } = renderAt(`/workspaces/${WS}`);
    const family = await screen.findByRole('region', { name: 'Family outfits' });
    expect(within(family).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Close family · Female', 'Close family · Male', 'Extended family · Female', 'Extended family · Male']);
    expect(within(family).getByRole('link', { name: /Mama ji – Safa/ })).toHaveAttribute('href', '/outfits/01JD0QF0000000000000000005');
    const decor = screen.getByRole('region', { name: 'Theme & decoration' });
    expect(within(decor).getByText('Garden mehndi')).toBeInTheDocument();
    expect(within(decor).getByText('Colours: Pastel green, gold')).toBeInTheDocument();
    expect(within(decor).getByRole('link', { name: /Stage.*Shree Tent House/ })).toHaveTextContent('Not done yet · 0 of 4 steps done');
    expect(await axe(container)).toHaveNoViolations();

    await user.click(within(family).getByRole('button', { name: 'Add outfit: Close family · Male' }));
    await user.type(within(screen.getByRole('dialog')).getByLabelText('Who and what'), 'Nana ji – Kurta');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/outfits/01JD0QF0000000000000000007'));
    expect(JSON.parse(calls.mock.calls.find(([, i]) => i?.method === 'POST')[1].body)).toEqual({ workspace_id: WS, person: 'close_male', title: 'Nana ji – Kurta' });
  });

  test('edit the theme; add a decor item', async () => {
    signInAs('ayush');
    const user = userEvent.setup();
    const calls = fakeApi({
      [`GET /workspaces/${WS}`]: () => ok(ws({ theme_name: null, theme_colours: null })),
      'GET /attachments': () => ok([]),
      'GET /vendors': () => ok([VENDOR]),
      [`PATCH /workspaces/${WS}`]: () => ok(ws()),
      'POST /outfits': (body) => ok(card({ id: '01JD0QF0000000000000000008', person: body.person, title: body.title, steps: [] }), 201),
      'GET /outfits/{id}': () => ok({ ...card({ id: '01JD0QF0000000000000000008', person: 'decor', title: 'Mandap', steps: [] }), moodboard: [], accessories: [], notes: [], tasks: [] }),
    });
    const { router } = renderAt(`/workspaces/${WS}`);
    const decor = await screen.findByRole('region', { name: 'Theme & decoration' });
    expect(within(decor).getByText('No theme yet.')).toBeInTheDocument();
    await user.click(within(decor).getByRole('button', { name: 'Edit theme' }));
    let sheet = screen.getByRole('dialog');
    await user.type(within(sheet).getByLabelText('Theme name'), 'Royal Rajasthani');
    await user.type(within(sheet).getByLabelText('Colours'), 'Maroon, gold');
    await user.click(within(sheet).getByRole('button', { name: 'Save theme' }));
    await vi.waitFor(() => expect(calls.mock.calls.some(([, i]) => i?.method === 'PATCH')).toBe(true));
    const patch = calls.mock.calls.find(([, i]) => i?.method === 'PATCH');
    expect(JSON.parse(patch[1].body)).toEqual({ theme_name: 'Royal Rajasthani', theme_colours: 'Maroon, gold' });
    expect(patch[1].headers['If-Match']).toBe('"3"');

    await user.click(within(decor).getByRole('button', { name: 'Add decor item: Decor items' }));
    sheet = screen.getByRole('dialog');
    await user.type(within(sheet).getByLabelText('Decor item'), 'Mandap');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/outfits/01JD0QF0000000000000000008'));
    expect(JSON.parse(calls.mock.calls.find(([, i]) => i?.method === 'POST')[1].body)).toEqual({ workspace_id: WS, person: 'decor', title: 'Mandap' });
    expect(await screen.findByRole('heading', { name: 'Props & accessories' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add prop' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete decor item' })).toBeInTheDocument();
  });

  test('a decor item page sets its vendor', async () => {
    signInAs('mahi');
    const user = userEvent.setup();
    const O = '01JD0QF0000000000000000006';
    const calls = fakeApi({
      [`GET /outfits/${O}`]: () => ok({ ...card({ id: O, person: 'decor', title: 'Stage', steps: steps(['Booked']) }), moodboard: [], accessories: [], notes: [], tasks: [] }),
      'GET /vendors': () => ok([VENDOR]),
      [`PATCH /outfits/${O}`]: () => ok({}),
    });
    renderAt(`/outfits/${O}`);
    await screen.findByRole('option', { name: VENDOR.name });
    await user.selectOptions(screen.getByLabelText('Vendor (contact)'), VENDOR.id);
    await vi.waitFor(() => expect(calls.mock.calls.some(([, i]) => i?.method === 'PATCH')).toBe(true));
    expect(JSON.parse(calls.mock.calls.find(([, i]) => i?.method === 'PATCH')[1].body)).toEqual({ vendor_id: VENDOR.id });
    expect(screen.getByText('Mehndi · Decor')).toBeInTheDocument();
  });
});

describe('Menu', () => {
  test('categories with dishes (⭐, Jain, note); add a dish; set the caterer', async () => {
    signInAs('mahi');
    const user = userEvent.setup();
    const calls = fakeApi({
      [`GET /workspaces/${WS}`]: () => ok(ws()),
      'GET /attachments': () => ok([]),
      'GET /vendors': () => ok([VENDOR]),
      'POST /menu-categories/{id}/items': () => ok(menu(), 201),
      [`PATCH /workspaces/${WS}`]: () => ok(ws()),
    });
    const { container } = renderAt(`/workspaces/${WS}#menu`);
    const m = await screen.findByRole('region', { name: 'Menu' });
    expect(within(m).getByText('2 dishes · 1 Jain')).toBeInTheDocument();
    const starters = within(m).getByRole('list', { name: 'Starters' });
    const rows = within(starters).getAllByRole('button');
    expect(rows[0]).toHaveTextContent('Paneer tikka');
    expect(within(rows[0]).getByLabelText('Must-have')).toBeInTheDocument();
    expect(rows[1]).toHaveTextContent('Hara bhara kababNo onion, no garlicJain');
    expect(await axe(container)).toHaveNoViolations();

    await user.click(within(m).getByRole('button', { name: 'Add dish: Starters' }));
    const sheet = screen.getByRole('dialog');
    await user.type(within(sheet).getByLabelText('Dish'), 'Dahi kabab');
    await user.click(within(sheet).getByText('Jain'));
    await user.click(within(sheet).getByRole('switch', { name: '⭐ Must-have' }));
    await user.click(within(sheet).getByRole('button', { name: 'Save dish' }));
    await vi.waitFor(() => expect(calls.mock.calls.some(([u, i]) => i?.method === 'POST' && u.endsWith('/items'))).toBe(true));
    const post = calls.mock.calls.find(([u, i]) => i?.method === 'POST' && u.endsWith('/items'));
    expect(post[0]).toBe('/api/v1/menu-categories/01JD0MC0000000000000000001/items');
    expect(JSON.parse(post[1].body)).toEqual({ name: 'Dahi kabab', diet: 'jain', is_must_have: true, note: null });

    await user.selectOptions(within(m).getByLabelText('Caterer'), VENDOR.id);
    await vi.waitFor(() => expect(calls.mock.calls.some(([, i]) => i?.method === 'PATCH')).toBe(true));
    expect(JSON.parse(calls.mock.calls.find(([, i]) => i?.method === 'PATCH')[1].body)).toEqual({ caterer_id: VENDOR.id });
  });

  test('a dish: attachments and tasks (Add task comes back to the menu); copy a menu with Undo', async () => {
    signInAs('ayush');
    const user = userEvent.setup();
    const calls = fakeApi({
      [`GET /workspaces/${WS}`]: () => ok(ws()),
      'GET /workspaces': () => ok([{ id: WS, name: 'Mehndi' }, { id: REC, name: 'Reception' }]),
      'GET /attachments': () => ok([]),
      'GET /vendors': () => ok([]),
      [`POST /workspaces/${WS}/menu/copy`]: () => new Response(JSON.stringify({ ok: true, data: { ...menu(), copied: 5 }, meta: { undo: { batch_id: 'B7', until: 'x', summary: 'Menu copied from Reception' } } }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    });
    renderAt(`/workspaces/${WS}`);
    const m = await screen.findByRole('region', { name: 'Menu' });
    await user.click(within(m).getByRole('button', { name: /Hara bhara kabab/ }));
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByLabelText('Dish')).toHaveValue('Hara bhara kabab');
    expect(within(sheet).getByRole('link', { name: /Add task/ })).toHaveAttribute('href', `/tasks/new?menuItem=01JD0M10000000000000000002&back=${encodeURIComponent(`/workspaces/${WS}#menu`)}`);
    expect(within(sheet).getByRole('button', { name: 'Delete dish' })).toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: 'Close' }));

    await user.click(within(m).getByRole('button', { name: 'Copy menu from…' }));
    const copy = screen.getByRole('dialog');
    expect(within(copy).getAllByRole('option').map((o) => o.textContent)).toEqual(['—', 'Reception']);
    await user.selectOptions(within(copy).getByLabelText('Copy from'), REC);
    await user.click(within(copy).getByRole('button', { name: 'Copy menu' }));
    await vi.waitFor(() => expect(calls.mock.calls.some(([u]) => u.endsWith('/menu/copy'))).toBe(true));
    expect(JSON.parse(calls.mock.calls.find(([u]) => u.endsWith('/menu/copy'))[1].body)).toEqual({ from_workspace_id: REC });
    expect(await screen.findByText('Menu copied from Reception · 5 added')).toBeInTheDocument();
  });

  test('Family never sees a workspace menu', async () => {
    signInAs('papa');
    const calls = fakeApi({});
    renderAt(`/workspaces/${WS}`);
    expect(await screen.findByText('Only Ayush and Mahi can open workspaces.')).toBeInTheDocument();
    expect(calls.mock.calls.filter(([u]) => u.includes('/workspaces'))).toEqual([]);
  });
});
