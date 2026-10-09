<?php
declare(strict_types=1);

namespace AM\Safety;

use AM\Db\Db;
use AM\Kernel\App;
use AM\Kernel\Request;
use AM\Kernel\Ulid;

/**
 * Groups a delete, bulk change, import, restore or undo so it reverses as one
 * (DATABASE §3 "change_batches"). Trash rows, Undo and "Undo this import" all
 * work on a batch.
 */
final class ChangeBatches
{
    /** @return array{id:int, public_id:string} */
    public static function create(App $app, Db $db, Request $request, string $action, string $entityType, string $summary): array
    {
        $publicId = Ulid::generate($app->clock);
        $db->run(
            'INSERT INTO change_batches (public_id, action, entity_type, item_count, summary, user_id, created_at) VALUES (?, ?, ?, 0, ?, ?, ?)',
            [$publicId, $action, $entityType, mb_substr($summary, 0, 200), $request->attr('user')['id'] ?? null, $app->clock->dbNow()],
        );
        return ['id' => (int) $db->pdo->lastInsertId(), 'public_id' => $publicId];
    }

    public static function setCount(Db $db, int $batchId, int $count): void
    {
        $db->run('UPDATE change_batches SET item_count = ? WHERE id = ?', [$count, $batchId]);
    }

    public static function byPublicId(Db $db, string $publicId, bool $forUpdate = false): ?array
    {
        if (!preg_match('/^[0-9A-HJKMNP-TV-Z]{26}$/', $publicId)) {
            return null;
        }
        return $db->one('SELECT * FROM change_batches WHERE public_id = ?' . ($forUpdate ? ' FOR UPDATE' : ''), [$publicId]);
    }
}
