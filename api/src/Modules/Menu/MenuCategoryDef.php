<?php
declare(strict_types=1);

namespace AM\Modules\Menu;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Kernel\App;
use AM\Kernel\Strings;
use AM\Repo\EntityDef;
use AM\Repo\Refs;
use AM\Validation\Fields;

/** A menu category on a workspace (1.0.19): Welcome drinks, Starters, … Its dishes go and come back with it. */
final class MenuCategoryDef extends EntityDef
{
    public const TABLE = 'menu_categories';
    public const TYPE = 'menu_category';
    public const RESOURCE = 'menu-categories';
    public const LABEL = 'menu category';
    public const LABEL_PLURAL = 'menu categories';
    public const FIELD_LABELS = ['name' => 'Name', 'sort_order' => 'Order'];
    public const CHILDREN = [MenuItemDef::class => 'category_id'];

    public static function name(array $row): string
    {
        return (string) ($row['name'] ?? 'a menu category');
    }

    public static function canView(?array $viewer, array $row): bool
    {
        return \AM\Auth\WorkspaceAccess::canView($viewer);
    }

    public static function present(App $app, Db $db, Refs $refs, array $row, ?array $viewer): array
    {
        $items = $db->all('SELECT * FROM menu_items WHERE category_id = ? AND deleted_at IS NULL ORDER BY sort_order, id', [$row['id']]);
        return [
            'id' => $row['public_id'],
            'version' => (int) $row['version'],
            'name' => $row['name'],
            'sort_order' => (int) $row['sort_order'],
            'items' => array_map(static fn ($i) => MenuItemDef::present($app, $db, $refs, $i, $viewer), $items),
        ];
    }

    public static function input(App $app, Fields $f, bool $create, ?array $current): array
    {
        $f->only(['name', 'sort_order']);
        $out = [];
        if ($create || $f->has('name')) {
            $out['name'] = $f->text('name', 80, true);
        }
        if ($f->has('sort_order')) {
            $v = $f->value('sort_order');
            if (is_int($v) && $v >= 0 && $v <= 10000) {
                $out['sort_order'] = $v;
            } else {
                $f->error('sort_order', Strings::get('field_bad_choice'));
            }
        }
        return $out;
    }
}
