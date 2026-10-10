// Calendar + events: agenda by day with "Date not set" first, IST labels on a non-IST
// phone (AC-EVT-02), month dots "+2" (AC-EVT-04), share text (AC-EVT-07), Family read-only
// (AC-EVT-05), delete with counts then Undo (AC-EVT-06), event form, task form event preset.
import { describe, test, expect, afterEach, vi } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from '../../test/axe.js';
import { routes } from '../../routes.jsx';
import { fakeApi, ok, fail, signInAs, signOut, PEOPLE } from '../../test/helpers.js';
import { dismiss } from '../../undo/undoStore.js';
import { todayIst, formatDateOnly } from '../../format/ist.js';
import { shareText } from './EventDetail.jsx';

const MEHNDI = '01M4DK5T3E6QZBMNQ0V7KQWW23';
const T1 = '01JA7Q3M2K8V5R1T9W4X6Y0T01';
const event = (over = {}) => ({
  id: MEHNDI, version: 2, name: 'Mehndi', type: 'mehndi', side: 'both', guests_invited: true,
  start_at: '2027-02-14T12:30:00Z', end_at: '2027-02-14T17:30:00Z', all_day: false, date: '2027-02-14',
  venue_name: 'Sukhadia Bhawan', venue_address: 'Bhilwara', map_url: 'https://maps.app.goo.gl/abc', dress_code: 'Green', notes: null, sort_order: 30,
  counts: { tasks: 1, invitations: 0, documents: 0 }, headcount: { families_invited: 0, people_coming: 0, people_up_to: 0 }, ...over,
});
const undated = [{ ...event({ id: '01M4DK5T3CM3FTBFESYSCKJ2KK', name: 'Engagement', type: 'engagement', start_at: null, end_at: null, date: null }) }];
const today = todayIst();
const month = today.slice(0, 7);
const withMeta = (data, meta) => new Response(JSON.stringify({ ok: true, data, meta: { request_id: 'r', server_time: 'x', ...meta } }), { status: 200, headers: { 'Content-Type': 'application/json' } });

function renderAt(path) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>);
  return { router, ...utils };
}

afterEach(() => { act(() => dismiss()); signOut(); vi.restoreAllMocks(); });

describe('Agenda', () => {
  test('E1: "Date not set" first, then days; each item says what it is; IST label on a Dubai phone', async () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({ timeZone: 'Asia/Dubai', locale: 'en' });
    signInAs('papa');
    const calls = fakeApi({
      'GET /calendar': () => ok({ days: [{ date: `${month}-20`, items: [
        { type: 'task', id: T1, title: 'Pay tent advance', date: `${month}-20`, time: null, status: 'todo', overdue: false, side: null, linked_event: null },
        { type: 'event', id: MEHNDI, title: 'Mehndi', date: `${month}-20`, time: '18:00', status: null, overdue: false, side: 'both', linked_event: null },
      ] }], undated }),
    });
    const { container } = renderAt('/calendar');
    const headings = await screen.findAllByRole('heading', { level: 2 });
    expect(headings[0]).toHaveTextContent('Date not set');
    expect(screen.getByText('Engagement')).toBeInTheDocument();
    const day = screen.getByRole('region', { name: formatDateOnly(`${month}-20`) });
    expect(within(day).getByText('6:00 PM IST')).toBeInTheDocument();
    expect(within(day).getAllByText('Event')[0]).toBeInTheDocument();
    expect(within(day).getByText('Task')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    const first = calls.mock.calls.find(([u]) => u.startsWith('/api/v1/calendar'))[0];
    expect(first).toContain(`from=${today}`);
    expect(first).toContain('include_undated=true');
    expect(first).toContain('types=event%2Ctask%2Cpayment');
  });

  test('a non-money member never asks for payments; Only mine is sent', async () => {
    signInAs('mummy');
    const user = userEvent.setup();
    const calls = fakeApi({ 'GET /calendar': () => ok({ days: [], undated: [] }) });
    renderAt('/calendar');
    await screen.findByText('Nothing planned yet. Set your event dates.');
    expect(screen.queryByRole('button', { name: /Payments/ })).toBeNull();
    expect(calls.mock.calls[0][0]).toContain('types=event%2Ctask&');
    await user.click(screen.getByRole('button', { name: 'Only mine' }));
    await vi.waitFor(() => expect(calls.mock.calls.some(([u]) => u.includes('mine=true'))).toBe(true));
  });
});

describe('Month view', () => {
  test('AC-EVT-04 / E2: 5 items → 3 dots and "+2"; tapping the day lists it', async () => {
    signInAs('ayush');
    const user = userEvent.setup();
    const items = ['A', 'B', 'C', 'D', 'E'].map((n, i) => ({ type: 'task', id: `01JA7Q3M2K8V5R1T9W4X6Y0T0${i}`, title: `Task ${n}`, date: `${month}-20`, time: null, status: 'todo', overdue: false, side: null, linked_event: null }));
    fakeApi({ 'GET /calendar': () => ok({ days: [{ date: `${month}-20`, items }] }) });
    renderAt('/calendar');
    await user.click(await screen.findByRole('radio', { name: 'Month' }));
    const cell = await screen.findByRole('gridcell', { name: '20, 5 items' });
    expect(within(cell).getByText('+2')).toBeInTheDocument();
    await user.click(cell);
    expect(await screen.findByText('Task E')).toBeInTheDocument();
  });
});

describe('Event page', () => {
  test('AC-EVT-07 share text has the name, IST date and time, venue and map link', () => {
    const text = shareText({ name: 'Mehndi', startAt: '2027-02-14T12:30:00Z', allDay: false, venueName: 'Sukhadia Bhawan', venueAddress: 'Bhilwara', mapUrl: 'https://maps.app.goo.gl/abc' });
    expect(text).toBe('Mehndi · Sun, 14 Feb 2027, 6:00 PM IST · Sukhadia Bhawan, Bhilwara · https://maps.app.goo.gl/abc');
  });

  test('AC-EVT-05 / E4: Family sees details and Share, no Edit', async () => {
    signInAs('mummy');
    fakeApi({ 'GET /events/{id}': () => ok(event()), 'GET /tasks': () => ok([]) });
    const { container } = renderAt(`/calendar/events/${MEHNDI}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Mehndi' })).toBeInTheDocument();
    const when = [...container.querySelectorAll('dd')].map((d) => d.textContent)[0];
    expect(when).toContain('Sun, 14 Feb 2027');
    expect(when).toContain('6:00 PM – 11:00 PM');
    const share = screen.getByRole('link', { name: 'Share on WhatsApp' });
    expect(share.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.getByText('Only Ayush and Mahi can change events.')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  test('AC-EVT-06 / E5: delete shows the counts first, then Undo', async () => {
    signInAs('ayush');
    const user = userEvent.setup();
    const calls = fakeApi({
      'GET /events/{id}': () => ok(event()), 'GET /tasks': () => ok([]),
      'GET /events/{id}/delete-preview': () => ok({ tasks: 12, invitations: 340, payments: 3, documents: 0 }),
      'DELETE /events/{id}': () => withMeta({}, { undo: { batch_id: 'B1', until: 'x', summary: 'Deleted Mehndi' } }),
      'GET /calendar': () => ok({ days: [], undated: [] }),
    });
    const { router } = renderAt(`/calendar/events/${MEHNDI}`);
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('12 tasks, 340 invited families, 3 payments. They will stay but lose this event. You can restore it from Deleted items.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Deleted Mehndi')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/calendar');
    expect(calls.mock.calls.find(([, i]) => i.method === 'DELETE')[1].headers['If-Match']).toBe('"2"');
  });
});

describe('Event form', () => {
  test('E3: edit venue sends only what changed; times go as IST', async () => {
    signInAs('ayush');
    const user = userEvent.setup();
    const calls = fakeApi({
      'GET /events/{id}': () => ok(event()), 'GET /tasks': () => ok([]),
      'PATCH /events/{id}': (body) => ok(event({ ...body, version: 3 })),
      'GET /calendar': () => ok({ days: [], undated: [] }),
    });
    renderAt(`/calendar/events/${MEHNDI}/edit`);
    const venue = await screen.findByLabelText('Venue');
    expect(screen.getByLabelText('Starts at')).toHaveValue('18:00');
    await user.clear(venue);
    await user.type(venue, 'Hotel Ashoka');
    await user.clear(screen.getByLabelText('Starts at'));
    await user.type(screen.getByLabelText('Starts at'), '19:00');
    await user.click(screen.getByRole('button', { name: 'Save event' }));
    await vi.waitFor(() => expect(calls.mock.calls.some(([, i]) => i.method === 'PATCH')).toBe(true));
    const body = JSON.parse(calls.mock.calls.find(([, i]) => i.method === 'PATCH')[1].body);
    expect(body).toEqual({ venue_name: 'Hotel Ashoka', all_day: false, start_at: '2027-02-14T19:00:00+05:30', end_at: '2027-02-14T23:00:00+05:30' });
  });

  test('same type on the same day → Add anyway; server field errors show', async () => {
    signInAs('mahi');
    const user = userEvent.setup();
    let n = 0;
    const calls = fakeApi({
      'POST /events': () => (++n === 1
        ? fail(409, { code: 'duplicate_found', message: 'Haldi is already on Sat, 13 Feb 2027. Add anyway?', matches: [{ id: MEHNDI, name: 'Haldi' }] })
        : ok(event({ id: '01JA7Q3M2K8V5R1T9W4X6Y0E09', name: 'Haldi (groom)' }), 201)),
      'GET /events/{id}': () => ok(event({ id: '01JA7Q3M2K8V5R1T9W4X6Y0E09', name: 'Haldi (groom)' })), 'GET /tasks': () => ok([]),
      'GET /calendar': () => ok({ days: [], undated: [] }),
    });
    renderAt('/calendar/events/new');
    await user.type(await screen.findByLabelText('Name'), 'Haldi (groom)');
    await user.selectOptions(screen.getByLabelText('Type'), 'haldi');
    await user.type(screen.getByLabelText('Date'), '2027-02-13');
    await user.click(screen.getByRole('button', { name: 'Save event' }));
    expect(await screen.findByText('Haldi is already on Sat, 13 Feb 2027. Add anyway?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add anyway' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Haldi (groom)' })).toBeInTheDocument();
    const last = JSON.parse(calls.mock.calls.filter(([, i]) => i.method === 'POST').at(-1)[1].body);
    expect(last).toMatchObject({ name: 'Haldi (groom)', type: 'haldi', allow_duplicate: true, start_at: '2027-02-13T00:00:00+05:30' });
  });
});

describe('Task from an event (AC-QA-02)', () => {
  test('"Add a task for this event" fills in the event', async () => {
    signInAs('papa');
    const user = userEvent.setup();
    const calls = fakeApi({
      'GET /events': () => ok([event()]), 'GET /members': () => ok([]), 'GET /tags': () => ok([]),
      'POST /tasks': (body) => ok({ id: T1, version: 1, title: body.title, status: 'todo', priority: 'normal', assignees: [], tags: [], items: [], event: { id: MEHNDI, name: 'Mehndi' } }, 201),
      'GET /tasks': () => ok([]),
    });
    renderAt(`/tasks/new?event=${MEHNDI}`);
    await user.type(await screen.findByLabelText('What needs doing?'), 'Mehndi cones');
    await screen.findByRole('option', { name: 'Mehndi' });
    expect(screen.getByLabelText('Event (optional)')).toHaveValue(MEHNDI);
    await user.click(screen.getByRole('button', { name: 'Save task' }));
    await vi.waitFor(() => expect(calls.mock.calls.some(([, i]) => i.method === 'POST')).toBe(true));
    expect(JSON.parse(calls.mock.calls.find(([, i]) => i.method === 'POST')[1].body)).toEqual({ title: 'Mehndi cones', event_id: MEHNDI });
  });
});
