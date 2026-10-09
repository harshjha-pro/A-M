<?php
declare(strict_types=1);

namespace Tests\Support;

use AM\Db\Db;
use AM\Kernel\App;
use AM\Kernel\Env;
use AM\Kernel\FrozenClock;
use AM\Kernel\Logger;
use Closure;
use PHPUnit\Framework\TestCase;

abstract class ApiTestCase extends TestCase
{
    protected FrozenClock $clock;
    protected string $logDir;
    protected App $app;
    protected ApiClient $api;

    protected function setUp(): void
    {
        parent::setUp();
        TestDb::resetEphemeral();
        $this->clock = new FrozenClock('2026-10-08T09:12:31Z');
        $this->logDir = sys_get_temp_dir() . '/am-test-logs-' . bin2hex(random_bytes(4));
        mkdir($this->logDir, 0700, true);
        $this->app = $this->makeApp();
        $this->api = new ApiClient($this->app);
    }

    protected function tearDown(): void
    {
        exec('rm -rf ' . escapeshellarg($this->logDir)); // logs, plus any storage/ a test made
        parent::tearDown();
    }

    /** @param array<string,string> $env overrides */
    protected function makeApp(array $env = [], ?Closure $dbFactory = null): App
    {
        $e = TestDb::env($env + ['LOG_DIR' => $this->logDir, 'STORAGE_ROOT' => $this->logDir . '/storage']);
        return new App($e, $this->clock, new Logger($this->logDir, $this->clock), $dbFactory);
    }

    /** An App whose database is "down". */
    protected function appWithDeadDb(): App
    {
        return $this->makeApp([], static function (Env $env): Db {
            return Db::connect($env->with('DB_PORT', '1')->with('DB_HOST', '127.0.0.1'));
        });
    }

    protected function db(): Db
    {
        return $this->app->db();
    }

    /** Fixture people (db/test/fixtures.sql). Password for all: test-1234. */
    public const PEOPLE = [
        'ayush' => ['+919829000101', '01JA6ZA0000000000000000001', 1], // owner
        'mahi'  => ['+919829000102', '01JA6ZA0000000000000000002', 2], // partner
        'papa'  => ['+919829000103', '01JA6ZA0000000000000000003', 3], // family + money
        'mummy' => ['+919829000104', '01JA6ZA0000000000000000004', 4], // family, no money
        'nani'  => ['+919829000105', '01JA6ZA0000000000000000005', 5], // viewer
    ];

    /** A new "phone", logged in as that person. */
    protected function loginAs(string $who, string $ip = '203.0.113.7'): ApiClient
    {
        $c = new ApiClient($this->app, $ip);
        $c->login(self::PEOPLE[$who][0])->assertStatus(200);
        return $c;
    }

    protected function pid(string $who): string
    {
        return self::PEOPLE[$who][1];
    }

    protected function row(string $sql, array $params = []): ?array
    {
        return $this->db()->one($sql, $params);
    }

    protected function rows(string $table, string $where = '1', array $params = []): int
    {
        return (int) $this->db()->value("SELECT COUNT(*) FROM `$table` WHERE $where", $params);
    }

    protected function memberVersion(string $who): int
    {
        return (int) $this->db()->value('SELECT version FROM users WHERE public_id = ?', [$this->pid($who)]);
    }

    protected function logFile(string $name): string
    {
        $f = $this->logDir . '/' . $name;
        return is_file($f) ? (string) file_get_contents($f) : '';
    }
}
