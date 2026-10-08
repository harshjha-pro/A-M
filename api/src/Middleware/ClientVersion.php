<?php
declare(strict_types=1);

namespace AM\Middleware;

use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Request;
use AM\Kernel\Response;

/**
 * SecurityHeaders puts X-Min-Client-Version on every reply. A write from an older app gets 426 update_required, so a stale phone never
 * saves with old rules (API.md §1.3).
 */
final class ClientVersion implements Middleware
{
    public function process(Request $request, App $app, callable $next): Response
    {
        $min = $app->env->get('MIN_CLIENT_VERSION', '1.0.0');
        $sent = $request->header('x-client-version');
        $route = $request->attr('route');

        if ($request->isWrite() && !$route->option('client_version_exempt', false)
            && $sent !== '' && preg_match('/^\d+(\.\d+){0,3}$/', $sent) && version_compare($sent, $min, '<')) {
            $e = HttpError::make(426, 'update_required', [], [], ['X-Min-Client-Version' => $min]);
            throw $e;
        }
        return $next($request);
    }
}
