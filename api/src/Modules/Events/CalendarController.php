<?php
declare(strict_types=1);

namespace AM\Modules\Events;

use AM\Auth\Permissions;
use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Kernel\Strings;
use AM\Kernel\Time;
use AM\Modules\Tasks\TaskView;
use AM\Repo\Refs;
use DateTimeImmutable;
use DateTimeZone;

/**
 * GET /calendar (API.md §6.4, FEATURES B4): events, open tasks with a due date,
 * and due payments (money users only), grouped by IST date. At most 93 days.
 */
final class CalendarController
{
    public const QUERY = ['from', 'to', 'types', 'mine', 'include_undated'];
    public const MAX_DAYS = 93;

    public static function show(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        $q = $request->query;
        $from = $q['from'] ?? '';
        $to = $q['to'] ?? '';
        if (!Time::isDate($from) || !Time::isDate($to) || $to < $from) {
            throw HttpError::make(422, 'validation_failed', [], ['fields' => ['to' => Strings::get('field_bad_date')]]);
        }
        $days = (new DateTimeImmutable($from))->diff(new DateTimeImmutable($to))->days;
        if ($days > self::MAX_DAYS) {
            throw HttpError::make(422, 'validation_failed', [], ['fields' => ['to' => Strings::get('calendar_range_too_long')]]);
        }
        $types = isset($q['types']) ? explode(',', $q['types']) : ['event', 'task', 'payment'];
        if (array_diff($types, ['event', 'task', 'payment']) !== []) {
            throw HttpError::make(400, 'bad_request');
        }
        foreach (['mine', 'include_undated'] as $b) {
            if (isset($q[$b]) && !in_array($q[$b], ['true', 'false'], true)) {
                throw HttpError::make(400, 'bad_request');
            }
        }
        $mine = ($q['mine'] ?? '') === 'true';
        $db = $app->db();
        $refs = new Refs($db, $app->clock->todayIst());
        [$today, $now] = TaskView::istNow($app);
        $items = [];

        if (in_array('event', $types, true)) {
            $utcFrom = EventDef::istMidnightUtc($from);
            $utcTo = (new DateTimeImmutable(EventDef::istMidnightUtc($to)))->modify('+1 day')->format('Y-m-d H:i:s');
            foreach ($db->all('SELECT * FROM events WHERE deleted_at IS NULL AND start_at >= ? AND start_at < ? ORDER BY start_at, sort_order', [$utcFrom, $utcTo]) as $e) {
                $ist = (new DateTimeImmutable($e['start_at'], new DateTimeZone('UTC')))->setTimezone(new DateTimeZone('Asia/Kolkata'));
                $items[] = [
                    'type' => 'event', 'id' => $e['public_id'], 'title' => $e['name'], 'date' => $ist->format('Y-m-d'),
                    'time' => (int) $e['all_day'] ? null : $ist->format('H:i'), 'start_at' => Time::iso($e['start_at']), 'end_at' => Time::iso($e['end_at']),
                    'status' => null, 'overdue' => false, 'side' => $e['side'], 'linked_event' => null,
                ];
            }
        }
        if (in_array('task', $types, true)) {
            $sql = "SELECT t.*, e.public_id AS e_pid, e.name AS e_name, e.deleted_at AS e_deleted FROM tasks t LEFT JOIN events e ON e.id = t.event_id
                    WHERE t.deleted_at IS NULL AND t.status IN ('todo','doing','waiting') AND t.due_date BETWEEN ? AND ?";
            $args = [$from, $to];
            if ($mine) {
                $sql .= ' AND EXISTS (SELECT 1 FROM task_assignees a WHERE a.task_id = t.id AND a.user_id = ? AND a.deleted_at IS NULL)';
                $args[] = $viewer['id'];
            }
            foreach ($db->all($sql . ' ORDER BY t.due_date, t.due_time IS NOT NULL, t.due_time, t.priority, t.id', $args) as $t) {
                $items[] = [
                    'type' => 'task', 'id' => $t['public_id'], 'title' => $t['title'], 'date' => $t['due_date'],
                    'time' => $t['due_time'] === null ? null : substr((string) $t['due_time'], 0, 5), 'start_at' => null, 'end_at' => null,
                    'status' => $t['status'], 'overdue' => TaskView::isOverdue($t, $today, $now), 'side' => null,
                    'linked_event' => self::eventRef($t),
                ];
            }
        }
        if (in_array('payment', $types, true) && Permissions::canSeeMoney($viewer) && !$mine) { // AC-EVT-03
            foreach ($db->all("SELECT p.*, e.public_id AS e_pid, e.name AS e_name, e.deleted_at AS e_deleted FROM payments p LEFT JOIN events e ON e.id = p.event_id
                               WHERE p.deleted_at IS NULL AND p.status = 'due' AND p.due_date BETWEEN ? AND ? ORDER BY p.due_date, p.id", [$from, $to]) as $p) {
                $items[] = [
                    'type' => 'payment', 'id' => $p['public_id'], 'title' => $p['title'], 'date' => $p['due_date'], 'time' => null,
                    'start_at' => null, 'end_at' => null, 'status' => 'due', 'overdue' => $p['due_date'] < $today, 'side' => null,
                    'linked_event' => self::eventRef($p),
                ];
            }
        }

        // Group by day; inside a day: untimed first (all-day events, tasks without a time), then by time; events before tasks before payments.
        $order = ['event' => 0, 'task' => 1, 'payment' => 2];
        usort($items, static fn ($a, $b) => [$a['date'], $a['time'] !== null, $a['time'], $order[$a['type']]] <=> [$b['date'], $b['time'] !== null, $b['time'], $order[$b['type']]]);
        $byDay = [];
        foreach ($items as $it) {
            $byDay[$it['date']][] = $it;
        }
        $out = ['days' => array_map(static fn ($d, $list) => ['date' => $d, 'items' => $list], array_keys($byDay), $byDay)];
        if (($q['include_undated'] ?? '') === 'true') {
            $out['undated'] = array_map(
                static fn ($r) => EventDef::present($app, $db, $refs, $r, $viewer),
                $db->all('SELECT * FROM events WHERE deleted_at IS NULL AND start_at IS NULL ORDER BY sort_order, id'),
            );
        }
        return Response::ok($out);
    }

    private static function eventRef(array $r): ?array
    {
        if ($r['e_pid'] === null) {
            return null;
        }
        $ref = ['id' => $r['e_pid'], 'name' => $r['e_name']];
        if ($r['e_deleted'] !== null) {
            $ref['deleted'] = true;
        }
        return $ref;
    }
}
