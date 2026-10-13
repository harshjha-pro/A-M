<?php
declare(strict_types=1);

namespace AM\Modules\Outfits;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Kernel\App;
use AM\Kernel\Time;
use AM\Modules\Vault\AttachmentLinkDef;
use AM\Repo\EntityDef;
use AM\Repo\Refs;
use AM\Safety\History;
use AM\Validation\Fields;

/**
 * An outfit in a workspace (1.0.18): bride or groom (family in step C). Its timeline steps,
 * accessories, notes and attachment links go and come back with it (one Undo); tasks stay.
 */
final class OutfitDef extends EntityDef
{
    public const TABLE = 'outfits';
    public const TYPE = 'outfit';
    public const RESOURCE = 'outfits';
    public const LABEL = 'outfit';
    public const LABEL_PLURAL = 'outfits';
    public const FIELD_LABELS = ['title' => 'Name', 'sort_order' => 'Order'];
    public const CHILDREN = [
        OutfitStepDef::class => 'outfit_id',
        AccessoryDef::class => 'outfit_id',
        NoteDef::class => 'outfit_id',
        AttachmentLinkDef::class => 'outfit_id',
    ];

    public static function name(array $row): string
    {
        return (string) ($row['title'] ?? 'an outfit');
    }

    public static function canView(?array $viewer, array $row): bool
    {
        return Permissions::isAdmin($viewer);
    }

    /** A card: steps (with done dates), counts and the cover picture. */
    public static function present(App $app, Db $db, Refs $refs, array $row, ?array $viewer): array
    {
        $id = (int) $row['id'];
        $steps = $db->all('SELECT * FROM outfit_steps WHERE outfit_id = ? AND deleted_at IS NULL ORDER BY sort_order, id', [$id]);
        $ws = $db->one('SELECT public_id, name FROM workspaces WHERE id = ?', [$row['workspace_id']]);
        return [
            'id' => $row['public_id'],
            'version' => (int) $row['version'],
            'workspace' => $ws === null ? null : ['id' => $ws['public_id'], 'name' => $ws['name']],
            'person' => $row['person'],
            'person_label' => OutfitParts::PERSONS[$row['person']] ?? $row['person'],
            'section' => OutfitParts::SECTION[$row['person']] ?? 'bride_outfit',
            'title' => $row['title'],
            'sort_order' => (int) $row['sort_order'],
            'steps' => array_map(static fn ($s) => OutfitStepDef::present($app, $db, $refs, $s, $viewer), $steps),
            'cover_url' => OutfitParts::cover($db, $id),
            'counts' => [
                'attachments' => (int) $db->value('SELECT COUNT(*) FROM attachment_links l JOIN attachments a ON a.id = l.attachment_id WHERE l.outfit_id = ? AND l.accessory_id IS NULL AND l.outfit_step_id IS NULL AND l.deleted_at IS NULL AND a.deleted_at IS NULL', [$id]),
                'accessories' => (int) $db->value('SELECT COUNT(*) FROM accessories WHERE outfit_id = ? AND deleted_at IS NULL', [$id]),
                'tasks_open' => (int) $db->value("SELECT COUNT(*) FROM tasks WHERE target_type = 'outfit' AND target_id = ? AND deleted_at IS NULL AND status IN ('todo','doing','waiting')", [$id]),
            ],
            'created_at' => Time::iso($row['created_at']),
            'updated_at' => Time::iso($row['updated_at']),
        ];
    }

    /** PATCH: name and order (the person and workspace never change). */
    public static function input(App $app, Fields $f, bool $create, ?array $current): array
    {
        $f->only(['title', 'sort_order']);
        $out = [];
        if ($create || $f->has('title')) {
            $out['title'] = $f->text('title', 120, true);
        }
        if ($f->has('sort_order')) {
            $v = $f->value('sort_order');
            if (is_int($v) && $v >= 0 && $v <= 10000) {
                $out['sort_order'] = $v;
            } else {
                $f->error('sort_order', \AM\Kernel\Strings::get('field_bad_choice'));
            }
        }
        return $out;
    }

    public static function formatValue(string $field, mixed $value): string
    {
        return History::formatValue($value);
    }
}
