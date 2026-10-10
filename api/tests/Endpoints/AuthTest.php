<?php
declare(strict_types=1);

namespace Tests\Endpoints;

use AM\Auth\Sessions;
use Tests\Support\ApiClient;
use Tests\Support\ApiTestCase;
use Tests\Support\Endpoint;

/** /auth/login, /auth/logout(-all), /session, /auth/password/change, /auth/password-reset/request — TESTING §1.3. */
final class AuthTest extends ApiTestCase
{
    #[Endpoint('POST /auth/login')]
    public function test_login_normalises_phone_sets_a_safe_cookie_and_logs_it(): void
    {
        $res = $this->api->login('098290-00103'); // AC-AUTH-08 style input
        $res->assertStatus(200)->assertEnvelope();
        $this->assertSame('Papa', $res->json('data.user.name'));
        $this->assertSame('family', $res->json('data.user.role'));
        $this->assertTrue($res->json('data.user.can_see_money'));
        $this->assertMatchesRegularExpression('/^[A-Za-z0-9_-]{40,}$/', (string) $res->json('data.csrf_token'));
        $this->assertArrayNotHasKey('password_hash', $res->json('data.user'));

        $cookie = (string) $res->header('Set-Cookie');
        $this->assertMatchesRegularExpression('/^__Host-am_session=[A-Za-z0-9_-]{40,};/', $cookie);
        foreach (['Max-Age=7776000', 'Path=/', 'Secure', 'HttpOnly', 'SameSite=Lax'] as $part) {
            $this->assertStringContainsString($part, $cookie);
        }
        $this->assertStringNotContainsString('Domain=', $cookie, '__Host- cookies have no Domain');

        $token = $this->api->cookie();
        $this->assertSame(1, $this->rows('sessions', 'token_hash = ?', [hash('sha256', (string) $token)]), 'only the hash is stored');
        $this->assertSame(0, $this->rows('sessions', 'token_hash = ?', [(string) $token]));
        $this->assertSame(1, $this->rows('login_attempts', "phone = '+919829000103' AND succeeded = 1"));
        $this->assertSame(1, $this->rows('audit_log', "action = 'login' AND user_id = 3"));
        $this->assertSame('Android · browser', $this->db()->value('SELECT device_label FROM sessions WHERE user_id = 3'));
    }

    #[Endpoint('POST /auth/login')]
    public function test_wrong_phone_and_wrong_password_look_the_same(): void
    {
        $a = $this->api->login('+919829000103', 'not-the-password')->assertStatus(401)->assertErrorCode('login_failed');
        $b = $this->api->login('+919811111111', 'whatever-1')->assertStatus(401)->assertErrorCode('login_failed');
        $this->assertSame($a->json('error.message'), $b->json('error.message'));
        $this->assertSame('Phone or password is wrong.', $a->json('error.message'));
        $this->assertNull($a->header('Set-Cookie'));
        $this->assertSame(2, $this->rows('audit_log', "action = 'login_failed'"));
        $this->assertSame(2, $this->rows('login_attempts', 'succeeded = 0'));
    }

    #[Endpoint('POST /auth/login')]
    public function test_deactivated_or_ended_access_is_told_only_with_the_right_password(): void
    {
        $this->db()->run('UPDATE users SET is_active = 0 WHERE id = 4');
        $this->api->login('+919829000104', 'wrong-pass')->assertStatus(401)->assertErrorCode('login_failed');
        $this->api->login('+919829000104')->assertStatus(403)->assertErrorCode('access_ended');

        // AC-AUTH-05: planner with access_ends_on 20 Feb 2027 → refused on 21 Feb IST
        $this->db()->run("UPDATE users SET access_ends_on = '2027-02-20' WHERE id = 3");
        $this->clock->set('2027-02-20T18:00:00Z'); // 23:30 IST on the 20th: still fine
        $this->api->login('+919829000103')->assertStatus(200);
        $this->clock->set('2027-02-20T18:31:00Z'); // 00:01 IST on the 21st
        $this->api->login('+919829000103')->assertStatus(403)->assertErrorCode('access_ended');
    }

    #[Endpoint('POST /auth/login')]
    public function test_sec18_five_failures_lock_the_phone_for_15_minutes(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->api->login('+919829000103', 'wrong-' . $i)->assertStatus(401);
            $this->clock->advance('+10 seconds');
        }
        $res = $this->api->login('+919829000103')->assertStatus(429)->assertErrorCode('login_locked');
        $this->assertSame('Too many tries. Wait 15 minutes or ask Ayush or Mahi to reset your password.', $res->json('error.message'));
        $this->assertGreaterThan(800, (int) $res->header('Retry-After'));
        $this->assertSame((int) $res->header('Retry-After'), $res->json('error.retry_after_seconds'));
        // Another phone is not locked.
        $this->api->login('+919829000104')->assertStatus(200);
        $this->clock->advance('+15 minutes');
        $this->api->login('+919829000103')->assertStatus(200);
    }

    #[Endpoint('POST /auth/login')]
    public function test_sec19_twenty_failures_from_one_ip_lock_that_ip(): void
    {
        $api = new ApiClient($this->app, '198.51.100.99');
        for ($i = 0; $i < 20; $i++) {
            $api->login('+9198110000' . str_pad((string) $i, 2, '0', STR_PAD_LEFT), 'wrong-pass')->assertStatus(401);
        }
        $api->login('+919829000105')->assertStatus(429)->assertErrorCode('login_locked');
        (new ApiClient($this->app, '198.51.100.100'))->login('+919829000105')->assertStatus(200);
    }

    #[Endpoint('POST /auth/login')]
    public function test_sec22_forwarded_for_is_ignored_without_trusted_proxy(): void
    {
        $api = new ApiClient($this->app, '198.51.100.7');
        for ($i = 0; $i < 20; $i++) {
            $api->request('POST', '/auth/login', json_encode(['phone' => '+919811000' . str_pad((string) $i, 3, '0', STR_PAD_LEFT), 'password' => 'xx-wrong']), ['x-forwarded-for' => "10.0.0.$i"]);
        }
        $api->request('POST', '/auth/login', json_encode(['phone' => '+919829000105', 'password' => 'test-1234']), ['x-forwarded-for' => '10.9.9.9'])
            ->assertStatus(429);
    }

    #[Endpoint('POST /auth/login')]
    public function test_login_needs_our_origin_and_json(): void
    {
        $this->api->request('POST', '/auth/login', json_encode(['phone' => '+919829000103', 'password' => 'test-1234']), ['origin' => 'https://evil.example'])
            ->assertStatus(403)->assertErrorCode('csrf_failed');
        $this->api->request('POST', '/auth/login', 'phone=1&password=2', ['content-type' => 'application/x-www-form-urlencoded'])
            ->assertStatus(403)->assertErrorCode('csrf_failed');
        $this->api->postJson('/auth/login', ['phone' => '', 'password' => ''])->assertStatus(422)->assertErrorCode('validation_failed');
    }

    #[Endpoint('GET /session')]
    public function test_session_returns_user_permissions_and_a_stable_csrf_token(): void
    {
        $papa = $this->loginAs('papa');
        $a = $papa->get('/session')->assertStatus(200)->assertEnvelope();
        $this->assertSame($papa->csrf, $a->json('data.csrf_token'), 'same token as login: two tabs agree');
        $this->assertSame(['money' => true, 'edit' => true, 'admin' => false, 'owner' => false, 'events_write' => false,
            'trash' => false, 'export' => false, 'activity' => false], $a->json('data.permissions'));
        $this->assertSame('2027-02-14', $a->json('data.settings_brief.wedding_start_date'));

        $nani = $this->loginAs('nani');
        $p = $nani->get('/session')->json('data.permissions');
        $this->assertFalse($p['edit']);
        $this->assertFalse($p['money']);
        $owner = $this->loginAs('ayush')->get('/session')->json('data.permissions');
        $this->assertTrue($owner['owner'] && $owner['admin'] && $owner['money'] && $owner['trash']);

        $this->api->get('/session')->assertStatus(401)->assertErrorCode('not_logged_in');
    }

    #[Endpoint('GET /session')]
    public function test_ac_auth_03_session_slides_90_days(): void
    {
        $papa = $this->loginAs('papa');
        $this->clock->advance('+80 days');
        $res = $papa->get('/session')->assertStatus(200);
        $this->assertStringContainsString('Max-Age=7776000', (string) $res->header('Set-Cookie'), 'cookie re-sent when it slides');
        $this->clock->advance('+80 days'); // 160 days after login, 80 after last use
        $papa->get('/session')->assertStatus(200);
        $this->clock->advance('+91 days');
        $papa->get('/session')->assertStatus(401)->assertErrorCode('not_logged_in');
    }

    #[Endpoint('GET /session')]
    public function test_slide_is_bookkeeping_at_most_hourly(): void
    {
        $papa = $this->loginAs('papa');
        $audit = $this->rows('audit_log');
        $before = $this->row('SELECT last_used_at, expires_at FROM sessions WHERE user_id = 3');
        $this->clock->advance('+20 minutes');
        $this->assertNull($papa->get('/session')->header('Set-Cookie'));
        $this->assertSame($before, $this->row('SELECT last_used_at, expires_at FROM sessions WHERE user_id = 3'));
        $this->clock->advance('+50 minutes');
        $papa->get('/session');
        $this->assertNotSame($before, $this->row('SELECT last_used_at, expires_at FROM sessions WHERE user_id = 3'));
        $this->assertSame($audit, $this->rows('audit_log'), 'no audit row for bookkeeping');
    }

    #[Endpoint('POST /auth/logout')]
    public function test_logout_clears_the_cookie_and_ends_the_session(): void
    {
        $papa = $this->loginAs('papa');
        $token = $papa->cookie();
        $res = $papa->postJson('/auth/logout', null, [], ['idem' => false]);
        $res->assertStatus(200);
        $this->assertStringContainsString('Max-Age=0', (string) $res->header('Set-Cookie'));
        $this->assertNull($papa->cookie());
        $stale = new ApiClient($this->app);
        $stale->cookies['__Host-am_session'] = (string) $token;
        $stale->get('/session')->assertStatus(401)->assertErrorCode('not_logged_in');
        $this->assertSame('logout', $this->db()->value('SELECT revoked_reason FROM sessions WHERE user_id = 3'));
        $this->assertSame(1, $this->rows('audit_log', "action = 'logout' AND user_id = 3"));
    }

    #[Endpoint('POST /auth/logout')]
    public function test_logout_needs_csrf(): void
    {
        $papa = $this->loginAs('papa');
        $papa->postJson('/auth/logout', null, [], ['csrf' => false])->assertStatus(403)->assertErrorCode('csrf_failed');
        $papa->get('/session')->assertStatus(200);
    }

    #[Endpoint('POST /auth/logout-all')]
    public function test_logout_all_revokes_only_my_sessions(): void
    {
        $phone1 = $this->loginAs('papa');
        $phone2 = $this->loginAs('papa', '203.0.113.8');
        $mummy = $this->loginAs('mummy');
        $res = $phone1->postJson('/auth/logout-all', null, [], ['idem' => false])->assertStatus(200);
        $this->assertSame(2, $res->json('data.sessions_revoked'));
        $phone2->get('/session')->assertStatus(401)->assertErrorCode('session_ended');
        $this->assertSame('logout_all', $phone2->get('/session')->json('error.reason') ?? 'logout_all');
        $mummy->get('/session')->assertStatus(200);
    }

    #[Endpoint('POST /auth/password/change')]
    public function test_change_password_rules(): void
    {
        $papa = $this->loginAs('papa');
        $r = $papa->postJson('/auth/password/change', ['current_password' => 'nope-nope', 'new_password' => 'lotus-9911']);
        $r->assertStatus(422)->assertErrorCode('validation_failed');
        $this->assertSame("That isn't your current password.", $r->json('error.fields.current_password'));
        foreach (['abc' => 'short', '9829000103' => 'phone', '+91 98290 00103' => 'phone', 'password' => 'common', 'qwerty123' => 'common'] as $pw => $why) {
            $r = $papa->postJson('/auth/password/change', ['current_password' => 'test-1234', 'new_password' => $pw]);
            $r->assertStatus(422);
            $this->assertNotNull($r->json('error.fields.new_password'), "$why: $pw must be refused");
        }
        $this->assertSame(0, $this->rows('password_resets'), 'nothing changed');
    }

    #[Endpoint('POST /auth/password/change')]
    public function test_ac_set_05_change_password_logs_out_other_phones_and_keeps_this_one(): void
    {
        $phone1 = $this->loginAs('papa');
        $phone2 = $this->loginAs('papa', '203.0.113.8');
        $res = $phone1->postJson('/auth/password/change', ['current_password' => 'test-1234', 'new_password' => 'lotus-9911']);
        $res->assertStatus(200);
        $phone1->csrf = (string) $res->json('data.csrf_token');
        $phone1->get('/session')->assertStatus(200);
        $phone2->get('/session')->assertStatus(401)->assertErrorCode('session_ended');
        $this->assertSame('password_reset', $phone2->get('/session')->json('error.reason') ?? 'password_reset');
        (new ApiClient($this->app))->login('+919829000103', 'test-1234')->assertStatus(401);
        (new ApiClient($this->app))->login('+919829000103', 'lotus-9911')->assertStatus(200);
        $this->assertSame(1, $this->rows('password_resets', "method = 'self_change' AND user_id = 3"));
        $this->assertSame(0, $this->rows('idempotency_keys', 'response_body LIKE ?', ['%csrf_token":"%']), 'secrets never stored');
    }

    #[Endpoint('POST /auth/password-reset/request')]
    public function test_reset_request_always_202_and_sends_nothing(): void
    {
        foreach (['+919829000103', '+919811234567'] as $phone) {
            $this->api->postJson('/auth/password-reset/request', ['phone' => $phone])->assertStatus(202)->assertEnvelope();
        }
        $this->assertSame(0, $this->rows('password_resets'));
        $this->assertSame('', $this->logFile('php-error.log'));
    }
}
