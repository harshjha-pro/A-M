<?php
declare(strict_types=1);

namespace AM\Modules\Menu;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Kernel\App;
use AM\Kernel\Strings;
use AM\Modules\Outfits\OutfitParts;
use AM\Modules\Vault\AttachmentLinkDef;
use AM\Repo\EntityDef;
use AM\Repo\Refs;
use AM\Safety\History;
use AM\Validation\Fields;

/** A dish on a workspace's menu (1.0.19): Normal or Jain, ⭐ must-have, a short note, attachments and tasks. */
final class MenuItemDef extends EntityDef
{
    public const TABLE = 'menu_items';
    public const TYPE = 'menu_item';
    public const RESOURCE = 'menu-items';
    public const LABEL = 'dish';
    public const LABEL_PLURAL = 'dishes';
    public const DIETS = ['normal' => 'Normal', 'jain' => 'Jain'];
    public const FIELD_LABELS = ['name' => 'Dish', 'diet' => 'Normal / Jain', 'is_must_have' => 'Must-have', 'note' => 'Note', 'sort_order' => 'Order'];
    public const PARENT = [MenuCategoryDef::class, 'category_id'];
    public const QUIET_IN_PARENT_BATCH = true;
    public const CHILDREN = [AttachmentLinkDef::class => 'menu_item_id'];

    public static function name(array $row): string
    {
        return (string) ($row['name'] ?? 'a dish');
    }

    public static function canView(?array $viewer, array $row): bool
    {
        return Permissions::isAdmin($viewer);
    }

    public static function present(App $app, Db $db, Refs $refs, array $row, ?array $viewer): array
    {
        $id = (int) $row['id'];
        return [
            'id' => $row['public_id'],
            'version' => (int) $row['version'],
            'name' => $row['name'],
            'diet' => $row['diet'],
            'is_must_have' => (bool) $row['is_must_have'],
            'note' => $row['note'],
            'sort_order' => (int) $row['sort_order'],
            'attachments' => OutfitParts::attachments($app, $db, $refs, 'menu_item_id', $id, $viewer),
            'tasks' => OutfitParts::tasks($app, $db, $refs, 'menu_item', $id),
        ];
    }

    public static function input(App $app, Fields $f, bool $create, ?array $current): array
    {
        $f->only(['name', 'diet', 'is_must_have', 'note', 'sort_order']);
        $out = [];
        if ($create || $f->has('name')) {
            $out['name'] = $f->text('name', 120, true);
        }
        if ($f->has('diet')) {
            $out['diet'] = $f->enum('diet', array_keys(self::DIETS), true);
        } elseif ($create) {
            $out['diet'] = 'normal';
        }
        if ($f->has('is_must_have')) {
            $out['is_must_have'] = (int) (bool) $f->bool('is_must_have');
        }
        if ($f->has('note')) {
            $out['note'] = $f->text('note', 500);
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

    public static function formatValue(string $field, mixed $value): string
    {
        return match ($field) {
            'diet' => self::DIETS[(string) $value] ?? (string) $value,
            'is_must_have' => (int) $value === 1 ? 'Yes' : 'No',
            default => History::formatValue($value),
        };
    }
}
