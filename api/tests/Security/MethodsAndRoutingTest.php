<?php
declare(strict_types=1);

namespace Tests\Security;

use AM\Kernel\Response;
use Tests\Support\ApiTestCase;
use Tests\Support\TestDb;

/** SEC-31 methods; 404 for unknown paths; S1 401 for non-anonymous routes; maintenance and client-version guards. */
final class MethodsAndRoutingTest extends ApiTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        // Stand-ins for future endpoints, so the guards can be proven now.
        $this->app->router->add('POST', '/test/anon-write', static fn () => Response::ok(['saved' => true], 201), ['anon' => true, 'idempotent' => false]);
        $this->app->router->add('GET', '/test/private', static fn () => Response::ok([]));
        $this->app->router->add('POST', '/test/private', static fn () => Response::ok([], 201));
    }

    public function test_options_trace_connect_are_405(): void
    {
        foreach (['OPTIONS', 'TRACE', 'CONNECT', 'PROPFIND'] as $m) {
            $this->api->request($m, '/health')->assertStatus(405)->assertEnvelope()->assertErrorCode('method_not_allowed');
        }
    }

    public function test_unknown_paths_are_404_with_envelope(): void
    {
        foreach (['/nope', '/households/1', '/', '/health/extra'] as $p) {
            $this->api->get($p)->assertStatus(404)->assertEnvelope()->assertErrorCode('not_found');
        }
        $this->api->get('/api/v2/health')->assertStatus(404);
        $this->api->get('/api/healthz')->assertStatus(404);
    }

    public function test_routes_need_a_session_unless_anonymous(): void
    {
        $this->api->get('/test/private')->assertStatus(401)->assertEnvelope()->assertErrorCode('not_logged_in');
        $this->api->postJson('/test/private', ['a' => 1])->assertStatus(401)->assertErrorCode('not_logged_in');
    }

    public function test_writes_get_503_while_the_schema_is_behind(): void
    {
        $pdo = TestDb::connect();
        $pdo->exec("INSERT INTO schema_migrations (version, name, applied_by) VALUES (99, '099_half', 'test')");
        try {
            $res = $this->api->postJson('/test/anon-write', ['a' => 1]);
            $res->assertStatus(503)->assertErrorCode('app_updating');
            $this->assertSame('The app is being updated. Please try again in a few minutes.', $res->json('error.message'));
            $this->assertNotNull($res->header('Retry-After'));
            // Reads still work.
            $this->api->get('/health')->assertStatus(503); // health reports it
        } finally {
            $pdo->exec('DELETE FROM schema_migrations WHERE version = 99');
        }
        $this->api->postJson('/test/anon-write', ['a' => 1])->assertStatus(201);
    }

    public function test_write_with_database_down_is_503_not_500(): void
    {
        $app = $this->appWithDeadDb();
        $app->router->add('POST', '/test/anon-write', static fn () => Response::ok([], 201), ['anon' => true]);
        $res = (new \Tests\Support\ApiClient($app))->postJson('/test/anon-write', []);
        $res->assertStatus(503)->assertErrorCode('service_unavailable');
    }

    public function test_old_app_version_cannot_write(): void
    {
        $app = $this->makeApp(['MIN_CLIENT_VERSION' => '1.0.5']);
        $app->router->add('POST', '/test/anon-write', static fn () => Response::ok([], 201), ['anon' => true]);
        $api = new \Tests\Support\ApiClient($app);

        $res = $api->postJson('/test/anon-write', [], ['x-client-version' => '1.0.4']);
        $res->assertStatus(426)->assertErrorCode('update_required');
        $this->assertSame('1.0.5', $res->header('X-Min-Client-Version'));

        $api->postJson('/test/anon-write', [], ['x-client-version' => '1.0.5'])->assertStatus(201);
        $api->postJson('/test/anon-write', [], ['x-client-version' => '1.0.10'])->assertStatus(201);
        // Reads always work and carry the header.
        $this->assertSame('1.0.5', $api->get('/health', [], ['x-client-version' => '1.0.1'])->header('X-Min-Client-Version'));
    }

    public function test_body_over_1_mb_is_413(): void
    {
        $big = json_encode(['x' => str_repeat('a', 1024 * 1024)]);
        $this->api->request('POST', '/test/anon-write', $big)->assertStatus(413)->assertErrorCode('body_too_big');
    }

    public function test_invalid_json_body_is_400(): void
    {
        $this->api->request('POST', '/test/anon-write', '{bad')->assertStatus(400)->assertErrorCode('bad_request');
    }
}
