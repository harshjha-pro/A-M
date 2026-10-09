<?php
declare(strict_types=1);

namespace AM\Modules\Safety;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Kernel\App;
use AM\Kernel\Strings;
use AM\Kernel\Time;
use AM\Repo\EntityDef;
use AM\Repo\Refs;
use AM\Safety\History;
use AM\Validation\Fields;
use DateTimeImmutable;

/** Monthly restore test log (FEATURES B10). Admins only. The first record type built on the shared base code. */
final class RestoreDrillDef extends EntityDef
{
    public const TABLE = 'restore_drills';
    public const TYPE = 'restore_drill';
    public const RESOURCE = 'restore-drills';
    public const LABEL = 'restore drill';
    public const LABEL_PLURAL = 'restore drills';
    public const FIELD_LABELS = [
        'done_on' => 'Date',
        'result' => 'Result',
        'backup_file' => 'Backup file',
        'notes' => 'Notes',
    ];

    public static function name(array $row): string
    {
        return isset($row['done_on']) ? 'Restore drill · ' . (new DateTimeImmutable((string) $row['done_on']))->format('j M Y') : 'a restore drill';
    }

    public static function canView(?array $viewer, array $row): bool
    {
        return Permissions::isAdmin($viewer);
    }

    public static function present(App $app, Db $db, Refs $refs, array $row, ?array $viewer): array
    {
        return [
            'id' => $row['public_id'],
            'version' => (int) $row['version'],
            'done_on' => $row['done_on'],
            'result' => $row['result'],
            'backup_file' => $row['backup_file'],
            'notes' => $row['notes'],
            'done_by' => $refs->user((int) $row['done_by']),
            'created_at' => Time::iso($row['created_at']),
            'created_by' => $refs->user($row['created_by'] !== null ? (int) $row['created_by'] : null),
            'updated_at' => Time::iso($row['updated_at']),
            'updated_by' => $refs->user($row['updated_by'] !== null ? (int) $row['updated_by'] : null),
        ];
    }

    public static function input(App $app, Fields $f, bool $create, ?array $current): array
    {
        $f->only(array_keys(self::FIELD_LABELS));
        $out = [];
        if ($create || $f->has('done_on')) {
            $d = $f->date('done_on', true);
            if ($d !== null && $d > $app->clock->todayIst()) {
                $f->error('done_on', Strings::get('field_date_future'));
            }
            $out['done_on'] = $d;
        }
        if ($create || $f->has('result')) {
            $out['result'] = $f->enum('result', ['passed', 'failed'], true);
        }
        if ($create || $f->has('backup_file')) {
            $out['backup_file'] = $f->text('backup_file', 120);
        }
        if ($create || $f->has('notes')) {
            $out['notes'] = $f->text('notes', 5000);
        }
        return $out;
    }

    public static function onCreate(App $app, array $viewer): array
    {
        return ['done_by' => (int) $viewer['id']];
    }

    public static function formatValue(string $field, mixed $value): string
    {
        if ($field === 'result' && is_string($value)) {
            return ucfirst($value);
        }
        return History::formatValue($value);
    }
}
