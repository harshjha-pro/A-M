<?php
declare(strict_types=1);

namespace AM\Modules\Tasks;

use AM\Db\Db;
use AM\Kernel\App;
use AM\Kernel\Time;
use AM\Repo\EntityDef;
use AM\Repo\Refs;

/** One checklist line inside a task, addressed by its key (client_uuid). */
final class TaskItemDef extends EntityDef
{
    public const TABLE = 'task_items';
    public const TYPE = 'task_item';
    public const RESOURCE = '';
    public const LABEL = 'checklist item';
    public const LABEL_PLURAL = 'checklist items';
    public const PUBLIC_ID = false;
    public const KEY = 'client_uuid';
    public const FIELD_LABELS = ['text' => 'Text', 'is_done' => 'Done', 'sort_order' => 'Order'];
    public const PARENT = [TaskDef::class, 'task_id'];

    public static function name(array $row): string
    {
        return '‘' . $row['text'] . '’';
    }

    public static function present(App $app, Db $db, Refs $refs, array $row, ?array $viewer): array
    {
        return [
            'key' => $row['client_uuid'],
            'version' => (int) $row['version'],
            'text' => $row['text'],
            'is_done' => (bool) $row['is_done'],
            'sort_order' => (int) $row['sort_order'],
            'done_by' => $refs->user($row['done_by'] !== null ? (int) $row['done_by'] : null),
            'done_at' => Time::iso($row['done_at']),
        ];
    }

    public static function formatValue(string $field, mixed $value): string
    {
        return $field === 'is_done' ? ((int) $value ? 'Yes' : 'No') : parent::formatValue($field, $value);
    }
}
