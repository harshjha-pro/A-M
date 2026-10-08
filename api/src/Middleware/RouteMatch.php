<?php
declare(strict_types=1);

namespace AM\Middleware;

use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Request;
use AM\Kernel\Response;

/**
 * Finds the route. Unknown path → 404, known path with another method → 405,
 * unknown query parameter → 400 (API.md §1.4: catches typos that would show the wrong list).
 */
final class RouteMatch implements Middleware
{
    public function process(Request $request, App $app, callable $next): Response
    {
        [$route, $params] = $app->router->match($request->method, $request->path);
        $request->attributes['route'] = $route;
        $request->attributes['params'] = $params;

        $allowed = $route->option('query', []);
        foreach (array_keys($request->query) as $name) {
            if (!in_array($name, $allowed, true)) {
                throw HttpError::make(400, 'bad_request');
            }
        }
        return $next($request);
    }
}
