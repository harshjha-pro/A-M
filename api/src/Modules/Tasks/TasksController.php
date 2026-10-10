<?php
declare(strict_types=1);

namespace AM\Modules\Tasks;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Db\UnitOfWork;
use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Kernel\Strings;
use AM\Http\BaseController;
use AM\Repo\BaseRepository;
use AM\Repo\Cursor;
use AM\Repo\Refs;
use AM\Repo\Versioned;
use AM\Safety\AuditLog;
use AM\Safety\ChangeBatches;
use AM\Validation\Fields;
use DateTimeImmutable;
use DateTimeZone;

/** /tasks (API.md §6.5, FEATURES B3). Writes go through the shared base code. */
final class TasksController
{
    public const VIEWS = ['mine', 'all', 'today', 'week', 'overdue', 'no_date', 'closed'];
    public const QUERY = ['view', 'status', 'event', 'tag', 'assignee', 'priority', 'vendor', 'household', 'q', 'sort', 'limit', 'cursor'];

    /* ------------------------------------------------------------------ list */

    public static function list(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        $db = $app->db();
        $q = $request->query;
        $view = $q['view'] ?? (($viewer['role'] ?? '') === 'family' ? 'mine' : 'all');
        if (!in_array($view, self::VIEWS, true)) {
            throw HttpError::make(400, 'bad_request');
        }
        $sort = $q['sort'] ?? 'default';
        $orders = [
            'default' => 'overdue DESC, t.due_date IS NULL, t.due_date, t.due_time IS NULL, t.due_time, t.priority, t.id DESC',
            'due_date' => 't.due_date IS NULL, t.due_date, t.due_time IS NULL, t.due_time, t.id DESC',
            '-created_at' => 't.id DESC',
            'title' => 't.title, t.id DESC',
        ];
        if (!isset($orders[$sort])) {
            throw HttpError::make(400, 'bad_request');
        }
        [$today, $now] = TaskView::istNow($app);
        [$where, $args] = self::filters($db, $q, (int) $viewer['id']);
        $filterArgs = $args;
        [$vw, $va] = self::viewSql($view, (int) $viewer['id'], $today, $now);
        $cursor = new Cursor('tasks', array_diff_key($q, ['cursor' => 1, 'limit' => 1]) + ['view' => $view]);
        $limit = Cursor::limit($request);
        $offset = $cursor->offset($request);
        [$od, $oa] = self::overdueSql($today, $now);
        $base = 'FROM tasks t WHERE t.deleted_at IS NULL' . ($where ? ' AND ' . implode(' AND ', $where) : '');
        $take = $limit + 1;
        $rows = $db->all(
            "SELECT t.*, ($od) AS overdue $base AND $vw ORDER BY {$orders[$sort]} LIMIT $take OFFSET $offset",
            [...$oa, ...$args, ...$va],
        );
        [$rows, $meta] = $cursor->pageOffset($rows, $limit, $offset);
        $meta['total'] = (int) $db->value("SELECT COUNT(*) $base AND $vw", [...$args, ...$va]);
        $meta['view'] = $view;
        $meta['chip_counts'] = [];
        foreach (['mine', 'today', 'week', 'overdue', 'no_date'] as $chip) {
            [$cw, $ca] = self::viewSql($chip, (int) $viewer['id'], $today, $now);
            $meta['chip_counts'][$chip] = (int) $db->value("SELECT COUNT(*) $base AND $cw", [...$filterArgs, ...$ca]);
        }
        $refs = new Refs($db, $app->clock->todayIst());
        return Response::ok(TaskView::summaries($app, $db, $refs, $rows), 200, $meta);
    }

    /** @return array{0:string, 1:list<mixed>} */
    private static function overdueSql(string $today, string $now): array
    {
        return ["t.status IN ('todo','doing','waiting') AND t.due_date IS NOT NULL AND (t.due_date < ? OR (t.due_date = ? AND t.due_time IS NOT NULL AND t.due_time < ?))",
            [$today, $today, $now . ':00']];
    }

    /** @return array{0:string, 1:list<mixed>} */
    private static function viewSql(string $view, int $me, string $today, string $now): array
    {
        $open = "t.status IN ('todo','doing','waiting')";
        $mon = (new DateTimeImmutable($today, new DateTimeZone('Asia/Kolkata')))->modify('monday this week')->format('Y-m-d');
        $sun = (new DateTimeImmutable($mon))->modify('+6 days')->format('Y-m-d');
        return match ($view) {
            'all' => ["t.status <> 'cancelled'", []],
            'mine' => ["t.status <> 'cancelled' AND EXISTS (SELECT 1 FROM task_assignees a WHERE a.task_id = t.id AND a.user_id = ? AND a.deleted_at IS NULL)", [$me]],
            'today' => ["$open AND t.due_date = ?", [$today]],
            'week' => ["$open AND t.due_date BETWEEN ? AND ?", [$mon, $sun]],
            'overdue' => ['(' . self::overdueSql($today, $now)[0] . ')', self::overdueSql($today, $now)[1]],
            'no_date' => ["$open AND t.due_date IS NULL", []],
            'closed' => ["t.status IN ('done','cancelled')", []],
        };
    }

    /** @return array{0:list<string>, 1:list<mixed>} */
    private static function filters(Db $db, array $q, int $me): array
    {
        $w = [];
        $a = [];
        if (isset($q['status'])) {
            if (!isset(TaskDef::STATUS[$q['status']])) {
                throw HttpError::make(400, 'bad_request');
            }
            $w[] = 't.status = ?';
            $a[] = $q['status'];
        }
        if (isset($q['priority'])) {
            if (!isset(TaskDef::PRIORITY[$q['priority']])) {
                throw HttpError::make(400, 'bad_request');
            }
            $w[] = 't.priority = ?';
            $a[] = $q['priority'];
        }
        foreach (['event' => ['event_id', 'events'], 'vendor' => ['vendor_id', 'vendors'], 'household' => ['household_id', 'households']] as $k => [$col, $table]) {
            if (isset($q[$k])) {
                $w[] = "t.$col = (SELECT id FROM $table WHERE public_id = ?)";
                $a[] = $q[$k];
            }
        }
        if (isset($q['tag'])) {
            $w[] = 'EXISTS (SELECT 1 FROM task_tags tt JOIN tags g ON g.id = tt.tag_id WHERE tt.task_id = t.id AND tt.deleted_at IS NULL AND g.public_id = ?)';
            $a[] = $q['tag'];
        }
        if (isset($q['assignee'])) {
            $w[] = 'EXISTS (SELECT 1 FROM task_assignees aa JOIN users u ON u.id = aa.user_id WHERE aa.task_id = t.id AND aa.deleted_at IS NULL AND u.public_id = ?)';
            $a[] = $q['assignee'];
        }
        if (isset($q['q']) && trim($q['q']) !== '') {
            $w[] = 't.title LIKE ?';
            $a[] = '%' . addcslashes(trim($q['q']), '%_\\') . '%';
        }
        return [$w, $a];
    }

    /* ---------------------------------------------------------------- one */

    public static function get(Request $request, App $app, array $params): Response
    {
        $db = $app->db();
        $row = BaseRepository::find($db, TaskDef::class, $params['id'], false, false);
        $view = TaskView::full($app, $db, new Refs($db, $app->clock->todayIst()), $row);
        return Response::ok($view)->withHeader('ETag', '"' . $view['version'] . '"');
    }

    /* -------------------------------------------------------------- create */

    public static function create(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireEditor($viewer);
        $db = $app->db();
        $f = Fields::from($request->attr('json'));
        $in = TaskWriter::read($app, $db, $f, true, null);
        $f->fail();
        $allowDup = ($request->attr('json')['allow_duplicate'] ?? false) === true;
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $viewer, $in, $allowDup): Response {
            $refs = new Refs($db, $app->clock->todayIst());
            $existing = $db->one('SELECT * FROM tasks WHERE client_uuid = ?', [(string) $request->attr('idem_key')]);
            if ($existing !== null) { // the same save, retried after 48 h (DS-08)
                $view = TaskView::full($app, $db, $refs, $existing);
                return Response::ok($view, 200)->withHeader('ETag', '"' . $view['version'] . '"');
            }
            if (!$allowDup && ($similar = TaskWriter::similarOpen($db, (string) $in['columns']['title'])) !== null) {
                throw new HttpError(409, 'duplicate_found', Strings::get('task_duplicate', ['name' => $similar['title']]), [
                    'matches' => [['id' => $similar['public_id'], 'name' => $similar['title']]],
                ]);
            }
            $c = $in['columns'];
            if (($c['status'] ?? 'todo') === 'done') {
                $c['completed_at'] = $app->clock->dbNow();
                $c['completed_by'] = $viewer['id'];
            }
            $row = BaseRepository::create($app, $db, $request, TaskDef::class, $c)['row'];
            $id = (int) $row['id'];
            TaskWriter::syncLinks($app, $db, $request, $id, 'task_assignees', 'user_id', $in['assignees'] ?? [(int) $viewer['id']]);
            $tags = array_values(array_unique([...($in['tags'] ?? []), ...TaskWriter::createTags($app, $db, $request, $in['new_tags'])]));
            TaskWriter::syncLinks($app, $db, $request, $id, 'task_tags', 'tag_id', $tags);
            foreach ($in['items'] ?? [] as $it) {
                if ($db->value('SELECT 1 FROM task_items WHERE client_uuid = ?', [$it['key']]) === null) {
                    TaskWriter::insertItem($app, $db, $request, $id, $it);
                }
            }
            $view = TaskView::full($app, $db, $refs, $row);
            return Response::ok($view, 201)->withHeader('ETag', '"1"');
        });
    }

    /* -------------------------------------------------------------- update */

    public static function update(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireEditor($viewer);
        $expected = Versioned::ifMatch($request);
        $f = Fields::from($request->attr('json'));
        if ($f->keys() === []) {
            throw HttpError::make(422, 'validation_failed', [], ['fields' => []]);
        }
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $params, $viewer, $expected, $f): Response {
            $row = BaseRepository::find($db, TaskDef::class, $params['id'], true);
            $in = TaskWriter::read($app, $db, $f, false, $row);
            $f->fail();
            $c = $in['columns'];
            $note = null;
            // A later due date is a postpone (FEATURES B3); an earlier one is a normal edit.
            if (array_key_exists('due_date', $c) && $row['due_date'] !== null && $c['due_date'] !== null && $c['due_date'] > $row['due_date']) {
                $c['postpone_count'] = (int) $row['postpone_count'] + 1;
                $note = TaskWriter::postponeNote($row['due_date'], $c['due_date']);
            }
            if (isset($c['status']) && $c['status'] !== $row['status']) {
                $c['completed_at'] = $c['status'] === 'done' ? $app->clock->dbNow() : null;
                $c['completed_by'] = $c['status'] === 'done' ? $viewer['id'] : null;
            }
            $id = (int) $row['id'];
            $beforeNames = TaskWriter::names($db, $id);
            $newTagIds = $in['new_tags'] !== [] ? TaskWriter::createTags($app, $db, $request, $in['new_tags']) : [];
            $wantTags = $in['tags'] !== null || $newTagIds !== []
                ? array_values(array_unique([...($in['tags'] ?? TaskWriter::linked($db, $id, 'task_tags', 'tag_id')), ...$newTagIds])) : null;
            $listsChange = ($in['assignees'] !== null && self::sorted($in['assignees']) !== TaskWriter::linked($db, $id, 'task_assignees', 'user_id'))
                || ($wantTags !== null && self::sorted($wantTags) !== TaskWriter::linked($db, $id, 'task_tags', 'tag_id'))
                || ($in['items'] !== null && self::itemsDiffer($db, $id, $in['items']));
            $refs = new Refs($db, $app->clock->todayIst());
            $present = static fn (array $x) => TaskView::full($app, $db, $refs, $x);
            $r = Versioned::update($app, $db, $request, 'tasks', 'task', $id, $expected, $c, $present, true, $listsChange);
            if ($in['assignees'] !== null) {
                TaskWriter::syncLinks($app, $db, $request, $id, 'task_assignees', 'user_id', $in['assignees']);
            }
            if ($wantTags !== null) {
                TaskWriter::syncLinks($app, $db, $request, $id, 'task_tags', 'tag_id', $wantTags);
            }
            if ($in['items'] !== null) {
                TaskWriter::syncItems($app, $db, $request, $r['after'], $in['items']);
            }
            if ($r['changed'] !== [] || $listsChange) {
                AuditLog::record($app, $db, $request, [
                    'action' => 'update', 'entity_type' => 'task', 'entity_id' => $id, 'entity_version' => (int) $r['after']['version'],
                    'before' => $r['before'] + $beforeNames, 'after' => $r['after'] + TaskWriter::names($db, $id), 'note' => $note,
                ]);
            }
            $view = TaskView::full($app, $db, $refs, $db->one('SELECT * FROM tasks WHERE id = ?', [$id]));
            return Response::ok($view)->withHeader('ETag', '"' . $view['version'] . '"');
        });
    }

    private static function sorted(array $ids): array
    {
        sort($ids);
        return array_values($ids);
    }

    private static function itemsDiffer(Db $db, int $taskId, array $want): bool
    {
        $live = [];
        foreach ($db->all('SELECT client_uuid, text, is_done, sort_order FROM task_items WHERE task_id = ? AND deleted_at IS NULL', [$taskId]) as $r) {
            $live[$r['client_uuid']] = [$r['text'], (int) $r['is_done'], (int) $r['sort_order']];
        }
        if (count($live) !== count($want)) {
            return true;
        }
        foreach ($want as $it) {
            if (($live[$it['key']] ?? null) !== [$it['text'], (int) $it['is_done'], $it['sort_order']]) {
                return true;
            }
        }
        return false;
    }

    /* ---------------------------------------------------------------- done */

    /** POST /tasks/{id}/done — any editor; idempotent; Undo for 10 minutes (AC-TASK-07). */
    public static function done(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireEditor($viewer);
        Versioned::ifMatch($request); // required, but a tick never fails on an old version: done is done
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $params, $viewer): Response {
            $row = BaseRepository::find($db, TaskDef::class, $params['id'], true);
            $refs = new Refs($db, $app->clock->todayIst());
            if ($row['deleted_at'] !== null) {
                throw Versioned::deletedError($app, $db, $request, $row);
            }
            if ($row['status'] === 'done') {
                $by = $refs->user($row['completed_by'] !== null ? (int) $row['completed_by'] : null);
                $view = TaskView::full($app, $db, $refs, $row);
                return Response::ok($view, 200, ['already_done' => true, 'done_by' => $by, 'message' => Strings::get('already_done', ['name' => $by['name'] ?? 'someone'])])
                    ->withHeader('ETag', '"' . $view['version'] . '"');
            }
            $batch = ChangeBatches::create($app, $db, $request, 'status_change', 'task', mb_substr('Done: ' . $row['title'], 0, 200));
            $present = static fn (array $x) => TaskView::full($app, $db, $refs, $x);
            $r = Versioned::update($app, $db, $request, 'tasks', 'task', (int) $row['id'], (int) $row['version'],
                ['status' => 'done', 'completed_at' => $app->clock->dbNow(), 'completed_by' => $viewer['id']], $present);
            AuditLog::record($app, $db, $request, [
                'action' => 'update', 'entity_type' => 'task', 'entity_id' => (int) $row['id'], 'entity_version' => (int) $r['after']['version'],
                'batch_id' => $batch['id'], 'before' => $r['before'], 'after' => $r['after'],
            ]);
            ChangeBatches::setCount($db, $batch['id'], 1);
            $view = TaskView::full($app, $db, $refs, $r['after']);
            return Response::ok($view, 200, ['undo' => BaseController::undoMeta($app, $batch['public_id'], 'Done: ' . $row['title'])])
                ->withHeader('ETag', '"' . $view['version'] . '"');
        });
    }

    /* -------------------------------------------------------- delete rules */

    /** canWrite for BaseController::delete/restore: editors pass the first check; Family only their own tasks. */
    public static function canWrite(App $app): \Closure
    {
        return static function (?array $viewer, string $action, ?array $row) use ($app): void {
            Permissions::requireEditor($viewer);
            if ($action === 'delete' && $row !== null && !TaskDef::canDelete($app->db(), $viewer, $row)) {
                throw new HttpError(403, 'forbidden', Strings::get('task_delete_own'));
            }
        };
    }
}
