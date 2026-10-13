<?php
declare(strict_types=1);

namespace AM\Modules\Outfits;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Kernel\App;
use AM\Kernel\Strings;
use AM\Modules\Vault\AttachmentLinkDef;
use AM\Repo\EntityDef;
use AM\Repo\Refs;
use AM\Safety\History;
use AM\Validation\Fields;
use DateTimeImmutable;

/** One step of an outfit's timeline (Selected, Stitched, …), with the date it was done. */
final class OutfitStepDef extends EntityDef
{
    public const TABLE = 'outfit_steps';
    public const TYPE = 'outfit_step';
    public const RESOURCE = 'outfit-steps';
    public const LABEL = 'timeline step';
    public const LABEL_PLURAL = 'timeline steps';
    public const FIELD_LABELS = ['name' => 'Step', 'done_on' => 'Done on', 'sort_order' => 'Order'];
    public const PARENT = [OutfitDef::class, 'outfit_id'];
    public const QUIET_IN_PARENT_BATCH = true;
    public const CHILDREN = [NoteDef::class => 'outfit_step_id', AttachmentLinkDef::class => 'outfit_step_id'];

    public static function name(array $row): string
    {
        return (string) ($row['name'] ?? 'a timeline step');
    }

    public static function canView(?array $viewer, array $row): bool
    {
        return Permissions::isAdmin($viewer);
    }

    public static function present(App $app, Db $db, Refs $refs, array $row, ?array $viewer): array
    {
        return [
            'id' => $row['public_id'],
            'version' => (int) $row['version'],
            'name' => $row['name'],
            'sort_order' => (int) $row['sort_order'],
            'done_on' => $row['done_on'],
            'done' => $row['done_on'] !== null,
        ];
    }

    public static function input(App $app, Fields $f, bool $create, ?array $current): array
    {
        $f->only(['name', 'sort_order', 'done_on']);
        $out = [];
        if ($create || $f->has('name')) {
            $out['name'] = $f->text('name', 60, true);
        }
        if ($f->has('done_on')) {
            $d = $f->date('done_on');
            if ($d !== null && $d > $app->clock->todayIst()) {
                $f->error('done_on', Strings::get('field_date_future'));
            }
            $out['done_on'] = $d;
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
        if ($field === 'done_on') {
            return $value === null ? 'not done' : (new DateTimeImmutable((string) $value))->format('j M Y');
        }
        return History::formatValue($value);
    }
}
