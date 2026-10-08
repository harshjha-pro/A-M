<?php
declare(strict_types=1);

namespace AM\Kernel;

use Closure;

/** One API operation, e.g. "GET /health". Options say which guards apply. */
final class Route
{
    /** @var list<string> names of {params} in the pattern */
    public readonly array $paramNames;
    private readonly string $regex;

    /**
     * @param Closure(Request, App, array<string,string>): Response $handler
     * @param array{
     *   anon?: bool,               // reachable without a session
     *   query?: list<string>,      // allowed query parameters (anything else -> 400)
     *   max_body?: int,            // bytes; default 1 MB (API §10.3)
     *   maintenance_exempt?: bool, // still works while the schema is being updated
     *   client_version_exempt?: bool,
     *   idempotent?: bool,         // logged-in writes need Idempotency-Key (default true)
     * } $options
     */
    public function __construct(
        public readonly string $method,
        public readonly string $pattern,
        public readonly Closure $handler,
        public readonly array $options = [],
    ) {
        preg_match_all('/\{([a-z_]+)\}/', $pattern, $m);
        $this->paramNames = $m[1];
        $this->regex = '#^' . preg_replace('/\\\\\{[a-z_]+\\\\\}/', '([^/]+)', preg_quote($pattern, '#')) . '$#';
    }

    /** "GET /health" — the same name the OpenAPI file and test attributes use. */
    public function name(): string
    {
        return $this->method . ' ' . $this->pattern;
    }

    /** @return array<string,string>|null */
    public function match(string $path): ?array
    {
        if (!preg_match($this->regex, $path, $m)) {
            return null;
        }
        array_shift($m);
        return array_combine($this->paramNames, array_map('rawurldecode', $m)) ?: [];
    }

    public function option(string $key, mixed $default = null): mixed
    {
        return $this->options[$key] ?? $default;
    }
}
