<?php
declare(strict_types=1);

namespace AM\Kernel;

/** DATETIME columns are UTC "Y-m-d H:i:s"; the API speaks ISO 8601 with Z (API.md §1.1). */
final class Time
{
    public static function iso(?string $dbUtc): ?string
    {
        if ($dbUtc === null || $dbUtc === '') {
            return null;
        }
        return gmdate('Y-m-d\TH:i:s\Z', (int) strtotime($dbUtc . ' UTC'));
    }

    public static function db(int $timestamp): string
    {
        return gmdate('Y-m-d H:i:s', $timestamp);
    }

    public static function isDate(mixed $v): bool
    {
        if (!is_string($v) || !preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $v, $m)) {
            return false;
        }
        return checkdate((int) $m[2], (int) $m[3], (int) $m[1]);
    }
}
