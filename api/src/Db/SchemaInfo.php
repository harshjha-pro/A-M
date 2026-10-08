<?php
declare(strict_types=1);

namespace AM\Db;

use AM\Kernel\AppInfo;

/** Reads schema_migrations: which version is applied, and did any file stop part-way? */
final class SchemaInfo
{
    /** @return array{version:int, unfinished:bool, ok:bool} */
    public static function read(Db $db): array
    {
        $row = $db->one(
            'SELECT COALESCE(MAX(CASE WHEN finished_at IS NOT NULL THEN version END), 0) AS v,
                    COALESCE(SUM(finished_at IS NULL), 0) AS unfinished
             FROM schema_migrations'
        ) ?? ['v' => 0, 'unfinished' => 0];
        $version = (int) $row['v'];
        $unfinished = (int) $row['unfinished'] > 0;
        return [
            'version' => $version,
            'unfinished' => $unfinished,
            'ok' => !$unfinished && $version >= AppInfo::EXPECTED_SCHEMA_VERSION,
        ];
    }
}
