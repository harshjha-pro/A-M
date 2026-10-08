<?php
declare(strict_types=1);

namespace Tests\Endpoints;

use AM\Kernel\Request;
use Tests\Support\ApiClient;
use Tests\Support\ApiTestCase;
use Tests\Support\Endpoint;
use Tests\Support\TestDb;

/** GET /health — TESTING §1.3 row and IMPLEMENTATION Session 1. */
final class HealthTest extends ApiTestCase
{
    #[Endpoint('GET /health')]
    public function test_anonymous_gets_only_status_ok(): void
    {
        $res = $this->api->get('/health');
        $res->assertStatus(200);
        $this->assertSame(['status' => 'ok'], $res->json(), 'Anonymous sees only {"status":"ok"}');
        $this->assertSame('{"status":"ok"}', $res->body());
        $this->assertMatchesRegularExpression('/^r_[0-9a-f]{10}$/', (string) $res->header('X-Request-Id'));
        $this->assertSame('no-store', $res->header('Cache-Control'));
    }

    #[Endpoint('GET /health')]
    public function test_database_down_gives_503_fail_and_nothing_else(): void
    {
        $api = new ApiClient($this->appWithDeadDb());
        $res = $api->get('/health');
        $res->assertStatus(503);
        $this->assertSame('{"status":"fail"}', $res->body());
        $this->assertStringNotContainsString('SQLSTATE', $res->body());
        $this->assertStringContainsString('database', $this->logFile('php-error.log'), 'The reason is logged on the server');
    }

    #[Endpoint('GET /health')]
    public function test_unfinished_migration_gives_fail(): void
    {
        $pdo = TestDb::connect();
        $pdo->exec("INSERT INTO schema_migrations (version, name, applied_by) VALUES (99, '099_half', 'test')");
        try {
            $this->api->get('/health')->assertStatus(503);
        } finally {
            $pdo->exec('DELETE FROM schema_migrations WHERE version = 99');
        }
    }

    #[Endpoint('GET /health')]
    public function test_backup_not_checked_until_backups_are_expected(): void
    {
        // No backup rows and BACKUP_EXPECTED=false (staging, Session 1–3): ok.
        $this->api->get('/health')->assertStatus(200);
        // Live from Session 4: no good backup in 26 h → fail.
        $live = new ApiClient($this->makeApp(['BACKUP_EXPECTED' => 'true']));
        $this->assertSame('{"status":"fail"}', $live->get('/health')->assertStatus(503)->body());
    }

    #[Endpoint('GET /health')]
    public function test_backup_age_rule_when_expected(): void
    {
        $pdo = TestDb::connect();
        $pdo->exec("INSERT INTO backup_runs (kind, status, started_at, finished_at, file_name) VALUES ('nightly_db', 'ok', '2026-10-07 20:47:00', '2026-10-07 20:47:30', 'wedding_20261008_0217.sql.gz.enc')");
        try {
            $live = new ApiClient($this->makeApp(['BACKUP_EXPECTED' => 'true']));
            $live->get('/health')->assertStatus(200);                // 12.4 h old → ok
            $this->clock->advance('+14 hours');                       // 26.4 h old
            $live->get('/health')->assertStatus(503);
        } finally {
            $pdo->exec('DELETE FROM backup_runs');
        }
    }

    #[Endpoint('GET /health')]
    public function test_audit_count_drop_gives_fail(): void
    {
        $pdo = TestDb::connect();
        $pdo->exec("INSERT INTO backup_runs (kind, status, started_at, finished_at, audit_row_count, audit_max_id) VALUES
            ('nightly_db', 'ok', '2026-10-06 20:47:00', '2026-10-06 20:47:30', 500, 500),
            ('nightly_db', 'ok', '2026-10-07 20:47:00', '2026-10-07 20:47:30', 480, 500)");
        try {
            $live = new ApiClient($this->makeApp(['BACKUP_EXPECTED' => 'true']));
            $live->get('/health')->assertStatus(503);
        } finally {
            $pdo->exec('DELETE FROM backup_runs');
        }
    }

    #[Endpoint('GET /health')]
    public function test_head_request_works_for_uptime_monitors(): void
    {
        $res = new \Tests\Support\TestResponse($this->app->handle(new Request('HEAD', '/api/v1/health', [], [], '', '203.0.113.9')));
        $res->assertStatus(200);
        $this->assertSame('', $res->body());
    }

    #[Endpoint('GET /health')]
    public function test_unknown_query_parameter_is_400(): void
    {
        $this->api->get('/health', ['verbose' => '1'])->assertStatus(400)->assertEnvelope()->assertErrorCode('bad_request');
    }

    #[Endpoint('GET /health')]
    public function test_anonymous_limit_30_per_minute(): void
    {
        for ($i = 1; $i <= 30; $i++) {
            $this->api->get('/health')->assertStatus(200);
        }
        $res = $this->api->get('/health')->assertStatus(429)->assertErrorCode('rate_limited');
        $this->assertNotNull($res->header('Retry-After'));
        $this->assertGreaterThan(0, $res->json('error.retry_after_seconds'));
        $this->clock->advance('+61 seconds');
        $this->api->get('/health')->assertStatus(200);
    }
}
