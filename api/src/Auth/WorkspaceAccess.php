<?php
declare(strict_types=1);

namespace AM\Auth;

use AM\Kernel\HttpError;

/**
 * Who may use Workspaces, the Attachment Vault, outfits, menu, contacts and the event timeline.
 * 1.0.17–1.0.20: Ayush and Mahi only. 1.0.21 (owner's request, "visible to all for now"):
 * everyone who can log in sees them; owner, partner and family members (editors) change them.
 * Set OPEN_TO_ALL to false to make them admin-only again. Private documents stay admin-only.
 */
final class WorkspaceAccess
{
    public const OPEN_TO_ALL = true;

    public static function canView(?array $user): bool
    {
        return self::OPEN_TO_ALL ? $user !== null : Permissions::isAdmin($user);
    }

    public static function canWrite(?array $user): bool
    {
        return self::OPEN_TO_ALL
            ? $user !== null && in_array($user['role'], Permissions::EDITOR_ROLES, true)
            : Permissions::isAdmin($user);
    }

    public static function requireView(?array $user): void
    {
        if (!self::canView($user)) {
            throw HttpError::make(403, 'forbidden');
        }
    }

    public static function requireWrite(?array $user): void
    {
        if (!self::canWrite($user)) {
            throw HttpError::make(403, 'forbidden');
        }
    }
}
