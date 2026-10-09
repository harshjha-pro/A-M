<?php
declare(strict_types=1);

namespace AM\Modules\Members;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Kernel\App;
use AM\Repo\EntityDef;
use AM\Repo\Refs;
use AM\Safety\History;

/** Members, for History and Activity. Members are never deleted (FEATURES B1): deactivate instead. */
final class UserDef extends EntityDef
{
    public const TABLE = 'users';
    public const TYPE = 'user';
    public const RESOURCE = 'members';
    public const LABEL = 'member';
    public const LABEL_PLURAL = 'members';
    public const SOFT_DELETE = false;
    public const FIELD_LABELS = [
        'name' => 'Name',
        'phone' => 'Phone',
        'email' => 'Email',
        'role' => 'Role',
        'can_see_money' => 'Can see money',
        'is_active' => 'Access',
        'access_ends_on' => 'Access ends on',
    ];
    private const ROLES = ['owner' => 'Owner', 'partner' => 'Partner', 'family' => 'Family', 'viewer' => 'Viewer'];

    public static function name(array $row): string
    {
        return (string) ($row['name'] ?? 'a member');
    }

    /** Everyone sees members' names and phones; only admins and the person see the rest. */
    public static function visibleFields(?array $viewer): ?array
    {
        return Permissions::isAdmin($viewer) ? null : ['name', 'phone', 'role'];
    }

    public static function present(App $app, Db $db, Refs $refs, array $row, ?array $viewer): array
    {
        return MemberView::full($db, $refs, $row);
    }

    public static function formatValue(string $field, mixed $value): string
    {
        return match ($field) {
            'role' => self::ROLES[$value] ?? (string) $value,
            'can_see_money' => (int) $value === 1 ? 'Yes' : 'No',
            'is_active' => (int) $value === 1 ? 'On' : 'Off',
            default => History::formatValue($value),
        };
    }
}
