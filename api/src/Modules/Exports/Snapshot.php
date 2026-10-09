<?php
declare(strict_types=1);

namespace AM\Modules\Exports;

use AM\Db\Db;
use AM\Kernel\AppInfo;
use AM\Kernel\Csv;
use AM\Modules\Documents\FileStore;
use DateTimeImmutable;
use DateTimeZone;
use PDO;
use RuntimeException;
use Throwable;

/**
 * Step 1 of an export (API.md §9.1, FEATURES B8): one read transaction
 * (START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY), so the export holds
 * every table as it was at one moment (DS-23). Writes, into <dir>:
 *   csv/<table>.csv   every row incl. deleted ones; IST times; rupees; formula-safe
 *   json/all.json     the same rows as stored (UTC, paise), for tools/restore-from-export.php
 *   summary.html      readable, print-ready (Summary)
 *   manifest.json     the files to put in documents/, and in which part
 *   README.txt        what each file is, counts, time, app version
 * Rows are streamed table by table (unbuffered), so memory stays flat for 2,000 families.
 * Not exported: sessions, login attempts, reset links, idempotency keys, rate limits,
 * push subscriptions; no password, token or secret column anywhere; no generated
 * (derived) columns, which the database makes again by itself. (DEFAULT_GENERATED,
 * MySQL's word for DEFAULT CURRENT_TIMESTAMP, is a normal column and is exported.)
 */
final class Snapshot
{
    public const SKIP_TABLES = ['sessions', 'login_attempts', 'password_resets', 'idempotency_keys', 'rate_limits', 'push_subscriptions'];
    public const SECRET_COLUMNS = ['password_hash', 'token_hash', 'csrf_hash', 'download_token_hash', 'auth_secret', 'endpoint_hash', 'request_hash'];
    public const PART_BYTES = 200 * 1024 * 1024;

    /**
     * @param string $dir an empty folder to fill
     * @return array{parts:int, size_bytes:int, files_bytes:int, tables:array<string,int>, files:int, missing:int}
     */
    /** @param ?\Closure $whileReading tests only (DS-23): runs inside the read, after the first table */
    public static function build(Db $db, string $dir, FileStore $store, DateTimeImmutable $now, int $partBytes = self::PART_BYTES, ?\Closure $whileReading = null): array
    {
        foreach (['csv', 'json'] as $sub) {
            if (!is_dir("$dir/$sub") && !mkdir("$dir/$sub", 0750, true)) {
                throw new RuntimeException('Could not create the export folder.');
            }
        }
        $pdo = $db->pdo;
        $pdo->exec('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
        try {
            $schema = self::schema($db);
            $json = fopen("$dir/json/all.json", 'wb');
            if ($json === false) {
                throw new RuntimeException('Could not write json/all.json.');
            }
            $meta = ['format' => 'am-wedding-export', 'format_version' => 1, 'app_version' => AppInfo::version(),
                'schema_version' => self::schemaVersion($db), 'exported_at' => $now->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s\Z')];
            fwrite($json, substr(json_encode($meta, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR), 0, -1) . ',"tables":{');
            $counts = [];
            $files = self::fileMap($db);
            $first = true;
            foreach ($schema as $table => $cols) {
                $counts[$table] = self::dumpTable($pdo, $table, $cols, "$dir/csv/$table.csv", $json, $first, $table === 'documents' ? $files['by_document'] : null);
                if ($first && $whileReading !== null) {
                    $whileReading();
                }
                $first = false;
            }
            fwrite($json, "}}\n");
            fclose($json);

            [$manifestFiles, $parts, $filesBytes, $missing] = self::plan($files['list'], $store, $partBytes);
            $summary = Summary::html($db, $now, $counts);
            $pdo->exec('COMMIT');
        } catch (Throwable $e) {
            try {
                $pdo->exec('ROLLBACK');
            } catch (Throwable) {
                // already closed
            }
            throw $e;
        }
        file_put_contents("$dir/summary.html", $summary);
        $manifest = ['export_format' => 1, 'created_at' => $meta['exported_at'], 'app_version' => $meta['app_version'], 'parts' => $parts,
            'tables' => $counts, 'files' => $manifestFiles];
        file_put_contents("$dir/manifest.json", json_encode($manifest, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));
        file_put_contents("$dir/README.txt", self::readme($now, $meta, $counts, count($manifestFiles), $missing, $parts));
        $size = 0;
        foreach (self::dataFiles($dir) as $f) {
            $size += (int) filesize("$dir/$f");
        }
        return ['parts' => $parts, 'size_bytes' => $size + $filesBytes, 'files_bytes' => $filesBytes, 'tables' => $counts, 'files' => count($manifestFiles), 'missing' => $missing];
    }

    /** The data files of a snapshot folder, in ZIP order (relative paths). */
    public static function dataFiles(string $dir): array
    {
        $out = ['README.txt', 'summary.html', 'manifest.json', 'json/all.json'];
        foreach (glob("$dir/csv/*.csv") ?: [] as $f) {
            $out[] = 'csv/' . basename($f);
        }
        return $out;
    }

    /** table → [column → type] for every exported table, secrets left out. @return array<string, array<string,string>> */
    private static function schema(Db $db): array
    {
        $out = [];
        $rows = $db->all(
            "SELECT c.TABLE_NAME AS t, c.COLUMN_NAME AS c, c.DATA_TYPE AS d
             FROM information_schema.COLUMNS c JOIN information_schema.TABLES tb ON tb.TABLE_SCHEMA = c.TABLE_SCHEMA AND tb.TABLE_NAME = c.TABLE_NAME
             WHERE c.TABLE_SCHEMA = DATABASE() AND tb.TABLE_TYPE = 'BASE TABLE' AND c.EXTRA NOT IN ('VIRTUAL GENERATED', 'STORED GENERATED')
             ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION",
        );
        foreach ($rows as $r) {
            if (in_array($r['t'], self::SKIP_TABLES, true) || in_array($r['c'], self::SECRET_COLUMNS, true)) {
                continue;
            }
            $out[$r['t']][$r['c']] = strtolower($r['d']);
        }
        return $out;
    }

    private static function schemaVersion(Db $db): int
    {
        return (int) ($db->value('SELECT COALESCE(MAX(version), 0) FROM schema_migrations WHERE finished_at IS NOT NULL') ?? 0);
    }

    /**
     * One table → its CSV file and its part of all.json. Unbuffered: rows are written
     * as they arrive. Documents get one more CSV column: where the file is in the ZIP.
     */
    private static function dumpTable(PDO $pdo, string $table, array $cols, string $csvPath, $json, bool $first, ?array $docPaths): int
    {
        $names = array_keys($cols);
        $csv = fopen($csvPath, 'wb');
        if ($csv === false) {
            throw new RuntimeException("Could not write csv/$table.csv.");
        }
        $head = array_map(static fn ($c) => str_ends_with($c, '_paise') ? substr($c, 0, -6) . '_rupees' : $c, $names);
        if ($docPaths !== null) {
            $head[] = 'file_in_zip';
        }
        fwrite($csv, Csv::BOM . Csv::line($head) . "\r\n");
        fwrite($json, ($first ? '' : ',') . json_encode($table) . ':{"columns":' . json_encode($names) . ',"rows":[');

        $select = implode(', ', array_map(static fn ($c) => "`$c`", $names));
        $pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, false);
        $n = 0;
        try {
            $st = $pdo->query("SELECT $select FROM `$table` ORDER BY 1");
            $ist = new DateTimeZone('Asia/Kolkata');
            $utc = new DateTimeZone('UTC');
            while (($row = $st->fetch(PDO::FETCH_ASSOC)) !== false) {
                fwrite($json, ($n === 0 ? '' : ',') . json_encode(array_values($row), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
                $out = [];
                foreach ($row as $c => $v) {
                    $out[] = self::csvValue($c, $cols[$c], $v, $ist, $utc);
                }
                if ($docPaths !== null) {
                    $out[] = $docPaths[(string) $row['id']] ?? '';
                }
                fwrite($csv, Csv::line($out) . "\r\n");
                $n++;
            }
            $st->closeCursor();
        } finally {
            $pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, true);
        }
        fwrite($json, ']}');
        fclose($csv);
        return $n;
    }

    /** IST times (FEATURES B8: "2026-10-12 18:00"), rupees with 2 decimals, the rest as stored. */
    public static function csvValue(string $col, string $type, mixed $v, DateTimeZone $ist, DateTimeZone $utc): ?string
    {
        if ($v === null) {
            return null;
        }
        if ($type === 'datetime' || $type === 'timestamp') {
            return (new DateTimeImmutable((string) $v, $utc))->setTimezone($ist)->format('Y-m-d H:i');
        }
        if (str_ends_with($col, '_paise')) {
            $p = (int) $v;
            $abs = abs($p);
            return ($p < 0 ? '-' : '') . intdiv($abs, 100) . '.' . str_pad((string) ($abs % 100), 2, '0', STR_PAD_LEFT);
        }
        return (string) $v;
    }

    /**
     * Every stored file once, named after a document that uses it (live ones first):
     * documents/<document id>_<safe title>.<ext>. A file no document uses keeps its own id.
     * @return array{list: list<array>, by_document: array<string,string>}
     */
    private static function fileMap(Db $db): array
    {
        $docs = $db->all('SELECT id, public_id, title, file_id, deleted_at FROM documents ORDER BY deleted_at IS NOT NULL, id');
        $files = $db->all('SELECT id, public_id, storage_path, original_name, mime_type, size_bytes, sha256 FROM files ORDER BY id');
        $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'application/pdf' => 'pdf'];
        $nameOf = [];
        foreach ($docs as $d) {
            $nameOf[(int) $d['file_id']] ??= $d['public_id'] . '_' . self::safeName((string) $d['title']);
        }
        $list = [];
        $byFile = [];
        foreach ($files as $f) {
            $e = $ext[$f['mime_type']] ?? (pathinfo((string) $f['storage_path'], PATHINFO_EXTENSION) ?: 'bin');
            $path = 'documents/' . ($nameOf[(int) $f['id']] ?? 'file_' . $f['public_id']) . '.' . $e;
            $byFile[(int) $f['id']] = $path;
            $list[] = ['file_id' => $f['public_id'], 'path_in_zip' => $path, 'storage_path' => $f['storage_path'], 'size_bytes' => (int) $f['size_bytes'], 'sha256' => $f['sha256']];
        }
        $byDoc = [];
        foreach ($docs as $d) {
            $byDoc[(string) $d['id']] = $byFile[(int) $d['file_id']] ?? '';
        }
        return ['list' => $list, 'by_document' => $byDoc];
    }

    /** "Receipt – Shree Tent House / 12 Oct" → "Receipt – Shree Tent House 12 Oct" (keeps Hindi, drops path and control characters). */
    public static function safeName(string $title): string
    {
        $s = (string) preg_replace('/[\x00-\x1F\x7F\/\\\\:*?"<>|]+/u', ' ', $title);
        $s = trim((string) preg_replace('/\s+/u', ' ', $s), ' .');
        return mb_substr($s !== '' ? $s : 'document', 0, 60);
    }

    /**
     * Which part each file goes in: part 1 holds the data and files up to the limit,
     * then parts 2…n. A file missing on disk is listed (and named in README), not fatal.
     * @return array{0: list<array>, 1: int, 2: int, 3: int}
     */
    private static function plan(array $files, FileStore $store, int $partBytes): array
    {
        $part = 1;
        $used = 0;
        $total = 0;
        $missing = 0;
        foreach ($files as &$f) {
            try {
                $abs = $store->absolute((string) $f['storage_path']);
            } catch (\LogicException) {
                $abs = null; // a path that isn't ours is never read
            }
            if ($abs === null || !is_file($abs)) {
                $f['missing'] = true;
                $f['part'] = null;
                $missing++;
                continue;
            }
            $size = (int) filesize($abs);
            if ($used > 0 && $used + $size > $partBytes) {
                $part++;
                $used = 0;
            }
            $f['missing'] = false;
            $f['part'] = $part;
            $f['size_bytes'] = $size;
            $used += $size;
            $total += $size;
        }
        unset($f);
        return [$files, $part, $total, $missing];
    }

    private static function readme(DateTimeImmutable $now, array $meta, array $counts, int $files, int $missing, int $parts): string
    {
        $when = $now->setTimezone(new DateTimeZone('Asia/Kolkata'))->format('j M Y, g:i A') . ' IST';
        $lines = [
            'A&M Wedding — full export',
            '==========================',
            '',
            "Made: $when · App version {$meta['app_version']} · Database version {$meta['schema_version']}",
            $parts > 1 ? "This export has $parts parts. Part 1 holds all the data and the first files; the other parts hold more files (documents/)." : 'Everything is in this one ZIP.',
            '',
            'What is inside',
            '--------------',
            'summary.html     Open in any browser. Print it, or Save as PDF, for a paper copy.',
            'csv/<table>.csv  One file per table. Opens in Excel or Google Sheets (UTF-8, Hindi and ₹ intact).',
            '                 Deleted rows are included: see the deleted_at column.',
            '                 Times are India time (IST). Money is in rupees (…_rupees columns).',
            '                 Cells that start like a formula have a leading \' so they stay text.',
            'csv/audit_log.csv  Every change ever made, who made it and when.',
            'csv/documents.csv  Each document; file_in_zip says where its file is in documents/.',
            'json/all.json    Everything exactly as stored (UTC times, money in paise), for a full restore',
            '                 with tools/restore-from-export.php.',
            'documents/       Every uploaded photo and PDF, including those in Deleted items.',
            'manifest.json    The list of files and which part each one is in.',
            '',
            'Not included on purpose: passwords, login sessions, reset links and other security keys.',
            'After a restore, everyone sets a new password with a link from Ayush or Mahi.',
            '',
            'Rows per table',
            '--------------',
        ];
        foreach ($counts as $t => $n) {
            $lines[] = str_pad($t, 22) . $n;
        }
        $lines[] = '';
        $lines[] = "Files: $files" . ($missing > 0 ? " ($missing could not be found on the server and are missing: see manifest.json, \"missing\": true)" : '');
        return implode("\r\n", $lines) . "\r\n";
    }
}
