<?php
declare(strict_types=1);

namespace AM\Kernel;

use Throwable;

/**
 * Fixed-window counters in the rate_limits table (migration 003, API.md §10.2):
 * one INSERT … ON DUPLICATE KEY UPDATE per request, then compare.
 * If the database is down the limiter lets the request through (and logs it),
 * so /health can still answer "fail" instead of a 500.
 */
final class RateLimiter
{
    public function __construct(private readonly App $app) {}

    /** @throws HttpError 429 rate_limited when the bucket is over $limit in this window */
    public function hit(string $bucket, int $limit, int $windowSeconds): void
    {
        $now = $this->app->clock->now()->getTimestamp();
        $start = intdiv($now, $windowSeconds) * $windowSeconds;
        try {
            $db = $this->app->db();
            $db->run(
                'INSERT INTO rate_limits (bucket, window_start, hits) VALUES (?, ?, 1)
                 ON DUPLICATE KEY UPDATE hits = hits + 1',
                [substr($bucket, 0, 120), gmdate('Y-m-d H:i:s', $start)],
            );
            $hits = (int) $db->value(
                'SELECT hits FROM rate_limits WHERE bucket = ? AND window_start = ?',
                [substr($bucket, 0, 120), gmdate('Y-m-d H:i:s', $start)],
            );
        } catch (Throwable $e) {
            $this->app->logger->exception('-', $e, ['where_limit' => $bucket]);
            return;
        }
        if ($hits > $limit) {
            $retry = max(1, $start + $windowSeconds - $now);
            throw HttpError::make(
                429,
                'rate_limited',
                ['n' => (int) ceil($retry / 60)],
                ['retry_after_seconds' => $retry],
                ['Retry-After' => (string) $retry],
            );
        }
    }

    /**
     * REMOTE_ADDR, unless TRUSTED_PROXY in .env names a forwarding header that
     * Hostinger's proxy really sets (SEC-22: never trust it by default).
     */
    public static function clientIp(Request $request, App $app): string
    {
        $header = trim($app->env->get('TRUSTED_PROXY'));
        if ($header !== '') {
            $value = trim(explode(',', $request->header($header))[0]);
            if (filter_var($value, FILTER_VALIDATE_IP)) {
                return $value;
            }
        }
        return $request->ip;
    }
}
