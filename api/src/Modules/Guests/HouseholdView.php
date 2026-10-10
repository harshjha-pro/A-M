<?php
declare(strict_types=1);

namespace AM\Modules\Guests;

use AM\Db\Db;
use AM\Kernel\App;
use AM\Kernel\Time;
use AM\Modules\Events\InvitationDef;
use AM\Repo\Refs;

/** API shapes for families (API.md §6.7). */
final class HouseholdView
{
    /** Fields shared by the list row and the family page. */
    public static function base(Refs $refs, array $r, bool $possibleDuplicate): array
    {
        return [
            'id' => $r['public_id'],
            'version' => (int) $r['version'],
            'name' => $r['name'],
            'phone' => $r['phone'],
            'alt_phone' => $r['alt_phone'],
            'side' => $r['side'],
            'group_name' => $r['group_name'],
            'relation' => $r['relation'],
            'area' => $r['area'],
            'city' => $r['city'],
            'address' => $r['address'],
            'adults' => (int) $r['adults'],
            'children' => (int) $r['children'],
            'people' => (int) $r['adults'] + (int) $r['children'],
            'food' => $r['food'],
            'jain_count' => (int) $r['jain_count'],
            'is_vip' => (bool) $r['is_vip'],
            'notes' => $r['notes'],
            'possible_duplicate' => $possibleDuplicate,
            'created_at' => Time::iso($r['created_at']),
            'created_by' => $refs->user($r['created_by'] !== null ? (int) $r['created_by'] : null),
            'updated_at' => Time::iso($r['updated_at']),
            'updated_by' => $refs->user($r['updated_by'] !== null ? (int) $r['updated_by'] : null),
        ];
    }

    /** Family page: everything + live invitations (events in calendar order). */
    public static function full(App $app, Db $db, Refs $refs, array $r): array
    {
        $dup = $r['deleted_at'] === null && (bool) $db->value('SELECT ' . Duplicates::sharedPhoneSql('h') . ' FROM households h WHERE h.id = ?', [$r['id']]);
        $inv = $db->all(
            'SELECT he.* FROM household_events he JOIN events e ON e.id = he.event_id AND e.deleted_at IS NULL
             WHERE he.household_id = ? AND he.deleted_at IS NULL ORDER BY e.start_at IS NULL, e.start_at, e.sort_order, e.id',
            [$r['id']],
        );
        return self::base($refs, $r, $dup) + ['invitations' => array_map(static fn ($i) => InvitationDef::view($refs, $i, $r), $inv)];
    }

    /**
     * List rows: one query for invitations of the whole page, not one per family.
     * @param list<array> $rows households rows with a `dup` column
     */
    public static function summaries(Db $db, Refs $refs, array $rows, ?int $eventId): array
    {
        $byFamily = [];
        if ($rows !== []) {
            $ids = array_map(static fn ($r) => (int) $r['id'], $rows);
            $in = implode(',', array_fill(0, count($ids), '?'));
            foreach ($db->all(
                "SELECT he.* FROM household_events he JOIN events e ON e.id = he.event_id AND e.deleted_at IS NULL
                 WHERE he.household_id IN ($in) AND he.deleted_at IS NULL ORDER BY e.start_at IS NULL, e.start_at, e.sort_order, e.id",
                $ids,
            ) as $i) {
                $byFamily[(int) $i['household_id']][] = $i;
            }
        }
        return array_map(static function (array $r) use ($refs, $byFamily, $eventId): array {
            $inv = array_map(static fn ($i) => InvitationDef::view($refs, $i, $r), $byFamily[(int) $r['id']] ?? []);
            $out = self::base($refs, $r, (bool) $r['dup']) + ['invitations' => $inv];
            if ($eventId !== null) {
                $here = array_values(array_filter($byFamily[(int) $r['id']] ?? [], static fn ($i) => (int) $i['event_id'] === $eventId));
                $out['invitation'] = $here !== [] ? InvitationDef::view($refs, $here[0], $r) : null;
            }
            return $out;
        }, $rows);
    }
}
