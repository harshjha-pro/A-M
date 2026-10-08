<?php
declare(strict_types=1);

namespace AM\Kernel;

use RuntimeException;

/**
 * A planned error reply: status + stable code + plain message (API.md §2.2).
 * Anything that is NOT an HttpError becomes a 500 with no details.
 */
final class HttpError extends RuntimeException
{
    /**
     * @param array<string,mixed>  $extra   extra keys inside "error" (fields, reason, retry_after_seconds…)
     * @param array<string,string> $headers extra response headers (Retry-After…)
     */
    public function __construct(
        public readonly int $status,
        public readonly string $errorCode,
        ?string $message = null,
        public readonly array $extra = [],
        public readonly array $headers = [],
    ) {
        parent::__construct($message ?? Strings::get($errorCode));
    }

    public static function make(int $status, string $code, array $vars = [], array $extra = [], array $headers = []): self
    {
        return new self($status, $code, Strings::get($code, $vars), $extra, $headers);
    }
}
