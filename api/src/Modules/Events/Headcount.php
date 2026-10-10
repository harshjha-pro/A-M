<?php
declare(strict_types=1);

namespace AM\Modules\Events;

use AM\Db\Db;

/** RSVP counts per event — DATABASE §7.4. "Up to" = coming + waiting. */
final class Headcount
{
    public static function forEvent(Db $db, array $event): array
    {
        $people = 'COALESCE(he.expected_adults, h.adults) + COALESCE(he.expected_children, h.children)';
        $r = $db->one(
            "SELECT COUNT(he.id) AS families_invited,
                COALESCE(SUM(he.rsvp = 'coming'), 0) AS families_coming,
                COALESCE(SUM(he.rsvp = 'not_coming'), 0) AS families_not_coming,
                COALESCE(SUM(CASE WHEN he.rsvp = 'coming' THEN $people END), 0) AS people_coming,
                COALESCE(SUM(CASE WHEN he.rsvp = 'waiting' THEN $people END), 0) AS people_waiting,
                COALESCE(SUM(CASE WHEN he.rsvp = 'not_asked' THEN $people END), 0) AS people_not_asked,
                COALESCE(SUM(CASE WHEN he.rsvp = 'coming' THEN
                    CASE h.food WHEN 'jain' THEN $people WHEN 'mixed' THEN LEAST(h.jain_count, $people) ELSE 0 END END), 0) AS jain_coming
             FROM household_events he JOIN households h ON h.id = he.household_id AND h.deleted_at IS NULL
             WHERE he.event_id = ? AND he.deleted_at IS NULL",
            [$event['id']],
        ) ?? [];
        $out = ['event' => ['id' => $event['public_id'], 'name' => $event['name']]];
        foreach (['families_invited', 'families_coming', 'families_not_coming', 'people_coming', 'people_waiting', 'people_not_asked', 'jain_coming'] as $k) {
            $out[$k] = (int) ($r[$k] ?? 0);
        }
        $out['people_up_to'] = $out['people_coming'] + $out['people_waiting'];
        return $out;
    }
}
