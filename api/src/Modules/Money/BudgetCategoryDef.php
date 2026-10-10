<?php
declare(strict_types=1);

namespace AM\Modules\Money;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Strings;
use AM\Repo\EntityDef;
use AM\Repo\Refs;
use AM\Safety\History;
use AM\Validation\Fields;

/** Budget categories (FEATURES B6): a planned amount each; money users only. */
final class BudgetCategoryDef extends EntityDef
{
    public const TABLE = 'budget_categories';
    public const TYPE = 'budget_category';
    public const RESOURCE = 'budget-categories';
    public const LABEL = 'category';
    public const LABEL_PLURAL = 'categories';
    public const FIELD_LABELS = ['name' => 'Name', 'planned_paise' => 'Planned', 'sort_order' => 'Order'];
    public const MONEY_FIELDS = ['planned_paise'];

    public static function name(array $row): string
    {
        return (string) ($row['name'] ?? 'a category');
    }

    public static function canView(?array $viewer, array $row): bool
    {
        return Permissions::canSeeMoney($viewer);
    }

    public static function present(App $app, Db $db, Refs $refs, array $row, ?array $viewer): array
    {
        $t = $db->one(
            "SELECT COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_paise END), 0) AS spent, COALESCE(SUM(CASE WHEN status = 'due' THEN amount_paise END), 0) AS due
             FROM payments WHERE category_id = ? AND deleted_at IS NULL",
            [$row['id']],
        ) ?? ['spent' => 0, 'due' => 0];
        return self::view($row, (int) $t['spent'], (int) $t['due']);
    }

    /** API shape BudgetCategory (DATABASE §7.5). */
    public static function view(array $row, int $spent, int $due): array
    {
        $planned = (int) $row['planned_paise'];
        return [
            'id' => $row['public_id'],
            'version' => (int) $row['version'],
            'name' => $row['name'],
            'planned_paise' => $planned,
            'spent_paise' => $spent,
            'due_paise' => $due,
            'left_paise' => $planned - $spent,
            'is_over' => $planned > 0 && $spent + $due > $planned,
            'is_fallback' => (bool) $row['is_fallback'],
            'sort_order' => (int) $row['sort_order'],
            'deleted' => $row['deleted_at'] !== null,
        ];
    }

    public static function input(App $app, Fields $f, bool $create, ?array $current): array
    {
        $f->only(['name', 'planned_paise', 'sort_order']);
        $out = [];
        if ($create || $f->has('name')) {
            $out['name'] = $f->text('name', 60, true);
            if ($out['name'] !== null && $app->db()->value('SELECT 1 FROM budget_categories WHERE live_name = ? AND id <> ?', [$out['name'], $current['id'] ?? 0])) {
                throw new HttpError(409, 'duplicate_found', Strings::get('category_name_taken', ['name' => $out['name']]), ['matches' => []]);
            }
        }
        if ($f->has('planned_paise')) {
            $out['planned_paise'] = $f->paise('planned_paise', 1000000000000) ?? 0;
        }
        if ($f->has('sort_order')) {
            $v = $f->value('sort_order');
            if (!is_int($v) || $v < -32000 || $v > 32000) {
                $f->error('sort_order', Strings::get('field_bad_choice'));
            } else {
                $out['sort_order'] = $v;
            }
        }
        return $out;
    }

    public static function onCreate(App $app, array $viewer): array
    {
        return ['sort_order' => (int) $app->db()->value('SELECT COALESCE(MAX(sort_order), 0) + 10 FROM budget_categories')];
    }

    /** A category whose name is now used by another live one stays deleted (DS-16). */
    public static function restoreCheck(Db $db, array $row): ?array
    {
        return $db->value('SELECT 1 FROM budget_categories WHERE live_name = ?', [$row['name']])
            ? ['blocked' => Strings::get('category_name_taken', ['name' => $row['name']])] : null;
    }

    public static function formatValue(string $field, mixed $value): string
    {
        return $field === 'planned_paise' ? History::rupees($value === null ? null : (int) $value) : History::formatValue($value);
    }
}
