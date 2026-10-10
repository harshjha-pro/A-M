<?php
declare(strict_types=1);

namespace AM\Modules\Auth;

use AM\Db\Db;
use AM\Kernel\HttpError;

/** Reading users by their public id, and the "user" object auth replies carry (API.md §3.2). */
final class Users
{
    public static function byPublicId(Db $db, string $publicId, bool $forUpdate = false): array
    {
        if (!preg_match('/^[0-9A-HJKMNP-TV-Z]{26}$/', $publicId)) {
            throw HttpError::make(404, 'not_found'); // numeric ids never reach a row (SEC-04)
        }
        $row = $db->one('SELECT * FROM users WHERE public_id = ?' . ($forUpdate ? ' FOR UPDATE' : ''), [$publicId]);
        if ($row === null || $row['deleted_at'] !== null) {
            throw HttpError::make(404, 'not_found');
        }
        return $row;
    }

    /** @param array<string,mixed> $u */
    public static function authUser(array $u): array
    {
        return [
            'id' => $u['public_id'],
            'name' => $u['name'],
            'phone' => $u['phone'],
            'role' => $u['role'],
            'can_see_money' => (bool) $u['can_see_money'],
            'access_ends_on' => $u['access_ends_on'],
            'must_change_password' => (bool) $u['must_change_password'],
        ];
    }
}
