<?php
declare(strict_types=1);

namespace AM\Modules\Trash;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Db\UnitOfWork;
use AM\Kernel\App;
use AM\Kernel\AppInfo;
use AM\Kernel\HttpError;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Kernel\Strings;
use AM\Kernel\Time;
use AM\Modules\Auth\Users;
use AM\Repo\BaseRepository;
use AM\Repo\Cursor;
use AM\Repo\Entities;
use AM\Repo\Refs;
use AM\Safety\ChangeBatches;
use AM\Validation\Fields;
use DateTimeImmutable;
use DateTimeZone;

/** "Deleted items" (FEATURES B9, API.md §7). Admins only. Nothing is ever hard-deleted in R1. */
final class TrashController
{
    /** GET /trash — one row per delete batch that still has deleted rows, newest first. */
    public static function list(Request $request, App $app, array $params): Response
    {
        Permissions::requireAdmin($request->attr('user'));
        $db = $app->db();
        $filters = array_intersect_key($request->query, array_flip(['type', 'user', 'from', 'to']));
        $cursor = new Cursor('trash', $filters);
        $limit = Cursor::limit($request);
        $where = ["cb.action = 'delete'", 'cb.id < ?'];
        $args = [$cursor->before($request)];
        if (isset($filters['type'])) {
            $where[] = 'cb.entity_type = ?';
            $args[] = $filters['type'];
        }
        if (isset($filters['user'])) {
            $u = Users::byPublicId($db, $filters['user']);
            $where[] = 'cb.user_id = ?';
            $args[] = $u['id'];
        }
        foreach (['from' => '>=', 'to' => '<'] as $k => $op) {
            if (isset($filters[$k])) {
                if (!Time::isDate($filters[$k])) {
                    throw HttpError::make(400, 'bad_request');
                }
                $where[] = "cb.created_at $op ?";
                $args[] = self::istDayStartUtc($filters[$k], $k === 'to' ? 1 : 0);
            }
        }
        // Only batches that still hold something deleted (restored ones leave the list).
        $exists = [];
        foreach (Entities::deletable() as $def) {
            $exists[] = 'EXISTS (SELECT 1 FROM `' . BaseRepository::table($def) . '` x WHERE x.delete_batch_id = cb.id)';
        }
        $where[] = '(' . implode(' OR ', $exists) . ')';
        $rows = $db->all('SELECT cb.* FROM change_batches cb WHERE ' . implode(' AND ', $where) . ' ORDER BY cb.id DESC LIMIT ' . ($limit + 1), $args);
        [$rows, $meta] = $cursor->page($rows, $limit);
        $refs = new Refs($db, $app->clock->todayIst());
        return Response::ok(array_map(static fn (array $b) => self::batchView($refs, $b), $rows), 200, $meta);
    }

    /** GET /trash/{batch_id} */
    public static function get(Request $request, App $app, array $params): Response
    {
        Permissions::requireAdmin($request->attr('user'));
        $db = $app->db();
        $batch = self::batch($db, $params['batch_id']);
        $found = [];
        foreach (Entities::deletable() as $def) {
            foreach ($db->all('SELECT * FROM `' . BaseRepository::table($def) . '` WHERE delete_batch_id = ? ORDER BY id', [$batch['id']]) as $r) {
                $found[] = ['def' => $def, 'row' => $r];
            }
        }
        // Top-level rows only; their children in the same batch are counted (a task's checklist, links).
        $isChildOf = static function (array $c, array $p): bool {
            $fk = $p['def']::CHILDREN[$c['def']] ?? null;
            return $fk !== null && (int) $c['row'][$fk] === (int) $p['row']['id'];
        };
        $items = [];
        foreach ($found as $f) {
            foreach ($found as $p) {
                if ($isChildOf($f, $p)) {
                    continue 2;
                }
            }
            $children = 0;
            $stack = [$f];
            while ($stack) {
                $cur = array_pop($stack);
                foreach ($found as $c) {
                    if ($isChildOf($c, $cur)) {
                        $children++;
                        $stack[] = $c;
                    }
                }
            }
            $items[] = ['type' => $f['def']::TYPE, 'id' => Entities::key($f['def'], $f['row']), 'name' => $f['def']::name($f['row']), 'child_count' => $children];
        }
        return Response::ok(['batch' => self::batchView(new Refs($db, $app->clock->todayIst()), $batch), 'items' => $items]);
    }

    /** POST /trash/{batch_id}/restore — the whole batch, or {items: [{type, id}]}. Twice → already_restored. */
    public static function restore(Request $request, App $app, array $params): Response
    {
        Permissions::requireAdmin($request->attr('user'));
        $f = Fields::from($request->attr('json'));
        $f->only(['items']);
        $f->fail();
        $items = $request->attr('json')['items'] ?? null;
        if ($items !== null && (!is_array($items) || !array_is_list($items) || $items === [])) {
            throw HttpError::make(422, 'validation_failed', [], ['fields' => ['items' => Strings::get('field_bad_choice')]]);
        }
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $params, $items): Response {
            $batch = self::batch($db, $params['batch_id'], true);
            $r = BaseRepository::restoreBatch($app, $db, $request, $batch, $items);
            return Response::ok([
                'restored' => $r['restored'],
                'blocked' => $r['blocked'],
                'warnings' => $r['warnings'],
                'already_restored' => $r['already_restored'],
                'message' => $r['already_restored'] ? Strings::get('already_restored') : 'Restored.',
            ]);
        });
    }

    /** DELETE /trash/{batch_id} — purge. The contract exists; no code path deletes before 16 May 2027 (CONTEXT 34). */
    public static function purge(Request $request, App $app, array $params): Response
    {
        $user = $request->attr('user');
        if (($user['role'] ?? '') !== 'owner') {
            throw HttpError::make(403, 'forbidden');
        }
        if ($app->clock->todayIst() < AppInfo::PURGE_ALLOWED_FROM) {
            throw HttpError::make(403, 'purge_not_allowed_yet');
        }
        throw HttpError::make(403, 'not_available_yet'); // purge is a "Later" feature: still nothing is removed
    }

    private static function batch(Db $db, string $publicId, bool $forUpdate = false): array
    {
        $b = ChangeBatches::byPublicId($db, $publicId, $forUpdate);
        if ($b === null || $b['action'] !== 'delete') {
            throw HttpError::make(404, 'not_found');
        }
        return $b;
    }

    private static function batchView(Refs $refs, array $b): array
    {
        return [
            'batch_id' => $b['public_id'],
            'action' => $b['action'],
            'entity_type' => $b['entity_type'],
            'summary' => $b['summary'],
            'item_count' => (int) $b['item_count'],
            'user' => $refs->user($b['user_id'] !== null ? (int) $b['user_id'] : null),
            'deleted_at' => Time::iso($b['created_at']),
            'restorable' => true,
        ];
    }

    /** "2026-10-08" in India → UTC "2026-10-07 18:30:00" (plus N days). */
    public static function istDayStartUtc(string $date, int $plusDays = 0): string
    {
        return (new DateTimeImmutable("$date 00:00:00", new DateTimeZone('Asia/Kolkata')))
            ->modify("+$plusDays days")->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    }
}
