<?php
declare(strict_types=1);

namespace AM\Modules\Guests;

use AM\Db\Db;
use AM\Kernel\App;
use AM\Kernel\Time;
use AM\Repo\EntityDef;
use AM\Repo\Refs;

/** One guest import (FEATURES A8): its counts and the batch holding every row it added or filled. */
final class ImportDef extends EntityDef
{
    public const TABLE = 'imports';
    public const TYPE = 'import';
    public const RESOURCE = 'imports';
    public const LABEL = 'import';
    public const LABEL_PLURAL = 'imports';
    public const SOFT_DELETE = false; // an import is undone through its batch, never deleted

    /** "guests.xlsx" / "a pasted list" — used in "Ayush imported guests.xlsx (480 added …)." */
    public static function name(array $row): string
    {
        return ($row['file_name'] ?? null) ?: match ($row['source'] ?? '') {
            'paste' => 'a pasted list', 'vcf' => 'a contacts file', default => 'a guest list',
        };
    }

    public static function present(App $app, Db $db, Refs $refs, array $row, ?array $viewer): array
    {
        $batch = $db->one('SELECT public_id, undone_at FROM change_batches WHERE id = ?', [$row['batch_id']]) ?? [];
        return [
            'id' => $row['public_id'],
            'version' => (int) $row['version'],
            'source' => $row['source'],
            'file_name' => $row['file_name'],
            'rows_read' => (int) $row['rows_read'],
            'created_count' => (int) $row['created_count'],
            'updated_count' => (int) $row['updated_count'],
            'skipped_count' => (int) $row['skipped_count'],
            'error_count' => (int) $row['error_count'],
            'invitations_count' => (int) $row['invitations_count'],
            'batch_id' => $batch['public_id'] ?? null,
            'undone_at' => Time::iso($batch['undone_at'] ?? null),
            'created_at' => Time::iso($row['created_at']),
            'created_by' => $refs->user($row['created_by'] !== null ? (int) $row['created_by'] : null),
            'updated_at' => Time::iso($row['updated_at']),
            'updated_by' => $refs->user($row['updated_by'] !== null ? (int) $row['updated_by'] : null),
        ];
    }
}
