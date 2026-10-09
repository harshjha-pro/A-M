<?php
declare(strict_types=1);

namespace AM\Modules\Events;

use AM\Auth\Permissions;
use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Repo\BaseRepository;
use AM\Repo\Refs;

/** Reads for /events (writes use the shared BaseController). API.md §6.4. */
final class EventsController
{
    /** GET /events — not paged (7–30 rows); dated first by start, then "Date not set" in seed order. */
    public static function list(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        $db = $app->db();
        $only = $request->query['guests_invited'] ?? null;
        if ($only !== null && !in_array($only, ['true', 'false'], true)) {
            throw HttpError::make(400, 'bad_request');
        }
        $rows = $db->all(
            'SELECT * FROM events WHERE deleted_at IS NULL' . ($only !== null ? ' AND guests_invited = ' . ($only === 'true' ? 1 : 0) : '')
            . ' ORDER BY start_at IS NULL, start_at, sort_order, id',
        );
        $refs = new Refs($db, $app->clock->todayIst());
        return Response::ok(array_map(static fn ($r) => EventDef::present($app, $db, $refs, $r, $viewer), $rows), 200, ['total' => count($rows)]);
    }

    public static function get(Request $request, App $app, array $params): Response
    {
        $db = $app->db();
        $row = BaseRepository::find($db, EventDef::class, $params['id'], false, false);
        $view = EventDef::present($app, $db, new Refs($db, $app->clock->todayIst()), $row, $request->attr('user'));
        return Response::ok($view)->withHeader('ETag', '"' . $view['version'] . '"');
    }

    /** GET /events/{id}/headcount */
    public static function headcount(Request $request, App $app, array $params): Response
    {
        $row = BaseRepository::find($app->db(), EventDef::class, $params['id'], false, false);
        return Response::ok(Headcount::forEvent($app->db(), $row));
    }

    /** GET /events/{id}/delete-preview — counts for the delete dialog (admins). */
    public static function deletePreview(Request $request, App $app, array $params): Response
    {
        Permissions::requireAdmin($request->attr('user'));
        $db = $app->db();
        $row = BaseRepository::find($db, EventDef::class, $params['id'], false, false);
        $id = (int) $row['id'];
        return Response::ok([
            'tasks' => (int) $db->value("SELECT COUNT(*) FROM tasks WHERE event_id = ? AND deleted_at IS NULL AND status <> 'cancelled'", [$id]),
            'invitations' => (int) $db->value('SELECT COUNT(*) FROM household_events WHERE event_id = ? AND deleted_at IS NULL', [$id]),
            'payments' => (int) $db->value('SELECT COUNT(*) FROM payments WHERE event_id = ? AND deleted_at IS NULL', [$id]),
            'documents' => (int) $db->value('SELECT COUNT(*) FROM documents WHERE event_id = ? AND deleted_at IS NULL', [$id]),
        ]);
    }
}
