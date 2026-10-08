// Every route loads its screen (catches broken imports before the build does),
// and app screens need a login.
import { test, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routes } from './routes.jsx';
import { fakeApi, ok, fail, signInAs, signOut, PEOPLE, permissionsFor } from './test/helpers.js';

const settings = {
  version: 1, bride_name: 'Mahi Jagetiya', groom_name: 'Ayush Porwal', bride_side_label: "Mahi's side", groom_side_label: "Ayush's side",
  wedding_start_date: '2027-02-14', wedding_end_date: '2027-02-16', city: 'Bhilwara', total_budget_paise: null, timezone: 'Asia/Kolkata', currency: 'INR',
};
const papa = { id: PEOPLE.papa.id, name: 'Papa', phone: '+919829000103', role: 'family', can_see_money: true };

function api(extra = {}) {
  return fakeApi({
    'GET /health': () => new Response('{"status":"ok"}', { status: 200 }),
    'GET /session': () => ok({ user: papa, permissions: { ...permissionsFor(PEOPLE.papa), events_write: false }, csrf_token: 'csrf-x', settings_brief: null }),
    'GET /settings': () => ok(settings),
    'GET /members': () => ok([{ id: PEOPLE.papa.id, name: 'Papa', phone: '+919829000103', role: 'family', left: false }]),
    'GET /me/sessions': () => ok([]),
    'GET /members/{id}': () => ok({ ...papa, version: 1, is_active: true, left: false, access_ends_on: null }),
    ...extra,
  });
}

function renderAt(path) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>);
  return router;
}

beforeEach(() => signInAs('papa'));
afterEach(() => signOut());

const HEADINGS = {
  '/': 'Home', '/calendar': 'Calendar', '/tasks': 'Tasks', '/guests': 'Guests', '/more': 'More',
  '/money': 'Money', '/documents': 'Documents', '/settings': 'Settings', '/install': 'Install Guide',
  '/settings/wedding': 'Wedding details', '/settings/members': 'Members', '/settings/account': 'My account',
  '/no-such-page': 'Not found',
};

test.each(Object.entries(HEADINGS))('%s shows "%s"', async (path, heading) => {
  api();
  renderAt(path);
  expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
});

test('Log in page is open without a login', async () => {
  signOut();
  api();
  renderAt('/login');
  expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
});

test('app screens send you to Log in, and back where you were afterwards', async () => {
  signOut();
  api({ 'GET /session': () => fail(401, { code: 'not_logged_in', message: 'Please log in again.' }) });
  const router = renderAt('/settings/members');
  expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/login');
  expect(router.state.location.search).toBe('?next=%2Fsettings%2Fmembers');
});

test('a fresh start asks the server who is logged in, then shows the screen', async () => {
  const { resetSession } = await import('./api/session.js');
  resetSession();
  const fetch = api();
  renderAt('/settings');
  expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
  expect(fetch.mock.calls.some(([url]) => url === '/api/v1/session')).toBe(true);
  expect(screen.getByText('Logged in as Papa')).toBeInTheDocument();
});

test('a fresh start with no internet offers Try again', async () => {
  const { resetSession } = await import('./api/session.js');
  resetSession();
  const fetch = api();
  fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  renderAt('/');
  expect(await screen.findByText("Couldn't load this. Check your internet and try again.")).toBeInTheDocument();
  screen.getByRole('button', { name: 'Try again' }).click();
  expect(await screen.findByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument();
});

test('Home greets the person and shows the server check', async () => {
  api();
  renderAt('/');
  expect(await screen.findByText('Namaste, Papa')).toBeInTheDocument();
  expect(await screen.findByText('Connected')).toBeInTheDocument();
});

test('Home says so when the server is down', async () => {
  api({ 'GET /health': () => new Response('{"status":"fail"}', { status: 503 }) });
  renderAt('/');
  expect(await screen.findByText('Not reachable. Check your internet.', {}, { timeout: 4000 })).toBeInTheDocument();
});

test('More hides Money from people without money access', async () => {
  signInAs('mummy');
  api();
  renderAt('/more');
  await screen.findByRole('heading', { name: 'More' });
  expect(screen.queryByRole('link', { name: 'Money' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Documents' })).toBeInTheDocument();
});
