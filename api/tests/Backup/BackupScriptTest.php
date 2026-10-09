<?php
declare(strict_types=1);

namespace Tests\Backup;

use PDO;
use PHPUnit\Framework\TestCase;
use Tests\Support\BackgroundServer;
use Tests\Support\TestDb;

/**
 * scripts/backup/backup.php against real MySQL, a fake Backblaze B2 and a fake
 * SMTP server (IMPLEMENTATION Session 4 "Backup" row, DATA-SAFETY §3).
 * The script runs as its own process, exactly like the cron job.
 */
final class BackupScriptTest extends TestCase
{
    private const DB = 'am_test_bk';
    private const RESTORE_DB = 'am_test_bk_restore';
    private const HINDI = 'राम शर्मा 🙂';

    private static string $dir;
    private static BackgroundServer $b2;
    private static BackgroundServer $smtp;

    public static function setUpBeforeClass(): void
    {
        self::$dir = sys_get_temp_dir() . '/am-backup-test-' . bin2hex(random_bytes(4));
        mkdir(self::$dir . '/storage/uploads/2026/10', 0700, true);
        mkdir(self::$dir . '/mail', 0700, true);
        $root = TestDb::root();
        self::$b2 = new BackgroundServer(
            static fn (int $p) => [PHP_BINARY, '-S', "127.0.0.1:$p", "$root/tools/fake-b2.php"],
            ['FAKE_B2_DIR' => self::$dir . '/b2', 'FAKE_B2_KEY' => 'kid:appkey'],
        );
        self::$smtp = new BackgroundServer(static fn (int $p) => [PHP_BINARY, "$root/tools/fake-smtp.php", (string) $p, self::$dir . '/mail', 'planner@lumorrahouse.com', 'smtp-pass']);
    }

    public static function tearDownAfterClass(): void
    {
        self::$b2->stop();
        self::$smtp->stop();
        exec('rm -rf ' . escapeshellarg(self::$dir));
        $pdo = TestDb::server();
        $pdo->exec('DROP DATABASE IF EXISTS `' . self::DB . '`');
        $pdo->exec('DROP DATABASE IF EXISTS `' . self::RESTORE_DB . '`');
    }

    protected function setUp(): void
    {
        TestDb::rebuild(self::DB);
        $pdo = $this->db();
        $pdo->exec("UPDATE users SET name = '" . self::HINDI . "' WHERE id = 5");
        // One uploaded photo, on disk and in `files`.
        file_put_contents(self::$dir . '/storage/uploads/2026/10/a1.jpg', random_bytes(3000));
        $pdo->exec("INSERT INTO files (public_id, storage_path, original_name, mime_type, size_bytes, sha256, created_by)
                    VALUES ('01JA7Q3M2K8V5R1T9W4X6Y0F01', 'uploads/2026/10/a1.jpg', 'receipt.jpg', 'image/jpeg', 3000, '" . str_repeat('a', 64) . "', 1)");
        exec('rm -rf ' . escapeshellarg(self::$dir . '/b2') . ' ' . escapeshellarg(self::$dir . '/work') . ' ' . escapeshellarg(self::$dir . '/mail') . '/*');
        @mkdir(self::$dir . '/b2/files', 0700, true);
        file_put_contents(self::$dir . '/backup.key', rtrim(strtr(base64_encode(random_bytes(48)), '+/', '-_'), '=') . "\n");
        chmod(self::$dir . '/backup.key', 0600);
        $this->writeConfig();
    }

    private function db(string $name = self::DB): PDO
    {
        return TestDb::connect($name);
    }

    private function writeConfig(array $over = []): string
    {
        $cfg = $over + [
            'db_host' => getenv('AM_TEST_DB_HOST'), 'db_port' => (int) getenv('AM_TEST_DB_PORT'),
            'db_name' => self::DB, 'db_user' => getenv('AM_TEST_DB_USER'), 'db_pass' => getenv('AM_TEST_DB_PASS'),
            'storage_root' => self::$dir . '/storage',
            'b2_api_base' => 'http://127.0.0.1:' . self::$b2->port,
            'b2_key_id' => 'kid', 'b2_app_key' => 'appkey', 'b2_bucket_id' => 'bucket1', 'b2_bucket_name' => 'am-wedding-backups-test',
            'alert_to' => ['ayush@example.com', 'mahi@example.com'], 'alert_from' => 'planner@lumorrahouse.com',
            'smtp_host' => '127.0.0.1', 'smtp_port' => self::$smtp->port, 'smtp_secure' => 'none',
            'smtp_user' => 'planner@lumorrahouse.com', 'smtp_pass' => 'smtp-pass',
            'health_url' => 'https://wedding.lumorrahouse.com/api/v1/health',
            'work_dir' => self::$dir . '/work', 'key_file' => self::$dir . '/backup.key',
            'app_autoload' => TestDb::root() . '/api/autoload.php',
        ];
        $file = self::$dir . '/config.php';
        file_put_contents($file, '<?php return ' . var_export(array_filter($cfg, static fn ($v) => $v !== null), true) . ';');
        return $file;
    }

    /** @return array{0:int, 1:string} exit code, output */
    private function script(string ...$args): array
    {
        $cmd = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(TestDb::root() . '/scripts/backup/backup.php')
            . ' --config=' . escapeshellarg(self::$dir . '/config.php');
        foreach ($args as $a) {
            $cmd .= ' ' . escapeshellarg($a);
        }
        exec($cmd . ' 2>&1', $out, $code);
        return [$code, implode("\n", $out)];
    }

    /** @return list<string> raw emails received */
    private function mails(): array
    {
        $files = glob(self::$dir . '/mail/*.eml') ?: [];
        sort($files);
        return array_map(static fn ($f) => (string) file_get_contents($f), $files);
    }

    private static function subject(string $eml): string
    {
        preg_match('/^Subject: (.*)$/m', $eml, $m);
        $s = trim($m[1] ?? '');
        return preg_match('/^=\?UTF-8\?B\?(.*)\?=$/', $s, $b) ? base64_decode($b[1]) : $s;
    }

    private function b2Files(string $prefix): array
    {
        $out = [];
        $base = self::$dir . '/b2/files/';
        if (!is_dir($base . $prefix)) {
            return [];
        }
        $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($base . $prefix, \FilesystemIterator::SKIP_DOTS));
        foreach ($it as $f) {
            $out[] = substr($f->getPathname(), strlen($base));
        }
        sort($out);
        return $out;
    }

    private function lastRun(): array
    {
        return $this->db()->query('SELECT * FROM backup_runs ORDER BY id DESC LIMIT 1')->fetch();
    }

    public function test_nightly_backup_end_to_end_then_restore_with_hindi_intact(): void
    {
        [$code, $out] = $this->script();
        $this->assertSame(0, $code, $out);
        $this->assertMatchesRegularExpression('/Run #\d+ \(nightly_db\) started\./', $out);
        $this->assertStringContainsString('Uploaded dump and manifest to B2.', $out);
        $this->assertStringContainsString('Files: 1 on disk, 1 new uploaded', $out);
        $this->assertMatchesRegularExpression('/Done in \d+ s\.$/', $out);

        $run = $this->lastRun();
        $this->assertSame('ok', $run['status']);
        $this->assertSame('b2:am-wedding-backups-test', $run['destination']);
        $this->assertNull($run['error']);
        $counts = json_decode($run['row_counts_json'], true);
        $this->assertSame(5, $counts['users']);
        $this->assertSame(1, $counts['_files']['new']);
        $audit = $this->db()->query('SELECT COUNT(*) n, MAX(id) m FROM audit_log WHERE action <> \'backup\'')->fetch();
        $this->assertSame((int) $audit['n'], (int) $run['audit_row_count']);
        $this->assertSame((int) $audit['m'], (int) $run['audit_max_id']);
        $this->assertSame(1, (int) $this->db()->query("SELECT COUNT(*) FROM audit_log WHERE action = 'backup'")->fetchColumn());

        $db = $this->b2Files('db');
        $this->assertCount(2, $db);
        $this->assertMatchesRegularExpression('#^db/wedding_\d{8}_\d{4}\.manifest\.json$#', $db[0]);
        $this->assertMatchesRegularExpression('#^db/wedding_\d{8}_\d{4}\.sql\.gz\.enc$#', $db[1]);
        $this->assertSame(['files/uploads/2026/10/a1.jpg.enc'], $this->b2Files('files'));
        $manifest = json_decode((string) file_get_contents(self::$dir . '/b2/files/' . $db[0]), true);
        $this->assertSame($run['sha256'], $manifest['sha256']);
        $this->assertStringNotContainsString(self::HINDI, (string) file_get_contents(self::$dir . '/b2/files/' . $db[0]), 'manifest holds counts only');
        $enc = self::$dir . '/b2/files/' . $db[1];
        $this->assertStringNotContainsString('INSERT INTO', (string) file_get_contents($enc), 'the dump leaves encrypted');

        // Second run: the photo is already off-site.
        sleep(1);
        [$code2, $out2] = $this->script('--kind=manual_db');
        $this->assertSame(0, $code2, $out2);
        $this->assertStringContainsString('Files: 1 on disk, 0 new uploaded', $out2);
        $this->assertMatchesRegularExpression('#^db/wedding_\d{8}_\d{4}_manual\.sql\.gz\.enc$#', $this->b2Files('db')[3] ?? $this->b2Files('db')[2]);

        // The laptop path: plain openssl with the key from the password manager.
        $sql = self::$dir . '/restore.sql';
        exec(sprintf('openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -md sha256 -pass file:%s -in %s | gzip -dc > %s',
            escapeshellarg(self::$dir . '/backup.key'), escapeshellarg($enc), escapeshellarg($sql)), $o, $c);
        $this->assertSame(0, $c);
        $lines = file($sql, FILE_IGNORE_NEW_LINES);
        $this->assertStringStartsWith('-- Dump completed', (string) end($lines));
        $this->assertStringNotContainsString('CREATE DATABASE', (string) file_get_contents($sql), 'loads into any database name');

        // --decrypt (the drill helper) says the dump is complete.
        $copy = self::$dir . '/drill.sql.gz.enc';
        copy($enc, $copy);
        [, $dec] = $this->script('--decrypt', $copy);
        $this->assertStringContainsString('Check: complete dump ✓', $dec);

        // Restore into a second database: Hindi and emoji intact, same counts.
        $srv = TestDb::server();
        $srv->exec('DROP DATABASE IF EXISTS `' . self::RESTORE_DB . '`');
        $srv->exec('CREATE DATABASE `' . self::RESTORE_DB . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
        exec(sprintf('mysql --default-character-set=utf8mb4 -h%s -P%s -u%s -p%s %s < %s 2>&1', escapeshellarg((string) getenv('AM_TEST_DB_HOST')),
            escapeshellarg((string) getenv('AM_TEST_DB_PORT')), escapeshellarg((string) getenv('AM_TEST_DB_USER')),
            escapeshellarg((string) getenv('AM_TEST_DB_PASS')), self::RESTORE_DB, escapeshellarg($sql)), $o2, $c2);
        $this->assertSame(0, $c2, implode("\n", $o2));
        $restored = $this->db(self::RESTORE_DB);
        $this->assertSame(self::HINDI, $restored->query('SELECT name FROM users WHERE id = 5')->fetchColumn());
        foreach ($counts as $table => $n) {
            if ($table[0] !== '_' && $table !== 'backup_runs' && $table !== 'audit_log') {
                $this->assertSame($n, (int) $restored->query("SELECT COUNT(*) FROM `$table`")->fetchColumn(), $table);
            }
        }

        // The uploaded photo decrypts byte-identical.
        $photo = self::$dir . '/photo.jpg';
        exec(sprintf('openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -md sha256 -pass file:%s -in %s -out %s',
            escapeshellarg(self::$dir . '/backup.key'), escapeshellarg(self::$dir . '/b2/files/files/uploads/2026/10/a1.jpg.enc'), escapeshellarg($photo)));
        $this->assertSame(hash_file('sha256', self::$dir . '/storage/uploads/2026/10/a1.jpg'), hash_file('sha256', $photo));
        $this->assertSame([], $this->mails(), 'a clean run sends no email');
    }

    public function test_retention_hides_old_dailies_but_keeps_the_first_of_each_month(): void
    {
        @mkdir(self::$dir . '/b2/files/db', 0700, true);
        $year = (int) date('Y') - 1; // well over 84 days ago
        foreach (range(2, 11) as $d) {
            file_put_contents(sprintf('%s/b2/files/db/wedding_%d03%02d_0217.sql.gz.enc', self::$dir, $year, $d), 'x');
        }
        [$code, $out] = $this->script();
        $this->assertSame(0, $code, $out);
        // Newest 7 kept (tonight + 11…6 March); 2 March kept as the month's first.
        $this->assertStringContainsString("Retention: hid 3 old backup(s): wedding_{$year}0305_0217.sql.gz.enc, wedding_{$year}0304_0217.sql.gz.enc, wedding_{$year}0303_0217.sql.gz.enc", $out);
        $hidden = json_decode((string) file_get_contents(self::$dir . '/b2/hidden.json'), true);
        $this->assertArrayHasKey("db/wedding_{$year}0303_0217.sql.gz.enc", $hidden);
        $this->assertArrayNotHasKey("db/wedding_{$year}0302_0217.sql.gz.enc", $hidden);
        $this->assertFileExists(self::$dir . "/b2/files/db/wedding_{$year}0303_0217.sql.gz.enc", 'hidden, never deleted by us');
    }

    public function test_watchdog_emails_at_37_hours_once_per_12_hours(): void
    {
        $pdo = $this->db();
        $pdo->exec("INSERT INTO backup_runs (kind, status, started_at, finished_at) VALUES
            ('nightly_db', 'ok', UTC_TIMESTAMP() - INTERVAL 37 HOUR, UTC_TIMESTAMP() - INTERVAL 37 HOUR)");
        [$code, $out] = $this->script('--check');
        $this->assertSame(1, $code, $out);
        $this->assertStringContainsString('Watchdog: PROBLEM. The last good backup is 37 hours old.', $out);
        $mails = $this->mails();
        $this->assertCount(1, $mails);
        $this->assertSame('[A&M Wedding] Backup is OVERDUE', self::subject($mails[0]));
        $this->assertStringContainsString('RCPT TO:<ayush@example.com> RCPT TO:<mahi@example.com>', $mails[0]);

        [$code2, $out2] = $this->script('--check');
        $this->assertSame(1, $code2);
        $this->assertStringContainsString('alert already sent recently', $out2);
        $this->assertCount(1, $this->mails(), 'no second email within 12 h');

        $pdo->exec("INSERT INTO backup_runs (kind, status, started_at, finished_at) VALUES
            ('nightly_db', 'ok', UTC_TIMESTAMP() - INTERVAL 1 HOUR, UTC_TIMESTAMP() - INTERVAL 1 HOUR)");
        [$code3, $out3] = $this->script('--check');
        $this->assertSame(0, $code3, $out3);
        $this->assertStringContainsString('Watchdog: OK', $out3);
    }

    public function test_watchdog_with_no_backup_at_all(): void
    {
        [$code, $out] = $this->script('--check');
        $this->assertSame(1, $code);
        $this->assertStringContainsString('There is no successful backup at all.', $out);
    }

    public function test_failure_wrong_b2_key_writes_failed_and_emails(): void
    {
        $this->writeConfig(['b2_app_key' => 'wrong']);
        [$code, $out] = $this->script();
        $this->assertSame(1, $code);
        $run = $this->lastRun();
        $this->assertSame('failed', $run['status']);
        $this->assertStringContainsString('B2 HTTP 401', $run['error']);
        $this->assertStringContainsString('Alert email sent: BACKUP FAILED', $out);
        $this->assertSame('[A&M Wedding] BACKUP FAILED', self::subject($this->mails()[0]));
        $this->assertCount(1, glob(self::$dir . '/work/local/*.sql.gz.enc'), 'the verified dump is kept on the server');
    }

    public function test_failure_missing_key_file(): void
    {
        unlink(self::$dir . '/backup.key');
        [$code, $out] = $this->script();
        $this->assertSame(1, $code);
        $this->assertStringContainsString('backup.key is missing', $this->lastRun()['error']);
        $this->assertStringContainsString('Alert email sent: BACKUP FAILED', $out);
    }

    public function test_failure_dump_error_leaves_no_half_file(): void
    {
        $fake = self::$dir . '/broken-mysqldump';
        file_put_contents($fake, "#!/bin/sh\nif [ \"\$1\" = \"--version\" ]; then echo 'mysqldump  Ver 8.0.46'; exit 0; fi\necho 'mysqldump: Got error: 1045: Access denied' >&2\nexit 2\n");
        chmod($fake, 0700);
        $this->writeConfig(['mysqldump' => $fake]);
        [$code, $out] = $this->script();
        $this->assertSame(1, $code, $out);
        $run = $this->lastRun();
        $this->assertSame('failed', $run['status']);
        $this->assertStringContainsString('Access denied', $run['error']);
        $this->assertSame([], glob(self::$dir . '/work/local/*.sql.gz.enc'));
        $this->assertSame([], $this->b2Files('db'));
        $this->assertCount(1, $this->mails());
    }

    public function test_missing_upload_file_is_a_warning_not_a_failure(): void
    {
        $this->db()->exec("INSERT INTO files (public_id, storage_path, original_name, mime_type, size_bytes, sha256, created_by)
                           VALUES ('01JA7Q3M2K8V5R1T9W4X6Y0F02', 'uploads/2026/10/gone.pdf', 'id.pdf', 'application/pdf', 10, '" . str_repeat('b', 64) . "', 1)");
        [$code, $out] = $this->script();
        $this->assertSame(0, $code, $out);
        $run = $this->lastRun();
        $this->assertSame('ok', $run['status']);
        $this->assertStringContainsString('1 file(s) listed in the database are missing on disk, e.g. uploads/2026/10/gone.pdf', $run['error']);
        $this->assertSame('[A&M Wedding] Backup finished with warnings', self::subject($this->mails()[0]));
    }

    public function test_test_email_over_smtp_and_a_wrong_password(): void
    {
        [$code, $out] = $this->script('--test-email');
        $this->assertSame(0, $code, $out);
        $this->assertStringContainsString('Alert email sent: Test email', $out);
        $mail = $this->mails()[0];
        $this->assertStringContainsString('From: A&M Wedding <planner@lumorrahouse.com>', $mail);
        $this->assertStringContainsString('If you can read this, failure alerts will reach you.', base64_decode(substr($mail, strpos($mail, "\r\n\r\n") + 4)));

        $this->writeConfig(['smtp_pass' => 'wrong']);
        [$code2, $out2] = $this->script('--test-email');
        $this->assertSame(1, $code2);
        $this->assertStringContainsString('Alert email FAILED: Test email (SMTP: SMTP AUTH refused: 535', $out2);
    }

    public function test_make_key_once_and_never_again(): void
    {
        unlink(self::$dir . '/backup.key');
        [$code, $out] = $this->script('--make-key');
        $this->assertSame(0, $code);
        $this->assertStringContainsString('Created backup.key. Save this line in the password manager NOW', $out);
        $this->assertSame('600', substr(sprintf('%o', fileperms(self::$dir . '/backup.key')), -3));
        $key = trim((string) file_get_contents(self::$dir . '/backup.key'));
        $this->assertMatchesRegularExpression('/^[A-Za-z0-9_-]{64}$/', $key);
        [$code2, $out2] = $this->script('--make-key');
        $this->assertSame(1, $code2);
        $this->assertStringContainsString('backup.key already exists', $out2);
        $this->assertSame($key, trim((string) file_get_contents(self::$dir . '/backup.key')));
    }

    public function test_only_runs_from_the_command_line(): void
    {
        $this->assertStringContainsString("if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }", (string) file_get_contents(TestDb::root() . '/scripts/backup/backup.php'));
    }
}
