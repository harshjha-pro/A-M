// api/client.js — the ONLY place in the app that calls fetch (IMPLEMENTATION §3.4).
//
//   api('GET',   '/health')
//   api('POST',  '/tasks',      { body, idemKey: form.clientUuid })
//   api('PATCH', '/tasks/01J…', { body: changedFieldsOnly, ifMatch: 3, idemKey })
//
// Rules:
// - Same origin, /api/v1, cookies sent (credentials: 'same-origin'). No CORS.
// - Body camelCase → snake_case; reply snake_case → camelCase.
// - Every write carries X-CSRF-Token (from memory) and an Idempotency-Key.
//   Pass the key you want reused on Try again; if you don't, one is made and
//   returned on the error (err.idemKey) and on the result (res.idemKey).
// - PATCH / PUT / single DELETE send If-Match: "<version>".
// - 15 s timeout → TimeoutError. Never retries a write by itself.
// - Never reports success for anything but a 2xx.
import { toCamel, toSnake, toSnakeKey, camelPath } from './case.js';
import { getCsrfToken, getState, askToLogin, clearSession } from './session.js';
import { deviceLabel } from '../pwa/platform.js';
import {
  ApiError, OfflineError, TimeoutError, AuthError, ForbiddenError, NotFoundError,
  ConflictError, DeletedError, DuplicateError, InProgressError, ValidationError,
  RuleError, UpdateRequiredError, PreconditionError, RateLimitedError, ServerError,
} from './errors.js';

export const API_BASE = '/api/v1';
export const TIMEOUT_MS = 15000;
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

/** A fresh Idempotency-Key (UUID v4). crypto.randomUUID: iPhone Safari 15.4+, Chrome. */
export function newIdemKey() {
  return crypto.randomUUID();
}

function buildUrl(path, query) {
  if (!path.startsWith('/')) throw new Error(`API path must start with "/": ${path}`);
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query || {})) {
    if (v === undefined || v === null || v === '') continue;
    qs.set(toSnakeKey(k), Array.isArray(v) ? v.join(',') : String(v));
  }
  const s = qs.toString();
  return `${API_BASE}${path}${s ? `?${s}` : ''}`;
}

/**
 * @param {'GET'|'POST'|'PUT'|'PATCH'|'DELETE'} method
 * @param {string} path  e.g. '/tasks/01JA…'
 * @param {{ body?: object, query?: object, ifMatch?: number, idemKey?: string,
 *           idempotent?: boolean, timeoutMs?: number, signal?: AbortSignal }} [opts]
 * @returns {Promise<{ data: any, meta: object, status: number, etag: string|null, replayed: boolean, idemKey: string|null }>}
 */
export async function api(method, path, opts = {}) {
  const m = method.toUpperCase();
  const isWrite = WRITE_METHODS.has(m);
  const idempotent = opts.idempotent !== false;
  const idemKey = isWrite && idempotent ? (opts.idemKey || newIdemKey()) : null;

  const headers = {
    Accept: 'application/json',
    'X-Client-Version': APP_VERSION,
    'X-Device': deviceLabel().slice(0, 60),
  };
  if (isWrite) {
    const csrf = getCsrfToken();
    if (csrf) headers['X-CSRF-Token'] = csrf;
    if (idemKey) headers['Idempotency-Key'] = idemKey;
  }
  if (opts.ifMatch !== undefined && opts.ifMatch !== null) {
    headers['If-Match'] = `"${opts.ifMatch}"`;
  }
  let body;
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(toSnake(opts.body));
  }

  // Timeout, plus the caller's own abort signal.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, opts.timeoutMs ?? TIMEOUT_MS);
  const onAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onAbort);

  let res;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method: m, headers, body, credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
    });
  } catch (e) {
    if (timedOut) throw new TimeoutError('No reply from the server in time.', { code: 'timeout', idemKey });
    if (opts.signal?.aborted) throw e; // the caller cancelled on purpose
    throw new OfflineError('No internet connection.', { code: 'offline', idemKey });
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }

  let json = null;
  const text = await res.text().catch(() => '');
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }

  if (res.ok) {
    // Envelope {ok, data, meta}; anonymous /health is a bare {"status": "ok"}.
    const isEnvelope = json && typeof json === 'object' && 'ok' in json;
    if (isEnvelope && json.ok !== true) {
      throw new ServerError('Unexpected reply from the server.', { status: res.status, code: 'bad_reply', idemKey });
    }
    return {
      data: toCamel(isEnvelope ? json.data : json),
      meta: toCamel(isEnvelope ? json.meta ?? {} : {}),
      status: res.status,
      etag: res.headers.get('ETag'),
      replayed: res.headers.get('Idempotent-Replayed') === 'true',
      idemKey,
    };
  }
  const err = toError(res, json, idemKey);
  if (err instanceof AuthError && !isWrite && path !== '/session' && getState().status === 'in') {
    // A screen was loading when the login ended (password reset, logged out elsewhere).
    // Open the login sheet over it — never clear the screen, it may hold typing.
    // Cancel → the Log in page, with the reason.
    askToLogin(err.details?.reason ?? err.code).catch(() => clearSession(err.details?.reason ?? null));
  }
  throw err;
}

function toError(res, json, idemKey) {
  const status = res.status;
  const err = json && json.error && typeof json.error === 'object' ? json.error : null;
  const code = err?.code || (status >= 500 ? 'server_error' : 'unknown');
  const message = err?.message || 'Something went wrong on our side. Your changes are kept.';
  const requestId = json?.meta?.request_id || res.headers.get('X-Request-Id');
  const { code: _c, message: _m, ...extra } = err || {};
  const details = toCamel(extra);
  if (Array.isArray(details.changedFields)) details.changedFields = details.changedFields.map(camelPath);
  if (details.fields && typeof details.fields === 'object') {
    details.fields = Object.fromEntries(Object.entries(err.fields).map(([k, v]) => [camelPath(k), v]));
  }
  const retryAfter = Number(res.headers.get('Retry-After'));
  if (!details.retryAfterSeconds && retryAfter > 0) details.retryAfterSeconds = retryAfter;
  const opts = { status, code, requestId, idemKey, details };

  if (!err) return new ServerError(message, opts); // HTML error page, proxy page, empty body
  switch (status) {
    case 401: return new AuthError(message, opts);
    case 403: return new ForbiddenError(message, opts);
    case 404: return new NotFoundError(message, opts);
    case 409:
      if (code === 'version_conflict') return new ConflictError(message, opts);
      if (code === 'record_deleted') return new DeletedError(message, opts);
      if (code === 'duplicate_found') return new DuplicateError(message, opts);
      if (code === 'request_in_progress') return new InProgressError(message, opts);
      return new ApiError(message, opts);
    case 422:
      if (code === 'validation_failed') return new ValidationError(message, opts);
      return new RuleError(message, opts);
    case 426: return new UpdateRequiredError(message, opts);
    case 428: return new PreconditionError(message, opts);
    case 429: return new RateLimitedError(message, opts);
    default:
      if (status >= 500) return new ServerError(message, opts);
      return new ApiError(message, opts);
  }
}

/** Phone-side problems → POST /client-log (TESTING §9.3). Never throws, never shown. */
export async function reportProblem({ screen, code, message, requestId, stack }) {
  try {
    await api('POST', '/client-log', {
      idempotent: false,
      timeoutMs: 8000,
      body: {
        at: new Date().toISOString(),
        appVersion: APP_VERSION,
        device: deviceLabel(),
        screen: String(screen || location.pathname).slice(0, 100),
        code: String(code || 'error').slice(0, 60),
        message: String(message || '').slice(0, 500),
        requestId: requestId || null,
        stack: String(stack || '').slice(0, 2000),
      },
    });
  } catch {
    /* a failed log call is never shown to the user */
  }
}
