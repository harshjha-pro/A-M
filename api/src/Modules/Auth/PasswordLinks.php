<?php
declare(strict_types=1);

namespace AM\Modules\Auth;

use AM\Auth\Sessions;
use AM\Db\Db;
use AM\Kernel\App;
use AM\Kernel\Request;
use AM\Kernel\Time;

/**
 * One-time "set your password" links (API.md §3.5): invite or reset.
 * 32 random bytes in the #fragment (never in server logs). Only the SHA-256
 * is stored. 72 hours, one use. A new link cancels older unused ones.
 */
final class PasswordLinks
{
    public const LIFETIME = 72 * 3600;

    /** @return array{link:string, expires_at:string} */
    public static function create(App $app, Db $db, Request $request, int $userId, ?int $resetBy): array
    {
        $now = $app->clock->now()->getTimestamp();
        self::cancelOpen($app, $db, $userId);
        $token = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
        $db->run(
            "INSERT INTO password_resets (user_id, reset_by, method, token_hash, expires_at, ip, created_at)
             VALUES (?, ?, 'link', ?, ?, ?, ?)",
            [$userId, $resetBy, Sessions::hash($token), Time::db($now + self::LIFETIME), substr($request->ip, 0, 45), Time::db($now)],
        );
        return [
            'link' => rtrim($app->env->get('APP_URL'), '/') . '/set-password#t=' . $token,
            'expires_at' => gmdate('Y-m-d\TH:i:s\Z', $now + self::LIFETIME),
        ];
    }

    /** Older unused links stop working (expiry moved to now). */
    public static function cancelOpen(App $app, Db $db, int $userId): void
    {
        $now = $app->clock->dbNow();
        $db->run(
            "UPDATE password_resets SET expires_at = ? WHERE user_id = ? AND method = 'link' AND used_at IS NULL AND expires_at > ?",
            [$now, $userId, $now],
        );
    }

    /** A usable link row with its user, or null (unknown, used, expired, cancelled, member left). */
    public static function find(App $app, Db $db, string $token, bool $forUpdate = false): ?array
    {
        if (strlen($token) < 40 || strlen($token) > 64) {
            return null;
        }
        $row = $db->one(
            "SELECT * FROM password_resets WHERE token_hash = ? AND method = 'link'" . ($forUpdate ? ' FOR UPDATE' : ''),
            [Sessions::hash($token)],
        );
        if ($row === null || $row['used_at'] !== null || strtotime($row['expires_at'] . ' UTC') <= $app->clock->now()->getTimestamp()) {
            return null;
        }
        $user = $db->one('SELECT * FROM users WHERE id = ?', [$row['user_id']]);
        if ($user === null || (int) $user['is_active'] === 0
            || ($user['access_ends_on'] !== null && $user['access_ends_on'] < $app->clock->todayIst())) {
            return null;
        }
        return ['link' => $row, 'user' => $user];
    }
}
