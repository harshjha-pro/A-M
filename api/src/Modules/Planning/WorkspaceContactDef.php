<?php
declare(strict_types=1);

namespace AM\Modules\Planning;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Kernel\App;
use AM\Kernel\Strings;
use AM\Modules\Money\VendorDef;
use AM\Repo\EntityDef;
use AM\Repo\Refs;
use AM\Validation\Fields;

/** A vendor linked to a workspace as a contact (1.0.20), with an optional role there. Removing it only unlinks. */
final class WorkspaceContactDef extends EntityDef
{
    public const TABLE = 'workspace_contacts';
    public const TYPE = 'workspace_contact';
    public const RESOURCE = 'workspace-contacts';
    public const LABEL = 'contact';
    public const LABEL_PLURAL = 'contacts';
    public const FIELD_LABELS = ['role' => 'Role', 'sort_order' => 'Order'];

    public static function name(array $row): string
    {
        return ($row['role'] ?? '') !== '' ? 'Contact: ' . $row['role'] : 'a contact';
    }

    public static function describe(Refs $refs, array $row): string
    {
        return (string) ($refs->row('vendors', isset($row['vendor_id']) ? (int) $row['vendor_id'] : null)['name'] ?? self::name($row));
    }

    public static function canView(?array $viewer, array $row): bool
    {
        return \AM\Auth\WorkspaceAccess::canView($viewer);
    }

    public static function present(App $app, Db $db, Refs $refs, array $row, ?array $viewer): array
    {
        return [
            'id' => $row['public_id'],
            'version' => (int) $row['version'],
            'role' => $row['role'],
            'sort_order' => (int) $row['sort_order'],
            'vendor' => self::vendor($db, (int) $row['vendor_id']),
        ];
    }

    /** {id, name, category, category_label, contact_person, phone, alt_phone} or null. */
    public static function vendor(Db $db, int $id): ?array
    {
        $v = $db->one('SELECT public_id, name, category, contact_person, phone, alt_phone, deleted_at FROM vendors WHERE id = ?', [$id]);
        return $v === null ? null : [
            'id' => $v['public_id'], 'name' => $v['name'], 'category' => $v['category'], 'category_label' => VendorDef::CATEGORIES[$v['category']] ?? $v['category'],
            'contact_person' => $v['contact_person'], 'phone' => $v['phone'], 'alt_phone' => $v['alt_phone'],
        ] + ($v['deleted_at'] !== null ? ['deleted' => true] : []);
    }

    public static function input(App $app, Fields $f, bool $create, ?array $current): array
    {
        $f->only(['role', 'sort_order']);
        $out = [];
        if ($create || $f->has('role')) {
            $out['role'] = $f->text('role', 120);
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

    /** A restored contact must not sit next to a live one for the same vendor. */
    public static function restoreCheck(Db $db, array $row): ?array
    {
        if ($db->value('SELECT 1 FROM workspace_contacts WHERE workspace_id = ? AND vendor_id = ? AND deleted_at IS NULL AND id <> ?', [$row['workspace_id'], $row['vendor_id'], $row['id']]) !== null) {
            return ['blocked' => Strings::get('contact_already_here')];
        }
        return null;
    }
}
