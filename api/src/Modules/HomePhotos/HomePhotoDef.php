<?php
declare(strict_types=1);

namespace AM\Modules\HomePhotos;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Kernel\App;
use AM\Kernel\Strings;
use AM\Kernel\Time;
use AM\Repo\EntityDef;
use AM\Repo\Refs;
use AM\Safety\History;
use AM\Validation\Fields;

/**
 * Home screen photos (version 1.0.16): the cover slideshow (up to 8), the couple
 * photos (up to 4) and the monogram (1). Everyone sees them; only Ayush and Mahi
 * add, reorder or remove them. The bytes live in photo_blobs (never changed, never
 * in the audit log); this row only says where an image shows.
 */
final class HomePhotoDef extends EntityDef
{
    public const TABLE = 'home_photos';
    public const TYPE = 'home_photo';
    public const RESOURCE = 'home-photos';
    public const LABEL = 'Home photo';
    public const LABEL_PLURAL = 'Home photos';
    public const FIELD_LABELS = ['slot' => 'Place', 'sort_order' => 'Order'];
    public const SLOTS = ['cover' => 'cover photo', 'couple' => 'couple photo', 'monogram' => 'monogram'];
    public const MAX = ['cover' => 8, 'couple' => 4, 'monogram' => 1];
    public const PLURAL = ['cover' => 'cover photos', 'couple' => 'couple photos', 'monogram' => 'monogram'];

    public static function name(array $row): string
    {
        $slot = (string) ($row['slot'] ?? '');
        return isset(self::SLOTS[$slot]) ? ucfirst(self::SLOTS[$slot]) : 'a Home photo';
    }

    public static function present(App $app, Db $db, Refs $refs, array $row, ?array $viewer): array
    {
        $b = $db->one('SELECT sha256, mime_type, size_bytes, width_px, height_px FROM photo_blobs WHERE id = ?', [$row['blob_id']]) ?? [];
        return [
            'id' => $row['public_id'],
            'version' => (int) $row['version'],
            'slot' => $row['slot'],
            'sort_order' => (int) $row['sort_order'],
            'mime_type' => $b['mime_type'] ?? null,
            'size_bytes' => (int) ($b['size_bytes'] ?? 0),
            'width_px' => (int) ($b['width_px'] ?? 0),
            'height_px' => (int) ($b['height_px'] ?? 0),
            'url' => '/api/v1/home-photos/' . $row['public_id'] . '/image?v=' . substr((string) ($b['sha256'] ?? ''), 0, 16),
            'created_at' => Time::iso($row['created_at']),
            'created_by' => $refs->user($row['created_by'] !== null ? (int) $row['created_by'] : null),
            'updated_at' => Time::iso($row['updated_at']),
        ];
    }

    /** PATCH: only the order (the image and its place never change; remove and add again). */
    public static function input(App $app, Fields $f, bool $create, ?array $current): array
    {
        $f->only(['sort_order']);
        $out = [];
        if ($f->has('sort_order')) {
            $v = $f->value('sort_order');
            if (!is_int($v) || $v < 0 || $v > 1000) {
                $f->error('sort_order', Strings::get('field_bad_choice'));
            } else {
                $out['sort_order'] = $v;
            }
        }
        return $out;
    }

    /** Restoring into a full place would break its limit. */
    public static function restoreCheck(Db $db, array $row): ?array
    {
        $slot = (string) $row['slot'];
        $live = (int) $db->value('SELECT COUNT(*) FROM home_photos WHERE slot = ? AND deleted_at IS NULL', [$slot]);
        if ($live >= self::MAX[$slot]) {
            return ['blocked' => Strings::get('photo_slot_full', ['max' => self::MAX[$slot], 'what' => self::PLURAL[$slot]])];
        }
        return null;
    }

    public static function formatValue(string $field, mixed $value): string
    {
        return $field === 'slot' ? (self::SLOTS[(string) $value] ?? (string) $value) : History::formatValue($value);
    }

    public static function canWrite(): callable
    {
        return static fn (?array $v, string $action, ?array $row) => Permissions::requireAdmin($v);
    }
}
