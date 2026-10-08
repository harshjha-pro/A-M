<?php
declare(strict_types=1);

namespace AM\Modules\Members;

use AM\Auth\Passwords;
use AM\Auth\Permissions;
use AM\Auth\Sessions;
use AM\Db\Db;
use AM\Db\UnitOfWork;
use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Kernel\Strings;
use AM\Kernel\Time;
use AM\Kernel\Ulid;
use AM\Modules\Auth\PasswordLinks;
use AM\Modules\Auth\Users;
use AM\Repo\Refs;
use AM\Repo\Versioned;
use AM\Safety\AuditLog;
use AM\Validation\Fields;

/**
 * Members (FEATURES B1, API.md §6.2). Never deleted: deactivate with is_active false.
 * The Owner can't be demoted or deactivated; nobody can add an owner.
 */
final class MembersController
{
    private const ROLE_ORDER = "FIELD(role, 'owner', 'partner', 'family', 'viewer')";

    /** GET /members */
    public static function list(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        $admin = Permissions::isAdmin($viewer);
        $includeInactive = ($request->query['include_inactive'] ?? '') === 'true';
        if (isset($request->query['include_inactive']) && !in_array($request->query['include_inactive'], ['true', 'false'], true)) {
            throw HttpError::make(400, 'bad_request');
        }
        if ($includeInactive && !$admin) {
            throw HttpError::make(403, 'forbidden');
        }
        $db = $app->db();
        $refs = new Refs($db, $app->clock->todayIst());
        $rows = $db->all(
            'SELECT * FROM users WHERE deleted_at IS NULL' . ($includeInactive ? '' : ' AND is_active = 1')
            . ' ORDER BY ' . self::ROLE_ORDER . ', name, id',
        );
        $out = array_map(
            static fn (array $u) => $admin ? MemberView::full($db, $refs, $u) : MemberView::limited($refs, $u),
            $rows,
        );
        return Response::ok($out, 200, ['total' => count($out)]);
    }

    /** GET /members/{id} — admins, or yourself */
    public static function get(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        $db = $app->db();
        $u = Users::byPublicId($db, $params['id']);
        if (!Permissions::isAdmin($viewer) && (int) $u['id'] !== (int) $viewer['id']) {
            throw HttpError::make(403, 'forbidden');
        }
        $view = MemberView::full($db, new Refs($db, $app->clock->todayIst()), $u, true, $app->clock->dbNow());
        return Response::ok($view)->withHeader('ETag', '"' . $view['version'] . '"');
    }

    /** POST /members — add a member and set a password, make one, or create an invite link */
    public static function create(Request $request, App $app, array $params): Response
    {
        $actor = $request->attr('user');
        Permissions::requireAdmin($actor);
        $json = $request->attr('json');
        if (is_array($json) && ($json['role'] ?? null) === 'owner') {
            throw HttpError::make(403, 'forbidden'); // there is only ever one owner
        }
        $f = Fields::from($json);
        $f->only(['name', 'phone', 'role', 'can_see_money', 'access_ends_on', 'email', 'password_mode', 'password']);
        $name = $f->text('name', 80, true);
        $phone = $f->phone('phone', true);
        $role = $f->enum('role', ['partner', 'family', 'viewer'], true);
        $money = $f->bool('can_see_money') ?? false;
        $ends = self::futureDate($app, $f, 'access_ends_on');
        $email = $f->email('email');
        $mode = $f->enum('password_mode', ['set', 'generate', 'link'], true);
        $password = $mode === 'set' ? $f->raw('password', true) : null;
        if ($password !== null && ($p = Passwords::problem($password, $phone)) !== null) {
            $f->error('password', $p);
        }
        if ($role === 'partner') {
            $money = true; // admins always see money (DB check ck_users_money)
        }
        $f->fail();

        $key = (string) $request->attr('idem_key');
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $actor, $key, $name, $phone, $role, $money, $ends, $email, $mode, $password): Response {
            // Created before (a retry more than 48 h later): return it, never a second member (DATABASE rule 2).
            $existing = $db->one('SELECT * FROM users WHERE client_uuid = ?', [$key]);
            if ($existing !== null) {
                return Response::ok(['member' => MemberView::full($db, new Refs($db, $app->clock->todayIst()), $existing)], 200);
            }
            self::assertPhoneFree($db, (string) $phone, null);

            $now = $app->clock->dbNow();
            $hash = $mode === 'set' ? Passwords::hash((string) $password) : Passwords::unusableHash();
            $secret = $mode === 'generate' ? Passwords::generate() : null;
            if ($secret !== null) {
                $hash = Passwords::hash($secret);
            }
            $db->run(
                'INSERT INTO users (public_id, client_uuid, name, phone, email, password_hash, role, can_see_money, is_active,
                                    access_ends_on, must_change_password, password_changed_at, version, created_at, created_by, updated_at, updated_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 1, ?, ?, ?, ?)',
                [Ulid::generate($app->clock), $key, $name, $phone, $email, $hash, $role, (int) $money,
                 $ends, $mode === 'link' ? 1 : 0, $mode === 'link' ? null : $now, $now, $actor['id'], $now, $actor['id']],
            );
            $id = (int) $db->pdo->lastInsertId();
            $row = $db->one('SELECT * FROM users WHERE id = ?', [$id]);
            AuditLog::record($app, $db, $request, [
                'action' => 'create', 'entity_type' => 'user', 'entity_id' => $id, 'entity_version' => 1, 'after' => $row,
            ]);
            $data = ['member' => MemberView::full($db, new Refs($db, $app->clock->todayIst()), $row)];
            $data += self::issueSecret($app, $db, $request, $row, $actor, $mode, $secret, $mode === 'set' ? 'admin_set' : null);
            return Response::ok($data, 201);
        });
    }

    /**
     * A retried create whose first reply was lost: the member exists, the first
     * password or link never reached the phone. Make a fresh one and cancel the old.
     */
    public static function createReplay(Request $request, App $app, array $params, Response $stored): Response
    {
        $actor = $request->attr('user');
        $mode = (string) ($request->attr('json')['password_mode'] ?? '');
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $actor, $mode, $stored): Response {
            $row = $db->one('SELECT * FROM users WHERE client_uuid = ? FOR UPDATE', [$request->attr('idem_key')]);
            if ($row === null) {
                return $stored;
            }
            $secret = $mode === 'generate' ? Passwords::generate() : null;
            if ($secret !== null) {
                $db->run('UPDATE users SET password_hash = ?, updated_at = updated_at WHERE id = ?', [Passwords::hash($secret), $row['id']]);
            }
            $data = ['member' => MemberView::full($db, new Refs($db, $app->clock->todayIst()), $row)];
            $data += self::issueSecret($app, $db, $request, $row, $actor, $mode, $secret, null);
            AuditLog::record($app, $db, $request, [
                'action' => 'password_reset', 'entity_type' => 'user', 'entity_id' => (int) $row['id'],
                'note' => 'New ' . ($mode === 'link' ? 'invite link' : 'password') . ' after a retried add',
            ]);
            return Response::ok($data, (int) $stored->status);
        });
    }

    /** PATCH /members/{id} — admins edit; anyone may change their own name */
    public static function update(Request $request, App $app, array $params): Response
    {
        $actor = $request->attr('user');
        $admin = Permissions::isAdmin($actor);
        $expected = Versioned::ifMatch($request);
        $json = $request->attr('json');
        $f = Fields::from($json);
        $f->only(['name', 'phone', 'role', 'can_see_money', 'is_active', 'access_ends_on', 'email']);
        if ($f->keys() === []) {
            throw HttpError::make(422, 'validation_failed', [], ['fields' => []]);
        }

        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $actor, $admin, $expected, $json, $f, $params): Response {
            $target = Users::byPublicId($db, $params['id'], true);
            $self = (int) $target['id'] === (int) $actor['id'];
            if (!$admin) {
                if (!$self) {
                    throw HttpError::make(403, 'forbidden');
                }
                if (array_diff($f->keys(), ['name']) !== []) {
                    throw new HttpError(403, 'forbidden', Strings::get('self_name_only'));
                }
            }
            if (($json['role'] ?? null) === 'owner') {
                throw HttpError::make(403, 'forbidden');
            }
            $changes = [];
            if ($f->has('name')) {
                $changes['name'] = $f->text('name', 80, true);
            }
            if ($f->has('phone')) {
                $changes['phone'] = $f->phone('phone', true);
            }
            if ($f->has('email')) {
                $changes['email'] = $f->email('email');
            }
            if ($f->has('role')) {
                $changes['role'] = $f->enum('role', ['partner', 'family', 'viewer'], true);
            }
            if ($f->has('can_see_money')) {
                $changes['can_see_money'] = $f->bool('can_see_money');
            }
            if ($f->has('is_active')) {
                $changes['is_active'] = $f->bool('is_active');
            }
            if ($f->has('access_ends_on')) {
                $changes['access_ends_on'] = self::futureDate($app, $f, 'access_ends_on');
            }

            $touchesAccess = array_intersect(array_keys($changes), ['role', 'can_see_money', 'is_active', 'access_ends_on']) !== [];
            if ($target['role'] === 'owner' && $touchesAccess) {
                // Owner's own access fields may be re-sent unchanged (a form sends every field), never changed.
                foreach (['role', 'can_see_money', 'is_active', 'access_ends_on'] as $k) {
                    if (array_key_exists($k, $changes) && !Versioned::same($target[$k], $changes[$k])) {
                        throw new HttpError(403, 'forbidden', Strings::get('owner_locked'));
                    }
                }
            }
            if ($self && $admin && $touchesAccess) {
                foreach (['role', 'is_active', 'access_ends_on'] as $k) {
                    if (array_key_exists($k, $changes) && !Versioned::same($target[$k], $changes[$k])) {
                        throw new HttpError(403, 'forbidden', Strings::get('not_self'));
                    }
                }
            }
            $role = $changes['role'] ?? $target['role'];
            if (in_array($role, Permissions::ADMIN_ROLES, true)) {
                if (array_key_exists('can_see_money', $changes) && $changes['can_see_money'] === false) {
                    $f->error('can_see_money', Strings::get('field_money_admin'));
                }
                $changes['can_see_money'] = true;
            }
            $f->fail();

            $becomesActive = (bool) ($changes['is_active'] ?? (bool) $target['is_active']);
            if (isset($changes['phone']) || ($becomesActive && !(bool) $target['is_active'])) {
                if ($becomesActive) {
                    self::assertPhoneFree($db, (string) ($changes['phone'] ?? $target['phone']), (int) $target['id']);
                }
            }
            // At least one active admin must remain (the Owner always is one, but say it plainly).
            $losesAdmin = in_array($target['role'], Permissions::ADMIN_ROLES, true)
                && (!in_array($role, Permissions::ADMIN_ROLES, true) || !$becomesActive);
            if ($losesAdmin && (int) $db->value(
                "SELECT COUNT(*) FROM users WHERE role IN ('owner','partner') AND is_active = 1 AND deleted_at IS NULL AND id <> ?",
                [$target['id']],
            ) === 0) {
                throw new HttpError(403, 'forbidden', Strings::get('last_admin'));
            }

            $refs = new Refs($db, $app->clock->todayIst());
            $present = static fn (array $row) => $admin || $self ? MemberView::full($db, $refs, $row) : MemberView::limited($refs, $row);
            $r = Versioned::update($app, $db, $request, 'users', 'user', (int) $target['id'], $expected, $changes, $present);

            if ($r['changed'] !== []) {
                $accessChange = array_intersect($r['changed'], ['role', 'can_see_money', 'is_active', 'access_ends_on']) !== [];
                AuditLog::record($app, $db, $request, [
                    'action' => $accessChange ? 'role_change' : 'update', 'entity_type' => 'user',
                    'entity_id' => (int) $target['id'], 'entity_version' => (int) $r['after']['version'],
                    'before' => $r['before'], 'after' => $r['after'],
                ]);
                if (in_array('is_active', $r['changed'], true) && (int) $r['after']['is_active'] === 0) {
                    (new Sessions($app))->revokeAll((int) $target['id'], 'deactivated');
                }
            }
            $view = MemberView::full($db, new Refs($db, $app->clock->todayIst()), $r['after']);
            return Response::ok($view)->withHeader('ETag', '"' . $view['version'] . '"');
        });
    }

    /** POST /members/{id}/password-reset — admin reset; all that member's phones are logged out */
    public static function resetPassword(Request $request, App $app, array $params): Response
    {
        $actor = $request->attr('user');
        Permissions::requireAdmin($actor);
        $f = Fields::from($request->attr('json'));
        $f->only(['mode', 'password']);
        $mode = $f->enum('mode', ['set', 'generate', 'link'], true);
        $password = $mode === 'set' ? $f->raw('password', true) : null;

        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $actor, $params, $f, $mode, $password): Response {
            $target = Users::byPublicId($db, $params['id'], true);
            if ((int) $target['id'] === (int) $actor['id']) {
                throw new HttpError(403, 'forbidden', Strings::get('not_self'));
            }
            if ($target['role'] === 'owner' && $actor['role'] !== 'owner') {
                throw HttpError::make(403, 'forbidden'); // Partner can't reset the Owner
            }
            if ($password !== null && ($p = Passwords::problem($password, $target['phone'])) !== null) {
                $f->error('password', $p);
            }
            $f->fail();

            $secret = $mode === 'generate' ? Passwords::generate() : null;
            if ($mode !== 'link') {
                $db->run(
                    'UPDATE users SET password_hash = ?, password_changed_at = ?, must_change_password = 0, updated_at = updated_at WHERE id = ?',
                    [Passwords::hash($secret ?? (string) $password), $app->clock->dbNow(), $target['id']],
                );
                PasswordLinks::cancelOpen($app, $db, (int) $target['id']);
            }
            $n = (new Sessions($app))->revokeAll((int) $target['id'], 'password_reset');
            $data = self::issueSecret($app, $db, $request, $target, $actor, (string) $mode, $secret, $mode === 'set' ? 'admin_set' : null, $n);
            AuditLog::record($app, $db, $request, [
                'action' => 'password_reset', 'entity_type' => 'user', 'entity_id' => (int) $target['id'],
                'note' => match ($mode) { 'link' => 'Sent a set-password link', 'generate' => 'Made a new password', default => 'Typed a new password' },
            ]);
            return Response::ok($data + ['sessions_revoked' => $n]);
        });
    }

    /** Replay of a reset whose reply was lost: do it again with a fresh secret. */
    public static function resetReplay(Request $request, App $app, array $params, Response $stored): Response
    {
        return self::resetPassword($request, $app, $params);
    }

    /** GET /me/sessions — my logged-in phones */
    public static function mySessions(Request $request, App $app, array $params): Response
    {
        $user = $request->attr('user');
        $current = (int) $request->attr('session')['id'];
        $rows = $app->db()->all(
            'SELECT id, device_label, last_used_at FROM sessions WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY last_used_at DESC',
            [$user['id'], $app->clock->dbNow()],
        );
        return Response::ok(array_map(static fn (array $s) => [
            'device_label' => $s['device_label'],
            'last_used_at' => Time::iso($s['last_used_at']),
            'current' => (int) $s['id'] === $current,
        ], $rows));
    }

    /**
     * password_once / setup_link, returned ONCE and never stored in the idempotent
     * reply (Db\Idempotency strips them).
     */
    private static function issueSecret(App $app, Db $db, Request $request, array $target, array $actor, string $mode, ?string $secret, ?string $logMethod, int $revoked = 0): array
    {
        $now = $app->clock->dbNow();
        if ($mode === 'link') {
            $l = PasswordLinks::create($app, $db, $request, (int) $target['id'], (int) $actor['id']);
            return ['setup_link' => $l['link'], 'setup_link_expires_at' => $l['expires_at']];
        }
        $db->run(
            'INSERT INTO password_resets (user_id, reset_by, method, sessions_revoked, ip, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [$target['id'], $actor['id'], $logMethod ?? 'admin_generated', $revoked, substr($request->ip, 0, 45), $now],
        );
        return $secret !== null ? ['password_once' => $secret] : [];
    }

    private static function assertPhoneFree(Db $db, string $phone, ?int $exceptId): void
    {
        $other = $db->one(
            'SELECT public_id, name, role FROM users WHERE active_phone = ? AND id <> ?',
            [$phone, $exceptId ?? 0],
        );
        if ($other !== null) {
            throw new HttpError(409, 'duplicate_found', Strings::get('member_duplicate', ['name' => $other['name']]), [
                'matches' => [['id' => $other['public_id'], 'name' => $other['name'], 'role' => $other['role'], 'match_on' => 'phone']],
            ]);
        }
    }

    private static function futureDate(App $app, Fields $f, string $key): ?string
    {
        $d = $f->date($key);
        if ($d !== null && $d < $app->clock->todayIst()) {
            $f->error($key, Strings::get('field_date_past'));
            return null;
        }
        return $d;
    }
}
