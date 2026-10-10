<?php
declare(strict_types=1);

namespace AM\Modules\Settings;

use AM\Db\Db;
use AM\Kernel\App;
use AM\Repo\EntityDef;
use AM\Repo\Refs;
use AM\Safety\History;

/** Wedding facts, one row, never deleted — for History and Activity. */
final class SettingsDef extends EntityDef
{
    public const TABLE = 'settings';
    public const TYPE = 'settings';
    public const RESOURCE = 'settings';
    public const LABEL = 'the wedding details';
    public const LABEL_PLURAL = 'wedding details';
    public const PUBLIC_ID = false;
    public const SOFT_DELETE = false;
    public const FIELD_LABELS = SettingsController::LABELS;
    public const MONEY_FIELDS = ['total_budget_paise'];

    public static function name(array $row): string
    {
        return 'the wedding details';
    }

    public static function present(App $app, Db $db, Refs $refs, array $row, ?array $viewer): array
    {
        return SettingsController::present($db, $refs, $row, $viewer);
    }

    public static function formatValue(string $field, mixed $value): string
    {
        if ($field === 'total_budget_paise') {
            return $value === null ? '(empty)' : History::rupees((int) $value);
        }
        return History::formatValue($value);
    }
}
