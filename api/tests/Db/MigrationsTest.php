<?php
declare(strict_types=1);

namespace Tests\Db;

use PDO;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDb;

/** DS-28 and the Session 1 DB checks: migrations apply, a second run stops at each guard, the seed loads. */
final class MigrationsTest extends TestCase
{
    private const SCRATCH = 'am_test_migrations';

    public static function setUpBeforeClass(): void
    {
        TestDb::rebuild(self::SCRATCH);
    }

    public static function tearDownAfterClass(): void
    {
        TestDb::server()->exec('DROP DATABASE IF EXISTS `' . self::SCRATCH . '`');
        TestDb::server()->exec('DROP DATABASE IF EXISTS `am_test_seed`');
    }

    public function test_all_migrations_applied_and_finished(): void
    {
        $pdo = TestDb::connect(self::SCRATCH);
        $rows = $pdo->query('SELECT version, name, finished_at FROM schema_migrations ORDER BY version')->fetchAll();
        $this->assertSame([1, 2, 3], array_map(static fn ($r) => (int) $r['version'], $rows));
        foreach ($rows as $r) {
            $this->assertNotNull($r['finished_at'], "{$r['name']} has finished_at NULL (stopped part-way)");
        }
        $tables = (int) $pdo->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '" . self::SCRATCH . "'")->fetchColumn();
        $this->assertSame(30, $tables, 'DATABASE.md §1: 30 tables after 003');
    }

    public function test_reference_data_after_002(): void
    {
        $pdo = TestDb::connect(self::SCRATCH);
        $this->assertSame('groom', $pdo->query("SELECT side FROM events WHERE type = 'mayra'")->fetchColumn(), 'Mayra is groom side (002)');
        $this->assertSame(7, (int) $pdo->query('SELECT COUNT(*) FROM events')->fetchColumn());
        $this->assertSame(0, (int) $pdo->query("SELECT COUNT(*) FROM events WHERE type = 'roka'")->fetchColumn(), 'No separate Roka (decision 23)');
        $food = $pdo->query("SELECT COLUMN_TYPE FROM information_schema.columns WHERE table_schema = '" . self::SCRATCH . "' AND table_name = 'households' AND column_name = 'food'")->fetchColumn();
        $this->assertSame("enum('veg','jain','mixed')", $food, 'Only veg is served (decision 25)');
        $this->assertSame(1, (int) $pdo->query('SELECT COUNT(*) FROM budget_categories WHERE is_fallback = 1')->fetchColumn());
    }

    public function test_second_run_of_every_migration_stops_at_its_guard(): void
    {
        $pdo = TestDb::connect(self::SCRATCH);
        $before = $this->fingerprint($pdo);

        foreach (TestDb::MIGRATIONS as $file) {
            $result = TestDb::runFile($pdo, TestDb::root() . '/db/migrations/' . $file);
            $this->assertNotNull($result['error'], "$file ran twice without stopping");
            $this->assertMatchesRegularExpression(
                '/schema_migrations/i',
                (string) $result['statement'],
                "$file must stop at its schema_migrations guard, stopped at: " . substr((string) $result['statement'], 0, 80),
            );
            $this->assertMatchesRegularExpression('/already exists|Duplicate entry/i', (string) $result['error']);
        }
        $this->assertSame($before, $this->fingerprint($pdo), 'Second run changed data');
    }

    public function test_seed_demo_loads_and_keeps_hindi_and_emoji(): void
    {
        $db = 'am_test_seed';
        TestDb::rebuild($db, false); // migrations only, like staging
        $pdo = TestDb::connect($db);
        $result = TestDb::runFile($pdo, TestDb::root() . '/db/dev/seed_demo.sql');
        $this->assertNull($result['error'], 'seed_demo.sql failed: ' . $result['error']);

        $this->assertSame(61, (int) $pdo->query('SELECT COUNT(*) FROM households')->fetchColumn(), '60 live + 1 deleted family');
        $this->assertSame(8, (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn());
        $name = $pdo->query("SELECT name FROM users WHERE role = 'viewer' LIMIT 1")->fetchColumn();
        $this->assertStringContainsString('कमला', (string) $name, 'Devanagari intact');

        // second run stops at the first insert (user id 1)
        $again = TestDb::runFile($pdo, TestDb::root() . '/db/dev/seed_demo.sql');
        $this->assertStringContainsString('Duplicate entry', (string) $again['error']);
        $this->assertSame(61, (int) $pdo->query('SELECT COUNT(*) FROM households')->fetchColumn());
    }

    public function test_emoji_round_trip(): void
    {
        $pdo = TestDb::connect(self::SCRATCH);
        $note = 'Namaste 🙏🏽 👨‍👩‍👧 ✈️ राम शर्मा';
        $pdo->prepare('UPDATE settings SET city = ? WHERE id = 1')->execute([$note]);
        $this->assertSame($note, $pdo->query('SELECT city FROM settings WHERE id = 1')->fetchColumn());
    }

    /** Row counts of every table + schema_migrations content. */
    private function fingerprint(PDO $pdo): string
    {
        $tables = $pdo->query("SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name")->fetchAll(PDO::FETCH_COLUMN);
        $parts = [];
        foreach ($tables as $t) {
            $parts[] = $t . '=' . $pdo->query("SELECT COUNT(*) FROM `$t`")->fetchColumn();
        }
        $parts[] = json_encode($pdo->query('SELECT * FROM schema_migrations ORDER BY version')->fetchAll());
        return implode('|', $parts);
    }
}
