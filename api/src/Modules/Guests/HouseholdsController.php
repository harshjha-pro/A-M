<?php
declare(strict_types=1);

namespace AM\Modules\Guests;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Db\UnitOfWork;
use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Phone;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Kernel\Strings;
use AM\Repo\BaseRepository;
use AM\Repo\Cursor;
use AM\Repo\Refs;
use AM\Safety\ChangeBatches;
use AM\Validation\Fields;

/** /households (API.md §6.7, FEATURES B5). Edits, deletes and restores use the shared BaseController. */
final class HouseholdsController
{
    public const QUERY = ['q', 'side', 'event', 'rsvp', 'group', 'area', 'food', 'vip', 'no_phone', 'possible_duplicates', 'sort', 'limit', 'cursor'];
    public const SUGGEST = ['group_name', 'area', 'relation', 'city'];

    /** Everyone who can edit (Family included) adds, edits and deletes families; restore is admin-only. */
    public static function canWrite(): callable
    {
        return static fn (?array $v, string $action, ?array $row) => Permissions::requireEditor($v);
    }

    /* ------------------------------------------------------------------ list */

    public static function list(Request $request, App $app, array $params): Response
    {
        $db = $app->db();
        $q = $request->query;
        $sorts = [
            'name' => 'h.name, h.id',
            '-created_at' => 'h.id DESC',
            'area' => 'h.area IS NULL, h.area, h.name, h.id',
            'group' => 'h.group_name IS NULL, h.group_name, h.name, h.id',
        ];
        $sort = $q['sort'] ?? 'name';
        if (!isset($sorts[$sort])) {
            throw HttpError::make(400, 'bad_request');
        }
        [$where, $args, $eventId] = self::filters($db, $q);
        $cursor = new Cursor('households', array_diff_key($q, ['cursor' => 1, 'limit' => 1]));
        $limit = Cursor::limit($request);
        $offset = $cursor->offset($request);
        $base = 'FROM households h WHERE ' . implode(' AND ', $where);
        $take = $limit + 1;
        $rows = $db->all("SELECT h.* $base ORDER BY {$sorts[$sort]} LIMIT $take OFFSET $offset", $args);
        [$rows, $meta] = $cursor->pageOffset($rows, $limit, $offset);
        $rows = Duplicates::flag($db, $rows); // only for this page, not every family
        $t = $db->one("SELECT COUNT(*) AS n, COALESCE(SUM(h.adults + h.children), 0) AS people $base", $args) ?? [];
        $meta['total'] = (int) ($t['n'] ?? 0);
        $meta['totals'] = ['people' => (int) ($t['people'] ?? 0)];
        $refs = new Refs($db, $app->clock->todayIst());
        return Response::ok(HouseholdView::summaries($db, $refs, $rows, $eventId), 200, $meta);
    }

    /**
     * The list filters (also used by the CSV export and bulk actions in 8b).
     * @return array{0: list<string>, 1: list<mixed>, 2: ?int}
     */
    public static function filters(Db $db, array $q): array
    {
        $where = ['h.deleted_at IS NULL'];
        $args = [];
        $eventId = null;
        if (($q['q'] ?? '') !== '') {
            $term = mb_substr(trim((string) $q['q']), 0, 100);
            $like = '%' . addcslashes($term, '%_\\') . '%';
            $digits = preg_replace('/\D+/', '', $term);
            $w = '(h.name LIKE ? OR h.area LIKE ? OR h.group_name LIKE ? OR h.relation LIKE ?';
            array_push($args, $like, $like, $like, $like);
            if (strlen((string) $digits) >= 3) { // part of a phone number, typed any way
                $w .= ' OR h.phone LIKE ? OR h.alt_phone LIKE ?';
                $d = '%' . substr((string) $digits, -10) . '%';
                array_push($args, $d, $d);
            }
            $where[] = $w . ')';
        }
        if (isset($q['side'])) {
            if (!in_array($q['side'], ['bride', 'groom', 'both'], true)) {
                throw HttpError::make(400, 'bad_request');
            }
            // "both" families appear under the bride's and the groom's side too.
            $where[] = $q['side'] === 'both' ? "h.side = 'both'" : "h.side IN (?, 'both')";
            if ($q['side'] !== 'both') {
                $args[] = $q['side'];
            }
        }
        if (isset($q['event'])) {
            $event = $db->one('SELECT id FROM events WHERE public_id = ? AND deleted_at IS NULL', [(string) $q['event']]);
            if ($event === null) {
                throw HttpError::make(404, 'not_found');
            }
            $eventId = (int) $event['id'];
            $sub = 'EXISTS (SELECT 1 FROM household_events he WHERE he.household_id = h.id AND he.event_id = ? AND he.deleted_at IS NULL';
            $args[] = $eventId;
            if (isset($q['rsvp'])) {
                $vals = explode(',', (string) $q['rsvp']);
                foreach ($vals as $v) {
                    if (!in_array($v, ['not_asked', 'waiting', 'coming', 'not_coming'], true)) {
                        throw HttpError::make(400, 'bad_request');
                    }
                }
                $sub .= ' AND he.rsvp IN (' . implode(',', array_fill(0, count($vals), '?')) . ')';
                array_push($args, ...$vals);
            }
            $where[] = $sub . ')';
        } elseif (isset($q['rsvp'])) {
            $msg = Strings::get('rsvp_needs_event');
            throw new HttpError(422, 'validation_failed', $msg, ['fields' => ['rsvp' => $msg]]);
        }
        foreach (['group' => 'group_name', 'area' => 'area'] as $k => $col) {
            if (isset($q[$k])) {
                $where[] = "h.$col = ?";
                $args[] = (string) $q[$k];
            }
        }
        if (isset($q['food'])) {
            if (!array_key_exists($q['food'], HouseholdDef::FOOD)) {
                throw HttpError::make(400, 'bad_request');
            }
            $where[] = 'h.food = ?';
            $args[] = $q['food'];
        }
        foreach (['vip' => 'h.is_vip = 1', 'no_phone' => 'h.phone IS NULL AND h.alt_phone IS NULL', 'possible_duplicates' => Duplicates::sharedPhoneSql('h')] as $k => $sql) {
            if (!isset($q[$k])) {
                continue;
            }
            if (!in_array($q[$k], ['true', 'false'], true)) {
                throw HttpError::make(400, 'bad_request');
            }
            $where[] = $q[$k] === 'true' ? "($sql)" : "NOT ($sql)";
        }
        return [$where, $args, $eventId];
    }

    /* ---------------------------------------------------------------- create */

    public static function create(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireEditor($viewer);
        $f = Fields::from($request->attr('json'));
        $values = HouseholdDef::input($app, $f, true, null);
        $events = self::inviteEvents($app->db(), $f);
        $f->fail();
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $viewer, $values, $events): Response {
            $r = BaseRepository::create($app, $db, $request, HouseholdDef::class, $values);
            if ($r['created'] && $events !== []) {
                // The family's own line says it; its invitations ride in a batch so they stay quiet.
                $batch = ChangeBatches::create($app, $db, $request, 'bulk_update', 'household', mb_substr("Invited {$r['row']['name']}", 0, 200));
                foreach ($events as $e) {
                    Invitations::invite($app, $db, $request, $r['row'], $e, [], $batch['id'], false);
                }
                ChangeBatches::setCount($db, $batch['id'], count($events));
            }
            $view = HouseholdDef::present($app, $db, new Refs($db, $app->clock->todayIst()), $r['row'], $viewer);
            return Response::ok($view, $r['created'] ? 201 : 200)->withHeader('ETag', '"' . $view['version'] . '"');
        });
    }

    /** invite_event_ids: live events that take guest invitations. @return list<array> */
    private static function inviteEvents(Db $db, Fields $f): array
    {
        $ids = $f->value('invite_event_ids');
        if ($ids === null) {
            return [];
        }
        if (!is_array($ids) || !array_is_list($ids) || count($ids) > 50) {
            $f->error('invite_event_ids', Strings::get('field_bad_choice'));
            return [];
        }
        $out = [];
        foreach (array_unique($ids) as $id) {
            $e = is_string($id) ? $db->one('SELECT * FROM events WHERE public_id = ? AND deleted_at IS NULL', [$id]) : null;
            if ($e === null) {
                $f->error('invite_event_ids', Strings::get('field_bad_choice'));
                return [];
            }
            if (!(int) $e['guests_invited']) {
                $f->error('invite_event_ids', Strings::get('event_no_guests'));
                return [];
            }
            $out[] = $e;
        }
        return $out;
    }

    /* ------------------------------------------------------------------ reads */

    public static function get(Request $request, App $app, array $params): Response
    {
        $db = $app->db();
        $row = BaseRepository::find($db, HouseholdDef::class, $params['id'], false, false);
        $view = HouseholdDef::present($app, $db, new Refs($db, $app->clock->todayIst()), $row, $request->attr('user'));
        return Response::ok($view)->withHeader('ETag', '"' . $view['version'] . '"');
    }

    /** GET /households/duplicate-check — hints while typing; never blocks. */
    public static function duplicateCheck(Request $request, App $app, array $params): Response
    {
        Permissions::requireEditor($request->attr('user'));
        $db = $app->db();
        $q = $request->query;
        $except = null;
        if (isset($q['exclude'])) {
            $except = (int) BaseRepository::find($db, HouseholdDef::class, (string) $q['exclude'])['id'];
        }
        $phones = [];
        foreach (['phone', 'alt_phone'] as $k) {
            $n = isset($q[$k]) ? Phone::normalize((string) $q[$k]) : null;
            if ($n !== null) {
                $phones[] = $n['e164'];
            }
        }
        $name = trim((string) ($q['name'] ?? ''));
        $city = trim((string) ($q['city'] ?? ''));
        return Response::ok([
            'phone_matches' => Duplicates::phoneMatches($db, $phones, $except),
            'name_matches' => $name === '' ? [] : Duplicates::nameMatches($db, mb_substr($name, 0, 120), $city === '' ? null : mb_substr($city, 0, 60), $except),
        ]);
    }

    /** GET /households/suggestions?field=area&q=Sha — values already used, most common first. */
    public static function suggestions(Request $request, App $app, array $params): Response
    {
        Permissions::requireEditor($request->attr('user'));
        $field = $request->query['field'] ?? '';
        if (!in_array($field, self::SUGGEST, true)) {
            $msg = Strings::get('field_bad_choice');
            throw new HttpError(422, 'validation_failed', $msg, ['fields' => ['field' => $msg]]);
        }
        $term = mb_substr(trim((string) ($request->query['q'] ?? '')), 0, 80);
        $like = addcslashes($term, '%_\\') . '%';
        $rows = $app->db()->all(
            "SELECT `$field` AS v, COUNT(*) AS n FROM households WHERE deleted_at IS NULL AND `$field` IS NOT NULL AND `$field` <> '' AND `$field` LIKE ?
             GROUP BY `$field` ORDER BY n DESC, v LIMIT 20",
            [$like],
        );
        return Response::ok(array_map(static fn ($r) => (string) $r['v'], $rows));
    }
}
