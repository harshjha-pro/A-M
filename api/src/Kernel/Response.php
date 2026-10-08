<?php
declare(strict_types=1);

namespace AM\Kernel;

use stdClass;

/**
 * One reply. JSON replies keep their payload as an array until the very end,
 * so the App can add meta.request_id and meta.server_time to every envelope.
 */
final class Response
{
    /** @var array<string,string> */
    public array $headers = [];

    /** Envelope payload ({ok, data|error, meta}); null for raw bodies. */
    public ?array $payload = null;

    /** Raw body (a bare JSON object like anonymous /health, a file, a CSV). */
    public string $body = '';

    public function __construct(public int $status = 200) {}

    /** {ok:true, data, meta} */
    public static function ok(mixed $data, int $status = 200, array $meta = []): self
    {
        $r = new self($status);
        $r->payload = ['ok' => true, 'data' => $data ?? new stdClass(), 'meta' => $meta];
        $r->headers['Content-Type'] = 'application/json; charset=utf-8';
        return $r;
    }

    /** {ok:false, error:{code, message, ...extra}, meta} */
    public static function error(int $status, string $code, string $message, array $extra = []): self
    {
        $r = new self($status);
        $r->payload = ['ok' => false, 'error' => ['code' => $code, 'message' => $message] + $extra, 'meta' => []];
        $r->headers['Content-Type'] = 'application/json; charset=utf-8';
        return $r;
    }

    public static function fromHttpError(HttpError $e): self
    {
        $r = self::error($e->status, $e->errorCode, $e->getMessage(), $e->extra);
        foreach ($e->headers as $k => $v) {
            $r->headers[$k] = $v;
        }
        return $r;
    }

    /** A JSON body without the envelope (only anonymous /health uses this: API.md HealthPublic). */
    public static function bareJson(array $data, int $status = 200): self
    {
        $r = new self($status);
        $r->body = self::encode($data);
        $r->headers['Content-Type'] = 'application/json; charset=utf-8';
        return $r;
    }

    public function withHeader(string $name, string $value): self
    {
        $this->headers[$name] = $value;
        return $this;
    }

    public function header(string $name): ?string
    {
        foreach ($this->headers as $k => $v) {
            if (strcasecmp($k, $name) === 0) {
                return $v;
            }
        }
        return null;
    }

    /** Fills meta and turns the payload into the body. Called once by App. */
    public function finalize(string $requestId, string $serverTime): void
    {
        if ($this->payload !== null) {
            $this->payload['meta'] = ['request_id' => $requestId, 'server_time' => $serverTime] + ($this->payload['meta'] ?? []);
            $this->body = self::encode($this->payload);
        }
    }

    /** The decoded body, for tests. */
    public function json(): mixed
    {
        return json_decode($this->body, true);
    }

    public static function encode(mixed $data): string
    {
        return json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION);
    }

    public function send(): void
    {
        if (!headers_sent()) {
            header_remove('X-Powered-By');
            http_response_code($this->status);
            foreach ($this->headers as $k => $v) {
                header($k . ': ' . $v);
            }
        }
        echo $this->body;
    }
}
