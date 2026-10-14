<?php
declare(strict_types=1);

namespace AM\Modules\Menu;

use AM\Auth\Permissions;
use AM\Auth\WorkspaceAccess;
use AM\Db\Db;
use AM\Db\UnitOfWork;
use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Kernel\Strings;
use AM\Modules\Workspaces\WorkspaceDef;
use AM\Repo\BaseRepository;
use AM\Repo\Refs;
use AM\Safety\ChangeBatches;
use AM\Validation\Fields;

/**
 * The menu of a workspace (version 1.0.19, Workspace step C). Ayush and Mahi only.
 *   GET  /workspaces/{id}/menu                       → {caterer, categories:[{…, items:[…]}]}
 *   POST /workspaces/{id}/menu-categories {name}
 *   POST /menu-categories/{id}/items {name, diet?, is_must_have?, note?}
 *   POST /workspaces/{id}/menu/copy {from_workspace_id}  → adds the other menu here (one Undo)
 * Edits, deletes and restores go through BaseController (versions, Undo, History).
 * Every write replies with the whole menu.
 */
final class MenuController
{
    public static function get(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        WorkspaceAccess::requireView($viewer);
        $db = $app->db();
        $ws = BaseRepository::find($db, WorkspaceDef::class, $params['id'], false, false);
        return Response::ok(self::menu($app, $db, $ws, $viewer));
    }

    /** @return array{workspace_id:string, caterer:?array, counts:array, categories:list<array>} */
    public static function menu(App $app, Db $db, array $ws, ?array $viewer): array
    {
        $refs = new Refs($db, $app->clock->todayIst());
        $cats = $db->all('SELECT * FROM menu_categories WHERE workspace_id = ? AND deleted_at IS NULL ORDER BY sort_order, id', [$ws['id']]);
        return [
            'workspace_id' => $ws['public_id'],
            'caterer' => $refs->row('vendors', $ws['caterer_id'] !== null ? (int) $ws['caterer_id'] : null),
            'counts' => [
                'items' => (int) $db->value('SELECT COUNT(*) FROM menu_items WHERE workspace_id = ? AND deleted_at IS NULL', [$ws['id']]),
                'jain' => (int) $db->value("SELECT COUNT(*) FROM menu_items WHERE workspace_id = ? AND deleted_at IS NULL AND diet = 'jain'", [$ws['id']]),
            ],
            'categories' => array_map(static fn ($c) => MenuCategoryDef::present($app, $db, $refs, $c, $viewer), $cats),
        ];
    }

    public static function addCategory(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        WorkspaceAccess::requireWrite($viewer);
        $f = Fields::from($request->attr('json'));
        $values = MenuCategoryDef::input($app, $f, true, null);
        $f->fail();
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $viewer, $params, $values): Response {
            $ws = BaseRepository::find($db, WorkspaceDef::class, $params['id'], true, false);
            $values['sort_order'] ??= (int) $db->value('SELECT COALESCE(MAX(sort_order), 0) + 10 FROM menu_categories WHERE workspace_id = ? AND deleted_at IS NULL', [$ws['id']]);
            $r = BaseRepository::create($app, $db, $request, MenuCategoryDef::class, $values + ['workspace_id' => (int) $ws['id']]);
            return Response::ok(self::menu($app, $db, $ws, $viewer), $r['created'] ? 201 : 200);
        });
    }

    public static function addItem(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        WorkspaceAccess::requireWrite($viewer);
        $f = Fields::from($request->attr('json'));
        $values = MenuItemDef::input($app, $f, true, null);
        $f->fail();
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $viewer, $params, $values): Response {
            $cat = BaseRepository::find($db, MenuCategoryDef::class, $params['id'], true, false);
            $values['sort_order'] ??= (int) $db->value('SELECT COALESCE(MAX(sort_order), 0) + 10 FROM menu_items WHERE category_id = ? AND deleted_at IS NULL', [$cat['id']]);
            $r = BaseRepository::create($app, $db, $request, MenuItemDef::class, $values + ['category_id' => (int) $cat['id'], 'workspace_id' => (int) $cat['workspace_id']]);
            $ws = $db->one('SELECT * FROM workspaces WHERE id = ?', [$cat['workspace_id']]);
            return Response::ok(self::menu($app, $db, $ws, $viewer), $r['created'] ? 201 : 200);
        });
    }

    /**
     * Copy another workspace's menu here. A category with the same name gets the missing dishes;
     * the rest come as new categories. Dishes already here (same name, same category) are skipped.
     * Notes, Normal/Jain and ⭐ come along; attachments and tasks stay with the original.
     */
    public static function copy(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        WorkspaceAccess::requireWrite($viewer);
        $f = Fields::from($request->attr('json'));
        $f->only(['from_workspace_id']);
        $db = $app->db();
        $from = is_string($f->value('from_workspace_id')) ? $db->one('SELECT * FROM workspaces WHERE public_id = ? AND deleted_at IS NULL', [$f->value('from_workspace_id')]) : null;
        if ($from === null) {
            $f->error('from_workspace_id', Strings::get($f->has('from_workspace_id') ? 'field_bad_link' : 'field_required'));
        } elseif ($from['public_id'] === $params['id']) {
            $f->error('from_workspace_id', Strings::get('menu_copy_same'));
        }
        $f->fail();
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $viewer, $params, $from): Response {
            $ws = BaseRepository::find($db, WorkspaceDef::class, $params['id'], true, false);
            $key = (string) $request->attr('idem_key');
            if ($key !== '' && $db->value('SELECT 1 FROM menu_categories WHERE client_uuid = ?', [$key]) !== null) {
                return Response::ok(self::menu($app, $db, $ws, $viewer) + ['copied' => 0]); // a retry: already copied
            }
            $batch = null;
            $summary = mb_substr("Menu copied from {$from['name']}", 0, 200);
            $count = 0;
            $marked = false;
            $nextCat = (int) $db->value('SELECT COALESCE(MAX(sort_order), 0) FROM menu_categories WHERE workspace_id = ? AND deleted_at IS NULL', [$ws['id']]);
            foreach ($db->all('SELECT * FROM menu_categories WHERE workspace_id = ? AND deleted_at IS NULL ORDER BY sort_order, id', [$from['id']]) as $src) {
                $items = $db->all('SELECT * FROM menu_items WHERE category_id = ? AND deleted_at IS NULL ORDER BY sort_order, id', [$src['id']]);
                $cat = $db->one('SELECT * FROM menu_categories WHERE workspace_id = ? AND name = ? AND deleted_at IS NULL ORDER BY id LIMIT 1', [$ws['id'], $src['name']]);
                $have = $cat === null ? [] : array_map('mb_strtolower', array_column($db->all('SELECT name FROM menu_items WHERE category_id = ? AND deleted_at IS NULL', [$cat['id']]), 'name'));
                $todo = array_values(array_filter($items, static fn ($i) => !in_array(mb_strtolower((string) $i['name']), $have, true)));
                if ($cat !== null && $todo === []) {
                    continue;
                }
                $batch ??= ChangeBatches::create($app, $db, $request, 'bulk_update', 'menu_category', $summary);
                if ($cat === null) {
                    $nextCat += 10;
                    // The first new category keeps the request's key, so a retry finds it.
                    $make = fn () => BaseRepository::create($app, $db, $request, MenuCategoryDef::class,
                        ['workspace_id' => (int) $ws['id'], 'name' => $src['name'], 'sort_order' => $nextCat], (int) $batch['id']);
                    $cat = ($marked ? \AM\Modules\Outfits\OutfitsController::withoutKey($request, $make) : $make())['row'];
                    $marked = true;
                    $count++;
                }
                $nextItem = (int) $db->value('SELECT COALESCE(MAX(sort_order), 0) FROM menu_items WHERE category_id = ? AND deleted_at IS NULL', [$cat['id']]);
                foreach ($todo as $i) {
                    $nextItem += 10;
                    \AM\Modules\Outfits\OutfitsController::withoutKey($request, fn () => BaseRepository::create($app, $db, $request, MenuItemDef::class, [
                        'workspace_id' => (int) $ws['id'], 'category_id' => (int) $cat['id'], 'name' => $i['name'], 'diet' => $i['diet'],
                        'is_must_have' => (int) $i['is_must_have'], 'note' => $i['note'], 'sort_order' => $nextItem,
                    ], (int) $batch['id']));
                    $count++;
                }
            }
            $meta = [];
            if ($batch !== null) {
                ChangeBatches::setCount($db, (int) $batch['id'], $count);
                $meta['undo'] = \AM\Http\BaseController::undoMeta($app, $batch['public_id'], $summary);
            }
            return Response::ok(self::menu($app, $db, $ws, $viewer) + ['copied' => $count], 200, $meta);
        });
    }

    public static function canWrite(): callable
    {
        return static fn (?array $v, string $action, ?array $row) => WorkspaceAccess::requireWrite($v);
    }
}
