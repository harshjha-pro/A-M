<?php
declare(strict_types=1);

namespace AM\Modules\Planning;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Kernel\App;
use AM\Kernel\Strings;
use AM\Modules\Outfits\OutfitParts;
use AM\Modules\Vault\AttachmentLinkDef;
use AM\Repo\EntityDef;
use AM\Repo\Refs;
use AM\Safety\History;
use AM\Validation\Fields;

/**
 * One step of a workspace's event timeline (1.0.20): purpose and duration required, a clock
 * time optional (a step without one follows the step before), a note, attachments and tasks.
 */
final class TimelineStepDef extends EntityDef
{
    public const TABLE = 'timeline_steps';
    public const TYPE = 'timeline_step';
    public const RESOURCE = 'timeline-steps';
    public const LABEL = 'event step';
    public const LABEL_PLURAL = 'event steps';
    public const FIELD_LABELS = ['purpose' => 'Purpose', 'start_time' => 'Time', 'duration_min' => 'Duration', 'note' => 'Note', 'sort_order' => 'Order'];
    public const CHILDREN = [AttachmentLinkDef::class => 'timeline_step_id'];

    /** Suggested steps by workspace name (also in migration 008 for the 7 default workspaces). */
    public const SUGGESTED = [
        'engagement' => [['Guests arrive', 30], ['Ganesh puja', 20], ['Ring ceremony', 20], ['Blessings and photos', 40], ['Lunch', 60]],
        'mehndi' => [['Guests arrive', 30], ["Bride's mehndi", 120], ['Music and dance', 60], ['Lunch', 60]],
        'carnival' => [['Guests arrive', 30], ['Games and stalls', 120], ['Dinner', 60]],
        'dj night' => [['Guests arrive', 30], ['Family performances', 60], ['DJ and dance', 120], ['Dinner', 60]],
        'mayra' => [['Mayra party arrives', 20], ['Mayra rasam', 45], ['Blessings and gifts', 30], ['Lunch', 60]],
        'reception' => [['Couple entry', 15], ['Stage greetings and photos', 120], ['Dinner', 90], ['Send-off', 15]],
        'varmala & phere' => [['Baraat arrival', 60], ['Varmala', 30], ['Dinner', 60], ['Phere', 120], ['Vidaai', 30]],
        '' => [['Guests arrive', 30], ['Main ceremony', 60], ['Food', 60]],
    ];

    public static function name(array $row): string
    {
        return (string) ($row['purpose'] ?? 'an event step');
    }

    public static function canView(?array $viewer, array $row): bool
    {
        return Permissions::isAdmin($viewer);
    }

    public static function present(App $app, Db $db, Refs $refs, array $row, ?array $viewer): array
    {
        $id = (int) $row['id'];
        return [
            'id' => $row['public_id'],
            'version' => (int) $row['version'],
            'purpose' => $row['purpose'],
            'start_time' => $row['start_time'] !== null ? substr((string) $row['start_time'], 0, 5) : null,
            'duration_min' => (int) $row['duration_min'],
            'note' => $row['note'],
            'sort_order' => (int) $row['sort_order'],
            'attachments' => OutfitParts::attachments($app, $db, $refs, 'timeline_step_id', $id, $viewer),
            'tasks' => OutfitParts::tasks($app, $db, $refs, 'timeline_step', $id),
        ];
    }

    /**
     * The whole timeline of a workspace: each step with `starts` ("19:30") — its own time, or the
     * end of the step before (`estimated` true) — and `ends`; plus the total length.
     * @return array{steps:list<array>, total_min:int}
     */
    public static function timeline(App $app, Db $db, Refs $refs, int $workspaceId, ?array $viewer): array
    {
        $rows = $db->all('SELECT * FROM timeline_steps WHERE workspace_id = ? AND deleted_at IS NULL ORDER BY sort_order, id', [$workspaceId]);
        $steps = [];
        $clock = null; // minutes after midnight where the next step starts, if known
        $total = 0;
        foreach ($rows as $r) {
            $s = self::present($app, $db, $refs, $r, $viewer);
            $estimated = false;
            if ($s['start_time'] !== null) {
                [$h, $m] = array_map('intval', explode(':', $s['start_time']));
                $clock = $h * 60 + $m;
            } elseif ($clock !== null) {
                $estimated = true;
            }
            $s['starts'] = $clock === null ? null : self::hhmm($clock);
            $s['estimated'] = $estimated;
            if ($clock !== null) {
                $clock += $s['duration_min'];
                $s['ends'] = self::hhmm($clock);
            } else {
                $s['ends'] = null;
            }
            $total += $s['duration_min'];
            $steps[] = $s;
        }
        return ['steps' => $steps, 'total_min' => $total];
    }

    private static function hhmm(int $min): string
    {
        $min = (($min % 1440) + 1440) % 1440; // past midnight wraps to the next morning
        return sprintf('%02d:%02d', intdiv($min, 60), $min % 60);
    }

    public static function input(App $app, Fields $f, bool $create, ?array $current): array
    {
        $f->only(['purpose', 'start_time', 'duration_min', 'note', 'sort_order']);
        $out = [];
        if ($create || $f->has('purpose')) {
            $out['purpose'] = $f->text('purpose', 120, true);
        }
        if ($f->has('start_time')) {
            $v = $f->value('start_time');
            if ($v === null || $v === '') {
                $out['start_time'] = null;
            } elseif (is_string($v) && preg_match('/^([01]\d|2[0-3]):([0-5]\d)$/', $v)) {
                $out['start_time'] = $v . ':00';
            } else {
                $f->error('start_time', Strings::get('timeline_time_format'));
            }
        }
        if ($create || $f->has('duration_min')) {
            $v = $f->value('duration_min');
            if (is_int($v) && $v >= 1 && $v <= 1440) {
                $out['duration_min'] = $v;
            } else {
                $f->error('duration_min', Strings::get($v === null ? 'field_required' : 'timeline_duration'));
            }
        }
        if ($f->has('note')) {
            $out['note'] = $f->text('note', 5000);
        }
        if ($f->has('sort_order')) {
            $v = $f->value('sort_order');
            if (is_int($v) && $v >= 0 && $v <= 10000) {
                $out['sort_order'] = $v;
            } else {
                $f->error('sort_order', Strings::get('field_bad_choice'));
            }
        }
        return $out;
    }

    public static function formatValue(string $field, mixed $value): string
    {
        return match ($field) {
            'start_time' => $value === null ? 'no time' : substr((string) $value, 0, 5),
            'duration_min' => self::duration((int) $value),
            default => History::formatValue($value),
        };
    }

    /** "1 h 30 min" */
    public static function duration(int $min): string
    {
        $h = intdiv($min, 60);
        $m = $min % 60;
        return trim(($h > 0 ? "$h h " : '') . ($m > 0 || $h === 0 ? "$m min" : ''));
    }
}
