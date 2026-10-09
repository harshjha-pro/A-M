<?php
declare(strict_types=1);

namespace AM\Modules\Documents;

use AM\Db\Db;
use AM\Kernel\App;
use AM\Repo\EntityDef;
use AM\Repo\Refs;

/**
 * A document (FEATURES B7). Its screens and uploads arrive in Session 10; it is
 * declared now so a payment's receipts are deleted and restored with it (B6).
 */
final class DocumentDef extends EntityDef
{
    public const TABLE = 'documents';
    public const TYPE = 'document';
    public const RESOURCE = 'documents';
    public const LABEL = 'document';
    public const LABEL_PLURAL = 'documents';
    public const FIELD_LABELS = ['title' => 'Title', 'type' => 'Type', 'is_private' => 'Private', 'notes' => 'Notes'];

    public static function name(array $row): string
    {
        return (string) ($row['title'] ?? 'a document');
    }

    public static function present(App $app, Db $db, Refs $refs, array $row, ?array $viewer): array
    {
        return ['id' => $row['public_id'], 'version' => (int) $row['version'], 'title' => $row['title'], 'type' => $row['type']];
    }
}
