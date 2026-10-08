<?php
declare(strict_types=1);

namespace AM\Auth;

use AM\Kernel\App;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Kernel\Time;

/**
 * Login sessions (API.md §3.1).
 * - Cookie __Host-am_session: 32 random bytes. Only its SHA-256 is stored.
 * - CSRF token = HMAC of the cookie value: the same for the whole session
 *   (so two tabs agree), changes with every new cookie, and can't be worked
 *   out from a stolen database. Only its SHA-256 is stored too.
 * - 90 days, sliding. last_used_at / expires_at are bookkeeping writes,
 *   at most once an hour (DATABASE rule 11).
 */
final class Sessions
{
    public const COOKIE = '__Host-am_session';
    public const LIFETIME = 90 * 86400;
    public const SLIDE_EVERY = 3600;

    public function __construct(private readonly App $app) {}

    public static function csrfFor(string $cookieToken): string
    {
        return self::b64(hash_hmac('sha256', 'am-csrf-v1', $cookieToken, true));
    }

    public static function hash(string $value): string
    {
        return hash('sha256', $value);
    }

    /** @return array{token:string, csrf:string, id:int} */
    public function create(int $userId, Request $request): array
    {
        $token = self::b64(random_bytes(32));
        $csrf = self::csrfFor($token);
        $now = $this->app->clock->now()->getTimestamp();
        $this->app->db()->run(
            'INSERT INTO sessions (token_hash, csrf_hash, user_id, device_label, user_agent, ip, created_at, last_used_at, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                self::hash($token), self::hash($csrf), $userId,
                self::deviceLabel($request), mb_substr($request->header('user-agent'), 0, 255) ?: null,
                substr($request->ip, 0, 45), Time::db($now), Time::db($now), Time::db($now + self::LIFETIME),
            ],
        );
        return ['token' => $token, 'csrf' => $csrf, 'id' => (int) $this->app->db()->pdo->lastInsertId()];
    }

    /** Revoke one session. */
    public function revoke(int $sessionId, string $reason): void
    {
        $this->app->db()->run(
            'UPDATE sessions SET revoked_at = ?, revoked_reason = ? WHERE id = ? AND revoked_at IS NULL',
            [$this->app->clock->dbNow(), $reason, $sessionId],
        );
    }

    /** Revoke every live session of a user, except one. @return int how many */
    public function revokeAll(int $userId, string $reason, ?int $exceptSessionId = null): int
    {
        $stmt = $this->app->db()->run(
            'UPDATE sessions SET revoked_at = ?, revoked_reason = ?
             WHERE user_id = ? AND revoked_at IS NULL AND id <> ?',
            [$this->app->clock->dbNow(), $reason, $userId, $exceptSessionId ?? 0],
        );
        return $stmt->rowCount();
    }

    public function cookieHeader(string $token): string
    {
        return self::COOKIE . '=' . $token . '; Max-Age=' . self::LIFETIME . '; Path=/; Secure; HttpOnly; SameSite=Lax';
    }

    public static function clearCookieHeader(): string
    {
        return self::COOKIE . '=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax';
    }

    public function attachCookie(Response $response, string $token): Response
    {
        $response->headers['Set-Cookie'] = $this->cookieHeader($token);
        return $response;
    }

    public static function deviceLabel(Request $request): ?string
    {
        $d = trim((string) preg_replace('/[\x00-\x1F\x7F]/', '', $request->header('x-device')));
        return $d === '' ? null : mb_substr($d, 0, 60);
    }

    private static function b64(string $bytes): string
    {
        return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
    }
}
