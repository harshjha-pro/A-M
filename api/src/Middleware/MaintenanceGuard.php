<?php
declare(strict_types=1);

namespace AM\Middleware;

use AM\Db\SchemaInfo;
use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Request;
use AM\Kernel\Response;
use Throwable;

/**
 * DATABASE.md rule 14: if the database is older than this code expects (or a
 * migration stopped part-way), writes get 503 app_updating. Reads still work.
 */
final class MaintenanceGuard implements Middleware
{
    public function process(Request $request, App $app, callable $next): Response
    {
        $route = $request->attr('route');
        if (!$request->isWrite() || $route->option('maintenance_exempt', false)) {
            return $next($request);
        }
        try {
            $schema = SchemaInfo::read($app->db());
        } catch (Throwable $e) {
            $app->logger->exception((string) $request->attr('request_id'), $e, ['endpoint' => $route->name()]);
            throw HttpError::make(503, 'service_unavailable', [], [], ['Retry-After' => '60']);
        }
        if (!$schema['ok']) {
            throw HttpError::make(503, 'app_updating', [], [], ['Retry-After' => '120']);
        }
        return $next($request);
    }
}
