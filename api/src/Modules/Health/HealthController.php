<?php
declare(strict_types=1);

namespace AM\Modules\Health;

use AM\Kernel\App;
use AM\Kernel\RateLimiter;
use AM\Kernel\Request;
use AM\Kernel\Response;

/**
 * GET /api/v1/health
 * Anonymous (the free uptime monitor): only {"status":"ok"} or 503 {"status":"fail"}.
 * The admin detail view arrives with sessions (Session 3).
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
        return Response::bareJson(['status' => $result['public']], $result['public'] === 'ok' ? 200 : 503);
    }
}
