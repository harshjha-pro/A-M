<?php
declare(strict_types=1);

namespace AM\Modules\Money;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Phone;
use AM\Kernel\Strings;
use AM\Kernel\Time;
use AM\Repo\EntityDef;
use AM\Repo\Refs;
use AM\Safety\History;
use AM\Validation\Fields;

/**
 * Vendors (FEATURES B6, light). Contacts for everyone; the agreed amount and the
 * balance only for money users — the server leaves them out, not the app (AC-MON-06).
 */
final class VendorDef extends EntityDef
{
    public const TABLE = 'vendors';
    public const TYPE = 'vendor';
    public const RESOURCE = 'vendors';
    public const LABEL = 'vendor';
    public const LABEL_PLURAL = 'vendors';
    public const FIELD_LABELS = [
        'name' => 'Name', 'category' => 'Type', 'contact_person' => 'Contact', 'phone' => 'Phone', 'alt_phone' => 'Other phone',
        'agreed_amount_paise' => 'Agreed amount', 'is_booked' => 'Booked', 'notes' => 'Notes',
    ];
    public const MONEY_FIELDS = ['agreed_amount_paise'];
    public const CATEGORIES = [
        'venue' => 'Venue', 'caterer' => 'Caterer / Halwai', 'tent_decor' => 'Tent & decor', 'photo_video' => 'Photo & video', 'makeup' => 'Makeup',
        'mehndi_artist' => 'Mehndi artist', 'band_dj' => 'Band / DJ', 'florist' => 'Florist', 'transport' => 'Transport', 'printer' => 'Printer',
        'pandit' => 'Pandit', 'jeweller' => 'Jeweller', 'tailor' => 'Tailor', 'other' => 'Other',
    ];

    public static function name(array $row): string
    {
        return (string) ($row['name'] ?? 'a vendor');
    }

    public static function present(App $app, Db $db, Refs $refs, array $row, ?array $viewer): array
    {
        $out = [
            'id' => $row['public_id'],
            'version' => (int) $row['version'],
            'name' => $row['name'],
            'category' => $row['category'],
            'contact_person' => $row['contact_person'],
            'phone' => $row['phone'],
            'alt_phone' => $row['alt_phone'],
            'is_booked' => (bool) $row['is_booked'],
            'notes' => $row['notes'],
            'created_at' => Time::iso($row['created_at']),
            'created_by' => $refs->user($row['created_by'] !== null ? (int) $row['created_by'] : null),
            'updated_at' => Time::iso($row['updated_at']),
            'updated_by' => $refs->user($row['updated_by'] !== null ? (int) $row['updated_by'] : null),
        ];
        if (Permissions::canSeeMoney($viewer)) {
            $agreed = $row['agreed_amount_paise'] !== null ? (int) $row['agreed_amount_paise'] : null;
            $t = $db->one(
                "SELECT COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_paise END), 0) AS paid, COALESCE(SUM(CASE WHEN status = 'due' THEN amount_paise END), 0) AS due
                 FROM payments WHERE vendor_id = ? AND deleted_at IS NULL",
                [$row['id']],
            ) ?? ['paid' => 0, 'due' => 0];
            $out['agreed_amount_paise'] = $agreed;
            $out['balance'] = [
                'agreed_paise' => $agreed,
                'paid_paise' => (int) $t['paid'],
                'due_paise' => (int) $t['due'],
                'not_scheduled_paise' => $agreed === null ? 0 : $agreed - (int) $t['paid'] - (int) $t['due'], // < 0 = more than agreed
            ];
        }
        return $out;
    }

    public static function input(App $app, Fields $f, bool $create, ?array $current): array
    {
        $f->only(['name', 'category', 'contact_person', 'phone', 'alt_phone', 'agreed_amount_paise', 'is_booked', 'notes', 'allow_duplicate']);
        $out = [];
        if ($create || $f->has('name')) {
            $out['name'] = $f->text('name', 120, true);
        }
        if ($create || $f->has('category')) {
            $out['category'] = $f->enum('category', array_keys(self::CATEGORIES)) ?? 'other';
        }
        foreach (['contact_person' => 80, 'notes' => 5000] as $k => $max) {
            if ($create || $f->has($k)) {
                $out[$k] = $f->text($k, $max);
            }
        }
        foreach (['phone', 'alt_phone'] as $k) {
            if ($create || $f->has($k)) {
                $out[$k] = $f->phone($k, false, true);
            }
        }
        if ($f->has('agreed_amount_paise')) { // non-money senders were refused before this (VendorsController, SEC-12)
            $out['agreed_amount_paise'] = $f->value('agreed_amount_paise') === null ? null : $f->paise('agreed_amount_paise', 1000000000000);
        }
        if ($create || $f->has('is_booked')) {
            $out['is_booked'] = (int) ($f->bool('is_booked') ?? false);
        }
        $phones = array_filter([$out['phone'] ?? null, $out['alt_phone'] ?? null]);
        if ($phones !== [] && !$f->hasErrors() && ($f->value('allow_duplicate') ?? false) !== true) {
            $in = implode(',', array_fill(0, count($phones), '?'));
            $dup = $app->db()->one(
                "SELECT public_id, name, phone FROM vendors WHERE deleted_at IS NULL AND id <> ? AND (phone IN ($in) OR alt_phone IN ($in)) LIMIT 1",
                [$current['id'] ?? 0, ...array_values($phones), ...array_values($phones)],
            );
            $changed = $create || array_filter($phones, static fn ($p) => $p !== ($current['phone'] ?? null) && $p !== ($current['alt_phone'] ?? null)) !== [];
            if ($dup !== null && $changed) {
                throw new HttpError(409, 'duplicate_found', Strings::get('vendor_duplicate', ['name' => $dup['name'], 'phone' => Phone::mask((string) $dup['phone'])]), [
                    'matches' => [['id' => $dup['public_id'], 'name' => $dup['name'], 'phone' => $dup['phone'], 'match_on' => 'phone']],
                ]);
            }
        }
        return $out;
    }

    public static function formatValue(string $field, mixed $value): string
    {
        return match ($field) {
            'agreed_amount_paise' => History::rupees($value === null ? null : (int) $value),
            'category' => self::CATEGORIES[(string) $value] ?? (string) $value,
            'is_booked' => (int) $value ? 'Yes' : 'No',
            default => History::formatValue($value),
        };
    }
}
