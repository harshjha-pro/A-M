<?php
declare(strict_types=1);

namespace AM\Middleware;

use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Request;
use AM\Kernel\Response;

/**
 * Size caps (1 MB by default; a route may set its own) and JSON parsing.
 * Bad JSON is a 400, never a 500. Which content types a write may use is
 * checked by Csrf (logged in) or by the route itself (anonymous).
 */
final class JsonBody implements Middleware
{
    public const DEFAULT_MAX = 1024 * 1024;

    public function process(Request $request, App $app, callable $next): Response
    {
        $route = $request->attr('route');
        $max = (int) $route->option('max_body', self::DEFAULT_MAX);
        $declared = $request->header('content-length');
        if (strlen($request->body) > $max || ($declared !== '' && ctype_digit($declared) && (int) $declared > $max)) {
            throw HttpError::make(413, 'body_too_big');
        }

        if ($request->body !== '' && $request->contentType() === 'application/json') {
            try {
                $request->attributes['json'] = json_decode($request->body, true, 32, JSON_THROW_ON_ERROR | JSON_BIGINT_AS_STRING);
            } catch (\JsonException) {
                throw HttpError::make(400, 'bad_request');
            }
        }
        if ($request->contentType() === 'multipart/form-data') {
            $request->parseMultipart(); // in tests; on the server PHP already filled form/files
        }
        return $next($request);
    }
}
