<?php
declare(strict_types=1);

namespace AM\Modules\Tasks;

use AM\Db\Db;
use AM\Kernel\App;
use AM\Repo\EntityDef;
use AM\Repo\Refs;

/** Link row task ↔ user. No version, no public id; the task's own lines describe it. */
final class TaskAssigneeDef extends EntityDef
{
    public const TABLE = 'task_assignees';
    public const TYPE = 'task_assignee';
    public const LABEL = 'assignee';
    public const LABEL_PLURAL = 'assignees';
    public const PUBLIC_ID = false;
    public const VERSIONED = false;
    public const KEY = null;
    public const IN_ACTIVITY = false;
    public const PARENT = [TaskDef::class, 'task_id'];

    public static function name(array $row): string
    {
        return 'assignee';
    }

    public static function present(App $app, Db $db, Refs $refs, array $row, ?array $viewer): array
    {
        return $refs->user((int) $row['user_id']) ?? [];
    }
}
