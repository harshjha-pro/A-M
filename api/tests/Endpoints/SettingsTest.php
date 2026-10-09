<?php
declare(strict_types=1);

namespace Tests\Endpoints;

use Tests\Support\ApiTestCase;
use Tests\Support\Endpoint;

/** /settings, /settings/history — FEATURES B10, API.md §6.3. */
final class SettingsTest extends ApiTestCase
{
    #[Endpoint('GET /settings')]
    public function test_everyone_reads_facts_only_money_users_see_the_budget(): void
    {
        $res = $this->loginAs('papa')->get('/settings')->assertStatus(200)->assertEnvelope();
        $this->assertSame('"1"', $res->header('ETag'));
        $this->assertSame('Mahi Jagetiya', $res->json('data.bride_name'));
        $this->assertSame('Asia/Kolkata', $res->json('data.timezone'));
        $this->assertArrayHasKey('total_budget_paise', $res->json('data'));
        foreach (['mummy', 'nani'] as $who) {
            $this->assertArrayNotHasKey('total_budget_paise', $this->loginAs($who)->get('/settings')->json('data'));
        }
    }

    #[Endpoint('PATCH /settings')]
    public function test_ac_set_01_admin_sets_the_budget_and_facts(): void
    {
        $mahi = $this->loginAs('mahi');
        $res = $mahi->patchJson('/settings', ['total_budget_paise' => 400000000, 'city' => '  Bhilwara (Raj.) '], 1);
        $res->assertStatus(200);
        $this->assertSame(400000000, $res->json('data.total_budget_paise'));
        $this->assertSame('Bhilwara (Raj.)', $res->json('data.city'), 'trimmed');
        $this->assertSame(2, $res->json('data.version'));
        $this->assertSame('Mahi', $res->json('data.updated_by.name'));
        $a = $this->row("SELECT * FROM audit_log WHERE entity_type = 'settings' ORDER BY id DESC LIMIT 1");
        $this->assertSame(2, (int) $a['entity_version']);
        $this->assertSame(2, (int) $a['user_id']);
        $this->assertNull(json_decode($a['before_json'], true)['total_budget_paise']);
    }

    #[Endpoint('PATCH /settings')]
    public function test_ac_set_02_family_and_viewers_cannot_edit(): void
    {
        foreach (['papa', 'mummy', 'nani'] as $who) {
            $this->loginAs($who)->patchJson('/settings', ['city' => 'Udaipur'], 1)->assertStatus(403);
        }
        $this->loginAs('mummy')->patchJson('/settings', ['total_budget_paise' => 1], 1)->assertStatus(403); // SEC-12
        $this->assertSame(1, (int) $this->db()->value('SELECT version FROM settings'));
    }

    #[Endpoint('PATCH /settings')]
    public function test_ac_set_07_and_other_rules(): void
    {
        $ayush = $this->loginAs('ayush');
        $r = $ayush->patchJson('/settings', ['wedding_end_date' => '2027-02-13'], 1)->assertStatus(422);
        $this->assertSame('End date must be on or after the start date.', $r->json('error.fields.wedding_end_date'));
        $r = $ayush->patchJson('/settings', ['timezone' => 'UTC', 'currency' => 'USD', 'city' => '', 'total_budget_paise' => 12.5], 1)->assertStatus(422);
        $this->assertEqualsCanonicalizing(['timezone', 'currency', 'city', 'total_budget_paise'], array_keys($r->json('error.fields')));
        $ayush->patchJson('/settings', [], 1)->assertStatus(422);
        $ayush->request('PATCH', '/settings', '{"city":"Udaipur"}')->assertStatus(428)->assertErrorCode('version_required');
    }

    #[Endpoint('PATCH /settings')]
    public function test_no_change_is_not_a_new_version(): void
    {
        $res = $this->loginAs('ayush')->patchJson('/settings', ['city' => 'Bhilwara'], 1)->assertStatus(200);
        $this->assertSame(1, $res->json('data.version'));
        $this->assertSame(0, $this->rows('audit_log', "entity_type = 'settings'"));
    }

    #[Endpoint('PATCH /settings')]
    public function test_ds02_two_admins_edit_different_fields(): void
    {
        $ayush = $this->loginAs('ayush');
        $mahi = $this->loginAs('mahi');
        $ayush->patchJson('/settings', ['city' => 'Udaipur'], 1)->assertStatus(200);
        $c = $mahi->patchJson('/settings', ['wedding_start_date' => '2027-02-13'], 1)->assertStatus(409);
        $this->assertSame(['city'], $c->json('error.changed_fields'));
        // The phone merges: city was only theirs, start date only mine → resend mine on the new version.
        $mahi->patchJson('/settings', ['wedding_start_date' => '2027-02-13'], (int) $c->json('error.current_version'))->assertStatus(200);
        $s = $this->row('SELECT city, wedding_start_date, version FROM settings');
        $this->assertSame(['city' => 'Udaipur', 'wedding_start_date' => '2027-02-13', 'version' => 3], $s);
    }

    #[Endpoint('GET /settings/history')]
    public function test_history_in_plain_sentences_with_cursor_paging(): void
    {
        $ayush = $this->loginAs('ayush');
        $ayush->patchJson('/settings', ['city' => 'Udaipur'], 1)->assertStatus(200);
        $this->clock->advance('+1 minute');
        $ayush->patchJson('/settings', ['city' => 'Bhilwara', 'wedding_end_date' => '2027-02-17'], 2)->assertStatus(200);
        $this->clock->advance('+1 minute');
        $ayush->patchJson('/settings', ['total_budget_paise' => 400000000], 3)->assertStatus(200);

        $page1 = $ayush->get('/settings/history', ['limit' => '2'])->assertStatus(200)->assertEnvelope();
        $this->assertSame(['Ayush changed Total budget from (empty) to ₹40,00,000.', 'Ayush changed End date and City.'], array_column($page1->json('data'), 'sentence'));
        $this->assertTrue($page1->json('meta.has_more'));
        $this->assertSame(['field' => 'city', 'label' => 'City', 'from' => 'Udaipur', 'to' => 'Bhilwara'], $page1->json('data.1.changes.1'));
        $page2 = $ayush->get('/settings/history', ['limit' => '2', 'cursor' => (string) $page1->json('meta.next_cursor')])->assertStatus(200);
        $this->assertSame(['Ayush changed City from Bhilwara to Udaipur.'], array_column($page2->json('data'), 'sentence'));
        $this->assertFalse($page2->json('meta.has_more'));

        $ayush->get('/settings/history', ['cursor' => 'garbage'])->assertStatus(400)->assertErrorCode('bad_cursor');
        $ayush->get('/settings/history', ['limit' => '500'])->assertStatus(400);
        $this->loginAs('papa')->get('/settings/history')->assertStatus(403);
    }
}
