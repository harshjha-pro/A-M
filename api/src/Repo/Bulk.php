<?php
declare(strict_types=1);

namespace AM\Repo;

use AM\Db\Db;
use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Request;
use AM\Kernel\Strings;
use AM\Safety\AuditLog;
use AM\Validation\Fields;
use DateTimeImmutable;
use DateTimeZone;

/**
 * Shared pieces of the bulk endpoints (families 1.0.10, tasks / vendors / payments 1.0.24):
 * `as_of` (rows changed after the phone loaded the list are skipped), the ids list, and one
 * version-bumped, audited change inside a batch so Undo can put it back.
 */
final class Bulk
{
    /** as_of: when the phone loaded the list (ISO with Z or offset) → UTC "Y-m-d H:i:s". */
    public static function asOf(Fields $f): string
    {
        $v = $f->raw('as_of', true, 40);
        if ($v !== null && preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/', $v)) {
            try {
                return (new DateTimeImmutable($v))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
            } catch (\Exception) {
                // fall through
            }
        }
        if ($v !== null) {
            $f->error('as_of', Strings::get('field_bad_datetime'));
        }
        return '1970-01-01 00:00:00';
    }

    /** Public ids from `ids` (required, ≤ $max) → internal ids of live-or-deleted rows, in $order. @return list<int> */
    public static function ids(Db $db, Fields $f, string $table, int $max, string $order = 'id'): array
    {
        $ids = $f->value('ids');
        if (!is_array($ids) || !array_is_list($ids) || $ids === []) {
            $f->error('ids', Strings::get('field_required'));
            $f->fail();
        }
        $ids = array_values(array_unique(array_filter($ids, static fn ($x) => is_string($x) && preg_match('/^[0-9A-HJKMNP-TV-Z]{26}$/', $x))));
        if (count($ids) > $max) {
            throw new HttpError(422, 'validation_failed', Strings::get('bulk_too_many_n', ['max' => number_format($max)]), ['fields' => ['ids' => Strings::get('bulk_too_many_n', ['max' => number_format($max)])]]);
        }
        if ($ids === []) {
            return [];
        }
        $in = implode(',', array_fill(0, count($ids), '?'));
        return array_map('intval', array_column($db->all("SELECT id FROM `$table` WHERE public_id IN ($in) ORDER BY $order", $ids), 'id'));
    }

    /** One version-bumped, audited change inside the batch (so Undo can put it back). */
    public static function setColumns(App $app, Db $db, Request $request, string $table, string $type, array $row, array $changes, int $batchId, array $extraBefore = [], array|\Closure $extraAfter = []): array
    {
        $set = [];
        $args = [];
        foreach ($changes as $col => $v) {
            if (!preg_match('/^[a-z_]+$/', (string) $col)) {
                throw new \LogicException('Bad column');
            }
            $set[] = "`$col` = ?";
            $args[] = $v;
        }
        $user = $request->attr('user');
        $db->run("UPDATE `$table` SET " . ($set === [] ? '' : implode(', ', $set) . ', ') . 'version = version + 1, updated_at = ?, updated_by = ? WHERE id = ?',
            [...$args, $app->clock->dbNow(), $user['id'] ?? null, $row['id']]);
        $after = $db->one("SELECT * FROM `$table` WHERE id = ?", [$row['id']]);
        AuditLog::record($app, $db, $request, [
            'action' => 'update', 'entity_type' => $type, 'entity_id' => (int) $row['id'],
            'entity_version' => (int) $after['version'], 'batch_id' => $batchId, 'before' => $row + $extraBefore, 'after' => $after + ($extraAfter instanceof \Closure ? $extraAfter() : $extraAfter),
        ]);
        return $after;
    }
}
