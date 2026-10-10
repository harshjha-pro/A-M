<?php
declare(strict_types=1);

namespace AM\Modules\Setup;

use AM\Auth\Passwords;
use AM\Auth\Sessions;
use AM\Db\UnitOfWork;
use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\RateLimiter;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Kernel\Ulid;
use AM\Modules\Auth\Users;
use AM\Safety\AuditLog;
use AM\Validation\Fields;
use PDOException;

/**
 * POST /setup/owner — first run only (API.md §3.2). Needs SETUP_TOKEN from
 * private/.env. Works once: after that it answers 410. Delete SETUP_TOKEN
 * from .env after use.
 */
final class SetupController
{
    public static function owner(Request $request, App $app, array $params): Response
    {
        (new RateLimiter($app))->hit('setup:ip:' . RateLimiter::clientIp($request, $app), 5, 3600);
        $db = $app->db();
        if ($db->value("SELECT COUNT(*) FROM users WHERE role = 'owner'") > 0) {
            throw HttpError::make(410, 'setup_done');
        }
        $expected = $app->env->get('SETUP_TOKEN');
        $f = Fields::from($request->attr('json'));
        $f->only(['setup_token', 'name', 'phone', 'password']);
        $sent = $f->raw('setup_token', false, 200);
        if ($expected === '' || str_starts_with($expected, 'change-me') || strlen($expected) < 16
            || $sent === null || !hash_equals($expected, $sent)) {
            throw HttpError::make(403, 'forbidden');
        }
        $name = $f->text('name', 80, true);
        $phone = $f->phone('phone', true);
        $password = $f->raw('password', true);
        if ($password !== null && ($p = Passwords::problem($password, $phone)) !== null) {
            $f->error('password', $p);
        }
        $f->fail();

        try {
            return UnitOfWork::run($app, $request, function ($db) use ($app, $request, $name, $phone, $password): Response {
                $now = $app->clock->dbNow();
                $db->run(
                    "INSERT INTO users (public_id, name, phone, password_hash, role, can_see_money, is_active, password_changed_at, created_at, updated_at)
                     VALUES (?, ?, ?, ?, 'owner', 1, 1, ?, ?, ?)",
                    [Ulid::generate($app->clock), $name, $phone, Passwords::hash((string) $password), $now, $now, $now],
                );
                $id = (int) $db->pdo->lastInsertId();
                $user = $db->one('SELECT * FROM users WHERE id = ?', [$id]);
                AuditLog::record($app, $db, $request, [
                    'action' => 'create', 'entity_type' => 'user', 'entity_id' => $id, 'entity_version' => 1,
                    'after' => $user, 'user_id' => $id, 'note' => 'First owner (setup)',
                ]);
                $sessions = new Sessions($app);
                $s = $sessions->create($id, $request);
                return $sessions->attachCookie(Response::ok(['user' => Users::authUser($user), 'csrf_token' => $s['csrf']], 201), $s['token']);
            });
        } catch (PDOException $e) {
            if (($e->errorInfo[1] ?? 0) === 1062) {
                throw HttpError::make(410, 'setup_done'); // two setups at once: only one owner can exist
            }
            throw $e;
        }
    }
}
