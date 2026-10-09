<?php
declare(strict_types=1);

namespace AM\Modules\Health;

use AM\Auth\Permissions;
use AM\Kernel\App;
use AM\Kernel\AppInfo;
use AM\Kernel\RateLimiter;
use AM\Kernel\Request;
use AM\Kernel\Response;

/**
 * GET /api/v1/health
 * Anonymous (the free uptime monitor): only {"status":"ok"} or 503 {"status":"fail"}.
 * Logged-in admin: the full envelope with every check (API.md §11).
 */
final class HealthController
{
    public static function show(Request $request, App $app, array $params): Response
    {
        (new RateLimiter($app))->hit('health:ip:' . RateLimiter::clientIp($request, $app), 30, 60);
        $result = (new HealthService($app))->run();
        if ($result['public'] === 'fail') {
            $app->logger->error((string) $request->attr('request_id'), 'Health check failed', [
                'checks' => array_map(static fn (array $c) => $c['status'], $result['checks']),
            ]);
        }
        if (Permissions::isAdmin($request->attr('user'))) {
            $extras = (new HealthService($app))->extras();
            $checks = $result['checks'] + ['last_export' => $extras['last_export']];
            return Response::ok([
                'status' => $result['status'],
                'checked_at' => $app->clock->isoNow(),
                'app_version' => AppInfo::version(),
                'php_version' => PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION,
                'checks' => $checks,
                'trash_batches' => $extras['trash_batches'],
                'server_time' => $app->clock->isoNow(),
            ], $result['public'] === 'ok' ? 200 : 503);
        }
        return Response::bareJson(['status' => $result['public']], $result['public'] === 'ok' ? 200 : 503);
    }
}
