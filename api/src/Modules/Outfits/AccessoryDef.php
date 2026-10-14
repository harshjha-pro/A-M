<?php
declare(strict_types=1);

namespace AM\Modules\Outfits;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Kernel\App;
use AM\Kernel\Strings;
use AM\Modules\Vault\AttachmentLinkDef;
use AM\Repo\EntityDef;
use AM\Repo\Refs;
use AM\Validation\Fields;

/** Something that goes with an outfit (Maang tikka, Kaleere, Juttis, …), with its own notes, attachments and tasks. */
final class AccessoryDef extends EntityDef
{
    public const TABLE = 'accessories';
    public const TYPE = 'accessory';
    public const RESOURCE = 'accessories';
    public const LABEL = 'accessory';
    public const LABEL_PLURAL = 'accessories';
    public const FIELD_LABELS = ['name' => 'Name', 'sort_order' => 'Order'];
    public const PARENT = [OutfitDef::class, 'outfit_id'];
    public const QUIET_IN_PARENT_BATCH = true;
    public const CHILDREN = [NoteDef::class => 'accessory_id', AttachmentLinkDef::class => 'accessory_id'];

    public static function name(array $row): string
    {
        return (string) ($row['name'] ?? 'an accessory');
    }

    public static function canView(?array $viewer, array $row): bool
    {
        return \AM\Auth\WorkspaceAccess::canView($viewer);
    }

    public static function present(App $app, Db $db, Refs $refs, array $row, ?array $viewer): array
    {
        $id = (int) $row['id'];
        return [
            'id' => $row['public_id'],
            'version' => (int) $row['version'],
            'name' => $row['name'],
            'sort_order' => (int) $row['sort_order'],
            'notes' => OutfitParts::notes($app, $db, $refs, 'accessory_id', $id),
            'attachments' => OutfitParts::attachments($app, $db, $refs, 'accessory_id', $id, $viewer),
            'tasks' => OutfitParts::tasks($app, $db, $refs, 'accessory', $id),
        ];
    }

    public static function input(App $app, Fields $f, bool $create, ?array $current): array
    {
        $f->only(['name', 'sort_order']);
        $out = [];
        if ($create || $f->has('name')) {
            $out['name'] = $f->text('name', 120, true);
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
