// Money screens (FEATURES B6): totals with Over by (AC-MON-01/05), ₹ typing → exact paise
// (AC-MON-02), add with a new vendor, duplicate → Save anyway, mark paid and pay part
// sheets, non-money people never see amounts (AC-MON-06), access lost → drafts dropped.
import { describe, test, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from '../../test/axe.js';
import { routes } from '../../routes.jsx';
import { fakeApi, ok, fail, signInAs, signOut, PEOPLE } from '../../test/helpers.js';
import { dismiss } from '../../undo/undoStore.js';
import { saveDraft, loadDraft, draftKey } from '../../forms/drafts.js';
import { readAmount } from '../../components/MoneyField.jsx';

const P1 = '01JA7Q3M2K8V5R1T9W4X6Y0P01';
const V1 = '01JA7Q3M2K8V5R1T9W4X6Y0V01';
const cat = (over = {}) => ({ id: '01M4DK5T3QATV30ZX2E0B6P7GZ', version: 1, name: 'Clothing', planned_paise: 10000000, spent_paise: 7500000, due_paise: 2750000, left_paise: 2500000, is_over: true, is_fallback: false, sort_order: 50, deleted: false, ...over });
const summary = { planned_paise: 400000000, spent_paise: 65000000, still_to_pay_paise: 30000000, left_paise: 335000000, free_paise: 305000000, not_yet_split_paise: 0, total_budget_set: true, categories: [cat(), cat({ id: '01M4DK5T4047VSDK59NPGBMAH7', name: 'Miscellaneous', planned_paise: 0, spent_paise: 0, due_paise: 0, is_over: false, is_fallback: true })] };
const payment = (over = {}) => ({ id: P1, version: 1, title: 'Tent balance', kind: 'payment', amount_paise: 10000000, status: 'due', overdue: false, no_date: false, due_date: '2026-12-01', paid_on: null, method: null, paid_by: null, reference: null, notes: null, category: { id: 'c', name: 'Tent & Decor' }, vendor: { id: V1, name: 'Shree Tent House' }, event: null, split_from: null, receipt_count: 0, ...over });
const withUndo = (data, summaryText) => new Response(JSON.stringify({ ok: true, data, meta: { request_id: 'r', server_time: 'x', undo: { batch_id: '01JA7Q3M2K8V5R1T9W4X6Y0B01', until: 'x', summary: summaryText } } }), { status: 200, headers: { 'Content-Type': 'application/json' } });

function renderAt(path) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>);
  return { router, ...utils };
}

beforeEach(() => { try { localStorage.clear(); } catch { /* none */ } });
afterEach(() => { act(() => dismiss()); signOut(); vi.restoreAllMocks(); });

describe('Budget', () => {
  test('AC-MON-01/05: Planned · Spent · Still to pay · Left · Free; a red "Over by" category', async () => {
    signInAs('papa');
    fakeApi({ 'GET /money/summary': () => ok(summary) });
    const { container } = renderAt('/money');
    expect(await screen.findByText('₹40,00,000')).toBeInTheDocument();
    expect(screen.getByText('₹6,50,000')).toBeInTheDocument();
    expect(screen.getByText('₹3,00,000')).toBeInTheDocument();
    expect(screen.getByText('₹33,50,000')).toBeInTheDocument();
    expect(screen.getByText('Free ₹30,50,000')).toBeInTheDocument();
    expect(screen.getByText(/Over by ₹2,500/)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  test('a category with payments: Delete asks where to move them, then sends move_payments_to', async () => {
    signInAs('ayush');
    const user = userEvent.setup();
    const bodies = [];
    fakeApi({
      'GET /money/summary': () => ok(summary),
      'DELETE /budget-categories/{id}': (body) => {
        bodies.push(body);
        return body.move_payments_to ? withUndo({ moved: 4 }, 'Deleted Clothing · 4 payments moved to Miscellaneous')
          : fail(422, { code: 'rule_blocked', message: 'Move 4 payments to another category first.', rule: 'category_has_payments', count: 4 });
      },
    });
    renderAt('/money');
    await user.click(await screen.findByRole('button', { name: /^Clothing/ }));
    await user.click(screen.getByRole('button', { name: 'Delete category' }));
    expect(await screen.findByText('Move 4 payments first')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Move them to'), '01M4DK5T4047VSDK59NPGBMAH7');
    await user.click(screen.getByRole('button', { name: 'Move and delete' }));
    expect(await screen.findByText('Deleted Clothing · 4 payments moved to Miscellaneous')).toBeInTheDocument();
    expect(bodies[1]).toEqual({ move_payments_to: '01M4DK5T4047VSDK59NPGBMAH7' });
  });

  test('money access ended: a plain message, and drafts with amounts are thrown away', async () => {
    const papa = signInAs('papa');
    const key = draftKey(papa.id, 'payment', 'new');
    saveDraft(key, { values: { title: 'Tent', amount: '50000' } });
    const keep = draftKey(papa.id, 'task', 'new');
    saveDraft(keep, { values: { title: 'Call' } });
    fakeApi({ 'GET /money/summary': () => fail(403, { code: 'no_money_access', message: 'You no longer have access to Money.' }) });
    renderAt('/money');
    expect(await screen.findByText('You no longer have access to Money.')).toBeInTheDocument();
    await vi.waitFor(() => expect(loadDraft(key)).toBeNull());
    expect(loadDraft(keep)).not.toBeNull();
  });
});

describe('Payment form', () => {
  test('AC-MON-02: "1.25 lakh" shows ₹1,25,000 and sends 12500000 paise; a new vendor typed in', async () => {
    signInAs('papa');
    const user = userEvent.setup();
    const posts = [];
    fakeApi({
      'GET /budget-categories': () => ok(summary.categories),
      'GET /vendors': () => ok([{ id: V1, name: 'Shree Tent House', category: 'tent_decor' }]),
      'GET /events': () => ok([]),
      'POST /payments': (body) => { posts.push(body); return ok(payment({ amount_paise: 12500000 }), 201); },
      'GET /payments/{id}': () => ok(payment()),
    });
    const { container } = renderAt('/money/payments/new');
    await user.type(await screen.findByLabelText(/What for/), 'Tent advance');
    await user.type(screen.getByLabelText('Amount (₹)'), '1.25 lakh');
    expect(screen.getByText('₹1,25,000')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Paid to'), '__new__');
    await user.type(screen.getByLabelText('New vendor name'), 'Test Tent');
    await user.type(screen.getByLabelText('Due date (optional)'), '2026-10-11');
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole('button', { name: 'Save payment' }));
    await vi.waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({ title: 'Tent advance', amount_paise: 12500000, new_vendor: { name: 'Test Tent' }, status: 'due', due_date: '2026-10-11' });
  });

  test('AC-MON-08: duplicate warning → Save anyway resends with allow_duplicate', async () => {
    signInAs('papa');
    const user = userEvent.setup();
    const posts = [];
    fakeApi({
      'GET /budget-categories': () => ok(summary.categories),
      'GET /vendors': () => ok([{ id: V1, name: 'Shree Tent House', category: 'tent_decor' }]),
      'GET /events': () => ok([]),
      'POST /payments': (body) => { posts.push(body); return posts.length === 1 ? fail(409, { code: 'duplicate_found', message: "Looks like a duplicate of 'Tent advance' ₹50,000 on 12 Oct.", matches: [{ id: P1, name: 'Tent advance' }] }) : ok(payment(), 201); },
      'GET /payments/{id}': () => ok(payment()),
    });
    renderAt('/money/payments/new');
    await user.type(await screen.findByLabelText(/What for/), 'Tent advance');
    await user.type(screen.getByLabelText('Amount (₹)'), '50000');
    await user.selectOptions(screen.getByLabelText('Paid to'), V1);
    await user.click(screen.getByRole('switch', { name: 'Paid already' }));
    await user.click(screen.getByRole('button', { name: 'Save payment' }));
    expect(await screen.findByText("Looks like a duplicate of 'Tent advance' ₹50,000 on 12 Oct.")).toBeInTheDocument();
    expect(posts[0]).toMatchObject({ vendor_id: V1, status: 'paid', method: 'upi' });
    await user.click(screen.getByRole('button', { name: 'Save anyway' }));
    await vi.waitFor(() => expect(posts).toHaveLength(2));
    expect(posts[1].allow_duplicate).toBe(true);
  });

  test('readAmount: ₹0.01 … ₹1 crore are exact; more is refused', () => {
    expect(readAmount('0.01').paise).toBe(1);
    expect(readAmount('1,00,00,000').paise).toBe(1000000000);
    expect(readAmount('1.01 crore').error).toBe('Up to ₹1,00,00,000 per payment.');
    expect(readAmount('abc').error).toBe('Enter an amount, like 50000 or 1.25 lakh.');
  });
});

describe('Payment page', () => {
  test('Mark as paid: today, UPI → one request with If-Match; Undo bar', async () => {
    signInAs('papa');
    const user = userEvent.setup();
    const calls = [];
    fakeApi({
      'GET /payments/{id}': () => ok(payment()),
      'POST /payments/{id}/mark-paid': (body, init) => { calls.push([body, init.headers['If-Match']]); return withUndo(payment({ status: 'paid', version: 2 }), 'Marked paid: Tent balance · ₹1,00,000'); },
    });
    const { container } = renderAt(`/money/payments/${P1}`);
    await user.click(await screen.findByRole('button', { name: 'Mark as paid' }));
    expect(await axe(container)).toHaveNoViolations();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save as paid' }));
    expect(await screen.findByText('Marked paid: Tent balance · ₹1,00,000')).toBeInTheDocument();
    expect(calls[0][0]).toMatchObject({ method: 'upi', paid_by: null });
    expect(calls[0][1]).toBe('"1"');
  });

  test('AC-MON-04: Pay part refuses the full amount, then sends 40,000 → "Paid ₹40,000. ₹60,000 still due."', async () => {
    signInAs('papa');
    const user = userEvent.setup();
    const bodies = [];
    fakeApi({
      'GET /payments/{id}': () => ok(payment()),
      'POST /payments/{id}/pay-part': (body) => { bodies.push(body); return withUndo({ paid: payment({ status: 'paid' }), due: payment({ amount_paise: 6000000, version: 2 }) }, 'Paid ₹40,000. ₹60,000 still due.'); },
    });
    renderAt(`/money/payments/${P1}`);
    await user.click(await screen.findByRole('button', { name: 'Pay part' }));
    const sheet = screen.getByRole('dialog');
    await user.type(within(sheet).getByLabelText('Amount paid now (₹)'), '100000');
    await user.click(within(sheet).getByRole('button', { name: 'Save as paid' }));
    expect(within(sheet).getAllByText('Part payment must be less than ₹1,00,000.').length).toBeGreaterThan(0);
    await user.clear(within(sheet).getByLabelText('Amount paid now (₹)'));
    await user.type(within(sheet).getByLabelText('Amount paid now (₹)'), '40000');
    await user.click(within(sheet).getByRole('button', { name: 'Save as paid' }));
    expect(await screen.findByText('Paid ₹40,000. ₹60,000 still due.')).toBeInTheDocument();
    expect(bodies).toHaveLength(1);
    expect(bodies[0].amount_paise).toBe(4000000);
  });
});

describe('Vendors', () => {
  test('AC-MON-06: Mummy (no money) sees contacts and Vendors in More, but no amount field and no Money', async () => {
    signInAs('mummy');
    const user = userEvent.setup();
    fakeApi({
      'GET /vendors': () => ok([{ id: V1, version: 1, name: 'Shree Tent House', category: 'tent_decor', contact_person: 'Rajesh ji', phone: '+919414012345', alt_phone: null, is_booked: true, notes: null }]),
      'GET /vendors/{id}': () => ok({ id: V1, version: 1, name: 'Shree Tent House', category: 'tent_decor', contact_person: 'Rajesh ji', phone: '+919414012345', alt_phone: null, is_booked: true, notes: null }),
    });
    const { unmount } = renderAt('/more');
    expect(await screen.findByRole('link', { name: /Vendors/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Money/ })).toBeNull();
    unmount();
    renderAt(`/vendors/${V1}`);
    expect(await screen.findByRole('link', { name: 'Call +91 94140 12345' })).toHaveAttribute('href', 'tel:+919414012345');
    expect(screen.queryByText(/Agreed/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await screen.findByLabelText('Name');
    expect(screen.queryByLabelText('Agreed amount (₹)')).toBeNull();
  });

  test('AC-MON-10: a money user sees "₹1,00,000 not yet scheduled"', async () => {
    signInAs('papa');
    fakeApi({
      'GET /vendors/{id}': () => ok({ id: V1, version: 1, name: 'Shree Tent House', category: 'tent_decor', contact_person: null, phone: null, alt_phone: null, is_booked: true, notes: null, agreed_amount_paise: 35000000, balance: { agreed_paise: 35000000, paid_paise: 10000000, due_paise: 15000000, not_scheduled_paise: 10000000 } }),
      'GET /payments': () => ok([]),
    });
    renderAt(`/vendors/${V1}`);
    expect(await screen.findByText('₹1,00,000 not yet scheduled')).toBeInTheDocument();
    expect(screen.getByText('Agreed ₹3,50,000 · paid ₹1,00,000 · due ₹1,50,000')).toBeInTheDocument();
  });
});

describe('Select mode on vendors and payments (1.0.24)', () => {
  const page = (rows) => new Response(JSON.stringify({ ok: true, data: rows, meta: { request_id: 'r', server_time: '2026-10-08T09:12:31Z', has_more: false, total: rows.length,
    totals: { amount_paise: 0, due_paise: 0, paid_paise: 0 } } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const vendor = (id, name) => ({ id, version: 1, name, category: 'tent_decor', contact_person: null, phone: null, alt_phone: null, is_booked: false, notes: null });
  const V2 = '01JA7Q3M2K8V5R1T9W4X6Y0V02';

  test('Ayush: pick vendors → Type → Florist sends one request; Delete asks first; Mummy gets no Delete', async () => {
    signInAs('ayush');
    const user = userEvent.setup();
    const calls = fakeApi({
      'GET /vendors': () => page([vendor(V1, 'Shree Tent House'), vendor(V2, 'Gupta Tent')]),
      'POST /vendors/bulk': (body) => withUndo({ affected: 2, skipped: [], batch_id: 'B' }, body.action === 'delete' ? 'Deleted 2 vendors' : 'Set type Florist for 2 vendors'),
    });
    renderAt('/vendors');
    await user.click(await screen.findByRole('button', { name: 'Select' }));
    expect(screen.getByText('2 of 2 shown')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Select all 2 shown' }));
    expect(screen.getByRole('link', { name: /Export selected/ })).toHaveAttribute('href', expect.stringContaining(`/vendors/export?ids=${V1},${V2}`));
    await user.click(screen.getByRole('button', { name: 'Type' }));
    const sheet = await screen.findByRole('dialog');
    await user.click(within(sheet).getByRole('radio', { name: 'Florist' }));
    expect(within(sheet).getByRole('status')).toHaveTextContent('2 vendors will change: Type → Florist');
    await user.click(within(sheet).getByRole('button', { name: 'Apply to 2' }));
    expect(await screen.findByText('Set type Florist for 2 vendors')).toBeInTheDocument();
    const sent = calls.mock.calls.filter(([u]) => u === '/api/v1/vendors/bulk');
    expect(JSON.parse(sent[0][1].body)).toEqual({ action: 'set_category', ids: [V1, V2], as_of: '2026-10-08T09:12:31Z', category: 'florist' });

    await user.click(screen.getByRole('button', { name: 'Select all 2 shown' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('Delete 2 vendors?');
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await vi.waitFor(() => expect(calls.mock.calls.filter(([u]) => u === '/api/v1/vendors/bulk')).toHaveLength(2));
  });

  test('Mummy can change type but has no Delete', async () => {
    signInAs('mummy');
    const user = userEvent.setup();
    fakeApi({ 'GET /vendors': () => page([vendor(V1, 'Shree Tent House')]) });
    renderAt('/vendors');
    await user.click(await screen.findByRole('button', { name: 'Select' }));
    expect(screen.getByRole('button', { name: 'Type' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  test('Papa: payments → Category → one request; no paid, amount or delete in bulk', async () => {
    signInAs('papa');
    const user = userEvent.setup();
    const calls = fakeApi({
      'GET /payments': () => page([payment()]),
      'GET /budget-categories': () => ok([cat()]),
      'GET /events': () => ok([]),
      'POST /payments/bulk': () => withUndo({ affected: 1, skipped: [], batch_id: 'B' }, 'Set category Clothing for 1 payment'),
    });
    renderAt('/money/payments');
    await user.click(await screen.findByRole('button', { name: 'Select' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Tent balance' }));
    const bar = screen.getByRole('toolbar');
    expect(within(bar).queryByRole('button', { name: /paid|Delete|Amount/i })).not.toBeInTheDocument();
    await user.click(within(bar).getByRole('button', { name: 'Category' }));
    const sheet = await screen.findByRole('dialog');
    await vi.waitFor(() => expect(within(sheet).getByRole('option', { name: 'Clothing' })).toBeInTheDocument());
    await user.selectOptions(within(sheet).getByRole('combobox'), 'Clothing');
    await user.click(within(sheet).getByRole('button', { name: 'Apply to 1' }));
    expect(await screen.findByText('Set category Clothing for 1 payment')).toBeInTheDocument();
    const sent = calls.mock.calls.find(([u]) => u === '/api/v1/payments/bulk');
    expect(JSON.parse(sent[1].body)).toEqual({ action: 'set_category', ids: [P1], as_of: '2026-10-08T09:12:31Z', category_id: cat().id });
  });
});
