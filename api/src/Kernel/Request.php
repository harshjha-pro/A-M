<?php
declare(strict_types=1);

namespace AM\Kernel;

/**
 * One incoming request. Built from PHP globals on the server, or by hand in
 * tests (in-process requests, TESTING §1.2).
 */
final class Request
{
    /** Per-request values set by middleware: request_id, route, user, json… */
    public array $attributes = [];

    /**
     * @param array<string,string> $query
     * @param array<string,string> $headers lower-case names
     * @param array<string,string> $cookies
     */
    public function __construct(
        public readonly string $method,
        public readonly string $path,
        public readonly array $query = [],
        private readonly array $headers = [],
        public readonly string $body = '',
        public readonly string $ip = '127.0.0.1',
        public readonly array $cookies = [],
    ) {}

    public static function fromGlobals(): self
    {
        $headers = [];
        foreach ($_SERVER as $key => $value) {
            if (str_starts_with($key, 'HTTP_')) {
                $headers[strtolower(str_replace('_', '-', substr($key, 5)))] = (string) $value;
            }
        }
        if (isset($_SERVER['CONTENT_TYPE'])) {
            $headers['content-type'] = (string) $_SERVER['CONTENT_TYPE'];
        }
        if (isset($_SERVER['CONTENT_LENGTH'])) {
            $headers['content-length'] = (string) $_SERVER['CONTENT_LENGTH'];
        }
        $uri = (string) ($_SERVER['REQUEST_URI'] ?? '/');
        $path = (string) (parse_url($uri, PHP_URL_PATH) ?? '/');
        $query = [];
        foreach ($_GET as $k => $v) {
            // Arrays (?a[]=1) are not part of our API; keep them so the router can refuse them.
            $query[(string) $k] = is_string($v) ? $v : '';
        }
        // Read at most 16 MB + 1 byte, so a huge body can be refused without filling memory.
        $body = (string) file_get_contents('php://input', false, null, 0, 16 * 1024 * 1024 + 1);

        return new self(
            strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')),
            $path,
            $query,
            $headers,
            $body,
            (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'),
            array_map('strval', $_COOKIE),
        );
    }

    public function header(string $name, string $default = ''): string
    {
        return $this->headers[strtolower($name)] ?? $default;
    }

    public function hasHeader(string $name): bool
    {
        return isset($this->headers[strtolower($name)]);
    }

    public function isWrite(): bool
    {
        return in_array($this->method, ['POST', 'PUT', 'PATCH', 'DELETE'], true);
    }

    public function contentType(): string
    {
        return strtolower(trim(explode(';', $this->header('content-type'))[0]));
    }

    public function attr(string $key, mixed $default = null): mixed
    {
        return $this->attributes[$key] ?? $default;
    }
}
