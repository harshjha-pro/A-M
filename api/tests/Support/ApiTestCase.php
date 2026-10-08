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
        foreach (glob($this->logDir . '/*') ?: [] as $f) {
            unlink($f);
        }
        @rmdir($this->logDir);
        parent::tearDown();
    }

    /** @param array<string,string> $env overrides */
    protected function makeApp(array $env = [], ?Closure $dbFactory = null): App
    {
        $e = TestDb::env($env + ['LOG_DIR' => $this->logDir]);
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

    protected function logFile(string $name): string
    {
        $f = $this->logDir . '/' . $name;
        return is_file($f) ? (string) file_get_contents($f) : '';
    }
}
