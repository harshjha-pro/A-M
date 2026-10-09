<?php
declare(strict_types=1);

namespace AM\Modules\History;

use AM\Auth\Permissions;
use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Modules\Auth\Users;
use AM\Modules\Trash\TrashController;
use AM\Repo\BaseRepository;
use AM\Repo\Cursor;
use AM\Repo\Entities;
use AM\Repo\Refs;
use AM\Safety\History;
use AM\Kernel\Time;

/** Record History and the admin Activity feed (FEATURES A5, API.md §6). */
final class HistoryController
{
    /** GET /{resource}/{id}/history — anyone who can see the record; money hidden for non-money users. */
    public static function record(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        $def = Entities::RESOURCES[$params['resource']] ?? null;
        if ($def === null) {
            throw HttpError::make(404, 'not_found');
        }
        $db = $app->db();
        $row = BaseRepository::find($db, $def, $params['id']);
        if (!$def::canView($viewer, $row)) {
            throw HttpError::make(403, 'forbidden');
        }
        $cursor = new Cursor('history:' . $def::TYPE . ':' . $params['id']);
        $limit = Cursor::limit($request);
        $rows = $db->all(
            "SELECT a.*, cb.public_id AS batch_public_id FROM audit_log a LEFT JOIN change_batches cb ON cb.id = a.batch_id
             WHERE a.entity_type = ? AND a.entity_id = ? AND a.action IN ('create','update','delete','restore','undo','role_change','merge','status_change')
               AND a.id < ? ORDER BY a.id DESC LIMIT " . ($limit + 1),
            [$def::TYPE, $row['id'], $cursor->before($request)],
        );
        [$rows, $meta] = $cursor->page($rows, $limit);
        $refs = new Refs($db, $app->clock->todayIst());
        return Response::ok(array_map(static fn ($a) => History::line($refs, $a, $def, $viewer), $rows), 200, $meta);
    }

    /** GET /activity — admins; filters user, type, action, from, to (IST dates). */
    public static function activity(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireAdmin($viewer); // AC-ACT-04
        $db = $app->db();
        $filters = array_intersect_key($request->query, array_flip(['user', 'type', 'action', 'from', 'to']));
        $cursor = new Cursor('activity', $filters);
        $limit = Cursor::limit($request);
        $where = ['a.id < ?'];
        $args = [$cursor->before($request)];
        if (isset($filters['user'])) {
            $where[] = 'a.user_id = ?';
            $args[] = Users::byPublicId($db, $filters['user'])['id'];
        }
        if (isset($filters['type'])) {
            $where[] = 'a.entity_type = ?';
            $args[] = $filters['type'];
        }
        if (isset($filters['action'])) {
            $where[] = 'a.action = ?';
            $args[] = $filters['action'];
        }
        foreach (['from' => '>=', 'to' => '<'] as $k => $op) {
            if (isset($filters[$k])) {
                if (!Time::isDate($filters[$k])) {
                    throw HttpError::make(400, 'bad_request');
                }
                $where[] = "a.created_at $op ?";
                $args[] = TrashController::istDayStartUtc($filters[$k], $k === 'to' ? 1 : 0);
            }
        }
        $rows = $db->all(
            'SELECT a.*, cb.public_id AS batch_public_id FROM audit_log a LEFT JOIN change_batches cb ON cb.id = a.batch_id WHERE '
            . implode(' AND ', $where) . ' ORDER BY a.id DESC LIMIT ' . ($limit + 1),
            $args,
        );
        [$rows, $meta] = $cursor->page($rows, $limit);
        $refs = new Refs($db, $app->clock->todayIst());
        return Response::ok(array_map(static fn ($a) => History::line($refs, $a, Entities::forType((string) $a['entity_type']), $viewer), $rows), 200, $meta);
    }
}
