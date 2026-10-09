<?php
declare(strict_types=1);

namespace AM\Modules\Guests;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Db\UnitOfWork;
use AM\Http\BaseController;
use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\RateLimiter;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Kernel\Strings;
use AM\Modules\Events\InvitationDef;
use AM\Repo\BaseRepository;
use AM\Repo\Refs;
use AM\Safety\AuditLog;
use AM\Safety\ChangeBatches;
use AM\Validation\Fields;
use DateTimeImmutable;
use DateTimeZone;

/**
 * POST /households/bulk (API.md §6.7, FEATURES B5): one action on up to 2,000
 * families, one batch, one Undo. Rows changed after `as_of` are skipped and named
 * (DATABASE rule 10). Invite never touches an existing answer (AC-GST-05).
 * Everyone who edits may bulk-invite, remove, set Coming? and side; delete is admin-only (decision 31).
 */
final class BulkController
{
    public const MAX = 2000;
    public const ACTIONS = ['invite', 'uninvite', 'set_rsvp', 'set_side', 'delete'];

    public static function run(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireEditor($viewer);
        $f = Fields::from($request->attr('json'));
        $f->only(['action', 'event_id', 'rsvp', 'side', 'as_of', 'ids', 'filter']);
        $action = $f->enum('action', self::ACTIONS, true);
        if ($action === 'delete') {
            Permissions::requireAdmin($viewer);
        }
        $asOf = self::asOf($f);
        $rsvp = $action === 'set_rsvp' ? $f->enum('rsvp', array_keys(InvitationDef::RSVP), true) : null;
        $side = $action === 'set_side' ? $f->enum('side', array_keys(HouseholdDef::SIDES), true) : null;
        $db = $app->db();
        $event = null;
        if (in_array($action, ['invite', 'uninvite', 'set_rsvp'], true)) {
            $eid = $f->value('event_id');
            $event = is_string($eid) ? $db->one('SELECT * FROM events WHERE public_id = ? AND deleted_at IS NULL', [$eid]) : null;
            if ($event === null) {
                $f->error('event_id', Strings::get('bulk_needs_event'));
            } elseif ($action === 'invite' && !(int) $event['guests_invited']) {
                $f->error('event_id', Strings::get('event_no_guests'));
            }
        }
        $f->fail();
        (new RateLimiter($app))->hit('bulk:user:' . $viewer['id'], 10, 600); // API.md §10.1: bulk and import, 10 per 10 min
        $targets = self::targets($db, $f);

        $summaryFor = static function (int $count) use ($action, $event, $rsvp, $side): string {
            $label = $count === 1 ? '1 family' : number_format($count) . ' families';
            return match ($action) {
                'invite' => "Invited $label to {$event['name']}",
                'uninvite' => "Removed $label from {$event['name']}",
                'set_rsvp' => 'Set ' . InvitationDef::RSVP[$rsvp] . " for $label · {$event['name']}",
                'set_side' => 'Changed side to ' . HouseholdDef::SIDES[$side] . " for $label",
                'delete' => "Deleted $label",
            };
        };
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $action, $event, $rsvp, $asOf, $side, $targets, $summaryFor): Response {
            $type = in_array($action, ['set_side', 'delete'], true) ? 'household' : 'invitation';
            $batch = ChangeBatches::create($app, $db, $request, $action === 'delete' ? 'delete' : 'bulk_update', $type, $summaryFor(count($targets)));
            $refs = new Refs($db, $app->clock->todayIst());
            $affected = 0;
            $skipped = [];
            $skip = static function (array $h, string $reason, ?int $by = null) use (&$skipped, $refs): void {
                $skipped[] = ['id' => $h['public_id'], 'name' => $h['name'], 'reason' => $reason, 'changed_by' => $refs->user($by)];
            };
            foreach ($targets as $id) {
                $h = $db->one('SELECT * FROM households WHERE id = ? FOR UPDATE', [$id]);
                if ($h === null || $h['deleted_at'] !== null) {
                    if ($h !== null) {
                        $skip($h, 'deleted', $h['deleted_by'] !== null ? (int) $h['deleted_by'] : null);
                    }
                    continue;
                }
                if (in_array($action, ['set_side', 'delete'], true)) {
                    if ($h['updated_at'] >= $asOf) {
                        $skip($h, 'changed_since_loaded', $h['updated_by'] !== null ? (int) $h['updated_by'] : null);
                        continue;
                    }
                    if ($action === 'delete') {
                        BaseRepository::softDeleteInBatch($app, $db, $request, HouseholdDef::class, $h, $batch['id']);
                        $affected++;
                    } elseif ($h['side'] !== $side) {
                        self::setColumns($app, $db, $request, 'households', 'household', $h, ['side' => $side], $batch['id']);
                        $affected++;
                    }
                    continue;
                }
                if ($action === 'invite') {
                    $r = Invitations::invite($app, $db, $request, $h, $event, [], $batch['id'], false);
                    if ($r['status'] === 'unchanged') {
                        $skip($h, 'already_invited');
                    } else {
                        $affected++;
                    }
                    continue;
                }
                $inv = $db->one('SELECT * FROM household_events WHERE household_id = ? AND event_id = ? AND deleted_at IS NULL FOR UPDATE', [$h['id'], $event['id']]);
                if ($inv === null) {
                    $skip($h, 'not_invited');
                    continue;
                }
                if ($inv['updated_at'] >= $asOf) {
                    $skip($h, 'changed_since_loaded', $inv['updated_by'] !== null ? (int) $inv['updated_by'] : null);
                    continue;
                }
                if ($action === 'uninvite') {
                    BaseRepository::softDeleteInBatch($app, $db, $request, InvitationDef::class, $inv, $batch['id']);
                    $affected++;
                } elseif ($inv['rsvp'] !== $rsvp) {
                    $now = $app->clock->dbNow();
                    self::setColumns($app, $db, $request, 'household_events', 'invitation', $inv,
                        ['rsvp' => $rsvp, 'rsvp_updated_at' => $now, 'rsvp_updated_by' => $request->attr('user')['id']], $batch['id']);
                    $affected++;
                }
            }
            ChangeBatches::setCount($db, $batch['id'], $affected);
            $summary = $summaryFor($affected); // what really changed, not what was chosen
            $db->run('UPDATE change_batches SET summary = ? WHERE id = ?', [mb_substr($summary, 0, 200), $batch['id']]);
            $meta = $affected > 0 ? ['undo' => BaseController::undoMeta($app, $batch['public_id'], $summary)] : [];
            return Response::ok(['affected' => $affected, 'skipped' => $skipped, 'batch_id' => $batch['public_id']], 200, $meta);
        });
    }

    /** One version-bumped, audited change inside the batch (so Undo can put it back). */
    private static function setColumns(App $app, Db $db, Request $request, string $table, string $type, array $row, array $changes, int $batchId): void
    {
        $set = [];
        $args = [];
        foreach ($changes as $col => $v) {
            if (!preg_match('/^[a-z_]+$/', $col)) {
                throw new \LogicException('Bad column');
            }
            $set[] = "`$col` = ?";
            $args[] = $v;
        }
        $user = $request->attr('user');
        $db->run("UPDATE `$table` SET " . implode(', ', $set) . ', version = version + 1, updated_at = ?, updated_by = ? WHERE id = ?',
            [...$args, $app->clock->dbNow(), $user['id'] ?? null, $row['id']]);
        $after = $db->one("SELECT * FROM `$table` WHERE id = ?", [$row['id']]);
        AuditLog::record($app, $db, $request, [
            'action' => 'update', 'entity_type' => $type, 'entity_id' => (int) $row['id'],
            'entity_version' => (int) $after['version'], 'batch_id' => $batchId, 'before' => $row, 'after' => $after,
        ]);
    }

    /** as_of: when the phone loaded the list (ISO with Z or offset) → UTC "Y-m-d H:i:s". */
    private static function asOf(Fields $f): string
    {
        $v = $f->raw('as_of', true, 40);
        if ($v !== null && preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/', $v)) {
            try {
                return (new DateTimeImmutable($v))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
            } catch (\Exception) {
                // fall through
            }
        }
        if ($v !== null) {
            $f->error('as_of', Strings::get('field_bad_datetime'));
        }
        return '1970-01-01 00:00:00';
    }

    /** Family ids from `ids` (≤ 2,000) or `filter` (same keys as the list, applied here). @return list<int> */
    private static function targets(Db $db, Fields $f): array
    {
        $ids = $f->value('ids');
        $filter = $f->value('filter');
        if (($ids === null) === ($filter === null)) {
            $f->error('ids', Strings::get('field_required'));
            $f->fail();
        }
        if ($ids !== null) {
            if (!is_array($ids) || !array_is_list($ids)) {
                $f->error('ids', Strings::get('field_bad_choice'));
                $f->fail();
            }
            $ids = array_values(array_unique(array_filter($ids, static fn ($x) => is_string($x) && preg_match('/^[0-9A-HJKMNP-TV-Z]{26}$/', $x))));
            if (count($ids) > self::MAX) {
                throw new HttpError(422, 'validation_failed', Strings::get('bulk_too_many'), ['fields' => ['ids' => Strings::get('bulk_too_many')]]);
            }
            if ($ids === []) {
                return [];
            }
            $in = implode(',', array_fill(0, count($ids), '?'));
            return array_map('intval', array_column($db->all("SELECT id FROM households WHERE public_id IN ($in) ORDER BY name, id", $ids), 'id'));
        }
        if (!is_array($filter) || array_is_list($filter) && $filter !== []) {
            $f->error('filter', Strings::get('field_bad_choice'));
            $f->fail();
        }
        $q = [];
        foreach (array_intersect_key($filter, array_flip(array_diff(HouseholdsController::QUERY, ['sort', 'limit', 'cursor']))) as $k => $v) {
            $q[$k] = is_bool($v) ? ($v ? 'true' : 'false') : (is_array($v) ? implode(',', array_map('strval', $v)) : (string) $v);
        }
        [$where, $args] = HouseholdsController::filters($db, $q);
        $rows = $db->all('SELECT h.id FROM households h WHERE ' . implode(' AND ', $where) . ' ORDER BY h.name, h.id LIMIT ' . (self::MAX + 1), $args);
        if (count($rows) > self::MAX) {
            throw new HttpError(422, 'validation_failed', Strings::get('bulk_too_many'), ['fields' => ['filter' => Strings::get('bulk_too_many')]]);
        }
        return array_map('intval', array_column($rows, 'id'));
    }
}
