<?php
declare(strict_types=1);

namespace AM\Kernel;

/**
 * Fixed rules live in code, not .env, so nobody can change them by editing a
 * file (IMPLEMENTATION §1.1).
 */
final class AppInfo
{
    /** Highest migration this code needs. Below it, writes get 503 app_updating (DATABASE rule 14). */
    public const EXPECTED_SCHEMA_VERSION = 3;

    /** Nothing is hard-deleted before this date (CONTEXT decision 34). */
    public const PURGE_ALLOWED_FROM = '2027-05-16';

    /** App version, from the VERSION file copied next to the code (private/app/VERSION) or the repo root. */
    public static function version(): string
    {
        foreach ([dirname(__DIR__, 2) . '/VERSION', dirname(__DIR__, 3) . '/VERSION'] as $file) {
            if (is_file($file)) {
                return trim((string) file_get_contents($file));
            }
        }
        return '0.0.0';
    }
}
