<?php
declare(strict_types=1);

namespace AM\Middleware;

use AM\Kernel\App;
use AM\Kernel\Request;
use AM\Kernel\Response;

/**
 * STUB until Session 2. Will read the __Host-am_session cookie, find
 * sessions.token_hash and load the user with role and money flag fresh
 * (API.md §3.1). For now nobody is ever logged in.
 */
final class Session implements Middleware
{
    public function process(Request $request, App $app, callable $next): Response
    {
        $request->attributes['user'] = null;
        return $next($request);
    }
}
