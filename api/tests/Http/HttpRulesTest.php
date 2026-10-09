<?php
declare(strict_types=1);

namespace Tests\Http;

use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\TestCase;

/**
 * Real HTTP through the server rules (TESTING §1.8 "http" project, SEC-05, SEC-30).
 * Run by tools/test-http.sh against:
 *   - real Apache 2.4 reading public_html/.htaccess (closest to Hostinger's LiteSpeed), and
 *   - php -S with tools/router.php (the sandbox copy of the rules).
 * Needs AM_HTTP_BASE (e.g. http://127.0.0.1:8081) and AM_HTTP_SITE (the site folder).
 */
#[Group('http')]
final class HttpRulesTest extends TestCase
{
    private const HOST = 'staging-wedding.lumorrahouse.com';
    private string $base;

    protected function setUp(): void
    {
        $base = (string) getenv('AM_HTTP_BASE');
        if ($base === '') {
            $this->markTestSkipped('AM_HTTP_BASE not set (run tools/test-http.sh)');
        }
        $this->base = rtrim($base, '/');
    }

    /** @return array{status:int, headers:array<string,string>, body:string} */
    private function fetch(string $path, string $method = 'GET', array $headers = [], ?string $body = null, bool $https = true, string $host = self::HOST): array
    {
        $ch = curl_init($this->base . $path);
        $h = ['Host: ' . $host];
        if ($https) {
            $h[] = 'X-Forwarded-Proto: https';
        }
        foreach ($headers as $k => $v) {
            $h[] = "$k: $v";
        }
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $h,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HEADER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_PATH_AS_IS => true,
        ]);
        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        }
        $raw = (string) curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $size = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        $headers = [];
        foreach (explode("\r\n", substr($raw, 0, $size)) as $line) {
            if (str_contains($line, ':')) {
                [$k, $v] = explode(':', $line, 2);
                $headers[strtolower(trim($k))] = trim($v);
            }
        }
        return ['status' => $status, 'headers' => $headers, 'body' => substr($raw, $size)];
    }

    private function assertBaseHeaders(array $r, string $where): void
    {
        $h = $r['headers'];
        $this->assertSame('max-age=31536000', $h['strict-transport-security'] ?? null, "HSTS on $where");
        $this->assertSame('nosniff', $h['x-content-type-options'] ?? null, "nosniff on $where");
        $this->assertSame('DENY', $h['x-frame-options'] ?? null, "X-Frame-Options on $where");
        $this->assertSame('no-referrer', $h['referrer-policy'] ?? null, "Referrer-Policy on $where");
        $this->assertSame('noindex, nofollow', $h['x-robots-tag'] ?? null, "X-Robots-Tag on $where");
        $this->assertArrayNotHasKey('x-powered-by', $h, "X-Powered-By on $where");
        foreach (array_keys($h) as $name) {
            $this->assertStringStartsNotWith('access-control-', $name, "CORS header on $where");
        }
    }

    public function test_app_page_and_headers_sec30(): void
    {
        $r = $this->fetch('/');
        $this->assertSame(200, $r['status']);
        $this->assertStringContainsString('<div id="root">', $r['body']);
        $this->assertStringContainsString('A&amp;M Staging', $r['body']);
        $this->assertBaseHeaders($r, '/');
        $this->assertStringContainsString("default-src 'self'; script-src 'self'", $r['headers']['content-security-policy'] ?? '');
        $this->assertStringContainsString("frame-ancestors 'none'", $r['headers']['content-security-policy'] ?? '');
        $this->assertStringContainsString('camera=(self)', $r['headers']['permissions-policy'] ?? '');
        $this->assertSame('same-origin', $r['headers']['cross-origin-opener-policy'] ?? null);
        $this->assertSame('no-cache', $r['headers']['cache-control'] ?? null, 'index.html must always be re-checked');
    }

    public function test_deep_links_load_the_app(): void
    {
        foreach (['/tasks', '/guests', '/tasks/01JA7S9F2C0000000000000000', '/settings/safety'] as $p) {
            $r = $this->fetch($p);
            $this->assertSame(200, $r['status'], $p);
            $this->assertStringContainsString('<div id="root">', $r['body'], $p);
        }
    }

    public function test_api_through_the_server(): void
    {
        $r = $this->fetch('/api/v1/health');
        $this->assertSame(200, $r['status'], $r['body']);
        $this->assertSame('{"status":"ok"}', $r['body']);
        $this->assertBaseHeaders($r, '/api/v1/health');
        $this->assertSame("default-src 'none'; frame-ancestors 'none'", $r['headers']['content-security-policy'] ?? null, 'API CSP variant');
        $this->assertSame('no-store', $r['headers']['cache-control'] ?? null);
        $this->assertMatchesRegularExpression('/^r_[0-9a-f]{10}$/', $r['headers']['x-request-id'] ?? '');

        $nf = $this->fetch('/api/v1/nope');
        $this->assertSame(404, $nf['status']);
        $this->assertSame('not_found', json_decode($nf['body'], true)['error']['code'] ?? null);

        $q = $this->fetch('/api/v1/health?debug=1');
        $this->assertSame(400, $q['status'], 'Query string reaches PHP (QSA)');
    }

    public function test_client_log_through_the_server(): void
    {
        $r = $this->fetch('/api/v1/client-log', 'POST', ['Content-Type' => 'application/json'], json_encode(['code' => 'http_test', 'message' => 'from tools/test-http.sh']));
        $this->assertSame(200, $r['status'], $r['body']);
        $site = (string) getenv('AM_HTTP_SITE');
        if ($site !== '') {
            $this->assertStringContainsString('http_test', (string) @file_get_contents("$site/private/logs/client-error.log"));
        }
    }

    public function test_secrets_and_private_files_are_never_served_sec05(): void
    {
        $paths = [
            '/.env', '/.htaccess', '/assets/.htaccess', '/.git/config', '/api/.env',
            '/private/', '/private/.env', '/private/app/bootstrap.php', '/private/logs/php-error.log',
            '/uploads/2026/10/3b2f7c1e-8f8a-4d55-9a2e-1c0b6f1d9a77.jpg', '/storage/exports/x.zip',
            '/composer.json', '/composer.lock', '/db/migrations/001_init.sql', '/backup.sql.gz.enc',
            '/README.md', '/x.yaml', '/server.key', '/api/../private/.env', '/%2e%2e/private/.env',
            '/api/index.php~',
        ];
        foreach ($paths as $p) {
            $r = $this->fetch($p);
            // 400 = the server refused a malformed path outright (Apache does this for %2e%2e): also safe.
            $this->assertContains($r['status'], [400, 403, 404], "$p must be 400/403/404, got {$r['status']}");
            foreach (['DB_PASS', '<?php', 'SETUP_TOKEN', 'require dirname'] as $secret) {
                $this->assertStringNotContainsString($secret, $r['body'], "$p leaked '$secret'");
            }
        }
    }

    public function test_every_file_index_html_points_to_is_there(): void
    {
        $index = $this->fetch('/')['body'];
        preg_match_all('/(?:src|href)="(\/[^"#?]+)"/', $index, $m);
        $this->assertNotEmpty($m[1]);
        foreach (array_unique($m[1]) as $path) {
            $r = $this->fetch($path);
            $this->assertSame(200, $r['status'], "$path is referenced by index.html but missing");
            $this->assertStringNotContainsString('<div id="root">', $r['body'], "$path fell back to the app page");
        }
    }

    public function test_static_folders_never_fall_back_to_the_app(): void
    {
        $this->assertSame(404, $this->fetch('/assets/missing-abc.js')['status']);
        $this->assertSame(404, $this->fetch('/icons/missing.png')['status']);
        $this->assertContains($this->fetch('/assets/')['status'], [403, 404], 'No folder listing');
    }

    public function test_cache_rules_for_assets_manifest_and_version(): void
    {
        $index = $this->fetch('/')['body'];
        $this->assertSame(1, preg_match('#/assets/index-[\w-]+\.js#', $index, $m), 'main script in index.html');
        $js = $this->fetch($m[0]);
        $this->assertSame(200, $js['status']);
        $this->assertSame('public, max-age=31536000, immutable', $js['headers']['cache-control'] ?? null);
        $this->assertStringContainsString("script-src 'self'", $js['headers']['content-security-policy'] ?? '');

        $man = $this->fetch('/manifest.webmanifest');
        $this->assertSame(200, $man['status']);
        $this->assertStringStartsWith('application/manifest+json', $man['headers']['content-type'] ?? '');
        $this->assertSame('no-cache', $man['headers']['cache-control'] ?? null);
        $this->assertSame('A&M Staging', json_decode($man['body'], true)['short_name'] ?? null);

        $ver = $this->fetch('/version.json');
        $this->assertSame('no-cache', $ver['headers']['cache-control'] ?? null);
        $this->assertSame(trim((string) file_get_contents(dirname(__DIR__, 3) . '/VERSION')), json_decode($ver['body'], true)['version'] ?? null);

        $icon = $this->fetch('/icons/icon-192.png');
        $this->assertSame(200, $icon['status']);
        $this->assertStringStartsWith('image/png', $icon['headers']['content-type'] ?? '');
    }

    /** .htaccess rule 6 (Session 7 Lighthouse finding): app text files are gzipped; API replies are not (BREACH). */
    public function test_app_files_are_compressed_api_replies_are_not(): void
    {
        $index = $this->fetch('/')['body'];
        preg_match('#/assets/index-[\w-]+\.js#', $index, $m);
        $js = $this->fetch($m[0], 'GET', ['Accept-Encoding' => 'gzip']);
        $this->assertSame('gzip', $js['headers']['content-encoding'] ?? null);
        $this->assertStringContainsString('Accept-Encoding', $js['headers']['vary'] ?? '');
        $plain = $this->fetch($m[0]);
        $this->assertLessThan(strlen($plain['body']) / 2, strlen($js['body']), 'at least halves the main script');
        $this->assertSame((string) gzdecode($js['body']), $plain['body']);
        $this->assertSame('gzip', $this->fetch('/', 'GET', ['Accept-Encoding' => 'gzip'])['headers']['content-encoding'] ?? null);
        $api = $this->fetch('/api/v1/health', 'GET', ['Accept-Encoding' => 'gzip']);
        $this->assertArrayNotHasKey('content-encoding', $api['headers']);
    }

    /** FEATURES A8: the guest list template downloads as an Excel file (AC-IMP-10). */
    public function test_guest_template_downloads_as_excel(): void
    {
        $r = $this->fetch('/templates/AM_Guest_List_Template.xlsx');
        $this->assertSame(200, $r['status']);
        $this->assertSame('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', $r['headers']['content-type'] ?? null);
        $this->assertStringStartsWith("PK", $r['body'], 'a real .xlsx (zip) file');
    }

    public function test_http_redirects_to_https(): void
    {
        $r = $this->fetch('/tasks?view=mine', https: false);
        $this->assertSame(301, $r['status']);
        $this->assertSame('https://' . self::HOST . '/tasks?view=mine', $r['headers']['location'] ?? null);
        $api = $this->fetch('/api/v1/health', https: false);
        $this->assertSame(301, $api['status'], 'API too');
    }

    public function test_setup_login_and_session_over_real_http(): void
    {
        $origin = ['Origin' => 'https://' . self::HOST, 'Content-Type' => 'application/json'];
        $token = (string) getenv('AM_HTTP_SETUP_TOKEN');
        $phone = '+9198290' . random_int(10000, 99999);
        $setup = $this->fetch('/api/v1/setup/owner', 'POST', $origin, json_encode([
            'setup_token' => $token, 'name' => 'HTTP Test Owner', 'phone' => $phone, 'password' => 'lotus-4821',
        ]));
        if ($setup['status'] === 410) {
            $this->markTestSkipped('owner already exists in this site database');
        }
        $this->assertSame(201, $setup['status'], $setup['body']);

        $login = $this->fetch('/api/v1/auth/login', 'POST', $origin, json_encode(['phone' => $phone, 'password' => 'lotus-4821']));
        $this->assertSame(200, $login['status'], $login['body']);
        $cookie = $login['headers']['set-cookie'] ?? '';
        foreach (['__Host-am_session=', 'Max-Age=7776000', 'Path=/', 'Secure', 'HttpOnly', 'SameSite=Lax'] as $part) {
            $this->assertStringContainsString($part, $cookie, 'cookie survives the web server');
        }
        preg_match('/__Host-am_session=([^;]+)/', $cookie, $m);
        $session = $this->fetch('/api/v1/session', 'GET', ['Cookie' => '__Host-am_session=' . $m[1]]);
        $this->assertSame(200, $session['status'], $session['body']);
        $this->assertSame('owner', json_decode($session['body'], true)['data']['user']['role']);

        // A real multipart upload through the web server: PHP's own $_FILES path (move_uploaded_file), then the download.
        $csrf = (string) json_decode($login['body'], true)['data']['csrf_token'];
        $im = imagecreatetruecolor(32, 24);
        imagefill($im, 0, 0, imagecolorallocate($im, random_int(0, 255), random_int(0, 255), random_int(0, 255))); // unique bytes per run
        imagesetpixel($im, random_int(0, 31), random_int(0, 23), imagecolorallocate($im, random_int(0, 255), 7, 9));
        ob_start();
        imagejpeg($im, null, 80);
        $jpeg = (string) ob_get_clean();
        $b = '----amhttp' . bin2hex(random_bytes(6));
        $body = "--$b\r\nContent-Disposition: form-data; name=\"type\"\r\n\r\nreceipt\r\n"
            . "--$b\r\nContent-Disposition: form-data; name=\"sha256\"\r\n\r\n" . hash('sha256', $jpeg) . "\r\n"
            . "--$b\r\nContent-Disposition: form-data; name=\"file\"; filename=\"IMG_1.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n$jpeg\r\n--$b--\r\n";
        $auth = ['Cookie' => '__Host-am_session=' . $m[1], 'Origin' => 'https://' . self::HOST, 'X-CSRF-Token' => $csrf];
        $up = $this->fetch('/api/v1/documents', 'POST', $auth + ['Content-Type' => "multipart/form-data; boundary=$b", 'Idempotency-Key' => '5b1f0b52-3a2d-4c1e-9f00-' . sprintf('%012d', random_int(1, 999999999))], $body);
        $this->assertSame(201, $up['status'], $up['body']);
        $doc = json_decode($up['body'], true)['data'];
        $file = $this->fetch($doc['file_url'], 'GET', ['Cookie' => $auth['Cookie']]);
        $this->assertSame(200, $file['status']);
        $this->assertSame($jpeg, $file['body'], 'the same bytes come back');
        $this->assertSame('private, no-store', $file['headers']['cache-control'] ?? null);
        $this->assertSame(401, $this->fetch($doc['file_url'])['status'], 'no session → 401');
        foreach (['/uploads/2026/10/' . $doc['file']['id'] . '.jpg', '/private/storage/uploads/', '/storage/uploads/'] as $guess) { // SEC-05
            $this->assertContains($this->fetch($guess)['status'], [403, 404], $guess);
        }

        $evil = $this->fetch('/api/v1/auth/login', 'POST', ['Origin' => 'https://evil.example', 'Content-Type' => 'application/json'],
            json_encode(['phone' => $phone, 'password' => 'lotus-4821']));
        $this->assertSame(403, $evil['status'], 'Origin check through the web server');
        $this->assertSame(401, $this->fetch('/api/v1/session')['status']);
    }

    public function test_other_hostnames_get_404(): void
    {
        foreach (['evil.example', 'lumorrahouse.com', 'wedding.lumorrahouse.com.evil.example'] as $host) {
            $this->assertSame(404, $this->fetch('/', host: $host)['status'], $host);
        }
        $this->assertSame(200, $this->fetch('/', host: 'wedding.lumorrahouse.com')['status'], 'live name works');
    }
}
