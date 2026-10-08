<?php
declare(strict_types=1);

namespace Tests\Security;

use AM\Kernel\App;
use AM\Kernel\Request;
use AM\Kernel\Response;
use Tests\Support\ApiTestCase;

/** SEC-29: a crash gives a plain 500 with no path, SQL, stack trace or PHP version. */
final class ErrorLeakTest extends ApiTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->app->router->add('GET', '/test/boom', static function (): Response {
            throw new \RuntimeException('SQLSTATE[42S02]: Base table not found in /home/u123/private/app/src/Secret.php line 12');
        }, ['anon' => true]);
        $this->app->router->add('GET', '/test/sql', static function (Request $r, App $app): Response {
            $app->db()->value('SELECT * FROM no_such_table');
            return Response::ok([]);
        }, ['anon' => true]);
        $this->app->router->add('GET', '/test/warning', static function (): Response {
            $x = [];
            return Response::ok(['v' => intdiv(1, 0)]);
        }, ['anon' => true]);
    }

    public function test_exception_becomes_plain_500(): void
    {
        foreach (['/test/boom', '/test/sql', '/test/warning'] as $path) {
            $res = $this->api->get($path);
            $res->assertStatus(500)->assertEnvelope()->assertErrorCode('server_error');
            $this->assertSame('Something went wrong on our side. Nothing was saved. Please try again.', $res->json('error.message'));
            foreach (['SQLSTATE', '/home', '.php', 'Stack', '#0', 'PHP', PHP_VERSION, 'no_such_table'] as $leak) {
                $this->assertStringNotContainsString($leak, $res->body(), "Leaked '$leak' on $path");
            }
            foreach ($res->raw->headers as $name => $value) {
                $this->assertStringNotContainsString(PHP_VERSION, $value, "Header $name leaks the PHP version");
            }
        }
    }

    public function test_details_go_to_the_server_log_with_request_id(): void
    {
        $res = $this->api->get('/test/boom');
        $log = $this->logFile('php-error.log');
        $this->assertStringContainsString((string) $res->json('meta.request_id'), $log);
        $this->assertStringContainsString('RuntimeException', $log);
        $this->assertStringContainsString('GET /test/boom', $log);
    }
}
