<?php
declare(strict_types=1);

namespace AM\Middleware;

use AM\Auth\Sessions;
use AM\Kernel\App;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Kernel\Time;
use Throwable;

/**
 * Reads the __Host-am_session cookie (API.md §3.1). Per request:
 * session valid and not expired → user active → access_ends_on not passed (IST)
 * → role and money flag read fresh from users. A dead session never errors
 * here: it only leaves `user` empty and says why in `auth_error`, so
 * anonymous routes (login, health) still work.
 */
final class Session implements Middleware
{
    private const REASONS = ['password_reset', 'password_change', 'logout_all', 'deactivated', 'access_ended'];

    public function process(Request $request, App $app, callable $next): Response
    {
        $request->attributes['user'] = null;
        $token = $request->cookies[Sessions::COOKIE] ?? '';
        if ($token === '' || strlen($token) > 100) {
            return $next($request);
        }

        try {
            $db = $app->db();
            $s = $db->one('SELECT * FROM sessions WHERE token_hash = ?', [Sessions::hash($token)]);
        } catch (Throwable $e) {
            $app->logger->exception((string) $request->attr('request_id'), $e, ['where' => 'session lookup']);
            return $next($request); // health must still answer; protected routes will say "log in"
        }

        $now = $app->clock->now()->getTimestamp();
        $sessions = new Sessions($app);
        if ($s === null || strtotime($s['expires_at'] . ' UTC') <= $now) {
            $request->attributes['auth_error'] = ['code' => 'not_logged_in'];
            return $this->clearing($next($request));
        }
        if ($s['revoked_at'] !== null) {
            $reason = $s['revoked_reason'] === 'password_change' ? 'password_reset' : $s['revoked_reason'];
            $request->attributes['auth_error'] = in_array($s['revoked_reason'], self::REASONS, true)
                ? ['code' => 'session_ended', 'reason' => $reason]
                : ['code' => 'not_logged_in'];
            return $this->clearing($next($request));
        }

        $user = $db->one('SELECT * FROM users WHERE id = ?', [$s['user_id']]);
        if ($user === null || (int) $user['is_active'] === 0) {
            $sessions->revoke((int) $s['id'], 'deactivated');
            $request->attributes['auth_error'] = ['code' => 'session_ended', 'reason' => 'deactivated'];
            return $this->clearing($next($request));
        }
        if ($user['access_ends_on'] !== null && $user['access_ends_on'] < $app->clock->todayIst()) {
            $sessions->revoke((int) $s['id'], 'access_ended');
            $request->attributes['auth_error'] = ['code' => 'session_ended', 'reason' => 'access_ended'];
            return $this->clearing($next($request));
        }

        $request->attributes['user'] = $user;
        $request->attributes['session'] = $s + ['token' => $token];

        $slide = $now - strtotime($s['last_used_at'] . ' UTC') >= Sessions::SLIDE_EVERY;
        if ($slide) {
            // Bookkeeping write: no version, no audit (DATABASE rule 11).
            $db->run('UPDATE sessions SET last_used_at = ?, expires_at = ? WHERE id = ?', [
                Time::db($now), Time::db($now + Sessions::LIFETIME), $s['id'],
            ]);
        }
        $response = $next($request);
        if ($slide && !isset($response->headers['Set-Cookie']) && $request->attr('session') !== null) {
            $sessions->attachCookie($response, $token); // re-send so the phone keeps it 90 more days
        }
        return $response;
    }

    private function clearing(Response $response): Response
    {
        $response->headers['Set-Cookie'] ??= Sessions::clearCookieHeader();
        return $response;
    }
}
