<?php
declare(strict_types=1);

namespace AM\Middleware;

use AM\Kernel\App;
use AM\Kernel\Request;
use AM\Kernel\Response;

/** One step of the request chain (IMPLEMENTATION §2.3). Call $next to go on. */
interface Middleware
{
    /** @param callable(Request): Response $next */
    public function process(Request $request, App $app, callable $next): Response;
}
