<?php
declare(strict_types=1);

namespace AM\Modules\Tasks;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Db\UnitOfWork;
use AM\Http\BaseController;
use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Kernel\Uuid;
use AM\Repo\BaseRepository;
use AM\Repo\Refs;
use AM\Repo\Versioned;
use AM\Safety\AuditLog;
use AM\Validation\Fields;

/** Checklist items: /tasks/{id}/items… — each item is addressed by its key and has its own version. */
final class TaskItemsController
{
    /** POST /tasks/{id}/items {key, text, sort_order} — key = the item's UUID; a retry returns the same item. */
    public static function add(Request $request, App $app, array $params): Response
    {
        Permissions::requireEditor($request->attr('user'));
        $f = Fields::from($request->attr('json'));
        $f->only(['key', 'text', 'sort_order']);
        $key = strtolower((string) $f->raw('key', true, 36));
        if ($key !== '' && !Uuid::isValid($key)) {
            $f->error('key', \AM\Kernel\Strings::get('field_bad_text'));
        }
        $text = $f->text('text', 200, true);
        $sort = $f->value('sort_order');
        $f->fail();
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $params, $key, $text, $sort): Response {
            $task = BaseRepository::find($db, TaskDef::class, $params['id'], true, false);
            $refs = new Refs($db, $app->clock->todayIst());
            $existing = $db->one('SELECT * FROM task_items WHERE client_uuid = ?', [$key]);
            if ($existing !== null) {
                if ((int) $existing['task_id'] !== (int) $task['id']) {
                    throw HttpError::make(422, 'validation_failed', [], ['fields' => ['key' => 'This key is already used.']]);
                }
                return Response::ok(TaskItemDef::present($app, $db, $refs, $existing, null), 200);
            }
            $order = is_int($sort) ? $sort : (int) $db->value('SELECT COALESCE(MAX(sort_order), -1) + 1 FROM task_items WHERE task_id = ? AND deleted_at IS NULL', [$task['id']]);
            $row = TaskWriter::insertItem($app, $db, $request, (int) $task['id'], ['key' => $key, 'text' => $text, 'sort_order' => $order]);
            return Response::ok(TaskItemDef::present($app, $db, $refs, $row, null), 201)->withHeader('ETag', '"1"');
        });
    }

    /** PATCH /tasks/{id}/items/{key} — tick / rename / reorder, with the item's own version. */
    public static function update(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireEditor($viewer);
        $expected = Versioned::ifMatch($request);
        $f = Fields::from($request->attr('json'));
        $f->only(['text', 'is_done', 'sort_order']);
        $c = [];
        if ($f->has('text')) {
            $c['text'] = $f->text('text', 200, true);
        }
        if ($f->has('is_done')) {
            $c['is_done'] = $f->bool('is_done');
        }
        if ($f->has('sort_order')) {
            $v = $f->value('sort_order');
            is_int($v) ? $c['sort_order'] = $v : $f->error('sort_order', \AM\Kernel\Strings::get('field_bad_choice'));
        }
        if ($c === [] && !$f->hasErrors()) {
            throw HttpError::make(422, 'validation_failed', [], ['fields' => []]);
        }
        $f->fail();
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $params, $viewer, $expected, $c): Response {
            [$task, $item] = self::find($db, $params);
            $refs = new Refs($db, $app->clock->todayIst());
            if (array_key_exists('is_done', $c) && (bool) $item['is_done'] !== $c['is_done']) {
                $c['done_at'] = $c['is_done'] ? $app->clock->dbNow() : null;
                $c['done_by'] = $c['is_done'] ? $viewer['id'] : null;
            }
            $present = static fn (array $x) => TaskItemDef::present($app, $db, $refs, $x, null);
            $r = Versioned::update($app, $db, $request, 'task_items', 'task_item', (int) $item['id'], $expected, $c, $present);
            if ($r['changed'] !== []) {
                AuditLog::record($app, $db, $request, ['action' => 'update', 'entity_type' => 'task_item', 'entity_id' => (int) $item['id'],
                    'entity_version' => (int) $r['after']['version'], 'before' => $r['before'], 'after' => $r['after']]);
            }
            $meta = [];
            if (($c['is_done'] ?? false) === true && $task['status'] !== 'done'
                && (int) $db->value('SELECT COUNT(*) FROM task_items WHERE task_id = ? AND deleted_at IS NULL AND is_done = 0', [$task['id']]) === 0) {
                $meta['last_item_done'] = true; // the phone asks "Mark the task done too?"
            }
            $view = $present($r['after']);
            return Response::ok($view, 200, $meta)->withHeader('ETag', '"' . $view['version'] . '"');
        });
    }

    /** DELETE /tasks/{id}/items/{key} — soft, with Undo. */
    public static function delete(Request $request, App $app, array $params): Response
    {
        Permissions::requireEditor($request->attr('user'));
        $expected = Versioned::ifMatch($request);
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $params, $expected): Response {
            [$task, $item] = self::find($db, $params, true);
            if ($item['deleted_at'] !== null) {
                throw Versioned::deletedError($app, $db, $request, $item);
            }
            if ((int) $item['version'] !== $expected) {
                $refs = new Refs($db, $app->clock->todayIst());
                throw Versioned::conflictError($app, $db, 'task_item', $item, $expected, static fn ($x) => TaskItemDef::present($app, $db, $refs, $x, null));
            }
            $batch = BaseRepository::softDelete($app, $db, $request, TaskItemDef::class, $item);
            return Response::ok(new \stdClass(), 200, ['undo' => BaseController::undoMeta($app, $batch['public_id'], 'Removed ' . TaskItemDef::name($item))]);
        });
    }

    /** @return array{0: array, 1: array} task, item (404 for a bad key or another task's item) */
    private static function find(Db $db, array $params, bool $includeDeleted = false): array
    {
        $task = BaseRepository::find($db, TaskDef::class, $params['id'], true, false);
        $key = strtolower($params['key']);
        $item = Uuid::isValid($key) ? $db->one('SELECT * FROM task_items WHERE client_uuid = ? AND task_id = ? FOR UPDATE', [$key, $task['id']]) : null;
        if ($item === null || (!$includeDeleted && $item['deleted_at'] !== null)) {
            throw HttpError::make(404, 'not_found');
        }
        return [$task, $item];
    }
}
