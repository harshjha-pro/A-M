<?php
declare(strict_types=1);

namespace AM\Kernel;

/**
 * CSV lines the way FEATURES B8 wants them: RFC 4180 quoting, and formula safety
 * (AC-EXP-07). Callers add the UTF-8 BOM once at the top so Excel shows Hindi and ₹.
 */
final class Csv
{
    public const BOM = "\u{FEFF}";

    /** One RFC 4180 line (no line break). */
    public static function line(array $cells): string
    {
        return implode(',', array_map(static function ($v): string {
            $s = self::safe($v === null ? '' : (string) $v);
            return preg_match('/[",\r\n]/', $s) ? '"' . str_replace('"', '""', $s) . '"' : $s;
        }, $cells));
    }

    /** =, @, tab or CR first, or + / - that isn't a phone or a number → a leading '. */
    public static function safe(string $s): string
    {
        if ($s === '') {
            return $s;
        }
        $first = $s[0];
        $risky = in_array($first, ['=', '@', "\t", "\r"], true)
            || (($first === '+' || $first === '-') && !preg_match('/^\+\d{8,15}$/', $s) && !preg_match('/^-?\d+(\.\d+)?$/', $s));
        return $risky ? "'" . $s : $s;
    }
}
