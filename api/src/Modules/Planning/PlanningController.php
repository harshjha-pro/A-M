<?php
declare(strict_types=1);

namespace AM\Modules\Planning;

use AM\Auth\Permissions;
use AM\Auth\WorkspaceAccess;
use AM\Db\Db;
use AM\Db\UnitOfWork;
use AM\Kernel\App;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Kernel\Strings;
use AM\Modules\Events\Headcount;
use AM\Modules\Workspaces\WorkspaceDef;
use AM\Repo\BaseRepository;
use AM\Repo\Refs;
use AM\Repo\Versioned;
use AM\Safety\AuditLog;
use AM\Validation\Fields;

/**
 * Contacts, Guest details and the Event timeline of a workspace (version 1.0.20, Workspace step D).
 * Ayush and Mahi only. Every write replies with the workspace's `planning` block:
 *   POST /workspaces/{id}/contacts {vendor_id, role?}
 *   POST /workspaces/{id}/timeline {purpose, duration_min, start_time?, note?}
 *   POST /workspaces/{id}/timeline/suggested  → adds the suggested steps to an empty timeline
 *   POST /timeline-steps/{id}/move {direction: up|down}
 * Edits, deletes and restores go through BaseController (versions, Undo, History).
 */
final class PlanningController
{
    /** {contacts, also_used, guests, timeline} for GET /workspaces/{id}. */
    public static function planning(App $app, Db $db, array $ws, ?array $viewer): array
    {
        $refs = new Refs($db, $app->clock->todayIst());
        $id = (int) $ws['id'];
        $contacts = $db->all(
            'SELECT c.* FROM workspace_contacts c JOIN vendors v ON v.id = c.vendor_id
             WHERE c.workspace_id = ? AND c.deleted_at IS NULL AND v.deleted_at IS NULL ORDER BY c.sort_order, c.id', [$id]);
        return [
            'contacts' => array_map(static fn ($c) => WorkspaceContactDef::present($app, $db, $refs, $c, $viewer), $contacts),
            'also_used' => self::alsoUsed($db, $ws, array_map(static fn ($c) => (int) $c['vendor_id'], $contacts)),
            'guests' => self::guests($db, $ws),
            'timeline' => TimelineStepDef::timeline($app, $db, $refs, $id, $viewer),
        ];
    }

    /** Vendors already connected here but not added as contacts: decorator, tailor, caterer, attachment vendor, task vendor. */
    private static function alsoUsed(Db $db, array $ws, array $skip): array
    {
        $id = (int) $ws['id'];
        $where = [];
        $add = static function (?int $vendor, string $label) use (&$where, $skip): void {
            if ($vendor !== null && !in_array($vendor, $skip, true) && !in_array($label, $where[$vendor] ?? [], true)) {
                $where[$vendor][] = $label;
            }
        };
        if ($ws['caterer_id'] !== null) {
            $add((int) $ws['caterer_id'], 'Caterer');
        }
        foreach ($db->all('SELECT vendor_id, title FROM outfits WHERE workspace_id = ? AND vendor_id IS NOT NULL AND deleted_at IS NULL ORDER BY sort_order, id', [$id]) as $o) {
            $add((int) $o['vendor_id'], (string) $o['title']);
        }
        foreach ($db->all('SELECT DISTINCT a.vendor_id FROM attachment_links l JOIN attachments a ON a.id = l.attachment_id
                           WHERE l.workspace_id = ? AND l.deleted_at IS NULL AND a.deleted_at IS NULL AND a.vendor_id IS NOT NULL', [$id]) as $a) {
            $add((int) $a['vendor_id'], 'Attachment');
        }
        foreach ($db->all('SELECT DISTINCT vendor_id FROM tasks WHERE workspace_id = ? AND vendor_id IS NOT NULL AND deleted_at IS NULL', [$id]) as $t) {
            $add((int) $t['vendor_id'], 'Task');
        }
        $out = [];
        foreach ($where as $vendor => $labels) {
            $v = WorkspaceContactDef::vendor($db, $vendor);
            if ($v !== null && !isset($v['deleted'])) {
                $out[] = ['vendor' => $v, 'where' => $labels];
            }
        }
        return $out;
    }

    /** Headcount of the linked calendar event (null when none is linked or it takes no guests). */
    private static function guests(Db $db, array $ws): ?array
    {
        if ($ws['event_id'] === null) {
            return null;
        }
        $e = $db->one('SELECT * FROM events WHERE id = ? AND deleted_at IS NULL', [$ws['event_id']]);
        if ($e === null || !(bool) $e['guests_invited']) {
            return null;
        }
        $h = Headcount::forEvent($db, $e);
        $r = $db->one(
            "SELECT COALESCE(SUM(COALESCE(he.expected_adults, h.adults)), 0) AS adults, COALESCE(SUM(COALESCE(he.expected_children, h.children)), 0) AS children
             FROM household_events he JOIN households h ON h.id = he.household_id AND h.deleted_at IS NULL
             WHERE he.event_id = ? AND he.deleted_at IS NULL AND he.rsvp = 'coming'", [$e['id']]) ?? [];
        $h['adults_coming'] = (int) ($r['adults'] ?? 0);
        $h['children_coming'] = (int) ($r['children'] ?? 0);
        $h['families_waiting'] = $h['families_invited'] - $h['families_coming'] - $h['families_not_coming'];
        return $h;
    }

    public static function addContact(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        WorkspaceAccess::requireWrite($viewer);
        $f = Fields::from($request->attr('json'));
        $f->only(['vendor_id', 'role']);
        $role = $f->text('role', 120);
        $db = $app->db();
        $vendor = \AM\Modules\Outfits\OutfitParts::vendorId($db, $f);
        if ($vendor === null && !$f->hasErrors()) {
            $f->error('vendor_id', Strings::get('field_required'));
        }
        $f->fail();
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $viewer, $params, $vendor, $role): Response {
            $ws = BaseRepository::find($db, WorkspaceDef::class, $params['id'], true, false);
            $key = (string) $request->attr('idem_key');
            $retry = $key !== '' && $db->value('SELECT 1 FROM workspace_contacts WHERE client_uuid = ?', [$key]) !== null;
            if (!$retry && $db->value('SELECT 1 FROM workspace_contacts WHERE workspace_id = ? AND vendor_id = ? AND deleted_at IS NULL', [$ws['id'], $vendor]) !== null) {
                throw new \AM\Kernel\HttpError(422, 'validation_failed', Strings::get('validation_failed_one'), ['fields' => ['vendor_id' => Strings::get('contact_already_here')]]);
            }
            $order = (int) $db->value('SELECT COALESCE(MAX(sort_order), 0) + 10 FROM workspace_contacts WHERE workspace_id = ? AND deleted_at IS NULL', [$ws['id']]);
            $r = BaseRepository::create($app, $db, $request, WorkspaceContactDef::class, ['workspace_id' => (int) $ws['id'], 'vendor_id' => $vendor, 'role' => $role, 'sort_order' => $order]);
            return Response::ok(self::planning($app, $db, $ws, $viewer), $r['created'] ? 201 : 200);
        });
    }

    public static function addStep(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        WorkspaceAccess::requireWrite($viewer);
        $f = Fields::from($request->attr('json'));
        $values = TimelineStepDef::input($app, $f, true, null);
        $f->fail();
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $viewer, $params, $values): Response {
            $ws = BaseRepository::find($db, WorkspaceDef::class, $params['id'], true, false);
            $values['sort_order'] ??= (int) $db->value('SELECT COALESCE(MAX(sort_order), 0) + 10 FROM timeline_steps WHERE workspace_id = ? AND deleted_at IS NULL', [$ws['id']]);
            $r = BaseRepository::create($app, $db, $request, TimelineStepDef::class, $values + ['workspace_id' => (int) $ws['id']]);
            return Response::ok(self::planning($app, $db, $ws, $viewer), $r['created'] ? 201 : 200);
        });
    }

    /** Suggested steps for this workspace's name (or general ones); only into an empty timeline. */
    public static function suggested(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        WorkspaceAccess::requireWrite($viewer);
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $viewer, $params): Response {
            $ws = BaseRepository::find($db, WorkspaceDef::class, $params['id'], true, false);
            $key = (string) $request->attr('idem_key');
            $retry = $key !== '' && $db->value('SELECT 1 FROM timeline_steps WHERE client_uuid = ?', [$key]) !== null;
            if (!$retry) {
                if ($db->value('SELECT 1 FROM timeline_steps WHERE workspace_id = ? AND deleted_at IS NULL', [$ws['id']]) !== null) {
                    throw new \AM\Kernel\HttpError(409, 'conflict', Strings::get('timeline_not_empty'));
                }
                $steps = TimelineStepDef::SUGGESTED[mb_strtolower(trim((string) $ws['name']))] ?? TimelineStepDef::SUGGESTED[''];
                foreach ($steps as $i => [$purpose, $minutes]) {
                    $make = fn () => BaseRepository::create($app, $db, $request, TimelineStepDef::class,
                        ['workspace_id' => (int) $ws['id'], 'purpose' => $purpose, 'duration_min' => $minutes, 'sort_order' => ($i + 1) * 10]);
                    $i === 0 ? $make() : \AM\Modules\Outfits\OutfitsController::withoutKey($request, $make); // the first keeps the key, so a retry finds it
                }
            }
            return Response::ok(self::planning($app, $db, $ws, $viewer), $retry ? 200 : 201);
        });
    }

    /** Swap a step with the one above or below it (both keep their own versions and History). */
    public static function move(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        WorkspaceAccess::requireWrite($viewer);
        $f = Fields::from($request->attr('json'));
        $f->only(['direction']);
        $dir = $f->enum('direction', ['up', 'down'], true);
        $f->fail();
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $viewer, $params, $dir): Response {
            $step = BaseRepository::find($db, TimelineStepDef::class, $params['id'], true, false);
            $rows = $db->all('SELECT * FROM timeline_steps WHERE workspace_id = ? AND deleted_at IS NULL ORDER BY sort_order, id FOR UPDATE', [$step['workspace_id']]);
            $ids = array_map(static fn ($r) => (int) $r['id'], $rows);
            $at = array_search((int) $step['id'], $ids, true);
            $to = $dir === 'up' ? $at - 1 : $at + 1;
            if ($at !== false && isset($rows[$to])) {
                // Renumber 10, 20, 30… with the two swapped, so equal orders can't tie.
                [$rows[$at], $rows[$to]] = [$rows[$to], $rows[$at]];
                foreach ($rows as $i => $r) {
                    $want = ($i + 1) * 10;
                    if ((int) $r['sort_order'] !== $want) {
                        $u = Versioned::update($app, $db, $request, 'timeline_steps', TimelineStepDef::TYPE, (int) $r['id'], (int) $r['version'], ['sort_order' => $want],
                            static fn ($row) => ['id' => $row['public_id']]);
                        AuditLog::record($app, $db, $request, [
                            'action' => 'update', 'entity_type' => TimelineStepDef::TYPE, 'entity_id' => (int) $r['id'],
                            'entity_version' => (int) $u['after']['version'], 'before' => $u['before'], 'after' => $u['after'],
                        ]);
                    }
                }
            }
            $ws = $db->one('SELECT * FROM workspaces WHERE id = ?', [$step['workspace_id']]);
            return Response::ok(self::planning($app, $db, $ws, $viewer));
        });
    }

    public static function canWrite(): callable
    {
        return static fn (?array $v, string $action, ?array $row) => WorkspaceAccess::requireWrite($v);
    }
}
