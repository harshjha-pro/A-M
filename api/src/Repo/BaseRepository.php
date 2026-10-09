<?php
declare(strict_types=1);

namespace AM\Repo;

use AM\Db\Db;
use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Request;
use AM\Kernel\Ulid;
use AM\Safety\AuditLog;
use AM\Safety\ChangeBatches;

/**
 * The shared write paths every module uses (DATABASE §5). Always called inside
 * UnitOfWork, so the change, its audit rows and its batch commit together.
 *
 *   create()       client_uuid = Idempotency-Key; a retry returns the same row (rule 2)
 *   softDelete()   new batch; row AND children get deleted_* + version + 1 (rule 5)
 *   restoreBatch() only rows with that delete_batch_id; parents first; clash checks (rule 6)
 *   undo()         revert only rows still at the version the batch left them (rule 7)
 *
 * Never hard-delete a row of a business table (rule 12, DS-19).
 */
final class BaseRepository
{
    /** @param class-string<EntityDef> $def */
    public static function find(Db $db, string $def, string $publicId, bool $forUpdate = false, bool $includeDeleted = true): array
    {
        if (!preg_match('/^[0-9A-HJKMNP-TV-Z]{26}$/', $publicId)) {
            throw HttpError::make(404, 'not_found'); // numeric ids never reach a row (SEC-04)
        }
        $table = self::table($def);
        $row = $db->one("SELECT * FROM `$table` WHERE public_id = ?" . ($forUpdate ? ' FOR UPDATE' : ''), [$publicId]);
        if ($row === null || (!$includeDeleted && ($row['deleted_at'] ?? null) !== null)) {
            throw HttpError::make(404, 'not_found');
        }
        return $row;
    }

    /**
     * Insert a new record. A retry with the same key (even after 48 h) returns the
     * existing row: ['row' => …, 'created' => false].
     * @param class-string<EntityDef> $def
     * @return array{row: array, created: bool}
     */
    public static function create(App $app, Db $db, Request $request, string $def, array $values): array
    {
        $table = self::table($def);
        $key = (string) $request->attr('idem_key');
        if ($key !== '') {
            $existing = $db->one("SELECT * FROM `$table` WHERE client_uuid = ?", [$key]);
            if ($existing !== null) {
                return ['row' => $existing, 'created' => false];
            }
        }
        $user = $request->attr('user');
        $now = $app->clock->dbNow();
        $values += [
            'public_id' => Ulid::generate($app->clock),
            'client_uuid' => $key !== '' ? $key : null,
            'version' => 1,
            'created_at' => $now, 'created_by' => $user['id'] ?? null,
            'updated_at' => $now, 'updated_by' => $user['id'] ?? null,
        ];
        $cols = array_keys($values);
        foreach ($cols as $c) {
            self::assertColumn($c);
        }
        $db->run(
            "INSERT INTO `$table` (`" . implode('`, `', $cols) . '`) VALUES (' . implode(', ', array_fill(0, count($cols), '?')) . ')',
            array_map(static fn ($v) => is_bool($v) ? (int) $v : $v, array_values($values)),
        );
        $row = $db->one("SELECT * FROM `$table` WHERE id = ?", [(int) $db->pdo->lastInsertId()]);
        AuditLog::record($app, $db, $request, [
            'action' => 'create', 'entity_type' => $def::TYPE, 'entity_id' => (int) $row['id'],
            'entity_version' => (int) $row['version'], 'after' => $row,
        ]);
        return ['row' => $row, 'created' => true];
    }

    /**
     * Soft delete a (locked, live, version-checked) row and its children in ONE new batch.
     * @param class-string<EntityDef> $def
     * @return array{id:int, public_id:string, summary:string}
     */
    public static function softDelete(App $app, Db $db, Request $request, string $def, array $row): array
    {
        $summary = mb_substr($def::name($row), 0, 150);
        $batch = ChangeBatches::create($app, $db, $request, 'delete', $def::TYPE, $summary);
        $count = self::markDeleted($app, $db, $request, $def, $row, $batch['id']);
        $children = $count - 1;
        if ($children > 0) {
            $summary .= " · $children linked";
            $db->run('UPDATE change_batches SET summary = ? WHERE id = ?', [mb_substr($summary, 0, 200), $batch['id']]);
        }
        ChangeBatches::setCount($db, $batch['id'], $count);
        return $batch + ['summary' => $summary];
    }

    /** @param class-string<EntityDef> $def @return int rows marked (this + children) */
    private static function markDeleted(App $app, Db $db, Request $request, string $def, array $row, int $batchId): int
    {
        $table = self::table($def);
        $user = $request->attr('user');
        $now = $app->clock->dbNow();
        if ($def::VERSIONED) {
            $db->run(
                "UPDATE `$table` SET deleted_at = ?, deleted_by = ?, delete_batch_id = ?, version = version + 1, updated_at = ?, updated_by = ?
                 WHERE id = ? AND deleted_at IS NULL",
                [$now, $user['id'] ?? null, $batchId, $now, $user['id'] ?? null, $row['id']],
            );
        } else {
            $db->run("UPDATE `$table` SET deleted_at = ?, deleted_by = ?, delete_batch_id = ? WHERE id = ? AND deleted_at IS NULL",
                [$now, $user['id'] ?? null, $batchId, $row['id']]);
        }
        $after = $db->one("SELECT * FROM `$table` WHERE id = ?", [$row['id']]);
        AuditLog::record($app, $db, $request, [
            'action' => 'delete', 'entity_type' => $def::TYPE, 'entity_id' => (int) $row['id'],
            'entity_version' => $def::VERSIONED ? (int) $after['version'] : null, 'batch_id' => $batchId, 'before' => $row, 'after' => $after,
        ]);
        $n = 1;
        foreach ($def::CHILDREN as $child => $fk) {
            self::assertColumn($fk);
            $ct = self::table($child);
            foreach ($db->all("SELECT * FROM `$ct` WHERE `$fk` = ? AND deleted_at IS NULL FOR UPDATE", [$row['id']]) as $c) {
                $n += self::markDeleted($app, $db, $request, $child, $c, $batchId);
            }
        }
        return $n;
    }

    /**
     * Restore what one delete batch removed (all of it, or chosen items + their children).
     * @param list<array{type:string, id:string}>|null $only
     * @return array{restored:int, blocked:list<array>, warnings:list<string>, already_restored:bool, rows:list<array>}
     */
    public static function restoreBatch(App $app, Db $db, Request $request, array $batch, ?array $only = null): array
    {
        $found = [];
        foreach (Entities::deletable() as $def) {
            $t = self::table($def);
            foreach ($db->all("SELECT * FROM `$t` WHERE delete_batch_id = ? FOR UPDATE", [$batch['id']]) as $r) {
                $found[] = ['def' => $def, 'row' => $r];
            }
        }
        $result = ['restored' => 0, 'blocked' => [], 'warnings' => [], 'already_restored' => false, 'rows' => []];
        if ($found === []) {
            $result['already_restored'] = true;
            return $result;
        }
        if ($only !== null) {
            $found = self::selectItems($found, $only);
            if ($found === []) {
                throw HttpError::make(404, 'not_found');
            }
        }

        $restoreBatch = ChangeBatches::create($app, $db, $request, 'restore', (string) $batch['entity_type'], 'Restored: ' . $batch['summary']);
        $blockedIds = [];
        foreach ($found as $f) {
            $def = $f['def'];
            $row = $f['row'];
            // A child whose parent was blocked stays deleted with it.
            if ($def::PARENT !== null && isset($blockedIds[$def::PARENT[0] . ':' . $row[$def::PARENT[1]]])) {
                continue;
            }
            $check = $def::restoreCheck($db, $row);
            if (isset($check['blocked'])) {
                $result['blocked'][] = ['type' => $def::TYPE, 'id' => Entities::key($def, $row), 'name' => $def::name($row), 'reason' => $check['blocked']];
                $blockedIds[$def . ':' . $row['id']] = true;
                continue;
            }
            if (isset($check['warning'])) {
                $result['warnings'][] = $check['warning'];
            }
            self::restoreParent($app, $db, $request, $def, $row);
            $result['rows'][] = ['def' => $def, 'row' => self::markRestored($app, $db, $request, $def, $row, $restoreBatch['id'])];
            $result['restored']++;
        }
        ChangeBatches::setCount($db, $restoreBatch['id'], $result['restored']);
        return $result;
    }

    /** Restoring a child brings back its deleted parent (FEATURES B9). */
    private static function restoreParent(App $app, Db $db, Request $request, string $def, array $row): void
    {
        if ($def::PARENT === null) {
            return;
        }
        [$parentDef, $fk] = $def::PARENT;
        $pt = self::table($parentDef);
        $parent = $db->one("SELECT * FROM `$pt` WHERE id = ? FOR UPDATE", [$row[$fk]]);
        if ($parent !== null && $parent['deleted_at'] !== null) {
            $batch = $db->one('SELECT * FROM change_batches WHERE id = ?', [$parent['delete_batch_id']]);
            if ($batch !== null) {
                self::restoreBatch($app, $db, $request, $batch, [['type' => $parentDef::TYPE, 'id' => $parent['public_id']]]);
            }
        }
    }

    private static function markRestored(App $app, Db $db, Request $request, string $def, array $row, int $restoreBatchId): array
    {
        $table = self::table($def);
        $user = $request->attr('user');
        $now = $app->clock->dbNow();
        if ($def::VERSIONED) {
            $db->run(
                "UPDATE `$table` SET deleted_at = NULL, deleted_by = NULL, delete_batch_id = NULL, version = version + 1, updated_at = ?, updated_by = ?
                 WHERE id = ? AND delete_batch_id = ?",
                [$now, $user['id'] ?? null, $row['id'], $row['delete_batch_id']],
            );
        } else {
            $db->run("UPDATE `$table` SET deleted_at = NULL, deleted_by = NULL, delete_batch_id = NULL WHERE id = ? AND delete_batch_id = ?",
                [$row['id'], $row['delete_batch_id']]);
        }
        $after = $db->one("SELECT * FROM `$table` WHERE id = ?", [$row['id']]);
        AuditLog::record($app, $db, $request, [
            'action' => 'restore', 'entity_type' => $def::TYPE, 'entity_id' => (int) $row['id'],
            'entity_version' => $def::VERSIONED ? (int) $after['version'] : null, 'batch_id' => $restoreBatchId, 'before' => $row, 'after' => $after,
        ]);
        return $after;
    }

    /** Chosen items plus (recursively) their children in the same batch. */
    private static function selectItems(array $found, array $only): array
    {
        $want = [];
        foreach ($only as $item) {
            if (is_array($item) && isset($item['type'], $item['id']) && is_string($item['type']) && is_string($item['id'])) {
                $want[$item['type'] . ':' . $item['id']] = true;
            }
        }
        $picked = [];
        foreach ($found as $i => $f) {
            $key = Entities::key($f['def'], $f['row']);
            if ($key !== null && isset($want[$f['def']::TYPE . ':' . $key])) {
                $picked[$i] = true;
            }
        }
        do {
            $added = false;
            foreach ($found as $i => $f) {
                if (isset($picked[$i])) {
                    continue;
                }
                foreach ($found as $j => $p) {
                    $fk = $p['def']::CHILDREN[$f['def']] ?? null;
                    if (isset($picked[$j]) && $fk !== null && (int) $f['row'][$fk] === (int) $p['row']['id']) {
                        $picked[$i] = $added = true;
                        break;
                    }
                }
            }
        } while ($added);
        return array_values(array_intersect_key($found, $picked));
    }

    /**
     * Undo one batch (FEATURES A2): every row goes back only if it is still at the
     * version the batch left it; rows changed since are skipped and named.
     * @return array{undone:int, skipped:list<array>, already_undone:bool}
     */
    public static function undo(App $app, Db $db, Request $request, array $batch): array
    {
        if ($batch['undone_at'] !== null) {
            return ['undone' => 0, 'skipped' => [], 'already_undone' => true];
        }
        $undoBatch = ChangeBatches::create($app, $db, $request, 'undo', (string) $batch['entity_type'], 'Undo: ' . $batch['summary']);
        $claimed = $db->run(
            'UPDATE change_batches SET undone_at = ?, undone_by = ?, undo_batch_id = ? WHERE id = ? AND undone_at IS NULL',
            [$app->clock->dbNow(), $request->attr('user')['id'] ?? null, $undoBatch['id'], $batch['id']],
        )->rowCount();
        if ($claimed !== 1) {
            return ['undone' => 0, 'skipped' => [], 'already_undone' => true];
        }

        $refs = new Refs($db, $app->clock->todayIst());
        $out = ['undone' => 0, 'skipped' => [], 'already_undone' => false];
        $user = $request->attr('user');
        $now = $app->clock->dbNow();
        foreach ($db->all('SELECT * FROM audit_log WHERE batch_id = ? ORDER BY id DESC', [$batch['id']]) as $a) {
            $def = Entities::forType((string) $a['entity_type']);
            if ($def === null) {
                continue;
            }
            $table = self::table($def);
            $row = $db->one("SELECT * FROM `$table` WHERE id = ? FOR UPDATE", [$a['entity_id']]);
            if ($row === null) {
                continue;
            }
            $unchanged = $def::VERSIONED
                ? (int) $row['version'] === (int) $a['entity_version']
                : $a['action'] === 'delete' && (int) ($row['delete_batch_id'] ?? 0) === (int) $batch['id'];
            if (!$unchanged) {
                if ($def::IN_ACTIVITY) { // a link row changed since is covered by its parent's line
                    $out['skipped'][] = [
                        'type' => $def::TYPE, 'id' => Entities::key($def, $row), 'name' => $def::name($row),
                        'reason' => 'changed_since', 'changed_by' => $refs->user(($row['updated_by'] ?? null) !== null ? (int) $row['updated_by'] : null),
                    ];
                }
                continue;
            }
            $before = json_decode((string) $a['before_json'], true) ?: [];
            if ($a['action'] === 'create') {
                // Undo an add (an invitation): soft delete it in the undo batch. Never a hard delete.
                if (!$def::SOFT_DELETE || $row['deleted_at'] !== null) {
                    continue;
                }
                $vset = $def::VERSIONED ? ', version = version + 1, updated_at = ?, updated_by = ?' : '';
                $db->run("UPDATE `$table` SET deleted_at = ?, deleted_by = ?, delete_batch_id = ?$vset WHERE id = ?",
                    [$now, $user['id'] ?? null, $undoBatch['id'], ...($def::VERSIONED ? [$now, $user['id'] ?? null] : []), $row['id']]);
            } elseif ($a['action'] === 'delete' && !$def::VERSIONED) {
                $db->run("UPDATE `$table` SET deleted_at = NULL, deleted_by = NULL, delete_batch_id = NULL WHERE id = ?", [$row['id']]);
            } elseif ($a['action'] === 'delete') {
                $db->run(
                    "UPDATE `$table` SET deleted_at = NULL, deleted_by = NULL, delete_batch_id = NULL, version = version + 1, updated_at = ?, updated_by = ? WHERE id = ?",
                    [$now, $user['id'] ?? null, $row['id']],
                );
            } else {
                // Put back the business fields the action changed (never ids, versions or stamps).
                $set = [];
                $params = [];
                foreach ($before as $col => $val) {
                    if (in_array($col, ['id', 'public_id', 'client_uuid', 'version', 'created_at', 'created_by', 'updated_at', 'updated_by'], true)
                        || !array_key_exists($col, $row) || Versioned::same($row[$col], $val) || !preg_match('/^[a-z_]+$/', (string) $col)) {
                        continue;
                    }
                    $set[] = "`$col` = ?";
                    $params[] = $val;
                }
                if ($set === []) {
                    continue;
                }
                $db->run("UPDATE `$table` SET " . implode(', ', $set) . ', version = version + 1, updated_at = ?, updated_by = ? WHERE id = ?',
                    [...$params, $now, $user['id'] ?? null, $row['id']]);
            }
            $after = $db->one("SELECT * FROM `$table` WHERE id = ?", [$row['id']]);
            AuditLog::record($app, $db, $request, [
                'action' => 'undo', 'entity_type' => $def::TYPE, 'entity_id' => (int) $row['id'],
                'entity_version' => $def::VERSIONED ? (int) $after['version'] : null, 'batch_id' => $undoBatch['id'], 'before' => $row, 'after' => $after,
            ]);
            if ($def::IN_ACTIVITY) {
                $out['undone']++;
            }
        }
        ChangeBatches::setCount($db, $undoBatch['id'], $out['undone']);
        return $out;
    }

    /** @param class-string<EntityDef> $def */
    public static function table(string $def): string
    {
        $t = $def::TABLE;
        if (!preg_match('/^[a-z_]+$/', $t)) {
            throw new \LogicException('Bad table name');
        }
        return $t;
    }

    private static function assertColumn(string $c): void
    {
        if (!preg_match('/^[a-z_]+$/', $c)) {
            throw new \LogicException("Bad column $c");
        }
    }
}
