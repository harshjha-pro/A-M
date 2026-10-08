// Members, member form, wedding details: role-based controls and what is sent.
import { describe, test, expect, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from '../../test/axe.js';
import { routes } from '../../routes.jsx';
import { fakeApi, ok, fail, signInAs, signOut, PEOPLE } from '../../test/helpers.js';

const UUID = /^[0-9a-f-]{36}$/;
const members = [
  { id: PEOPLE.ayush.id, name: 'Ayush', phone: '+919829000101', role: 'owner', left: false, last_seen_at: '2026-10-08T05:12:00Z' },
  { id: PEOPLE.papa.id, name: 'Papa', phone: '+919829000103', role: 'family', left: false, last_seen_at: null },
  { id: '01JA6ZA0000000000000000009', name: 'Kamla Devi (Dadi)', phone: '+919829000109', role: 'viewer', left: true, last_seen_at: null },
];
const settings = {
  version: 3, bride_name: 'Mahi Jagetiya', groom_name: 'Ayush Porwal', bride_side_label: "Mahi's side", groom_side_label: "Ayush's side",
  wedding_start_date: '2027-02-14', wedding_end_date: '2027-02-16', city: 'Bhilwara', total_budget_paise: 400000000, timezone: 'Asia/Kolkata', currency: 'INR',
};

function renderAt(path) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>);
  return { router, ...utils };
}

afterEach(() => signOut());

describe('Members list', () => {
  test('admins get Add member, last seen and "(left)"', async () => {
    signInAs('mahi');
    fakeApi({ 'GET /members': () => ok(members) });
    const { container } = renderAt('/settings/members');
    expect(await screen.findByRole('link', { name: 'Add member' })).toBeInTheDocument();
    expect(await screen.findByText('Kamla Devi (Dadi) (left)')).toBeInTheDocument();
    expect(screen.getByText(/Owner · \+91 98290 00101 · Last seen Thu, 8 Oct 2026, 10:42 AM IST/)).toBeInTheDocument();
    expect(screen.getByText(/Family · \+91 98290 00103 · Not logged in yet/)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  test('a Viewer sees names and phones, no buttons', async () => {
    signInAs('nani');
    fakeApi({ 'GET /members': () => ok(members.map(({ last_seen_at, ...m }) => m)) });
    renderAt('/settings/members');
    expect(await screen.findByText('Papa')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Add member' })).toBeNull();
    expect(screen.queryByRole('link', { name: /Papa/ })).toBeNull();
  });
});

describe('Add member', () => {
  test('invite by link: sends the right body once, then shows Share on WhatsApp', async () => {
    signInAs('ayush');
    const user = userEvent.setup();
    const calls = fakeApi({
      'POST /members': () => ok({
        member: { id: '01JA6ZK3D8M1T4V7W2X5Y9Q0R3', version: 1, name: 'Sunita Porwal', phone: '+919829012345', role: 'family' },
        setup_link: 'https://wedding.lumorrahouse.com/set-password#t=abc',
        setup_link_expires_at: '2026-10-11T09:12:31Z',
      }, 201),
      'GET /members': () => ok(members),
    });
    renderAt('/settings/members/new');
    await user.type(await screen.findByLabelText('Name'), 'Sunita Porwal');
    await user.type(screen.getByLabelText('Mobile number'), '98290 12345');
    await user.click(screen.getByRole('button', { name: 'Add member' }));

    const card = await screen.findByRole('heading', { name: 'Send this link to Sunita Porwal' });
    expect(card).toBeInTheDocument();
    const wa = screen.getByRole('link', { name: 'Share on WhatsApp' });
    expect(wa.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/919829012345\?text=/);
    expect(decodeURIComponent(wa.getAttribute('href'))).toContain('Namaste Sunita ji, open this link to join A&M Wedding and set your password: https://wedding.lumorrahouse.com/set-password#t=abc');
    const [, init] = calls.mock.calls.find(([u, i]) => u === '/api/v1/members' && i.method === 'POST');
    expect(JSON.parse(init.body)).toEqual({ name: 'Sunita Porwal', phone: '98290 12345', role: 'family', can_see_money: false, access_ends_on: null, password_mode: 'link' });
    expect(init.headers['Idempotency-Key']).toMatch(UUID);
    expect(init.headers['X-CSRF-Token']).toBe('csrf-ayush');
  });

  test('server field errors land under the right fields; a duplicate phone too', async () => {
    signInAs('ayush');
    const user = userEvent.setup();
    let n = 0;
    const calls = fakeApi({
      'POST /members': () => (++n === 1
        ? fail(422, { code: 'validation_failed', message: 'Please fix 1 thing below.', fields: { name: 'Please fill this in.' } })
        : fail(409, { code: 'duplicate_found', message: 'Already a member: Mummy.', matches: [] })),
    });
    renderAt('/settings/members/new');
    await user.type(await screen.findByLabelText('Mobile number'), '9829000104');
    await user.click(screen.getByRole('button', { name: 'Add member' }));
    expect(await screen.findByText('Please fill this in.')).toBeInTheDocument();
    expect(screen.getByText('Please fix 1 thing below.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Name'), 'X');
    await user.click(screen.getByRole('button', { name: 'Add member' }));
    expect(await screen.findByText('Already a member: Mummy.')).toBeInTheDocument();
    const keys = calls.mock.calls.filter(([u]) => u === '/api/v1/members').map(([, i]) => i.headers['Idempotency-Key']);
    expect(keys[0]).toBe(keys[1]); // a refused save keeps its key for the retry
  });
});

describe('Wedding details', () => {
  test('admin edits: only changed fields, with If-Match, budget typed as "45 lakh"', async () => {
    signInAs('ayush');
    const user = userEvent.setup();
    const calls = fakeApi({
      'GET /settings': () => ok(settings),
      'PATCH /settings': (body) => ok({ ...settings, ...body, version: 4 }),
    });
    renderAt('/settings/wedding');
    expect(await screen.findByText('₹40,00,000')).toBeInTheDocument();
    expect(screen.getByText('Sun, 14 Feb 2027')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const city = screen.getByLabelText('City');
    await user.clear(city);
    await user.type(city, 'Udaipur');
    const budget = screen.getByLabelText('Total budget (₹)');
    await user.clear(budget);
    await user.type(budget, '45 lakh');
    await user.click(screen.getByRole('button', { name: 'Save details' }));
    expect(await screen.findByText('₹45,00,000')).toBeInTheDocument();
    const [, init] = calls.mock.calls.find(([, i]) => i.method === 'PATCH');
    expect(JSON.parse(init.body)).toEqual({ city: 'Udaipur', total_budget_paise: 450000000 });
    expect(init.headers['If-Match']).toBe('"3"');
  });

  test('a clash names who changed it and keeps my typing', async () => {
    signInAs('ayush');
    const user = userEvent.setup();
    fakeApi({
      'GET /settings': () => ok(settings),
      'PATCH /settings': () => fail(409, { code: 'version_conflict', message: 'Mahi changed this at 10:42 AM while you were editing.',
        current_version: 4, your_version: 3, changed_by: { id: PEOPLE.mahi.id, name: 'Mahi' }, changed_fields: ['city'], current: { ...settings, version: 4, city: 'Jaipur' } }),
    });
    renderAt('/settings/wedding');
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    await user.clear(screen.getByLabelText('City'));
    await user.type(screen.getByLabelText('City'), 'Udaipur');
    await user.click(screen.getByRole('button', { name: 'Save details' }));
    expect(await screen.findByText(/Mahi changed these details while you were editing/)).toBeInTheDocument();
    expect(screen.getByLabelText('City')).toHaveValue('Udaipur');
    expect(screen.queryByText(/Saved ✓/)).toBeNull();
  });

  test('family and viewers only read, and never see the budget without money access', async () => {
    signInAs('mummy');
    const { total_budget_paise, ...noMoney } = settings;
    fakeApi({ 'GET /settings': () => ok(noMoney) });
    renderAt('/settings/wedding');
    expect(await screen.findByText('Only Ayush and Mahi can change these.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByText('Total budget (₹)')).toBeNull();
  });
});

describe('Edit member', () => {
  test('owner is locked; reset password asks first and shows the new password once', async () => {
    signInAs('ayush');
    const user = userEvent.setup();
    fakeApi({
      'GET /members/{id}': (b, i) => ok({ id: PEOPLE.papa.id, version: 2, name: 'Papa', phone: '+919829000103', role: 'family', can_see_money: true, is_active: true, access_ends_on: null, left: false }),
      'POST /members/{id}/password-reset': () => ok({ password_once: 'rose-4821', sessions_revoked: 1 }),
    });
    renderAt(`/settings/members/${PEOPLE.papa.id}`);
    await screen.findByRole('heading', { level: 1, name: 'Papa' });
    await user.click(screen.getByText('Make a password for me', { selector: 'span' }));
    await user.click(screen.getByRole('button', { name: 'Reset password' }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('They will be logged out on every phone.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Reset password' }));
    expect(await screen.findByTestId('secret')).toHaveTextContent('rose-4821');
  });
});
