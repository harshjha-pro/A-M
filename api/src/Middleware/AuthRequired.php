<?php
declare(strict_types=1);

namespace AM\Middleware;

use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Request;
use AM\Kernel\Response;

/**
 * Every route needs a logged-in user unless it is marked anonymous (TESTING S1).
 * 401 not_logged_in, or 401 session_ended with the reason (API.md §2.3).
 */
final class AuthRequired implements Middleware
{
    public function process(Request $request, App $app, callable $next): Response
    {
        $route = $request->attr('route');
        if (!$route->option('anon', false) && $request->attr('user') === null) {
            $err = $request->attr('auth_error', ['code' => 'not_logged_in']);
            if ($err['code'] === 'session_ended') {
                throw HttpError::make(401, 'session_ended', [], ['reason' => $err['reason']]);
            }
            throw HttpError::make(401, 'not_logged_in');
        }
        return $next($request);
    }
}
