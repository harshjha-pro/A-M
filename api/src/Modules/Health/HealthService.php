<?php
declare(strict_types=1);

namespace AM\Modules\Health;

use AM\Db\SchemaInfo;
use AM\Kernel\App;
use AM\Kernel\AppInfo;
use AM\Repo\BaseRepository;
use AM\Repo\Entities;
use Throwable;

/**
 * API.md §11. Each check is green, amber, red or not_in_use; the overall
 * status is the worst one. The anonymous reply only says ok/fail: fail when
 * the database or the backup check is red.
 *
 * Session 1 built database, backup, audit_log, restore_drill, reminders.
 * Session 3 adds storage, last_export and trash_batches for the admin view.
 * Storage never makes the anonymous reply fail (only database, backup and
 * the audit tamper check do).
 *
 * Backup and audit checks: "not_in_use" until .env says BACKUP_EXPECTED=true
 * (live, from Session 4, when the nightly backup job exists). Staging has no
 * backup job, and its demo data holds old demo backup rows, so it stays off
 * there. Never turn it off on live once backups run.
 */
final class HealthService
{
    private const RANK = ['not_in_use' => 0, 'green' => 1, 'amber' => 2, 'red' => 3];

    public function __construct(private readonly App $app) {}

    /** @return array{status:string, public:string, checks:array<string,array<string,mixed>>} */
    public function run(): array
    {
        $checks = ['database' => $this->database()];
        $expected = $this->app->env->bool('BACKUP_EXPECTED', false);
        if ($checks['database']['reachable'] ?? false) {
            $checks['backup'] = $expected ? $this->backup() : ['status' => 'not_in_use', 'last_ok_at' => null];
            $checks['audit_log'] = $expected ? $this->auditLog() : ['status' => 'not_in_use'];
            $checks['restore_drill'] = $this->restoreDrill();
            $checks['storage'] = $this->storage();
        } else {
            $checks['backup'] = ['status' => 'not_in_use', 'note' => 'database down'];
        }
        $checks['reminders'] = ['status' => 'not_in_use', 'last_run_at' => null]; // R2a (CONTEXT 10)
        unset($checks['database']['reachable']);

        $worst = 'green';
        foreach ($checks as $c) {
            if (self::RANK[$c['status']] > self::RANK[$worst]) {
                $worst = $c['status'];
            }
        }
        $fail = $checks['database']['status'] === 'red'
            || $checks['backup']['status'] === 'red'
            || ($checks['audit_log']['status'] ?? '') === 'red';

        return ['status' => $worst, 'public' => $fail ? 'fail' : 'ok', 'checks' => $checks];
    }

    /** Extra lines for the admin view: last export (info) and how many delete batches are in Deleted items. */
    public function extras(): array
    {
        try {
            $db = $this->app->db();
            $exp = $db->one("SELECT e.finished_at, u.name FROM exports e JOIN users u ON u.id = e.requested_by WHERE e.status IN ('ready','expired') ORDER BY e.id DESC LIMIT 1");
            $exists = array_map(static fn ($d) => 'EXISTS (SELECT 1 FROM `' . BaseRepository::table($d) . '` x WHERE x.delete_batch_id = cb.id)', Entities::deletable());
            $trash = (int) $db->value("SELECT COUNT(*) FROM change_batches cb WHERE cb.action = 'delete' AND (" . implode(' OR ', $exists) . ')');
        } catch (Throwable $e) {
            return ['last_export' => null, 'trash_batches' => null];
        }
        return [
            'last_export' => $exp === null ? null : ['at' => gmdate('Y-m-d\TH:i:s\Z', (int) strtotime($exp['finished_at'] . ' UTC')), 'by' => $exp['name']],
            'trash_batches' => $trash,
        ];
    }

    /** files + exports + DB against the plan quota (API.md §11). */
    private function storage(): array
    {
        $env = $this->app->env;
        $quota = $env->int('STORAGE_QUOTA_BYTES', 53687091200);
        $dbQuota = $env->int('DB_QUOTA_BYTES', 3221225472);
        try {
            $db = $this->app->db();
            $dbBytes = (int) $db->value('SELECT COALESCE(SUM(data_length + index_length), 0) FROM information_schema.tables WHERE table_schema = DATABASE()');
            $files = (int) $db->value('SELECT COALESCE(SUM(size_bytes), 0) FROM files');
            $exports = (int) $db->value("SELECT COALESCE(SUM(size_bytes), 0) FROM exports WHERE status = 'ready'");
        } catch (Throwable $e) {
            $this->app->logger->exception('-', $e, ['check' => 'storage']);
            return ['status' => 'amber', 'reason' => 'query_failed'];
        }
        $root = $env->get('STORAGE_ROOT');
        $free = $root !== '' && is_dir($root) ? @disk_free_space($root) : false;
        $used = $dbBytes + $files + $exports;
        $pct = $quota > 0 ? round($used * 100 / $quota, 1) : 0.0;
        $status = $pct > 85 || $dbBytes > $dbQuota * 0.8 || ($free !== false && $free < 1073741824) ? 'red' : ($pct >= 70 ? 'amber' : 'green');
        return [
            'status' => $status, 'used_bytes' => $used, 'quota_bytes' => $quota, 'used_pct' => $pct,
            'db_bytes' => $dbBytes, 'db_quota_bytes' => $dbQuota, 'files_bytes' => $files, 'exports_bytes' => $exports,
            'private_folder_free_bytes' => $free === false ? null : (int) $free,
        ];
    }

    /** SELECT 1 under 500 ms and schema at the expected version, no half-run migration. */
    private function database(): array
    {
        $t0 = hrtime(true);
        try {
            $db = $this->app->db();
            $db->value('SELECT 1');
            $ms = (int) round((hrtime(true) - $t0) / 1e6);
            $schema = SchemaInfo::read($db);
        } catch (Throwable $e) {
            $this->app->logger->exception('-', $e, ['check' => 'database']);
            return ['status' => 'red', 'reason' => 'unreachable', 'reachable' => false];
        }
        $out = [
            'latency_ms' => $ms,
            'schema_version' => $schema['version'],
            'expected_schema_version' => AppInfo::EXPECTED_SCHEMA_VERSION,
            'reachable' => true,
        ];
        if (!$schema['ok']) {
            return ['status' => 'red', 'reason' => $schema['unfinished'] ? 'migration_unfinished' : 'schema_behind'] + $out;
        }
        return ['status' => $ms >= 500 ? 'amber' : 'green'] + $out;
    }

    /** Last ok backup < 26 h → green; failed run but ok < 26 h → amber; else red. */
    private function backup(): array
    {
        try {
            $db = $this->app->db();
            $lastOk = $db->value("SELECT MAX(finished_at) FROM backup_runs WHERE status = 'ok'");
            $lastRun = $db->one('SELECT status, started_at FROM backup_runs ORDER BY id DESC LIMIT 1');
        } catch (Throwable $e) {
            $this->app->logger->exception('-', $e, ['check' => 'backup']);
            return ['status' => 'red', 'reason' => 'query_failed'];
        }
        if ($lastOk === null) {
            return ['status' => 'red', 'last_ok_at' => null, 'reason' => 'no_backup_yet'];
        }
        $hours = ($this->app->clock->now()->getTimestamp() - strtotime($lastOk . ' UTC')) / 3600;
        $out = [
            'last_ok_at' => gmdate('Y-m-d\TH:i:s\Z', (int) strtotime($lastOk . ' UTC')),
            'hours_ago' => round($hours, 1),
            'last_run_status' => $lastRun['status'] ?? null,
        ];
        if ($hours >= 26) {
            return ['status' => 'red', 'reason' => 'too_old'] + $out;
        }
        return ['status' => ($lastRun['status'] ?? 'ok') === 'failed' ? 'amber' : 'green'] + $out;
    }

    /** DATABASE §7.6 tamper check: red if the audit row count or max id went DOWN between good backups. */
    private function auditLog(): array
    {
        try {
            $row = $this->app->db()->one(
                "SELECT (b.audit_row_count < prev.audit_row_count OR b.audit_max_id < prev.audit_max_id) AS lost
                 FROM backup_runs b
                 JOIN backup_runs prev ON prev.id = (SELECT MAX(id) FROM backup_runs
                                                     WHERE status = 'ok' AND id < b.id AND audit_row_count IS NOT NULL)
                 WHERE b.id = (SELECT MAX(id) FROM backup_runs WHERE status = 'ok' AND audit_row_count IS NOT NULL)"
            );
        } catch (Throwable $e) {
            $this->app->logger->exception('-', $e, ['check' => 'audit_log']);
            return ['status' => 'amber', 'reason' => 'query_failed'];
        }
        if ($row === null) {
            return ['status' => 'not_in_use'];
        }
        return ['status' => (int) $row['lost'] === 1 ? 'red' : 'green'];
    }

    /** Last passed drill ≤ 35 days → green, else amber (never red). */
    private function restoreDrill(): array
    {
        try {
            $last = $this->app->db()->value(
                "SELECT MAX(done_on) FROM restore_drills WHERE deleted_at IS NULL AND result = 'passed'"
            );
        } catch (Throwable $e) {
            return ['status' => 'amber', 'reason' => 'query_failed'];
        }
        if ($last === null) {
            return ['status' => $this->app->env->bool('BACKUP_EXPECTED', false) ? 'amber' : 'not_in_use', 'last_passed_on' => null];
        }
        $days = (int) floor((strtotime($this->app->clock->todayIst()) - strtotime((string) $last)) / 86400);
        return ['status' => $days > 35 ? 'amber' : 'green', 'last_passed_on' => $last, 'days_ago' => $days];
    }
}
