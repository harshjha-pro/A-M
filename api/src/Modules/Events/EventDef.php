<?php
declare(strict_types=1);

namespace AM\Modules\Events;

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
use DateTimeImmutable;
use DateTimeZone;

/** Wedding functions (FEATURES B4). Admins write; everyone reads. Times are stored in UTC, shown in IST. */
final class EventDef extends EntityDef
{
    public const TABLE = 'events';
    public const TYPE = 'event';
    public const RESOURCE = 'events';
    public const LABEL = 'event';
    public const LABEL_PLURAL = 'events';
    public const FIELD_LABELS = [
        'name' => 'Name', 'type' => 'Type', 'side' => 'Side', 'guests_invited' => 'Guests invited',
        'start_at' => 'Starts', 'end_at' => 'Ends', 'all_day' => 'All day',
        'venue_name' => 'Venue', 'venue_address' => 'Address', 'map_url' => 'Map link',
        'dress_code' => 'Dress code', 'notes' => 'Notes',
    ];
    public const CHILDREN = [InvitationDef::class => 'event_id'];
    public const TYPES = ['engagement' => 'Engagement', 'roka' => 'Roka', 'haldi' => 'Haldi', 'mehndi' => 'Mehndi', 'sangeet' => 'Sangeet',
        'mayra' => 'Mayra', 'wedding' => 'Wedding', 'reception' => 'Reception', 'other' => 'Other'];
    public const SIDES = ['bride' => "Bride's side", 'groom' => "Groom's side", 'both' => 'Both sides'];

    public static function name(array $row): string
    {
        return (string) ($row['name'] ?? 'an event');
    }

    public static function present(App $app, Db $db, Refs $refs, array $row, ?array $viewer): array
    {
        $id = (int) $row['id'];
        $docs = Permissions::isAdmin($viewer)
            ? 'SELECT COUNT(*) FROM documents WHERE event_id = ? AND deleted_at IS NULL'
            : 'SELECT COUNT(*) FROM documents WHERE event_id = ? AND deleted_at IS NULL AND is_private = 0 AND payment_id IS NULL';
        $counts = [
            'tasks' => (int) $db->value("SELECT COUNT(*) FROM tasks WHERE event_id = ? AND deleted_at IS NULL AND status <> 'cancelled'", [$id]),
            'invitations' => (int) $db->value('SELECT COUNT(*) FROM household_events he JOIN households h ON h.id = he.household_id AND h.deleted_at IS NULL WHERE he.event_id = ? AND he.deleted_at IS NULL', [$id]),
        ];
        if (Permissions::canSeeMoney($viewer)) {
            $counts['payments'] = (int) $db->value('SELECT COUNT(*) FROM payments WHERE event_id = ? AND deleted_at IS NULL', [$id]);
        }
        $counts['documents'] = (int) $db->value($docs, [$id]);
        return [
            'id' => $row['public_id'],
            'version' => (int) $row['version'],
            'name' => $row['name'],
            'type' => $row['type'],
            'side' => $row['side'],
            'guests_invited' => (bool) $row['guests_invited'],
            'start_at' => Time::iso($row['start_at']),
            'end_at' => Time::iso($row['end_at']),
            'all_day' => (bool) $row['all_day'],
            'date' => self::istDate($row['start_at']),
            'venue_name' => $row['venue_name'],
            'venue_address' => $row['venue_address'],
            'map_url' => $row['map_url'],
            'dress_code' => $row['dress_code'],
            'notes' => $row['notes'],
            'sort_order' => (int) $row['sort_order'],
            'counts' => $counts,
            'headcount' => (bool) $row['guests_invited'] ? Headcount::forEvent($db, $row) : null,
            'created_at' => Time::iso($row['created_at']),
            'created_by' => $refs->user($row['created_by'] !== null ? (int) $row['created_by'] : null),
            'updated_at' => Time::iso($row['updated_at']),
            'updated_by' => $refs->user($row['updated_by'] !== null ? (int) $row['updated_by'] : null),
        ];
    }

    /** "2027-02-14" in India for a UTC datetime (null = Date not set). */
    public static function istDate(?string $utc): ?string
    {
        return $utc === null ? null : (new DateTimeImmutable($utc, new DateTimeZone('UTC')))->setTimezone(new DateTimeZone('Asia/Kolkata'))->format('Y-m-d');
    }

    public static function input(App $app, Fields $f, bool $create, ?array $current): array
    {
        $f->only([...array_keys(self::FIELD_LABELS), 'allow_duplicate']);
        $out = [];
        if ($create || $f->has('name')) {
            $out['name'] = $f->text('name', 80, true);
        }
        if ($create || $f->has('type')) {
            $out['type'] = $f->enum('type', array_keys(self::TYPES), true);
        }
        if ($f->has('side') || $create) {
            $out['side'] = $f->enum('side', array_keys(self::SIDES)) ?? 'both';
        }
        if ($f->has('guests_invited') || $create) {
            $out['guests_invited'] = (int) ($f->bool('guests_invited') ?? false);
        }
        if ($f->has('all_day') || $create) {
            $out['all_day'] = (int) ($f->bool('all_day') ?? false);
        }
        foreach (['start_at', 'end_at'] as $k) {
            if ($create || $f->has($k)) {
                $out[$k] = self::datetime($f, $k);
            }
        }
        foreach (['venue_name' => 120, 'venue_address' => 300, 'dress_code' => 120, 'notes' => 5000] as $k => $max) {
            if ($create || $f->has($k)) {
                $out[$k] = $f->text($k, $max);
            }
        }
        if ($create || $f->has('map_url')) {
            $url = $f->text('map_url', 500);
            if ($url !== null && !preg_match('#^https://\S+$#i', $url)) {
                $f->error('map_url', Strings::get('field_https_only'));
            }
            $out['map_url'] = $url;
        }
        // An all-day event starts at midnight IST of its day (the time part is ignored).
        $allDay = (bool) ($out['all_day'] ?? $current['all_day'] ?? false);
        if ($allDay && ($out['start_at'] ?? null) !== null) {
            $out['start_at'] = self::istMidnightUtc((string) self::istDate($out['start_at']));
            if (!array_key_exists('end_at', $out)) {
                $out['end_at'] = null;
            }
        }
        $start = array_key_exists('start_at', $out) ? $out['start_at'] : ($current['start_at'] ?? null);
        $end = array_key_exists('end_at', $out) ? $out['end_at'] : ($current['end_at'] ?? null);
        if ($end !== null && ($start === null || $end <= $start)) {
            $f->error('end_at', Strings::get('field_end_before_start_time')); // AC-EVT-08
        }
        if ($create && !$f->hasErrors() && ($f->value('allow_duplicate') ?? false) !== true) {
            self::assertNoDuplicate($app->db(), (string) $out['type'], $out['start_at'] ?? null);
        }
        return $out;
    }

    /** Custom events go after the seeded ones. */
    public static function onCreate(App $app, array $viewer): array
    {
        return ['sort_order' => (int) $app->db()->value('SELECT COALESCE(MAX(sort_order), 0) + 10 FROM events')];
    }

    /** Same type on the same IST date (not "Other") → 409 with "Add anyway" (FEATURES B4). */
    private static function assertNoDuplicate(Db $db, string $type, ?string $start): void
    {
        if ($start === null || $type === 'other') {
            return;
        }
        $day = (string) self::istDate($start);
        $from = self::istMidnightUtc($day);
        $to = (new DateTimeImmutable($from))->modify('+1 day')->format('Y-m-d H:i:s');
        $other = $db->one('SELECT public_id, name FROM events WHERE deleted_at IS NULL AND type = ? AND start_at >= ? AND start_at < ? LIMIT 1', [$type, $from, $to]);
        if ($other !== null) {
            $date = (new DateTimeImmutable($day))->format('D, j M Y');
            throw new HttpError(409, 'duplicate_found', Strings::get('event_duplicate', ['name' => $other['name'], 'date' => $date]), [
                'matches' => [['id' => $other['public_id'], 'name' => $other['name']]],
            ]);
        }
    }

    /** ISO 8601 with Z or an offset ("2027-02-14T12:30:00Z", "…+05:30") → UTC "Y-m-d H:i:s". */
    private static function datetime(Fields $f, string $key): ?string
    {
        $v = $f->raw($key, false, 40);
        if ($v === null) {
            return null;
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/', $v)) {
            $f->error($key, Strings::get('field_bad_datetime'));
            return null;
        }
        try {
            $d = new DateTimeImmutable($v);
        } catch (\Exception) {
            $f->error($key, Strings::get('field_bad_datetime'));
            return null;
        }
        return $d->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    }

    public static function istMidnightUtc(string $ymd): string
    {
        return (new DateTimeImmutable("$ymd 00:00:00", new DateTimeZone('Asia/Kolkata')))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    }

    public static function formatValue(string $field, mixed $value): string
    {
        if (in_array($field, ['start_at', 'end_at'], true) && $value !== null) {
            return (new DateTimeImmutable((string) $value, new DateTimeZone('UTC')))->setTimezone(new DateTimeZone('Asia/Kolkata'))->format('D, j M Y, g:i A') . ' IST';
        }
        return match ($field) {
            'type' => self::TYPES[(string) $value] ?? (string) $value,
            'side' => self::SIDES[(string) $value] ?? (string) $value,
            'guests_invited', 'all_day' => (int) $value ? 'Yes' : 'No',
            default => History::formatValue($value),
        };
    }
}
