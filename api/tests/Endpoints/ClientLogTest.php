<?php
declare(strict_types=1);

namespace Tests\Endpoints;

use Tests\Support\ApiClient;
use Tests\Support\ApiTestCase;
use Tests\Support\Endpoint;
use Tests\Support\TestDb;

/** POST /client-log — TESTING §1.3 last row and §9.3. */
final class ClientLogTest extends ApiTestCase
{
    private function report(array $over = []): array
    {
        return $over + [
            'at' => '2026-10-08T09:12:30Z',
            'app_version' => '1.0.1',
            'device' => 'iPhone · installed',
            'screen' => '/guests',
            'code' => 'render_error',
            'message' => 'Cannot read properties of undefined',
            'request_id' => 'r_0123456789',
            'stack' => "at GuestList (GuestList.jsx:12)",
        ];
    }

    #[Endpoint('POST /client-log')]
    public function test_works_without_a_session_and_writes_one_log_line(): void
    {
        $res = $this->api->postJson('/client-log', $this->report());
        $res->assertStatus(200)->assertEnvelope();
        $this->assertSame(true, $res->json('ok'));
        $this->assertSame([], $res->json('data'));
        $lines = array_values(array_filter(explode("\n", $this->logFile('client-error.log'))));
        $this->assertCount(1, $lines);
        $entry = json_decode($lines[0], true);
        $this->assertSame('render_error', $entry['code']);
        $this->assertSame('/guests', $entry['screen']);
        $this->assertNull($entry['user_id']);
    }

    #[Endpoint('POST /client-log')]
    public function test_never_writes_to_the_database_or_audit_log(): void
    {
        $pdo = TestDb::connect();
        $audit = (int) $pdo->query('SELECT COUNT(*) FROM audit_log')->fetchColumn();
        $this->api->postJson('/client-log', $this->report())->assertStatus(200);
        $this->assertSame($audit, (int) $pdo->query('SELECT COUNT(*) FROM audit_log')->fetchColumn());
    }

    #[Endpoint('POST /client-log')]
    public function test_phone_numbers_are_masked_and_text_is_capped(): void
    {
        $this->api->postJson('/client-log', $this->report([
            'message' => 'Failed for +91 98290 12345 and 098290-12345 on 2026-10-08 ' . str_repeat('x', 600),
            'stack' => str_repeat('s', 3000),
        ]))->assertStatus(200);
        $entry = json_decode(trim($this->logFile('client-error.log')), true);
        $this->assertStringNotContainsString('98290', $entry['message']);
        $this->assertStringContainsString('[phone]', $entry['message']);
        $this->assertStringContainsString('2026-10-08', $entry['message'], 'Dates are not phones');
        $this->assertSame(500, mb_strlen($entry['message']));
        $this->assertSame(2000, mb_strlen($entry['stack']));
    }

    #[Endpoint('POST /client-log')]
    public function test_one_line_per_report_even_with_newlines(): void
    {
        $this->api->postJson('/client-log', $this->report(['message' => "line1\nline2\r\nline3"]))->assertStatus(200);
        $this->assertSame(1, substr_count(trim($this->logFile('client-error.log')), "\n") + 1);
    }

    #[Endpoint('POST /client-log')]
    public function test_bad_json_is_400_never_500(): void
    {
        $this->api->request('POST', '/client-log', '{"message": "oops"')->assertStatus(400)->assertErrorCode('bad_request');
        $this->api->request('POST', '/client-log', '"just a string"')->assertStatus(400)->assertErrorCode('bad_request');
        $this->api->postJson('/client-log', ['message' => ['nested' => 'no']])->assertStatus(400)->assertErrorCode('bad_request');
        $this->api->request('POST', '/client-log', 'message=hi', ['content-type' => 'application/x-www-form-urlencoded'])
            ->assertStatus(400)->assertErrorCode('bad_request');
        $this->assertSame('', $this->logFile('client-error.log'));
    }

    #[Endpoint('POST /client-log')]
    public function test_31st_report_in_an_hour_is_429(): void
    {
        for ($i = 1; $i <= 30; $i++) {
            $this->api->postJson('/client-log', $this->report())->assertStatus(200);
        }
        $this->api->postJson('/client-log', $this->report())->assertStatus(429)->assertErrorCode('rate_limited');
        // Another phone (IP) is not affected.
        (new ApiClient($this->app, '198.51.100.20'))->postJson('/client-log', $this->report())->assertStatus(200);
        $this->clock->advance('+1 hour');
        $this->api->postJson('/client-log', $this->report())->assertStatus(200);
    }

    #[Endpoint('POST /client-log')]
    public function test_old_app_and_schema_update_do_not_block_reports(): void
    {
        $api = new ApiClient($this->makeApp(['MIN_CLIENT_VERSION' => '9.0.0']));
        $api->postJson('/client-log', $this->report())->assertStatus(200);
    }

    #[Endpoint('POST /client-log')]
    public function test_body_over_16_kb_is_413(): void
    {
        $this->api->postJson('/client-log', $this->report(['stack' => str_repeat('a', 20000)]))
            ->assertStatus(413)->assertErrorCode('body_too_big');
    }

    #[Endpoint('POST /client-log')]
    public function test_get_on_client_log_is_405(): void
    {
        $this->api->get('/client-log')->assertStatus(405)->assertErrorCode('method_not_allowed');
    }
}
