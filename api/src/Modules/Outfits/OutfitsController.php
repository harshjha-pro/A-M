<?php
declare(strict_types=1);

namespace AM\Modules\Outfits;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Db\UnitOfWork;
use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Kernel\Strings;
use AM\Repo\BaseRepository;
use AM\Repo\Refs;
use AM\Validation\Fields;

/**
 * Outfits (version 1.0.18, Workspace step B; family outfits and decor items 1.0.19). Ayush and Mahi only.
 *   POST /outfits {workspace_id, person, title, vendor_id?}  → with the 4 default timeline steps
 *   GET  /outfits/{id}                           → everything on the outfit page
 *   POST /outfits/{id}/steps {name} · POST /outfits/{id}/accessories {name} · POST /notes {…_id, body}
 * Edits, deletes and restores go through BaseController (versions, Undo, History).
 */
final class OutfitsController
{
    public static function create(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireAdmin($viewer);
        $f = Fields::from($request->attr('json'));
        $f->only(['workspace_id', 'person', 'title', 'vendor_id']);
        $db = $app->db();
        $ws = is_string($f->value('workspace_id')) ? $db->value('SELECT id FROM workspaces WHERE public_id = ? AND deleted_at IS NULL', [$f->value('workspace_id')]) : null;
        if ($ws === null) {
            $f->error('workspace_id', Strings::get('field_bad_link'));
        }
        $person = $f->enum('person', array_keys(OutfitParts::PERSONS), true);
        $title = $f->text('title', 120, true);
        $vendor = OutfitParts::vendorId($db, $f);
        $f->fail();
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $viewer, $ws, $person, $title, $vendor): Response {
            $order = (int) $db->value('SELECT COALESCE(MAX(sort_order), 0) + 10 FROM outfits WHERE workspace_id = ? AND person = ? AND deleted_at IS NULL', [$ws, $person]);
            $r = BaseRepository::create($app, $db, $request, OutfitDef::class, ['workspace_id' => (int) $ws, 'person' => $person, 'title' => $title, 'vendor_id' => $vendor, 'sort_order' => $order]);
            if ($r['created']) {
                foreach (OutfitParts::defaultSteps($person) as $i => $name) {
                    self::withoutKey($request, fn () => BaseRepository::create($app, $db, $request, OutfitStepDef::class, ['outfit_id' => (int) $r['row']['id'], 'name' => $name, 'sort_order' => ($i + 1) * 10]));
                }
            }
            return self::reply($app, $db, $r['row'], $viewer, $r['created'] ? 201 : 200);
        });
    }

    public static function get(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireAdmin($viewer);
        $db = $app->db();
        $row = BaseRepository::find($db, OutfitDef::class, $params['id'], false, false);
        return self::reply($app, $db, $row, $viewer, 200);
    }

    /** The whole outfit page: card + moodboard, accessories, notes, tasks; each step with its notes and attachments. */
    public static function full(App $app, Db $db, array $row, ?array $viewer): array
    {
        $refs = new Refs($db, $app->clock->todayIst());
        $id = (int) $row['id'];
        $view = OutfitDef::present($app, $db, $refs, $row, $viewer);
        $view['steps'] = array_map(static function (array $s) use ($app, $db, $refs, $viewer) {
            $sid = (int) $db->value('SELECT id FROM outfit_steps WHERE public_id = ?', [$s['id']]);
            return $s + [
                'notes' => OutfitParts::notes($app, $db, $refs, 'outfit_step_id', $sid),
                'attachments' => OutfitParts::attachments($app, $db, $refs, 'outfit_step_id', $sid, $viewer),
                'tasks' => OutfitParts::tasks($app, $db, $refs, 'outfit_step', $sid),
            ];
        }, $view['steps']);
        $view['moodboard'] = OutfitParts::attachments($app, $db, $refs, 'outfit_id', $id, $viewer);
        $view['accessories'] = array_map(static fn ($a) => AccessoryDef::present($app, $db, $refs, $a, $viewer),
            $db->all('SELECT * FROM accessories WHERE outfit_id = ? AND deleted_at IS NULL ORDER BY sort_order, id', [$id]));
        $view['notes'] = OutfitParts::notes($app, $db, $refs, 'outfit_id', $id);
        $view['tasks'] = OutfitParts::tasks($app, $db, $refs, 'outfit', $id);
        return $view;
    }

    public static function addStep(Request $request, App $app, array $params): Response
    {
        return self::addChild($request, $app, $params, OutfitStepDef::class, 60, static fn (array $o) => [
            'sort_order' => (int) $app->db()->value('SELECT COALESCE(MAX(sort_order), 0) + 10 FROM outfit_steps WHERE outfit_id = ? AND deleted_at IS NULL', [$o['id']]),
        ]);
    }

    public static function addAccessory(Request $request, App $app, array $params): Response
    {
        return self::addChild($request, $app, $params, AccessoryDef::class, 120, static fn (array $o) => [
            'workspace_id' => (int) $o['workspace_id'], 'section' => OutfitParts::SECTION[$o['person']] ?? 'bride_outfit',
            'sort_order' => (int) $app->db()->value('SELECT COALESCE(MAX(sort_order), 0) + 10 FROM accessories WHERE outfit_id = ? AND deleted_at IS NULL', [$o['id']]),
        ]);
    }

    /** @param class-string<\AM\Repo\EntityDef> $def */
    private static function addChild(Request $request, App $app, array $params, string $def, int $max, \Closure $extra): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireAdmin($viewer);
        $f = Fields::from($request->attr('json'));
        $f->only(['name']);
        $name = $f->text('name', $max, true);
        $f->fail();
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $viewer, $params, $def, $name, $extra): Response {
            $o = BaseRepository::find($db, OutfitDef::class, $params['id'], true, false);
            BaseRepository::create($app, $db, $request, $def, ['outfit_id' => (int) $o['id'], 'name' => $name] + $extra($o));
            return self::reply($app, $db, $db->one('SELECT * FROM outfits WHERE id = ?', [$o['id']]), $viewer, 201);
        });
    }

    /** POST /notes {outfit_id | accessory_id | outfit_step_id, body} → the outfit page it belongs to. */
    public static function addNote(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireAdmin($viewer);
        $f = Fields::from($request->attr('json'));
        $values = NoteDef::input($app, $f, true, null);
        $db = $app->db();
        $place = self::target($db, $f, true, false);
        $f->fail();
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $viewer, $values, $place): Response {
            BaseRepository::create($app, $db, $request, NoteDef::class, $values + [$place['col'] => $place['id'], 'workspace_id' => $place['workspace_id']]);
            return self::reply($app, $db, $db->one('SELECT * FROM outfits WHERE id = ?', [$place['outfit_id']]), $viewer, 201);
        });
    }

    /**
     * Which outfit / accessory / step a note, attachment or task is for (exactly one given).
     * @return array{col:string, type:string, id:int, outfit_id:?int, workspace_id:int, section:string}|null
     */
    public static function target(Db $db, Fields $f, bool $required = true, bool $menu = true): ?array
    {
        $cols = $menu ? OutfitParts::TARGETS : array_diff_key(OutfitParts::TARGETS, ['menu_item' => 1, 'timeline_step' => 1]); // notes: outfits only
        $given = array_values(array_filter($cols, static fn ($col) => $f->has($col) && $f->value($col) !== null && $f->value($col) !== ''));
        if ($given === []) {
            if ($required) {
                $f->error('outfit_id', Strings::get('field_required'));
            }
            return null;
        }
        if (count($given) > 1) {
            $f->error($given[1], Strings::get('field_bad_choice'));
            return null;
        }
        $col = $given[0];
        $type = (string) array_search($col, OutfitParts::TARGETS, true);
        $v = $f->value($col);
        // 1.0.19: a dish on a workspace's menu; 1.0.20: a step of the event timeline (no outfit)
        $plain = ['menu_item_id' => ['menu_items', 'menu'], 'timeline_step_id' => ['timeline_steps', 'timeline']];
        if (isset($plain[$col])) {
            [$table, $section] = $plain[$col];
            $r = is_string($v) ? $db->one("SELECT id, workspace_id FROM `$table` WHERE public_id = ? AND deleted_at IS NULL", [$v]) : null;
            if ($r === null) {
                $f->error($col, Strings::get('field_bad_link'));
                return null;
            }
            return ['col' => $col, 'type' => $type, 'id' => (int) $r['id'], 'outfit_id' => null, 'workspace_id' => (int) $r['workspace_id'], 'section' => $section];
        }
        $sql = [
            'outfit_id' => 'SELECT o.id, o.id AS outfit_id, o.workspace_id, o.person FROM outfits o WHERE o.public_id = ? AND o.deleted_at IS NULL',
            'accessory_id' => 'SELECT a.id, o.id AS outfit_id, o.workspace_id, o.person FROM accessories a JOIN outfits o ON o.id = a.outfit_id WHERE a.public_id = ? AND a.deleted_at IS NULL AND o.deleted_at IS NULL',
            'outfit_step_id' => 'SELECT s.id, o.id AS outfit_id, o.workspace_id, o.person FROM outfit_steps s JOIN outfits o ON o.id = s.outfit_id WHERE s.public_id = ? AND s.deleted_at IS NULL AND o.deleted_at IS NULL',
        ][$col];
        $r = is_string($v) ? $db->one($sql, [$v]) : null;
        if ($r === null) {
            $f->error($col, Strings::get('field_bad_link'));
            return null;
        }
        return ['col' => $col, 'type' => $type, 'id' => (int) $r['id'], 'outfit_id' => (int) $r['outfit_id'], 'workspace_id' => (int) $r['workspace_id'],
            'section' => OutfitParts::SECTION[$r['person']] ?? 'bride_outfit'];
    }

    /** Make a row without the request's create key (the key already guards the whole call through its stored reply). */
    public static function withoutKey(Request $request, \Closure $fn): mixed
    {
        $key = $request->attributes['idem_key'] ?? null;
        $request->attributes['idem_key'] = '';
        try {
            return $fn();
        } finally {
            $request->attributes['idem_key'] = $key;
        }
    }

    public static function canWrite(): callable
    {
        return static fn (?array $v, string $action, ?array $row) => Permissions::requireAdmin($v);
    }

    private static function reply(App $app, Db $db, ?array $row, ?array $viewer, int $status): Response
    {
        if ($row === null) {
            throw HttpError::make(404, 'not_found');
        }
        $view = self::full($app, $db, $row, $viewer);
        return Response::ok($view, $status)->withHeader('ETag', '"' . $view['version'] . '"');
    }
}
