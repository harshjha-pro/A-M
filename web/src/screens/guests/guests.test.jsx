// Guests (FEATURES B5, A7): list header and filters, add with the duplicate modal,
// Coming? chips on the invitation's version with the inline clash choice, Remove with
// Undo, WhatsApp reminder link (AC-WA-01/03/04), reminders one by one (AC-WA-02).
import { describe, test, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from '../../test/axe.js';
import { routes } from '../../routes.jsx';
import { fakeApi, ok, fail, signInAs, signOut } from '../../test/helpers.js';
import { dismiss } from '../../undo/undoStore.js';
import { reminderText, waUrl, greetName } from '../../data/guests.js';

const FAM = '01JA7Q3M2K8V5R1T9W4X6Y0H01';
const FAM2 = '01JA7Q3M2K8V5R1T9W4X6Y0H02';
const MEHNDI = '01M4DK5T3E6QZBMNQ0V7KQWW23';
const WEDDING = '01M4DK5T3H1KPRF5DMTQJ2GCYG';
const events = [
  { id: MEHNDI, name: 'Mehndi', version: 1, guests_invited: true, start_at: '2027-02-14T12:30:00Z', venue_name: 'Sukhadia Bhawan' },
  { id: WEDDING, name: 'Wedding', version: 1, guests_invited: true, start_at: '2027-02-15T13:30:00Z', venue_name: 'Hotel Ashoka' },
];
const inv = (over = {}) => ({
  household_id: FAM, event: { id: MEHNDI, name: 'Mehndi' }, version: 1, rsvp: 'not_asked', expected_adults: null, expected_children: null,
  people: 3, rsvp_note: null, rsvp_updated_at: null, rsvp_updated_by: null, last_reminder_opened_at: null, ...over,
});
const family = (over = {}) => ({
  id: FAM, version: 1, name: 'Ramesh Sharma & family', phone: '+919829012345', alt_phone: null, side: 'groom', group_name: 'Papa office',
  relation: null, area: 'Shastri Nagar', city: 'Bhilwara', address: null, adults: 2, children: 1, people: 3, food: 'veg', jain_count: 0,
  is_vip: true, notes: null, possible_duplicate: false, created_at: 'x', created_by: { id: 'u', name: 'Mummy' }, updated_at: 'x', updated_by: null,
  invitations: [inv()], ...over,
});
const page = (data, meta) => new Response(JSON.stringify({ ok: true, data, meta: { request_id: 'r', server_time: 'x', has_more: false, ...meta } }), { status: 200, headers: { 'Content-Type': 'application/json' } });

function renderAt(path) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>);
  return { router, ...utils };
}

beforeEach(() => { try { localStorage.clear(); } catch { /* none */ } });
afterEach(() => { act(() => dismiss()); signOut(); vi.restoreAllMocks(); });

describe('Guest list', () => {
  test('header "families · people", rows, side chip sends side=groom, remembered per person', async () => {
    signInAs('mummy');
    const user = userEvent.setup();
    const calls = fakeApi({
      'GET /events': () => ok(events),
      'GET /households': () => page([family(), family({ id: FAM2, name: 'Verma ji', phone: null, side: 'both', is_vip: false, people: 4, area: null, invitations: [] })], { total: 512, totals: { people: 1804 } }),
    });
    const { container, unmount } = renderAt('/guests');
    expect(await screen.findByText('512 families · 1,804 people')).toBeInTheDocument();
    const row = screen.getByRole('link', { name: /Ramesh Sharma & family/ });
    expect(within(row).getByText('3 people')).toBeInTheDocument();
    expect(within(row).getByLabelText('Important')).toBeInTheDocument();
    expect(within(screen.getByRole('link', { name: /Verma ji/ })).getByText(/No phone/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a family' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole('radio', { name: 'Groom' }));
    await vi.waitFor(() => expect(calls.mock.calls.some(([u]) => String(u).includes('side=groom'))).toBe(true));
    unmount();
    renderAt('/guests');
    await screen.findByText('512 families · 1,804 people');
    expect(screen.getByRole('radio', { name: /Groom/ })).toHaveAttribute('aria-checked', 'true');
  });

  test('event filter shows each family\'s answer and the Coming? chips; a viewer gets no add button', async () => {
    signInAs('nani');
    const user = userEvent.setup();
    const calls = fakeApi({
      'GET /events': () => ok(events),
      'GET /households': () => page([{ ...family(), invitation: inv({ rsvp: 'coming' }) }], { total: 1, totals: { people: 3 } }),
    });
    renderAt('/guests');
    await screen.findByText('1 families · 3 people');
    expect(screen.queryByRole('button', { name: 'Add a family' })).toBeNull();
    await user.selectOptions(screen.getByLabelText('Event'), MEHNDI);
    expect(await screen.findByText('· Coming')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /Waiting/ }));
    await vi.waitFor(() => expect(calls.mock.calls.some(([u]) => String(u).includes(`event=${MEHNDI}`) && String(u).includes('rsvp=waiting'))).toBe(true));
    expect(screen.queryByRole('button', { name: /reminders one by one/ })).toBeNull(); // viewers don't send
  });
});

describe('Add a family', () => {
  test('AC-GST-02: same phone → "Already on the list" before saving; Add anyway resends with allowDuplicate', async () => {
    signInAs('papa');
    const user = userEvent.setup();
    const posts = [];
    const calls = fakeApi({
      'GET /events': () => ok(events),
      'GET /households/suggestions': () => ok([]),
      'GET /households/duplicate-check': () => ok({ phone_matches: [{ id: FAM2, name: 'Sharma family', side: 'groom', phone: '+919829012345', added_by: { id: 'u', name: 'Mummy' }, match_on: 'phone' }], name_matches: [] }),
      'POST /households': (body) => {
        posts.push(body);
        return posts.length === 1
          ? fail(409, { code: 'duplicate_found', message: "Already on the list: Sharma family (Groom's side, added by Mummy)", matches: [{ id: FAM2, name: 'Sharma family' }] })
          : ok(family({ name: body.name }), 201);
      },
      'GET /households/{id}': () => ok(family()),
    });
    const { container } = renderAt('/guests/new');
    await user.type(await screen.findByLabelText(/Family name/), 'Ramesh Sharma');
    await user.type(screen.getByLabelText('Phone'), '98290 12345');
    await user.tab();
    expect(await screen.findByText(/This phone is already on the list: Sharma family/)).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /Groom's side/ }));
    await user.click(screen.getByRole('button', { name: 'More Adults' }));
    await user.click(screen.getByRole('checkbox', { name: /Mehndi/ }));
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole('button', { name: 'Save family' }));
    expect(await screen.findByText("Already on the list: Sharma family (Groom's side, added by Mummy)")).toBeInTheDocument();
    for (const a of screen.getAllByRole('link', { name: 'Open that family' })) expect(a).toHaveAttribute('href', `/guests/${FAM2}`);
    expect(posts[0]).toMatchObject({ name: 'Ramesh Sharma', phone: '+919829012345', side: 'groom', adults: 3, invite_event_ids: [MEHNDI] });
    expect(posts[0].allow_duplicate).toBeUndefined();
    await user.click(screen.getByRole('button', { name: 'Add anyway' }));
    await vi.waitFor(() => expect(posts).toHaveLength(2));
    expect(posts[1].allow_duplicate).toBe(true);
    expect(calls).toHaveBeenCalled();
  });

  test('bug fix: leaving the form at once (under 1 s) still keeps the typing as a draft', async () => {
    signInAs('papa');
    const user = userEvent.setup();
    fakeApi({ 'GET /events': () => ok(events), 'GET /households/suggestions': () => ok([]) });
    const { unmount } = renderAt('/guests/new');
    await user.type(await screen.findByLabelText(/Family name/), 'Gupta ji');
    unmount(); // e.g. tapped "Open that family" straight away
    renderAt('/guests/new');
    expect(await screen.findByText(/You have unsaved changes from/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Use them' }));
    expect(screen.getByLabelText(/Family name/)).toHaveValue('Gupta ji');
  });

  test('rules on the phone: name and side needed, people at least 1, Jain count only for Mixed', async () => {
    signInAs('papa');
    const user = userEvent.setup();
    const calls = fakeApi({ 'GET /events': () => ok(events), 'GET /households/suggestions': () => ok([]) });
    renderAt('/guests/new');
    await screen.findByLabelText(/Family name/);
    expect(screen.queryByLabelText('Jain people')).toBeNull();
    await user.click(screen.getByRole('radio', { name: /Mixed/ }));
    expect(screen.getByLabelText('Jain people')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Fewer Adults' }));
    await user.click(screen.getByRole('button', { name: 'Fewer Adults' }));
    await user.click(screen.getByRole('button', { name: 'Save family' }));
    expect(await screen.findByText('Enter a name.')).toBeInTheDocument();
    expect(screen.getByText('Pick a side.')).toBeInTheDocument();
    expect(screen.getByText('Add at least 1 person.')).toBeInTheDocument();
    expect(calls.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });
});

describe('Family page', () => {
  test('Coming? saves on the invitation\'s own version; a clash offers Keep theirs / Change to mine', async () => {
    signInAs('mummy');
    const user = userEvent.setup();
    const patches = [];
    fakeApi({
      'GET /events': () => ok(events),
      'GET /households/{id}': () => ok(family()),
      'PATCH /households/{id}/invitations/{e}': (body, init) => {
        patches.push({ body, ifMatch: init.headers['If-Match'] });
        return patches.length === 1
          ? fail(409, { code: 'version_conflict', message: 'x', your_version: 1, current_version: 2, changed_by: { id: 'u', name: 'Papa' }, changed_at: '2026-10-08T09:40:00Z', changed_fields: ['rsvp'], current: inv({ version: 2, rsvp: 'waiting' }) })
          : ok(inv({ version: 3, rsvp: 'coming', people: 3 }));
      },
    });
    const { container } = renderAt(`/guests/${FAM}`);
    const group = await screen.findByRole('radiogroup', { name: 'Coming? Mehndi' });
    expect(await axe(container)).toHaveNoViolations();
    await user.click(within(group).getByRole('radio', { name: 'Coming' }));
    expect(await screen.findByText('Papa changed this to Waiting at 3:10 PM.')).toBeInTheDocument();
    expect(patches[0]).toEqual({ body: { rsvp: 'coming' }, ifMatch: '"1"' });
    await user.click(screen.getByRole('button', { name: 'Change to Coming' }));
    await vi.waitFor(() => expect(within(group).getByRole('radio', { name: /Coming/ })).toHaveAttribute('aria-checked', 'true'));
    expect(patches[1].ifMatch).toBe('"2"');
  });

  test('Remove from an event uses Undo, not a confirm', async () => {
    signInAs('mummy');
    const user = userEvent.setup();
    const calls = fakeApi({
      'GET /events': () => ok(events),
      'GET /households/{id}': () => ok(family()),
      'DELETE /households/{id}/invitations/{e}': () => new Response(JSON.stringify({ ok: true, data: {}, meta: { request_id: 'r', server_time: 'x', undo: { batch_id: '01JA7Q3M2K8V5R1T9W4X6Y0B01', until: 'x', summary: 'Removed Ramesh Sharma & family from Mehndi' } } }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    });
    renderAt(`/guests/${FAM}`);
    await user.click(await screen.findByRole('button', { name: 'Remove from Mehndi' }));
    expect(await screen.findByText('Removed Ramesh Sharma & family from Mehndi')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    const del = calls.mock.calls.find(([, init]) => init?.method === 'DELETE');
    expect(del[1].headers['If-Match']).toBe('"1"');
  });

  test('AC-WA-01/03: reminder opens wa.me with the filled text and records the tap; no phone → disabled with the hint', async () => {
    signInAs('mummy');
    const user = userEvent.setup();
    const calls = fakeApi({
      'GET /events': () => ok(events),
      'GET /households/{id}': () => ok(family()),
      'POST /households/{id}/invitations/{e}/whatsapp-opened': () => ok({ last_reminder_opened_at: '2026-10-08T09:12:31Z' }),
    });
    renderAt(`/guests/${FAM}`);
    const link = await screen.findByRole('link', { name: 'Remind on WhatsApp' });
    const href = link.getAttribute('href');
    expect(href.startsWith('https://wa.me/919829012345?text=')).toBe(true);
    const text = decodeURIComponent(href.split('text=')[1]);
    expect(text).toBe("Namaste Ramesh Sharma ji, we'd love you to join Ayush & Mahi's Mehndi on Sun, 14 Feb 2027 at Sukhadia Bhawan. Please reply with how many will come. – Mummy");
    link.addEventListener('click', (e) => e.preventDefault());
    await user.click(link);
    await vi.waitFor(() => expect(calls.mock.calls.some(([u, init]) => String(u).endsWith('/whatsapp-opened') && init.method === 'POST')).toBe(true));
    await user.click(screen.getByRole('radio', { name: 'Hinglish' }));
    expect(decodeURIComponent(screen.getByRole('link', { name: 'Remind on WhatsApp' }).getAttribute('href'))).toContain('Ayush aur Mahi ke Mehndi');
  });

  test('AC-WA-03: no phone → the button is disabled with "Add a mobile number"', async () => {
    signInAs('mummy');
    fakeApi({ 'GET /events': () => ok(events), 'GET /households/{id}': () => ok(family({ phone: null })) });
    renderAt(`/guests/${FAM}`);
    expect(await screen.findByRole('button', { name: 'Remind on WhatsApp' })).toBeDisabled();
    expect(screen.getByText('Add a mobile number')).toBeInTheDocument();
  });
});

describe('WhatsApp text', () => {
  test('AC-WA-04: "&" and Hindi characters survive the link', () => {
    const camel = events.map((e) => ({ name: e.name, startAt: e.start_at, venueName: e.venue_name }));
    const text = reminderText({ name: 'शर्मा & family' }, camel, 'मम्मी', 'en');
    expect(text).toContain("Mehndi and Wedding on Sun, 14 Feb 2027, Mon, 15 Feb 2027 at Sukhadia Bhawan, Hotel Ashoka");
    const url = waUrl('+919829012345', text);
    expect(url).not.toMatch(/[ &]/);
    expect(decodeURIComponent(url.split('text=')[1])).toBe(text);
    expect(greetName('Ramesh Sharma & family')).toBe('Ramesh Sharma');
    expect(greetName('Verma ji')).toBe('Verma');
  });
});

describe('Reminders one by one', () => {
  test('AC-WA-02: Next moves on and the position survives a reload', async () => {
    signInAs('mummy');
    const user = userEvent.setup();
    const two = [
      { ...family(), invitation: inv({ rsvp: 'waiting' }) },
      { ...family({ id: FAM2, name: 'Verma ji', phone: '+919829099999' }), invitation: inv({ household_id: FAM2, rsvp: 'waiting' }) },
    ];
    fakeApi({ 'GET /events': () => ok(events), 'GET /households': () => page(two, { total: 2, totals: { people: 6 } }) });
    const path = `/guests/remind?event=${MEHNDI}&rsvp=waiting`;
    const { unmount } = renderAt(path);
    expect(await screen.findByText('1 of 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('heading', { name: 'Verma ji' })).toBeInTheDocument();
    unmount();
    renderAt(path);
    expect(await screen.findByText('2 of 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('All done. 2 families.')).toBeInTheDocument();
  });
});
