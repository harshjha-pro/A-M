// Settings › Home photos (1.0.16): Ayush and Mahi add (multipart, stored in the database),
// reorder and remove (Undo) the cover, couple and monogram photos; Family only looks.
import { describe, test, expect, afterEach, vi } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from '../../test/axe.js';
import { routes } from '../../routes.jsx';
import { fakeApi, ok, fail, signInAs, signOut } from '../../test/helpers.js';
import { dismiss } from '../../undo/undoStore.js';
import { groupPhotos } from '../../data/homePhotos.js';

const photo = (id, slot, n, version = 1) => ({ id, version, slot, sort_order: n, width_px: 1600, height_px: 1200, url: `/api/v1/home-photos/${id}/image?v=abc${n}` });
const C1 = '01JB0000000000000000000C01';
const C2 = '01JB0000000000000000000C02';
const list = [photo(C2, 'cover', 1, 3), photo(C1, 'cover', 0)];

function renderAt(path) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>);
}

afterEach(() => { act(() => dismiss()); signOut(); vi.restoreAllMocks(); });

describe('Home photos', () => {
  test('groupPhotos puts each place in order', () => {
    const g = groupPhotos([...list, photo('01JB0000000000000000000M01', 'monogram', 0)]);
    expect(g.cover.map((p) => p.id)).toEqual([C1, C2]);
    expect(g.couple).toEqual([]);
    expect(g.monogram).toHaveLength(1);
  });

  test('admin: counts per place; add a monogram (PNG kept see-through, sent with its SHA-256)', async () => {
    signInAs('ayush');
    const user = userEvent.setup();
    let photos = [...list];
    const calls = fakeApi({
      'GET /home-photos': () => ok(photos),
      'POST /home-photos': (form) => { photos = [...photos, photo('01JB0000000000000000000M01', form.get('slot'), 0)]; return ok(photos.at(-1), 201); },
    });
    const { container } = renderAt('/settings/home-photos');
    const cover = await screen.findByRole('region', { name: 'Cover photos' });
    expect(within(cover).getByText('2 of 8')).toBeInTheDocument();
    expect(within(cover).getAllByRole('img').map((i) => i.getAttribute('src'))).toEqual([`/api/v1/home-photos/${C1}/image?v=abc0`, `/api/v1/home-photos/${C2}/image?v=abc1`]);
    expect(within(screen.getByRole('region', { name: 'Couple photos' })).getByText('0 of 4')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    const mono = screen.getByRole('region', { name: 'Monogram' });
    const png = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'am.png', { type: 'image/png' });
    await user.upload(within(mono).getByTestId('hp-input-monogram'), png);
    expect(await screen.findByText('Photo added.')).toBeInTheDocument();
    const xhr = calls.mock.calls.find(([, i]) => i?.method === 'POST');
    const form = xhr[1].body;
    expect(form.get('slot')).toBe('monogram');
    expect(form.get('sha256')).toMatch(/^[0-9a-f]{64}$/);
    expect(form.get('file').type).toBe('image/png');
    expect(await within(mono).findByText('Full. Remove one to add another.')).toBeInTheDocument();
  });

  test('admin: Move later saves the new order with If-Match; Remove has Undo', async () => {
    signInAs('mahi');
    const user = userEvent.setup();
    const calls = fakeApi({
      'GET /home-photos': () => ok(list),
      'PATCH /home-photos/{id}': (body) => ok({ ...photo(C1, 'cover', body.sort_order) }),
      'DELETE /home-photos/{id}': () => new Response(JSON.stringify({ ok: true, data: {}, meta: { undo: { batch_id: 'B1', until: 'x', summary: 'Deleted Cover photo' } } }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    });
    renderAt('/settings/home-photos');
    await user.click(await screen.findByRole('button', { name: 'Move later: cover photos 1' }));
    await vi.waitFor(() => expect(calls.mock.calls.filter(([, i]) => i?.method === 'PATCH')).toHaveLength(2));
    const patches = calls.mock.calls.filter(([, i]) => i?.method === 'PATCH').map(([u, i]) => [u.split('?')[0], JSON.parse(i.body), i.headers['If-Match']]);
    expect(patches).toEqual([[`/api/v1/home-photos/${C2}`, { sort_order: 0 }, '"3"'], [`/api/v1/home-photos/${C1}`, { sort_order: 1 }, '"1"']]);
    await user.click(screen.getByRole('button', { name: 'Remove cover photos 2' }));
    expect(await screen.findByText('Deleted Cover photo')).toBeInTheDocument();
    const del = calls.mock.calls.find(([, i]) => i?.method === 'DELETE');
    expect(del[0]).toBe(`/api/v1/home-photos/${C2}`);
  });

  test('a full place says so; a refused upload says why', async () => {
    signInAs('ayush');
    const user = userEvent.setup();
    fakeApi({
      'GET /home-photos': () => ok([photo('01JB0000000000000000000M01', 'monogram', 0)]),
      'POST /home-photos': () => fail(422, { code: 'validation_failed', message: 'Up to 4 couple photos. Remove one first.', fields: { slot: 'Up to 4 couple photos. Remove one first.' } }),
    });
    renderAt('/settings/home-photos');
    expect(await within(await screen.findByRole('region', { name: 'Monogram' })).findByText('Full. Remove one to add another.')).toBeInTheDocument();
    const png = new File([new Uint8Array([137, 80, 78, 71])], 'x.png', { type: 'image/png' });
    await user.upload(screen.getByTestId('hp-input-couple'), png);
    expect(await screen.findByText(/Not added:/)).toBeInTheDocument();
  });

  test('Family sees the photos but cannot change them', async () => {
    signInAs('papa');
    fakeApi({ 'GET /home-photos': () => ok(list) });
    renderAt('/settings/home-photos');
    expect(await screen.findByText('Only Ayush and Mahi can change Home photos.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add photo' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull();
  });
});
