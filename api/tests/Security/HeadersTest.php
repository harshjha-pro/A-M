<?php
declare(strict_types=1);

namespace Tests\Security;

use Tests\Support\ApiTestCase;

/** SEC-30, API variant (the app-page variant is tested over real HTTP by tools/http-tests.php). */
final class HeadersTest extends ApiTestCase
{
    public function test_api_security_headers_on_success_and_error(): void
    {
        foreach ([$this->api->get('/health'), $this->api->get('/nope'), $this->api->request('TRACE', '/health')] as $res) {
            $this->assertSame("default-src 'none'; frame-ancestors 'none'", $res->header('Content-Security-Policy'));
            $this->assertSame('no-store', $res->header('Cache-Control'));
            $this->assertSame('nosniff', $res->header('X-Content-Type-Options'));
            $this->assertSame('DENY', $res->header('X-Frame-Options'));
            $this->assertSame('no-referrer', $res->header('Referrer-Policy'));
            $this->assertSame('noindex, nofollow', $res->header('X-Robots-Tag'));
            $this->assertSame('same-origin', $res->header('Cross-Origin-Resource-Policy'));
            $this->assertSame('max-age=31536000', $res->header('Strict-Transport-Security'));
            $this->assertSame('1.0.0', $res->header('X-Min-Client-Version'));
            $this->assertStringStartsWith('application/json', (string) $res->header('Content-Type'));
            foreach (array_keys($res->raw->headers) as $name) {
                $this->assertStringStartsNotWith('Access-Control-', $name, 'No CORS headers ever');
                $this->assertNotSame('X-Powered-By', $name);
            }
        }
    }

    public function test_cross_origin_preflight_gets_no_cors(): void
    {
        $res = $this->api->request('OPTIONS', '/health', null, ['origin' => 'https://evil.example', 'access-control-request-method' => 'POST']);
        $res->assertStatus(405);
        $this->assertNull($res->header('Access-Control-Allow-Origin'));
    }
}
