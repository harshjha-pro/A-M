// Home cards per role (FEATURES B2): admin sees everything incl. Safety and money;
// Family no money cards; Viewer only countdown + headcount. AC-DASH-01/02/03/05.
import { describe, test, expect, afterEach, vi } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from '../../test/axe.js';
import { routes } from '../../routes.jsx';
import { fakeApi, ok, signInAs, signOut, PEOPLE } from '../../test/helpers.js';
import { dismiss } from '../../undo/undoStore.js';

const mummy = { id: PEOPLE.mummy.id, name: 'Mummy' };
const task = (id, title, over = {}) => ({ id, version: 1, title, status: 'todo', priority: 'normal', due_date: '2026-10-08', due_time: null, overdue: false, due_today: true,
  postpone_count: 0, assignees: [mummy], tags: [], item_count: 0, items_done: 0, event: null, ...over });
const base = {
  countdown: { days_to_wedding: 129, wedding_day: null, wedding_days: 3, wedding_start_date: '2027-02-14',
    next_event: { id: '01M4DK5T3E6QZBMNQ0V7KQWW23', name: 'Mehndi', start_at: '2027-02-14T12:30:00Z', all_day: false, venue_name: 'Porwal Niwas' } },
  headcount: [{ event: { id: '01M4DK5T3E6QZBMNQ0V7KQWW23', name: 'Mehndi' }, families_invited: 3, people_coming: 7, people_waiting: 3, people_not_asked: 0, jain_coming: 3, people_up_to: 10 }],
};
const family = {
  ...base,
  my_tasks: { items: [task('01JA7Q3M2K8V5R1T9W4X6Y0T01', 'Due yesterday', { overdue: true, due_date: '2026-10-07', due_today: false }), task('01JA7Q3M2K8V5R1T9W4X6Y0T02', 'Due today')], total: 2, upcoming: false },
  overdue: { total: 7 },
};
const admin = {
  ...family,
  payments_due: { items: [{ id: '01JA7Q3M2K8V5R1T9W4X6Y0P01', title: 'Tent advance', vendor: { id: 'x', name: 'Shree Tent House' }, amount_paise: 15000000, due_date: '2026-10-06', overdue: true }], total: 5, total_paise: 52000000, window_days: 14 },
  budget: { planned_paise: 400000000, spent_paise: 79535000, still_to_pay_paise: 168000000, left_paise: 320465000, free_paise: 152465000, not_yet_split_paise: 0 },
  safety: { status: 'red', checks: { backup: { status: 'red', last_ok_at: '2026-10-07T06:12:31Z', hours_ago: 27 }, restore_drill: { status: 'green', last_passed_on: '2026-10-02', days_ago: 6 }, database: { status: 'green' } }, trash_batches: 2 },
  recent_activity: [{ at: '2026-10-08T09:00:00Z', sentence: 'Mahi changed City from Bhilwara to Udaipur.' }],
  start_here: [{ key: 'event_dates', done: true }, { key: 'members', done: true }, { key: 'guests', done: false }, { key: 'payment', done: true }],
};

function renderAt(path) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>);
}

afterEach(() => { act(() => dismiss()); signOut(); });

describe('Home', () => {
  test('admin: countdown, next event, tasks, overdue, payments, budget, headcount, red backup, start here', async () => {
    signInAs('ayush');
    fakeApi({ 'GET /dashboard': () => ok(admin) });
    const { container } = renderAt('/');
    expect(await screen.findByText('129 days to the wedding')).toBeInTheDocument(); // AC-DASH-01
    expect(screen.getByRole('link', { name: /Next: Mehndi/ })).toHaveAttribute('href', '/calendar/events/01M4DK5T3E6QZBMNQ0V7KQWW23');
    const my = screen.getByRole('region', { name: 'My tasks' });
    const titles = within(my).getAllByRole('link').map((a) => a.textContent).filter((x) => x.startsWith('Due'));
    expect(titles[0]).toMatch(/^Due yesterday/); // AC-DASH-02: overdue first
    expect(within(my).getByText('Overdue', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /7 overdue tasks/ })).toHaveAttribute('href', '/tasks?view=overdue');
    expect(screen.getByText('5 due in 14 days · ₹5,20,000')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Budget' })).toHaveTextContent('₹40 L');
    expect(screen.getByText('Coming 7 · Waiting 3 · Not asked 0 · Jain 3')).toBeInTheDocument(); // AC-DASH-04
    expect(screen.getByText('Last backup 27 hours ago')).toBeInTheDocument();                    // AC-DASH-05
    expect(screen.getByRole('link', { name: '2 in Deleted items' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Import your guest list/ })).toHaveAttribute('href', '/guests');
    expect(screen.getByText('Mahi changed City from Bhilwara to Udaipur.')).toBeInTheDocument();
    expect(screen.getByText(/^Connected · Updated/)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  test('AC-DASH-03: Family sees tasks, no Payments, Budget or Safety; ticking works from Home', async () => {
    signInAs('mummy');
    const user = userEvent.setup();
    const calls = fakeApi({
      'GET /dashboard': () => ok(family),
      'POST /tasks/{id}/done': () => new Response(JSON.stringify({ ok: true, data: { ...task('01JA7Q3M2K8V5R1T9W4X6Y0T02', 'Due today'), status: 'done' }, meta: { undo: { batch_id: 'B1', until: 'x', summary: 'Done: Due today' } } }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    });
    renderAt('/');
    await screen.findByText('129 days to the wedding');
    for (const card of ['Payments due', 'Budget', 'Safety', 'Recent activity', 'Start here']) expect(screen.queryByRole('region', { name: card })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Mark done: Due today' }));
    expect(await screen.findByText('Done: Due today')).toBeInTheDocument();
    await vi.waitFor(() => expect(calls.mock.calls.filter(([u]) => u === '/api/v1/dashboard').length).toBeGreaterThan(1));
  });

  test('Viewer: countdown and headcount only; no + button', async () => {
    signInAs('nani');
    fakeApi({ 'GET /dashboard': () => ok(base) });
    renderAt('/');
    await screen.findByText('129 days to the wedding');
    expect(screen.queryByRole('region', { name: 'My tasks' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Headcount' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
  });

  test('during the wedding: "Day 1 of 3"', async () => {
    signInAs('nani');
    fakeApi({ 'GET /dashboard': () => ok({ ...base, countdown: { days_to_wedding: null, wedding_day: 1, wedding_days: 3, next_event: null } }) });
    renderAt('/');
    expect(await screen.findByText('Day 1 of 3')).toBeInTheDocument();
  });
});
