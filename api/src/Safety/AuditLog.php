<?php
declare(strict_types=1);

namespace AM\Safety;

use AM\Auth\Sessions;
use AM\Db\Db;
use AM\Kernel\App;
use AM\Kernel\Request;

/**
 * Every change: who, when, full row before and after (DATABASE §3, DB4).
 * Append-only: this class has no update or delete method, on purpose (DS-20).
 * Written inside the same transaction as the change (UnitOfWork).
 */
final class AuditLog
{
    /** Never written into the log. */
    private const SECRET_KEYS = ['password_hash', 'token_hash', 'csrf_hash', 'download_token_hash', 'owner_slot', 'active_phone', 'live_name', 'fallback_slot'];

    /**
     * @param array{
     *   action:string, entity_type:string, entity_id?:?int, entity_version?:?int,
     *   before?:?array, after?:?array, batch_id?:?int, note?:?string, user_id?:?int
     * } $e
     */
    public static function record(App $app, Db $db, ?Request $request, array $e): int
    {
        $user = $request?->attr('user');
        $db->run(
            'INSERT INTO audit_log (created_at, user_id, action, entity_type, entity_id, entity_version, batch_id, before_json, after_json, ip, device, note)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $app->clock->dbNow(),
                array_key_exists('user_id', $e) ? $e['user_id'] : ($user['id'] ?? null),
                $e['action'],
                $e['entity_type'],
                $e['entity_id'] ?? null,
                $e['entity_version'] ?? null,
                $e['batch_id'] ?? null,
                self::json($e['before'] ?? null),
                self::json($e['after'] ?? null),
                $request ? substr($request->ip, 0, 45) : null,
                $request ? Sessions::deviceLabel($request) : null,
                isset($e['note']) ? mb_substr((string) $e['note'], 0, 200) : null,
            ],
        );
        return (int) $db->pdo->lastInsertId();
    }

    private static function json(?array $row): ?string
    {
        if ($row === null) {
            return null;
        }
        foreach (self::SECRET_KEYS as $k) {
            unset($row[$k]);
        }
        return json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }
}
