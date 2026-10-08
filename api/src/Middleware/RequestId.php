<?php
declare(strict_types=1);

namespace AM\Middleware;

use AM\Kernel\App;
use AM\Kernel\Request;
use AM\Kernel\Response;

/** Gives every request an id: X-Request-Id header and meta.request_id. Quote it when reporting a problem. */
final class RequestId implements Middleware
{
    public function process(Request $request, App $app, callable $next): Response
    {
        $id = 'r_' . bin2hex(random_bytes(5));
        $request->attributes['request_id'] = $id;
        $response = $next($request);
        $response->headers['X-Request-Id'] = $id;
        return $response;
    }
}
