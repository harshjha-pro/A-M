<?php
declare(strict_types=1);

namespace AM\Http;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Db\UnitOfWork;
use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Kernel\Router;
use AM\Kernel\Strings;
use AM\Repo\BaseRepository;
use AM\Repo\EntityDef;
use AM\Repo\Refs;
use AM\Repo\Versioned;
use AM\Safety\AuditLog;
use AM\Validation\Fields;
use DateTimeImmutable;

/**
 * list, create, update, delete and restore for any EntityDef, all through the
 * shared base code (IMPLEMENTATION §2.4): permission → validate → UnitOfWork
 * (change + audit + batch + stored reply). A module only declares itself.
 */
final class BaseController
{
    public const UNDO_MINUTES = 10;

    /**
     * Register the standard routes.
     * @param class-string<EntityDef> $def
     * @param callable(?array): void $canRead  throws 403 when not allowed
     * @param callable(?array, string, ?array): void $canWrite (viewer, action, row)
     */
    public static function register(Router $r, string $def, callable $canRead, callable $canWrite): void
    {
        $base = '/' . $def::RESOURCE;
        $r->add('GET', $base, fn (Request $q, App $a, array $p) => self::list($q, $a, $def, $canRead));
        $r->add('POST', $base, fn (Request $q, App $a, array $p) => self::create($q, $a, $def, $canWrite));
        $r->add('PATCH', "$base/{id}", fn (Request $q, App $a, array $p) => self::update($q, $a, $p, $def, $canWrite));
        $r->add('DELETE', "$base/{id}", fn (Request $q, App $a, array $p) => self::delete($q, $a, $p, $def, $canWrite));
        $r->add('POST', "$base/{id}/restore", fn (Request $q, App $a, array $p) => self::restore($q, $a, $p, $def));
    }

    /** @param class-string<EntityDef> $def */
    public static function list(Request $request, App $app, string $def, callable $canRead): Response
    {
        $viewer = $request->attr('user');
        $canRead($viewer);
        $db = $app->db();
        $refs = new Refs($db, $app->clock->todayIst());
        $table = BaseRepository::table($def);
        $rows = $db->all("SELECT * FROM `$table` WHERE deleted_at IS NULL ORDER BY id DESC");
        $data = array_map(static fn (array $r) => $def::present($app, $db, $refs, $r, $viewer), $rows);
        return Response::ok($data, 200, ['total' => count($data)]);
    }

    /** @param class-string<EntityDef> $def */
    public static function create(Request $request, App $app, string $def, callable $canWrite): Response
    {
        $viewer = $request->attr('user');
        $canWrite($viewer, 'create', null);
        $f = Fields::from($request->attr('json'));
        $values = $def::input($app, $f, true, null);
        $f->fail();
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $def, $viewer, $values): Response {
            $r = BaseRepository::create($app, $db, $request, $def, $values + $def::onCreate($app, $viewer));
            $view = $def::present($app, $db, new Refs($db, $app->clock->todayIst()), $r['row'], $viewer);
            return Response::ok($view, $r['created'] ? 201 : 200)->withHeader('ETag', '"' . $view['version'] . '"');
        });
    }

    /** @param class-string<EntityDef> $def */
    public static function update(Request $request, App $app, array $params, string $def, callable $canWrite): Response
    {
        $viewer = $request->attr('user');
        $canWrite($viewer, 'update', null);
        $expected = Versioned::ifMatch($request);
        $f = Fields::from($request->attr('json'));
        if ($f->keys() === []) {
            throw HttpError::make(422, 'validation_failed', [], ['fields' => []]);
        }
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $params, $def, $canWrite, $viewer, $expected, $f): Response {
            $row = BaseRepository::find($db, $def, $params['id'], true);
            $canWrite($viewer, 'update', $row);
            $changes = $def::input($app, $f, false, $row);
            $f->fail();
            $refs = new Refs($db, $app->clock->todayIst());
            $present = static fn (array $x) => $def::present($app, $db, $refs, $x, $viewer);
            $r = Versioned::update($app, $db, $request, BaseRepository::table($def), $def::TYPE, (int) $row['id'], $expected, $changes, $present);
            if ($r['changed'] !== []) {
                AuditLog::record($app, $db, $request, [
                    'action' => 'update', 'entity_type' => $def::TYPE, 'entity_id' => (int) $row['id'],
                    'entity_version' => (int) $r['after']['version'], 'before' => $r['before'], 'after' => $r['after'],
                ]);
            }
            $view = $present($r['after']);
            return Response::ok($view)->withHeader('ETag', '"' . $view['version'] . '"');
        });
    }

    /** DELETE: always soft, children in the same batch, reply carries meta.undo (API.md §7). */
    public static function delete(Request $request, App $app, array $params, string $def, callable $canWrite): Response
    {
        $viewer = $request->attr('user');
        $canWrite($viewer, 'delete', null);
        $expected = Versioned::ifMatch($request);
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $params, $def, $canWrite, $viewer, $expected): Response {
            $row = BaseRepository::find($db, $def, $params['id'], true);
            $canWrite($viewer, 'delete', $row);
            if ($row['deleted_at'] !== null) {
                throw Versioned::deletedError($app, $db, $request, $row);
            }
            if ((int) $row['version'] !== $expected) {
                $refs = new Refs($db, $app->clock->todayIst());
                throw Versioned::conflictError($app, $db, $def::TYPE, $row, $expected, static fn ($x) => $def::present($app, $db, $refs, $x, $viewer));
            }
            $batch = BaseRepository::softDelete($app, $db, $request, $def, $row);
            $name = $def::name($row);
            return Response::ok(new \stdClass(), 200, ['undo' => self::undoMeta($app, $batch['public_id'], "Deleted $name")]);
        });
    }

    /** POST /{resource}/{id}/restore — admins; If-Match = the deleted version. */
    public static function restore(Request $request, App $app, array $params, string $def): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireAdmin($viewer);
        $expected = Versioned::ifMatch($request);
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $params, $def, $viewer, $expected): Response {
            $row = BaseRepository::find($db, $def, $params['id'], true);
            $refs = new Refs($db, $app->clock->todayIst());
            if ($row['deleted_at'] === null) {
                // Already back (a second tap, or someone else restored it): not an error.
                $view = $def::present($app, $db, $refs, $row, $viewer);
                return Response::ok($view, 200, ['already_restored' => true])->withHeader('ETag', '"' . $view['version'] . '"');
            }
            if ((int) $row['version'] !== $expected) {
                throw Versioned::conflictError($app, $db, $def::TYPE, $row, $expected, static fn ($x) => $def::present($app, $db, $refs, $x, $viewer));
            }
            $batch = $db->one('SELECT * FROM change_batches WHERE id = ?', [$row['delete_batch_id']]);
            $result = BaseRepository::restoreBatch($app, $db, $request, $batch, [['type' => $def::TYPE, 'id' => $row['public_id']]]);
            if ($result['blocked'] !== []) {
                throw new HttpError(422, 'rule_blocked', $result['blocked'][0]['reason'], ['rule' => 'restore_clash']);
            }
            $after = $db->one('SELECT * FROM `' . BaseRepository::table($def) . '` WHERE id = ?', [$row['id']]);
            $view = $def::present($app, $db, $refs, $after, $viewer);
            return Response::ok($view, 200, ['warnings' => $result['warnings']])->withHeader('ETag', '"' . $view['version'] . '"');
        });
    }

    public static function undoMeta(App $app, string $batchPublicId, string $summary): array
    {
        $until = $app->clock->now()->modify('+' . self::UNDO_MINUTES . ' minutes');
        return ['batch_id' => $batchPublicId, 'until' => $until->format('Y-m-d\TH:i:s\Z'), 'summary' => $summary];
    }

    /** Admin-only reads and writes (restore drills, trash). */
    public static function adminOnly(): array
    {
        return [
            static fn (?array $v) => Permissions::requireAdmin($v),
            static fn (?array $v, string $action, ?array $row) => Permissions::requireAdmin($v),
        ];
    }
}
