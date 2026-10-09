<?php
declare(strict_types=1);

namespace Tests\Security;

use AM\Http\Routes;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\ApiClient;
use Tests\Support\ApiTestCase;

/**
 * TESTING §1.3 standard set, over every built route (new routes join automatically):
 *   S1  no session → 401 (except anonymous routes)
 *   S7  unknown query parameter → 400 on every GET
 *   S10 no reply leaks a hash, a numeric id, or money to a non-money user
 *   SEC-09 a Viewer can't write anything
 */
final class StandardSetTest extends ApiTestCase
{
    /** @return array<string, array{string, string, bool}> */
    public static function routes(): array
    {
        $out = [];
        foreach (Routes::build()->routes() as $r) {
            $out[$r->name()] = [$r->method, $r->pattern, (bool) $r->option('anon', false)];
        }
        return $out;
    }

    private function path(string $pattern): string
    {
        return strtr($pattern, ['{id}' => $this->pid('papa'), '{batch_id}' => '01JA6ZZZZZZZZZZZZZZZZZZZZZ', '{resource}' => 'members']);
    }

    #[DataProvider('routes')]
    public function test_s1_no_session_is_401(string $method, string $pattern, bool $anon): void
    {
        if ($anon) {
            $this->assertTrue(true, 'anonymous route');
            return;
        }
        $res = (new ApiClient($this->app))->request($method, $this->path($pattern), $method === 'GET' ? null : '{}');
        $res->assertStatus(401)->assertEnvelope()->assertErrorCode('not_logged_in');
    }

    #[DataProvider('routes')]
    public function test_s7_unknown_query_parameter_is_400(string $method, string $pattern, bool $anon): void
    {
        if ($method !== 'GET') {
            $this->assertTrue(true);
            return;
        }
        $res = $this->loginAs('ayush')->get($this->path($pattern), ['typo_param' => '1']);
        $res->assertStatus(400)->assertErrorCode('bad_request');
    }

    #[DataProvider('routes')]
    public function test_s10_replies_never_leak(string $method, string $pattern, bool $anon): void
    {
        if ($method !== 'GET') {
            $this->assertTrue(true);
            return;
        }
        foreach (['mummy', 'ayush'] as $who) {
            $c = $this->loginAs($who);
            $res = $c->get($this->path($pattern));
            $body = $res->body();
            foreach (['password_hash', 'token_hash', 'csrf_hash', 'client_uuid', 'test-1234', '$2y$'] as $secret) {
                $this->assertStringNotContainsString($secret, $body, "$pattern leaks $secret to $who");
            }
            $this->assertNoNumericIds($res->json(), $pattern);
            if ($who === 'mummy') {
                $this->assertDoesNotMatchRegularExpression('/_paise"/', $body, "$pattern shows money to a non-money user");
            }
        }
    }

    #[DataProvider('routes')]
    public function test_sec09_a_viewer_cannot_write(string $method, string $pattern, bool $anon): void
    {
        if ($method === 'GET' || $anon || in_array($pattern, ['/auth/logout', '/auth/logout-all', '/auth/password/change'], true)) {
            $this->assertTrue(true, 'reads, anonymous and own-account routes');
            return;
        }
        $nani = $this->loginAs('nani');
        $res = $nani->request($method, $this->path($pattern), '{"name":"x"}', [], [], ['ifMatch' => 1]);
        $this->assertSame(403, $res->status(), "$method $pattern let a Viewer write: " . $res->body());
    }

    /** "id" keys must be 26-character public ids; user_id-style keys never appear. */
    private function assertNoNumericIds(mixed $node, string $where): void
    {
        if (!is_array($node)) {
            return;
        }
        foreach ($node as $k => $v) {
            if ($k === 'id' && $v !== null) {
                $this->assertMatchesRegularExpression('/^[0-9A-HJKMNP-TV-Z]{26}$/', (string) $v, "numeric id in $where");
            }
            if (is_string($k) && preg_match('/(^|_)(user|created_by|updated_by|deleted_by)_id$/', $k)) {
                $this->fail("internal id key $k in $where");
            }
            $this->assertNoNumericIds($v, $where);
        }
    }
}
