// API client (IMPLEMENTATION §3.4): headers, CSRF, Idempotency-Key, If-Match, 409s, typed errors.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, newIdemKey, reportProblem, TIMEOUT_MS } from './client.js';
import { setCsrfToken, clearSession, getCsrfToken } from './session.js';
import {
  OfflineError, TimeoutError, AuthError, ConflictError, DeletedError, DuplicateError, InProgressError,
  ValidationError, RuleError, UpdateRequiredError, RateLimitedError, ServerError, NotFoundError, PreconditionError,
} from './errors.js';
import { toCamel, toSnake, camelPath } from './case.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function reply(status, body, headers = {}) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}
const ok = (data, status = 200, headers) => reply(status, { ok: true, data, meta: { request_id: 'r_0000000001', server_time: '2026-10-08T09:12:31Z' } }, headers);
const fail = (status, error, headers) => reply(status, { ok: false, error, meta: { request_id: 'r_0000000002', server_time: '2026-10-08T09:12:31Z' } }, headers);

let fetchMock;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  clearSession();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const lastCall = () => {
  const [url, init] = fetchMock.mock.calls.at(-1);
  return { url, init, headers: init.headers };
};

describe('case conversion', () => {
  test('snake ↔ camel, deep, arrays, not values', () => {
    expect(toCamel({ due_date: '2026-10-20', assignees: [{ can_see_money: true }], note: 'keep_this' }))
      .toEqual({ dueDate: '2026-10-20', assignees: [{ canSeeMoney: true }], note: 'keep_this' });
    expect(toSnake({ dueDate: 'x', items: [{ isDone: true }] })).toEqual({ due_date: 'x', items: [{ is_done: true }] });
    expect(camelPath('items.2.due_date')).toBe('items.2.dueDate');
  });
});

describe('reads', () => {
  test('GET: same origin, version and device headers, no CSRF or key, camelCase reply', async () => {
    setCsrfToken('csrf-abc');
    fetchMock.mockResolvedValue(ok({ wedding_start_date: '2027-02-14', total_budget_paise: 400000000 }, 200, { ETag: '"4"' }));
    const res = await api('GET', '/settings', { query: { paymentsWindowDays: 14, rsvp: ['coming', 'waiting'] } });
    const { url, init, headers } = lastCall();
    expect(url).toBe('/api/v1/settings?payments_window_days=14&rsvp=coming%2Cwaiting');
    expect(init.method).toBe('GET');
    expect(init.credentials).toBe('same-origin');
    expect(headers['X-Client-Version']).toBe('1.0.12');
    expect(headers['X-Device']).toMatch(/^(iPhone|Android|Computer) · (installed|browser)$/);
    expect(headers['X-CSRF-Token']).toBeUndefined();
    expect(headers['Idempotency-Key']).toBeUndefined();
    expect(res.data).toEqual({ weddingStartDate: '2027-02-14', totalBudgetPaise: 400000000 });
    expect(res.meta.requestId).toBe('r_0000000001');
    expect(res.etag).toBe('"4"');
  });

  test('anonymous /health bare reply works', async () => {
    fetchMock.mockResolvedValue(reply(200, { status: 'ok' }));
    expect((await api('GET', '/health')).data).toEqual({ status: 'ok' });
  });
});

describe('writes', () => {
  test('POST: CSRF from memory, a UUID Idempotency-Key, JSON snake_case body', async () => {
    setCsrfToken('csrf-abc');
    fetchMock.mockResolvedValue(ok({ id: '01JA7S9F2C', version: 1, title: 'Call tent wala' }, 201));
    const res = await api('POST', '/tasks', { body: { title: 'Call tent wala', dueDate: '2026-10-20', assigneeIds: ['01JA'] } });
    const { init, headers } = lastCall();
    expect(init.method).toBe('POST');
    expect(headers['X-CSRF-Token']).toBe('csrf-abc');
    expect(headers['Idempotency-Key']).toMatch(UUID);
    expect(headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ title: 'Call tent wala', due_date: '2026-10-20', assignee_ids: ['01JA'] });
    expect(res.status).toBe(201);
    expect(res.idemKey).toBe(headers['Idempotency-Key']);
  });

  test('the caller key is used, and a retry sends the SAME key (no duplicates)', async () => {
    const key = newIdemKey();
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const err = await api('POST', '/tasks', { body: { title: 'x' }, idemKey: key }).catch((e) => e);
    expect(err).toBeInstanceOf(OfflineError);
    expect(err.idemKey).toBe(key);
    expect(lastCall().headers['Idempotency-Key']).toBe(key);

    fetchMock.mockResolvedValueOnce(ok({ id: '01J', version: 1 }, 201, { 'Idempotent-Replayed': 'true' }));
    const res = await api('POST', '/tasks', { body: { title: 'x' }, idemKey: err.idemKey });
    expect(lastCall().headers['Idempotency-Key']).toBe(key);
    expect(res.replayed).toBe(true);
  });

  test('a made-up key is handed back on failure so Try again can reuse it', async () => {
    fetchMock.mockResolvedValue(fail(500, { code: 'server_error', message: 'Something went wrong on our side. Nothing was saved. Please try again.' }));
    const err = await api('DELETE', '/tasks/01J', { ifMatch: 3 }).catch((e) => e);
    expect(err).toBeInstanceOf(ServerError);
    expect(err.idemKey).toMatch(UUID);
    expect(err.idemKey).toBe(lastCall().headers['Idempotency-Key']);
    expect(err.message).toBe('Something went wrong on our side. Nothing was saved. Please try again.');
  });

  test('PATCH sends If-Match with the quoted version', async () => {
    fetchMock.mockResolvedValue(ok({ version: 5 }, 200, { ETag: '"5"' }));
    await api('PATCH', '/households/01JA', { body: { adults: 5 }, ifMatch: 4, idemKey: newIdemKey() });
    expect(lastCall().headers['If-Match']).toBe('"4"');
  });

  test('client-log: no Idempotency-Key, never throws', async () => {
    fetchMock.mockResolvedValue(ok({}));
    await reportProblem({ screen: '/guests', code: 'render_error', message: 'boom' });
    const { url, headers, init } = lastCall();
    expect(url).toBe('/api/v1/client-log');
    expect(headers['Idempotency-Key']).toBeUndefined();
    expect(JSON.parse(init.body)).toMatchObject({ screen: '/guests', code: 'render_error', app_version: '1.0.12' });
    fetchMock.mockRejectedValue(new TypeError('offline'));
    await expect(reportProblem({ message: 'x' })).resolves.toBeUndefined();
  });

  test('the CSRF token is never written to storage', async () => {
    setCsrfToken('secret-token');
    expect(getCsrfToken()).toBe('secret-token');
    expect(JSON.stringify({ ...localStorage })).not.toContain('secret-token');
    expect(JSON.stringify({ ...sessionStorage })).not.toContain('secret-token');
    expect(document.cookie).not.toContain('secret-token');
  });
});

describe('409 handling (API.md §4)', () => {
  test('version_conflict → ConflictError with the current record, camelCased', async () => {
    fetchMock.mockResolvedValue(fail(409, {
      code: 'version_conflict',
      message: 'Mummy changed this family at 10:42 AM while you were editing.',
      your_version: 3, current_version: 4,
      changed_by: { id: '01JA6ZQ2', name: 'Mummy' }, changed_at: '2026-10-08T05:12:04Z',
      changed_fields: ['adults', 'jain_count'],
      current: { id: '01JA7Q', version: 4, adults: 4, jain_count: 2, updated_by: { id: '01JA6ZQ2', name: 'Mummy' } },
    }));
    const err = await api('PATCH', '/households/01JA7Q', { body: { adults: 5 }, ifMatch: 3 }).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect(err.status).toBe(409);
    expect(err.message).toBe('Mummy changed this family at 10:42 AM while you were editing.');
    expect(err.currentVersion).toBe(4);
    expect(err.yourVersion).toBe(3);
    expect(err.changedBy).toEqual({ id: '01JA6ZQ2', name: 'Mummy' });
    expect(err.changedFields).toEqual(['adults', 'jainCount']);
    expect(err.current).toMatchObject({ version: 4, jainCount: 2, updatedBy: { name: 'Mummy' } });
    expect(err.requestId).toBe('r_0000000002');
  });

  test('record_deleted, duplicate_found, request_in_progress', async () => {
    fetchMock.mockResolvedValueOnce(fail(409, { code: 'record_deleted', message: 'Papa deleted this family at 10:42 AM.', deleted_by: { name: 'Papa' }, deleted_at: '2026-10-08T05:12:04Z', can_restore: true }));
    const del = await api('PATCH', '/households/x', { body: {}, ifMatch: 1 }).catch((e) => e);
    expect(del).toBeInstanceOf(DeletedError);
    expect(del.canRestore).toBe(true);
    expect(del.deletedBy).toEqual({ name: 'Papa' });

    fetchMock.mockResolvedValueOnce(fail(409, { code: 'duplicate_found', message: 'Already on the list: Ramesh Sharma & family.', matches: [{ id: '01J', name: 'Ramesh Sharma & family', match_on: 'phone', added_by: { name: 'Papa' } }] }));
    const dup = await api('POST', '/households', { body: { name: 'Ramesh' } }).catch((e) => e);
    expect(dup).toBeInstanceOf(DuplicateError);
    expect(dup.matches[0]).toMatchObject({ matchOn: 'phone', addedBy: { name: 'Papa' } });

    fetchMock.mockResolvedValueOnce(fail(409, { code: 'request_in_progress', message: 'Still saving your last change. Please wait a moment.' }, { 'Retry-After': '2' }));
    const busy = await api('POST', '/tasks', { body: {} }).catch((e) => e);
    expect(busy).toBeInstanceOf(InProgressError);
    expect(busy.details.retryAfterSeconds).toBe(2);
  });
});

describe('other errors', () => {
  test('422 fields map to camelCase paths', async () => {
    fetchMock.mockResolvedValue(fail(422, { code: 'validation_failed', message: 'Please fix 2 things below.', fields: { phone: 'Enter a 10-digit mobile number.', 'items.2.due_date': 'Pick a date.' } }));
    const err = await api('POST', '/tasks', { body: {} }).catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.fields).toEqual({ phone: 'Enter a 10-digit mobile number.', 'items.2.dueDate': 'Pick a date.' });
  });

  test.each([
    [401, { code: 'session_ended', message: 'You were logged out. Please log in again.', reason: 'password_reset' }, AuthError],
    [404, { code: 'not_found', message: "This item doesn't exist or was removed." }, NotFoundError],
    [422, { code: 'idempotency_key_reused', message: "This save doesn't match the first try. Please try again." }, RuleError],
    [426, { code: 'update_required', message: 'Please close and reopen the app to get the latest version.' }, UpdateRequiredError],
    [428, { code: 'version_required', message: 'Please refresh and try again.' }, PreconditionError],
    [429, { code: 'rate_limited', message: 'Too many tries. Please wait 2 minutes.', retry_after_seconds: 120 }, RateLimitedError],
    [503, { code: 'app_updating', message: 'The app is being updated. Please try again in a few minutes.' }, ServerError],
  ])('%i → typed error', async (status, error, Type) => {
    fetchMock.mockResolvedValue(fail(status, error));
    const err = await api('POST', '/x', { body: {} }).catch((e) => e);
    expect(err).toBeInstanceOf(Type);
    expect(err.code).toBe(error.code);
    expect(err.message).toBe(error.message);
    if (Type === RateLimitedError) expect(err.retryAfter).toBe(120);
    if (Type === AuthError) expect(err.details.reason).toBe('password_reset');
  });

  test('an HTML error page (proxy, host) is a ServerError, never success', async () => {
    fetchMock.mockResolvedValue(new Response('<html>502 Bad Gateway</html>', { status: 502, headers: { 'Content-Type': 'text/html' } }));
    await expect(api('GET', '/health')).rejects.toBeInstanceOf(ServerError);
    fetchMock.mockResolvedValue(reply(200, { ok: false, error: { code: 'x', message: 'y' } }));
    await expect(api('GET', '/health')).rejects.toBeInstanceOf(ServerError);
  });

  test('no reply in 15 s → TimeoutError with the key to retry', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((url, init) => new Promise((_, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const p = api('POST', '/tasks', { body: { title: 'x' } }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS + 10);
    const err = await p;
    expect(err).toBeInstanceOf(TimeoutError);
    expect(err).toBeInstanceOf(OfflineError);
    expect(err.idemKey).toMatch(UUID);
  });

  test('never retries a write on its own', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await api('POST', '/tasks', { body: {} }).catch(() => {});
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
