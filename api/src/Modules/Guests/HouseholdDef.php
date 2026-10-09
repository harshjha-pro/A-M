<?php
declare(strict_types=1);

namespace AM\Modules\Guests;

use AM\Db\Db;
use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Phone;
use AM\Kernel\Strings;
use AM\Modules\Events\InvitationDef;
use AM\Repo\EntityDef;
use AM\Repo\Refs;
use AM\Safety\History;
use AM\Validation\Fields;

/** Families (FEATURES B5). Invitations are their children: deleted, undone and restored together. */
final class HouseholdDef extends EntityDef
{
    public const TABLE = 'households';
    public const TYPE = 'household';
    public const RESOURCE = 'households';
    public const LABEL = 'family';
    public const LABEL_PLURAL = 'families';
    public const FIELD_LABELS = [
        'name' => 'Name', 'phone' => 'Phone', 'alt_phone' => 'Other phone', 'side' => 'Side', 'group_name' => 'Group',
        'relation' => 'Relation', 'area' => 'Area', 'city' => 'City', 'address' => 'Address', 'adults' => 'Adults',
        'children' => 'Children', 'food' => 'Food', 'jain_count' => 'Jain people', 'is_vip' => 'Important', 'notes' => 'Notes',
    ];
    public const CHILDREN = [InvitationDef::class => 'household_id'];
    public const SIDES = ['bride' => "Bride's side", 'groom' => "Groom's side", 'both' => 'Both sides'];
    public const FOOD = ['veg' => 'Veg', 'jain' => 'Jain', 'nonveg' => 'Non-veg', 'mixed' => 'Mixed'];

    public static function name(array $row): string
    {
        return (string) ($row['name'] ?? 'a family');
    }

    public static function present(App $app, Db $db, Refs $refs, array $row, ?array $viewer): array
    {
        return HouseholdView::full($app, $db, $refs, $row);
    }

    /** "Ramesh Sharma & family" / "Sharma ji (Mama ji)" → "ramesh sharma" / "sharma mama": for duplicate hints. */
    public static function normName(string $name): string
    {
        $s = mb_strtolower($name);
        // \p{M}: Hindi vowel signs (ा ि ी …) belong to the word; without them राम and रमा looked the same.
        $s = (string) preg_replace('/[^\p{L}\p{M}\p{N}\s]+/u', ' ', $s);
        $words = array_filter(preg_split('/\s+/u', $s) ?: [], static fn ($w) => $w !== '' && !in_array($w, ['ji', 'family', 'and', 'parivar', 'sahab', 'saheb', 'जी', 'परिवार', 'साहब'], true));
        return mb_substr(implode(' ', $words), 0, 120);
    }

    public static function input(App $app, Fields $f, bool $create, ?array $current): array
    {
        $f->only([...array_keys(self::FIELD_LABELS), 'allow_duplicate', 'invite_event_ids']);
        $out = [];
        if ($create || $f->has('name')) {
            $out['name'] = $f->text('name', 120, true);
            if ($out['name'] !== null) {
                $out['name_norm'] = self::normName($out['name']);
            }
        }
        foreach (['phone', 'alt_phone'] as $k) {
            if ($create || $f->has($k)) {
                $out[$k] = $f->phone($k, false, true); // a family may only have a landline
            }
        }
        if ($create || $f->has('side')) {
            $out['side'] = $f->enum('side', array_keys(self::SIDES), true);
        }
        foreach (['group_name' => 80, 'relation' => 40, 'area' => 80, 'city' => 60, 'address' => 300, 'notes' => 5000] as $k => $max) {
            if ($create || $f->has($k)) {
                $out[$k] = $f->text($k, $max);
            }
        }
        if ($create && ($out['city'] ?? null) === null) {
            $out['city'] = $app->db()->value('SELECT city FROM settings WHERE id = 1'); // default: the wedding city
        }
        foreach (['adults' => 2, 'children' => 0, 'jain_count' => 0] as $k => $default) {
            if ($create || $f->has($k)) {
                $out[$k] = self::int($f, $k, 0, $k === 'jain_count' ? 100 : 50) ?? ($create ? $default : null);
                if ($out[$k] === null) {
                    unset($out[$k]);
                }
            }
        }
        if ($create || $f->has('food')) {
            $out['food'] = $f->enum('food', ['veg', 'jain', 'mixed']) ?? ($create ? 'veg' : ($current['food'] ?? 'veg'));
        }
        if ($create || $f->has('is_vip')) {
            $out['is_vip'] = (int) ($f->bool('is_vip') ?? false);
        }
        // People and Jain count rules on the final values.
        $adults = $out['adults'] ?? (int) ($current['adults'] ?? 2);
        $children = $out['children'] ?? (int) ($current['children'] ?? 0);
        $food = $out['food'] ?? ($current['food'] ?? 'veg');
        if (array_key_exists('adults', $out) || array_key_exists('children', $out)) {
            if ($adults + $children < 1) {
                $f->error('adults', Strings::get('field_people_min'));
            }
        }
        if ($food === 'jain') {
            $out['jain_count'] = $adults + $children;
        } elseif ($food !== 'mixed') {
            if (($current['jain_count'] ?? 0) != 0 || array_key_exists('food', $out)) {
                $out['jain_count'] = 0;
            }
        } elseif (($out['jain_count'] ?? (int) ($current['jain_count'] ?? 0)) > $adults + $children) {
            $f->error('jain_count', Strings::get('field_jain_too_many'));
        }
        // Same phone as another live family → 409 (FEATURES B5); on edit only when a phone changes.
        $phones = array_filter([$out['phone'] ?? null, $out['alt_phone'] ?? null]);
        if ($phones !== [] && !$f->hasErrors() && ($f->value('allow_duplicate') ?? false) !== true) {
            $changed = $create || array_filter($phones, static fn ($p) => $p !== ($current['phone'] ?? null) && $p !== ($current['alt_phone'] ?? null)) !== [];
            if ($changed) {
                $m = Duplicates::phoneMatches($app->db(), $phones, $current['id'] ?? null);
                if ($m !== []) {
                    $first = $m[0];
                    throw new HttpError(409, 'duplicate_found', Strings::get('household_duplicate', [
                        'name' => $first['name'], 'side' => self::SIDES[$first['side']] ?? '', 'who' => $first['added_by']['name'] ?? 'someone',
                    ]), ['matches' => $m]);
                }
            }
        }
        return $out;
    }

    public static function int(Fields $f, string $key, int $min, int $max): ?int
    {
        $v = $f->value($key);
        if ($v === null || $v === '') {
            return null;
        }
        if (!is_int($v) && !(is_string($v) && ctype_digit($v))) {
            $f->error($key, Strings::get('field_bad_number', ['min' => $min, 'max' => $max]));
            return null;
        }
        $v = (int) $v;
        if ($v < $min || $v > $max) {
            $f->error($key, Strings::get('field_bad_number', ['min' => $min, 'max' => $max]));
            return null;
        }
        return $v;
    }

    /** Restoring a family whose phone is now on another live family: restore anyway, warn (FEATURES B9, DS-16). */
    public static function restoreCheck(Db $db, array $row): ?array
    {
        $phones = array_filter([$row['phone'], $row['alt_phone']]);
        $m = $phones === [] ? [] : Duplicates::phoneMatches($db, $phones, (int) $row['id']);
        return $m === [] ? null : ['warning' => Strings::get('restore_phone_clash', ['name' => $row['name'], 'other' => $m[0]['name']])];
    }

    public static function formatValue(string $field, mixed $value): string
    {
        return match ($field) {
            'side' => self::SIDES[(string) $value] ?? (string) $value,
            'food' => self::FOOD[(string) $value] ?? (string) $value,
            'is_vip' => (int) $value ? 'Yes' : 'No',
            'phone', 'alt_phone' => $value === null ? '(empty)' : Phone::mask((string) $value),
            default => History::formatValue($value),
        };
    }
}
