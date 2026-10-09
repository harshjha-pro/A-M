<?php
declare(strict_types=1);

namespace AM\Modules\Tasks;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Kernel\App;
use AM\Repo\EntityDef;
use AM\Repo\Refs;
use AM\Safety\History;

/** Tasks (FEATURES B3). Children deleted and restored with the task: checklist, assignees, tags. */
final class TaskDef extends EntityDef
{
    public const TABLE = 'tasks';
    public const TYPE = 'task';
    public const RESOURCE = 'tasks';
    public const LABEL = 'task';
    public const LABEL_PLURAL = 'tasks';
    public const FIELD_LABELS = [
        'title' => 'Title',
        'notes' => 'Notes',
        'status' => 'Status',
        'priority' => 'Priority',
        'due_date' => 'Due date',
        'due_time' => 'Due time',
        'assignees' => 'Assigned to',
        'tags' => 'Tags',
        'event' => 'Event',
        'vendor' => 'Vendor',
        'household' => 'Family',
    ];
    public const CHILDREN = [
        TaskItemDef::class => 'task_id',
        TaskAssigneeDef::class => 'task_id',
        TaskTagDef::class => 'task_id',
    ];
    public const STATUS = ['todo' => 'To do', 'doing' => 'Doing', 'waiting' => 'Waiting', 'done' => 'Done', 'cancelled' => 'Cancelled'];
    public const PRIORITY = ['urgent' => 'Urgent', 'normal' => 'Normal', 'low' => 'Low'];
    public const OPEN = ['todo', 'doing', 'waiting'];

    public static function name(array $row): string
    {
        return (string) $row['title'];
    }

    public static function present(App $app, Db $db, Refs $refs, array $row, ?array $viewer): array
    {
        return TaskView::full($app, $db, $refs, $row);
    }

    /** Only admins delete any task; Family their own (created by them or assigned to them). */
    public static function canDelete(Db $db, ?array $viewer, array $row): bool
    {
        if (Permissions::isAdmin($viewer)) {
            return true;
        }
        if ($viewer === null || !in_array($viewer['role'], Permissions::EDITOR_ROLES, true)) {
            return false;
        }
        if ((int) ($row['created_by'] ?? 0) === (int) $viewer['id']) {
            return true;
        }
        return $db->value('SELECT 1 FROM task_assignees WHERE task_id = ? AND user_id = ? AND deleted_at IS NULL', [$row['id'], $viewer['id']]) !== null;
    }

    public static function formatValue(string $field, mixed $value): string
    {
        return match ($field) {
            'status' => self::STATUS[(string) $value] ?? (string) $value,
            'priority' => self::PRIORITY[(string) $value] ?? (string) $value,
            'due_time' => $value === null ? '(empty)' : substr((string) $value, 0, 5),
            'assignees', 'tags' => is_array($value) ? ($value === [] ? '(nobody)' : implode(', ', $value)) : History::formatValue($value),
            default => History::formatValue($value),
        };
    }
}
