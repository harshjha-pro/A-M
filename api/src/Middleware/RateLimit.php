<?php
declare(strict_types=1);

namespace AM\Middleware;

use AM\Kernel\App;
use AM\Kernel\RateLimiter;
use AM\Kernel\Request;
use AM\Kernel\Response;

/**
 * API.md §10.1 "any request without a session: 60 per minute per IP".
 * The per-user buckets (reads, writes, bulk, uploads) arrive with sessions in
 * Session 2. Routes with their own tighter limit (health, client-log) apply
 * it in the controller.
 */
final class RateLimit implements Middleware
{
    public function process(Request $request, App $app, callable $next): Response
    {
        if ($request->attr('user') === null) {
            (new RateLimiter($app))->hit('anon:ip:' . RateLimiter::clientIp($request, $app), 60, 60);
        }
        return $next($request);
    }
}
