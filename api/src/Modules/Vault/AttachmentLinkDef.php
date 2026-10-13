<?php
declare(strict_types=1);

namespace AM\Modules\Vault;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Kernel\App;
use AM\Kernel\Time;
use AM\Modules\Workspaces\WorkspaceDef;
use AM\Repo\EntityDef;
use AM\Repo\Refs;

/**
 * Where an attachment is used: one row per place (workspace › section, later a thing
 * inside the section). Removing a link only unlinks; the attachment stays in the Vault.
 */
final class AttachmentLinkDef extends EntityDef
{
    public const TABLE = 'attachment_links';
    public const TYPE = 'attachment_link';
    public const RESOURCE = 'attachment-links';
    public const LABEL = 'attachment link';
    public const LABEL_PLURAL = 'attachment links';
    public const FIELD_LABELS = ['section' => 'Section'];
    public const PARENT = [AttachmentDef::class, 'attachment_id'];
    public const QUIET_IN_PARENT_BATCH = true;

    public static function name(array $row): string
    {
        return 'Link to ' . (WorkspaceDef::SECTIONS[(string) ($row['section'] ?? '')] ?? 'a section');
    }

    public static function describe(Refs $refs, array $row): string
    {
        $w = $refs->row('workspaces', isset($row['workspace_id']) ? (int) $row['workspace_id'] : null);
        return 'Link to ' . ($w['name'] ?? 'a workspace') . ' › ' . (WorkspaceDef::SECTIONS[(string) ($row['section'] ?? '')] ?? (string) ($row['section'] ?? ''));
    }

    public static function canView(?array $viewer, array $row): bool
    {
        return Permissions::isAdmin($viewer);
    }

    /** "Mehndi › Files" */
    public static function path(Db $db, array $row): string
    {
        $w = (string) ($db->value('SELECT name FROM workspaces WHERE id = ?', [$row['workspace_id']]) ?? 'Workspace');
        $path = $w . ' › ' . (WorkspaceDef::SECTIONS[(string) $row['section']] ?? (string) $row['section']);
        // 1.0.18: "Mehndi › Bride outfit › Mehndi lehenga › Maang tikka"
        if (($row['outfit_id'] ?? null) !== null) {
            $path .= ' › ' . (string) ($db->value('SELECT title FROM outfits WHERE id = ?', [$row['outfit_id']]) ?? 'Outfit');
        }
        if (($row['accessory_id'] ?? null) !== null) {
            $path .= ' › ' . (string) ($db->value('SELECT name FROM accessories WHERE id = ?', [$row['accessory_id']]) ?? 'Accessory');
        }
        if (($row['outfit_step_id'] ?? null) !== null) {
            $path .= ' › ' . (string) ($db->value('SELECT name FROM outfit_steps WHERE id = ?', [$row['outfit_step_id']]) ?? 'Step');
        }
        if (($row['menu_item_id'] ?? null) !== null) { // 1.0.19: "Reception › Menu › Paneer tikka"
            $path .= ' › ' . (string) ($db->value('SELECT name FROM menu_items WHERE id = ?', [$row['menu_item_id']]) ?? 'Dish');
        }
        return $path;
    }

    public static function present(App $app, Db $db, Refs $refs, array $row, ?array $viewer): array
    {
        $w = $db->one('SELECT public_id, name, deleted_at FROM workspaces WHERE id = ?', [$row['workspace_id']]);
        return [
            'id' => $row['public_id'],
            'version' => (int) $row['version'],
            'workspace' => $w === null ? null : ['id' => $w['public_id'], 'name' => $w['name']] + ($w['deleted_at'] !== null ? ['deleted' => true] : []),
            'section' => $row['section'],
            'section_label' => WorkspaceDef::SECTIONS[(string) $row['section']] ?? (string) $row['section'],
            'path' => self::path($db, $row),
            'created_at' => Time::iso($row['created_at']),
        ];
    }
}
