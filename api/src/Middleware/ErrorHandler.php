<?php
declare(strict_types=1);

namespace AM\Middleware;

use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Kernel\Strings;
use Throwable;

/**
 * Any exception becomes the JSON error envelope. A planned HttpError keeps its
 * code and message. Anything else is logged with the request id and answered
 * with a plain 500: never a path, SQL, stack trace or PHP version (SEC-29).
 */
final class ErrorHandler implements Middleware
{
    public function process(Request $request, App $app, callable $next): Response
    {
        try {
            return $next($request);
        } catch (HttpError $e) {
            return Response::fromHttpError($e);
        } catch (Throwable $e) {
            $route = $request->attr('route');
            $app->logger->exception((string) $request->attr('request_id', '-'), $e, [
                'endpoint' => $route ? $route->name() : $request->method . ' ' . $request->path,
                'user_id' => $request->attr('user')['id'] ?? null,
            ]);
            return Response::error(500, 'server_error', Strings::get('server_error'));
        }
    }
}
