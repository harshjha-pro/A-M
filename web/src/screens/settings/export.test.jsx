// Export everything (FEATURES B8): confirm → "Preparing export…" → Download links with
// the token; parts; failure → "Export failed — try again." with the same key; Family
// and offline get no button; recent exports and the last good one.
import { describe, test, expect, afterEach, vi } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from '../../test/axe.js';
import { routes } from '../../routes.jsx';
import { fakeApi, ok, fail, signInAs, signOut } from '../../test/helpers.js';

const E1 = '01JA7Q3M2K8V5R1T9W4X6Y0E01';
const exp = (over = {}) => ({
  id: E1, kind: 'full', status: 'ready', parts: 1, size_bytes: 3145728, files_bytes: 2097152, file_name: 'wedding-export_2026-10-08.zip',
  created_at: '2026-10-08T09:12:31Z', expires_at: '2026-10-09T09:12:31Z', download_urls: [`/api/v1/exports/${E1}/download?part=1`],
  requested_by: { id: 'u1', name: 'Ayush' }, error: null, ...over,
});
const listReply = (rows, last = null) => new Response(JSON.stringify({ ok: true, data: rows, meta: { request_id: 'r', server_time: 'x', last_success: last } }), { status: 200, headers: { 'Content-Type': 'application/json' } });

function renderAt(path) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>);
}

afterEach(() => { signOut(); vi.restoreAllMocks(); });

describe('Export everything', () => {
  test('confirm → Preparing export… → Download with the token link and Print summary', async () => {
    signInAs('ayush');
    const user = userEvent.setup();
    let release;
    const posts = [];
    fakeApi({
      'GET /exports': () => listReply([]),
      'POST /exports': (body, init) => { posts.push({ body, init }); return new Promise((r) => { release = () => r(ok(exp({ download_urls: [`/api/v1/exports/${E1}/download?part=1&t=tok123`] }), 201)); }); },
    });
    const { container } = renderAt('/settings/export');
    expect(await screen.findByText('No export made yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Export everything' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Make a full export?' });
    await user.click(within(dialog).getByRole('button', { name: 'Export' }));
    expect(await screen.findByText('Preparing export…')).toBeInTheDocument();
    await act(async () => release());
    expect(await screen.findByRole('heading', { name: 'Export ready' })).toBeInTheDocument();
    expect(screen.getByText(/^3 MB\. The link works until Fri, 9 Oct 2026, 2:42 PM IST\.$/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute('href', `/api/v1/exports/${E1}/download?part=1&t=tok123`);
    expect(screen.getByRole('link', { name: 'Print summary' })).toHaveAttribute('href', `/api/v1/exports/${E1}/summary?t=tok123`);
    expect(posts[0].body).toEqual({ kind: 'full' });
    expect(posts[0].init.headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
    expect(await axe(container)).toHaveNoViolations();
  });

  test('over 200 MB of files → Download part 1 of 2, part 2 of 2', async () => {
    signInAs('mahi');
    const user = userEvent.setup();
    fakeApi({
      'GET /exports': () => listReply([]),
      'POST /exports': () => ok(exp({ parts: 2, download_urls: ['/a?part=1&t=x', '/a?part=2&t=x'] }), 201),
    });
    renderAt('/settings/export');
    await user.click(await screen.findByRole('button', { name: 'Export everything' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Export' }));
    expect(await screen.findByRole('link', { name: 'Download part 1 of 2' })).toHaveAttribute('href', '/a?part=1&t=x');
    expect(screen.getByRole('link', { name: 'Download part 2 of 2' })).toHaveAttribute('href', '/a?part=2&t=x');
  });

  test('failure says "Export failed — try again." and Try again reuses the same key', async () => {
    signInAs('ayush');
    const user = userEvent.setup();
    const keys = [];
    fakeApi({
      'GET /exports': () => listReply([]),
      'POST /exports': (_b, init) => {
        keys.push(init.headers['Idempotency-Key']);
        return keys.length === 1 ? fail(500, { code: 'export_failed', message: 'Export failed — try again.' }) : ok(exp({ download_urls: ['/x?part=1&t=y'] }), 201);
      },
    });
    renderAt('/settings/export');
    await user.click(await screen.findByRole('button', { name: 'Export everything' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Export' }));
    expect(await screen.findByText('Export failed — try again.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Export ready' })).toBeInTheDocument();
    expect(keys[0]).toBe(keys[1]);
  });

  test('recent exports with the last good one; expired ones have no Download', async () => {
    signInAs('ayush');
    fakeApi({
      'GET /exports': () => listReply([
        exp(),
        exp({ id: '01JA7Q3M2K8V5R1T9W4X6Y0E00', status: 'expired', download_urls: [], created_at: '2026-10-01T05:00:00Z' }),
      ], { id: E1, created_at: '2026-10-08T09:12:31Z' }),
    });
    renderAt('/settings/export');
    expect(await screen.findByText('Last export: Thu, 8 Oct 2026, 2:42 PM IST')).toBeInTheDocument();
    const items = screen.getAllByRole('listitem').filter((li) => /Ayush/.test(li.textContent));
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByRole('link', { name: 'Download' })).toHaveAttribute('href', `/api/v1/exports/${E1}/download?part=1`);
    expect(within(items[1]).getByText(/Expired/)).toBeInTheDocument();
    expect(within(items[1]).queryByRole('link', { name: 'Download' })).toBeNull();
  });

  test('Family see a note, not the button; Settings lists Export only for admins', async () => {
    signInAs('papa');
    fakeApi({});
    renderAt('/settings/export');
    expect(await screen.findByText('Only Ayush and Mahi can export everything.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export everything' })).toBeNull();
  });

  test('offline: the button is off and says why', async () => {
    signInAs('ayush');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    fakeApi({ 'GET /exports': () => listReply([]) });
    renderAt('/settings/export');
    expect(await screen.findByText('Export needs internet. Try again when online.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export everything' })).toBeDisabled();
  });
});
