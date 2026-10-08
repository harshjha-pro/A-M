// Typed errors from api() (IMPLEMENTATION §3.4). Screens decide what to show by type.
// `message` is the server's plain sentence when there is one; `idemKey` is the key
// to reuse when the user taps Try again (API.md §2.4).

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'unknown', requestId = null, idemKey = null, details = {} } = {}) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.idemKey = idemKey;
    this.details = details;
  }
}

/** No internet, or the request never got a reply. Same key on retry. */
export class OfflineError extends ApiError {}
/** No reply within 15 s. The server MAY have saved: retry with the same key. */
export class TimeoutError extends OfflineError {}
/** 401: show the login sheet over the form, then retry once with the same key. */
export class AuthError extends ApiError {}
/** 403 */
export class ForbiddenError extends ApiError {}
/** 404 */
export class NotFoundError extends ApiError {}
/** 409 version_conflict: someone else saved first. */
export class ConflictError extends ApiError {
  constructor(message, opts) {
    super(message, opts);
    const d = opts.details;
    this.current = d.current ?? null;
    this.currentVersion = d.currentVersion ?? null;
    this.yourVersion = d.yourVersion ?? null;
    this.changedBy = d.changedBy ?? null;
    this.changedAt = d.changedAt ?? null;
    this.changedFields = d.changedFields ?? [];
  }
}
/** 409 record_deleted */
export class DeletedError extends ApiError {
  constructor(message, opts) {
    super(message, opts);
    this.deletedBy = opts.details.deletedBy ?? null;
    this.deletedAt = opts.details.deletedAt ?? null;
    this.canRestore = Boolean(opts.details.canRestore);
  }
}
/** 409 duplicate_found: show the matches, "Add anyway" resends with allowDuplicate. */
export class DuplicateError extends ApiError {
  constructor(message, opts) {
    super(message, opts);
    this.matches = opts.details.matches ?? [];
  }
}
/** 409 request_in_progress: the first try is still running; wait and retry the same key. */
export class InProgressError extends ApiError {}
/** 422 validation_failed: `fields` maps camelCase field paths to messages. */
export class ValidationError extends ApiError {
  constructor(message, opts) {
    super(message, opts);
    this.fields = opts.details.fields ?? {};
  }
}
/** 422 anything else (rule_blocked, idempotency_key_reused, checksum_mismatch) */
export class RuleError extends ApiError {}
/** 426: this app is too old to save; ask to reopen. */
export class UpdateRequiredError extends ApiError {}
/** 428: a header was missing (a bug in the app, not the user's fault). */
export class PreconditionError extends ApiError {}
/** 429 */
export class RateLimitedError extends ApiError {
  constructor(message, opts) {
    super(message, opts);
    this.retryAfter = opts.details.retryAfterSeconds ?? null;
  }
}
/** 5xx, or a reply that isn't our JSON */
export class ServerError extends ApiError {}
