<?php
declare(strict_types=1);

namespace AM\Middleware;

use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Request;
use AM\Kernel\Response;

/** Every route needs a logged-in user unless it is marked anonymous (TESTING S1). */
final class AuthRequired implements Middleware
{
    public function process(Request $request, App $app, callable $next): Response
    {
        $route = $request->attr('route');
        if (!$route->option('anon', false) && $request->attr('user') === null) {
            throw HttpError::make(401, 'not_logged_in');
        }
        return $next($request);
    }
}
