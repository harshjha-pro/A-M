<?php
declare(strict_types=1);

namespace AM\Middleware;

use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Request;
use AM\Kernel\Response;

/** Only GET, POST, PUT, PATCH, DELETE reach the API (SEC-31). HEAD is answered like GET with no body, for uptime monitors. */
final class MethodGuard implements Middleware
{
    private const ALLOWED = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'];

    public function process(Request $request, App $app, callable $next): Response
    {
        if (!in_array($request->method, self::ALLOWED, true)) {
            throw HttpError::make(405, 'method_not_allowed');
        }
        return $next($request);
    }
}
