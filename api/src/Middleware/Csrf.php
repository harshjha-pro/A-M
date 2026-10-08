<?php
declare(strict_types=1);

namespace AM\Middleware;

use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Request;
use AM\Kernel\Response;

/**
 * STUB until Session 2. Will check X-CSRF-Token against sessions.csrf_hash,
 * plus Origin / Sec-Fetch-Site and a JSON or multipart body on every
 * logged-in write (API.md §3.1, SEC-14…17).
 * Until then it refuses every logged-in write, so nothing can be saved by
 * accident without the real check.
 */
final class Csrf implements Middleware
{
    public function process(Request $request, App $app, callable $next): Response
    {
        if ($request->isWrite() && $request->attr('user') !== null) {
            throw HttpError::make(403, 'csrf_failed');
        }
        return $next($request);
    }
}
