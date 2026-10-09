<?php
/*
 * backup.php — A&M Wedding: nightly off-site backup (DATA-SAFETY.md §3)
 *
 * Lives OUTSIDE public_html, next to config.php and backup.key. CLI only.
 *
 *   php backup.php                     nightly run (cron): DB dump + new uploads → Backblaze B2
 *   php backup.php --kind=manual_db    same, labelled manual (before a deploy)
 *   php backup.php --kind=pre_migration  same, labelled pre-migration
 *   php backup.php --check             watchdog (cron): email if no good backup for 36 h
 *   php backup.php --test-email        send a test alert email
 *   php backup.php --make-key          create backup.key once (prints it: save it in the password manager)
 *   php backup.php --decrypt FILE.enc  decrypt a backup file next to itself (restore drill)
 *   --config=/path/config.php          another config (tests and the restore drill only)
 *
 * What a nightly run does, in order:
 *   1. backup_runs row 'running'
 *   2. row counts of every table + audit_log count / max id (tamper check)
 *   3. mysqldump --single-transaction | gzip | openssl (AES-256, key in backup.key)
 *   4. decrypt the new file again and check it ends with "-- Dump completed"
 *   5. upload dump + manifest to B2  db/…
 *   6. upload any upload-file not yet in B2 (files never change, so this is incremental)
 *   7. retention: 30 daily, 12 weekly, every monthly (hides the rest in B2)
 *   8. backup_runs row 'ok' (health endpoint reads it) — or 'failed' + email
 *
 * Session 4: brought into the repo from DATA-SAFETY.md §3.3. One change: alerts go
 * over SMTP as planner@lumorrahouse.com through the app's Mailer when smtp_host is
 * set in config.php (IMPLEMENTATION I12, DATA-SAFETY S10); PHP mail() stays the fallback.
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

const DUMP_DONE_MARK = '-- Dump completed';
const CIPHER_ARGS    = '-aes-256-cbc -pbkdf2 -iter 200000 -md sha256';

$configFile = __DIR__ . '/config.php';
foreach (array_slice($argv, 1) as $a) {
    if (str_starts_with($a, '--config=')) { $configFile = substr($a, 9); }
}
if (!is_file($configFile)) {
    fwrite(STDERR, "config.php not found next to backup.php (DATA-SAFETY.md §3.4 step 4).\n");
    exit(2);
}
$cfg = require $configFile;
$cfg += [
    'b2_api_base'    => 'https://api.backblazeb2.com',
    'work_dir'       => __DIR__ . '/work',
    'key_file'       => __DIR__ . '/backup.key',
    'keep_local'     => 2,
    'max_age_hours'  => 36,
    'max_upload_mb_per_run' => 2000,
    'mysqldump'      => 'mysqldump',
    'openssl'        => 'openssl',
    'gzip'           => 'gzip',
    'label'          => 'A&M Wedding',
    'app_autoload'   => __DIR__ . '/../app/autoload.php',   // the app's code, for the Mailer
    'mail_daily_cap' => 30,
];
date_default_timezone_set('Asia/Kolkata');   // file names and emails use IST

$args = array_slice($argv, 1);
$mode = 'backup';
$kind = 'nightly_db';
$decryptFile = null;
foreach ($args as $i => $a) {
    if ($a === '--check')       { $mode = 'check'; }
    elseif ($a === '--test-email') { $mode = 'test_email'; }
    elseif ($a === '--make-key')   { $mode = 'make_key'; }
    elseif ($a === '--decrypt')    { $mode = 'decrypt'; $decryptFile = $args[$i + 1] ?? null; }
    elseif (str_starts_with($a, '--kind=')) {
        $kind = substr($a, 7);
        if (!in_array($kind, ['nightly_db', 'manual_db', 'pre_migration'], true)) {
            fwrite(STDERR, "Unknown --kind. Use nightly_db, manual_db or pre_migration.\n"); exit(2);
        }
    }
}

@mkdir($cfg['work_dir'], 0700, true);
@mkdir($cfg['work_dir'] . '/local', 0700, true);
@mkdir($cfg['work_dir'] . '/tmp', 0700, true);

try {
    switch ($mode) {
        case 'make_key':   exit(makeKey($cfg));
        case 'decrypt':    exit(decryptCli($cfg, $decryptFile));
        case 'test_email':
            $ok = alert($cfg, 'Test email', "This is a test from backup.php.\nIf you can read this, failure alerts will reach you.");
            say($ok ? 'Test email handed to the mail server.' : 'The email was refused. Check smtp_pass, alert_from and alert_to in config.php.');
            exit($ok ? 0 : 1);
        case 'check':      exit(watchdog($cfg));
        default:           exit(runBackup($cfg, $kind));
    }
} catch (Throwable $e) {
    say('ERROR: ' . $e->getMessage());
    exit(1);
}

/* ======================================================================== */

function runBackup(array $cfg, string $kind): int
{
    $lock = fopen($cfg['work_dir'] . '/backup.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) {
        say('Another backup is still running. Stopping.');
        return 1;
    }
    $pdo = null; $runId = null; $tmpFiles = []; $encPath = null; $verified = false;
    $started = time();
    try {
        $pdo   = db($cfg);
        $pdo->prepare("INSERT INTO backup_runs (kind, status) VALUES (?, 'running')")->execute([$kind]);
        $runId = (int)$pdo->lastInsertId();
        say("Run #$runId ($kind) started.");
        if (!is_readable($cfg['key_file']) || filesize($cfg['key_file']) < 32) {
            throw new RuntimeException('backup.key is missing or unreadable (see DATA-SAFETY.md §3.4).');
        }

        // 2. Counts (taken just before the dump; 2 AM IST, so nothing should change in between)
        [$counts, $auditCount, $auditMax] = rowCounts($pdo);

        // 3. Dump → gzip → encrypt
        // IST, e.g. wedding_20261009_0217. Manual / pre-migration copies get a suffix: they are
        // never touched by retention, and can't overwrite a nightly file from the same minute.
        $base    = 'wedding_' . date('Ymd_Hi', $started)
                 . ['nightly_db' => '', 'manual_db' => '_manual', 'pre_migration' => '_premigration'][$kind];
        $encName = $base . '.sql.gz.enc';
        $encPath = $cfg['work_dir'] . '/local/' . $encName;
        $tmpFiles[] = $defaults = writeDefaultsFile($cfg);
        $dumpVer = trim(shell("{$cfg['mysqldump']} --version"));
        $isMaria = stripos($dumpVer, 'mariadb') !== false;
        $dumpCmd = sprintf(
            '%s --defaults-extra-file=%s --single-transaction --quick --no-tablespaces --hex-blob'
            . ' --default-character-set=utf8mb4 %s %s',
            $cfg['mysqldump'], escapeshellarg($defaults),
            $isMaria ? '' : '--set-gtid-purged=OFF',              // MySQL only; MariaDB's mysqldump rejects it
            escapeshellarg($cfg['db_name'])
        );
        $errFile = $cfg['work_dir'] . '/tmp/dump.err';
        $tmpFiles[] = $errFile;
        shell(sprintf(
            'set -o pipefail; %s 2>%s | %s -c -6 | %s enc %s -salt -pass file:%s -out %s',
            $dumpCmd, escapeshellarg($errFile), $cfg['gzip'], $cfg['openssl'], CIPHER_ARGS,
            escapeshellarg($cfg['key_file']), escapeshellarg($encPath)
        ), 'mysqldump/gzip/openssl', $errFile);
        @unlink($defaults);

        // 4. Verify: decrypt, unzip, last line must say the dump completed
        $tail = shell(sprintf(
            'set -o pipefail; %s enc -d %s -pass file:%s -in %s | %s -dc | tail -n 1',
            $cfg['openssl'], CIPHER_ARGS, escapeshellarg($cfg['key_file']), escapeshellarg($encPath), $cfg['gzip']
        ), 'verify');
        if (!str_starts_with(trim($tail), DUMP_DONE_MARK)) {
            throw new RuntimeException('Verify failed: the dump does not end with "' . DUMP_DONE_MARK . '"');
        }
        $verified = true;   // a good dump: kept locally even if the upload below fails
        $size = filesize($encPath);
        $sha  = hash_file('sha256', $encPath);
        say("Dump OK: $encName, " . round($size / 1048576, 2) . ' MB');

        // Manifest: plain JSON (no personal data, only counts), used by the restore drill
        $manifest = [
            'file' => $encName, 'sha256' => $sha, 'size_bytes' => $size,
            'created_at_utc' => gmdate('Y-m-d\TH:i:s\Z', $started), 'kind' => $kind,
            'database' => $cfg['db_name'], 'mysqldump' => $dumpVer,
            'cipher' => 'openssl enc -d ' . CIPHER_ARGS,
            'row_counts' => $counts, 'audit_row_count' => $auditCount, 'audit_max_id' => $auditMax,
        ];
        $manPath = $cfg['work_dir'] . '/local/' . $base . '.manifest.json';
        file_put_contents($manPath, json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");

        // 5. Off-site
        $b2 = new B2($cfg);
        $b2->upload($encPath, 'db/' . $encName);
        $b2->upload($manPath, 'db/' . $base . '.manifest.json', 'application/json');
        say('Uploaded dump and manifest to B2.');

        // 6. Upload files (incremental)
        $filesInfo = syncUploads($cfg, $b2, $pdo);
        $warnings  = $filesInfo['warnings'];

        // 7. Retention (never fails the run; problems become warnings)
        try {
            $hidden = applyRetention($b2, time());
            if ($hidden) say('Retention: hid ' . count($hidden) . ' old backup(s): ' . implode(', ', $hidden));
        } catch (Throwable $e) {
            $warnings[] = 'Retention step failed: ' . $e->getMessage();
        }

        // Keep only the newest N local copies
        pruneLocal($cfg);

        // 8. Done
        $counts['_files'] = $filesInfo['summary'];
        $stmt = $pdo->prepare("UPDATE backup_runs SET status = 'ok', finished_at = UTC_TIMESTAMP(),
              file_name = ?, size_bytes = ?, sha256 = ?, destination = ?, row_counts_json = ?,
              audit_row_count = ?, audit_max_id = ?, error = ? WHERE id = ?");
        $stmt->execute([$encName, $size, $sha, 'b2:' . $cfg['b2_bucket_name'],
            json_encode($counts, JSON_UNESCAPED_UNICODE), $auditCount, $auditMax,
            $warnings ? mb_substr('Warnings: ' . implode(' | ', $warnings), 0, 1000) : null, $runId]);
        $pdo->prepare("INSERT INTO audit_log (user_id, action, entity_type, entity_id, note)
                       VALUES (NULL, 'backup', 'backup_run', ?, ?)")
            ->execute([$runId, mb_substr("Backup $encName ($kind)", 0, 200)]);

        if ($warnings) {
            alert($cfg, 'Backup finished with warnings', "Backup $encName was saved, but:\n- " . implode("\n- ", $warnings));
        }
        say('Done in ' . (time() - $started) . ' s.');
        return 0;
    } catch (Throwable $e) {
        $msg = $e->getMessage();
        say('FAILED: ' . $msg);
        if (!$verified && $encPath && is_file($encPath)) @unlink($encPath);   // never keep a half-made file
        if ($pdo && $runId) {
            try {
                $pdo->prepare("UPDATE backup_runs SET status = 'failed', finished_at = UTC_TIMESTAMP(), error = ? WHERE id = ?")
                    ->execute([mb_substr($msg, 0, 1000), $runId]);
            } catch (Throwable $ignored) { /* DB may be the problem */ }
        }
        alert($cfg, 'BACKUP FAILED', "Tonight's backup failed.\n\nReason: $msg\n\n"
            . "What to do: DATA-SAFETY.md §10, row \"Backup failed\". Yesterday's backup is still safe in B2.");
        return 1;
    } finally {
        foreach ($tmpFiles as $f) { if (is_file($f)) @unlink($f); }
        flock($lock, LOCK_UN);
    }
}

/** Watchdog: run every 6 h. Emails if the newest good backup is older than max_age_hours. */
function watchdog(array $cfg): int
{
    $state = $cfg['work_dir'] . '/watchdog.last_alert';
    try {
        $pdo = db($cfg);
        $row = $pdo->query("SELECT MAX(finished_at) AS last_ok FROM backup_runs WHERE status = 'ok'")->fetch();
        $stuck = $pdo->query("SELECT COUNT(*) FROM backup_runs WHERE status = 'running'
                              AND started_at < UTC_TIMESTAMP() - INTERVAL 3 HOUR")->fetchColumn();
        $lastOk = $row['last_ok'] ? strtotime($row['last_ok'] . ' UTC') : null;
        $hours  = $lastOk ? (time() - $lastOk) / 3600 : null;
        $problem = null;
        if ($hours === null)                       $problem = 'There is no successful backup at all.';
        elseif ($hours > $cfg['max_age_hours'])    $problem = sprintf('The last good backup is %.0f hours old.', $hours);
        if ((int)$stuck > 0) $problem = trim(($problem ?? '') . " $stuck backup run(s) are stuck as 'running'.");
    } catch (Throwable $e) {
        $problem = 'The watchdog could not read the database: ' . $e->getMessage();
    }
    if ($problem === null) { say(sprintf('Watchdog: OK (last good backup %.1f h ago).', $hours)); return 0; }

    // At most one email per 12 hours
    $last = is_file($state) ? (int)file_get_contents($state) : 0;
    if (time() - $last < 12 * 3600) { say("Watchdog: problem, alert already sent recently. $problem"); return 1; }
    $sent = alert($cfg, 'Backup is OVERDUE', "$problem\n\nWhat to do: DATA-SAFETY.md §10, row \"Backup overdue\".");
    if ($sent) file_put_contents($state, (string)time());
    say('Watchdog: PROBLEM. ' . $problem);
    return 1;
}

/* ---------------------------------------------------------------- uploads */

function syncUploads(array $cfg, B2 $b2, PDO $pdo): array
{
    $root = rtrim($cfg['storage_root'], '/');
    $warnings = [];
    $remote = array_flip($b2->listNames('files/'));               // names already off-site
    $onDisk = 0; $new = 0; $newBytes = 0; $skippedForCap = 0;
    $cap = $cfg['max_upload_mb_per_run'] * 1048576;

    $dir = $root . '/uploads';
    if (is_dir($dir)) {
        $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS));
        foreach ($it as $f) {
            if (!$f->isFile() || $f->getFilename() === '.htaccess') continue;
            $onDisk++;
            $rel  = substr($f->getPathname(), strlen($root) + 1);   // uploads/2026/10/<uuid>.jpg
            $name = 'files/' . $rel . '.enc';
            if (isset($remote[$name])) continue;
            if ($newBytes + $f->getSize() > $cap) { $skippedForCap++; continue; }
            $tmp = $cfg['work_dir'] . '/tmp/' . bin2hex(random_bytes(8)) . '.enc';
            try {
                shell(sprintf('%s enc %s -salt -pass file:%s -in %s -out %s', $cfg['openssl'], CIPHER_ARGS,
                    escapeshellarg($cfg['key_file']), escapeshellarg($f->getPathname()), escapeshellarg($tmp)), 'encrypt file');
                $b2->upload($tmp, $name);
                $new++; $newBytes += $f->getSize();
            } finally { @unlink($tmp); }
        }
    } else {
        $warnings[] = "Uploads folder not found: $dir";
    }

    // Every files row should have its bytes on disk (DATABASE rule 13)
    $missing = [];
    foreach ($pdo->query('SELECT storage_path FROM files') as $r) {
        if (!is_file($root . '/' . $r['storage_path'])) $missing[] = $r['storage_path'];
    }
    if ($missing) $warnings[] = count($missing) . ' file(s) listed in the database are missing on disk, e.g. ' . $missing[0];
    if ($skippedForCap) $warnings[] = "$skippedForCap file(s) wait for the next night (upload cap per run).";

    say("Files: $onDisk on disk, $new new uploaded (" . round($newBytes / 1048576, 1) . ' MB).');
    return ['summary' => ['on_disk' => $onDisk, 'offsite_before' => count($remote), 'new' => $new,
                          'new_bytes' => $newBytes, 'missing_on_disk' => count($missing), 'waiting' => $skippedForCap],
            'warnings' => $warnings];
}

/* -------------------------------------------------------------- retention */

/**
 * Decide which DB backups to keep. Pure function (tested).
 * Keep: newest 30 days (daily) · newest backup of each of the last 12 weeks (weekly)
 *       · first backup of every month, for ever (monthly; removed by hand after the wedding, §9).
 * Always keeps at least the newest 7 backups, whatever their dates.
 * @param string[] $names e.g. wedding_20261009_0217.sql.gz.enc
 * @return string[] names to remove
 */
function retentionPlan(array $names, int $now): array
{
    $items = [];
    foreach ($names as $n) {
        if (preg_match('/^wedding_(\d{8})_(\d{4})\.sql\.gz\.enc$/', $n, $m)) {
            $items[$n] = DateTimeImmutable::createFromFormat('Ymd Hi', "$m[1] $m[2]", new DateTimeZone('Asia/Kolkata'));
        }
    }
    if (!$items) return [];
    arsort($items);                                   // newest first
    $keep = array_fill_keys(array_slice(array_keys($items), 0, 7), true);
    $today = (new DateTimeImmutable('@' . $now))->setTimezone(new DateTimeZone('Asia/Kolkata'))->setTime(0, 0);
    $weeksSeen = []; $monthFirst = [];
    foreach ($items as $n => $d) {
        $ageDays = (int)$today->diff($d->setTime(0, 0))->format('%a');
        if ($ageDays < 30) $keep[$n] = true;
        $week = $d->format('o-W');
        if ($ageDays < 84 && !isset($weeksSeen[$week])) { $weeksSeen[$week] = true; $keep[$n] = true; }
        $monthFirst[$d->format('Y-m')] = $n;          // items are newest first, so the last write wins = earliest
    }
    foreach ($monthFirst as $n) $keep[$n] = true;
    return array_values(array_diff(array_keys($items), array_keys($keep)));
}

function applyRetention(B2 $b2, int $now): array
{
    $names  = array_map(fn($n) => substr($n, 3), $b2->listNames('db/'));   // strip "db/"
    $remove = retentionPlan(array_filter($names, fn($n) => str_ends_with($n, '.sql.gz.enc')), $now);
    foreach ($remove as $n) {
        $b2->hide('db/' . $n);
        $man = 'db/' . str_replace('.sql.gz.enc', '.manifest.json', $n);
        try { $b2->hide($man); } catch (Throwable $e) { /* manifest may not exist */ }
    }
    return $remove;
}

function pruneLocal(array $cfg): void
{
    $files = glob($cfg['work_dir'] . '/local/wedding_*.sql.gz.enc') ?: [];
    rsort($files);
    foreach (array_slice($files, (int)$cfg['keep_local']) as $old) {
        @unlink($old);
        @unlink(str_replace('.sql.gz.enc', '.manifest.json', $old));
    }
}

/* ---------------------------------------------------------------- database */

function db(array $cfg): PDO
{
    $pdo = new PDO(
        sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $cfg['db_host'], $cfg['db_port'] ?? 3306, $cfg['db_name']),
        $cfg['db_user'], $cfg['db_pass'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
    $pdo->exec("SET time_zone = '+00:00'");
    $pdo->exec("SET SESSION sql_mode = 'STRICT_ALL_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO'");
    return $pdo;
}

function rowCounts(PDO $pdo): array
{
    $tables = $pdo->query("SELECT table_name FROM information_schema.tables
                           WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' ORDER BY table_name")
                  ->fetchAll(PDO::FETCH_COLUMN);
    $counts = [];
    foreach ($tables as $t) {
        $counts[$t] = (int)$pdo->query('SELECT COUNT(*) FROM `' . str_replace('`', '', $t) . '`')->fetchColumn();
    }
    $a = $pdo->query('SELECT COUNT(*) AS n, COALESCE(MAX(id), 0) AS m FROM audit_log')->fetch();
    return [$counts, (int)$a['n'], (int)$a['m']];
}

/** mysqldump reads the password from this 0600 file, so it never shows in the process list. */
function writeDefaultsFile(array $cfg): string
{
    $path = $cfg['work_dir'] . '/tmp/my.cnf';
    $q = fn($v) => '"' . addcslashes((string)$v, "\\\"") . '"';
    $body = sprintf("[client]\nuser=%s\npassword=%s\nhost=%s\nport=%d\n",
        $q($cfg['db_user']), $q($cfg['db_pass']), $q($cfg['db_host']), (int) ($cfg['db_port'] ?? 3306));
    $old = umask(0077);
    file_put_contents($path, $body);
    umask($old);
    chmod($path, 0600);
    return $path;
}

/* ------------------------------------------------------------- key, decrypt */

function makeKey(array $cfg): int
{
    if (file_exists($cfg['key_file'])) {
        say('backup.key already exists. Not changing it (old backups need it).');
        return 1;
    }
    $key = rtrim(strtr(base64_encode(random_bytes(48)), '+/', '-_'), '=');
    $old = umask(0077);
    file_put_contents($cfg['key_file'], $key . "\n");
    umask($old);
    chmod($cfg['key_file'], 0600);
    say("Created backup.key. Save this line in the password manager NOW, as \"A&M backup key\":\n\n$key\n");
    say('Without it, no backup can ever be opened.');
    return 0;
}

function decryptCli(array $cfg, ?string $file): int
{
    if (!$file || !is_file($file)) { say('Usage: php backup.php --decrypt /path/to/wedding_….sql.gz.enc'); return 2; }
    $out = preg_replace('/\.enc$/', '', $file);
    if ($out === $file) $out .= '.dec';
    shell(sprintf('%s enc -d %s -pass file:%s -in %s -out %s', $cfg['openssl'], CIPHER_ARGS,
        escapeshellarg($cfg['key_file']), escapeshellarg($file), escapeshellarg($out)), 'decrypt');
    say('Decrypted to: ' . $out);
    if (str_ends_with($out, '.sql.gz')) {
        $tail = shell(sprintf('%s -dc %s | tail -n 1', $cfg['gzip'], escapeshellarg($out)), 'check');
        say(str_starts_with(trim($tail), DUMP_DONE_MARK) ? 'Check: complete dump ✓' : 'Check: WARNING — dump looks incomplete');
    }
    return 0;
}

/* -------------------------------------------------------------- helpers */

function shell(string $cmd, string $what = 'command', ?string $errFile = null): string
{
    $out = []; $code = 0;
    exec('/bin/bash -c ' . escapeshellarg($cmd) . ' 2>&1', $out, $code);
    if ($code !== 0) {
        $err = $errFile && is_file($errFile) ? trim((string)file_get_contents($errFile)) : '';
        throw new RuntimeException("$what failed (exit $code): " . mb_substr(trim($err . ' ' . implode(' ', $out)), 0, 600));
    }
    return implode("\n", $out);
}

function alert(array $cfg, string $subject, string $body): bool
{
    $to = array_values(array_filter((array) $cfg['alert_to']));
    $full = $body . "\n\nServer time: " . date('D j M Y, g:i A') . " IST\nHealth: "
          . ($cfg['health_url'] ?? 'https://wedding.lumorrahouse.com/api/v1/health') . "\n";
    $subjectLine = '[' . $cfg['label'] . '] ' . $subject;
    $error = null;
    if (!empty($cfg['smtp_host']) && is_file($cfg['app_autoload'])) {
        require_once $cfg['app_autoload'];
        $mailer = new \AM\Mail\Mailer([
            'enabled' => true,                       // backup alerts are never switched off
            'cap' => (int) $cfg['mail_daily_cap'],
            'state_dir' => $cfg['work_dir'],
            'from' => $cfg['alert_from'], 'from_name' => $cfg['label'],
            'smtp_host' => $cfg['smtp_host'], 'smtp_port' => (int) ($cfg['smtp_port'] ?? 465),
            'smtp_secure' => $cfg['smtp_secure'] ?? 'ssl',
            'smtp_user' => $cfg['smtp_user'] ?? '', 'smtp_pass' => $cfg['smtp_pass'] ?? '',
        ]);
        $ok = $mailer->send($to, $subjectLine, $full);
        $error = $mailer->lastError;
    } else {
        $headers = 'From: ' . $cfg['label'] . ' <' . $cfg['alert_from'] . ">\r\n"
                 . "Content-Type: text/plain; charset=UTF-8\r\n";
        $ok = @mail(implode(', ', $to), '=?UTF-8?B?' . base64_encode($subjectLine) . '?=', $full, $headers);
    }
    say(($ok ? 'Alert email sent: ' : 'Alert email FAILED: ') . $subject . (!$ok && $error ? " ($error)" : ''));
    return $ok;
}

function say(string $line): void
{
    echo '[' . date('Y-m-d H:i:s') . ' IST] ' . $line . "\n";
}

/* ------------------------------------------------------- Backblaze B2 (native API v2) */

final class B2
{
    private array $cfg;
    private ?array $auth = null;
    private ?array $uploadTarget = null;

    public function __construct(array $cfg) { $this->cfg = $cfg; }

    private function authorize(): array
    {
        if ($this->auth) return $this->auth;
        $r = $this->http('GET', $this->cfg['b2_api_base'] . '/b2api/v2/b2_authorize_account',
            ['Authorization: Basic ' . base64_encode($this->cfg['b2_key_id'] . ':' . $this->cfg['b2_app_key'])]);
        return $this->auth = $r;
    }

    private function api(string $op, array $body): array
    {
        $a = $this->authorize();
        return $this->http('POST', $a['apiUrl'] . '/b2api/v2/' . $op,
            ['Authorization: ' . $a['authorizationToken'], 'Content-Type: application/json'], json_encode($body));
    }

    /** All file names under a prefix (current versions only). */
    public function listNames(string $prefix): array
    {
        $names = []; $start = null;
        do {
            $body = ['bucketId' => $this->cfg['b2_bucket_id'], 'prefix' => $prefix, 'maxFileCount' => 10000];
            if ($start !== null) $body['startFileName'] = $start;
            $r = $this->api('b2_list_file_names', $body);
            foreach ($r['files'] as $f) if (($f['action'] ?? 'upload') === 'upload') $names[] = $f['fileName'];
            $start = $r['nextFileName'] ?? null;
        } while ($start !== null);
        return $names;
    }

    public function hide(string $name): void
    {
        $this->api('b2_hide_file', ['bucketId' => $this->cfg['b2_bucket_id'], 'fileName' => $name]);
    }

    /** Upload with up to 3 tries; a fresh upload URL after each failure (as B2 asks). */
    public function upload(string $path, string $name, string $type = 'application/octet-stream'): void
    {
        $sha1 = sha1_file($path);
        $size = filesize($path);
        $last = null;
        for ($try = 1; $try <= 3; $try++) {
            try {
                if (!$this->uploadTarget) {
                    $this->uploadTarget = $this->api('b2_get_upload_url', ['bucketId' => $this->cfg['b2_bucket_id']]);
                }
                $fh = fopen($path, 'rb');
                $this->http('POST', $this->uploadTarget['uploadUrl'], [
                    'Authorization: ' . $this->uploadTarget['authorizationToken'],
                    'X-Bz-File-Name: ' . implode('/', array_map('rawurlencode', explode('/', $name))),
                    'Content-Type: ' . $type,
                    'Content-Length: ' . $size,
                    'X-Bz-Content-Sha1: ' . $sha1,
                ], null, $fh, $size);
                fclose($fh);
                return;
            } catch (Throwable $e) {
                $last = $e;
                $this->uploadTarget = null;
                sleep(2 * $try);
            }
        }
        throw new RuntimeException("Upload of $name failed after 3 tries: " . $last->getMessage());
    }

    private function http(string $method, string $url, array $headers, ?string $body = null, $fh = null, int $size = 0): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => $headers,
            CURLOPT_CONNECTTIMEOUT => 20, CURLOPT_TIMEOUT => 600, CURLOPT_CUSTOMREQUEST => $method,
        ]);
        if ($fh) {
            curl_setopt_array($ch, [CURLOPT_UPLOAD => true, CURLOPT_INFILE => $fh, CURLOPT_INFILESIZE => $size,
                                    CURLOPT_CUSTOMREQUEST => 'POST']);
        } elseif ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        }
        $res  = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $err  = curl_error($ch);
        curl_close($ch);
        if ($res === false) throw new RuntimeException("B2 network error: $err");
        $json = json_decode((string)$res, true);
        if ($code < 200 || $code >= 300 || !is_array($json)) {
            throw new RuntimeException("B2 HTTP $code: " . mb_substr((string)$res, 0, 300));
        }
        return $json;
    }
}
