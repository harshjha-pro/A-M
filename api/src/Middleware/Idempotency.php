<?php
declare(strict_types=1);

namespace AM\Middleware;

use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Kernel\Uuid;

/**
 * STUB until Session 3 (API.md §5.3: claim the key, replay a stored reply,
 * 409 request_in_progress, 422 idempotency_key_reused).
 * Already enforced: a logged-in write must carry a UUID Idempotency-Key (428).
 * Then it refuses the write, because replies can't be stored yet.
 */
final class Idempotency implements Middleware
{
    public function process(Request $request, App $app, callable $next): Response
    {
        $route = $request->attr('route');
        if ($request->isWrite() && $request->attr('user') !== null && $route->option('idempotent', true)) {
            $key = $request->header('idempotency-key');
            if ($key === '' || !Uuid::isValid($key)) {
                throw HttpError::make(428, 'idempotency_key_required');
            }
            throw HttpError::make(503, 'not_available_yet');
        }
        return $next($request);
    }
}
