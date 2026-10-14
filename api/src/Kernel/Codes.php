<?php
declare(strict_types=1);

namespace AM\Kernel;

use AM\Db\Db;

/**
 * Short random IDs people can read out and type (1.0.22): ATT-7K3F9Q, TSK-4M8Q2D.
 * No letters or digits that look alike (0/O, 1/I/L, U). Editable later; unique per table
 * (capitals ignored by the column's collation). Migration 009 uses the same alphabet.
 */
final class Codes
{
    public const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
    /** 3–30 letters, numbers, - or _ (an ID typed by hand). */
    public const FORMAT = '/^[A-Za-z0-9_-]{3,30}$/';

    /** A fresh code not used in `$table`.`code` (deleted rows keep theirs, so they count). */
    public static function random(Db $db, string $prefix, string $table): string
    {
        if (!in_array($table, ['attachments', 'tasks'], true)) {
            throw new \LogicException("No codes on $table");
        }
        do {
            $code = $prefix . '-';
            for ($i = 0; $i < 6; $i++) {
                $code .= self::ALPHABET[random_int(0, strlen(self::ALPHABET) - 1)];
            }
        } while ($db->value("SELECT 1 FROM `$table` WHERE code = ?", [$code]) !== null);
        return $code;
    }
}
