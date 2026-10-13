<?php
declare(strict_types=1);

namespace AM\Modules\Workspaces;

use AM\Auth\Permissions;
use AM\Kernel\App;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Modules\Tasks\TaskView;
use AM\Repo\BaseRepository;
use AM\Repo\Refs;

/** /workspaces (version 1.0.17). Ayush and Mahi only. Writes go through BaseController. */
final class WorkspacesController
{
    public static function list(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireAdmin($viewer);
        $db = $app->db();
        $refs = new Refs($db, $app->clock->todayIst());
        $rows = $db->all('SELECT * FROM workspaces WHERE deleted_at IS NULL ORDER BY sort_order, id');
        $data = array_map(static fn ($r) => WorkspaceDef::present($app, $db, $refs, $r, $viewer), $rows);
        return Response::ok($data, 200, ['total' => count($data), 'sections' => WorkspaceDef::SECTIONS]);
    }

    /** One workspace with its tasks (open first, by due date) for the strip at the top. */
    public static function get(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireAdmin($viewer);
        $db = $app->db();
        $row = BaseRepository::find($db, WorkspaceDef::class, $params['id'], false, false);
        $refs = new Refs($db, $app->clock->todayIst());
        $view = WorkspaceDef::present($app, $db, $refs, $row, $viewer);
        $tasks = $db->all(
            "SELECT * FROM tasks WHERE workspace_id = ? AND deleted_at IS NULL
             ORDER BY status IN ('done','cancelled'), due_date IS NULL, due_date, due_time IS NULL, due_time, id LIMIT 100",
            [$row['id']],
        );
        $view['tasks'] = TaskView::summaries($app, $db, $refs, $tasks);
        $view['sections'] = WorkspaceDef::SECTIONS;
        // 1.0.18: outfit cards for the Bride / Groom outfit sections; 1.0.19: family outfits and decor items too.
        $view['outfits'] = array_map(static fn ($o) => \AM\Modules\Outfits\OutfitDef::present($app, $db, $refs, $o, $viewer),
            $db->all("SELECT * FROM outfits WHERE workspace_id = ? AND deleted_at IS NULL ORDER BY FIELD(person, 'bride', 'groom', 'close_female', 'close_male', 'extended_female', 'extended_male', 'decor'), sort_order, id", [$row['id']]));
        // 1.0.19: the menu (categories with their dishes, caterer), and the attachments that belong to the
        // Theme & decoration and Menu sections themselves (not to a decor item or a dish).
        $view['menu'] = \AM\Modules\Menu\MenuController::menu($app, $db, $row, $viewer);
        $view['boards'] = [];
        foreach (['decor', 'menu'] as $section) {
            $view['boards'][$section] = array_map(static fn ($a) => \AM\Modules\Vault\AttachmentDef::present($app, $db, $refs, $a, $viewer), $db->all(
                'SELECT a.* FROM attachment_links l JOIN attachments a ON a.id = l.attachment_id
                 WHERE l.workspace_id = ? AND l.section = ? AND l.outfit_id IS NULL AND l.accessory_id IS NULL AND l.outfit_step_id IS NULL AND l.menu_item_id IS NULL
                   AND l.deleted_at IS NULL AND a.deleted_at IS NULL ORDER BY l.id', [$row['id'], $section]));
        }
        return Response::ok($view)->withHeader('ETag', '"' . $view['version'] . '"');
    }
}
