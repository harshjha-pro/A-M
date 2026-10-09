// Documents (FEATURES B7): list with type filter, upload with progress and checksum,
// duplicate → Open it / Save again, failure → Try again with the same key, login ends
// mid-upload → re-sent after login, who may change what, receipts on a payment
// (US-DOC-01, AC-MON-09), and the photo-shrinking rules (AC-DOC-01).
import { describe, test, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, within, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from '../../test/axe.js';
import { routes } from '../../routes.jsx';
import LoginSheet from '../../components/LoginSheet.jsx';
import { fakeApi, ok, fail, signInAs, signOut, PEOPLE, permissionsFor } from '../../test/helpers.js';
import { dismiss } from '../../undo/undoStore.js';
import { fitSize, jpegName, compressImage, HeicError, isHeic, MAX_SIDE } from '../../lib/compressImage.js';
import { formatBytes, sha256Hex, canChange } from '../../data/documents.js';

const D1 = '01JA7Q3M2K8V5R1T9W4X6Y0D01';
const P1 = '01JA7Q3M2K8V5R1T9W4X6Y0P01';
const V1 = '01JA7Q3M2K8V5R1T9W4X6Y0V01';
const doc = (over = {}) => ({
  id: D1, version: 1, title: 'Receipt – Shree Tent House – 8 Oct 2026', type: 'receipt', is_private: false, notes: null,
  file: { id: 'f', original_name: 'receipt.jpg', mime_type: 'image/jpeg', size_bytes: 412000, sha256: 'a'.repeat(64), width_px: 1600, height_px: 1200 },
  payment: null, vendor: { id: V1, name: 'Shree Tent House', deleted: false }, event: null,
  file_url: `/api/v1/documents/${D1}/file`, created_at: '2026-10-08T09:12:31Z', created_by: { id: PEOPLE.papa.id, name: 'Papa' }, updated_at: '2026-10-08T09:12:31Z',
  ...over,
});
const page = (rows, meta = {}) => new Response(JSON.stringify({ ok: true, data: rows, meta: { request_id: 'r', server_time: 'x', has_more: false, next_cursor: null, ...meta } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
const pdf = (name = 'contract.pdf') => new File(['%PDF-1.4 tent contract'], name, { type: 'application/pdf' });

function renderAt(path) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /><LoginSheet /></QueryClientProvider>);
  return { router, ...utils };
}

beforeEach(() => { try { localStorage.clear(); } catch { /* none */ } });
afterEach(() => { act(() => dismiss()); signOut(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Document list', () => {
  test('shows documents with type · vendor · date; a type chip filters on the server', async () => {
    signInAs('papa');
    const calls = [];
    fakeApi({ 'GET /documents': (_b, init) => { calls.push(init); return page([doc()]); } });
    const fetchFn = globalThis.fetch;
    const user = userEvent.setup();
    const { container } = renderAt('/documents');
    expect(await screen.findByText('Receipt – Shree Tent House – 8 Oct 2026')).toBeInTheDocument();
    expect(screen.getByText(/Receipt · Shree Tent House · Thu, 8 Oct 2026/)).toBeInTheDocument();
    expect(container.querySelector('img[loading="lazy"]')).toHaveAttribute('src', `/api/v1/documents/${D1}/file`);
    await user.click(screen.getByRole('radio', { name: 'Contract' }));
    await waitFor(() => expect(fetchFn.mock.calls.some(([url]) => String(url).includes('type=contract'))).toBe(true));
    expect(await axe(container)).toHaveNoViolations();
  });

  test('empty list says what to do; Viewers get no + button', async () => {
    signInAs('nani');
    fakeApi({ 'GET /documents': () => page([]) });
    renderAt('/documents');
    expect(await screen.findByText('No documents. Take a photo of a receipt or contract.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add document' })).toBeNull();
  });
});

describe('Upload', () => {
  test('a PDF uploads with progress, its SHA-256, type and title; the list refreshes', async () => {
    signInAs('papa');
    const user = userEvent.setup();
    const sent = [];
    fakeApi({
      'GET /documents': () => page([]),
      'POST /documents': (form, init) => { sent.push({ form, init }); return ok(doc({ type: 'contract', title: 'Tent contract' }), 201); },
    });
    renderAt('/documents');
    await user.click(await screen.findByRole('button', { name: 'Add document' }));
    const sheet = await screen.findByRole('dialog', { name: 'Add document' });
    const file = pdf();
    await user.upload(within(sheet).getByLabelText('Choose file'), file);
    expect(within(sheet).getByText('contract.pdf')).toBeInTheDocument();
    await user.click(within(sheet).getByRole('radio', { name: 'Contract' }));
    await user.type(within(sheet).getByLabelText(/^Title/), 'Tent contract');
    await user.click(within(sheet).getByRole('button', { name: 'Upload' }));
    expect(await screen.findByText('Document saved')).toBeInTheDocument();
    expect(sent).toHaveLength(1);
    const { form, init } = sent[0];
    expect(form.get('type')).toBe('contract');
    expect(form.get('title')).toBe('Tent contract');
    expect(form.get('sha256')).toBe(await sha256Hex(file));
    expect(form.get('file').name).toBe('contract.pdf');
    expect(form.has('is_private')).toBe(false); // Family can't set private
    expect(init.headers['X-CSRF-Token']).toBe('csrf-papa');
    expect(init.headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
  });

  test('AC-DOC-04: same file again → "already saved as" with Open it and Save again', async () => {
    signInAs('ayush');
    const user = userEvent.setup();
    const forms = [];
    fakeApi({
      'GET /documents': () => page([]),
      'POST /documents': (form) => {
        forms.push(form);
        if (!form.get('allow_duplicate')) return fail(409, { code: 'duplicate_found', message: "This file is already saved as 'Tent contract'.", matches: [{ id: D1, name: 'Tent contract', match_on: 'sha256' }] });
        return ok(doc(), 201);
      },
    });
    renderAt('/documents');
    await user.click(await screen.findByRole('button', { name: 'Add document' }));
    const sheet = await screen.findByRole('dialog', { name: 'Add document' });
    await user.upload(within(sheet).getByLabelText('Choose file'), pdf());
    await user.click(within(sheet).getByRole('button', { name: 'Upload' }));
    expect(await within(sheet).findByText("This file is already saved as 'Tent contract'.")).toBeInTheDocument();
    expect(within(sheet).getByRole('link', { name: 'Open it' })).toHaveAttribute('href', `/documents/${D1}`);
    expect(forms[0].get('is_private')).toBe('false'); // admins send it
    await user.click(within(sheet).getByRole('button', { name: 'Save again' }));
    expect(await within(sheet).findByText('Uploaded')).toBeInTheDocument();
    expect(forms[1].get('allow_duplicate')).toBe('true');
  });

  test('a failed upload says "Not uploaded" and Try again sends the same Idempotency-Key', async () => {
    signInAs('papa');
    const user = userEvent.setup();
    const keys = [];
    fakeApi({
      'GET /documents': () => page([]),
      'POST /documents': (_f, init) => { keys.push(init.headers['Idempotency-Key']); return keys.length === 1 ? 'network-error' : ok(doc(), 201); },
    });
    renderAt('/documents');
    await user.click(await screen.findByRole('button', { name: 'Add document' }));
    const sheet = await screen.findByRole('dialog', { name: 'Add document' });
    await user.upload(within(sheet).getByLabelText('Choose file'), pdf());
    await user.click(within(sheet).getByRole('button', { name: 'Upload' }));
    expect(await within(sheet).findByText('Not uploaded — no internet. Try again when online.')).toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: 'Try again' }));
    expect(await within(sheet).findByText('Uploaded')).toBeInTheDocument();
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  test('too big is refused on the phone with the size; offline disables Upload', async () => {
    signInAs('papa');
    const user = userEvent.setup();
    const post = vi.fn();
    fakeApi({ 'GET /documents': () => page([]), 'POST /documents': post });
    renderAt('/documents');
    await user.click(await screen.findByRole('button', { name: 'Add document' }));
    const sheet = await screen.findByRole('dialog', { name: 'Add document' });
    const big = new File([new Uint8Array(14 * 1024 * 1024)], 'scan.pdf', { type: 'application/pdf' });
    await user.upload(within(sheet).getByLabelText('Choose file'), big);
    await user.click(within(sheet).getByRole('button', { name: 'Upload' }));
    expect(await within(sheet).findByText('Not uploaded — This file is too big (14 MB). Max 10 MB.')).toBeInTheDocument();
    expect(within(sheet).queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(post).not.toHaveBeenCalled();

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => { window.dispatchEvent(new Event('offline')); });
    expect(within(sheet).getByText('Not uploaded — no internet. Pick the file again when online.')).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Upload' })).toBeDisabled();
    vi.restoreAllMocks();
    act(() => { window.dispatchEvent(new Event('online')); }); // React Query's online manager is global
  });

  test('login ends mid-upload → login sheet → the file in memory is sent again with the same key', async () => {
    signInAs('papa');
    const user = userEvent.setup();
    const papaWire = { id: PEOPLE.papa.id, name: 'Papa', phone: '+919829000103', role: 'family', can_see_money: true };
    const keys = [];
    let loggedIn = false;
    fakeApi({
      'GET /documents': () => page([]),
      'POST /documents': (_f, init) => {
        keys.push(init.headers['Idempotency-Key']);
        if (!loggedIn) return fail(401, { code: 'session_ended', message: 'You were logged out. Please log in again.', reason: 'password_reset' });
        expect(init.headers['X-CSRF-Token']).toBe('csrf-again');
        return ok(doc(), 201);
      },
      'POST /auth/login': () => { loggedIn = true; return ok({ user: papaWire, csrf_token: 'csrf-again' }); },
      'GET /session': () => ok({ user: papaWire, permissions: permissionsFor(PEOPLE.papa), csrf_token: 'csrf-again', settings_brief: null }),
    });
    renderAt('/documents');
    await user.click(await screen.findByRole('button', { name: 'Add document' }));
    const sheet = await screen.findByRole('dialog', { name: 'Add document' });
    await user.upload(within(sheet).getByLabelText('Choose file'), pdf());
    await user.click(within(sheet).getByRole('button', { name: 'Upload' }));
    const login = await screen.findByRole('dialog', { name: 'Please log in again' });
    await user.type(within(login).getByLabelText('Password'), 'lotus-9911');
    await user.click(within(login).getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Document saved')).toBeInTheDocument();
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });
});

describe('Document page', () => {
  test('a photo shows itself; Family who uploaded it may edit and delete; History link', async () => {
    signInAs('papa');
    fakeApi({ 'GET /documents/{id}': () => ok(doc()) });
    const { container } = renderAt(`/documents/${D1}`);
    expect(await screen.findByRole('img', { name: 'Receipt – Shree Tent House – 8 Oct 2026' })).toHaveAttribute('src', `/api/v1/documents/${D1}/file`);
    expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute('href', `/api/v1/documents/${D1}/file?download=1`);
    expect(screen.getByRole('link', { name: 'Shree Tent House' })).toHaveAttribute('href', `/vendors/${V1}`);
    expect(screen.getByRole('button', { name: 'Edit details' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete document' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute('href', `/history/documents/${D1}`);
    expect(await axe(container)).toHaveNoViolations();
  });

  test("a PDF opens in the phone's viewer; Family can't change someone else's upload", async () => {
    signInAs('mummy');
    fakeApi({ 'GET /documents/{id}': () => ok(doc({ type: 'contract', file: { ...doc().file, mime_type: 'application/pdf', original_name: 'tent.pdf', width_px: null, height_px: null } })) });
    renderAt(`/documents/${D1}`);
    expect(await screen.findByRole('link', { name: 'Open' })).toHaveAttribute('target', '_blank');
    expect(screen.getByText('tent.pdf')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit details' })).toBeNull();
    expect(screen.getByText('You can change only the documents you added.')).toBeInTheDocument();
  });

  test('canChange: admins all, Family own uploads, Viewers none', () => {
    const d = { createdBy: { id: PEOPLE.papa.id } };
    expect(canChange(d, PEOPLE.ayush, permissionsFor(PEOPLE.ayush))).toBe(true);
    expect(canChange(d, PEOPLE.papa, permissionsFor(PEOPLE.papa))).toBe(true);
    expect(canChange(d, PEOPLE.mummy, permissionsFor(PEOPLE.mummy))).toBe(false);
    expect(canChange({ createdBy: { id: PEOPLE.nani.id } }, PEOPLE.nani, permissionsFor(PEOPLE.nani))).toBe(false);
  });
});

describe('Receipts on a payment', () => {
  const payment = (over = {}) => ({ id: P1, version: 1, title: 'Tent balance', kind: 'payment', amount_paise: 10000000, status: 'due', overdue: false, no_date: false, due_date: '2026-12-01', paid_on: null, method: null, paid_by: null, reference: null, notes: null, category: null, vendor: { id: V1, name: 'Shree Tent House' }, event: null, split_from: null, receipt_count: 0, ...over });

  test('AC-MON-09: paid with a receipt photo, upload fails → stays Paid, "Receipt not uploaded — try again" retries', async () => {
    signInAs('papa');
    const user = userEvent.setup();
    let paid = false;
    let tries = 0;
    const forms = [];
    fakeApi({
      'GET /payments/{id}': () => ok(payment(paid ? { status: 'paid', paid_on: '2026-10-08', method: 'upi', version: 2 } : {})),
      'POST /payments/{id}/mark-paid': () => { paid = true; return ok(payment({ status: 'paid', version: 2 })); },
      'GET /documents': () => page([]),
      'POST /documents': (form) => { forms.push(form); tries += 1; return tries === 1 ? fail(500, { code: 'server_error', message: 'Something went wrong on our side. Your changes are kept.' }) : ok(doc({ payment: { id: P1, name: 'Tent balance', deleted: false } }), 201); },
    });
    renderAt(`/money/payments/${P1}`);
    await user.click(await screen.findByRole('button', { name: 'Mark as paid' }));
    const sheet = await screen.findByRole('dialog', { name: 'Mark as paid' });
    await user.upload(within(sheet).getByLabelText('Receipt photo'), pdf('bill.pdf'));
    expect(within(sheet).getByText('Receipt: bill.pdf')).toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: 'Save as paid' }));
    const chip = await screen.findByRole('button', { name: 'Receipt not uploaded — try again' });
    expect(await screen.findByText('Paid')).toBeInTheDocument();
    expect(forms[0].get('payment_id')).toBe(P1);
    expect(forms[0].get('type')).toBe('receipt');
    await user.click(chip);
    expect(await screen.findByText('Receipt saved')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Receipt not uploaded — try again' })).toBeNull();
    expect(forms[1].get('sha256')).toBe(forms[0].get('sha256'));
  });

  test('the payment page lists its receipts and offers Add receipt photo', async () => {
    signInAs('papa');
    fakeApi({
      'GET /payments/{id}': () => ok(payment({ receipt_count: 1 })),
      'GET /documents': (_b) => page([doc({ payment: { id: P1, name: 'Tent balance', deleted: false } })]),
    });
    renderAt(`/money/payments/${P1}`);
    expect(await screen.findByRole('heading', { name: 'Receipts' })).toBeInTheDocument();
    expect(await screen.findByText('Receipt – Shree Tent House – 8 Oct 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add receipt photo' })).toBeInTheDocument();
    expect(globalThis.fetch.mock.calls.some(([url]) => String(url).includes(`payment=${P1}`))).toBe(true);
  });
});

describe('Photo shrinking (AC-DOC-01)', () => {
  test('longest side 1,600 px, never enlarged; names end in .jpg', () => {
    expect(fitSize(4032, 3024)).toEqual({ width: 1600, height: 1200 });
    expect(fitSize(3024, 4032)).toEqual({ width: 1200, height: 1600 });
    expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 });
    expect(MAX_SIDE).toBe(1600);
    expect(jpegName('IMG_2041.HEIC')).toBe('IMG_2041.jpg');
    expect(jpegName('')).toBe('photo.jpg');
  });

  test('a PDF passes through untouched; HEIC the phone cannot read → "Please share it as a JPEG photo."', async () => {
    const f = pdf();
    expect((await compressImage(f)).blob).toBe(f);
    const heic = new File(['not really'], 'IMG_1.HEIC', { type: 'image/heic' });
    expect(isHeic(heic)).toBe(true);
    vi.stubGlobal('createImageBitmap', () => Promise.reject(new Error('cannot decode')));
    URL.createObjectURL = () => 'blob:x'; // jsdom has neither
    URL.revokeObjectURL = () => {};
    HTMLImageElement.prototype.decode = () => Promise.reject(new Error('no')); // jsdom has no decode()
    await expect(compressImage(heic)).rejects.toBeInstanceOf(HeicError);
    await expect(compressImage(heic)).rejects.toThrow('Please share it as a JPEG photo.');
    await expect(compressImage(new File(['MZ'], 'x.exe', { type: 'application/x-msdownload' }))).rejects.toThrow(/not allowed/);
    delete URL.createObjectURL;
    delete HTMLImageElement.prototype.decode;
    delete URL.revokeObjectURL;
  });

  test('formatBytes uses the same words as the server', () => {
    expect(formatBytes(14 * 1024 * 1024)).toBe('14 MB');
    expect(formatBytes(1.25 * 1024 * 1024)).toBe('1.3 MB');
    expect(formatBytes(412000)).toBe('402 KB');
  });
});
