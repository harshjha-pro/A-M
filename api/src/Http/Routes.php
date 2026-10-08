<?php
declare(strict_types=1);

namespace AM\Http;

use AM\Kernel\Router;
use AM\Modules\ClientLog\ClientLogController;
use AM\Modules\Health\HealthController;

/**
 * Every API operation. Each one must also be in docs/openapi.yaml and have at
 * least one test (EndpointCoverageTest).
 */
final class Routes
{
    public static function build(): Router
    {
        $r = new Router();

        $r->add('GET', '/health', HealthController::show(...), [
            'anon' => true,
        ]);

        $r->add('POST', '/client-log', ClientLogController::store(...), [
            'anon' => true,
            'idempotent' => false,          // a duplicate log line is harmless (TESTING §9.3)
            'max_body' => 16 * 1024,
            'maintenance_exempt' => true,   // never touches app tables
            'client_version_exempt' => true, // an old app's crash reports are the most useful ones
        ]);

        return $r;
    }
}
