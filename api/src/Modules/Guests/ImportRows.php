<?php
declare(strict_types=1);

namespace AM\Modules\Guests;

use AM\Db\Db;
use AM\Kernel\Phone;
use AM\Kernel\Strings;

/**
 * Checks import rows (FEATURES A8) the same way for the preview and the real run:
 * normalise each row, find its problems, and its possible duplicates
 * (same phone as a live family or as another row; same name + city).
 */
final class ImportRows
{
    public const MAX = 3000;
    private const BRIDE = ['bride', 'brides', "bride's", 'ladki', 'ladkiwale', 'ladki wale', 'mahi', 'jagetiya', 'bride side', "bride's side"];
    private const GROOM = ['groom', 'grooms', "groom's", 'ladka', 'ladkewale', 'ladke wale', 'ayush', 'porwal', 'groom side', "groom's side"];
    private const BOTH = ['both', 'both sides', 'dono'];
    private const TEXT = ['group_name' => 80, 'relation' => 40, 'area' => 80, 'city' => 60, 'address' => 300, 'notes' => 5000];

    /**
     * @param list<array> $rows   ImportRow objects from the phone
     * @param array $defaults     {side?, event_ids?, city?}
     * @return list<array{row_no:int, status:string, errors:array, matches:list<array>, normalised:array, event_db_ids:list<int>}>
     */
    public static function check(Db $db, array $rows, array $defaults, string $settingsCity): array
    {
        $events = [];
        foreach ($db->all('SELECT id, public_id, guests_invited FROM events WHERE deleted_at IS NULL') as $e) {
            $events[$e['public_id']] = $e;
        }
        $defaultEvents = array_values(array_filter((array) ($defaults['event_ids'] ?? []), 'is_string'));
        $defaultSide = self::side($defaults['side'] ?? null);
        $defaultCity = self::str($defaults['city'] ?? null) ?? $settingsCity;

        $out = [];
        foreach ($rows as $i => $r) {
            $r = is_array($r) ? $r : [];
            $no = is_int($r['row_no'] ?? null) ? $r['row_no'] : $i + 1;
            $errors = [];
            $name = self::str($r['name'] ?? null);
            $n = ['row_no' => $no, 'name' => $name !== null ? mb_substr($name, 0, 120) : null];
            if ($name === null) {
                $errors['name'] = Strings::get('import_no_name');
            }
            foreach (['phone', 'alt_phone'] as $k) {
                $raw = $r[$k] ?? null;
                $raw = is_int($raw) || is_float($raw) ? sprintf('%.0f', $raw) : self::str($raw); // a phone stored as a number in Excel (AC-IMP-09)
                $p = $raw !== null ? Phone::normalize($raw) : null;
                if ($raw !== null && $p === null) {
                    $errors[$k] = Strings::get('field_bad_phone');
                }
                $n[$k] = $p['e164'] ?? null;
            }
            $sideRaw = $r['side'] ?? null;
            $n['side'] = self::side($sideRaw) ?? (self::str($sideRaw) === null ? $defaultSide : null);
            if ($n['side'] === null) {
                $errors['side'] = Strings::get('import_bad_side');
            }
            foreach (self::TEXT as $k => $max) {
                $v = self::str($r[$k] ?? null);
                $n[$k] = $v !== null ? mb_substr($v, 0, $max) : null;
            }
            $n['city'] ??= $defaultCity;
            foreach (['adults' => 2, 'children' => 0, 'jain_count' => 0] as $k => $def) {
                $v = $r[$k] ?? null;
                if ($v === null || $v === '') {
                    $n[$k] = $def;
                } elseif ((is_int($v) || (is_string($v) && ctype_digit(trim($v)))) && (int) $v <= ($k === 'jain_count' ? 100 : 50)) {
                    $n[$k] = (int) $v;
                } else {
                    $errors[$k] = Strings::get('import_bad_number');
                    $n[$k] = $def;
                }
            }
            if ($n['adults'] + $n['children'] < 1) {
                $errors['adults'] = Strings::get('field_people_min');
            }
            $food = strtolower((string) self::str($r['food'] ?? null));
            $n['food'] = match (true) {
                $food === '' || in_array($food, ['veg', 'vegetarian', 'shakahari', 'v'], true) => 'veg',
                in_array($food, ['jain', 'j'], true) => 'jain',
                in_array($food, ['mixed', 'mix', 'veg + jain', 'veg and jain'], true) => 'mixed',
                default => null,
            };
            if ($n['food'] === null) {
                $errors['food'] = Strings::get('import_bad_food');
                $n['food'] = 'veg';
            }
            if ($n['food'] === 'jain') {
                $n['jain_count'] = $n['adults'] + $n['children'];
            } elseif ($n['food'] !== 'mixed') {
                $n['jain_count'] = 0;
            } elseif ($n['jain_count'] > $n['adults'] + $n['children']) {
                $errors['jain_count'] = Strings::get('field_jain_too_many');
            }
            $vip = $r['is_vip'] ?? null;
            $n['is_vip'] = $vip === true || (is_string($vip) && in_array(strtolower(trim($vip)), ['yes', 'y', 'haan', 'ha', 'true', '1'], true)) || $vip === 1;
            $eventIds = array_values(array_unique([...array_filter((array) ($r['event_ids'] ?? []), 'is_string'), ...$defaultEvents]));
            $dbIds = [];
            foreach ($eventIds as $eid) {
                if (!isset($events[$eid]) || !(int) $events[$eid]['guests_invited']) {
                    $errors['event_ids'] = Strings::get('import_bad_event');
                } else {
                    $dbIds[] = (int) $events[$eid]['id'];
                }
            }
            $n['event_ids'] = $eventIds;
            $example = $name !== null && stripos($name, 'EXAMPLE') === 0; // the template's sample row
            $out[] = ['row_no' => $no, 'status' => $example ? 'skipped_example' : ($errors ? 'error' : 'new'), 'errors' => $errors,
                'matches' => [], 'normalised' => $n, 'event_db_ids' => $dbIds];
        }
        self::findDuplicates($db, $out);
        return $out;
    }

    /** Same phone as a live family or another row (AC-IMP-03); same name + city as a live family. */
    private static function findDuplicates(Db $db, array &$out): void
    {
        $byPhone = [];
        $phones = [];
        $norms = [];
        foreach ($out as $i => $o) {
            if ($o['status'] === 'skipped_example') {
                continue;
            }
            foreach (['phone', 'alt_phone'] as $k) {
                if ($o['normalised'][$k] !== null) {
                    $byPhone[$o['normalised'][$k]][] = $i;
                    $phones[$o['normalised'][$k]] = true;
                }
            }
            if ($o['normalised']['name'] !== null) {
                $norms[HouseholdDef::normName($o['normalised']['name'])] = true;
            }
        }
        $existing = [];
        foreach (array_chunk(array_keys($phones), 500) as $chunk) {
            $in = implode(',', array_fill(0, count($chunk), '?'));
            foreach ($db->all("SELECT h.public_id, h.name, h.side, h.phone, h.alt_phone, u.public_id AS u_pid, u.name AS u_name
                               FROM households h LEFT JOIN users u ON u.id = h.created_by
                               WHERE h.deleted_at IS NULL AND (h.phone IN ($in) OR h.alt_phone IN ($in))", [...$chunk, ...$chunk]) as $h) {
                foreach ([$h['phone'], $h['alt_phone']] as $p) {
                    if ($p !== null && isset($phones[$p])) {
                        $existing[$p][$h['public_id']] = $h;
                    }
                }
            }
        }
        $byName = [];
        foreach (array_chunk(array_keys($norms), 500) as $chunk) {
            $in = implode(',', array_fill(0, count($chunk), '?'));
            foreach ($db->all("SELECT h.public_id, h.name, h.name_norm, h.side, h.phone, h.city, u.public_id AS u_pid, u.name AS u_name
                               FROM households h LEFT JOIN users u ON u.id = h.created_by
                               WHERE h.deleted_at IS NULL AND h.name_norm IN ($in)", $chunk) as $h) {
                $byName[$h['name_norm'] . '|' . mb_strtolower((string) $h['city'])][] = $h;
            }
        }
        foreach ($out as $i => &$o) {
            if ($o['status'] === 'skipped_example') {
                continue;
            }
            $m = [];
            foreach (['phone', 'alt_phone'] as $k) {
                $p = $o['normalised'][$k];
                if ($p === null) {
                    continue;
                }
                foreach ($existing[$p] ?? [] as $h) {
                    $m[$h['public_id']] ??= self::match($h, $k);
                }
                foreach ($byPhone[$p] as $j) {
                    if ($j !== $i) {
                        $m['row:' . $out[$j]['row_no']] ??= ['id' => null, 'row_no' => $out[$j]['row_no'], 'name' => $out[$j]['normalised']['name'],
                            'side' => $out[$j]['normalised']['side'], 'phone' => $p, 'added_by' => null, 'match_on' => $k];
                    }
                }
            }
            if ($o['normalised']['name'] !== null) {
                $key = HouseholdDef::normName($o['normalised']['name']) . '|' . mb_strtolower((string) $o['normalised']['city']);
                foreach ($byName[$key] ?? [] as $h) {
                    $m[$h['public_id']] ??= self::match($h, 'name_city');
                }
            }
            $o['matches'] = array_values($m);
            if ($m !== [] && $o['status'] === 'new') {
                $o['status'] = 'duplicate';
            }
        }
    }

    private static function match(array $h, string $on): array
    {
        return ['id' => $h['public_id'], 'name' => $h['name'], 'side' => $h['side'], 'phone' => $h['phone'],
            'added_by' => $h['u_pid'] !== null ? ['id' => $h['u_pid'], 'name' => $h['u_name']] : null, 'match_on' => $on];
    }

    /** Side words people write (FEATURES A8 step 3). */
    public static function side(mixed $v): ?string
    {
        $s = strtolower(trim((string) (is_string($v) ? $v : '')));
        return match (true) {
            in_array($s, self::BRIDE, true) => 'bride',
            in_array($s, self::GROOM, true) => 'groom',
            in_array($s, self::BOTH, true) => 'both',
            default => null,
        };
    }

    private static function str(mixed $v): ?string
    {
        if (is_int($v) || is_float($v)) {
            $v = (string) $v;
        }
        if (!is_string($v)) {
            return null;
        }
        $v = trim(preg_replace('/\s+/u', ' ', $v) ?? '');
        return $v === '' ? null : $v;
    }
}
