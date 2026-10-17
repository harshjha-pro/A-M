<?php
declare(strict_types=1);

namespace AM\Modules\Tasks;

use AM\Auth\Permissions;
use AM\Auth\WorkspaceAccess;
use AM\Db\Db;
use AM\Db\UnitOfWork;
use AM\Http\BaseController;
use AM\Kernel\App;
use AM\Kernel\Csv;
use AM\Kernel\HttpError;
use AM\Kernel\RateLimiter;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Kernel\Strings;
use AM\Repo\BaseRepository;
use AM\Repo\Bulk;
use AM\Repo\Refs;
use AM\Safety\AuditLog;
use AM\Safety\ChangeBatches;
use AM\Validation\Fields;

/**
 * POST /tasks/bulk and GET /tasks/export (1.0.24, admin-operations brief §6).
 * One action on up to 500 tasks, one batch, one Undo. Rows changed after `as_of` are skipped
 * and named; only the chosen field changes. Same rules as one task: any editor may change and
 * tick tasks; moving into a workspace follows WorkspaceAccess; Family may delete only tasks they
 * made or are assigned to (others are skipped as "not_yours"). Viewers can't.
 */
final class TaskBulkController
{
    public const MAX = 500;
    public const ACTIONS = ['set_status', 'set_priority', 'set_due', 'set_event', 'set_workspace',
        'add_assignees', 'remove_assignees', 'add_tags', 'remove_tags', 'done', 'delete'];
    /** The value field each action reads (validated by TaskWriter, like a one-task edit). */
    private const FIELD = ['set_status' => 'status', 'set_priority' => 'priority', 'set_due' => 'due_date', 'set_event' => 'event_id',
        'set_workspace' => 'workspace_id', 'add_assignees' => 'assignee_ids', 'remove_assignees' => 'assignee_ids',
        'add_tags' => 'tag_ids', 'remove_tags' => 'tag_ids'];

    public static function run(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireEditor($viewer);
        $json = $request->attr('json');
        $f = Fields::from($json);
        $f->only(['action', 'ids', 'as_of', ...array_values(self::FIELD)]);
        $action = $f->enum('action', self::ACTIONS, true);
        $f->fail();
        if ($action === 'set_workspace' && !WorkspaceAccess::canWrite($viewer)) {
            throw HttpError::make(403, 'forbidden');
        }
        $asOf = Bulk::asOf($f);
        $db = $app->db();
        $value = self::value($app, $db, $f, $action, is_array($json) ? $json : []);
        $f->fail();
        (new RateLimiter($app))->hit('bulk:user:' . $viewer['id'], 10, 600);
        $targets = Bulk::ids($db, $f, 'tasks', self::MAX, 'due_date IS NULL, due_date, id');

        $label = self::label($db, $action, $value);
        $summaryFor = static fn (int $n) => sprintf($label, $n === 1 ? '1 task' : number_format($n) . ' tasks');
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $viewer, $action, $value, $asOf, $targets, $summaryFor): Response {
            $batch = ChangeBatches::create($app, $db, $request, $action === 'delete' ? 'delete' : 'bulk_update', 'task', $summaryFor(count($targets)));
            $refs = new Refs($db, $app->clock->todayIst());
            $affected = 0;
            $skipped = [];
            $skip = static function (array $t, string $reason, ?int $by = null) use (&$skipped, $refs): void {
                $skipped[] = ['id' => $t['public_id'], 'name' => $t['title'], 'reason' => $reason, 'changed_by' => $refs->user($by)];
            };
            foreach ($targets as $id) {
                $t = $db->one('SELECT * FROM tasks WHERE id = ? FOR UPDATE', [$id]);
                if ($t === null) {
                    continue;
                }
                if ($t['deleted_at'] !== null) {
                    $skip($t, 'deleted', $t['deleted_by'] !== null ? (int) $t['deleted_by'] : null);
                    continue;
                }
                if ($t['updated_at'] > $asOf) {
                    $skip($t, 'changed_since_loaded', $t['updated_by'] !== null ? (int) $t['updated_by'] : null);
                    continue;
                }
                $r = self::apply($app, $db, $request, $viewer, $action, $value, $t, (int) $batch['id']);
                if ($r === true) {
                    $affected++;
                } elseif (is_string($r)) {
                    $skip($t, $r);
                }
            }
            ChangeBatches::setCount($db, $batch['id'], $affected);
            $summary = $summaryFor($affected);
            $db->run('UPDATE change_batches SET summary = ? WHERE id = ?', [mb_substr($summary, 0, 200), $batch['id']]);
            $meta = $affected > 0 ? ['undo' => BaseController::undoMeta($app, $batch['public_id'], $summary)] : [];
            return Response::ok(['affected' => $affected, 'skipped' => $skipped, 'batch_id' => $batch['public_id']], 200, $meta);
        });
    }

    /** The validated value for the action (status, date, internal ids …). */
    private static function value(App $app, Db $db, Fields $f, string $action, array $json): mixed
    {
        $key = self::FIELD[$action] ?? null;
        if ($key === null) {
            return null;
        }
        if (!array_key_exists($key, $json) || (in_array($action, ['set_status', 'set_priority'], true) && $json[$key] === null)
            || (str_ends_with($key, '_ids') && (!is_array($json[$key]) || $json[$key] === []))) {
            $f->error($key, Strings::get('bulk_needs_value'));
            return null;
        }
        $f->fail(); // the action's own errors first
        $inner = Fields::from([$key => $json[$key]]);
        $in = TaskWriter::read($app, $db, $inner, false, null);
        $inner->fail(); // same messages as a one-task edit (bad date, unknown event, person who left …)
        return match ($key) {
            'assignee_ids' => $in['assignees'] ?? [],
            'tag_ids' => $in['tags'] ?? [],
            default => $in['columns'][$key] ?? null,
        };
    }

    /** @return true|string|null true = changed, string = skip reason, null = nothing to do */
    private static function apply(App $app, Db $db, Request $request, array $viewer, string $action, mixed $value, array $t, int $batchId): true|string|null
    {
        $id = (int) $t['id'];
        switch ($action) {
            case 'delete':
                if (!TaskDef::canDelete($db, $viewer, $t)) {
                    return 'not_yours';
                }
                BaseRepository::softDeleteInBatch($app, $db, $request, TaskDef::class, $t, $batchId);
                return true;
            case 'done':
            case 'set_status':
                $status = $action === 'done' ? 'done' : $value;
                if ($t['status'] === $status) {
                    return $action === 'done' ? 'already_done' : null;
                }
                $c = ['status' => $status, 'completed_at' => $status === 'done' ? $app->clock->dbNow() : null, 'completed_by' => $status === 'done' ? $viewer['id'] : null];
                break;
            case 'set_priority':
                if ($t['priority'] === $value) {
                    return null;
                }
                $c = ['priority' => $value];
                break;
            case 'set_due':
                if ($t['due_date'] === $value) {
                    return null;
                }
                $c = ['due_date' => $value];
                if ($value === null) {
                    $c['due_time'] = null; // a time needs a date
                } elseif ($t['due_date'] !== null && $value > $t['due_date']) {
                    $c['postpone_count'] = (int) $t['postpone_count'] + 1; // a later date is a postpone (FEATURES B3)
                }
                break;
            case 'set_event':
                if ((int) $t['event_id'] === (int) $value && ($t['event_id'] === null) === ($value === null)) {
                    return null;
                }
                $c = ['event_id' => $value];
                break;
            case 'set_workspace':
                if ((int) $t['workspace_id'] === (int) $value && ($t['workspace_id'] === null) === ($value === null)) {
                    return null;
                }
                // Moving out of a workspace drops its section and the outfit / step it came from.
                $c = ['workspace_id' => $value, 'workspace_section' => null, 'target_type' => null, 'target_id' => null];
                break;
            default: // add/remove assignees or tags
                return self::links($app, $db, $request, $action, $value, $t, $batchId);
        }
        Bulk::setColumns($app, $db, $request, 'tasks', 'task', $t, $c, $batchId, TaskWriter::names($db, $id), static fn () => TaskWriter::names($db, $id));
        return true;
    }

    /** Add or remove people / tags without touching the others. Each link row is audited so Undo puts it back. */
    private static function links(App $app, Db $db, Request $request, string $action, array $ids, array $t, int $batchId): true|null
    {
        [$table, $col, $type] = str_ends_with($action, '_assignees') ? ['task_assignees', 'user_id', 'task_assignee'] : ['task_tags', 'tag_id', 'task_tag'];
        $add = str_starts_with($action, 'add_');
        $user = $request->attr('user');
        $now = $app->clock->dbNow();
        $taskId = (int) $t['id'];
        $before = TaskWriter::names($db, $taskId);
        $have = [];
        foreach ($db->all("SELECT * FROM `$table` WHERE task_id = ? FOR UPDATE", [$taskId]) as $r) {
            $have[(int) $r[$col]] = $r;
        }
        $changed = false;
        foreach ($ids as $lid) {
            $row = $have[$lid] ?? null;
            if ($add && ($row === null || $row['deleted_at'] !== null)) {
                if ($row === null) {
                    $db->run("INSERT INTO `$table` (task_id, `$col`, created_at, created_by) VALUES (?, ?, ?, ?)", [$taskId, $lid, $now, $user['id'] ?? null]);
                    $linkId = (int) $db->pdo->lastInsertId();
                } else {
                    $db->run("UPDATE `$table` SET deleted_at = NULL, deleted_by = NULL, delete_batch_id = NULL WHERE id = ?", [$row['id']]);
                    $linkId = (int) $row['id'];
                }
                AuditLog::record($app, $db, $request, ['action' => 'create', 'entity_type' => $type, 'entity_id' => $linkId, 'batch_id' => $batchId,
                    'before' => $row, 'after' => $db->one("SELECT * FROM `$table` WHERE id = ?", [$linkId])]);
                $changed = true;
            } elseif (!$add && $row !== null && $row['deleted_at'] === null) {
                $db->run("UPDATE `$table` SET deleted_at = ?, deleted_by = ?, delete_batch_id = ? WHERE id = ?", [$now, $user['id'] ?? null, $batchId, $row['id']]);
                AuditLog::record($app, $db, $request, ['action' => 'delete', 'entity_type' => $type, 'entity_id' => (int) $row['id'], 'batch_id' => $batchId,
                    'before' => $row, 'after' => $db->one("SELECT * FROM `$table` WHERE id = ?", [$row['id']])]);
                $changed = true;
            }
        }
        if (!$changed) {
            return null;
        }
        // The task's own line (History shows who / which tags changed); bumps its version so open copies see it.
        Bulk::setColumns($app, $db, $request, 'tasks', 'task', $t, [], $batchId, $before, static fn () => TaskWriter::names($db, $taskId));
        return true;
    }

    /** "Done: %s", "Due 20 Oct for %s" … with %s = "3 tasks". */
    private static function label(Db $db, string $action, mixed $value): string
    {
        $names = static fn (string $table, array $ids) => implode(', ', array_column($ids === [] ? [] : $db->all(
            "SELECT name FROM `$table` WHERE id IN (" . implode(',', array_fill(0, count($ids), '?')) . ') ORDER BY name', $ids), 'name'));
        return match ($action) {
            'done' => 'Marked %s done',
            'delete' => 'Deleted %s',
            'set_status' => 'Set ' . TaskDef::STATUS[$value] . ' for %s',
            'set_priority' => 'Set ' . TaskDef::PRIORITY[$value] . ' for %s',
            'set_due' => $value === null ? 'Removed the date from %s' : 'Due ' . date('j M Y', strtotime((string) $value)) . ' for %s',
            'set_event' => $value === null ? 'Removed the event from %s' : 'Moved %s to ' . $db->value('SELECT name FROM events WHERE id = ?', [$value]),
            'set_workspace' => $value === null ? 'Took %s out of its workspace' : 'Moved %s to ' . $db->value('SELECT name FROM workspaces WHERE id = ?', [$value]),
            'add_assignees' => 'Assigned ' . $names('users', $value) . ' to %s',
            'remove_assignees' => 'Removed ' . $names('users', $value) . ' from %s',
            'add_tags' => 'Tagged %s ' . $names('tags', $value),
            'remove_tags' => 'Removed tag ' . $names('tags', $value) . ' from %s',
        };
    }

    /* -------------------------------------------------------------- export */

    /** GET /tasks/export?ids=… (editors): the chosen tasks as CSV for Excel, formula-safe. */
    public static function export(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireEditor($viewer);
        $ids = array_values(array_filter(explode(',', (string) ($request->query['ids'] ?? '')), static fn ($x) => preg_match('/^[0-9A-HJKMNP-TV-Z]{26}$/', $x)));
        if ($ids === [] || count($ids) > self::MAX) {
            throw new HttpError(422, 'validation_failed', Strings::get('bulk_too_many_n', ['max' => number_format(self::MAX)]), ['fields' => ['ids' => Strings::get('field_required')]]);
        }
        $db = $app->db();
        $in = implode(',', array_fill(0, count($ids), '?'));
        $tasks = $db->all("SELECT * FROM tasks WHERE public_id IN ($in) AND deleted_at IS NULL ORDER BY due_date IS NULL, due_date, due_time, id", $ids);
        $lines = [Csv::line(['Task ID', 'Title', 'Status', 'Priority', 'Due date', 'Time', 'Assigned to', 'Tags', 'Event', 'Workspace', 'Checklist', 'Notes'])];
        foreach ($tasks as $t) {
            $n = TaskWriter::names($db, (int) $t['id']);
            $items = $db->one('SELECT COUNT(*) total, SUM(is_done) done FROM task_items WHERE task_id = ? AND deleted_at IS NULL', [$t['id']]);
            $lines[] = Csv::line([$t['code'], $t['title'], TaskDef::STATUS[$t['status']], TaskDef::PRIORITY[$t['priority']], $t['due_date'],
                $t['due_time'] !== null ? substr($t['due_time'], 0, 5) : null, implode(', ', $n['assignees']), implode(', ', $n['tags']), $n['event'], $n['workspace'],
                (int) $items['total'] > 0 ? (int) $items['done'] . '/' . (int) $items['total'] : null, $t['notes']]);
        }
        $count = count($tasks);
        UnitOfWork::run($app, $request, static function (Db $db) use ($app, $request, $count): Response {
            AuditLog::record($app, $db, $request, ['action' => 'export', 'entity_type' => 'task', 'note' => "$count tasks as CSV"]);
            return Response::ok(null);
        });
        $r = new Response(200);
        $r->body = Csv::BOM . implode("\r\n", $lines) . "\r\n";
        $r->headers['Content-Type'] = 'text/csv; charset=utf-8';
        $r->headers['Content-Disposition'] = 'attachment; filename="tasks_' . $app->clock->todayIst() . '.csv"';
        $r->headers['Cache-Control'] = 'no-store';
        return $r;
    }
}
