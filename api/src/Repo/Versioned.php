<?php
declare(strict_types=1);

namespace AM\Repo;

use AM\Db\Db;
use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Request;
use AM\Kernel\Strings;
use AM\Kernel\Time;
use DateTimeImmutable;
use DateTimeZone;

/**
 * Version-checked writes (API.md §4, DATABASE rule 3):
 *   UPDATE … SET <only changed columns>, version = version + 1, updated_by, updated_at
 *   WHERE id = ? AND version = ? [AND deleted_at IS NULL]
 * 0 rows → re-read → 409 version_conflict (with the current record and who
 * changed what) or 409 record_deleted. Table names come from code, never
 * from the request.
 */
final class Versioned
{
    /** If-Match: "3" → 3. Missing or malformed → 428 version_required. */
    public static function ifMatch(Request $request): int
    {
        $h = trim($request->header('if-match'));
        if (preg_match('/^(?:W\/)?"?(\d{1,9})"?$/', $h, $m)) {
            return (int) $m[1];
        }
        throw HttpError::make(428, 'version_required');
    }

    /**
     * @param array<string,mixed> $changes column => new value (only what the user sent)
     * @param callable(array): array $present turns a row into what this user may see (for the 409 body)
     * @return array{before:array, after:array, changed:list<string>}
     */
    public static function update(App $app, Db $db, Request $request, string $table, string $entityType, int $id, int $expected, array $changes, callable $present, bool $softDelete = true): array
    {
        self::assertTable($table);
        $row = $db->one("SELECT * FROM `$table` WHERE id = ? FOR UPDATE", [$id]);
        if ($row === null) {
            throw HttpError::make(404, 'not_found');
        }
        if ($softDelete && $row['deleted_at'] !== null) {
            throw self::deletedError($app, $db, $request, $row);
        }
        if ((int) $row['version'] !== $expected) {
            throw self::conflictError($app, $db, $entityType, $row, $expected, $present);
        }

        $set = [];
        $params = [];
        $changed = [];
        foreach ($changes as $col => $value) {
            if (!array_key_exists($col, $row) || !preg_match('/^[a-z_]+$/', (string) $col)) {
                throw new \LogicException("Unknown column $col");
            }
            if (self::same($row[$col], $value)) {
                continue;
            }
            $set[] = "`$col` = ?";
            $params[] = is_bool($value) ? (int) $value : $value;
            $changed[] = $col;
        }
        if ($changed === []) {
            return ['before' => $row, 'after' => $row, 'changed' => []];
        }
        $user = $request->attr('user');
        $set[] = 'version = version + 1';
        $set[] = 'updated_by = ?';
        $params[] = $user['id'] ?? null;
        $set[] = 'updated_at = ?';
        $params[] = $app->clock->dbNow();
        $params[] = $id;
        $params[] = $expected;
        $stmt = $db->run("UPDATE `$table` SET " . implode(', ', $set) . ' WHERE id = ? AND version = ?', $params);
        if ($stmt->rowCount() !== 1) {
            $now = $db->one("SELECT * FROM `$table` WHERE id = ?", [$id]) ?? $row;
            throw self::conflictError($app, $db, $entityType, $now, $expected, $present);
        }
        $after = $db->one("SELECT * FROM `$table` WHERE id = ?", [$id]);
        return ['before' => $row, 'after' => $after, 'changed' => $changed];
    }

    public static function same(mixed $a, mixed $b): bool
    {
        if ($a === null || $b === null) {
            return $a === $b;
        }
        if (is_bool($b)) {
            $b = (int) $b;
        }
        return (string) $a === (string) $b;
    }

    /** 409 version_conflict with what the 3-way merge needs (API.md §4.2). */
    public static function conflictError(App $app, Db $db, string $entityType, array $row, int $yourVersion, callable $present): HttpError
    {
        $refs = new Refs($db, $app->clock->todayIst());
        $changedFields = [];
        foreach ($db->all(
            'SELECT before_json, after_json FROM audit_log
             WHERE entity_type = ? AND entity_id = ? AND entity_version > ? ORDER BY id',
            [$entityType, $row['id'], $yourVersion],
        ) as $a) {
            $before = json_decode((string) $a['before_json'], true) ?: [];
            $after = json_decode((string) $a['after_json'], true) ?: [];
            foreach ($after as $k => $v) {
                if (!in_array($k, ['version', 'updated_at', 'updated_by'], true) && !self::same($before[$k] ?? null, $v)) {
                    $changedFields[$k] = true;
                }
            }
        }
        $current = $present($row);
        // Never reveal a field the user may not see (money) through the field list either.
        $visible = array_values(array_filter(array_keys($changedFields), static fn ($f) => array_key_exists($f, $current)));
        $by = $refs->user($row['updated_by'] !== null ? (int) $row['updated_by'] : null);
        $name = $by['name'] ?? 'Someone';
        return new HttpError(409, 'version_conflict', Strings::get('version_conflict', [
            'name' => $name, 'time' => self::istTime($row['updated_at']),
        ]), [
            'your_version' => $yourVersion,
            'current_version' => (int) $row['version'],
            'changed_by' => $by,
            'changed_at' => Time::iso($row['updated_at']),
            'changed_fields' => $visible,
            'current' => $current,
        ]);
    }

    public static function deletedError(App $app, Db $db, Request $request, array $row): HttpError
    {
        $refs = new Refs($db, $app->clock->todayIst());
        $by = $refs->user($row['deleted_by'] !== null ? (int) $row['deleted_by'] : null);
        $user = $request->attr('user');
        return new HttpError(409, 'record_deleted', Strings::get('record_deleted', [
            'name' => $by['name'] ?? 'Someone', 'time' => self::istTime($row['deleted_at']),
        ]), [
            'deleted_by' => $by,
            'deleted_at' => Time::iso($row['deleted_at']),
            'can_restore' => in_array($user['role'] ?? '', ['owner', 'partner'], true),
        ]);
    }

    /** "10:42 AM" in India time, for messages. */
    public static function istTime(?string $dbUtc): string
    {
        if ($dbUtc === null) {
            return '';
        }
        return (new DateTimeImmutable($dbUtc, new DateTimeZone('UTC')))->setTimezone(new DateTimeZone('Asia/Kolkata'))->format('g:i A');
    }

    private static function assertTable(string $table): void
    {
        if (!preg_match('/^[a-z_]+$/', $table)) {
            throw new \LogicException('Bad table name');
        }
    }
}
