<?php
declare(strict_types=1);

namespace AM\Modules\Exports;

use AM\Db\Db;
use RuntimeException;
use Throwable;

/**
 * Loads an export's json/all.json into a new database (DS-22, AC-EXP-05).
 * The target must be freshly made: migrations run, nobody added. Its starter rows
 * (settings, the default events, categories and tags) are replaced by the export's,
 * all in one transaction: either everything is restored or nothing changes.
 * Passwords are never in an export, so every person gets an unusable password and
 * needs a new one (Members → Reset password, from an admin restored the same way:
 * see docs/DATA-SAFETY.md). Optionally copies documents/ back into STORAGE_ROOT,
 * checking each file's SHA-256.
 * Used by tools/restore-from-export.php.
 */
final class Restore
{
    /** @var list<string> */
    public array $lines = [];

    public function __construct(private readonly Db $db) {}

    /** @return array<string,int> rows restored per table */
    public function data(string $jsonPath): array
    {
        $raw = file_get_contents($jsonPath);
        if ($raw === false) {
            throw new RuntimeException("Can't read $jsonPath.");
        }
        $all = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        if (($all['format'] ?? '') !== 'am-wedding-export') {
            throw new RuntimeException('This is not an A&M Wedding export (json/all.json).');
        }
        $have = (int) ($this->db->value('SELECT COALESCE(MAX(version), 0) FROM schema_migrations WHERE finished_at IS NOT NULL') ?? 0);
        if ($have !== (int) $all['schema_version']) {
            throw new RuntimeException("Database version $have, export version {$all['schema_version']}. Run the migrations up to version {$all['schema_version']} first.");
        }
        if ((int) $this->db->value('SELECT COUNT(*) FROM users') > 0) {
            throw new RuntimeException('This database already has people in it. Restore only into a new, empty database.');
        }
        $tables = array_diff(array_keys($all['tables']), ['schema_migrations']);
        $columns = $this->columns();
        $pdo = $this->db->pdo;
        $counts = [];
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
        $pdo->beginTransaction();
        try {
            foreach ($tables as $t) {
                if (!isset($columns[$t])) {
                    throw new RuntimeException("Table $t is not in this database.");
                }
                $pdo->exec("DELETE FROM `$t`");
                $counts[$t] = $this->insert($t, $all['tables'][$t]['columns'], $all['tables'][$t]['rows'], $columns[$t]);
            }
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        } finally {
            $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
        }
        foreach ($counts as $t => $n) {
            $this->lines[] = str_pad($t, 22) . $n;
        }
        return $counts;
    }

    /**
     * documents/ from an unzipped export (all parts unzipped into one folder) → STORAGE_ROOT,
     * using manifest.json. A file whose SHA-256 doesn't match is not copied.
     * @return array{copied:int, skipped:int, bad:int}
     */
    public function files(string $exportDir, string $storageRoot): array
    {
        $manifest = json_decode((string) file_get_contents("$exportDir/manifest.json"), true, 512, JSON_THROW_ON_ERROR);
        $out = ['copied' => 0, 'skipped' => 0, 'bad' => 0];
        foreach ($manifest['files'] as $f) {
            $src = $exportDir . '/' . $f['path_in_zip'];
            $rel = (string) $f['storage_path'];
            if (!empty($f['missing']) || !is_file($src) || !preg_match('#^uploads/\d{4}/\d{2}/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$#', $rel)) {
                $out['skipped']++;
                continue;
            }
            if (!hash_equals((string) $f['sha256'], (string) hash_file('sha256', $src))) {
                $out['bad']++;
                $this->lines[] = 'Changed or damaged, not copied: ' . $f['path_in_zip'];
                continue;
            }
            $dst = rtrim($storageRoot, '/') . '/' . $rel;
            if (!is_dir(dirname($dst)) && !mkdir(dirname($dst), 0750, true)) {
                throw new RuntimeException('Could not create ' . dirname($dst));
            }
            if (!copy($src, $dst)) {
                throw new RuntimeException('Could not copy ' . $f['path_in_zip']);
            }
            $out['copied']++;
        }
        $this->lines[] = "Files copied: {$out['copied']}, skipped: {$out['skipped']}, damaged: {$out['bad']}.";
        return $out;
    }

    /** @return array<string, array<string, array{nullable:bool, default:?string}>> */
    private function columns(): array
    {
        $out = [];
        foreach ($this->db->all('SELECT TABLE_NAME AS t, COLUMN_NAME AS c, IS_NULLABLE AS n, COLUMN_DEFAULT AS d FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()') as $r) {
            $out[$r['t']][$r['c']] = ['nullable' => $r['n'] === 'YES', 'default' => $r['d']];
        }
        return $out;
    }

    /** Rows in batches of 200. Columns left out of the export (secrets) get a safe value. */
    private function insert(string $table, array $cols, array $rows, array $dbCols): int
    {
        foreach ($cols as $c) {
            if (!isset($dbCols[$c])) {
                throw new RuntimeException("Column $table.$c is not in this database.");
            }
        }
        $extra = [];
        foreach (Snapshot::SECRET_COLUMNS as $c) {
            if (isset($dbCols[$c]) && !in_array($c, $cols, true) && !$dbCols[$c]['nullable'] && $dbCols[$c]['default'] === null) {
                $extra[$c] = $c === 'password_hash' ? '!restored-set-a-new-password' : '';
            }
        }
        $all = [...$cols, ...array_keys($extra)];
        $list = implode(', ', array_map(static fn ($c) => "`$c`", $all));
        $one = '(' . implode(', ', array_fill(0, count($all), '?')) . ')';
        $n = 0;
        foreach (array_chunk($rows, 200) as $chunk) {
            $args = [];
            foreach ($chunk as $i => $row) {
                $values = $row;
                foreach ($extra as $c => $v) {
                    // A unique column (password hashes aren't) would need a unique value; keep each one different anyway.
                    $values[] = $v === '' ? '' : $v . '-' . ($n + $i);
                }
                array_push($args, ...$values);
            }
            $this->db->run("INSERT INTO `$table` ($list) VALUES " . implode(', ', array_fill(0, count($chunk), $one)), $args);
            $n += count($chunk);
        }
        return $n;
    }
}
