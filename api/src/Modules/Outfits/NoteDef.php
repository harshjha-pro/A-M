<?php
declare(strict_types=1);

namespace AM\Modules\Outfits;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Kernel\App;
use AM\Kernel\Time;
use AM\Repo\EntityDef;
use AM\Repo\Refs;
use AM\Validation\Fields;

/** A short note on an outfit, an accessory or a timeline step: who wrote it and when. */
final class NoteDef extends EntityDef
{
    public const TABLE = 'notes';
    public const TYPE = 'note';
    public const RESOURCE = 'notes';
    public const LABEL = 'note';
    public const LABEL_PLURAL = 'notes';
    public const FIELD_LABELS = ['body' => 'Note'];
    public const QUIET_IN_PARENT_BATCH = true;

    public static function name(array $row): string
    {
        $b = trim((string) ($row['body'] ?? ''));
        return $b === '' ? 'a note' : 'Note “' . (mb_strlen($b) > 40 ? mb_substr($b, 0, 40) . '…' : $b) . '”';
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
            'body' => $row['body'],
            'created_at' => Time::iso($row['created_at']),
            'created_by' => $refs->user($row['created_by'] !== null ? (int) $row['created_by'] : null),
            'updated_at' => Time::iso($row['updated_at']),
        ];
    }

    public static function input(App $app, Fields $f, bool $create, ?array $current): array
    {
        $f->only($create ? ['body', 'outfit_id', 'accessory_id', 'outfit_step_id'] : ['body']);
        return ['body' => $f->text('body', 5000, true)];
    }
}
