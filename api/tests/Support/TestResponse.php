<?php
declare(strict_types=1);

namespace Tests\Support;

use AM\Kernel\Response;
use PHPUnit\Framework\Assert;

/** A reply with handy assertions. */
final class TestResponse
{
    public function __construct(public readonly Response $raw) {}

    public function status(): int
    {
        return $this->raw->status;
    }

    public function header(string $name): ?string
    {
        return $this->raw->header($name);
    }

    public function body(): string
    {
        return $this->raw->body;
    }

    /** json('error.code') → value at that dotted path */
    public function json(?string $path = null): mixed
    {
        $data = json_decode($this->raw->body, true);
        if ($path === null) {
            return $data;
        }
        foreach (explode('.', $path) as $key) {
            if (!is_array($data) || !array_key_exists($key, $data)) {
                return null;
            }
            $data = $data[$key];
        }
        return $data;
    }

    public function assertStatus(int $expected): self
    {
        Assert::assertSame($expected, $this->raw->status, "Expected HTTP $expected, got {$this->raw->status}: {$this->raw->body}");
        return $this;
    }

    public function assertErrorCode(string $code): self
    {
        Assert::assertFalse($this->json('ok'), 'Expected ok:false');
        Assert::assertSame($code, $this->json('error.code'), $this->raw->body);
        Assert::assertIsString($this->json('error.message'));
        Assert::assertNotSame('', $this->json('error.message'));
        return $this;
    }

    /** {ok, data|error, meta.request_id, meta.server_time} and X-Request-Id = meta.request_id (TESTING S3). */
    public function assertEnvelope(): self
    {
        $j = $this->json();
        Assert::assertIsArray($j, 'Body is not JSON: ' . $this->raw->body);
        Assert::assertArrayHasKey('ok', $j);
        Assert::assertArrayHasKey($j['ok'] ? 'data' : 'error', $j);
        Assert::assertMatchesRegularExpression('/^r_[0-9a-f]{10}$/', (string) ($j['meta']['request_id'] ?? ''));
        Assert::assertMatchesRegularExpression('/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/', (string) ($j['meta']['server_time'] ?? ''));
        Assert::assertSame($j['meta']['request_id'], $this->header('X-Request-Id'));
        return $this;
    }
}
