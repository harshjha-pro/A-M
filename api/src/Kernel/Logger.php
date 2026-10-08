<?php
declare(strict_types=1);

namespace AM\Kernel;

use Throwable;

/**
 * Writes one line per problem to private/logs (TESTING §9.3).
 * Never passwords, tokens or guest phone numbers; user id, not name.
 */
final class Logger
{
    public function __construct(private readonly string $dir, private readonly Clock $clock) {}

    public function error(string $requestId, string $message, array $context = []): void
    {
        $this->write('php-error.log', ['level' => 'error', 'request_id' => $requestId, 'message' => self::mask($message)] + $context);
    }

    public function exception(string $requestId, Throwable $e, array $context = []): void
    {
        $this->error($requestId, get_class($e) . ': ' . $e->getMessage(), $context + [
            'where' => basename($e->getFile()) . ':' . $e->getLine(),
        ]);
    }

    /** Phone-side problems from POST /client-log. */
    public function client(array $entry): void
    {
        $this->write('client-error.log', $entry);
    }

    public function dir(): string
    {
        return $this->dir;
    }

    /** Hides anything that looks like a phone number: 10+ digits, maybe with spaces, dashes, dots or brackets. */
    public static function mask(string $text): string
    {
        return (string) preg_replace_callback(
            '/\+?\d[\d\s\-().]{6,}\d/',
            static fn (array $m): string => preg_match_all('/\d/', $m[0]) >= 10 ? '[phone]' : $m[0],
            $text,
        );
    }

    private function write(string $file, array $entry): void
    {
        $line = json_encode(['at' => $this->clock->isoNow()] + $entry, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE) . "\n";
        if ($this->dir !== '' && (is_dir($this->dir) || @mkdir($this->dir, 0700, true)) && is_writable($this->dir)) {
            @file_put_contents($this->dir . '/' . $file, $line, FILE_APPEND | LOCK_EX);
            return;
        }
        error_log(rtrim($line));
    }
}
