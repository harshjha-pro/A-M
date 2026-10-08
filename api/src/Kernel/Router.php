<?php
declare(strict_types=1);

namespace AM\Kernel;

use Closure;

/** Maps "/api/v1/<resource>/…" to a Route. Unknown path 404, wrong method 405. */
final class Router
{
    public const PREFIX = '/api/v1';

    /** @var list<Route> */
    private array $routes = [];

    public function add(string $method, string $pattern, Closure $handler, array $options = []): Route
    {
        $route = new Route(strtoupper($method), $pattern, $handler, $options);
        $this->routes[] = $route;
        return $route;
    }

    /** @return list<Route> */
    public function routes(): array
    {
        return $this->routes;
    }

    /**
     * @return array{0: Route, 1: array<string,string>}
     * @throws HttpError
     */
    public function match(string $method, string $fullPath): array
    {
        if ($fullPath !== self::PREFIX && !str_starts_with($fullPath, self::PREFIX . '/')) {
            throw HttpError::make(404, 'not_found');
        }
        $path = substr($fullPath, strlen(self::PREFIX));
        if ($path === '' || $path === false) {
            $path = '/';
        }
        $lookup = $method === 'HEAD' ? 'GET' : $method;
        $pathExists = false;
        foreach ($this->routes as $route) {
            $params = $route->match($path);
            if ($params === null) {
                continue;
            }
            $pathExists = true;
            if ($route->method === $lookup) {
                return [$route, $params];
            }
        }
        if ($pathExists) {
            throw HttpError::make(405, 'method_not_allowed');
        }
        throw HttpError::make(404, 'not_found');
    }
}
