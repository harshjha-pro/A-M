<?php
declare(strict_types=1);

namespace AM\Repo;

use AM\Modules\Members\UserDef;
use AM\Modules\Safety\RestoreDrillDef;
use AM\Modules\Settings\SettingsDef;

/** Every record type the shared base code knows. Later sessions add theirs here. */
final class Entities
{
    /** audit_log.entity_type => definition */
    public const TYPES = [
        'restore_drill' => RestoreDrillDef::class,
        'user' => UserDef::class,
        'settings' => SettingsDef::class,
    ];

    /** URL segment for /{resource}/{id}/history => definition */
    public const RESOURCES = [
        'members' => UserDef::class,
        'restore-drills' => RestoreDrillDef::class,
    ];

    /** @return class-string<EntityDef>|null */
    public static function forType(string $type): ?string
    {
        return self::TYPES[$type] ?? null;
    }

    /** Types whose rows can sit in Deleted items (parents first). @return list<class-string<EntityDef>> */
    public static function deletable(): array
    {
        $defs = array_values(array_filter(self::TYPES, static fn ($d) => $d::SOFT_DELETE && $d::PUBLIC_ID));
        usort($defs, static fn ($a, $b) => ($a::PARENT === null ? 0 : 1) <=> ($b::PARENT === null ? 0 : 1));
        return $defs;
    }
}
