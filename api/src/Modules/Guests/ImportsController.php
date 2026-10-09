<?php
declare(strict_types=1);

namespace AM\Modules\Guests;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Db\UnitOfWork;
use AM\Http\BaseController;
use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\RateLimiter;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Kernel\Strings;
use AM\Kernel\Ulid;
use AM\Repo\BaseRepository;
use AM\Repo\Cursor;
use AM\Repo\Refs;
use AM\Safety\AuditLog;
use AM\Safety\ChangeBatches;

/**
 * Guest import (FEATURES A8, API.md §6.7). The phone reads the file and sends rows.
 * Preview writes nothing. The run is one transaction and one batch; "Undo this
 * import" reverts it any time, keeping families edited since (AC-IMP-05).
 * Admins only (decision 31).
 */
final class ImportsController
{
    public const MAX_BODY = 5 * 1024 * 1024;
    private const FILL = ['phone', 'alt_phone', 'group_name', 'relation', 'area', 'city', 'address', 'notes'];

    /** POST /imports/preview */
    public static function preview(Request $request, App $app, array $params): Response
    {
        [$rows, $defaults] = self::input($request, $app);
        $checked = ImportRows::check($app->db(), $rows, $defaults, self::city($app));
        $counts = ['new' => 0, 'duplicates' => 0, 'errors' => 0, 'skipped_examples' => 0];
        foreach ($checked as $c) {
            $counts[match ($c['status']) { 'new' => 'new', 'duplicate' => 'duplicates', 'error' => 'errors', default => 'skipped_examples' }]++;
        }
        return Response::ok([
            'counts' => $counts,
            'rows' => array_map(static fn ($c) => array_diff_key($c, ['event_db_ids' => 1]), $checked),
        ]);
    }

    /** POST /imports — each row's decision: add, skip, add_anyway, update_existing (+ update_target_id). */
    public static function run(Request $request, App $app, array $params): Response
    {
        [$rows, $defaults, $body] = self::input($request, $app);
        $db = $app->db();
        $checked = ImportRows::check($db, $rows, $defaults, self::city($app));
        $plan = [];
        $problems = [];
        foreach ($checked as $i => $c) {
            $decision = is_string($rows[$i]['decision'] ?? null) ? $rows[$i]['decision'] : null;
            $decision ??= match ($c['status']) { 'new' => 'add', 'error' => null, default => 'skip' };
            if ($c['status'] === 'skipped_example') {
                $decision = 'skip';
            }
            if (!in_array($decision, ['add', 'skip', 'add_anyway', 'update_existing'], true)) {
                $problems["rows.{$c['row_no']}"] = Strings::get('import_has_errors');
                continue;
            }
            if ($decision !== 'skip' && $c['status'] === 'error') {
                $problems["rows.{$c['row_no']}"] = implode(' ', $c['errors']);
                continue;
            }
            $target = null;
            if ($decision === 'update_existing') {
                $tid = $rows[$i]['update_target_id'] ?? null;
                $ids = array_filter(array_column($c['matches'], 'id'));
                if (!is_string($tid) || !in_array($tid, $ids, true)) {
                    $problems["rows.{$c['row_no']}"] = Strings::get('import_bad_target');
                    continue;
                }
                $target = $tid;
            }
            $plan[] = ['check' => $c, 'decision' => $decision, 'target' => $target];
        }
        if ($problems !== []) {
            throw new HttpError(422, 'validation_failed', Strings::get('import_has_errors'), ['fields' => $problems]); // nothing is imported
        }

        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $plan, $body, $checked): Response {
            $key = (string) $request->attr('idem_key');
            $old = $key !== '' ? $db->one('SELECT * FROM imports WHERE client_uuid = ?', [$key]) : null;
            if ($old !== null) { // a retry after the reply was lost: the same import, not a second one
                return Response::ok(ImportDef::present($app, $db, new Refs($db, $app->clock->todayIst()), $old, $request->attr('user')), 200);
            }
            $label = ImportDef::name(['file_name' => $body['file_name'], 'source' => $body['source']]);
            $batch = ChangeBatches::create($app, $db, $request, 'import', 'household', "Imported $label");
            $counts = ['created' => 0, 'updated' => 0, 'skipped' => 0, 'errors' => 0, 'invitations' => 0];
            $events = [];
            foreach ($db->all('SELECT * FROM events WHERE deleted_at IS NULL') as $e) {
                $events[(int) $e['id']] = $e;
            }
            foreach ($plan as $p) {
                $c = $p['check'];
                $n = $c['normalised'];
                if ($p['decision'] === 'skip') {
                    $counts[$c['status'] === 'error' ? 'errors' : 'skipped']++;
                    continue;
                }
                if ($p['decision'] === 'update_existing') {
                    $h = BaseRepository::find($db, HouseholdDef::class, $p['target'], true, false);
                    $fill = [];
                    foreach (self::FILL as $col) {
                        if (($h[$col] === null || $h[$col] === '') && $n[$col] !== null) {
                            $fill[$col] = $n[$col]; // empty fields only, never overwrite (AC-IMP-04)
                        }
                    }
                    if ($fill !== []) {
                        self::update($app, $db, $request, $h, $fill, $batch['id']);
                        $h = $db->one('SELECT * FROM households WHERE id = ?', [$h['id']]);
                    }
                    $invited = self::invite($app, $db, $request, $h, $c['event_db_ids'], $events, $batch['id']);
                    $counts['invitations'] += $invited;
                    $counts[$fill !== [] || $invited > 0 ? 'updated' : 'skipped']++;
                    continue;
                }
                $values = array_intersect_key($n, array_flip(['name', 'phone', 'alt_phone', 'side', 'group_name', 'relation', 'area', 'city', 'address',
                    'adults', 'children', 'food', 'jain_count', 'notes']));
                $values['is_vip'] = (int) $n['is_vip'];
                $values['name_norm'] = HouseholdDef::normName($n['name']);
                $h = self::insert($app, $db, $request, $values, $batch['id']);
                $counts['created']++;
                $counts['invitations'] += self::invite($app, $db, $request, $h, $c['event_db_ids'], $events, $batch['id']);
            }
            $user = $request->attr('user');
            $now = $app->clock->dbNow();
            $db->run(
                'INSERT INTO imports (public_id, client_uuid, batch_id, source, file_name, rows_read, created_count, updated_count, skipped_count, error_count,
                   invitations_count, version, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)',
                [Ulid::generate($app->clock), $key !== '' ? $key : null, $batch['id'], $body['source'], $body['file_name'], count($checked),
                    $counts['created'], $counts['updated'], $counts['skipped'], $counts['errors'], $counts['invitations'], $now, $user['id'], $now, $user['id']],
            );
            $imp = $db->one('SELECT * FROM imports WHERE id = ?', [(int) $db->pdo->lastInsertId()]);
            $note = "{$counts['created']} added · {$counts['updated']} updated · {$counts['skipped']} skipped";
            AuditLog::record($app, $db, $request, [
                'action' => 'import', 'entity_type' => 'import', 'entity_id' => (int) $imp['id'], 'entity_version' => 1,
                'batch_id' => $batch['id'], 'after' => $imp, 'note' => $note,
            ]);
            $summary = "Imported {$counts['created']} families from $label";
            $db->run('UPDATE change_batches SET summary = ?, item_count = ? WHERE id = ?', [mb_substr($summary, 0, 200), $counts['created'] + $counts['updated'], $batch['id']]);
            $view = ImportDef::present($app, $db, new Refs($db, $app->clock->todayIst()), $imp, $user);
            return Response::ok($view, 201, ['undo' => BaseController::undoMeta($app, $batch['public_id'], $summary)]);
        });
    }

    /** GET /imports — Settings → Imports. */
    public static function list(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireAdmin($viewer);
        $db = $app->db();
        $cursor = new Cursor('imports');
        $limit = Cursor::limit($request, 20);
        $take = $limit + 1;
        $rows = $db->all("SELECT * FROM imports WHERE id < ? ORDER BY id DESC LIMIT $take", [$cursor->before($request)]);
        [$rows, $meta] = $cursor->page($rows, $limit);
        $refs = new Refs($db, $app->clock->todayIst());
        return Response::ok(array_map(static fn ($r) => ImportDef::present($app, $db, $refs, $r, $viewer), $rows), 200, $meta);
    }

    public static function get(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireAdmin($viewer);
        $db = $app->db();
        $row = BaseRepository::find($db, ImportDef::class, $params['id']);
        return Response::ok(ImportDef::present($app, $db, new Refs($db, $app->clock->todayIst()), $row, $viewer));
    }

    /** POST /imports/{id}/undo — no 10-minute limit; families edited since are kept and listed. */
    public static function undo(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireAdmin($viewer);
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $params): Response {
            $imp = BaseRepository::find($db, ImportDef::class, $params['id'], true);
            $batch = $db->one('SELECT * FROM change_batches WHERE id = ? FOR UPDATE', [$imp['batch_id']]);
            $r = BaseRepository::undo($app, $db, $request, $batch);
            $n = count($r['skipped']);
            $message = $r['already_undone'] ? Strings::get('already_undone')
                : ($n === 0 ? Strings::get('undo_done') : "Undone. $n " . ($n === 1 ? 'family was changed since and was kept.' : 'families were changed since and were kept.'));
            return Response::ok([
                'batch_id' => $batch['public_id'], 'undone' => $r['undone'], 'skipped' => $r['skipped'],
                'message' => $message, 'already_undone' => $r['already_undone'],
            ]);
        });
    }

    /** @return array{0: list<array>, 1: array, 2: array} */
    private static function input(Request $request, App $app): array
    {
        $viewer = $request->attr('user');
        Permissions::requireAdmin($viewer);
        $body = $request->attr('json');
        if (!is_array($body)) {
            throw HttpError::make(422, 'validation_failed', [], ['fields' => []]);
        }
        $fields = [];
        $source = $body['source'] ?? null;
        if (!in_array($source, ['xlsx', 'csv', 'paste', 'vcf'], true)) {
            $fields['source'] = Strings::get('field_bad_choice');
        }
        $rows = $body['rows'] ?? null;
        if (!is_array($rows) || !array_is_list($rows) || $rows === []) {
            $fields['rows'] = Strings::get('field_required');
        } elseif (count($rows) > ImportRows::MAX) {
            throw new HttpError(422, 'validation_failed', Strings::get('import_too_many'), ['fields' => ['rows' => Strings::get('import_too_many')]]);
        }
        $defaults = is_array($body['defaults'] ?? null) ? $body['defaults'] : [];
        $fileName = is_string($body['file_name'] ?? null) ? mb_substr(trim(basename($body['file_name'])), 0, 255) : null;
        if ($fields !== []) {
            throw new HttpError(422, 'validation_failed', Strings::get(count($fields) === 1 ? 'validation_failed_one' : 'validation_failed', ['n' => count($fields)]), ['fields' => $fields]);
        }
        (new RateLimiter($app))->hit('bulk:user:' . $viewer['id'], 10, 600); // API.md §10.1: bulk, preview and import share 10 per 10 min
        return [$rows, $defaults, ['source' => $source, 'file_name' => $fileName === '' ? null : $fileName]];
    }

    private static function city(App $app): string
    {
        return (string) ($app->db()->value('SELECT city FROM settings WHERE id = 1') ?? '');
    }

    private static function insert(App $app, Db $db, Request $request, array $values, int $batchId): array
    {
        $user = $request->attr('user');
        $now = $app->clock->dbNow();
        $values += ['public_id' => Ulid::generate($app->clock), 'version' => 1, 'created_at' => $now, 'created_by' => $user['id'], 'updated_at' => $now, 'updated_by' => $user['id']];
        $cols = array_keys($values);
        $db->run('INSERT INTO households (`' . implode('`, `', $cols) . '`) VALUES (' . implode(', ', array_fill(0, count($cols), '?')) . ')', array_values($values));
        $row = $db->one('SELECT * FROM households WHERE id = ?', [(int) $db->pdo->lastInsertId()]);
        AuditLog::record($app, $db, $request, [
            'action' => 'create', 'entity_type' => 'household', 'entity_id' => (int) $row['id'], 'entity_version' => 1, 'batch_id' => $batchId, 'after' => $row,
        ]);
        return $row;
    }

    private static function update(App $app, Db $db, Request $request, array $h, array $fill, int $batchId): void
    {
        $set = [];
        $args = [];
        foreach ($fill as $col => $v) {
            $set[] = "`$col` = ?"; // columns from self::FILL, never from the request
            $args[] = $v;
        }
        $db->run('UPDATE households SET ' . implode(', ', $set) . ', version = version + 1, updated_at = ?, updated_by = ? WHERE id = ?',
            [...$args, $app->clock->dbNow(), $request->attr('user')['id'], $h['id']]);
        $after = $db->one('SELECT * FROM households WHERE id = ?', [$h['id']]);
        AuditLog::record($app, $db, $request, [
            'action' => 'update', 'entity_type' => 'household', 'entity_id' => (int) $h['id'], 'entity_version' => (int) $after['version'],
            'batch_id' => $batchId, 'before' => $h, 'after' => $after,
        ]);
    }

    /** @param list<int> $eventIds @return int invitations made */
    private static function invite(App $app, Db $db, Request $request, array $h, array $eventIds, array $events, int $batchId): int
    {
        $n = 0;
        foreach ($eventIds as $eid) {
            if (isset($events[$eid]) && Invitations::invite($app, $db, $request, $h, $events[$eid], [], $batchId, false)['status'] !== 'unchanged') {
                $n++;
            }
        }
        return $n;
    }
}
