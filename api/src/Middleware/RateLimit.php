<?php
declare(strict_types=1);

namespace AM\Middleware;

use AM\Kernel\App;
use AM\Kernel\RateLimiter;
use AM\Kernel\Request;
use AM\Kernel\Response;

/**
 * API.md §10.1 general buckets:
 *   no session  → 60 per minute per IP
 *   reads       → 600 per 5 minutes per session
 *   writes      → 120 per 5 minutes per user
 * Tighter limits (login, links, setup, health, client-log) live in their controllers.
 */
final class RateLimit implements Middleware
{
    public function process(Request $request, App $app, callable $next): Response
    {
        $limiter = new RateLimiter($app);
        $user = $request->attr('user');
        if ($user === null) {
            $limiter->hit('anon:ip:' . RateLimiter::clientIp($request, $app), 60, 60);
        } elseif ($request->isWrite()) {
            $limiter->hit('write:user:' . $user['id'], 120, 300);
        } else {
            $limiter->hit('read:session:' . $request->attr('session')['id'], 600, 300);
        }
        return $next($request);
    }
}
