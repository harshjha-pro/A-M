<?php
declare(strict_types=1);

namespace AM\Modules\Events;

use AM\Db\Db;
use AM\Kernel\App;
use AM\Kernel\Time;
use AM\Repo\EntityDef;
use AM\Repo\Refs;
use AM\Safety\History;

/**
 * A family invited to an event (household_events), with its RSVP (FEATURES B5).
 * Deleted and restored with its event or its family in the same batch; then the
 * parent's line says it (QUIET_IN_PARENT_BATCH). Its own changes have History lines.
 */
final class InvitationDef extends EntityDef
{
    public const TABLE = 'household_events';
    public const TYPE = 'invitation';
    public const LABEL = 'invitation';
    public const LABEL_PLURAL = 'invitations';
    public const PUBLIC_ID = false;
    public const KEY = null;
    public const QUIET_IN_PARENT_BATCH = true;
    public const PARENT = [EventDef::class, 'event_id'];
    public const FIELD_LABELS = [
        'rsvp' => 'Coming?', 'expected_adults' => 'Adults expected', 'expected_children' => 'Children expected', 'rsvp_note' => 'RSVP note',
    ];
    public const RSVP = ['not_asked' => 'Not asked', 'waiting' => 'Waiting', 'coming' => 'Coming', 'not_coming' => 'Not coming'];

    public static function name(array $row): string
    {
        return 'invitation';
    }

    /** "Sharma family · Sangeet" */
    public static function describe(Refs $refs, array $row): string
    {
        $h = $refs->row('households', isset($row['household_id']) ? (int) $row['household_id'] : null);
        $e = $refs->row('events', isset($row['event_id']) ? (int) $row['event_id'] : null);
        return ($h['name'] ?? 'a family') . ' · ' . ($e['name'] ?? 'an event');
    }

    /** API shape `Invitation`; $h = the family row (for people defaults). */
    public static function view(Refs $refs, array $row, array $h): array
    {
        $adults = $row['expected_adults'] !== null ? (int) $row['expected_adults'] : (int) $h['adults'];
        $children = $row['expected_children'] !== null ? (int) $row['expected_children'] : (int) $h['children'];
        return [
            'household_id' => $h['public_id'],
            'event' => $refs->row('events', (int) $row['event_id']),
            'version' => (int) $row['version'],
            'rsvp' => $row['rsvp'],
            'expected_adults' => $row['expected_adults'] !== null ? (int) $row['expected_adults'] : null,
            'expected_children' => $row['expected_children'] !== null ? (int) $row['expected_children'] : null,
            'people' => $adults + $children,
            'rsvp_note' => $row['rsvp_note'],
            'rsvp_updated_at' => Time::iso($row['rsvp_updated_at']),
            'rsvp_updated_by' => $refs->user($row['rsvp_updated_by'] !== null ? (int) $row['rsvp_updated_by'] : null),
            'last_reminder_opened_at' => Time::iso($row['last_reminder_opened_at']),
        ];
    }

    public static function present(App $app, Db $db, Refs $refs, array $row, ?array $viewer): array
    {
        $h = $db->one('SELECT * FROM households WHERE id = ?', [$row['household_id']]) ?? [];
        return self::view($refs, $row, $h);
    }

    public static function formatValue(string $field, mixed $value): string
    {
        return match ($field) {
            'rsvp' => self::RSVP[(string) $value] ?? (string) $value,
            'expected_adults', 'expected_children' => $value === null ? 'family default' : (string) $value,
            default => History::formatValue($value),
        };
    }
}
