<?php
declare(strict_types=1);

namespace AM\Modules\Safety;

use AM\Auth\Permissions;
use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Kernel\Time;

/** GET /backups — the last nightly backup runs for the Safety card (FEATURES B10). Admins. */
final class SafetyController
{
    public static function backups(Request $request, App $app, array $params): Response
    {
        Permissions::requireAdmin($request->attr('user'));
        $limit = $request->query['limit'] ?? '7';
        if (!ctype_digit($limit) || (int) $limit < 1 || (int) $limit > 60) {
            throw HttpError::make(400, 'bad_request');
        }
        $rows = $app->db()->all('SELECT * FROM backup_runs ORDER BY id DESC LIMIT ' . (int) $limit);
        return Response::ok(array_map(static fn (array $b) => [
            'kind' => $b['kind'],
            'status' => $b['status'],
            'started_at' => Time::iso($b['started_at']),
            'finished_at' => Time::iso($b['finished_at']),
            'file_name' => $b['file_name'],
            'size_bytes' => $b['size_bytes'] === null ? null : (int) $b['size_bytes'],
            'destination' => $b['destination'],
            'audit_row_count' => $b['audit_row_count'] === null ? null : (int) $b['audit_row_count'],
            'audit_max_id' => $b['audit_max_id'] === null ? null : (int) $b['audit_max_id'],
            'error' => $b['status'] === 'failed' ? $b['error'] : null,
        ], $rows));
    }
}
