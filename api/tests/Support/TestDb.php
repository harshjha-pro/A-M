<?php
declare(strict_types=1);

namespace Tests\Support;

use AM\Kernel\Env;
use PDO;
use PDOException;

/** Builds and resets the test database (TESTING §1.2). */
final class TestDb
{
    public const MIGRATIONS = ['001_init.sql', '002_open_answers.sql', '003_api_support.sql'];

    /** @var array<string,string> outcome of the first build, for TEST-REPORT */
    public static array $buildLog = [];

    public static function root(): string
    {
        return dirname(__DIR__, 3);
    }

    public static function name(): string
    {
        return (string) getenv('AM_TEST_DB_NAME') ?: 'am_test';
    }

    /** Env for an App pointed at the test database. */
    public static function env(array $overrides = []): Env
    {
        return Env::fromArray($overrides + [
            'APP_ENV' => 'test',
            'APP_URL' => 'https://wedding.lumorrahouse.com',
            'DB_HOST' => (string) getenv('AM_TEST_DB_HOST'),
            'DB_PORT' => (string) getenv('AM_TEST_DB_PORT'),
            'DB_NAME' => self::name(),
            'DB_USER' => (string) getenv('AM_TEST_DB_USER'),
            'DB_PASS' => (string) getenv('AM_TEST_DB_PASS'),
            'MIN_CLIENT_VERSION' => '1.0.0',
            'BACKUP_EXPECTED' => 'false',
        ]);
    }

    public static function server(): PDO
    {
        $pdo = new PDO(
            sprintf('mysql:host=%s;port=%s;charset=utf8mb4', getenv('AM_TEST_DB_HOST'), getenv('AM_TEST_DB_PORT')),
            (string) getenv('AM_TEST_DB_USER'),
            (string) getenv('AM_TEST_DB_PASS'),
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC],
        );
        $pdo->exec("SET time_zone = '+00:00'");
        $pdo->exec("SET SESSION sql_mode = 'STRICT_ALL_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO'");
        return $pdo;
    }

    public static function connect(?string $db = null): PDO
    {
        $pdo = self::server();
        $pdo->exec('USE `' . ($db ?? self::name()) . '`');
        return $pdo;
    }

    /** Drop, create, apply 001 → 002 → 003, then fixtures. */
    public static function rebuild(?string $db = null, bool $withFixtures = true): void
    {
        $db ??= self::name();
        $pdo = self::server();
        $pdo->exec("DROP DATABASE IF EXISTS `$db`");
        $pdo->exec("CREATE DATABASE `$db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        $pdo->exec("USE `$db`");
        foreach (self::MIGRATIONS as $file) {
            $result = self::runFile($pdo, self::root() . '/db/migrations/' . $file);
            if ($result['error'] !== null) {
                fwrite(STDERR, "Migration $file FAILED at statement {$result['failed_at']}: {$result['error']}\n");
                exit(1);
            }
            self::$buildLog[$file] = 'applied (' . $result['ran'] . ' statements)';
        }
        if (!$withFixtures) {
            return;
        }
        $fx = self::runFile($pdo, self::root() . '/db/test/fixtures.sql');
        if ($fx['error'] !== null) {
            fwrite(STDERR, "fixtures.sql FAILED: {$fx['error']}\n");
            exit(1);
        }
    }

    /**
     * Runs a .sql file statement by statement and stops at the first error,
     * like phpMyAdmin's import.
     * @return array{ran:int, failed_at:?int, error:?string, statement:?string}
     */
    public static function runFile(PDO $pdo, string $path): array
    {
        $statements = SqlScript::statements((string) file_get_contents($path));
        foreach ($statements as $i => $sql) {
            try {
                $pdo->exec($sql);
            } catch (PDOException $e) {
                return ['ran' => $i, 'failed_at' => $i, 'error' => $e->getMessage(), 'statement' => $sql];
            }
        }
        return ['ran' => count($statements), 'failed_at' => null, 'error' => null, 'statement' => null];
    }

    /** Clears the ephemeral tables between tests (rate limits etc.). */
    public static function resetEphemeral(): void
    {
        $pdo = self::connect();
        foreach (['rate_limits', 'login_attempts', 'idempotency_keys'] as $t) {
            $pdo->exec("DELETE FROM `$t`");
        }
    }
}
