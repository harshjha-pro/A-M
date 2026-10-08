<?php
declare(strict_types=1);

/**
 * Sandbox copy of public_html/.htaccess for PHP's built-in server
 * (TESTING §1.8 "http" project). Keep it in step with .htaccess.
 *
 *   SITE_ROOT=/srv/am-site php -S 127.0.0.1:8080 tools/router.php
 *
 * SITE_ROOT is a folder made by tools/make-site.sh. ROUTER_EXTRA_HOSTS
 * (comma list, e.g. "127.0.0.1:8080") lets a local browser in for E2E.
 * The real Apache/LiteSpeed rules are tested too, by tools/test-http.sh.
 */

$site = rtrim((string) getenv('SITE_ROOT'), '/');
$docroot = $site . '/public_html';
$uri = (string) ($_SERVER['REQUEST_URI'] ?? '/');
$path = rawurldecode((string) parse_url($uri, PHP_URL_PATH));
$host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
$extra = array_filter(array_map('trim', explode(',', strtolower((string) getenv('ROUTER_EXTRA_HOSTS')))));

$always = static function (): void {
    header('Strict-Transport-Security: max-age=31536000');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: no-referrer');
    header('Cross-Origin-Resource-Policy: same-origin');
    header('X-Robots-Tag: noindex, nofollow');
    header_remove('X-Powered-By');
};
$notFound = static function () use ($always): bool {
    $always();
    http_response_code(404);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><title>Not Found</title><h1>Not Found</h1>';
    return true;
};

// 0. Only our two hostnames
if (!preg_match('/^(wedding|staging-wedding)\.lumorrahouse\.com$/', $host) && !in_array($host, $extra, true)) {
    return $notFound();
}
// 1. HTTPS only (the built-in server is plain HTTP: X-Forwarded-Proto stands in for TLS)
if (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') !== 'https' && !in_array($host, $extra, true)) {
    $always();
    header('Location: https://' . $host . $uri, true, 301);
    return true;
}
// 2. Dotfiles, except .well-known
if (preg_match('#(^|/)\.(?!well-known/)#', ltrim($path, '/'))) {
    return $notFound();
}
// 3. Forbidden file types
if (preg_match('/\.(env|ini|log|sql|gz|enc|zip|bak|sh|lock|md|ya?ml|key|php~)$/i', $path)
    || preg_match('#(^|/)composer\.(json|lock)$#i', $path)) {
    return $notFound();
}
// 4. API → the one PHP entry file
if (str_starts_with($path, '/api/')) {
    $always();
    $_SERVER['SCRIPT_FILENAME'] = $docroot . '/api/index.php';
    $_SERVER['SCRIPT_NAME'] = '/api/index.php';
    require $docroot . '/api/index.php';
    return true;
}

$file = realpath($docroot . $path);
$inside = $file !== false && str_starts_with($file, realpath($docroot) . '/');

// Options -Indexes: a folder without index.html is refused
if ($inside && is_dir($file) && !is_file($file . '/index.html')) {
    $always();
    http_response_code(403);
    echo 'Forbidden';
    return true;
}
// 5. SPA fallback: unknown paths load the app, except under the static folders
if (!$inside || !is_file($file)) {
    if (preg_match('#^/(api|assets|icons|install-guide|splash|templates|private|uploads|storage)(/|$)#', $path)) {
        return $notFound();
    }
    $file = $docroot . '/index.html';
}

$always();
$name = basename($file);
$types = [
    'html' => 'text/html; charset=utf-8', 'js' => 'text/javascript; charset=utf-8', 'css' => 'text/css; charset=utf-8',
    'json' => 'application/json', 'webmanifest' => 'application/manifest+json', 'png' => 'image/png',
    'svg' => 'image/svg+xml', 'woff2' => 'font/woff2', 'woff' => 'font/woff', 'ico' => 'image/x-icon',
];
$ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream'));
if (in_array($ext, ['html', 'js'], true)) {
    header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
    header('Permissions-Policy: camera=(self), microphone=(), geolocation=(), payment=(), usb=()');
    header('Cross-Origin-Opener-Policy: same-origin');
}
if (preg_match('/^(index\.html|sw\.js|manifest\.webmanifest|version\.json|reset\.html|reset\.js)$/', $name)) {
    header('Cache-Control: no-cache');
} elseif (str_starts_with($path, '/assets/')) {
    header('Cache-Control: public, max-age=31536000, immutable');
}
readfile($file);
return true;
