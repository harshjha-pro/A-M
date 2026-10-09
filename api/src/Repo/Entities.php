<?php
declare(strict_types=1);

namespace AM\Repo;

use AM\Modules\Events\EventDef;
use AM\Modules\Events\InvitationDef;
use AM\Modules\Guests\HouseholdDef;
use AM\Modules\Guests\ImportDef;
use AM\Modules\Members\UserDef;
use AM\Modules\Safety\RestoreDrillDef;
use AM\Modules\Settings\SettingsDef;
use AM\Modules\Tasks\TagDef;
use AM\Modules\Tasks\TaskAssigneeDef;
use AM\Modules\Tasks\TaskDef;
use AM\Modules\Tasks\TaskItemDef;
use AM\Modules\Tasks\TaskTagDef;

/** Every record type the shared base code knows. Later sessions add theirs here. */
final class Entities
{
    /** audit_log.entity_type => definition */
    public const TYPES = [
        'restore_drill' => RestoreDrillDef::class,
        'user' => UserDef::class,
        'settings' => SettingsDef::class,
        'task' => TaskDef::class,
        'task_item' => TaskItemDef::class,
        'task_assignee' => TaskAssigneeDef::class,
        'task_tag' => TaskTagDef::class,
        'tag' => TagDef::class,
        'event' => EventDef::class,
        'household' => HouseholdDef::class,
        'invitation' => InvitationDef::class,
        'import' => ImportDef::class,
    ];

    /** URL segment for /{resource}/{id}/history => definition */
    public const RESOURCES = [
        'members' => UserDef::class,
        'restore-drills' => RestoreDrillDef::class,
        'tasks' => TaskDef::class,
        'tags' => TagDef::class,
        'events' => EventDef::class,
        'households' => HouseholdDef::class,
    ];

    /** The value that names a row (public id or checklist key); null for link rows. */
    public static function key(string $def, array $row): ?string
    {
        return $def::KEY !== null ? ($row[$def::KEY] ?? null) : null;
    }

    /** audit_log.entity_type values hidden from Activity and History. @return list<string> */
    public static function hiddenTypes(): array
    {
        return array_keys(array_filter(self::TYPES, static fn ($d) => !$d::IN_ACTIVITY));
    }

    /**
     * SQL that drops a quiet child's lines when its parent's batch moved it
     * (a family deleted with its invitations reads as one line). Needs audit_log a + change_batches cb.
     * @return array{0:string, 1:list<string>}
     */
    public static function quietChildSql(): array
    {
        $types = array_keys(array_filter(self::TYPES, static fn ($d) => $d::QUIET_IN_PARENT_BATCH));
        if ($types === []) {
            return ['1 = 1', []];
        }
        $in = implode(',', array_fill(0, count($types), '?'));
        return ["NOT (a.entity_type IN ($in) AND cb.id IS NOT NULL AND cb.entity_type <> a.entity_type)", $types];
    }

    /** @return class-string<EntityDef>|null */
    public static function forType(string $type): ?string
    {
        return self::TYPES[$type] ?? null;
    }

    /** Types whose rows can sit in Deleted items (parents first). @return list<class-string<EntityDef>> */
    public static function deletable(): array
    {
        $defs = array_values(array_filter(self::TYPES, static fn ($d) => $d::SOFT_DELETE));
        usort($defs, static fn ($a, $b) => ($a::PARENT === null ? 0 : 1) <=> ($b::PARENT === null ? 0 : 1));
        return $defs;
    }
}
