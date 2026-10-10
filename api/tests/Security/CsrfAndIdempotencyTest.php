<?php
declare(strict_types=1);

namespace Tests\Security;

use AM\Db\UnitOfWork;
use AM\Kernel\App;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Safety\AuditLog;
use Tests\Support\ApiClient;
use Tests\Support\ApiTestCase;

/** SEC-14…17, SEC-24, TESTING S4/S5, DS-04…DS-07, DS-24. */
final class CsrfAndIdempotencyTest extends ApiTestCase
{
    private function patchName(ApiClient $c, array $headers = [], array $opts = []): \Tests\Support\TestResponse
    {
        return $c->request('PATCH', '/members/' . $this->pid('papa'), '{"name":"Papa ji"}', $headers, [], $opts + ['ifMatch' => 1]);
    }

    public function test_sec14_missing_csrf_token_is_refused_and_nothing_written(): void
    {
        $papa = $this->loginAs('papa');
        $this->patchName($papa, [], ['csrf' => false])->assertStatus(403)->assertErrorCode('csrf_failed');
        $this->assertSame('Please refresh the app and try again.', $this->patchName($papa, [], ['csrf' => false])->json('error.message'));
        $this->assertSame('Papa', $this->db()->value('SELECT name FROM users WHERE id = 3'));
    }

    public function test_sec15_another_sessions_token_is_refused(): void
    {
        $papa = $this->loginAs('papa');
        $mummy = $this->loginAs('mummy');
        $this->patchName($papa, [], ['csrf' => (string) $mummy->csrf])->assertStatus(403)->assertErrorCode('csrf_failed');
    }

    public function test_sec16_wrong_origin_or_cross_site_is_refused(): void
    {
        $papa = $this->loginAs('papa');
        $this->patchName($papa, ['origin' => 'https://evil.example'])->assertStatus(403)->assertErrorCode('csrf_failed');
        $this->patchName($papa, ['origin' => 'null'])->assertStatus(403);
        $this->patchName($papa, ['origin' => 'https://wedding.lumorrahouse.com.evil.example'])->assertStatus(403);
        $noOrigin = $this->loginAs('papa');
        $noOrigin->defaultHeaders = array_diff_key($noOrigin->defaultHeaders, ['origin' => 1]);
        $this->patchName($noOrigin, ['sec-fetch-site' => 'cross-site'])->assertStatus(403);
        $this->patchName($noOrigin)->assertStatus(403);
        $this->patchName($noOrigin, ['sec-fetch-site' => 'same-origin'])->assertStatus(200);
    }

    public function test_sec17_form_encoded_bodies_are_refused(): void
    {
        $papa = $this->loginAs('papa');
        foreach (['text/plain', 'application/x-www-form-urlencoded'] as $type) {
            $papa->request('PATCH', '/members/' . $this->pid('papa'), '{"name":"X"}', ['content-type' => $type], [], ['ifMatch' => 1])
                ->assertStatus(403)->assertErrorCode('csrf_failed');
        }
    }

    public function test_sec24_the_stored_hash_is_not_a_cookie(): void
    {
        $this->loginAs('papa');
        $hash = (string) $this->db()->value('SELECT token_hash FROM sessions WHERE user_id = 3');
        $thief = new ApiClient($this->app);
        $thief->cookies['__Host-am_session'] = $hash;
        $thief->get('/session')->assertStatus(401);
    }

    public function test_s5_logged_in_writes_need_an_idempotency_key(): void
    {
        $papa = $this->loginAs('papa');
        $this->patchName($papa, [], ['idem' => false])->assertStatus(428)->assertErrorCode('idempotency_key_required');
        $this->patchName($papa, ['idempotency-key' => 'not-a-uuid'])->assertStatus(428);
    }

    public function test_ds07_same_key_while_the_first_is_still_running(): void
    {
        $papa = $this->loginAs('papa');
        $key = 'b1b2c3d4-0000-4000-8000-000000000001';
        $this->db()->run(
            "INSERT INTO idempotency_keys (idem_key, user_id, method, path, request_hash, status, created_at, expires_at)
             VALUES (?, 3, 'PATCH', ?, ?, 'processing', ?, ?)",
            [$key, '/api/v1/members/' . $this->pid('papa'), $this->hashFor('PATCH', '/api/v1/members/' . $this->pid('papa'), ['name' => 'Papa ji']),
             '2026-10-08 09:12:00', '2026-10-10 09:12:00'],
        );
        $r = $this->patchName($papa, [], ['idem' => $key]);
        $r->assertStatus(409)->assertErrorCode('request_in_progress');
        $this->assertSame('2', $r->header('Retry-After'));
        $this->assertSame(1, $this->rows('idempotency_keys', 'idem_key = ?', [$key]), 'a running claim is not released by the second request');
        // Older than 120 s → the first PHP process died; take it over.
        $this->clock->advance('+3 minutes');
        $this->patchName($papa, [], ['idem' => $key])->assertStatus(200);
        $this->assertSame('done', $this->db()->value('SELECT status FROM idempotency_keys WHERE idem_key = ?', [$key]));
    }

    public function test_keys_belong_to_one_person(): void
    {
        $key = 'b1b2c3d4-0000-4000-8000-000000000002';
        $this->patchName($this->loginAs('papa'), [], ['idem' => $key])->assertStatus(200);
        $mahi = $this->loginAs('mahi');
        // Same key, another user, another record: no replay of Papa's reply.
        $mahi->request('PATCH', '/members/' . $this->pid('mummy'), '{"name":"Mummy ji"}', [], [], ['ifMatch' => 1, 'idem' => $key])->assertStatus(200);
        $this->assertSame('Mummy ji', $this->db()->value('SELECT name FROM users WHERE id = 4'));
    }

    public function test_ds24_a_failure_after_the_change_saves_nothing_and_frees_the_key(): void
    {
        $this->app->router->add('POST', '/test/half-write', static function (Request $r, App $app): Response {
            return UnitOfWork::run($app, $r, static function ($db) use ($app, $r): Response {
                $db->run("UPDATE settings SET city = 'Half-written', version = version + 1 WHERE id = 1");
                AuditLog::record($app, $db, $r, ['action' => 'update', 'entity_type' => 'settings', 'entity_id' => 1]);
                throw new \RuntimeException('power cut between the change and the reply');
            });
        });
        $ayush = $this->loginAs('ayush');
        $audit = $this->rows('audit_log');
        $key = 'b1b2c3d4-0000-4000-8000-000000000003';
        $ayush->postJson('/test/half-write', ['x' => 1], [], ['idem' => $key])->assertStatus(500)->assertErrorCode('server_error');
        $this->assertSame('Bhilwara', $this->db()->value('SELECT city FROM settings'));
        $this->assertSame($audit, $this->rows('audit_log'));
        $this->assertSame(0, $this->rows('idempotency_keys', 'idem_key = ?', [$key]));
    }

    public function test_sec20_write_flood_is_limited(): void
    {
        $papa = $this->loginAs('papa');
        $version = 1;
        for ($i = 0; $i < 120; $i++) {
            $r = $papa->patchJson('/members/' . $this->pid('papa'), ['name' => "Papa $i"], $version);
            $version = (int) $r->json('data.version');
        }
        $r = $papa->patchJson('/members/' . $this->pid('papa'), ['name' => 'One too many'], $version);
        $r->assertStatus(429)->assertErrorCode('rate_limited');
        $this->assertGreaterThan(0, $r->json('error.retry_after_seconds'));
        $this->clock->advance('+5 minutes');
        $papa->patchJson('/members/' . $this->pid('papa'), ['name' => 'Papa'], $version)->assertStatus(200);
    }

    private function hashFor(string $method, string $path, array $body): string
    {
        ksort($body);
        return hash('sha256', $method . ' ' . $path . "\n" . json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }
}
