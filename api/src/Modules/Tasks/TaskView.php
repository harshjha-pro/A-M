<?php
declare(strict_types=1);

namespace AM\Modules\Tasks;

use AM\Db\Db;
use AM\Kernel\App;
use AM\Kernel\Time;
use AM\Repo\Refs;
use DateTimeZone;

/** How a task looks in replies (API.md Task, list rows) and the IST date rules (FEATURES B3). */
final class TaskView
{
    /** One task with assignees, tags and checklist. */
    public static function full(App $app, Db $db, Refs $refs, array $row): array
    {
        $out = self::summaries($app, $db, $refs, [$row])[0];
        unset($out['item_count'], $out['items_done']);
        $items = $db->all('SELECT * FROM task_items WHERE task_id = ? AND deleted_at IS NULL ORDER BY sort_order, id', [$row['id']]);
        return array_slice($out, 0, 3, true) + ['notes' => $row['notes']] + array_slice($out, 3, null, true) + [
            'items' => array_map(static fn ($i) => TaskItemDef::present($app, $db, $refs, $i, null), $items),
        ];
    }

    /** List rows, with assignees, tags and checklist counts loaded in a few queries. */
    public static function summaries(App $app, Db $db, Refs $refs, array $rows): array
    {
        if ($rows === []) {
            return [];
        }
        $ids = array_map(static fn ($r) => (int) $r['id'], $rows);
        $in = implode(',', $ids);
        $assignees = [];
        foreach ($db->all("SELECT task_id, user_id FROM task_assignees WHERE task_id IN ($in) AND deleted_at IS NULL ORDER BY id") as $a) {
            $assignees[(int) $a['task_id']][] = $refs->user((int) $a['user_id']);
        }
        $tags = [];
        foreach ($db->all("SELECT tt.task_id, t.public_id, t.name FROM task_tags tt JOIN tags t ON t.id = tt.tag_id
                           WHERE tt.task_id IN ($in) AND tt.deleted_at IS NULL AND t.deleted_at IS NULL ORDER BY t.name") as $t) {
            $tags[(int) $t['task_id']][] = ['id' => $t['public_id'], 'name' => $t['name']];
        }
        $counts = [];
        foreach ($db->all("SELECT task_id, COUNT(*) n, SUM(is_done) d FROM task_items WHERE task_id IN ($in) AND deleted_at IS NULL GROUP BY task_id") as $c) {
            $counts[(int) $c['task_id']] = [(int) $c['n'], (int) $c['d']];
        }
        [$today, $nowTime] = self::istNow($app);
        return array_map(static function (array $r) use ($db, $refs, $assignees, $tags, $counts, $today, $nowTime) {
            $id = (int) $r['id'];
            return [
                'id' => $r['public_id'],
                'version' => (int) $r['version'],
                'title' => $r['title'],
                'status' => $r['status'],
                'priority' => $r['priority'],
                'due_date' => $r['due_date'],
                'due_time' => $r['due_time'] === null ? null : substr((string) $r['due_time'], 0, 5),
                'overdue' => self::isOverdue($r, $today, $nowTime),
                'due_today' => in_array($r['status'], TaskDef::OPEN, true) && $r['due_date'] === $today,
                'postpone_count' => (int) $r['postpone_count'],
                'event' => self::link($db, 'events', $r['event_id']),
                'vendor' => self::link($db, 'vendors', $r['vendor_id']),
                'household' => self::link($db, 'households', $r['household_id']),
                'assignees' => array_values(array_filter($assignees[$id] ?? [])),
                'tags' => $tags[$id] ?? [],
                'item_count' => $counts[$id][0] ?? 0,
                'items_done' => $counts[$id][1] ?? 0,
                'completed_at' => Time::iso($r['completed_at']),
                'completed_by' => $refs->user($r['completed_by'] !== null ? (int) $r['completed_by'] : null),
                'created_at' => Time::iso($r['created_at']),
                'created_by' => $refs->user($r['created_by'] !== null ? (int) $r['created_by'] : null),
                'updated_at' => Time::iso($r['updated_at']),
                'updated_by' => $refs->user($r['updated_by'] !== null ? (int) $r['updated_by'] : null),
            ];
        }, $rows);
    }

    /**
     * Overdue (FEATURES B3): open, and either no time and the date is before today,
     * or date + time (IST) is before now.
     */
    public static function isOverdue(array $r, string $today, string $nowTime): bool
    {
        if (!in_array($r['status'], TaskDef::OPEN, true) || $r['due_date'] === null) {
            return false;
        }
        if ($r['due_date'] < $today) {
            return true;
        }
        return $r['due_date'] === $today && $r['due_time'] !== null && substr((string) $r['due_time'], 0, 5) < $nowTime;
    }

    /** @return array{0:string, 1:string} today (Y-m-d) and the time now (H:i) in India */
    public static function istNow(App $app): array
    {
        $ist = $app->clock->now()->setTimezone(new DateTimeZone('Asia/Kolkata'));
        return [$ist->format('Y-m-d'), $ist->format('H:i')];
    }

    /** {id, name} or {id, name, deleted: true} for a linked event, vendor or family. */
    private static function link(Db $db, string $table, mixed $id): ?array
    {
        if ($id === null || !in_array($table, ['events', 'vendors', 'households'], true)) {
            return null;
        }
        $r = $db->one("SELECT public_id, name, deleted_at FROM `$table` WHERE id = ?", [(int) $id]);
        if ($r === null) {
            return null;
        }
        $ref = ['id' => $r['public_id'], 'name' => $r['name']];
        if ($r['deleted_at'] !== null) {
            $ref['deleted'] = true;
        }
        return $ref;
    }
}
