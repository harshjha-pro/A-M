<?php
declare(strict_types=1);

namespace AM\Modules\Members;

use AM\Db\Db;
use AM\Kernel\Time;
use AM\Repo\Refs;

/** What a member looks like in replies (API.md §6.2). Family and Viewer see only id, name, phone, role, left. */
final class MemberView
{
    public static function full(Db $db, Refs $refs, array $u, bool $withDevices = false, ?string $nowDb = null): array
    {
        $seen = $db->one(
            'SELECT MAX(last_used_at) AS last_seen, COUNT(*) AS n FROM sessions WHERE user_id = ?',
            [$u['id']],
        );
        $out = [
            'id' => $u['public_id'],
            'version' => (int) $u['version'],
            'name' => $u['name'],
            'phone' => $u['phone'],
            'email' => $u['email'],
            'role' => $u['role'],
            'can_see_money' => (bool) $u['can_see_money'],
            'is_active' => (bool) $u['is_active'],
            'access_ends_on' => $u['access_ends_on'],
            'left' => $refs->hasLeft($u),
            'last_seen_at' => Time::iso($seen['last_seen'] ?? null),
            'has_logged_in' => (int) ($seen['n'] ?? 0) > 0,
            'must_change_password' => (bool) $u['must_change_password'],
            'link' => self::link($db, (int) $u['id'], $nowDb ?? gmdate('Y-m-d H:i:s')),
            'created_at' => Time::iso($u['created_at']),
            'created_by' => $refs->user($u['created_by'] !== null ? (int) $u['created_by'] : null),
            'updated_at' => Time::iso($u['updated_at']),
            'updated_by' => $refs->user($u['updated_by'] !== null ? (int) $u['updated_by'] : null),
        ];
        if ($withDevices) {
            $out['devices'] = array_map(static fn (array $s) => [
                'device_label' => $s['device_label'],
                'last_used_at' => Time::iso($s['last_used_at']),
            ], $db->all(
                'SELECT device_label, last_used_at FROM sessions WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY last_used_at DESC',
                [$u['id'], $nowDb ?? gmdate('Y-m-d H:i:s')],
            ));
        }
        return $out;
    }

    /** 1.0.24: the latest set-password link: none · open (until …) · used · expired, and when it was made. */
    public static function link(Db $db, int $userId, string $nowDb): array
    {
        $l = $db->one("SELECT created_at, expires_at, used_at FROM password_resets WHERE user_id = ? AND method = 'link' ORDER BY id DESC LIMIT 1", [$userId]);
        if ($l === null) {
            return ['status' => 'none', 'sent_at' => null, 'expires_at' => null, 'used_at' => null];
        }
        $status = $l['used_at'] !== null ? 'used' : ($l['expires_at'] !== null && $l['expires_at'] > $nowDb ? 'open' : 'expired');
        return ['status' => $status, 'sent_at' => Time::iso($l['created_at']), 'expires_at' => Time::iso($l['expires_at']), 'used_at' => Time::iso($l['used_at'])];
    }

    public static function limited(Refs $refs, array $u): array
    {
        return ['id' => $u['public_id'], 'name' => $u['name'], 'phone' => $u['phone'], 'role' => $u['role'], 'left' => $refs->hasLeft($u)];
    }
}
