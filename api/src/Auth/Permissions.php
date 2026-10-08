<?php
declare(strict_types=1);

namespace AM\Auth;

use AM\Kernel\HttpError;

/**
 * Role matrix (API.md §6.1). The server decides everything; the app only
 * hides what a role can't use. Role and money flag are read fresh on every
 * request (Session middleware), so changes apply at once.
 */
final class Permissions
{
    public const ADMIN_ROLES = ['owner', 'partner'];
    public const EDITOR_ROLES = ['owner', 'partner', 'family'];

    /** @param array<string,mixed> $user */
    public static function forUser(array $user): array
    {
        $admin = self::isAdmin($user);
        return [
            'money' => (bool) $user['can_see_money'],
            'edit' => in_array($user['role'], self::EDITOR_ROLES, true),
            'admin' => $admin,
            'owner' => $user['role'] === 'owner',
            'events_write' => $admin,
            'trash' => $admin,
            'export' => $admin,
            'activity' => $admin,
        ];
    }

    public static function isAdmin(?array $user): bool
    {
        return $user !== null && in_array($user['role'], self::ADMIN_ROLES, true);
    }

    public static function requireAdmin(?array $user): void
    {
        if (!self::isAdmin($user)) {
            throw HttpError::make(403, 'forbidden');
        }
    }

    public static function requireEditor(?array $user): void
    {
        if ($user === null || !in_array($user['role'], self::EDITOR_ROLES, true)) {
            throw HttpError::make(403, 'forbidden');
        }
    }

    public static function canSeeMoney(?array $user): bool
    {
        return $user !== null && (bool) $user['can_see_money'];
    }
}
