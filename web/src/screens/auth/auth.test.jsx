// Log in, set password and the login sheet (TESTING §1.7 "Session expiry").
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from '../../test/axe.js';
import { routes } from '../../routes.jsx';
import LoginSheet from '../../components/LoginSheet.jsx';
import { fakeApi, ok, fail, signInAs, signOut, PEOPLE, permissionsFor } from '../../test/helpers.js';
import { getCsrfToken, resetSession } from '../../api/session.js';
import { safeNext } from './Login.jsx';

const papaWire = { id: PEOPLE.papa.id, name: 'Papa', phone: '+919829000103', role: 'family', can_see_money: true };
const sessionReply = (csrf = 'csrf-new') => ok({ user: papaWire, permissions: { ...permissionsFor(PEOPLE.papa), events_write: false }, csrf_token: csrf, settings_brief: null });

function renderAt(path) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
      <LoginSheet />
    </QueryClientProvider>,
  );
  return router;
}

afterEach(() => signOut());

describe('Log in screen', () => {
  beforeEach(() => signOut());

  test('logs in and goes where you were heading', async () => {
    const user = userEvent.setup();
    const calls = fakeApi({
      'POST /auth/login': () => ok({ user: papaWire, csrf_token: 'csrf-login' }),
      'GET /session': () => sessionReply('csrf-login'),
      'GET /health': () => new Response('{"status":"ok"}'),
    });
    const router = renderAt('/login?next=%2Ftasks');
    await user.type(await screen.findByLabelText('Phone number'), '098290-00103');
    await user.type(screen.getByLabelText('Password'), 'test-1234');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Tasks' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/tasks');
    const [, init] = calls.mock.calls.find(([u]) => u === '/api/v1/auth/login');
    expect(JSON.parse(init.body)).toEqual({ phone: '098290-00103', password: 'test-1234' });
    expect(init.headers['Idempotency-Key']).toBeUndefined();
    expect(getCsrfToken()).toBe('csrf-login');
    expect(JSON.stringify({ ...localStorage })).not.toContain('csrf-login');
  });

  test.each([
    [fail(401, { code: 'login_failed', message: 'Phone or password is wrong.' }), 'Phone or password is wrong. Try again, or ask Ayush or Mahi.'],
    [fail(429, { code: 'login_locked', message: 'x', retry_after_seconds: 800 }), 'Too many tries. Wait 15 minutes or ask Ayush or Mahi.'],
    [fail(403, { code: 'access_ended', message: 'Your access has ended. Ask Ayush or Mahi.' }), 'Your access has ended. Ask Ayush or Mahi.'],
  ])('plain words for problems (%#)', async (reply, text) => {
    const user = userEvent.setup();
    fakeApi({ 'POST /auth/login': () => reply });
    renderAt('/login');
    await user.type(await screen.findByLabelText('Phone number'), '9829000103');
    await user.type(screen.getByLabelText('Password'), 'wrong-one');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByLabelText('Phone number')).toHaveValue('9829000103');
  });

  test('Show reveals the password; the page passes axe', async () => {
    const user = userEvent.setup();
    fakeApi({});
    const { container } = render(<div />);
    renderAt('/login');
    const pw = await screen.findByLabelText('Password');
    expect(pw).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show' }));
    expect(pw).toHaveAttribute('type', 'text');
    expect(await axe(document.body)).toHaveNoViolations();
    expect(container).toBeTruthy();
  });

  test('empty fields get a plain message, nothing is sent', async () => {
    const user = userEvent.setup();
    const calls = fakeApi({});
    renderAt('/login');
    await user.click(await screen.findByRole('button', { name: 'Log in' }));
    expect(screen.getByText('Enter your phone number and password.')).toBeInTheDocument();
    expect(calls.mock.calls.filter(([u]) => u === '/api/v1/auth/login')).toHaveLength(0);
  });

  test('never redirects to another site after login', () => {
    expect(safeNext('/tasks?view=mine')).toBe('/tasks?view=mine');
    expect(safeNext('//evil.example')).toBe('/');
    expect(safeNext('https://evil.example')).toBe('/');
    expect(safeNext(null)).toBe('/');
  });
});

describe('Set password from a WhatsApp link', () => {
  beforeEach(() => signOut());

  test('reads the token from the #fragment, hides it, and logs in', async () => {
    const user = userEvent.setup();
    const token = 'q8N3'.padEnd(43, 'x');
    window.history.replaceState(null, '', `/set-password#t=${token}`);
    const calls = fakeApi({
      'POST /auth/password-link/inspect': () => ok({ purpose: 'invite', name: 'Sunita Porwal', phone_masked: '+91 98••• ••345', expires_at: '2026-10-11T09:12:31Z' }),
      'POST /auth/password-link/complete': () => ok({ user: papaWire, csrf_token: 'csrf-link' }),
      'GET /session': () => sessionReply('csrf-link'),
      'GET /health': () => new Response('{"status":"ok"}'),
    });
    renderAt('/set-password');
    expect(await screen.findByText('Welcome, Sunita Porwal. Choose a password.')).toBeInTheDocument();
    expect(window.location.hash).toBe('');
    await user.type(screen.getByLabelText('New password'), 'gulab-2233');
    await user.click(screen.getByRole('button', { name: 'Save password' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument();
    const [, init] = calls.mock.calls.find(([u]) => u === '/api/v1/auth/password-link/complete');
    expect(JSON.parse(init.body)).toEqual({ token, new_password: 'gulab-2233' });
  });

  test('an old link says so plainly', async () => {
    window.history.replaceState(null, '', `/set-password#t=${'z'.repeat(43)}`);
    fakeApi({ 'POST /auth/password-link/inspect': () => fail(410, { code: 'link_invalid', message: 'x' }) });
    renderAt('/set-password');
    expect(await screen.findByText('This link has expired or was already used. Ask Ayush or Mahi for a new one.')).toBeInTheDocument();
  });
});

describe('Login ends in the middle of a form', () => {
  test('the login sheet opens over the form, typing is kept, and the save is sent once more with the same key', async () => {
    signInAs('papa');
    const user = userEvent.setup();
    const keys = [];
    let loggedIn = false;
    fakeApi({
      'GET /members/{id}': () => ok({ ...papaWire, version: 1, is_active: true, left: false, access_ends_on: null }),
      'GET /me/sessions': () => ok([]),
      'PATCH /members/{id}': (body, init) => {
        keys.push(init.headers['Idempotency-Key']);
        if (!loggedIn) return fail(401, { code: 'session_ended', message: 'You were logged out. Please log in again.', reason: 'password_reset' });
        expect(init.headers['X-CSRF-Token']).toBe('csrf-again');
        return ok({ ...papaWire, name: body.name, version: 2, is_active: true, left: false });
      },
      'POST /auth/login': () => { loggedIn = true; return ok({ user: papaWire, csrf_token: 'csrf-again' }); },
      'GET /session': () => sessionReply('csrf-again'),
    });
    renderAt('/settings/account');
    const name = await screen.findByLabelText('Your name');
    await screen.findByDisplayValue('Papa');
    await user.clear(name);
    await user.type(name, 'Rajendra Porwal');
    await user.click(screen.getByRole('button', { name: 'Save name' }));

    const sheet = await screen.findByRole('dialog', { name: 'Please log in again' });
    expect(within(sheet).getByText('Your changes are safe. Log in to save them.')).toBeInTheDocument();
    expect(within(sheet).getByLabelText('Phone number')).toHaveValue('+919829000103');
    expect(screen.getByLabelText('Your name')).toHaveValue('Rajendra Porwal'); // form kept underneath
    await user.type(within(sheet).getByLabelText('Password'), 'lotus-9911');
    await user.click(within(sheet).getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText(/Saved ✓/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]); // same Idempotency-Key: never saved twice
  });

  test('Cancel on the sheet keeps the form and does not save', async () => {
    signInAs('papa');
    const user = userEvent.setup();
    fakeApi({
      'GET /members/{id}': () => ok({ ...papaWire, version: 1, is_active: true, left: false, access_ends_on: null }),
      'GET /me/sessions': () => ok([]),
      'PATCH /members/{id}': () => fail(401, { code: 'not_logged_in', message: 'Please log in again.' }),
    });
    renderAt('/settings/account');
    await screen.findByDisplayValue('Papa');
    await user.type(screen.getByLabelText('Your name'), ' ji');
    await user.click(screen.getByRole('button', { name: 'Save name' }));
    const sheet = await screen.findByRole('dialog');
    await user.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByLabelText('Your name')).toHaveValue('Papa ji');
    expect(screen.queryByText(/Saved ✓/)).toBeNull();
  });
});

describe('Login ends while a screen is loading', () => {
  test('the sheet opens over the screen; Cancel goes to Log in with the reason', async () => {
    signInAs('papa');
    const user = userEvent.setup();
    fakeApi({
      'GET /members': () => fail(401, { code: 'session_ended', message: 'x', reason: 'password_reset' }),
    });
    const router = renderAt('/settings/members');
    const sheet = await screen.findByRole('dialog', { name: 'Please log in again' });
    await user.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('Your password was changed. Please log in again.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });
});

test('resetSession is a clean slate', () => {
  signInAs('ayush');
  resetSession();
  expect(getCsrfToken()).toBeNull();
});
