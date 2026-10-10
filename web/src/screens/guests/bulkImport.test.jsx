// Guests 8b: select mode → one bulk request (ids or all filtered) with as_of and one Undo;
// Family can't bulk delete; import flow from pasted text with a duplicate choice and an
// error that is skipped; Settings → Imports → Undo this import.
import { describe, test, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from '../../test/axe.js';
import { routes } from '../../routes.jsx';
import { fakeApi, ok, fail, signInAs, signOut } from '../../test/helpers.js';
import { dismiss } from '../../undo/undoStore.js';

const MEHNDI = '01M4DK5T3E6QZBMNQ0V7KQWW23';
const events = [{ id: MEHNDI, name: 'Mehndi', version: 1, guests_invited: true, start_at: null }];
const fam = (i, over = {}) => ({
  id: `01JA7Q3M2K8V5R1T9W4X6Y0H0${i}`, version: 1, name: `Family ${i}`, phone: null, alt_phone: null, side: 'groom', group_name: null, relation: null,
  area: null, city: 'Bhilwara', address: null, adults: 2, children: 0, people: 2, food: 'veg', jain_count: 0, is_vip: false, notes: null,
  possible_duplicate: false, created_at: 'x', created_by: null, updated_at: 'x', updated_by: null, invitations: [], ...over,
});
const page = (data, meta) => new Response(JSON.stringify({ ok: true, data, meta: { request_id: 'r', server_time: '2026-10-08T09:12:31Z', has_more: false, ...meta } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
const withUndo = (data, summary) => new Response(JSON.stringify({ ok: true, data, meta: { request_id: 'r', server_time: 'x', undo: { batch_id: '01JA7Q3M2K8V5R1T9W4X6Y0B01', until: 'x', summary } } }), { status: 200, headers: { 'Content-Type': 'application/json' } });

function renderAt(path) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>);
  return { router, ...utils };
}

beforeEach(() => { try { localStorage.clear(); } catch { /* none */ } });
afterEach(() => { act(() => dismiss()); signOut(); vi.restoreAllMocks(); });

describe('Select mode', () => {
  test('tick two → Set Coming? for Mehndi → one request with ids and as_of; Undo bar names what was skipped', async () => {
    signInAs('papa');
    const user = userEvent.setup();
    const bodies = [];
    fakeApi({
      'GET /events': () => ok(events),
      'GET /households': () => page([fam(1), fam(2), fam(3)], { total: 3, totals: { people: 6 } }),
      'POST /households/bulk': (body) => { bodies.push(body); return withUndo({ affected: 1, skipped: [{ id: 'x', name: 'Family 2', reason: 'changed_since_loaded', changed_by: null }], batch_id: 'b' }, 'Set Coming for 1 family · Mehndi'); },
    });
    const { container } = renderAt('/guests');
    await screen.findByText('3 families · 6 people');
    await user.click(screen.getByRole('button', { name: 'Select' }));
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull(); // Family: no bulk delete (decision 31)
    await user.click(screen.getByRole('checkbox', { name: 'Select Family 1' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Family 2' }));
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole('button', { name: 'Set Coming?' }));
    const sheet = screen.getByRole('dialog');
    await user.selectOptions(within(sheet).getByLabelText('Event'), MEHNDI);
    await user.click(within(sheet).getByRole('button', { name: 'Apply to 2' }));
    expect(await screen.findByText(/Set Coming for 1 family · Mehndi. 1 left as they were: changed by someone after you opened the list/)).toBeInTheDocument();
    expect(bodies[0]).toEqual({ action: 'set_rsvp', as_of: '2026-10-08T09:12:31Z', ids: [fam(1).id, fam(2).id], event_id: MEHNDI, rsvp: 'coming' });
  });

  test('"Select all 260 filtered" sends the filter, not the loaded rows; admins can delete after a confirm', async () => {
    signInAs('ayush');
    const user = userEvent.setup();
    const bodies = [];
    fakeApi({
      'GET /events': () => ok(events),
      'GET /households': () => page([fam(1), fam(2)], { total: 260, totals: { people: 520 }, has_more: true, next_cursor: 'c' }),
      'POST /households/bulk': (body) => { bodies.push(body); return withUndo({ affected: 260, skipped: [], batch_id: 'b' }, 'Deleted 260 families'); },
    });
    renderAt('/guests');
    await screen.findByText('260 families · 520 people');
    await user.click(screen.getByRole('radio', { name: 'Groom' }));
    await user.click(await screen.findByRole('button', { name: 'Select' }));
    await user.click(screen.getByRole('button', { name: 'Select all 260 filtered' }));
    expect(screen.getByText('All 260 filtered families')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByText('Delete 260 families?')).toBeInTheDocument();
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    await vi.waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ action: 'delete', as_of: '2026-10-08T09:12:31Z', filter: { side: 'groom' } });
  });

  test('admins get "Export this list (CSV)" with the filters; Family does not', async () => {
    signInAs('ayush');
    fakeApi({ 'GET /events': () => ok(events), 'GET /households': () => page([fam(1)], { total: 1, totals: { people: 2 } }) });
    const { unmount } = renderAt('/guests');
    const link = await screen.findByRole('link', { name: 'Export this list (CSV)' });
    expect(link).toHaveAttribute('href', '/api/v1/households/export?');
    unmount();
    signInAs('papa');
    renderAt('/guests');
    await screen.findByText('1 families · 2 people');
    expect(screen.queryByRole('link', { name: 'Export this list (CSV)' })).toBeNull();
  });
});

describe('Import a list', () => {
  test('paste → defaults → check → choose for a duplicate → import → Undo bar', async () => {
    signInAs('ayush');
    const user = userEvent.setup();
    const sent = [];
    fakeApi({
      'GET /events': () => ok(events),
      'GET /households': () => page([], { total: 0, totals: { people: 0 } }),
      'POST /imports/preview': (body) => {
        sent.push(['preview', body]);
        return ok({ counts: { new: 1, duplicates: 1, errors: 1, skipped_examples: 0 }, rows: [
          { row_no: 1, status: 'new', errors: {}, matches: [], normalised: { name: 'Gupta ji', phone: '+919414011111' } },
          { row_no: 2, status: 'duplicate', errors: {}, matches: [{ id: '01JA7Q3M2K8V5R1T9W4X6Y0H09', name: 'Sharma family', side: 'groom', phone: '+919829012345', added_by: null, match_on: 'phone' }], normalised: { name: 'Ramesh Sharma', phone: '+919829012345' } },
          { row_no: 3, status: 'error', errors: { phone: 'Enter a 10-digit mobile number.' }, matches: [], normalised: { name: 'Bad', phone: null } },
        ] });
      },
      'POST /imports': (body) => { sent.push(['run', body]); return new Response(JSON.stringify({ ok: true, data: { id: 'i', created_count: 1, updated_count: 1 }, meta: { request_id: 'r', server_time: 'x', undo: { batch_id: '01JA7Q3M2K8V5R1T9W4X6Y0B02', until: 'x', summary: 'Imported 1 families' } } }), { status: 201, headers: { 'Content-Type': 'application/json' } }); },
    });
    const { container } = renderAt('/guests/import');
    expect(await screen.findByRole('link', { name: 'Download the Excel template' })).toHaveAttribute('href', '/templates/AM_Guest_List_Template.xlsx');
    await user.type(screen.getByLabelText('Paste names and numbers'), 'Gupta ji 94140 11111{enter}Ramesh Sharma 98290 12345{enter}Bad 123');
    await user.click(screen.getByRole('button', { name: 'Use pasted text' }));
    expect(await screen.findByText(/3 rows found/)).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /Groom's side/ }));
    await user.click(screen.getByRole('checkbox', { name: /Mehndi/ }));
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole('button', { name: 'Check the list' }));
    expect(await screen.findByText('1 new · 1 possible duplicates · 1 problems')).toBeInTheDocument();
    expect(sent[0][1]).toMatchObject({ source: 'paste', file_name: null, defaults: { side: 'groom', event_ids: [MEHNDI], city: null } });
    expect(sent[0][1].rows[0]).toEqual({ row_no: 1, name: 'Gupta ji', phone: '9414011111', event_ids: [] });
    expect(screen.getByText('Same as Sharma family')).toBeInTheDocument();
    expect(screen.getByText('Will be skipped. Fix it and tap Check again to include it.')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/What to do · Row 2/), 'update_existing:01JA7Q3M2K8V5R1T9W4X6Y0H09');
    await user.click(screen.getByRole('button', { name: 'Import 2 families' }));
    expect(await screen.findByText('Imported 1 families.')).toBeInTheDocument();
    const run = sent.find(([k]) => k === 'run')[1];
    expect(run.rows[1]).toMatchObject({ row_no: 2, decision: 'update_existing', update_target_id: '01JA7Q3M2K8V5R1T9W4X6Y0H09' });
    expect(run.rows[0].decision).toBeUndefined(); // new rows: the server adds them
    expect(run.rows[2].decision).toBe('skip'); // bug fix: a problem row is sent as Skip, or the server refuses the whole import
  });

  test('a file with no Name column says how to fix it', async () => {
    signInAs('ayush');
    const user = userEvent.setup({ applyAccept: false });
    fakeApi({ 'GET /events': () => ok(events) });
    renderAt('/guests/import');
    const input = await screen.findByLabelText(/Choose a file/);
    await user.upload(input, new File(['Mobile,City\n9829012345,Bhilwara\n'], 'list.csv', { type: 'text/csv' }));
    expect(await screen.findByText('No "Name" column found. Rename the column with family names to "Name".')).toBeInTheDocument();
  });
});

describe('Settings → Imports', () => {
  test('lists past imports and undoes one after a confirm', async () => {
    signInAs('ayush');
    const user = userEvent.setup();
    let undone = false;
    fakeApi({
      'GET /imports': () => ok([{ id: '01JA7Q3M2K8V5R1T9W4X6Y0I01', source: 'xlsx', file_name: 'AM_Guest_List.xlsx', created_count: 480, updated_count: 12, skipped_count: 3, error_count: 2, created_at: '2026-10-08T09:00:00Z', created_by: { id: 'u', name: 'Ayush' }, undone_at: undone ? '2026-10-08T09:10:00Z' : null }]),
      'POST /imports/{id}/undo': () => { undone = true; return ok({ undone: 480, skipped: [], message: 'Undone.', already_undone: false }); },
    });
    const { container } = renderAt('/settings/imports');
    expect(await screen.findByText('480 added · 12 filled in · 5 skipped')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole('button', { name: 'Undo this import' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Undo this import' }));
    expect(await screen.findByText(/^Undone \w/)).toBeInTheDocument();
  });
});
