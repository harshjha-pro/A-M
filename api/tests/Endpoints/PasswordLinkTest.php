<?php
declare(strict_types=1);

namespace Tests\Endpoints;

use Tests\Support\ApiClient;
use Tests\Support\ApiTestCase;
use Tests\Support\Endpoint;

/** Invite / reset by a one-time link (API.md §3.5). */
final class PasswordLinkTest extends ApiTestCase
{
    /** Ayush invites Sunita by link; returns the token from the #fragment. */
    private function invite(string $name = 'Sunita Porwal', string $phone = '9829012345'): string
    {
        $res = $this->loginAs('ayush')->postJson('/members', [
            'name' => $name, 'phone' => $phone, 'role' => 'family', 'password_mode' => 'link',
        ]);
        $res->assertStatus(201);
        $link = (string) $res->json('data.setup_link');
        $this->assertStringStartsWith('https://wedding.lumorrahouse.com/set-password#t=', $link);
        return substr($link, strpos($link, '#t=') + 3);
    }

    #[Endpoint('POST /auth/password-link/inspect')]
    public function test_inspect_shows_who_without_revealing_the_number(): void
    {
        $token = $this->invite();
        $res = $this->api->postJson('/auth/password-link/inspect', ['token' => $token]);
        $res->assertStatus(200)->assertEnvelope();
        $this->assertSame('invite', $res->json('data.purpose'));
        $this->assertSame('Sunita Porwal', $res->json('data.name'));
        $this->assertSame('+91 98••• ••345', $res->json('data.phone_masked'));
        $this->assertSame('2026-10-11T09:12:31Z', $res->json('data.expires_at'), '72 hours');
        $this->assertStringNotContainsString('9829012345', $res->body());
    }

    #[Endpoint('POST /auth/password-link/complete')]
    public function test_complete_sets_the_password_logs_in_and_burns_the_link(): void
    {
        $token = $this->invite();
        $sunita = new ApiClient($this->app);
        $bad = $sunita->postJson('/auth/password-link/complete', ['token' => $token, 'new_password' => '9829012345']);
        $bad->assertStatus(422);
        $this->assertSame('Choose at least 6 letters or numbers. Not your phone number.', $bad->json('error.fields.new_password'));

        $res = $sunita->postJson('/auth/password-link/complete', ['token' => $token, 'new_password' => 'gulab-2233']);
        $res->assertStatus(200);
        $this->assertStringContainsString('__Host-am_session=', (string) $res->header('Set-Cookie'));
        $sunita->csrf = (string) $res->json('data.csrf_token');
        $this->assertSame('Sunita Porwal', $sunita->get('/session')->json('data.user.name'));
        $this->assertFalse($res->json('data.user.must_change_password'));

        $this->api->postJson('/auth/password-link/complete', ['token' => $token, 'new_password' => 'gulab-9999'])
            ->assertStatus(410)->assertErrorCode('link_invalid');
        $this->api->postJson('/auth/password-link/inspect', ['token' => $token])->assertStatus(410);
        (new ApiClient($this->app))->login('9829012345', 'gulab-2233')->assertStatus(200);
    }

    #[Endpoint('POST /auth/password-link/inspect')]
    public function test_expired_cancelled_and_garbage_links_are_410(): void
    {
        $old = $this->invite();
        // A new link for the same person cancels the old one.
        $id = (string) $this->db()->value("SELECT public_id FROM users WHERE phone = '+919829012345'");
        $new = $this->loginAs('ayush')->postJson("/members/$id/password-reset", ['mode' => 'link'])->assertStatus(200);
        $this->api->postJson('/auth/password-link/inspect', ['token' => $old])->assertStatus(410)->assertErrorCode('link_invalid');
        $newToken = substr((string) $new->json('data.setup_link'), strpos((string) $new->json('data.setup_link'), '#t=') + 3);
        $this->api->postJson('/auth/password-link/inspect', ['token' => $newToken])->assertStatus(200);

        $this->clock->advance('+73 hours');
        $this->api->postJson('/auth/password-link/inspect', ['token' => $newToken])->assertStatus(410);
        $this->api->postJson('/auth/password-link/inspect', ['token' => 'short'])->assertStatus(410);
        $this->api->postJson('/auth/password-link/inspect', ['token' => str_repeat('A', 43)])->assertStatus(410);
        $this->api->postJson('/auth/password-link/inspect', [])->assertStatus(410);
    }

    #[Endpoint('POST /auth/password-link/complete')]
    public function test_a_link_works_on_a_phone_where_someone_is_already_logged_in(): void
    {
        $token = $this->invite();
        $phone = $this->loginAs('ayush'); // Ayush opens Sunita's link on his own phone (no CSRF token on that page)
        $phone->csrf = null;
        $phone->postJson('/auth/password-link/inspect', ['token' => $token])->assertStatus(200);
        $phone->postJson('/auth/password-link/complete', ['token' => $token, 'new_password' => 'gulab-2233'])->assertStatus(200);
        $this->assertSame('Sunita Porwal', $phone->get('/session')->json('data.user.name'), 'the phone is now Sunita');
        // …and the Origin check still applies to logged-in phones.
        $this->loginAs('ayush')->postJson('/auth/login', ['phone' => '+919829000102', 'password' => 'test-1234'], ['origin' => 'https://evil.example'])
            ->assertStatus(403)->assertErrorCode('csrf_failed');
    }

    #[Endpoint('POST /auth/password-link/inspect')]
    public function test_link_of_a_deactivated_member_is_dead(): void
    {
        $token = $this->invite();
        $this->db()->run("UPDATE users SET is_active = 0 WHERE phone = '+919829012345'");
        $this->api->postJson('/auth/password-link/inspect', ['token' => $token])->assertStatus(410);
    }

    #[Endpoint('POST /auth/password-link/complete')]
    public function test_sec21_ten_tries_per_15_minutes(): void
    {
        for ($i = 0; $i < 10; $i++) {
            $this->api->postJson('/auth/password-link/inspect', ['token' => str_repeat('x', 43)]);
        }
        $this->api->postJson('/auth/password-link/complete', ['token' => str_repeat('x', 43), 'new_password' => 'gulab-2233'])->assertStatus(429);
    }

    #[Endpoint('POST /auth/password-link/complete')]
    public function test_complete_from_a_reset_link_logs_out_old_phones(): void
    {
        $papa = $this->loginAs('papa');
        $res = $this->loginAs('ayush')->postJson('/members/' . $this->pid('papa') . '/password-reset', ['mode' => 'link'])->assertStatus(200);
        $papa->get('/session')->assertStatus(401)->assertErrorCode('session_ended');
        $token = substr((string) $res->json('data.setup_link'), strpos((string) $res->json('data.setup_link'), '#t=') + 3);
        $this->assertSame('reset', $this->api->postJson('/auth/password-link/inspect', ['token' => $token])->json('data.purpose'));
        $this->api->postJson('/auth/password-link/complete', ['token' => $token, 'new_password' => 'kamal-5150'])->assertStatus(200);
    }
}
