<?php
declare(strict_types=1);

namespace AM\Modules\Workspaces;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Kernel\App;
use AM\Kernel\Strings;
use AM\Kernel\Time;
use AM\Modules\Vault\AttachmentLinkDef;
use AM\Repo\EntityDef;
use AM\Repo\Refs;
use AM\Validation\Fields;

/**
 * A workspace (version 1.0.17): everything for one function (Mehndi, Reception, …),
 * optionally linked to one calendar event. Only Ayush and Mahi see and change workspaces.
 * Deleting one takes its attachment links with it (one Undo); its tasks stay.
 */
final class WorkspaceDef extends EntityDef
{
    public const TABLE = 'workspaces';
    public const TYPE = 'workspace';
    public const RESOURCE = 'workspaces';
    public const LABEL = 'workspace';
    public const LABEL_PLURAL = 'workspaces';
    public const FIELD_LABELS = ['name' => 'Name', 'event' => 'Calendar event', 'sort_order' => 'Order', 'notes' => 'Notes',
        'theme_name' => 'Theme', 'theme_colours' => 'Colours', 'caterer_id' => 'Caterer'];
    public const CHILDREN = [AttachmentLinkDef::class => 'workspace_id', \AM\Modules\Outfits\OutfitDef::class => 'workspace_id',
        \AM\Modules\Menu\MenuCategoryDef::class => 'workspace_id'];
    /** Sections of a workspace page (steps B–D fill them in). */
    public const SECTIONS = [
        'general' => 'Files', 'bride_outfit' => 'Bride outfit', 'groom_outfit' => 'Groom outfit', 'family_outfit' => 'Family outfits',
        'decor' => 'Theme & decoration', 'menu' => 'Menu', 'contacts' => 'Contacts', 'guests' => 'Guest details', 'timeline' => 'Event timeline',
    ];

    public static function name(array $row): string
    {
        return (string) ($row['name'] ?? 'a workspace');
    }

    public static function canView(?array $viewer, array $row): bool
    {
        return Permissions::isAdmin($viewer);
    }

    public static function present(App $app, Db $db, Refs $refs, array $row, ?array $viewer): array
    {
        $event = null;
        if ($row['event_id'] !== null) {
            $e = $db->one('SELECT public_id, name, start_at, deleted_at FROM events WHERE id = ?', [$row['event_id']]);
            $event = $e === null ? null : ['id' => $e['public_id'], 'name' => $e['name'], 'start_at' => Time::iso($e['start_at'])] + ($e['deleted_at'] !== null ? ['deleted' => true] : []);
        }
        $id = (int) $row['id'];
        return [
            'id' => $row['public_id'],
            'version' => (int) $row['version'],
            'name' => $row['name'],
            'sort_order' => (int) $row['sort_order'],
            'notes' => $row['notes'],
            'theme_name' => $row['theme_name'] ?? null,
            'theme_colours' => $row['theme_colours'] ?? null,
            'caterer' => $refs->row('vendors', ($row['caterer_id'] ?? null) !== null ? (int) $row['caterer_id'] : null),
            'event' => $event,
            'counts' => [
                'tasks_open' => (int) $db->value("SELECT COUNT(*) FROM tasks WHERE workspace_id = ? AND deleted_at IS NULL AND status IN ('todo','doing','waiting')", [$id]),
                'attachments' => (int) $db->value(
                    'SELECT COUNT(DISTINCT l.attachment_id) FROM attachment_links l JOIN attachments a ON a.id = l.attachment_id
                     WHERE l.workspace_id = ? AND l.deleted_at IS NULL AND a.deleted_at IS NULL', [$id]),
            ],
            'created_at' => Time::iso($row['created_at']),
            'created_by' => $refs->user($row['created_by'] !== null ? (int) $row['created_by'] : null),
            'updated_at' => Time::iso($row['updated_at']),
        ];
    }

    public static function input(App $app, Fields $f, bool $create, ?array $current): array
    {
        $f->only(['name', 'event_id', 'sort_order', 'notes', 'theme_name', 'theme_colours', 'caterer_id']);
        $out = [];
        if ($create || $f->has('name')) {
            $out['name'] = $f->text('name', 80, true);
            if ($out['name'] !== null) {
                $dup = $app->db()->value('SELECT 1 FROM workspaces WHERE name = ? AND deleted_at IS NULL AND id <> ?', [$out['name'], $current['id'] ?? 0]);
                if ($dup !== null) {
                    $f->error('name', Strings::get('workspace_name_taken', ['name' => $out['name']]));
                }
            }
        }
        if ($create || $f->has('event_id')) {
            $v = $f->value('event_id');
            if ($v === null || $v === '') {
                $out['event_id'] = null;
            } else {
                $eid = is_string($v) ? $app->db()->value('SELECT id FROM events WHERE public_id = ? AND deleted_at IS NULL', [$v]) : null;
                if ($eid === null) {
                    $f->error('event_id', Strings::get('field_bad_link'));
                } else {
                    $other = $app->db()->value('SELECT name FROM workspaces WHERE event_id = ? AND deleted_at IS NULL AND id <> ?', [(int) $eid, $current['id'] ?? 0]);
                    if ($other !== null) {
                        $f->error('event_id', Strings::get('workspace_event_taken', ['name' => (string) $other]));
                    } else {
                        $out['event_id'] = (int) $eid;
                    }
                }
            }
        }
        if ($f->has('sort_order')) {
            $v = $f->value('sort_order');
            if (!is_int($v) || $v < 0 || $v > 10000) {
                $f->error('sort_order', Strings::get('field_bad_choice'));
            } else {
                $out['sort_order'] = $v;
            }
        } elseif ($create) {
            $out['sort_order'] = (int) $app->db()->value('SELECT COALESCE(MAX(sort_order), 0) + 10 FROM workspaces WHERE deleted_at IS NULL');
        }
        if ($create || $f->has('notes')) {
            $out['notes'] = $f->text('notes', 5000);
        }
        // 1.0.19: Theme & decoration, and the caterer for the Menu.
        if ($f->has('theme_name')) {
            $out['theme_name'] = $f->text('theme_name', 80);
        }
        if ($f->has('theme_colours')) {
            $out['theme_colours'] = $f->text('theme_colours', 120);
        }
        if ($f->has('caterer_id')) {
            $out['caterer_id'] = \AM\Modules\Outfits\OutfitParts::vendorId($app->db(), $f, 'caterer_id');
        }
        return $out;
    }

    /** A restored workspace must not clash with a live one of the same name. */
    public static function restoreCheck(Db $db, array $row): ?array
    {
        if ($db->value('SELECT 1 FROM workspaces WHERE name = ? AND deleted_at IS NULL AND id <> ?', [$row['name'], $row['id']]) !== null) {
            return ['blocked' => Strings::get('workspace_name_taken', ['name' => (string) $row['name']])];
        }
        return null;
    }

    public static function canWrite(): callable
    {
        return static fn (?array $v, string $action, ?array $row) => Permissions::requireAdmin($v);
    }
}
