<?php
declare(strict_types=1);

namespace AM\Repo;

use AM\Db\Db;
use AM\Db\UnitOfWork;
use AM\Http\BaseController;
use AM\Kernel\Csv;
use AM\Kernel\Response;
use AM\Safety\ChangeBatches;
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

    /**
     * The usual bulk loop: one batch; each target row is locked, skipped when deleted or changed
     * after `as_of`, else handed to $apply (true = changed, a string = skipped with that reason,
     * null = nothing to do). The batch summary then carries the changed count.
     * @param list<int> $ids
     * @param \Closure(int):string $summaryFor
     * @param \Closure(Db, array, int):(bool|string|null) $apply  ($db, $row, $batchId)
     */
    public static function run(App $app, Request $request, string $table, string $type, string $nameCol, array $ids, string $asOf,
        string $batchAction, \Closure $summaryFor, \Closure $apply): Response
    {
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $table, $type, $nameCol, $ids, $asOf, $batchAction, $summaryFor, $apply): Response {
            $batch = ChangeBatches::create($app, $db, $request, $batchAction, $type, $summaryFor(count($ids)));
            $refs = new Refs($db, $app->clock->todayIst());
            $affected = 0;
            $skipped = [];
            foreach ($ids as $id) {
                $row = $db->one("SELECT * FROM `$table` WHERE id = ? FOR UPDATE", [$id]);
                if ($row === null) {
                    continue;
                }
                $reason = null;
                $by = null;
                if ($row['deleted_at'] !== null) {
                    [$reason, $by] = ['deleted', $row['deleted_by']];
                } elseif ($row['updated_at'] > $asOf) {
                    [$reason, $by] = ['changed_since_loaded', $row['updated_by']];
                } else {
                    $r = $apply($db, $row, (int) $batch['id']);
                    if ($r === true) {
                        $affected++;
                    } elseif (is_string($r)) {
                        $reason = $r;
                    }
                }
                if ($reason !== null) {
                    $skipped[] = ['id' => $row['public_id'], 'name' => $row[$nameCol], 'reason' => $reason, 'changed_by' => $refs->user($by !== null ? (int) $by : null)];
                }
            }
            ChangeBatches::setCount($db, $batch['id'], $affected);
            $summary = $summaryFor($affected);
            $db->run('UPDATE change_batches SET summary = ? WHERE id = ?', [mb_substr($summary, 0, 200), $batch['id']]);
            $meta = $affected > 0 ? ['undo' => BaseController::undoMeta($app, $batch['public_id'], $summary)] : [];
            return Response::ok(['affected' => $affected, 'skipped' => $skipped, 'batch_id' => $batch['public_id']], 200, $meta);
        });
    }

    /** `?ids=a,b,c` for an export of chosen rows (required, ≤ $max). @return list<string> public ids */
    public static function exportIds(Request $request, int $max): array
    {
        $ids = array_values(array_unique(array_filter(explode(',', (string) ($request->query['ids'] ?? '')), static fn ($x) => preg_match('/^[0-9A-HJKMNP-TV-Z]{26}$/', $x))));
        if ($ids === [] || count($ids) > $max) {
            throw new HttpError(422, 'validation_failed', Strings::get('bulk_too_many_n', ['max' => number_format($max)]), ['fields' => ['ids' => Strings::get('field_required')]]);
        }
        return $ids;
    }

    /** A CSV download (UTF-8 BOM, CRLF, formula-safe cells); the export itself is audited. @param list<list<mixed>> $rows header first */
    public static function csv(App $app, Request $request, string $type, string $what, array $rows, string $file): Response
    {
        $count = count($rows) - 1;
        UnitOfWork::run($app, $request, static function (Db $db) use ($app, $request, $type, $what, $count): Response {
            AuditLog::record($app, $db, $request, ['action' => 'export', 'entity_type' => $type, 'note' => "$count $what as CSV"]);
            return Response::ok(null);
        });
        $r = new Response(200);
        $r->body = Csv::BOM . implode("\r\n", array_map(static fn ($cells) => Csv::line($cells), $rows)) . "\r\n";
        $r->headers['Content-Type'] = 'text/csv; charset=utf-8';
        $r->headers['Content-Disposition'] = 'attachment; filename="' . $file . '_' . $app->clock->todayIst() . '.csv"';
        $r->headers['Cache-Control'] = 'no-store';
        return $r;
    }
}
