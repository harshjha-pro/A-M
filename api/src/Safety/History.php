<?php
declare(strict_types=1);

namespace AM\Safety;

use AM\Auth\Permissions;
use AM\Kernel\Time;
use AM\Repo\EntityDef;
use AM\Repo\Refs;
use AM\Repo\Versioned;
use DateTimeImmutable;

/**
 * Turns audit_log rows into plain sentences (FEATURES A5):
 *   "Mahi changed City from Bhilwara to Udaipur."
 *   "Ayush deleted Restore drill · 8 Oct 2026."
 * Money fields are removed for people without money access, in the sentence
 * AND in the change list (AC-ACT-02). Built from full before/after rows (DB4).
 */
final class History
{
    /**
     * @param array<string,mixed> $a  audit_log row (+ batch_public_id)
     * @param class-string<EntityDef>|null $def
     */
    public static function line(Refs $refs, array $a, ?string $def, ?array $viewer): array
    {
        $by = $refs->user($a['user_id'] !== null ? (int) $a['user_id'] : null);
        $who = $by['name'] ?? 'The system';
        $before = json_decode((string) $a['before_json'], true) ?: [];
        $after = json_decode((string) $a['after_json'], true) ?: [];
        $row = $after ?: $before;

        $labels = $def !== null ? $def::FIELD_LABELS : [];
        $visible = $def !== null ? ($def::visibleFields($viewer) ?? array_keys($labels)) : [];
        $hidden = $def !== null && !Permissions::canSeeMoney($viewer) ? $def::MONEY_FIELDS : [];

        $changes = [];
        if (in_array($a['action'], ['update', 'role_change', 'undo', 'merge', 'status_change'], true) && $before !== [] && $after !== []) {
            foreach ($labels as $field => $label) {
                if (!in_array($field, $visible, true) || in_array($field, $hidden, true) || !array_key_exists($field, $after)) {
                    continue;
                }
                if (Versioned::same($before[$field] ?? null, $after[$field])) {
                    continue;
                }
                $changes[] = [
                    'field' => $field, 'label' => $label,
                    'from' => $before[$field] ?? null, 'to' => $after[$field],
                    'from_text' => $def::formatValue($field, $before[$field] ?? null),
                    'to_text' => $def::formatValue($field, $after[$field]),
                ];
            }
        }

        $thing = $row !== [] && $def !== null ? $def::name($row) : ($def !== null ? $def::LABEL : (string) $a['entity_type']);
        $sentence = self::sentence((string) $a['action'], $who, $thing, $changes, $a, $by);

        return [
            'at' => Time::iso($a['created_at']),
            'action' => $a['action'],
            'user' => $by,
            'device' => $a['device'],
            'entity' => ['type' => $a['entity_type'], 'id' => $row['public_id'] ?? null, 'name' => $thing],
            'sentence' => $sentence,
            'changes' => array_map(static fn ($c) => ['field' => $c['field'], 'label' => $c['label'], 'from' => $c['from'], 'to' => $c['to']], $changes),
            'batch_id' => $a['batch_public_id'] ?? null,
        ];
    }

    private static function sentence(string $action, string $who, string $thing, array $changes, array $a, ?array $by): string
    {
        $note = (string) ($a['note'] ?? '');
        switch ($action) {
            case 'create':
                return "$who added $thing.";
            case 'delete':
                return "$who deleted $thing.";
            case 'restore':
                return "$who restored $thing.";
            case 'undo':
                return $changes === [] ? "$who brought back $thing (Undo)." : "$who undid a change to $thing: " . self::changeWords($changes) . '.';
            case 'update':
            case 'role_change':
            case 'merge':
            case 'status_change':
                if ($changes === []) {
                    return "$who changed $thing.";
                }
                if (count($changes) === 1) {
                    $c = $changes[0];
                    return "$who changed {$c['label']} from {$c['from_text']} to {$c['to_text']}" . ($a['entity_type'] === 'settings' ? '' : " for $thing") . '.';
                }
                return "$who changed " . self::changeWords($changes) . ($a['entity_type'] === 'settings' ? '' : " for $thing") . '.';
            case 'login':
                return "$who logged in.";
            case 'logout':
                return $note !== '' ? "$who: $note." : "$who logged out.";
            case 'login_failed':
                return $note === 'Access ended' ? "$thing tried to log in after their access ended." : "Someone tried to log in as $thing with a wrong password.";
            case 'password_reset':
                if ($by !== null && (int) ($a['user_id'] ?? 0) === (int) ($a['entity_id'] ?? -1)) {
                    return "$who changed their password.";
                }
                return "$who reset the password of $thing" . ($note !== '' ? " ($note)" : '') . '.';
            case 'backup':
                // note: "Backup wedding_20261009_0217.sql.gz.enc (nightly_db)" from backup.php
                $kind = str_contains($note, '(manual_db)') ? 'Manual backup' : (str_contains($note, '(pre_migration)') ? 'Backup before an update' : 'Nightly backup');
                return "$kind saved off-site.";
            default:
                return "$who: $action $thing.";
        }
    }

    private static function changeWords(array $changes): string
    {
        $labels = array_column($changes, 'label');
        return count($labels) === 1 ? $labels[0] : implode(', ', array_slice($labels, 0, -1)) . ' and ' . end($labels);
    }

    /** Default value words: dates as "14 Feb 2027", empty as "(empty)". */
    public static function formatValue(mixed $value): string
    {
        if ($value === null || $value === '') {
            return '(empty)';
        }
        if (is_string($value) && Time::isDate($value)) {
            return (new DateTimeImmutable($value))->format('j M Y');
        }
        if (is_bool($value)) {
            return $value ? 'Yes' : 'No';
        }
        return (string) $value;
    }

    /** 12500000 → "₹1,25,000" (Indian grouping, integers only). */
    public static function rupees(?int $paise): string
    {
        if ($paise === null) {
            return '(empty)';
        }
        $r = intdiv($paise, 100);
        $p = $paise % 100;
        $s = (string) $r;
        if (strlen($s) > 3) {
            $last3 = substr($s, -3);
            $rest = substr($s, 0, -3);
            $rest = (string) preg_replace('/\B(?=(\d{2})+(?!\d))/', ',', $rest);
            $s = $rest . ',' . $last3;
        }
        return '₹' . $s . ($p ? '.' . str_pad((string) $p, 2, '0', STR_PAD_LEFT) : '');
    }
}
