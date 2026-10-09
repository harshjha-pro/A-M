<?php
declare(strict_types=1);

namespace AM\Modules\Tasks;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Strings;
use AM\Kernel\Time;
use AM\Repo\EntityDef;
use AM\Repo\Refs;
use AM\Validation\Fields;

/** Tags for tasks (FEATURES B3). Anyone who edits adds; only admins rename or delete. */
final class TagDef extends EntityDef
{
    public const TABLE = 'tags';
    public const TYPE = 'tag';
    public const RESOURCE = 'tags';
    public const LABEL = 'tag';
    public const LABEL_PLURAL = 'tags';
    public const FIELD_LABELS = ['name' => 'Name'];
    /** Deleting a tag takes it off every task in the same batch. */
    public const CHILDREN = [TaskTagDef::class => 'tag_id'];

    public static function name(array $row): string
    {
        return isset($row['name']) ? 'Tag · ' . $row['name'] : 'a tag';
    }

    public static function present(App $app, Db $db, Refs $refs, array $row, ?array $viewer): array
    {
        return [
            'id' => $row['public_id'],
            'version' => (int) $row['version'],
            'name' => $row['name'],
            'task_count' => (int) $db->value(
                'SELECT COUNT(*) FROM task_tags tt JOIN tasks t ON t.id = tt.task_id WHERE tt.tag_id = ? AND tt.deleted_at IS NULL AND t.deleted_at IS NULL',
                [$row['id']],
            ),
            'created_at' => Time::iso($row['created_at']),
            'created_by' => $refs->user($row['created_by'] !== null ? (int) $row['created_by'] : null),
            'updated_at' => Time::iso($row['updated_at']),
            'updated_by' => $refs->user($row['updated_by'] !== null ? (int) $row['updated_by'] : null),
        ];
    }

    public static function input(App $app, Fields $f, bool $create, ?array $current): array
    {
        $f->only(['name']);
        $name = $f->text('name', 30, true);
        if ($name !== null) {
            self::assertFree($app->db(), $name, $current['id'] ?? null);
        }
        return ['name' => $name];
    }

    /** 409 duplicate_found when a live tag already has this name (ignoring case). */
    public static function assertFree(Db $db, string $name, ?int $exceptId = null): void
    {
        $other = $db->one('SELECT public_id, name FROM tags WHERE deleted_at IS NULL AND LOWER(name) = LOWER(?) AND id <> ?', [$name, $exceptId ?? 0]);
        if ($other !== null) {
            throw new HttpError(409, 'duplicate_found', Strings::get('duplicate_found', ['name' => $other['name']]), [
                'matches' => [['id' => $other['public_id'], 'name' => $other['name']]],
            ]);
        }
    }

    public static function restoreCheck(Db $db, array $row): ?array
    {
        $taken = $db->value('SELECT 1 FROM tags WHERE deleted_at IS NULL AND LOWER(name) = LOWER(?) AND id <> ?', [$row['name'], $row['id']]);
        return $taken !== null ? ['blocked' => Strings::get('tag_name_taken', ['name' => $row['name']])] : null;
    }

    /** Add: anyone who edits. Rename, delete: admins. */
    public static function canWrite(?array $viewer, string $action): void
    {
        $action === 'create' ? Permissions::requireEditor($viewer) : Permissions::requireAdmin($viewer);
    }
}
