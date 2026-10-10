<?php
declare(strict_types=1);

namespace AM\Modules\Documents;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Strings;
use AM\Kernel\Time;
use AM\Repo\EntityDef;
use AM\Repo\Refs;
use AM\Safety\History;
use AM\Validation\Fields;

/**
 * Documents (FEATURES B7): contracts, receipts, bookings. The file itself never changes.
 * Visibility: private → Ayush and Mahi; linked to a payment → money users; else everyone.
 * Deleted and restored with their payment (PaymentDef::CHILDREN).
 */
final class DocumentDef extends EntityDef
{
    public const TABLE = 'documents';
    public const TYPE = 'document';
    public const RESOURCE = 'documents';
    public const LABEL = 'document';
    public const LABEL_PLURAL = 'documents';
    public const FIELD_LABELS = [
        'title' => 'Title', 'type' => 'Type', 'payment_id' => 'Payment', 'vendor_id' => 'Vendor', 'event_id' => 'Event',
        'is_private' => 'Private', 'notes' => 'Notes',
    ];
    public const TYPES = ['contract' => 'Contract', 'quotation' => 'Quotation', 'receipt' => 'Receipt', 'booking' => 'Booking', 'id' => 'ID', 'photo' => 'Photo', 'other' => 'Other'];

    public static function name(array $row): string
    {
        return (string) ($row['title'] ?? 'a document');
    }

    /** Who may see it (and its file and history). */
    public static function canView(?array $viewer, array $row): bool
    {
        if ($viewer === null) {
            return false;
        }
        if ((int) ($row['is_private'] ?? 0) && !Permissions::isAdmin($viewer)) {
            return false;
        }
        return ($row['payment_id'] ?? null) === null || Permissions::canSeeMoney($viewer);
    }

    /** The same rule as SQL for lists. @return array{0:string, 1:list<mixed>} */
    public static function visibleSql(?array $viewer, string $alias = 'd'): array
    {
        $w = [];
        if (!Permissions::isAdmin($viewer)) {
            $w[] = "$alias.is_private = 0";
        }
        if (!Permissions::canSeeMoney($viewer)) {
            $w[] = "$alias.payment_id IS NULL";
        }
        return [$w === [] ? '1 = 1' : implode(' AND ', $w), []];
    }

    /** Admins edit everything; Family only their own uploads; Viewers nothing. */
    public static function assertCanEdit(?array $viewer, array $row): void
    {
        Permissions::requireEditor($viewer);
        if (!Permissions::isAdmin($viewer) && (int) $row['created_by'] !== (int) $viewer['id']) {
            throw new HttpError(403, 'forbidden', Strings::get('not_your_upload'));
        }
        if (!self::canView($viewer, $row)) {
            throw HttpError::make(403, 'forbidden');
        }
    }

    public static function present(App $app, Db $db, Refs $refs, array $row, ?array $viewer): array
    {
        $file = $db->one('SELECT * FROM files WHERE id = ?', [$row['file_id']]) ?? [];
        $ref = static function (string $table, string $col, $id) use ($db): ?array {
            if ($id === null) {
                return null;
            }
            $r = $db->one("SELECT public_id, `$col` AS name, deleted_at FROM `$table` WHERE id = ?", [$id]);
            return $r === null ? null : ['id' => $r['public_id'], 'name' => $r['name'], 'deleted' => $r['deleted_at'] !== null];
        };
        return [
            'id' => $row['public_id'],
            'version' => (int) $row['version'],
            'title' => $row['title'],
            'type' => $row['type'],
            'is_private' => (bool) $row['is_private'],
            'notes' => $row['notes'],
            'file' => [
                'id' => $file['public_id'] ?? null,
                'original_name' => $file['original_name'] ?? null,
                'mime_type' => $file['mime_type'] ?? null,
                'size_bytes' => (int) ($file['size_bytes'] ?? 0),
                'sha256' => $file['sha256'] ?? null,
                'width_px' => isset($file['width_px']) ? (int) $file['width_px'] : null,
                'height_px' => isset($file['height_px']) ? (int) $file['height_px'] : null,
            ],
            'payment' => Permissions::canSeeMoney($viewer) ? $ref('payments', 'title', $row['payment_id']) : null,
            'vendor' => $ref('vendors', 'name', $row['vendor_id']),
            'event' => $ref('events', 'name', $row['event_id']),
            'file_url' => '/api/v1/documents/' . $row['public_id'] . '/file',
            'created_at' => Time::iso($row['created_at']),
            'created_by' => $refs->user($row['created_by'] !== null ? (int) $row['created_by'] : null),
            'updated_at' => Time::iso($row['updated_at']),
        ];
    }

    /** PATCH (details only; the file never changes). Links resolved here; who may set what is checked by the controller. */
    public static function input(App $app, Fields $f, bool $create, ?array $current): array
    {
        $f->only(['title', 'type', 'payment_id', 'vendor_id', 'event_id', 'is_private', 'notes']);
        $out = [];
        if ($f->has('title')) {
            $out['title'] = $f->text('title', 120, true);
        }
        if ($f->has('type')) {
            $out['type'] = $f->enum('type', array_keys(self::TYPES), true);
        }
        foreach (['payment_id' => 'payments', 'vendor_id' => 'vendors', 'event_id' => 'events'] as $k => $table) {
            if (!$f->has($k)) {
                continue;
            }
            $v = $f->value($k);
            if ($v === null || $v === '') {
                $out[$k] = null;
                continue;
            }
            $id = is_string($v) ? $app->db()->value("SELECT id FROM `$table` WHERE public_id = ? AND deleted_at IS NULL", [$v]) : null;
            if ($id === null) {
                $f->error($k, Strings::get('field_bad_choice'));
            } else {
                $out[$k] = (int) $id;
            }
        }
        if ($f->has('is_private')) {
            $v = $f->value('is_private');
            $out['is_private'] = (int) ($v === true || $v === 'true' || $v === '1' || $v === 1);
        }
        if ($f->has('notes')) {
            $out['notes'] = $f->text('notes', 5000);
        }
        return $out;
    }

    public static function formatValue(string $field, mixed $value): string
    {
        return match ($field) {
            'type' => self::TYPES[(string) $value] ?? (string) $value,
            'is_private' => (int) $value ? 'Yes' : 'No',
            default => History::formatValue($value),
        };
    }
}
