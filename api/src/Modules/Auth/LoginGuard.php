<?php
declare(strict_types=1);

namespace AM\Modules\Auth;

use AM\Db\Db;
use AM\Kernel\HttpError;
use AM\Kernel\Time;

/**
 * Login lockouts (FEATURES B1, API.md §3.3) from login_attempts:
 *   5 failures for one phone in 15 min (since its last good login) → that phone waits 15 min
 *   20 failures from one IP in 15 min                               → that IP waits 15 min
 */
final class LoginGuard
{
    public const WINDOW = 900;
    public const PHONE_MAX = 5;
    public const IP_MAX = 20;

    public static function check(Db $db, int $now, ?string $phone, string $ip): void
    {
        $wait = max(self::ipWait($db, $now, $ip), $phone !== null ? self::phoneWait($db, $now, $phone) : 0);
        if ($wait > 0) {
            throw HttpError::make(429, 'login_locked', [], ['retry_after_seconds' => $wait], ['Retry-After' => (string) $wait]);
        }
    }

    public static function phoneWait(Db $db, int $now, string $phone): int
    {
        $since = Time::db($now - self::WINDOW);
        $lastOk = $db->value('SELECT MAX(attempted_at) FROM login_attempts WHERE phone = ? AND succeeded = 1', [$phone]);
        if ($lastOk !== null && $lastOk > $since) {
            $since = $lastOk;
        }
        $times = $db->all(
            'SELECT attempted_at FROM login_attempts WHERE phone = ? AND succeeded = 0 AND attempted_at > ?
             ORDER BY attempted_at DESC, id DESC LIMIT ' . self::PHONE_MAX,
            [$phone, $since],
        );
        return self::wait($times, self::PHONE_MAX, $now);
    }

    public static function ipWait(Db $db, int $now, string $ip): int
    {
        $times = $db->all(
            'SELECT attempted_at FROM login_attempts WHERE ip = ? AND succeeded = 0 AND attempted_at > ?
             ORDER BY attempted_at DESC, id DESC LIMIT ' . self::IP_MAX,
            [$ip, Time::db($now - self::WINDOW)],
        );
        return self::wait($times, self::IP_MAX, $now);
    }

    /** Locked until the oldest of the last N failures is 15 minutes old. */
    private static function wait(array $times, int $max, int $now): int
    {
        if (count($times) < $max) {
            return 0;
        }
        $oldest = strtotime($times[$max - 1]['attempted_at'] . ' UTC');
        return max(1, $oldest + self::WINDOW - $now);
    }

    public static function record(Db $db, int $now, ?string $phone, string $ip, ?int $userId, bool $ok): void
    {
        $db->run(
            'INSERT INTO login_attempts (phone, ip, user_id, succeeded, attempted_at) VALUES (?, ?, ?, ?, ?)',
            [$phone, substr($ip, 0, 45), $userId, $ok ? 1 : 0, Time::db($now)],
        );
    }
}
