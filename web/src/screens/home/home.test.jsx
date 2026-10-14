// Home (FEATURES B2, new layout in 1.0.16): cover slideshow + monogram, couple photos,
// Months : Days : Hours countdown, upcoming events, my tasks, everyone's overdue, and recent
// activity for Ayush and Mahi only (Show more → a scrolling list). No budget, payments,
// headcount or safety cards on Home any more. AC-DASH-01/02/03.
import { describe, test, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from '../../test/axe.js';
import { routes } from '../../routes.jsx';
import { fakeApi, ok, signInAs, signOut, PEOPLE } from '../../test/helpers.js';
import { dismiss } from '../../undo/undoStore.js';
import { monthsDaysHours } from './countdownMath.js';

const NOW = Date.parse('2026-10-08T09:12:31Z'); // 2:42 PM IST, 8 Oct 2026
const mummy = { id: PEOPLE.mummy.id, name: 'Mummy' };
const task = (id, title, over = {}) => ({ id, version: 1, title, status: 'todo', priority: 'normal', due_date: '2026-10-08', due_time: null, overdue: false, due_today: true,
  postpone_count: 0, assignees: [mummy], tags: [], item_count: 0, items_done: 0, event: null, ...over });
const mehndi = { id: '01M4DK5T3E6QZBMNQ0V7KQWW23', name: 'Mehndi', start_at: '2027-02-14T12:30:00Z', all_day: false, venue_name: 'Porwal Niwas' };
const base = {
  countdown: { days_to_wedding: 129, wedding_day: null, wedding_days: 3, wedding_start_date: '2027-02-14', wedding_starts_at: '2027-02-13T18:30:00Z', next_event: mehndi },
  upcoming_events: [mehndi, { id: '01M4DK5T3E6QZBMNQ0V7KQWW24', name: 'Wedding', start_at: '2027-02-15T14:30:00Z', all_day: false, venue_name: null }],
  headcount: [{ event: { id: mehndi.id, name: 'Mehndi' }, families_invited: 3, people_coming: 7, people_waiting: 3, people_not_asked: 0, jain_coming: 3, people_up_to: 10 }],
};
const family = {
  ...base,
  my_tasks: { items: [task('01JA7Q3M2K8V5R1T9W4X6Y0T01', 'Due yesterday', { overdue: true, due_date: '2026-10-07', due_today: false }), task('01JA7Q3M2K8V5R1T9W4X6Y0T02', 'Due today')], total: 2, upcoming: false },
  overdue: { total: 7 },
  payments_due: { items: [], total: 5, total_paise: 52000000, window_days: 14 },
  budget: { planned_paise: 400000000, spent_paise: 79535000, still_to_pay_paise: 168000000, left_paise: 320465000, free_paise: 152465000, not_yet_split_paise: 0 },
};
const lines = (n) => Array.from({ length: n }, (_, i) => ({ at: `2026-10-08T09:0${i}:00Z`, sentence: `Line ${i + 1}` }));
const admin = {
  ...family,
  safety: { status: 'red', checks: { backup: { status: 'red', last_ok_at: '2026-10-07T06:12:31Z', hours_ago: 27 }, restore_drill: { status: 'green' }, database: { status: 'green' } }, trash_batches: 2 },
  recent_activity: [{ at: '2026-10-08T09:00:00Z', sentence: 'Mahi changed City from Bhilwara to Udaipur.' }, ...lines(4)],
  start_here: [{ key: 'event_dates', done: true }, { key: 'members', done: true }, { key: 'guests', done: false }, { key: 'payment', done: true }],
};
const photo = (id, slot, n) => ({ id, version: 1, slot, sort_order: n, width_px: 1600, height_px: 1200, url: `/api/v1/home-photos/${id}/image?v=abc${n}` });
const PHOTOS = [
  photo('01JB0000000000000000000C01', 'cover', 0), photo('01JB0000000000000000000C02', 'cover', 1),
  photo('01JB0000000000000000000P01', 'couple', 0), photo('01JB0000000000000000000P02', 'couple', 1), photo('01JB0000000000000000000P03', 'couple', 2),
  photo('01JB0000000000000000000M01', 'monogram', 0),
];

function renderAt(path) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>);
}

beforeEach(() => { vi.spyOn(Date, 'now').mockReturnValue(NOW); });
afterEach(() => { act(() => dismiss()); signOut(); vi.restoreAllMocks(); });

describe('Countdown maths (IST calendar)', () => {
  test('Months : Days : Hours to midnight IST on 14 Feb 2027', () => {
    expect(monthsDaysHours(NOW, Date.parse('2027-02-13T18:30:00Z'))).toEqual({ months: 4, days: 5, hours: 9 });
    expect(monthsDaysHours(Date.parse('2026-10-31T06:30:00Z'), Date.parse('2026-11-30T18:30:00Z'))).toEqual({ months: 1, days: 0, hours: 12 }); // 31 Oct 12:00 → 1 Dec 00:00 IST
    expect(monthsDaysHours(Date.parse('2027-01-31T18:30:00Z'), Date.parse('2027-02-13T18:30:00Z'))).toEqual({ months: 0, days: 13, hours: 0 });
    expect(monthsDaysHours(Date.parse('2027-02-13T18:30:00Z'), Date.parse('2027-02-13T18:30:00Z'))).toBeNull();
  });
});

describe('Home', () => {
  test('admin: photos with monogram, countdown, upcoming events, tasks, overdue, recent activity; no money or safety cards', async () => {
    signInAs('ayush');
    fakeApi({ 'GET /dashboard': () => ok(admin), 'GET /home-photos': () => ok(PHOTOS) });
    const { container } = renderAt('/');
    const timer = await screen.findByRole('timer');
    expect(timer).toHaveAccessibleName('4 months, 5 days and 9 hours to the wedding'); // AC-DASH-01, live in IST
    expect(within(timer).getAllByText(/^0\d$/).map((x) => x.textContent)).toEqual(['04', '05', '09']);
    expect(screen.getByText('to the wedding · Sun, 14 Feb 2027')).toBeInTheDocument();
    // Cover slideshow: 2 photos, dots, monogram on top
    const carousel = screen.getByRole('region', { name: 'Cover photos' });
    expect(within(carousel).getAllByRole('img', { name: /^Photo \d of 2$/ })).toHaveLength(2);
    expect(within(carousel).getByRole('img', { name: 'A&M monogram' })).toHaveAttribute('src', '/api/v1/home-photos/01JB0000000000000000000M01/image?v=abc0');
    expect(within(carousel).getAllByRole('button', { name: /^Photo \d of 2$/ })).toHaveLength(2);
    expect(within(screen.getByRole('region', { name: 'Ayush and Mahi' })).getAllByRole('img')).toHaveLength(3);
    // Upcoming events, soonest first
    const up = screen.getByRole('region', { name: 'Upcoming events' });
    expect(within(up).getAllByRole('link').map((a) => a.textContent).filter((x) => !x.startsWith('Upcoming'))[0]).toMatch(/^Mehndi/);
    expect(within(up).getByRole('link', { name: /Mehndi/ })).toHaveAttribute('href', `/calendar/events/${mehndi.id}`);
    // My tasks: overdue first (AC-DASH-02); everyone's overdue
    const my = screen.getByRole('region', { name: 'My tasks' });
    const titles = within(my).getAllByRole('link').map((a) => a.textContent).filter((x) => x.startsWith('Due'));
    expect(titles[0]).toMatch(/^Due yesterday/);
    expect(screen.getByRole('link', { name: /7 overdue tasks/ })).toHaveAttribute('href', '/tasks?view=overdue');
    // Removed from Home
    for (const card of ['Payments due', 'Budget', 'Headcount', 'Safety']) expect(screen.queryByRole('region', { name: card })).toBeNull();
    expect(screen.queryByText('Last backup 27 hours ago')).toBeNull();
    // Recent activity: 3 lines, then Show more opens a scrolling list
    const recent = screen.getByRole('region', { name: 'Recent activity' });
    expect(within(recent).getAllByRole('listitem')).toHaveLength(3);
    expect(await axe(container)).toHaveNoViolations();
  });

  test('recent activity: Show more → a scrolling list with Show older; Show less folds it', async () => {
    signInAs('mahi');
    const user = userEvent.setup();
    fakeApi({
      'GET /dashboard': () => ok(admin), 'GET /home-photos': () => ok([]),
      'GET /activity': () => new Response(JSON.stringify({ ok: true, data: lines(9), meta: { has_more: true, next_cursor: 'c2' } }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    });
    renderAt('/');
    const recent = await screen.findByRole('region', { name: 'Recent activity' });
    await user.click(within(recent).getByRole('button', { name: 'Show more' }));
    const box = await within(recent).findByTestId('activity-scroll');
    expect(box.className).toMatch(/max-h-96/);
    expect(box.className).toMatch(/overflow-y-auto/);
    expect(await within(box).findByText('Line 9')).toBeInTheDocument();
    expect(within(box).getByRole('button', { name: 'Show older' })).toBeInTheDocument();
    await user.click(within(recent).getByRole('button', { name: 'Show less' }));
    expect(within(recent).queryByTestId('activity-scroll')).toBeNull();
  });

  test('no photos yet: placeholders hold their place; Ayush and Mahi get a link to add them', async () => {
    signInAs('ayush');
    fakeApi({ 'GET /dashboard': () => ok(admin), 'GET /home-photos': () => ok([]) });
    renderAt('/');
    expect(await screen.findByTestId('cover-placeholder')).toHaveTextContent('Ayush & Mahi');
    expect(screen.getByTestId('monogram')).toHaveTextContent('A&M');
    expect(await screen.findByRole('link', { name: /Add Home photos/ })).toHaveAttribute('href', '/settings/home-photos');
  });

  test('AC-DASH-03: Family sees tasks and upcoming events, no recent activity; ticking works; no Task in the + sheet', async () => {
    signInAs('mummy');
    const user = userEvent.setup();
    const calls = fakeApi({
      'GET /dashboard': () => ok({ ...family, recent_activity: lines(2) }), 'GET /home-photos': () => ok([]),
      'POST /tasks/{id}/done': () => new Response(JSON.stringify({ ok: true, data: { ...task('01JA7Q3M2K8V5R1T9W4X6Y0T02', 'Due today'), status: 'done' }, meta: { undo: { batch_id: 'B1', until: 'x', summary: 'Done: Due today' } } }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    });
    renderAt('/');
    await screen.findByRole('timer');
    expect(screen.getByRole('region', { name: 'Upcoming events' })).toBeInTheDocument();
    for (const card of ['Payments due', 'Budget', 'Safety', 'Recent activity', 'Start here', 'Headcount']) expect(screen.queryByRole('region', { name: card })).toBeNull();
    expect(screen.queryByRole('link', { name: /Add Home photos/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Mark done: Due today' }));
    expect(await screen.findByText('Done: Due today')).toBeInTheDocument();
    await vi.waitFor(() => expect(calls.mock.calls.filter(([u]) => u === '/api/v1/dashboard').length).toBeGreaterThan(1));
    act(() => dismiss());
    await user.click(screen.getByRole('button', { name: 'Add' }));
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).queryByRole('button', { name: /Task/ })).toBeNull();
    expect(within(sheet).getByRole('button', { name: /Family/ })).toBeInTheDocument();
  });

  test('Viewer: countdown and upcoming events; no tasks; no + button', async () => {
    signInAs('nani');
    fakeApi({ 'GET /dashboard': () => ok(base), 'GET /home-photos': () => ok([]) });
    renderAt('/');
    await screen.findByRole('timer');
    expect(screen.queryByRole('region', { name: 'My tasks' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Upcoming events' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
  });

  test('during the wedding: "Day 1 of 3"', async () => {
    signInAs('nani');
    fakeApi({ 'GET /dashboard': () => ok({ ...base, countdown: { days_to_wedding: null, wedding_day: 1, wedding_days: 3, wedding_start_date: '2027-02-14', wedding_starts_at: '2027-02-13T18:30:00Z', next_event: null } }), 'GET /home-photos': () => ok([]) });
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2027-02-14T03:00:00Z'));
    renderAt('/');
    expect(await screen.findByText('Day 1 of 3')).toBeInTheDocument();
    expect(screen.queryByRole('timer')).toBeNull();
  });
});
