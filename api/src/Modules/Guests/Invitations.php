<?php
declare(strict_types=1);

namespace AM\Modules\Guests;

use AM\Db\Db;
use AM\Kernel\App;
use AM\Kernel\Request;
use AM\Safety\AuditLog;

/** Create or revive one invitation (household_events). The pair is unique, deleted rows included (DATABASE). */
final class Invitations
{
    /**
     * @param array $expected ['expected_adults' => ?int, 'expected_children' => ?int] (only keys sent)
     * @return array{row: array, status: 'created'|'revived'|'unchanged'}
     */
    public static function invite(App $app, Db $db, Request $request, array $family, array $event, array $expected, int $batchId, bool $useKey): array
    {
        $user = $request->attr('user');
        $now = $app->clock->dbNow();
        $old = $db->one('SELECT * FROM household_events WHERE household_id = ? AND event_id = ? FOR UPDATE', [$family['id'], $event['id']]);
        if ($old !== null && $old['deleted_at'] === null) {
            return ['row' => $old, 'status' => 'unchanged']; // already invited: RSVP never touched (AC-GST-05)
        }
        if ($old !== null) {
            // Revive the removed invitation, keeping its old RSVP and note.
            $db->run(
                'UPDATE household_events SET deleted_at = NULL, deleted_by = NULL, delete_batch_id = NULL,
                   expected_adults = ?, expected_children = ?, version = version + 1, updated_at = ?, updated_by = ? WHERE id = ?',
                [
                    array_key_exists('expected_adults', $expected) ? $expected['expected_adults'] : $old['expected_adults'],
                    array_key_exists('expected_children', $expected) ? $expected['expected_children'] : $old['expected_children'],
                    $now, $user['id'] ?? null, $old['id'],
                ],
            );
            $row = $db->one('SELECT * FROM household_events WHERE id = ?', [$old['id']]);
            AuditLog::record($app, $db, $request, [
                'action' => 'restore', 'entity_type' => 'invitation', 'entity_id' => (int) $row['id'],
                'entity_version' => (int) $row['version'], 'batch_id' => $batchId, 'before' => $old, 'after' => $row,
            ]);
            return ['row' => $row, 'status' => 'revived'];
        }
        $key = $useKey ? (string) $request->attr('idem_key') : '';
        $db->run(
            'INSERT INTO household_events (client_uuid, household_id, event_id, rsvp, expected_adults, expected_children, version, created_at, created_by, updated_at, updated_by)
             VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)',
            [$key !== '' ? $key : null, $family['id'], $event['id'], 'not_asked', $expected['expected_adults'] ?? null, $expected['expected_children'] ?? null,
                $now, $user['id'] ?? null, $now, $user['id'] ?? null],
        );
        $row = $db->one('SELECT * FROM household_events WHERE id = ?', [(int) $db->pdo->lastInsertId()]);
        AuditLog::record($app, $db, $request, [
            'action' => 'create', 'entity_type' => 'invitation', 'entity_id' => (int) $row['id'],
            'entity_version' => 1, 'batch_id' => $batchId, 'after' => $row,
        ]);
        return ['row' => $row, 'status' => 'created'];
    }
}
