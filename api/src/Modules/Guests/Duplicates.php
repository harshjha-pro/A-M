<?php
declare(strict_types=1);

namespace AM\Modules\Guests;

use AM\Db\Db;

/** Duplicate checks for families (FEATURES B5): same phone (hard), same name + city (hint). */
final class Duplicates
{
    /** @param list<string> $phones E.164 @return list<array> Match objects */
    public static function phoneMatches(Db $db, array $phones, ?int $exceptId = null): array
    {
        $phones = array_values(array_unique(array_filter($phones)));
        if ($phones === []) {
            return [];
        }
        $in = implode(',', array_fill(0, count($phones), '?'));
        $rows = $db->all(
            "SELECT h.id, h.public_id, h.name, h.side, h.phone, h.alt_phone, u.public_id AS u_pid, u.name AS u_name
             FROM households h LEFT JOIN users u ON u.id = h.created_by
             WHERE h.deleted_at IS NULL AND h.id <> ? AND (h.phone IN ($in) OR h.alt_phone IN ($in)) ORDER BY h.id LIMIT 10",
            [$exceptId ?? 0, ...$phones, ...$phones],
        );
        return array_map(static fn ($r) => self::match($r, in_array($r['phone'], $phones, true) ? 'phone' : 'alt_phone'), $rows);
    }

    /** @return list<array> */
    public static function nameMatches(Db $db, string $name, ?string $city, ?int $exceptId = null): array
    {
        $norm = HouseholdDef::normName($name);
        if ($norm === '') {
            return [];
        }
        $rows = $db->all(
            "SELECT h.id, h.public_id, h.name, h.side, h.phone, u.public_id AS u_pid, u.name AS u_name
             FROM households h LEFT JOIN users u ON u.id = h.created_by
             WHERE h.deleted_at IS NULL AND h.id <> ? AND h.name_norm = ? AND (? IS NULL OR h.city = ?) ORDER BY h.id LIMIT 10",
            [$exceptId ?? 0, $norm, $city, $city],
        );
        return array_map(static fn ($r) => self::match($r, 'name_city'), $rows);
    }

    private static function match(array $r, string $on): array
    {
        return [
            'id' => $r['public_id'], 'name' => $r['name'], 'side' => $r['side'], 'phone' => $r['phone'],
            'added_by' => $r['u_pid'] === null ? null : ['id' => $r['u_pid'], 'name' => $r['u_name']],
            'match_on' => $on,
        ];
    }

    /** Add `dup` (shares a phone with another live family) to a page of rows: one indexed query. */
    public static function flag(Db $db, array $rows): array
    {
        $phones = [];
        foreach ($rows as $r) {
            foreach ([$r['phone'], $r['alt_phone']] as $p) {
                if ($p !== null) {
                    $phones[$p] = true;
                }
            }
        }
        $owners = [];
        if ($phones !== []) {
            $list = array_keys($phones);
            $in = implode(',', array_fill(0, count($list), '?'));
            foreach ($db->all("SELECT id, phone AS p FROM households WHERE deleted_at IS NULL AND phone IN ($in)
                               UNION ALL SELECT id, alt_phone AS p FROM households WHERE deleted_at IS NULL AND alt_phone IN ($in)", [...$list, ...$list]) as $o) {
                $owners[$o['p']][(int) $o['id']] = true;
            }
        }
        foreach ($rows as &$r) {
            $others = [];
            foreach ([$r['phone'], $r['alt_phone']] as $p) {
                if ($p !== null) {
                    $others += $owners[$p] ?? [];
                }
            }
            unset($others[(int) $r['id']]);
            $r['dup'] = $others !== [];
        }
        return $rows;
    }

    /** SQL fragment: this live family shares a phone with another live family. */
    public static function sharedPhoneSql(string $alias = 'h'): string
    {
        return "EXISTS (SELECT 1 FROM households d WHERE d.deleted_at IS NULL AND d.id <> $alias.id AND (
                  ($alias.phone IS NOT NULL AND ($alias.phone = d.phone OR $alias.phone = d.alt_phone))
               OR ($alias.alt_phone IS NOT NULL AND ($alias.alt_phone = d.phone OR $alias.alt_phone = d.alt_phone))))";
    }
}
