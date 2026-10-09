<?php
declare(strict_types=1);

namespace AM\Modules\Tasks;

use AM\Db\Db;
use AM\Kernel\App;
use AM\Repo\EntityDef;
use AM\Repo\Refs;

/** Link row task ↔ tag. Deleted with the task, or with the tag. */
final class TaskTagDef extends EntityDef
{
    public const TABLE = 'task_tags';
    public const TYPE = 'task_tag';
    public const LABEL = 'tag link';
    public const LABEL_PLURAL = 'tag links';
    public const PUBLIC_ID = false;
    public const VERSIONED = false;
    public const KEY = null;
    public const IN_ACTIVITY = false;
    public const PARENT = [TaskDef::class, 'task_id'];

    public static function name(array $row): string
    {
        return 'tag link';
    }

    public static function present(App $app, Db $db, Refs $refs, array $row, ?array $viewer): array
    {
        return [];
    }
}
