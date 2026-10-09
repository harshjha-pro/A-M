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

    /** multipart/form-data text fields (from $_POST, or parsed from the body in tests). */
    public array $form = [];

    /**
     * Uploaded files: name => {name, tmp_name, size, error, php_upload}.
     * php_upload = true for real PHP uploads (move_uploaded_file), false for test temp files.
     * @var array<string, array{name:string, tmp_name:string, size:int, error:int, php_upload:bool}>
     */
    public array $files = [];

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

        $req = new self(
            strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')),
            $path,
            $query,
            $headers,
            $body,
            (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'),
            array_map('strval', $_COOKIE),
        );
        // multipart/form-data: PHP has already parsed it (php://input is empty for multipart).
        foreach ($_POST as $k => $v) {
            if (is_string($v)) {
                $req->form[(string) $k] = $v;
            }
        }
        foreach ($_FILES as $k => $f) {
            if (is_array($f) && is_string($f['tmp_name'] ?? null)) {
                $req->files[(string) $k] = ['name' => (string) $f['name'], 'tmp_name' => $f['tmp_name'], 'size' => (int) $f['size'],
                    'error' => (int) $f['error'], 'php_upload' => true];
            }
        }
        return $req;
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

    /**
     * Tests send multipart bodies in-process: split them the way PHP would.
     * File parts go to temp files (php_upload = false). Called by JsonBody.
     */
    public function parseMultipart(): void
    {
        if ($this->body === '' || $this->files !== [] || $this->form !== []) {
            return;
        }
        if (!preg_match('/boundary="?([^";]+)"?/i', $this->header('content-type'), $m)) {
            return;
        }
        foreach (explode('--' . $m[1], $this->body) as $part) {
            $part = ltrim($part, "\r\n");
            if ($part === '' || str_starts_with($part, '--')) {
                continue;
            }
            [$head, $content] = array_pad(explode("\r\n\r\n", $part, 2), 2, '');
            $content = (string) preg_replace('/\r\n$/', '', $content);
            if (!preg_match('/name="([^"]*)"/i', $head, $n)) {
                continue;
            }
            if (preg_match('/filename="([^"]*)"/i', $head, $fn)) {
                $tmp = (string) tempnam(sys_get_temp_dir(), 'am-up-');
                file_put_contents($tmp, $content);
                $this->files[$n[1]] = ['name' => $fn[1], 'tmp_name' => $tmp, 'size' => strlen($content), 'error' => 0, 'php_upload' => false];
            } else {
                $this->form[$n[1]] = $content;
            }
        }
    }

    public function attr(string $key, mixed $default = null): mixed
    {
        return $this->attributes[$key] ?? $default;
    }
}
