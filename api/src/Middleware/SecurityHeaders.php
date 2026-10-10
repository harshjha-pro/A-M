<?php
declare(strict_types=1);

namespace AM\Middleware;

use AM\Kernel\App;
use AM\Kernel\Request;
use AM\Kernel\Response;

/**
 * API.md §10.3 headers on every API reply, errors included.
 * No CORS headers ever: cross-origin calls must fail.
 */
final class SecurityHeaders implements Middleware
{
    public const HEADERS = [
        'Content-Security-Policy' => "default-src 'none'; frame-ancestors 'none'",
        'Cache-Control' => 'no-store',
        'X-Content-Type-Options' => 'nosniff',
        'X-Frame-Options' => 'DENY',
        'Referrer-Policy' => 'no-referrer',
        'Cross-Origin-Resource-Policy' => 'same-origin',
        'X-Robots-Tag' => 'noindex, nofollow',
        'Strict-Transport-Security' => 'max-age=31536000',
    ];

    public function process(Request $request, App $app, callable $next): Response
    {
        $response = $next($request);
        foreach (self::HEADERS as $name => $value) {
            if ($name === 'Cache-Control' && isset($response->headers[$name]) && str_contains($response->headers[$name], 'no-store')) {
                continue; // a reply may say more ("private, no-store" on files) but never allow caching
            }
            if ($name === 'Content-Security-Policy' && isset($response->headers[$name]) && str_starts_with($response->headers[$name], "default-src 'none';")
                && !preg_match('/script-src|unsafe-eval|\*/', $response->headers[$name])) {
                continue; // a page with only its own inline styles (the export summary); still no scripts, nothing from outside
            }
            $response->headers[$name] = $value;
        }
        // Every reply says the oldest app version still allowed (API.md §1.3).
        $response->headers['X-Min-Client-Version'] = $app->env->get('MIN_CLIENT_VERSION', '1.0.0');
        foreach (array_keys($response->headers) as $name) {
            if (stripos($name, 'Access-Control-') === 0 || strcasecmp($name, 'X-Powered-By') === 0) {
                unset($response->headers[$name]);
            }
        }
        return $response;
    }
}
