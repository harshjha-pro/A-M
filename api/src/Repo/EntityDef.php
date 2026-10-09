<?php
declare(strict_types=1);

namespace AM\Repo;

use AM\Db\Db;
use AM\Kernel\App;
use AM\Safety\History;
use AM\Validation\Fields;

/**
 * What an editable record IS (IMPLEMENTATION §2.4). The shared base code
 * (BaseRepository, BaseController, History, Trash, Undo) does the HOW:
 * versions, audit, soft delete in batches, restore, history sentences.
 * A new module is mostly one of these.
 */
abstract class EntityDef
{
    /** Table name (from code, never from a request). */
    public const TABLE = '';
    /** audit_log.entity_type, e.g. 'restore_drill'. */
    public const TYPE = '';
    /** URL segment, e.g. 'restore-drills'. */
    public const RESOURCE = '';
    /** Plain words: 'restore drill' / 'restore drills'. */
    public const LABEL = '';
    public const LABEL_PLURAL = '';
    /** Has public_id / client_uuid / deleted_* columns. */
    public const PUBLIC_ID = true;
    public const SOFT_DELETE = true;
    /** Field labels for History sentences; only these fields are ever described. */
    public const FIELD_LABELS = [];
    /** Fields a non-money user never sees (API.md §1.5). */
    public const MONEY_FIELDS = [];
    /** Child defs deleted and restored in the same batch: [ChildDef::class => 'parent_fk_column']. */
    public const CHILDREN = [];
    /** [ParentDef::class, 'fk_column'] — restoring this child brings a deleted parent back (FEATURES B9). */
    public const PARENT = null;

    /** Short name shown in Trash, History and Undo messages. */
    abstract public static function name(array $row): string;

    /** The record as this viewer may see it. */
    abstract public static function present(App $app, Db $db, Refs $refs, array $row, ?array $viewer): array;

    /** Can this viewer see the record (and its history)? */
    public static function canView(?array $viewer, array $row): bool
    {
        return $viewer !== null;
    }

    /** Fields of the history this viewer may see (null = all labelled fields). */
    public static function visibleFields(?array $viewer): ?array
    {
        return null;
    }

    /** Read + validate a create (all fields) or a PATCH (only sent fields). @return array<string,mixed> column => value */
    public static function input(App $app, Fields $f, bool $create, ?array $current): array
    {
        return [];
    }

    /** Extra columns set on create (e.g. done_by). */
    public static function onCreate(App $app, array $viewer): array
    {
        return [];
    }

    /** Before restoring a row: ['blocked' => reason] stops it; ['warning' => text] restores and warns. */
    public static function restoreCheck(Db $db, array $row): ?array
    {
        return null;
    }

    /** History value formatting for one field (dates, money, choices). */
    public static function formatValue(string $field, mixed $value): string
    {
        return History::formatValue($value);
    }
}
