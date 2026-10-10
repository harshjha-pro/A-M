<?php
declare(strict_types=1);

namespace AM\Middleware;

use AM\Auth\Sessions;
use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Request;
use AM\Kernel\Response;

/**
 * Cross-site request forgery guard (API.md §3.1, SEC-14…17, AC-AUTH-09).
 * Every write while logged in needs:
 *   - X-CSRF-Token matching this session,
 *   - Origin equal to APP_URL (or Sec-Fetch-Site: same-origin),
 *   - a JSON (or multipart) body, or no body.
 * Anonymous auth writes (login, setup, links) get the Origin and body checks.
 * Any failure → 403 csrf_failed, nothing written.
 */
final class Csrf implements Middleware
{
    public function process(Request $request, App $app, callable $next): Response
    {
        if (!$request->isWrite()) {
            return $next($request);
        }
        $user = $request->attr('user');
        $route = $request->attr('route');
        if ($user === null && !$route->option('origin_check', false)) {
            return $next($request);
        }

        if (!$this->sameOrigin($request, $app)) {
            throw HttpError::make(403, 'csrf_failed');
        }
        if ($request->body !== '' && !in_array($request->contentType(), ['application/json', 'multipart/form-data'], true)) {
            throw HttpError::make(403, 'csrf_failed');
        }
        // Login, setup and set-password links work the same whether or not this phone is
        // already logged in (their page has no token yet): Origin + JSON is their guard.
        if ($user !== null && !$route->option('origin_check', false)) {
            $sent = $request->header('x-csrf-token');
            $session = $request->attr('session');
            if ($sent === '' || !hash_equals((string) $session['csrf_hash'], Sessions::hash($sent))) {
                throw HttpError::make(403, 'csrf_failed');
            }
        }
        return $next($request);
    }

    private function sameOrigin(Request $request, App $app): bool
    {
        $origin = $request->header('origin');
        if ($origin !== '') {
            return $origin !== 'null' && rtrim(strtolower($origin), '/') === self::origin($app->env->get('APP_URL'));
        }
        $site = strtolower($request->header('sec-fetch-site'));
        return $site === 'same-origin';
    }

    /** "https://wedding.lumorrahouse.com/anything" → "https://wedding.lumorrahouse.com" */
    public static function origin(string $url): string
    {
        $p = parse_url(strtolower(trim($url)));
        if (!isset($p['scheme'], $p['host'])) {
            return '';
        }
        return $p['scheme'] . '://' . $p['host'] . (isset($p['port']) ? ':' . $p['port'] : '');
    }
}
