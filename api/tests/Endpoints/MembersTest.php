<?php
declare(strict_types=1);

namespace Tests\Endpoints;

use Tests\Support\ApiClient;
use Tests\Support\ApiTestCase;
use Tests\Support\Endpoint;

/** /members… and /me/sessions — FEATURES B1, API.md §6.2, TESTING §1.3. */
final class MembersTest extends ApiTestCase
{
    private function add(ApiClient $as, array $over = [], array $opts = []): \Tests\Support\TestResponse
    {
        return $as->postJson('/members', $over + ['name' => 'Sunita Porwal', 'phone' => '98290 12345', 'role' => 'family', 'password_mode' => 'generate'], [], $opts);
    }

    #[Endpoint('GET /members')]
    public function test_admins_see_everything_family_and_viewers_see_names_and_phones(): void
    {
        $full = $this->loginAs('mahi')->get('/members')->assertStatus(200)->assertEnvelope();
        $this->assertSame(['Ayush', 'Mahi', 'Mummy', 'Papa', 'Nani'], array_column($full->json('data'), 'name'), 'owner, partner, family, viewer');
        $this->assertArrayHasKey('can_see_money', $full->json('data.0'));
        $this->assertArrayHasKey('last_seen_at', $full->json('data.0'));
        $this->assertSame(5, $full->json('meta.total'));

        foreach (['papa', 'nani'] as $who) {
            $rows = $this->loginAs($who)->get('/members')->assertStatus(200)->json('data');
            foreach ($rows as $r) {
                $this->assertSame(['id', 'name', 'phone', 'role', 'left'], array_keys($r));
            }
        }
        $this->loginAs('papa')->get('/members', ['include_inactive' => 'true'])->assertStatus(403);
        $this->loginAs('papa')->get('/members', ['include_inactive' => 'maybe'])->assertStatus(400);
    }

    #[Endpoint('GET /members')]
    public function test_inactive_members_only_with_include_inactive(): void
    {
        $this->db()->run('UPDATE users SET is_active = 0 WHERE id = 4');
        $mahi = $this->loginAs('mahi');
        $this->assertNotContains('Mummy', array_column($mahi->get('/members')->json('data'), 'name'));
        $all = $mahi->get('/members', ['include_inactive' => 'true'])->json('data');
        $mummy = array_values(array_filter($all, fn ($m) => $m['name'] === 'Mummy'))[0];
        $this->assertTrue($mummy['left']);
        $this->assertFalse($mummy['is_active']);
    }

    #[Endpoint('POST /members')]
    public function test_add_with_a_made_up_password_shown_once(): void
    {
        $res = $this->add($this->loginAs('ayush'));
        $res->assertStatus(201)->assertEnvelope();
        $this->assertSame('+919829012345', $res->json('data.member.phone'));
        $this->assertSame(1, $res->json('data.member.version'));
        $this->assertFalse($res->json('data.member.can_see_money'));
        $pw = (string) $res->json('data.password_once');
        $this->assertMatchesRegularExpression('/^[a-z]+-\d{4}$/', $pw, 'easy to read out: rose-4821');
        (new ApiClient($this->app))->login('9829012345', $pw)->assertStatus(200); // AC-AUTH-01
        $stored = (string) $this->db()->value('SELECT response_body FROM idempotency_keys ORDER BY id DESC LIMIT 1');
        $this->assertStringNotContainsString($pw, $stored, 'the password is never stored in the replay');
        $this->assertSame(1, $this->rows('audit_log', "action = 'create' AND entity_type = 'user'"));
        $this->assertStringNotContainsString('password_hash', (string) $this->db()->value("SELECT after_json FROM audit_log WHERE action = 'create'"));
    }

    #[Endpoint('POST /members')]
    public function test_add_with_a_typed_password_and_partner_always_sees_money(): void
    {
        $res = $this->add($this->loginAs('ayush'), ['role' => 'partner', 'password_mode' => 'set', 'password' => 'chandan-77', 'can_see_money' => false]);
        $res->assertStatus(201);
        $this->assertTrue($res->json('data.member.can_see_money'));
        $this->assertArrayNotHasKey('password_once', $res->json('data'));
        $this->assertSame(1, $this->rows('password_resets', "method = 'admin_set'"));
    }

    #[Endpoint('POST /members')]
    public function test_add_rules(): void
    {
        $ayush = $this->loginAs('ayush');
        $dup = $this->add($ayush, ['phone' => '+91 98290 00104']);
        $dup->assertStatus(409)->assertErrorCode('duplicate_found');
        $this->assertSame('Already a member: Mummy.', $dup->json('error.message'));
        $this->assertSame('Mummy', $dup->json('error.matches.0.name'));

        $this->add($ayush, ['role' => 'owner'])->assertStatus(403);
        $this->add($this->loginAs('papa'))->assertStatus(403);
        $this->add($this->loginAs('nani'))->assertStatus(403);

        $r = $this->add($ayush, ['name' => '', 'phone' => '01482 230456', 'role' => 'cousin', 'access_ends_on' => '2026-10-01', 'password_mode' => 'set', 'password' => '12']);
        $r->assertStatus(422);
        $this->assertSame(['name', 'phone', 'role', 'access_ends_on', 'password'], array_keys($r->json('error.fields')));
        $this->assertSame('Please fix 5 things below.', $r->json('error.message'));
        $this->assertNotNull($this->add($ayush, ['nickname' => 'x'])->assertStatus(422)->json('error.fields.nickname'));
        $this->assertSame(5, $this->rows('users'), 'nothing added');
    }

    #[Endpoint('POST /members')]
    public function test_a_deactivated_members_phone_can_be_reused(): void
    {
        $this->db()->run('UPDATE users SET is_active = 0 WHERE id = 4');
        $this->add($this->loginAs('ayush'), ['phone' => '9829000104'])->assertStatus(201);
    }

    #[Endpoint('POST /members')]
    public function test_ds04_retry_with_the_same_key_never_makes_two_and_gives_a_fresh_link(): void
    {
        $ayush = $this->loginAs('ayush');
        $key = '3b2f7c1e-8f8a-4d55-9a2e-1c0b6f1d9a77';
        $first = $this->add($ayush, ['password_mode' => 'link'], ['idem' => $key])->assertStatus(201);
        $second = $this->add($ayush, ['password_mode' => 'link'], ['idem' => $key])->assertStatus(201);
        $this->assertSame('true', $second->header('Idempotent-Replayed'));
        $this->assertSame($first->json('data.member.id'), $second->json('data.member.id'));
        $this->assertNotSame($first->json('data.setup_link'), $second->json('data.setup_link'), 'a fresh link; the lost one is cancelled');
        $this->assertSame(1, $this->rows('users', "phone = '+919829012345'"));
        $oldToken = substr((string) $first->json('data.setup_link'), strpos((string) $first->json('data.setup_link'), '#t=') + 3);
        $this->api->postJson('/auth/password-link/inspect', ['token' => $oldToken])->assertStatus(410);

        // DS-06: same key, different body
        $this->add($ayush, ['password_mode' => 'link', 'name' => 'Someone Else'], ['idem' => $key])
            ->assertStatus(422)->assertErrorCode('idempotency_key_reused');
    }

    #[Endpoint('POST /members')]
    public function test_ds08_after_48_hours_the_client_uuid_still_prevents_a_duplicate(): void
    {
        $ayush = $this->loginAs('ayush');
        $key = 'a1b2c3d4-0000-4000-8000-000000000001';
        $this->add($ayush, ['password_mode' => 'set', 'password' => 'gulab-1234'], ['idem' => $key])->assertStatus(201);
        $this->clock->advance('+49 hours');
        $ayush = $this->loginAs('ayush'); // the session is still fine, but a fresh login is simpler with the moved clock
        $res = $this->add($ayush, ['password_mode' => 'set', 'password' => 'gulab-1234'], ['idem' => $key]);
        $res->assertStatus(200);
        $this->assertSame(1, $this->rows('users', "phone = '+919829012345'"));
    }

    #[Endpoint('POST /members')]
    public function test_ds09_a_refused_request_frees_its_key(): void
    {
        $ayush = $this->loginAs('ayush');
        $key = 'a1b2c3d4-0000-4000-8000-000000000002';
        $this->add($ayush, ['phone' => '123'], ['idem' => $key])->assertStatus(422);
        $this->assertSame(0, $this->rows('idempotency_keys', 'idem_key = ?', [$key]));
        $this->add($ayush, [], ['idem' => $key])->assertStatus(201);
    }

    #[Endpoint('GET /members/{id}')]
    public function test_get_one_member(): void
    {
        $papa = $this->loginAs('papa');
        $me = $papa->get('/members/' . $this->pid('papa'))->assertStatus(200);
        $this->assertSame('"1"', $me->header('ETag'));
        $this->assertSame('Android · browser', $me->json('data.devices.0.device_label'));
        $papa->get('/members/' . $this->pid('mummy'))->assertStatus(403);
        $this->loginAs('mahi')->get('/members/' . $this->pid('mummy'))->assertStatus(200);
        $papa->get('/members/3')->assertStatus(404)->assertErrorCode('not_found'); // SEC-04
        $papa->get('/members/01JA6ZA0000000000000000999')->assertStatus(404);
    }

    #[Endpoint('PATCH /members/{id}')]
    public function test_anyone_may_rename_themselves_but_nothing_else(): void
    {
        $papa = $this->loginAs('papa');
        $res = $papa->patchJson('/members/' . $this->pid('papa'), ['name' => 'Rajendra Porwal (Papa)'], 1);
        $res->assertStatus(200);
        $this->assertSame(2, $res->json('data.version'));
        $this->assertSame('"2"', $res->header('ETag'));
        $papa->patchJson('/members/' . $this->pid('papa'), ['role' => 'partner'], 2)->assertStatus(403);
        $papa->patchJson('/members/' . $this->pid('papa'), ['can_see_money' => true], 2)->assertStatus(403);
        $papa->patchJson('/members/' . $this->pid('mummy'), ['name' => 'X'], 1)->assertStatus(403);
        $this->loginAs('nani')->patchJson('/members/' . $this->pid('nani'), ['name' => 'Nani ji'], 1)->assertStatus(200);
        $audit = $this->row("SELECT * FROM audit_log WHERE entity_type = 'user' AND entity_id = 3 AND action = 'update'");
        $this->assertSame(2, (int) $audit['entity_version']);
        $this->assertSame('Papa', json_decode($audit['before_json'], true)['name']);
        $this->assertSame('Rajendra Porwal (Papa)', json_decode($audit['after_json'], true)['name']);
    }

    #[Endpoint('PATCH /members/{id}')]
    public function test_sec11_the_owner_cannot_be_demoted_or_deactivated(): void
    {
        $mahi = $this->loginAs('mahi');
        $mahi->patchJson('/members/' . $this->pid('ayush'), ['role' => 'family'], 1)->assertStatus(403);
        $mahi->patchJson('/members/' . $this->pid('ayush'), ['is_active' => false], 1)->assertStatus(403);
        $ayush = $this->loginAs('ayush');
        $ayush->patchJson('/members/' . $this->pid('ayush'), ['is_active' => false], 1)->assertStatus(403);
        $ayush->patchJson('/members/' . $this->pid('mummy'), ['role' => 'owner'], 1)->assertStatus(403);
        // Partner can fix the Owner's name; resending the Owner's own role unchanged is fine.
        $mahi->patchJson('/members/' . $this->pid('ayush'), ['name' => 'Ayush Porwal', 'role' => 'owner'], 1)->assertStatus(403);
        $mahi->patchJson('/members/' . $this->pid('ayush'), ['name' => 'Ayush Porwal'], 1)->assertStatus(200);
        $this->assertSame('owner', $this->db()->value('SELECT role FROM users WHERE id = 1'));
    }

    #[Endpoint('PATCH /members/{id}')]
    public function test_sec23_deactivating_logs_the_member_out_at_once(): void
    {
        $mummy = $this->loginAs('mummy');
        $res = $this->loginAs('ayush')->patchJson('/members/' . $this->pid('mummy'), ['is_active' => false], 1);
        $res->assertStatus(200);
        $this->assertTrue($res->json('data.left'));
        $r = $mummy->get('/session')->assertStatus(401)->assertErrorCode('session_ended');
        $this->assertSame('deactivated', $r->json('error.reason'));
        $this->assertSame(1, $this->rows('audit_log', "action = 'role_change' AND entity_id = 4"));
        (new ApiClient($this->app))->login('+919829000104')->assertStatus(403)->assertErrorCode('access_ended');
    }

    #[Endpoint('PATCH /members/{id}')]
    public function test_sec13_money_off_applies_on_the_very_next_request(): void
    {
        $papa = $this->loginAs('papa');
        $this->assertArrayHasKey('total_budget_paise', $papa->get('/settings')->json('data'));
        $this->loginAs('ayush')->patchJson('/members/' . $this->pid('papa'), ['can_see_money' => false], 1)->assertStatus(200);
        $this->assertArrayNotHasKey('total_budget_paise', $papa->get('/settings')->json('data'));
        $this->assertFalse($papa->get('/session')->json('data.permissions.money'));
    }

    #[Endpoint('PATCH /members/{id}')]
    public function test_access_end_date_logs_out_after_that_day(): void
    {
        $papa = $this->loginAs('papa');
        $this->loginAs('ayush')->patchJson('/members/' . $this->pid('papa'), ['access_ends_on' => '2026-10-08'], 1)->assertStatus(200);
        $papa->get('/session')->assertStatus(200);
        $this->clock->set('2026-10-08T18:31:00Z'); // 9 Oct, 00:01 IST
        $this->assertSame('access_ended', $papa->get('/session')->assertStatus(401)->json('error.reason'));
    }

    #[Endpoint('PATCH /members/{id}')]
    public function test_partner_role_forces_money_and_admins_keep_money(): void
    {
        $ayush = $this->loginAs('ayush');
        $res = $ayush->patchJson('/members/' . $this->pid('mummy'), ['role' => 'partner'], 1)->assertStatus(200);
        $this->assertTrue($res->json('data.can_see_money'));
        $r = $ayush->patchJson('/members/' . $this->pid('mahi'), ['can_see_money' => false], 1)->assertStatus(422);
        $this->assertSame('Ayush, Mahi and partners always see money.', $r->json('error.fields.can_see_money'));
    }

    #[Endpoint('PATCH /members/{id}')]
    public function test_phone_change_is_normalised_and_checked_for_duplicates(): void
    {
        $ayush = $this->loginAs('ayush');
        $ayush->patchJson('/members/' . $this->pid('papa'), ['phone' => '9829000104'], 1)->assertStatus(409)->assertErrorCode('duplicate_found');
        $this->assertSame('+919829055555', $ayush->patchJson('/members/' . $this->pid('papa'), ['phone' => '098290-55555'], 1)->json('data.phone'));
    }

    #[Endpoint('PATCH /members/{id}')]
    public function test_ds01_stale_version_gives_409_and_changes_nothing(): void
    {
        $ayush = $this->loginAs('ayush');
        $mahi = $this->loginAs('mahi');
        $ayush->patchJson('/members/' . $this->pid('papa'), ['name' => 'Papa ji'], 1)->assertStatus(200);
        $before = $this->row('SELECT * FROM users WHERE id = 3');
        $audit = $this->rows('audit_log');

        $res = $mahi->patchJson('/members/' . $this->pid('papa'), ['can_see_money' => false, 'name' => 'Rajendra'], 1);
        $res->assertStatus(409)->assertErrorCode('version_conflict');
        $this->assertSame(2, $res->json('error.current_version'));
        $this->assertSame(1, $res->json('error.your_version'));
        $this->assertSame(['name'], $res->json('error.changed_fields'));
        $this->assertSame('Ayush', $res->json('error.changed_by.name'));
        $this->assertSame('Papa ji', $res->json('error.current.name'));
        $this->assertSame('Ayush changed this at 2:42 PM while you were editing.', $res->json('error.message'));
        $this->assertSame($before, $this->row('SELECT * FROM users WHERE id = 3'));
        $this->assertSame($audit, $this->rows('audit_log'));
        $this->assertSame(0, $this->rows('idempotency_keys', 'idem_key = ?', [$mahi->lastIdemKey]), 'key released');
    }

    #[Endpoint('PATCH /members/{id}')]
    public function test_s6_missing_if_match_is_428(): void
    {
        $this->loginAs('ayush')->request('PATCH', '/members/' . $this->pid('papa'), '{"name":"X"}')
            ->assertStatus(428)->assertErrorCode('version_required');
    }

    #[Endpoint('PATCH /members/{id}')]
    public function test_ds05_a_retried_edit_is_a_replay_not_a_false_conflict(): void
    {
        $ayush = $this->loginAs('ayush');
        $key = 'a1b2c3d4-0000-4000-8000-000000000003';
        $ayush->patchJson('/members/' . $this->pid('papa'), ['name' => 'Papa ji'], 1, ['idem' => $key])->assertStatus(200);
        $again = $ayush->patchJson('/members/' . $this->pid('papa'), ['name' => 'Papa ji'], 1, ['idem' => $key]);
        $again->assertStatus(200);
        $this->assertSame('true', $again->header('Idempotent-Replayed'));
        $this->assertSame(2, $this->memberVersion('papa'), 'bumped once');
    }

    #[Endpoint('POST /members/{id}/password-reset')]
    public function test_admin_reset_logs_out_the_member_and_shows_the_password_once(): void
    {
        $papa = $this->loginAs('papa');
        $res = $this->loginAs('mahi')->postJson('/members/' . $this->pid('papa') . '/password-reset', ['mode' => 'generate']);
        $res->assertStatus(200);
        $this->assertSame(1, $res->json('data.sessions_revoked'));
        $pw = (string) $res->json('data.password_once');
        $r = $papa->get('/session')->assertStatus(401)->assertErrorCode('session_ended'); // AC-AUTH-04
        $this->assertSame('password_reset', $r->json('error.reason'));
        (new ApiClient($this->app))->login('+919829000103', $pw)->assertStatus(200);
        (new ApiClient($this->app))->login('+919829000103', 'test-1234')->assertStatus(401);
        $this->assertSame(1, $this->rows('password_resets', "method = 'admin_generated' AND user_id = 3 AND reset_by = 2"));
        $this->assertSame(0, $this->rows('idempotency_keys', 'response_body LIKE ?', ["%$pw%"]));
    }

    #[Endpoint('POST /members/{id}/password-reset')]
    public function test_reset_rules(): void
    {
        $mahi = $this->loginAs('mahi');
        $mahi->postJson('/members/' . $this->pid('ayush') . '/password-reset', ['mode' => 'generate'])->assertStatus(403);
        $mahi->postJson('/members/' . $this->pid('mahi') . '/password-reset', ['mode' => 'generate'])->assertStatus(403);
        $this->loginAs('papa')->postJson('/members/' . $this->pid('mummy') . '/password-reset', ['mode' => 'generate'])->assertStatus(403);
        $this->loginAs('ayush')->postJson('/members/' . $this->pid('mahi') . '/password-reset', ['mode' => 'set', 'password' => 'heera-4040'])->assertStatus(200);
        $mahi->get('/session')->assertStatus(401);
        $this->loginAs('ayush')->postJson('/members/' . $this->pid('papa') . '/password-reset', ['mode' => 'set', 'password' => '9829000103'])->assertStatus(422);
        $this->loginAs('ayush')->postJson('/members/01JA6ZA0000000000000000999/password-reset', ['mode' => 'generate'])->assertStatus(404);
    }

    #[Endpoint('GET /me/sessions')]
    public function test_my_phones(): void
    {
        $this->loginAs('papa', '203.0.113.9');
        $papa = $this->loginAs('papa');
        $rows = $papa->get('/me/sessions')->assertStatus(200)->json('data');
        $this->assertCount(2, $rows);
        $this->assertSame([true], array_values(array_filter(array_column($rows, 'current'))));
        $this->assertSame(['device_label', 'last_used_at', 'current'], array_keys($rows[0]));
    }
}
