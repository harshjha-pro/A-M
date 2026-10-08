<?php
declare(strict_types=1);

namespace AM\Modules\Auth;

use AM\Auth\Passwords;
use AM\Auth\Permissions;
use AM\Auth\Sessions;
use AM\Db\UnitOfWork;
use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Phone;
use AM\Kernel\RateLimiter;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Kernel\Strings;
use AM\Kernel\Time;
use AM\Safety\AuditLog;
use AM\Validation\Fields;

/** /auth/*, /session — API.md §3. */
final class AuthController
{
    /** POST /auth/login */
    public static function login(Request $request, App $app, array $params): Response
    {
        $f = Fields::from($request->attr('json'));
        $f->only(['phone', 'password']);
        $rawPhone = $f->raw('phone', true, 20);
        $password = $f->raw('password', true, 128);
        $f->fail();

        $db = $app->db();
        $now = $app->clock->now()->getTimestamp();
        $ip = RateLimiter::clientIp($request, $app);
        $phone = Phone::normalize((string) $rawPhone)['e164'] ?? null;
        LoginGuard::check($db, $now, $phone, $ip);

        // Prefer the active member with this phone; a deactivated one is checked only after the password.
        $user = $phone === null ? null : $db->one(
            'SELECT * FROM users WHERE phone = ? AND deleted_at IS NULL ORDER BY is_active DESC, id DESC LIMIT 1',
            [$phone],
        );
        $ok = Passwords::verify((string) $password, $user['password_hash'] ?? null);

        if (!$ok) {
            LoginGuard::record($db, $now, $phone, $ip, $user !== null ? (int) $user['id'] : null, false);
            AuditLog::record($app, $db, $request, [
                'action' => 'login_failed', 'entity_type' => 'user', 'entity_id' => $user['id'] ?? null,
                'user_id' => null, 'note' => 'Wrong phone or password',
            ]);
            throw HttpError::make(401, 'login_failed');
        }
        // Right password, but access has ended: say so only now, so phones can't be probed (API.md §3.3).
        if ((int) $user['is_active'] === 0 || ($user['access_ends_on'] !== null && $user['access_ends_on'] < $app->clock->todayIst())) {
            AuditLog::record($app, $db, $request, [
                'action' => 'login_failed', 'entity_type' => 'user', 'entity_id' => (int) $user['id'],
                'user_id' => (int) $user['id'], 'note' => 'Access ended',
            ]);
            throw HttpError::make(403, 'access_ended');
        }

        return UnitOfWork::run($app, $request, function ($db) use ($app, $request, $user, $now, $phone, $ip): Response {
            LoginGuard::record($db, $now, $phone, $ip, (int) $user['id'], true);
            $s = (new Sessions($app))->create((int) $user['id'], $request);
            AuditLog::record($app, $db, $request, [
                'action' => 'login', 'entity_type' => 'user', 'entity_id' => (int) $user['id'], 'user_id' => (int) $user['id'],
            ]);
            $res = Response::ok(['user' => Users::authUser($user), 'csrf_token' => $s['csrf']]);
            return (new Sessions($app))->attachCookie($res, $s['token']);
        });
    }

    /** POST /auth/logout */
    public static function logout(Request $request, App $app, array $params): Response
    {
        $session = $request->attr('session');
        $user = $request->attr('user');
        return UnitOfWork::run($app, $request, function ($db) use ($app, $request, $session, $user): Response {
            (new Sessions($app))->revoke((int) $session['id'], 'logout');
            AuditLog::record($app, $db, $request, ['action' => 'logout', 'entity_type' => 'user', 'entity_id' => (int) $user['id']]);
            $res = Response::ok(new \stdClass());
            $res->headers['Set-Cookie'] = Sessions::clearCookieHeader();
            $request->attributes['session'] = null;
            return $res;
        });
    }

    /** POST /auth/logout-all */
    public static function logoutAll(Request $request, App $app, array $params): Response
    {
        $user = $request->attr('user');
        return UnitOfWork::run($app, $request, function ($db) use ($app, $request, $user): Response {
            $n = (new Sessions($app))->revokeAll((int) $user['id'], 'logout_all');
            AuditLog::record($app, $db, $request, [
                'action' => 'logout', 'entity_type' => 'user', 'entity_id' => (int) $user['id'], 'note' => "Logged out of all phones ($n)",
            ]);
            $res = Response::ok(['sessions_revoked' => $n]);
            $res->headers['Set-Cookie'] = Sessions::clearCookieHeader();
            $request->attributes['session'] = null;
            return $res;
        });
    }

    /** GET /session — who am I. Also the refresh: the Session middleware slides the 90 days. */
    public static function session(Request $request, App $app, array $params): Response
    {
        $user = $request->attr('user');
        $s = $app->db()->one('SELECT bride_name, groom_name, bride_side_label, groom_side_label, wedding_start_date, wedding_end_date, city FROM settings WHERE id = 1');
        return Response::ok([
            'user' => Users::authUser($user),
            'permissions' => Permissions::forUser($user),
            'csrf_token' => Sessions::csrfFor($request->attr('session')['token']),
            'settings_brief' => $s,
        ]);
    }

    /** POST /auth/password/change — needs the current password; other phones are logged out; this one gets a new cookie. */
    public static function changePassword(Request $request, App $app, array $params): Response
    {
        $user = $request->attr('user');
        $f = Fields::from($request->attr('json'));
        $f->only(['current_password', 'new_password']);
        $current = $f->raw('current_password', true);
        $new = $f->raw('new_password', true);
        if ($current !== null && !Passwords::verify($current, $user['password_hash'])) {
            $f->error('current_password', Strings::get('password_current_wrong'));
        }
        if ($new !== null && ($p = Passwords::problem($new, $user['phone'])) !== null) {
            $f->error('new_password', $p);
        }
        $f->fail();

        return UnitOfWork::run($app, $request, function ($db) use ($app, $request, $user, $new): Response {
            $now = $app->clock->dbNow();
            // Credentials are bookkeeping on the member row: no version bump, so an admin editing
            // the same member at the same time doesn't get a false conflict.
            $db->run(
                'UPDATE users SET password_hash = ?, password_changed_at = ?, must_change_password = 0, updated_at = updated_at WHERE id = ?',
                [Passwords::hash((string) $new), $now, $user['id']],
            );
            $sessions = new Sessions($app);
            $n = $sessions->revokeAll((int) $user['id'], 'password_change');
            $db->run(
                "INSERT INTO password_resets (user_id, reset_by, method, sessions_revoked, ip, created_at) VALUES (?, ?, 'self_change', ?, ?, ?)",
                [$user['id'], $user['id'], $n, substr($request->ip, 0, 45), $now],
            );
            AuditLog::record($app, $db, $request, [
                'action' => 'password_reset', 'entity_type' => 'user', 'entity_id' => (int) $user['id'],
                'note' => 'Changed own password',
            ]);
            $s = $sessions->create((int) $user['id'], $request);
            $request->attributes['session'] = null;
            return $sessions->attachCookie(Response::ok(['user' => Users::authUser($user), 'csrf_token' => $s['csrf']]), $s['token']);
        });
    }

    /** POST /auth/password-reset/request — off at launch (MAIL_ENABLED=false). Always the same 202. */
    public static function resetRequest(Request $request, App $app, array $params): Response
    {
        $limiter = new RateLimiter($app);
        $limiter->hit('reset_request:ip:' . RateLimiter::clientIp($request, $app), 10, 3600);
        $f = Fields::from($request->attr('json'));
        $f->only(['phone', 'email']);
        $f->fail();
        $phone = Phone::normalize((string) ($request->attr('json')['phone'] ?? ''))['e164'] ?? null;
        if ($phone !== null) {
            $limiter->hit('reset_request:phone:' . $phone, 3, 3600);
        }
        if ($app->env->bool('MAIL_ENABLED', false)) {
            // Email sending arrives with the mailer (Session 4). Until then nothing is sent.
            $app->logger->error((string) $request->attr('request_id'), 'Password reset email requested but the mailer is not built yet');
        }
        return Response::ok(new \stdClass(), 202);
    }

    /** POST /auth/password-link/inspect */
    public static function linkInspect(Request $request, App $app, array $params): Response
    {
        (new RateLimiter($app))->hit('link:ip:' . RateLimiter::clientIp($request, $app), 10, 900);
        $token = self::linkToken($request);
        $db = $app->db();
        $found = PasswordLinks::find($app, $db, $token);
        if ($found === null) {
            throw HttpError::make(410, 'link_invalid');
        }
        $user = $found['user'];
        $everLoggedIn = (int) $db->value('SELECT COUNT(*) FROM sessions WHERE user_id = ?', [$user['id']]) > 0;
        return Response::ok([
            'purpose' => $everLoggedIn ? 'reset' : 'invite',
            'name' => $user['name'],
            'phone_masked' => Phone::mask($user['phone']),
            'expires_at' => Time::iso($found['link']['expires_at']),
        ]);
    }

    /** POST /auth/password-link/complete — set the password and log in. */
    public static function linkComplete(Request $request, App $app, array $params): Response
    {
        (new RateLimiter($app))->hit('link:ip:' . RateLimiter::clientIp($request, $app), 10, 900);
        $token = self::linkToken($request);
        $f = Fields::from($request->attr('json'));
        $f->only(['token', 'new_password']);
        $new = $f->raw('new_password', true);

        return UnitOfWork::run($app, $request, function ($db) use ($app, $request, $token, $f, $new): Response {
            $found = PasswordLinks::find($app, $db, $token, true);
            if ($found === null) {
                throw HttpError::make(410, 'link_invalid');
            }
            $user = $found['user'];
            if ($new !== null && ($p = Passwords::problem($new, $user['phone'])) !== null) {
                $f->error('new_password', $p);
            }
            $f->fail();
            $now = $app->clock->dbNow();
            $db->run(
                'UPDATE users SET password_hash = ?, password_changed_at = ?, must_change_password = 0, updated_at = updated_at WHERE id = ?',
                [Passwords::hash((string) $new), $now, $user['id']],
            );
            $sessions = new Sessions($app);
            $n = $sessions->revokeAll((int) $user['id'], 'password_reset');
            $db->run('UPDATE password_resets SET used_at = ?, sessions_revoked = ? WHERE id = ?', [$now, $n, $found['link']['id']]);
            AuditLog::record($app, $db, $request, [
                'action' => 'password_reset', 'entity_type' => 'user', 'entity_id' => (int) $user['id'],
                'user_id' => (int) $user['id'], 'note' => 'Set password from link',
            ]);
            $s = $sessions->create((int) $user['id'], $request);
            $user['must_change_password'] = 0;
            return $sessions->attachCookie(Response::ok(['user' => Users::authUser($user), 'csrf_token' => $s['csrf']]), $s['token']);
        });
    }

    private static function linkToken(Request $request): string
    {
        $json = $request->attr('json');
        $token = is_array($json) ? ($json['token'] ?? null) : null;
        if (!is_string($token) || !preg_match('/^[A-Za-z0-9_-]{40,64}$/', $token)) {
            throw HttpError::make(410, 'link_invalid');
        }
        return $token;
    }
}
