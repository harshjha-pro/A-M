<?php
declare(strict_types=1);

namespace AM\Modules\Tasks;

use AM\Db\Db;
use AM\Kernel\App;
use AM\Kernel\Request;
use AM\Kernel\Strings;
use AM\Kernel\Ulid;
use AM\Kernel\Uuid;
use AM\Repo\BaseRepository;
use AM\Repo\Refs;
use AM\Safety\AuditLog;
use AM\Safety\ChangeBatches;
use AM\Validation\Fields;
use DateTimeImmutable;

/**
 * Reads a task body (TaskCreate / TaskUpdate) and writes the child lists.
 * Lists replace the whole list (API.md PATCH /tasks/{id}): an assignee or tag
 * that is no longer listed is unlinked (its link row is soft-removed and can
 * be revived); a checklist item that is no longer listed goes to Deleted items.
 */
final class TaskWriter
{
    public const FIELDS = ['title', 'notes', 'status', 'priority', 'due_date', 'due_time', 'event_id', 'vendor_id', 'household_id',
        'assignee_ids', 'tag_ids', 'new_tags', 'items', 'allow_duplicate'];
    public const MAX_LINKS = 10;
    public const MAX_ITEMS = 100;

    /**
     * @return array{columns: array<string,mixed>, assignees: ?list<int>, tags: ?list<int>, new_tags: list<string>, items: ?list<array>}
     *   null list = not sent (unchanged)
     */
    public static function read(App $app, Db $db, Fields $f, bool $create, ?array $current): array
    {
        $f->only(self::FIELDS);
        $c = [];
        if ($create || $f->has('title')) {
            $c['title'] = $f->text('title', 200, true);
        }
        if ($create || $f->has('notes')) {
            $c['notes'] = $f->text('notes', 5000);
        }
        if ($f->has('status') || $create) {
            $c['status'] = $f->enum('status', array_keys(TaskDef::STATUS)) ?? ($create ? 'todo' : null);
            if ($c['status'] === null) {
                unset($c['status']);
            }
        }
        if ($f->has('priority') || $create) {
            $c['priority'] = $f->enum('priority', array_keys(TaskDef::PRIORITY)) ?? ($create ? 'normal' : null);
            if ($c['priority'] === null) {
                unset($c['priority']);
            }
        }
        if ($create || $f->has('due_date')) {
            $c['due_date'] = $f->date('due_date');
        }
        if ($create || $f->has('due_time')) {
            $c['due_time'] = self::time($f, 'due_time');
        }
        // A time needs a date (the final state decides; clearing the date clears the time).
        $finalDate = array_key_exists('due_date', $c) ? $c['due_date'] : ($current['due_date'] ?? null);
        $finalTime = array_key_exists('due_time', $c) ? $c['due_time'] : ($current['due_time'] ?? null);
        if ($finalDate === null && $finalTime !== null) {
            if (array_key_exists('due_time', $c) && $f->has('due_time')) {
                $f->error('due_time', Strings::get('field_time_needs_date'));
            } else {
                $c['due_time'] = null;
            }
        }
        foreach (['event_id' => 'events', 'vendor_id' => 'vendors', 'household_id' => 'households'] as $k => $table) {
            if ($create || $f->has($k)) {
                $c[$k] = self::linkId($db, $f, $k, $table);
            }
        }
        $assignees = $f->has('assignee_ids') ? self::members($db, $f, $app) : null;
        $tags = $f->has('tag_ids') ? self::tags($db, $f) : null;
        $newTags = [];
        if ($f->has('new_tags')) {
            $list = self::list($f, 'new_tags', self::MAX_LINKS);
            foreach ($list as $n) {
                $n = is_string($n) ? trim(preg_replace('/\s+/u', ' ', $n) ?? '') : '';
                if ($n === '' || mb_strlen($n) > 30) {
                    $f->error('new_tags', Strings::get('field_too_long', ['max' => 30]));
                    break;
                }
                $newTags[mb_strtolower($n)] = $n;
            }
            $newTags = array_values($newTags);
        }
        $items = $f->has('items') ? self::items($f) : null;
        return ['columns' => $c, 'assignees' => $assignees, 'tags' => $tags, 'new_tags' => $newTags, 'items' => $items];
    }

    /** "18:00" or "18:00:00" → "18:00:00". */
    private static function time(Fields $f, string $key): ?string
    {
        $v = $f->raw($key, false, 8);
        if ($v === null || $v === '') {
            return null;
        }
        if (!preg_match('/^([01]\d|2[0-3]):([0-5]\d)(?::00)?$/', $v, $m)) {
            $f->error($key, Strings::get('field_bad_time'));
            return null;
        }
        return "$m[1]:$m[2]:00";
    }

    private static function list(Fields $f, string $key, int $max): array
    {
        $v = $f->value($key);
        if ($v === null) {
            return [];
        }
        if (!is_array($v) || !array_is_list($v)) {
            $f->error($key, Strings::get('field_bad_choice'));
            return [];
        }
        if (count($v) > $max) {
            $f->error($key, Strings::get('field_too_many', ['max' => $max]));
            return [];
        }
        return $v;
    }

    private static function linkId(Db $db, Fields $f, string $key, string $table): ?int
    {
        $v = $f->value($key);
        if ($v === null || $v === '') {
            return null;
        }
        $id = is_string($v) && preg_match('/^[0-9A-HJKMNP-TV-Z]{26}$/', $v)
            ? $db->value("SELECT id FROM `$table` WHERE public_id = ? AND deleted_at IS NULL", [$v]) : null;
        if ($id === null) {
            $f->error($key, Strings::get('field_bad_link'));
            return null;
        }
        return (int) $id;
    }

    /** Active members (not left) by public id. @return list<int> */
    private static function members(Db $db, Fields $f, App $app): array
    {
        $ids = [];
        $refs = new Refs($db, $app->clock->todayIst());
        foreach (self::list($f, 'assignee_ids', self::MAX_LINKS) as $pid) {
            $u = is_string($pid) ? $db->one('SELECT id, is_active, access_ends_on FROM users WHERE public_id = ?', [$pid]) : null;
            if ($u === null || $refs->hasLeft($u)) {
                $f->error('assignee_ids', Strings::get('field_bad_member'));
                return [];
            }
            $ids[(int) $u['id']] = (int) $u['id'];
        }
        return array_values($ids);
    }

    /** @return list<int> */
    private static function tags(Db $db, Fields $f): array
    {
        $ids = [];
        foreach (self::list($f, 'tag_ids', self::MAX_LINKS) as $pid) {
            $id = is_string($pid) ? $db->value('SELECT id FROM tags WHERE public_id = ? AND deleted_at IS NULL', [$pid]) : null;
            if ($id === null) {
                $f->error('tag_ids', Strings::get('field_bad_link'));
                return [];
            }
            $ids[(int) $id] = (int) $id;
        }
        return array_values($ids);
    }

    /** @return list<array{key:string, text:string, is_done:bool, sort_order:int}> */
    private static function items(Fields $f): array
    {
        $out = [];
        foreach (self::list($f, 'items', self::MAX_ITEMS) as $i => $it) {
            $text = is_array($it) && is_string($it['text'] ?? null) ? trim($it['text']) : '';
            $key = is_array($it) && is_string($it['key'] ?? null) ? strtolower($it['key']) : '';
            if ($text === '' || mb_strlen($text) > 200 || !Uuid::isValid($key)) {
                $f->error("items.$i", $text === '' ? Strings::get('field_required') : (mb_strlen($text) > 200 ? Strings::get('field_too_long', ['max' => 200]) : Strings::get('field_bad_text')));
                continue;
            }
            $out[$key] = ['key' => $key, 'text' => $text, 'is_done' => (bool) ($it['is_done'] ?? false), 'sort_order' => (int) ($it['sort_order'] ?? $i)];
        }
        return array_values($out);
    }

    /* ---------------------------------------------------------------- writes */

    /** Live assignee ids / tag ids of a task (sorted). */
    public static function linked(Db $db, int $taskId, string $table, string $col): array
    {
        $ids = array_map('intval', array_column($db->all("SELECT `$col` FROM `$table` WHERE task_id = ? AND deleted_at IS NULL ORDER BY `$col`", [$taskId]), $col));
        return $ids;
    }

    /** Names for audit before/after: assignees ['Mummy', 'Papa'], tags ['Shopping'], and the linked event / vendor / family. */
    public static function names(Db $db, int $taskId): array
    {
        $t = $db->one('SELECT event_id, vendor_id, household_id FROM tasks WHERE id = ?', [$taskId]) ?? [];
        $name = static fn (string $table, mixed $id) => $id === null ? null : $db->value("SELECT name FROM `$table` WHERE id = ?", [(int) $id]);
        return [
            'event' => $name('events', $t['event_id'] ?? null),
            'vendor' => $name('vendors', $t['vendor_id'] ?? null),
            'household' => $name('households', $t['household_id'] ?? null),
            'assignees' => array_column($db->all('SELECT u.name FROM task_assignees a JOIN users u ON u.id = a.user_id WHERE a.task_id = ? AND a.deleted_at IS NULL ORDER BY u.name', [$taskId]), 'name'),
            'tags' => array_column($db->all('SELECT t.name FROM task_tags tt JOIN tags t ON t.id = tt.tag_id WHERE tt.task_id = ? AND tt.deleted_at IS NULL AND t.deleted_at IS NULL ORDER BY t.name', [$taskId]), 'name'),
        ];
    }

    /** Make the live links exactly $want (revives old link rows; unlinks the rest). */
    public static function syncLinks(App $app, Db $db, Request $request, int $taskId, string $table, string $col, array $want): void
    {
        $user = $request->attr('user');
        $now = $app->clock->dbNow();
        $rows = $db->all("SELECT * FROM `$table` WHERE task_id = ? FOR UPDATE", [$taskId]);
        $have = [];
        foreach ($rows as $r) {
            $have[(int) $r[$col]] = $r;
        }
        foreach ($want as $id) {
            if (!isset($have[$id])) {
                $db->run("INSERT INTO `$table` (task_id, `$col`, created_at, created_by) VALUES (?, ?, ?, ?)", [$taskId, $id, $now, $user['id'] ?? null]);
            } elseif ($have[$id]['deleted_at'] !== null) {
                $db->run("UPDATE `$table` SET deleted_at = NULL, deleted_by = NULL, delete_batch_id = NULL WHERE id = ?", [$have[$id]['id']]);
            }
        }
        foreach ($have as $id => $r) {
            if (!in_array($id, $want, true) && $r['deleted_at'] === null) {
                $db->run("UPDATE `$table` SET deleted_at = ?, deleted_by = ? WHERE id = ?", [$now, $user['id'] ?? null, $r['id']]);
            }
        }
    }

    /** New tags typed inline: reuse a live tag with that name, else create it. @return list<int> */
    public static function createTags(App $app, Db $db, Request $request, array $names): array
    {
        $ids = [];
        $user = $request->attr('user');
        foreach ($names as $n) {
            $id = $db->value('SELECT id FROM tags WHERE deleted_at IS NULL AND LOWER(name) = LOWER(?)', [$n]);
            if ($id === null) {
                $now = $app->clock->dbNow();
                $db->run('INSERT INTO tags (public_id, name, version, created_at, created_by, updated_at, updated_by) VALUES (?, ?, 1, ?, ?, ?, ?)',
                    [Ulid::generate($app->clock), $n, $now, $user['id'] ?? null, $now, $user['id'] ?? null]);
                $id = (int) $db->pdo->lastInsertId();
                AuditLog::record($app, $db, $request, ['action' => 'create', 'entity_type' => 'tag', 'entity_id' => $id, 'entity_version' => 1,
                    'after' => $db->one('SELECT * FROM tags WHERE id = ?', [$id])]);
            }
            $ids[] = (int) $id;
        }
        return $ids;
    }

    /**
     * Make the live checklist exactly $want: insert new keys, update changed ones
     * (item version + 1), and send removed ones to Deleted items in one batch.
     * @return bool anything changed
     */
    public static function syncItems(App $app, Db $db, Request $request, array $task, array $want): bool
    {
        $user = $request->attr('user');
        $now = $app->clock->dbNow();
        $live = [];
        foreach ($db->all('SELECT * FROM task_items WHERE task_id = ? AND deleted_at IS NULL FOR UPDATE', [$task['id']]) as $r) {
            $live[(string) $r['client_uuid']] = $r;
        }
        $changed = false;
        foreach ($want as $it) {
            $r = $live[$it['key']] ?? null;
            if ($r === null) {
                if ($db->value('SELECT 1 FROM task_items WHERE client_uuid = ?', [$it['key']]) !== null) {
                    continue; // that key belongs to an item elsewhere (or a deleted one): never steal it
                }
                self::insertItem($app, $db, $request, (int) $task['id'], $it);
                $changed = true;
                continue;
            }
            $set = ['text' => $it['text'], 'sort_order' => $it['sort_order'], 'is_done' => (int) $it['is_done']];
            $diff = array_filter($set, static fn ($v, $k) => (string) $r[$k] !== (string) $v, ARRAY_FILTER_USE_BOTH);
            if ($diff === []) {
                continue;
            }
            if (isset($diff['is_done'])) {
                $diff['done_at'] = $it['is_done'] ? $now : null;
                $diff['done_by'] = $it['is_done'] ? ($user['id'] ?? null) : null;
            }
            $cols = implode(', ', array_map(static fn ($k) => "`$k` = ?", array_keys($diff)));
            $db->run("UPDATE task_items SET $cols, version = version + 1, updated_at = ?, updated_by = ? WHERE id = ?", [...array_values($diff), $now, $user['id'] ?? null, $r['id']]);
            $after = $db->one('SELECT * FROM task_items WHERE id = ?', [$r['id']]);
            AuditLog::record($app, $db, $request, ['action' => 'update', 'entity_type' => 'task_item', 'entity_id' => (int) $r['id'],
                'entity_version' => (int) $after['version'], 'before' => $r, 'after' => $after]);
            $changed = true;
        }
        $wantKeys = array_column($want, 'key');
        $gone = array_filter($live, static fn ($k) => !in_array($k, $wantKeys, true), ARRAY_FILTER_USE_KEY);
        if ($gone !== []) {
            $n = count($gone);
            $what = $n === 1 ? '1 checklist item' : "$n checklist items";
            $batch = ChangeBatches::create($app, $db, $request, 'delete', 'task_item', mb_substr("$what from {$task['title']}", 0, 200));
            foreach ($gone as $r) {
                $db->run('UPDATE task_items SET deleted_at = ?, deleted_by = ?, delete_batch_id = ?, version = version + 1, updated_at = ?, updated_by = ? WHERE id = ?',
                    [$now, $user['id'] ?? null, $batch['id'], $now, $user['id'] ?? null, $r['id']]);
                $after = $db->one('SELECT * FROM task_items WHERE id = ?', [$r['id']]);
                AuditLog::record($app, $db, $request, ['action' => 'delete', 'entity_type' => 'task_item', 'entity_id' => (int) $r['id'],
                    'entity_version' => (int) $after['version'], 'batch_id' => $batch['id'], 'before' => $r, 'after' => $after]);
            }
            ChangeBatches::setCount($db, $batch['id'], $n);
            $changed = true;
        }
        return $changed;
    }

    public static function insertItem(App $app, Db $db, Request $request, int $taskId, array $it): array
    {
        $user = $request->attr('user');
        $now = $app->clock->dbNow();
        $done = (bool) ($it['is_done'] ?? false);
        $db->run('INSERT INTO task_items (client_uuid, task_id, text, is_done, done_at, done_by, sort_order, version, created_at, created_by, updated_at, updated_by)
                  VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)',
            [$it['key'], $taskId, $it['text'], (int) $done, $done ? $now : null, $done ? ($user['id'] ?? null) : null, (int) ($it['sort_order'] ?? 0),
             $now, $user['id'] ?? null, $now, $user['id'] ?? null]);
        $row = $db->one('SELECT * FROM task_items WHERE id = ?', [(int) $db->pdo->lastInsertId()]);
        AuditLog::record($app, $db, $request, ['action' => 'create', 'entity_type' => 'task_item', 'entity_id' => (int) $row['id'], 'entity_version' => 1, 'after' => $row]);
        return $row;
    }

    /** "12 Oct" → "19 Oct" note for a postpone. */
    public static function postponeNote(string $from, string $to): string
    {
        $f = static fn (string $d) => (new DateTimeImmutable($d))->format('j M');
        return 'Postponed from ' . $f($from) . ' to ' . $f($to);
    }

    /** Duplicate check (FEATURES B3): an open live task with the same title, ignoring case. */
    public static function similarOpen(Db $db, string $title): ?array
    {
        return $db->one("SELECT public_id, title FROM tasks WHERE deleted_at IS NULL AND status IN ('todo','doing','waiting') AND LOWER(title) = LOWER(?) ORDER BY id DESC LIMIT 1", [$title]);
    }

    public static function table(): string
    {
        return BaseRepository::table(TaskDef::class);
    }
}
