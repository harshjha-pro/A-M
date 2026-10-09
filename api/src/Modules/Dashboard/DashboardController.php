<?php
declare(strict_types=1);

namespace AM\Modules\Dashboard;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Modules\Events\EventDef;
use AM\Modules\Events\Headcount;
use AM\Modules\Health\HealthService;
use AM\Modules\Tasks\TaskView;
use AM\Repo\Entities;
use AM\Repo\Refs;
use AM\Safety\History;
use DateTimeImmutable;

/**
 * GET /dashboard (FEATURES B2, API.md §6.4, DATABASE §7): every Home card in one
 * call. A card the user may not see is left out of the reply entirely (AC-DASH-03).
 * Deleted records are never counted (SEC-07). Cards hold at most 5 items.
 */
final class DashboardController
{
    public const MAX_ITEMS = 5;

    public static function show(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        $window = $request->query['payments_window_days'] ?? '14';
        if (!ctype_digit($window) || (int) $window < 1 || (int) $window > 90) {
            throw HttpError::make(400, 'bad_request');
        }
        $db = $app->db();
        $refs = new Refs($db, $app->clock->todayIst());
        [$today, $now] = TaskView::istNow($app);
        $editor = in_array($viewer['role'], Permissions::EDITOR_ROLES, true);
        $admin = Permissions::isAdmin($viewer);
        $money = Permissions::canSeeMoney($viewer);

        $out = ['countdown' => self::countdown($app, $db, $refs, $viewer, $today)];
        if ($editor) {
            $out['my_tasks'] = self::myTasks($app, $db, $refs, (int) $viewer['id'], $today, $now);
            $out['overdue'] = ['total' => (int) $db->value(
                "SELECT COUNT(*) FROM tasks t WHERE t.deleted_at IS NULL AND t.status IN ('todo','doing','waiting')
                   AND (t.due_date < ? OR (t.due_date = ? AND t.due_time IS NOT NULL AND t.due_time < ?))",
                [$today, $today, "$now:00"],
            )];
        }
        if ($money) {
            $out['payments_due'] = self::paymentsDue($db, $refs, $today, (int) $window);
            $out['budget'] = self::budget($db);
        }
        $out['headcount'] = array_map(
            static fn (array $e) => Headcount::forEvent($db, $e) + ['date' => EventDef::istDate($e['start_at'])],
            $db->all('SELECT * FROM events WHERE deleted_at IS NULL AND guests_invited = 1 ORDER BY start_at IS NULL, start_at, sort_order'),
        );
        if ($admin) {
            $out['safety'] = self::safety($app);
            $out['recent_activity'] = self::recent($db, $refs, $viewer);
            $out['start_here'] = [
                ['key' => 'event_dates', 'done' => $db->value('SELECT 1 FROM events WHERE deleted_at IS NULL AND start_at IS NOT NULL LIMIT 1') !== null],
                ['key' => 'members', 'done' => $db->value("SELECT 1 FROM users WHERE role IN ('family','viewer') AND is_active = 1 LIMIT 1") !== null],
                ['key' => 'guests', 'done' => $db->value('SELECT 1 FROM households WHERE deleted_at IS NULL LIMIT 1') !== null],
                ['key' => 'payment', 'done' => $db->value('SELECT 1 FROM payments WHERE deleted_at IS NULL LIMIT 1') !== null],
            ];
        }
        return Response::ok($out);
    }

    /** "129 days to the wedding"; "Day 1 of 3" during it; nothing after it. Plus the next event. */
    private static function countdown(App $app, Db $db, Refs $refs, array $viewer, string $today): array
    {
        $s = $db->one('SELECT wedding_start_date, wedding_end_date FROM settings WHERE id = 1');
        $days = null;
        $day = null;
        if ($s !== null) {
            $start = new DateTimeImmutable($s['wedding_start_date']);
            $t = new DateTimeImmutable($today);
            if ($today < $s['wedding_start_date']) {
                $days = (int) $t->diff($start)->days;
            } elseif ($today <= $s['wedding_end_date']) {
                $day = (int) $start->diff($t)->days + 1;
            }
        }
        $next = $db->one('SELECT * FROM events WHERE deleted_at IS NULL AND start_at >= ? ORDER BY start_at, sort_order LIMIT 1', [$app->clock->dbNow()]);
        $total = $s === null ? null : (int) (new DateTimeImmutable($s['wedding_start_date']))->diff(new DateTimeImmutable($s['wedding_end_date']))->days + 1;
        return [
            'days_to_wedding' => $days,
            'wedding_day' => $day,
            'wedding_days' => $total,
            'wedding_start_date' => $s['wedding_start_date'] ?? null,
            'next_event' => $next === null ? null : EventDef::present($app, $db, $refs, $next, $viewer),
        ];
    }

    /** My overdue (first), then due today; if none, the next 3 upcoming (FEATURES B2 card 2, DATABASE §7.1). */
    private static function myTasks(App $app, Db $db, Refs $refs, int $me, string $today, string $now): array
    {
        $mine = "FROM tasks t JOIN task_assignees ta ON ta.task_id = t.id AND ta.deleted_at IS NULL AND ta.user_id = ?
                 WHERE t.deleted_at IS NULL AND t.status IN ('todo','doing','waiting')";
        $urgent = "$mine AND t.due_date <= ?";
        $total = (int) $db->value("SELECT COUNT(*) $urgent", [$me, $today]);
        $limit = self::MAX_ITEMS;
        $rows = $db->all(
            "SELECT t.* $urgent ORDER BY (t.due_date < ? OR (t.due_time IS NOT NULL AND t.due_time < ?)) DESC,
             t.due_date, t.due_time IS NULL, t.due_time, t.priority, t.id DESC LIMIT $limit",
            [$me, $today, $today, "$now:00"],
        );
        $upcoming = false;
        if ($rows === []) {
            $rows = $db->all("SELECT t.* $mine AND t.due_date > ? ORDER BY t.due_date, t.due_time IS NULL, t.due_time, t.priority LIMIT 3", [$me, $today]);
            $upcoming = $rows !== [];
            $total = count($rows);
        }
        return ['items' => TaskView::summaries($app, $db, $refs, $rows), 'total' => $total, 'upcoming' => $upcoming];
    }

    /** DATABASE §7.3: due within the window, overdue included; money users only. */
    private static function paymentsDue(Db $db, Refs $refs, string $today, int $window): array
    {
        $until = (new DateTimeImmutable($today))->modify("+$window days")->format('Y-m-d');
        $where = "FROM payments p LEFT JOIN vendors v ON v.id = p.vendor_id WHERE p.deleted_at IS NULL AND p.status = 'due' AND p.due_date <= ?";
        $sum = $db->one("SELECT COUNT(*) n, COALESCE(SUM(p.amount_paise), 0) s $where", [$until]);
        $limit = self::MAX_ITEMS;
        $rows = $db->all("SELECT p.*, v.public_id AS v_pid, v.name AS v_name, v.deleted_at AS v_deleted $where ORDER BY p.due_date, p.amount_paise DESC LIMIT $limit", [$until]);
        return [
            'items' => array_map(static function (array $p) use ($today) {
                $vendor = $p['v_pid'] === null ? null : ['id' => $p['v_pid'], 'name' => $p['v_name']] + ($p['v_deleted'] !== null ? ['deleted' => true] : []);
                return [
                    'id' => $p['public_id'], 'version' => (int) $p['version'], 'title' => $p['title'],
                    'kind' => $p['vendor_id'] === null ? 'expense' : 'payment', 'amount_paise' => (int) $p['amount_paise'],
                    'status' => $p['status'], 'due_date' => $p['due_date'], 'overdue' => $p['due_date'] < $today, 'no_date' => false,
                    'vendor' => $vendor,
                ];
            }, $rows),
            'total' => (int) $sum['n'],
            'total_paise' => (int) $sum['s'],
            'window_days' => $window,
        ];
    }

    /** DATABASE §7.5 totals: Left = Planned − Spent; Free = Planned − Spent − Still to pay (negative = over). */
    private static function budget(Db $db): array
    {
        $r = $db->one(
            "SELECT s.total_budget_paise AS total,
                    (SELECT COALESCE(SUM(planned_paise), 0) FROM budget_categories WHERE deleted_at IS NULL) AS split,
                    (SELECT COALESCE(SUM(amount_paise), 0) FROM payments WHERE deleted_at IS NULL AND status = 'paid') AS spent,
                    (SELECT COALESCE(SUM(amount_paise), 0) FROM payments WHERE deleted_at IS NULL AND status = 'due') AS due
             FROM settings s WHERE s.id = 1",
        ) ?? ['total' => null, 'split' => 0, 'spent' => 0, 'due' => 0];
        $planned = (int) ($r['total'] ?? $r['split']);
        $spent = (int) $r['spent'];
        $due = (int) $r['due'];
        return [
            'planned_paise' => $planned,
            'spent_paise' => $spent,
            'still_to_pay_paise' => $due,
            'left_paise' => $planned - $spent,
            'free_paise' => $planned - $spent - $due,
            'not_yet_split_paise' => $r['total'] !== null ? max(0, (int) $r['total'] - (int) $r['split']) : 0,
        ];
    }

    /** Backup (red if > 26 h), restore drill (amber if > 35 days), items in Deleted items (DATABASE §7.6). */
    private static function safety(App $app): array
    {
        $h = new HealthService($app);
        $run = $h->run();
        $extras = $h->extras();
        return [
            'status' => $run['status'],
            'checks' => array_intersect_key($run['checks'], array_flip(['database', 'backup', 'restore_drill', 'storage'])),
            'trash_batches' => $extras['trash_batches'],
            'checked_at' => $app->clock->isoNow(),
        ];
    }

    private static function recent(Db $db, Refs $refs, array $viewer): array
    {
        $hidden = Entities::hiddenTypes();
        [$quiet, $quietArgs] = Entities::quietChildSql();
        $not = $hidden === [] ? '' : ' AND a.entity_type NOT IN (' . implode(',', array_fill(0, count($hidden), '?')) . ')';
        $rows = $db->all(
            "SELECT a.*, cb.public_id AS batch_public_id FROM audit_log a LEFT JOIN change_batches cb ON cb.id = a.batch_id WHERE $quiet$not ORDER BY a.id DESC LIMIT 10",
            [...$quietArgs, ...$hidden],
        );
        return array_map(static fn ($a) => History::line($refs, $a, Entities::forType((string) $a['entity_type']), $viewer), $rows);
    }
}
