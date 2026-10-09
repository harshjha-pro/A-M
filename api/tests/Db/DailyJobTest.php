<?php
declare(strict_types=1);

namespace Tests\Db;

use AM\Mail\Mailer;
use AM\Safety\DailyJob;
use Tests\Support\ApiTestCase;

/** scripts/cron/daily.php logic (IMPLEMENTATION Session 4, TESTING §9.3, DS-19). */
final class DailyJobTest extends ApiTestCase
{
    private function job(array $env = [], ?Mailer $mailer = null): DailyJob
    {
        $app = $this->makeApp($env + ['STORAGE_ROOT' => $this->logDir . '/storage', 'ALERT_TO' => 'ayush@example.com,mahi@example.com']);
        return new DailyJob($app->env, $app->db(), $this->clock, $mailer);
    }

    public function test_deletes_only_expired_ephemeral_rows(): void
    {
        $db = $this->db();
        $db->run("INSERT INTO sessions (token_hash, csrf_hash, user_id, expires_at, revoked_at, created_at, last_used_at) VALUES
            (?, ?, 1, '2026-09-01 00:00:00', NULL, '2026-06-01', '2026-06-01'),
            (?, ?, 1, '2027-01-01 00:00:00', '2026-08-01 00:00:00', '2026-06-01', '2026-06-01'),
            (?, ?, 1, '2027-01-01 00:00:00', '2026-10-01 00:00:00', '2026-06-01', '2026-06-01'),
            (?, ?, 1, '2027-01-01 00:00:00', NULL, '2026-06-01', '2026-06-01')",
            [str_repeat('1', 64), str_repeat('1', 64), str_repeat('2', 64), str_repeat('2', 64), str_repeat('3', 64), str_repeat('3', 64), str_repeat('4', 64), str_repeat('4', 64)]);
        $db->run("INSERT INTO login_attempts (phone, ip, succeeded, attempted_at) VALUES ('+919829000101', '1.1.1.1', 0, '2026-08-01'), ('+919829000101', '1.1.1.1', 0, '2026-10-07')");
        $db->run("INSERT INTO rate_limits (bucket, window_start, hits) VALUES ('a', '2026-10-06 00:00:00', 1), ('b', '2026-10-08 09:00:00', 1)");
        $db->run("INSERT INTO idempotency_keys (idem_key, user_id, method, path, request_hash, status, expires_at) VALUES
            ('11111111-1111-4111-8111-111111111111', 1, 'POST', '/x', ?, 'done', '2026-10-08 09:00:00'),
            ('22222222-2222-4222-8222-222222222222', 1, 'POST', '/x', ?, 'done', '2026-10-09 09:00:00')", [str_repeat('a', 64), str_repeat('b', 64)]);
        $before = [];
        foreach (['users', 'audit_log', 'settings', 'change_batches', 'password_resets'] as $t) {
            $before[$t] = $this->rows($t);
        }

        $n = $this->job()->purgeTables();
        $this->assertSame(['sessions' => 2, 'login_attempts' => 1, 'idempotency_keys' => 1, 'rate_limits' => 1], $n);
        $this->assertSame(2, $this->rows('sessions'));
        $this->assertSame(1, $this->rows('login_attempts'));
        $this->assertSame(1, $this->rows('rate_limits', "bucket = 'b'"));
        $this->assertSame(1, $this->rows('idempotency_keys', "idem_key LIKE '2222%'"));
        foreach ($before as $t => $c) {
            $this->assertSame($c, $this->rows($t), "$t untouched");
        }
    }

    public function test_export_files_older_than_24_hours_go_and_rows_stay(): void
    {
        $dir = $this->logDir . '/storage/exports';
        mkdir($dir, 0700, true);
        touch("$dir/old.zip", $this->clock->now()->getTimestamp() - 25 * 3600);
        touch("$dir/new.zip", $this->clock->now()->getTimestamp() - 3600);
        $this->db()->run("INSERT INTO exports (public_id, status, requested_by, file_name, finished_at, expires_at) VALUES
            ('01JA7Q3M2K8V5R1T9W4X6Y0E01', 'ready', 1, 'old.zip', '2026-10-07 08:00:00', '2026-10-08 08:00:00'),
            ('01JA7Q3M2K8V5R1T9W4X6Y0E02', 'ready', 1, 'new.zip', '2026-10-08 08:00:00', '2026-10-09 08:00:00')");
        $this->assertSame(1, $this->job()->expireExports());
        $this->assertFileDoesNotExist("$dir/old.zip");
        $this->assertFileExists("$dir/new.zip");
        $this->assertSame(['expired', 'ready'], array_column($this->db()->all('SELECT status FROM exports ORDER BY id'), 'status'));
    }

    public function test_logs_rotate_weekly_and_keep_8_weeks(): void
    {
        $d = $this->logDir;
        file_put_contents("$d/php-error.log", "x\n");
        file_put_contents("$d/client-error.log", "y\n");
        file_put_contents("$d/.rotated-week", '2026-W40');
        foreach (['2026-W31', '2026-W32', '2026-W33', '2026-W39'] as $w) {
            file_put_contents("$d/php-error-$w.log", 'old');
        }
        $job = $this->job();
        $job->rotateLogs(); // 8 Oct 2026 is week 41
        $this->assertFileExists("$d/php-error-2026-W40.log");
        $this->assertFileExists("$d/client-error-2026-W40.log");
        $this->assertFileDoesNotExist("$d/php-error.log");
        $this->assertSame('2026-W41', file_get_contents("$d/.rotated-week"));
        $this->assertFileDoesNotExist("$d/php-error-2026-W31.log", 'older than 8 weeks');
        $this->assertFileDoesNotExist("$d/php-error-2026-W32.log");
        $this->assertFileExists("$d/php-error-2026-W33.log", 'exactly 8 weeks back is kept');
        $this->assertFileExists("$d/php-error-2026-W39.log");

        file_put_contents("$d/php-error.log", "z\n");
        $job->rotateLogs(); // same week again: nothing moves
        $this->assertFileExists("$d/php-error.log");
    }

    public function test_error_digest_only_when_there_were_errors(): void
    {
        $sent = [];
        $mailer = new Mailer(['enabled' => true, 'cap' => 30, 'state_dir' => '', 'from' => 'planner@lumorrahouse.com', 'from_name' => 'A&M Wedding']);
        $mailer->mailFn = static function (string $to, string $s, string $b) use (&$sent): bool {
            $sent[] = [$to, $s, $b];
            return true;
        };
        $job = $this->job([], $mailer);
        $this->assertSame(0, $job->digest()['count']);
        $this->assertSame([], $sent);

        $log = fn (string $f, string $at, string $msg) => file_put_contents("{$this->logDir}/$f", json_encode(['at' => $at, 'message' => $msg]) . "\n", FILE_APPEND);
        $log('php-error.log', '2026-10-07T05:00:00Z', 'too old');
        foreach (range(1, 3) as $_) {
            $log('php-error.log', '2026-10-08T01:00:00Z', 'PDOException: deadlock');
        }
        $log('client-error.log', '2026-10-08T02:00:00Z', 'TypeError in TaskList');
        $r = $job->digest();
        $this->assertSame(4, $r['count']);
        $this->assertSame(['Server: PDOException: deadlock' => 3, 'Phone: TypeError in TaskList' => 1], $r['top']);
        $this->assertCount(1, $sent);
        $this->assertSame('ayush@example.com, mahi@example.com', $sent[0][0]);
        $this->assertStringContainsString('3× Server: PDOException: deadlock', $sent[0][2]);
        $this->assertStringNotContainsString('too old', $sent[0][2]);
    }

    public function test_run_does_every_step_and_daily_php_runs_from_the_command_line(): void
    {
        $job = $this->job();
        $this->assertSame(0, $job->run());
        $this->assertSame('Daily clean-up done.', end($job->lines));

        $env = $this->logDir . '/test.env';
        file_put_contents($env, implode("\n", [
            'DB_HOST=' . getenv('AM_TEST_DB_HOST'), 'DB_PORT=' . getenv('AM_TEST_DB_PORT'), 'DB_NAME=' . getenv('AM_TEST_DB_NAME'),
            'DB_USER=' . getenv('AM_TEST_DB_USER'), 'DB_PASS=' . getenv('AM_TEST_DB_PASS'), 'LOG_DIR=' . $this->logDir,
            'STORAGE_ROOT=' . $this->logDir . '/storage', 'ALERTS_ENABLED=false',
        ]));
        exec(sprintf('AM_ENV_FILE=%s AM_APP_DIR=%s %s %s 2>&1', escapeshellarg($env), escapeshellarg(dirname(__DIR__, 2)),
            escapeshellarg(PHP_BINARY), escapeshellarg(dirname(__DIR__, 3) . '/scripts/cron/daily.php')), $out, $code);
        $this->assertSame(0, $code, implode("\n", $out));
        $this->assertStringContainsString('Daily clean-up done.', implode("\n", $out));
    }
}
