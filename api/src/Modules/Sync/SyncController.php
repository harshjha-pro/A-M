<?php
declare(strict_types=1);

namespace AM\Modules\Sync;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\RateLimiter;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Kernel\Time;
use AM\Modules\Documents\DocumentDef;
use AM\Modules\Events\EventDef;
use AM\Modules\Guests\Duplicates;
use AM\Modules\Guests\HouseholdView;
use AM\Modules\Members\MembersController;
use AM\Modules\Members\MemberView;
use AM\Modules\Money\BudgetCategoryDef;
use AM\Modules\Money\PaymentDef;
use AM\Modules\Money\VendorDef;
use AM\Modules\Settings\SettingsController;
use AM\Modules\Tasks\TagDef;
use AM\Modules\Tasks\TaskView;
use AM\Repo\Refs;
use DateTimeImmutable;
use DateTimeZone;

/**
 * GET /sync — fills the phone's read-only offline cache (API.md §9.2, PWA.md §5.1).
 * Every row is shaped exactly like the normal endpoints' reply and filtered by the same
 * rules (money only for $, private documents only for admins), so a screen shows the
 * same thing online and offline.
 *
 *   Small sets (settings, members, events, tags, budget categories) come whole on the
 *   first page of every sync: a few dozen rows, and some of their numbers (category
 *   spent) move without their own updated_at changing.
 *   Large sets (households with their invitations, tasks with their checklists,
 *   vendors, payments, documents) come as changes since `since` (updated_at >= since,
 *   or a child changed), paged by id with a cursor.
 *   `deleted` lists rows whose deleted_at >= since (first page only).
 *   next_since = server_time − 120 s (the overlap catches saves that committed late).
 *   full_resync_required: since older than 30 days, or this person's role, money access,
 *   active state or end date changed after since (audit role_change) — rows they can no longer see can't be listed
 *   as deleted safely, so the phone starts again.
 */
final class SyncController
{
    public const QUERY = ['since', 'cursor', 'limit', 'types'];
    public const SMALL = ['settings', 'members', 'events', 'tags', 'budget_categories'];
    public const LARGE = ['households', 'tasks', 'vendors', 'payments', 'documents'];
    public const MONEY = ['payments', 'budget_categories'];
    private const OVERLAP = 120;
    private const MAX_AGE = 30 * 86400;

    public static function sync(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        $q = $request->query;
        $limit = self::limit($q);
        $types = self::types($q, $viewer);
        $db = $app->db();
        $nowTs = $app->clock->now()->getTimestamp();

        $cursor = self::readCursor($q);
        if ($cursor === null) {
            (new RateLimiter($app))->hit('sync:user:' . $viewer['id'], 30, 300); // pages of one sync count once
        }
        $serverTs = $cursor['st'] ?? $nowTs;
        $since = $cursor['since'] ?? self::since($q);
        $sinceDb = $since === null ? null : gmdate('Y-m-d H:i:s', $since);

        $base = [
            'server_time' => gmdate('Y-m-d\TH:i:s\Z', $serverTs),
            'next_since' => gmdate('Y-m-d\TH:i:s\Z', $serverTs - self::OVERLAP),
        ];
        if ($cursor === null && $since !== null && self::mustRestart($db, $viewer, $since, $nowTs)) {
            return Response::ok($base + ['has_more' => false, 'cursor' => null, 'full_resync_required' => true, 'changes' => self::emptyChanges($types), 'deleted' => []]);
        }

        $refs = new Refs($db, $app->clock->todayIst());
        $changes = self::emptyChanges($types);
        $deleted = [];
        if ($cursor === null) {
            foreach (array_intersect(self::SMALL, $types) as $t) {
                $changes[$t] = self::small($app, $db, $refs, $t, $viewer);
            }
            if ($sinceDb !== null) {
                $deleted = self::deleted($db, $viewer, $types, $sinceDb);
            }
        }

        // Large sets, in a fixed order, resuming where the cursor left off.
        $large = array_values(array_intersect(self::LARGE, $types));
        $ti = (int) ($cursor['t'] ?? 0);
        $after = (int) ($cursor['a'] ?? 0);
        $room = $limit;
        $next = null;
        while ($ti < count($large) && $room > 0) {
            $t = $large[$ti];
            [$rows, $lastId, $more] = self::large($app, $db, $refs, $t, $viewer, $sinceDb, $after, $room);
            $changes[$t] = array_merge($changes[$t], $rows);
            $room -= count($rows);
            if ($more) {
                $next = ['t' => $ti, 'a' => $lastId, 'st' => $serverTs, 'since' => $since];
                break;
            }
            $ti++;
            $after = 0;
        }
        if ($next === null && $ti < count($large)) {
            $next = ['t' => $ti, 'a' => 0, 'st' => $serverTs, 'since' => $since];
        }
        return Response::ok($base + [
            'has_more' => $next !== null,
            'cursor' => $next === null ? null : rtrim(strtr(base64_encode((string) json_encode($next)), '+/', '-_'), '='),
            'full_resync_required' => false,
            'changes' => $changes,
            'deleted' => $deleted,
        ]);
    }

    private static function limit(array $q): int
    {
        $l = (string) ($q['limit'] ?? '500');
        if (!ctype_digit($l) || (int) $l < 1 || (int) $l > 1000) {
            throw HttpError::make(400, 'bad_request');
        }
        return (int) $l;
    }

    /** The asked types the viewer may have (money types only for $). */
    private static function types(array $q, ?array $viewer): array
    {
        $all = [...self::SMALL, ...self::LARGE];
        $asked = isset($q['types']) && $q['types'] !== '' ? array_map('trim', explode(',', (string) $q['types'])) : $all;
        foreach ($asked as $t) {
            if (!in_array($t, $all, true)) {
                throw HttpError::make(400, 'bad_request');
            }
        }
        return array_values(array_filter($all, static fn ($t) => in_array($t, $asked, true)
            && (!in_array($t, self::MONEY, true) || Permissions::canSeeMoney($viewer))));
    }

    private static function since(array $q): ?int
    {
        if (!isset($q['since']) || $q['since'] === '') {
            return null;
        }
        $s = (string) $q['since'];
        if (!preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/', $s)) {
            throw HttpError::make(400, 'bad_request');
        }
        return (new DateTimeImmutable($s, new DateTimeZone('UTC')))->getTimestamp();
    }

    private static function readCursor(array $q): ?array
    {
        if (!isset($q['cursor']) || $q['cursor'] === '') {
            return null;
        }
        $raw = base64_decode(strtr((string) $q['cursor'], '-_', '+/'), true);
        $c = $raw === false ? null : json_decode($raw, true);
        if (!is_array($c) || !is_int($c['t'] ?? null) || !is_int($c['a'] ?? null) || !is_int($c['st'] ?? null) || !(is_int($c['since'] ?? null) || ($c['since'] ?? null) === null)) {
            throw HttpError::make(400, 'bad_request');
        }
        return $c;
    }

    private static function mustRestart(Db $db, array $viewer, int $since, int $now): bool
    {
        if ($since < $now - self::MAX_AGE) {
            return true;
        }
        // Role, money access, active or end date changed (MembersController logs those as role_change).
        return $db->value(
            "SELECT 1 FROM audit_log WHERE entity_type = 'user' AND entity_id = ? AND action = 'role_change' AND created_at >= ? LIMIT 1",
            [$viewer['id'], gmdate('Y-m-d H:i:s', $since)],
        ) !== null;
    }

    private static function emptyChanges(array $types): array
    {
        $out = [];
        foreach ([...self::SMALL, ...self::LARGE] as $t) {
            if (in_array($t, $types, true)) {
                $out[$t] = $t === 'settings' ? null : [];
            }
        }
        return $out;
    }

    private static function small(App $app, Db $db, Refs $refs, string $t, array $viewer): array|null
    {
        switch ($t) {
            case 'settings':
                $s = $db->one('SELECT * FROM settings WHERE id = 1');
                return $s === null ? null : SettingsController::present($db, $refs, $s, $viewer);
            case 'members':
                $admin = Permissions::isAdmin($viewer);
                return array_map(
                    static fn (array $u) => $admin ? MemberView::full($db, $refs, $u) : MemberView::limited($refs, $u),
                    $db->all('SELECT * FROM users WHERE deleted_at IS NULL AND is_active = 1 ORDER BY ' . MembersController::ROLE_ORDER . ', name, id'),
                );
            case 'events':
                return array_map(static fn ($r) => EventDef::present($app, $db, $refs, $r, $viewer),
                    $db->all('SELECT * FROM events WHERE deleted_at IS NULL ORDER BY start_at IS NULL, start_at, sort_order, id'));
            case 'tags':
                return array_map(static fn ($r) => TagDef::present($app, $db, $refs, $r, $viewer),
                    $db->all('SELECT * FROM tags WHERE deleted_at IS NULL ORDER BY name, id'));
            case 'budget_categories':
                return array_map(static fn ($r) => BudgetCategoryDef::present($app, $db, $refs, $r, $viewer),
                    $db->all('SELECT * FROM budget_categories WHERE deleted_at IS NULL ORDER BY sort_order, id'));
        }
        return [];
    }

    /**
     * One page of a large set: live rows changed since (or all, for a full sync), id > $after.
     * @return array{0: list<array>, 1: int, 2: bool} rows, last internal id, more after this page
     */
    private static function large(App $app, Db $db, Refs $refs, string $t, array $viewer, ?string $since, int $after, int $limit): array
    {
        $take = $limit + 1;
        $args = [$after];
        $changed = '';
        switch ($t) {
            case 'households':
                if ($since !== null) {
                    // A changed or removed invitation resends its family (families carry their invitations).
                    $changed = ' AND (h.updated_at >= ? OR EXISTS (SELECT 1 FROM household_events he WHERE he.household_id = h.id AND (he.updated_at >= ? OR he.deleted_at >= ?)))';
                    array_push($args, $since, $since, $since);
                }
                $rows = $db->all('SELECT h.*, ' . Duplicates::sharedPhoneSql('h') . " AS dup FROM households h WHERE h.deleted_at IS NULL AND h.id > ?$changed ORDER BY h.id LIMIT $take", $args);
                [$rows, $more] = self::cut($rows, $limit);
                return [HouseholdView::summaries($db, $refs, $rows, null), self::lastId($rows, $after), $more];
            case 'tasks':
                if ($since !== null) {
                    $changed = ' AND (t.updated_at >= ?'
                        . ' OR EXISTS (SELECT 1 FROM task_items i WHERE i.task_id = t.id AND (i.updated_at >= ? OR i.deleted_at >= ?))'
                        . ' OR EXISTS (SELECT 1 FROM task_assignees a WHERE a.task_id = t.id AND (a.created_at >= ? OR a.deleted_at >= ?))'
                        . ' OR EXISTS (SELECT 1 FROM task_tags g WHERE g.task_id = t.id AND (g.created_at >= ? OR g.deleted_at >= ?)))';
                    array_push($args, $since, $since, $since, $since, $since, $since, $since);
                }
                $rows = $db->all("SELECT t.* FROM tasks t WHERE t.deleted_at IS NULL AND t.id > ?$changed ORDER BY t.id LIMIT $take", $args);
                [$rows, $more] = self::cut($rows, $limit);
                return [array_map(static fn ($r) => TaskView::full($app, $db, $refs, $r), $rows), self::lastId($rows, $after), $more];
            case 'vendors':
            case 'payments':
                if ($since !== null) {
                    $changed = ' AND x.updated_at >= ?';
                    $args[] = $since;
                }
                $rows = $db->all("SELECT x.* FROM `$t` x WHERE x.deleted_at IS NULL AND x.id > ?$changed ORDER BY x.id LIMIT $take", $args);
                [$rows, $more] = self::cut($rows, $limit);
                $def = $t === 'vendors' ? VendorDef::class : PaymentDef::class;
                return [array_map(static fn ($r) => $def::present($app, $db, $refs, $r, $viewer), $rows), self::lastId($rows, $after), $more];
            case 'documents':
                [$vis, $vargs] = DocumentDef::visibleSql($viewer, 'd');
                $where = ['d.deleted_at IS NULL', 'd.id > ?', $vis];
                $args = array_merge($args, $vargs);
                if ($since !== null) {
                    $where[] = 'd.updated_at >= ?';
                    $args[] = $since;
                }
                $rows = $db->all('SELECT d.* FROM documents d WHERE ' . implode(' AND ', $where) . " ORDER BY d.id LIMIT $take", $args);
                [$rows, $more] = self::cut($rows, $limit);
                return [array_map(static fn ($r) => DocumentDef::present($app, $db, $refs, $r, $viewer), $rows), self::lastId($rows, $after), $more];
        }
        return [[], $after, false];
    }

    /** @return array{0: list<array>, 1: bool} */
    private static function cut(array $rows, int $limit): array
    {
        $more = count($rows) > $limit;
        return [$more ? array_slice($rows, 0, $limit) : $rows, $more];
    }

    private static function lastId(array $rows, int $after): int
    {
        return $rows === [] ? $after : (int) end($rows)['id'];
    }

    /** Rows removed since `since` that this person could see. */
    private static function deleted(Db $db, array $viewer, array $types, string $since): array
    {
        $map = [
            'tasks' => ['tasks', 'task'], 'households' => ['households', 'household'], 'events' => ['events', 'event'],
            'vendors' => ['vendors', 'vendor'], 'payments' => ['payments', 'payment'], 'documents' => ['documents', 'document'],
            'tags' => ['tags', 'tag'], 'budget_categories' => ['budget_categories', 'budget_category'],
        ];
        $out = [];
        foreach ($map as $type => [$table, $single]) {
            if (!in_array($type, $types, true)) {
                continue;
            }
            $extra = '';
            $args = [$since];
            if ($type === 'documents') {
                [$vis, $vargs] = DocumentDef::visibleSql($viewer, 'x');
                $extra = ' AND ' . $vis;
                $args = array_merge($args, $vargs);
            }
            foreach ($db->all("SELECT x.public_id, x.deleted_at FROM `$table` x WHERE x.deleted_at >= ?$extra ORDER BY x.deleted_at, x.id", $args) as $r) {
                $out[] = ['type' => $single, 'id' => $r['public_id'], 'deleted_at' => Time::iso($r['deleted_at'])];
            }
        }
        return $out;
    }
}
