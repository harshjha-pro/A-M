<?php
declare(strict_types=1);

namespace Tests\Endpoints;

use Tests\Support\ApiClient;
use AM\Modules\Guests\HouseholdDef;
use Tests\Support\ApiTestCase;
use Tests\Support\Endpoint;
use Tests\Support\TestResponse;

/**
 * /households… and invitations — FEATURES B5, API.md §6.7, TESTING §1.3 guest rows,
 * DS-01/02/04/06/11/16, SEC-04/06/07/10 for families. Frozen clock: Thu 8 Oct 2026, 2:42 PM IST.
 */
final class GuestsTest extends ApiTestCase
{
    private const MEHNDI = '01M4DK5T3E6QZBMNQ0V7KQWW23';
    private const HALDI = '01M4DK5T3D9GHKDKJRDJRR373Z';
    private const WEDDING = '01M4DK5T3H1KPRF5DMTQJ2GCYG';

    private function add(ApiClient $c, array $data): TestResponse
    {
        return $c->postJson('/households', $data + ['side' => 'bride']);
    }

    private function put(ApiClient $c, string $fam, string $event, mixed $body = null): TestResponse
    {
        return $c->request('PUT', "/households/$fam/invitations/$event", json_encode($body ?? new \stdClass()));
    }

    private function del(ApiClient $c, string $path, int $v): TestResponse
    {
        return $c->request('DELETE', $path, null, [], [], ['ifMatch' => $v]);
    }

    #[Endpoint('POST /households')]
    public function test_add_family_with_invitations_defaults_and_rules(): void
    {
        $mummy = $this->loginAs('mummy');
        $res = $this->add($mummy, [
            'name' => 'Ramesh Sharma & family', 'phone' => '098290 12345', 'group_name' => 'Papa office', 'area' => 'Shastri Nagar',
            'invite_event_ids' => [self::MEHNDI, self::WEDDING],
        ])->assertStatus(201)->assertEnvelope();
        $d = $res->json('data');
        $this->assertSame('+919829012345', $d['phone']);
        $this->assertSame(['adults' => 2, 'children' => 0, 'people' => 3 - 1, 'food' => 'veg', 'city' => 'Bhilwara'],
            ['adults' => $d['adults'], 'children' => $d['children'], 'people' => $d['people'], 'food' => $d['food'], 'city' => $d['city']]);
        $this->assertSame(['Mehndi', 'Wedding'], array_column(array_column($d['invitations'], 'event'), 'name'));
        $this->assertSame('not_asked', $d['invitations'][0]['rsvp']);
        $this->assertSame('ramesh sharma', $this->row('SELECT name_norm FROM households WHERE public_id = ?', [$d['id']])['name_norm']);
        // Activity: one line for the family; its invitations ride quietly in a batch.
        $lines = array_column($this->loginAs('ayush')->get('/activity')->json('data'), 'sentence');
        $this->assertSame('Mummy added Ramesh Sharma & family.', $lines[1], 'after "Ayush logged in."');
        $this->assertNotContains('Mummy invited Ramesh Sharma & family to Mehndi.', $lines);

        $bad = $this->add($mummy, ['name' => '', 'side' => 'aunt', 'adults' => 0, 'children' => 0, 'food' => 'nonveg', 'phone' => '12345']);
        $bad->assertStatus(422);
        $this->assertEqualsCanonicalizing(['name', 'side', 'food', 'phone', 'adults'], array_keys($bad->json('error.fields')));
        $this->add($mummy, ['name' => 'Mixed family', 'food' => 'mixed', 'adults' => 2, 'jain_count' => 3])->assertStatus(422);
        $jain = $this->add($mummy, ['name' => 'Jain family', 'food' => 'jain', 'adults' => 3, 'children' => 1])->assertStatus(201);
        $this->assertSame(4, $jain->json('data.jain_count'), 'all-Jain family: everyone counts as Jain');
        $this->add($mummy, ['name' => 'X', 'invite_event_ids' => ['01JA7Q3M2K8V5R1T9W4X6Y0Z2B']])->assertStatus(422);
        $this->add($this->loginAs('nani'), ['name' => 'Viewer family'])->assertStatus(403);
        // DS-04
        $key = '5b1f0b52-3a2d-4c1e-9f00-0000000008a1';
        $a = $mummy->postJson('/households', ['name' => 'Gupta ji', 'side' => 'groom'], [], ['idem' => $key])->assertStatus(201);
        $b = $mummy->postJson('/households', ['name' => 'Gupta ji', 'side' => 'groom'], [], ['idem' => $key])->assertStatus(201);
        $this->assertSame($a->json('data'), $b->json('data'));
        $this->assertSame(1, $this->rows('households', "name = 'Gupta ji'"));
    }

    #[Endpoint('POST /households')]
    public function test_duplicate_phone_409_with_matches_and_allow_duplicate(): void
    {
        $this->add($this->loginAs('mummy'), ['name' => 'Sharma family', 'phone' => '9829012345', 'side' => 'groom'])->assertStatus(201);
        $papa = $this->loginAs('papa');
        $dup = $this->add($papa, ['name' => 'Ramesh Sharma', 'alt_phone' => '+91 98290 12345'])->assertStatus(409)->assertErrorCode('duplicate_found');
        $this->assertSame("Already on the list: Sharma family (Groom's side, added by Mummy)", $dup->json('error.message'));
        $this->assertSame(['name' => 'Sharma family', 'side' => 'groom', 'phone' => '+919829012345', 'match_on' => 'phone'],
            array_intersect_key($dup->json('error.matches.0'), array_flip(['name', 'side', 'phone', 'match_on'])));
        $this->assertSame(1, $this->rows('households'));
        $this->add($papa, ['name' => 'Ramesh Sharma', 'alt_phone' => '+91 98290 12345', 'allow_duplicate' => true])->assertStatus(201);
        $list = $papa->get('/households', ['possible_duplicates' => 'true'])->json('data');
        $this->assertCount(2, $list);
        $this->assertTrue($list[0]['possible_duplicate']);
    }

    #[Endpoint('GET /households/duplicate-check')]
    public function test_duplicate_check_hints_phone_and_name_city(): void
    {
        $mummy = $this->loginAs('mummy');
        $id = $this->add($mummy, ['name' => 'Prakash Porwal (Mama ji)', 'phone' => '9829012345'])->json('data.id');
        $r = $mummy->get('/households/duplicate-check', ['phone' => '09829012345', 'name' => 'prakash porwal mama', 'city' => 'Bhilwara'])->assertStatus(200);
        $this->assertSame('phone', $r->json('data.phone_matches.0.match_on'));
        $this->assertSame('name_city', $r->json('data.name_matches.0.match_on'));
        $this->assertSame('Mummy', $r->json('data.name_matches.0.added_by.name'));
        $none = $mummy->get('/households/duplicate-check', ['phone' => '9829012345', 'exclude' => $id])->json('data');
        $this->assertSame(['phone_matches' => [], 'name_matches' => []], $none);
        $this->loginAs('nani')->get('/households/duplicate-check', ['phone' => '9829012345'])->assertStatus(403);
    }

    #[Endpoint('GET /households/duplicate-check')]
    public function test_hindi_names_keep_their_vowel_signs_in_the_duplicate_check(): void
    {
        // Bug found in Session 11: \p{M} (ा ि ी …) was stripped, so राम शर्मा and रमा शर्मी both became "र म शर म".
        $this->assertSame('राम शर्मा', HouseholdDef::normName('राम शर्मा ji'));
        $mummy = $this->loginAs('mummy');
        $this->add($mummy, ['name' => 'राम शर्मा', 'phone' => '9829012345']);
        $other = $mummy->get('/households/duplicate-check', ['name' => 'रमा शर्मी', 'city' => 'Bhilwara'])->assertStatus(200);
        $this->assertSame([], $other->json('data.name_matches'), 'a different name is not a possible duplicate');
        $same = $mummy->get('/households/duplicate-check', ['name' => 'राम शर्मा जी', 'city' => 'Bhilwara'])->assertStatus(200);
        $this->assertCount(1, $same->json('data.name_matches'));
    }

    #[Endpoint('GET /households/suggestions')]
    public function test_suggestions_most_used_first(): void
    {
        $mummy = $this->loginAs('mummy');
        foreach (['Shastri Nagar', 'Shastri Nagar', 'Subhash Nagar', 'Azad Nagar'] as $i => $area) {
            $this->add($mummy, ['name' => "Family $i", 'area' => $area])->assertStatus(201);
        }
        $this->assertSame(['Shastri Nagar', 'Subhash Nagar'], $mummy->get('/households/suggestions', ['field' => 'area', 'q' => 'S'])->json('data'));
        $mummy->get('/households/suggestions', ['field' => 'notes'])->assertStatus(422);
    }

    #[Endpoint('GET /households')]
    public function test_list_filters_totals_and_paging(): void
    {
        $mummy = $this->loginAs('mummy');
        $a = $this->add($mummy, ['name' => 'Agarwal ji', 'side' => 'bride', 'adults' => 3, 'children' => 2, 'area' => 'Shastri Nagar', 'invite_event_ids' => [self::MEHNDI]])->json('data.id');
        $this->add($mummy, ['name' => 'Bansal family', 'side' => 'groom', 'phone' => '9829011111', 'is_vip' => true]);
        $this->add($mummy, ['name' => 'Chauhan ji', 'side' => 'both', 'food' => 'jain', 'group_name' => 'Neighbours', 'invite_event_ids' => [self::MEHNDI]]);
        $res = $mummy->get('/households')->assertStatus(200);
        $this->assertSame(['Agarwal ji', 'Bansal family', 'Chauhan ji'], array_column($res->json('data'), 'name'));
        $this->assertSame(3, $res->json('meta.total'));
        $this->assertSame(5 + 2 + 2, $res->json('meta.totals.people'));
        $names = fn (array $q) => array_column($mummy->get('/households', $q)->json('data'), 'name');
        $this->assertSame(['Bansal family', 'Chauhan ji'], $names(['side' => 'groom']), 'groom includes both');
        $this->assertSame(['Chauhan ji'], $names(['side' => 'both']));
        $this->assertSame(['Bansal family'], $names(['vip' => 'true']));
        $this->assertSame(['Agarwal ji', 'Chauhan ji'], $names(['no_phone' => 'true']));
        $this->assertSame(['Chauhan ji'], $names(['food' => 'jain']));
        $this->assertSame(['Chauhan ji'], $names(['group' => 'Neighbours']));
        $this->assertSame(['Agarwal ji'], $names(['area' => 'Shastri Nagar']));
        $this->assertSame(['Bansal family'], $names(['q' => '011111']), 'search by part of a phone');
        $this->assertSame(['Agarwal ji'], $names(['q' => 'shastri']));
        $this->assertSame(['Agarwal ji', 'Chauhan ji'], $names(['event' => self::MEHNDI]));
        $mehndi = $mummy->get('/households', ['event' => self::MEHNDI, 'rsvp' => 'not_asked'])->json('data');
        $this->assertSame('not_asked', $mehndi[0]['invitation']['rsvp']);
        $this->assertSame([], $names(['event' => self::MEHNDI, 'rsvp' => 'coming,waiting']));
        $mummy->get('/households', ['rsvp' => 'coming'])->assertStatus(422);
        $mummy->get('/households', ['sort' => 'phone'])->assertStatus(400);
        $p1 = $mummy->get('/households', ['limit' => '2']);
        $this->assertTrue($p1->json('meta.has_more'));
        $p2 = $mummy->get('/households', ['limit' => '2', 'cursor' => $p1->json('meta.next_cursor')]);
        $this->assertSame(['Chauhan ji'], array_column($p2->json('data'), 'name'));
        $mummy->get('/households', ['limit' => '2', 'side' => 'bride', 'cursor' => $p1->json('meta.next_cursor')])->assertStatus(400);
        $this->assertSame(['Agarwal ji'], array_column($this->loginAs('nani')->get('/households', ['q' => 'agar'])->json('data'), 'name'), 'viewers read');
        $this->assertNotNull($a);
    }

    #[Endpoint('GET /households/{id}')]
    public function test_family_page_and_numeric_id_404(): void
    {
        $id = $this->add($this->loginAs('mummy'), ['name' => 'Sharma family', 'invite_event_ids' => [self::WEDDING]])->json('data.id');
        $d = $this->loginAs('nani')->get("/households/$id")->assertStatus(200)->json('data');
        $this->assertSame('Wedding', $d['invitations'][0]['event']['name']);
        $this->assertSame(2, $d['invitations'][0]['people']);
        $this->assertSame('Mummy', $d['created_by']['name']);
        $this->loginAs('nani')->get('/households/1')->assertStatus(404); // SEC-04
    }

    #[Endpoint('PATCH /households/{id}')]
    public function test_edit_history_and_ds01_stale_version(): void
    {
        $mummy = $this->loginAs('mummy');
        $id = $this->add($mummy, ['name' => 'Sharma family', 'adults' => 3])->json('data.id');
        $mummy->patchJson("/households/$id", ['adults' => 4], 1)->assertStatus(200);
        $before = $this->row('SELECT * FROM households WHERE public_id = ?', [$id]);
        $papa = $this->loginAs('papa');
        $audit = $this->rows('audit_log');
        $res = $papa->patchJson("/households/$id", ['adults' => 5, 'city' => 'Udaipur'], 1);
        $res->assertStatus(409)->assertErrorCode('version_conflict');
        $this->assertSame(2, $res->json('error.current_version'));
        $this->assertSame(['adults'], $res->json('error.changed_fields'));
        $this->assertSame('Mummy', $res->json('error.changed_by.name'));
        $this->assertSame($before, $this->row('SELECT * FROM households WHERE public_id = ?', [$id]));
        $this->assertSame($audit, $this->rows('audit_log'));
        // DS-02: the phone merges both edits and resends with the current version.
        $this->loginAs('papa')->patchJson("/households/$id", ['city' => 'Udaipur'], 2)->assertStatus(200);
        $d = $mummy->get("/households/$id")->json('data');
        $this->assertSame([4, 'Udaipur', 3], [$d['adults'], $d['city'], $d['version']]);
        $lines = array_column($mummy->get("/households/$id/history")->json('data'), 'sentence');
        $this->assertSame(['Papa changed City from Bhilwara to Udaipur for Sharma family.', 'Mummy changed Adults from 3 to 4 for Sharma family.', 'Mummy added Sharma family.'], $lines);
        // A phone change to another family's number → 409; food change resets Jain count.
        $this->add($mummy, ['name' => 'Verma ji', 'phone' => '9829099999']);
        $mummy->patchJson("/households/$id", ['phone' => '9829099999'], 3)->assertStatus(409)->assertErrorCode('duplicate_found');
        $mummy->patchJson("/households/$id", ['phone' => '9829099999', 'allow_duplicate' => true], 3)->assertStatus(200);
        $this->loginAs('nani')->patchJson("/households/$id", ['notes' => 'x'], 4)->assertStatus(403);
    }

    #[Endpoint('DELETE /households/{id}')]
    public function test_ds11_delete_family_with_invitations_undo_identical_and_sec07(): void
    {
        $mummy = $this->loginAs('mummy');
        $id = $this->add($mummy, ['name' => 'Sharma family', 'adults' => 3, 'invite_event_ids' => [self::MEHNDI, self::WEDDING]])->json('data.id');
        $this->patchRsvp($mummy, $id, self::MEHNDI, 'coming');
        $fam = $this->row('SELECT * FROM households WHERE public_id = ?', [$id]);
        $inv = $this->db()->all('SELECT * FROM household_events WHERE household_id = ? ORDER BY id', [$fam['id']]);
        $res = $this->del($mummy, "/households/$id", 1)->assertStatus(200);
        $this->assertSame('Deleted Sharma family', $res->json('meta.undo.summary'));
        $this->assertSame(2, $this->rows('household_events', 'household_id = ? AND deleted_at IS NOT NULL', [$fam['id']]));
        // SEC-07: gone from list, search, totals, headcount, page.
        $this->assertSame(0, $mummy->get('/households', ['q' => 'sharma'])->json('meta.total'));
        $this->assertSame(0, $mummy->get('/households')->json('meta.totals.people'));
        $this->assertSame(0, $mummy->get('/events/' . self::MEHNDI . '/headcount')->json('data.families_invited'));
        $mummy->get("/households/$id")->assertStatus(404);
        $mummy->patchJson("/households/$id", ['notes' => 'x'], 2)->assertStatus(409)->assertErrorCode('record_deleted'); // SEC-06
        // One Activity line, not three.
        $lines = array_column($this->loginAs('ayush')->get('/activity')->json('data'), 'sentence');
        $this->assertSame('Mummy deleted Sharma family.', $lines[1]);
        $this->assertStringNotContainsString('removed', $lines[2]);

        $mummy->postJson('/undo/' . $res->json('meta.undo.batch_id'), new \stdClass())->assertStatus(200);
        $skip = ['version', 'updated_at', 'updated_by'];
        $after = $this->row('SELECT * FROM households WHERE id = ?', [$fam['id']]);
        $this->assertSame(array_diff_key($fam, array_flip($skip)), array_diff_key($after, array_flip($skip)));
        $this->assertSame((int) $fam['version'] + 2, (int) $after['version']);
        $back = $this->db()->all('SELECT * FROM household_events WHERE household_id = ? ORDER BY id', [$fam['id']]);
        $this->assertSame(array_map(fn ($r) => array_diff_key($r, array_flip($skip)), $inv), array_map(fn ($r) => array_diff_key($r, array_flip($skip)), $back));
        $this->assertSame(1, $mummy->get('/events/' . self::MEHNDI . '/headcount')->json('data.families_coming'));
    }

    #[Endpoint('POST /households/{id}/restore')]
    public function test_ds16_restore_with_phone_clash_warns_family_403(): void
    {
        $mummy = $this->loginAs('mummy');
        $id = $this->add($mummy, ['name' => 'Sharma family', 'phone' => '9829012345', 'invite_event_ids' => [self::MEHNDI]])->json('data.id');
        $this->del($mummy, "/households/$id", 1)->assertStatus(200);
        $this->add($mummy, ['name' => 'Ramesh Sharma', 'phone' => '9829012345'])->assertStatus(201); // phone free again
        $this->loginAs('papa')->postJson("/households/$id/restore", new \stdClass(), [], ['ifMatch' => 2])->assertStatus(403);
        $res = $this->loginAs('ayush')->postJson("/households/$id/restore", new \stdClass(), [], ['ifMatch' => 2])->assertStatus(200);
        $this->assertSame(['Sharma family has the same phone as Ramesh Sharma. Check for a duplicate.'], $res->json('meta.warnings'));
        $this->assertTrue($res->json('data.possible_duplicate'));
        $this->assertCount(1, $res->json('data.invitations'), 'its invitations come back with it');
    }

    private function patchRsvp(ApiClient $c, string $fam, string $event, string $rsvp, int $v = 1): TestResponse
    {
        return $c->patchJson("/households/$fam/invitations/$event", ['rsvp' => $rsvp], $v);
    }

    #[Endpoint('PUT /households/{id}/invitations/{event_id}')]
    public function test_invite_twice_revive_undo_and_no_guest_event(): void
    {
        $mummy = $this->loginAs('mummy');
        $id = $this->add($mummy, ['name' => 'Sharma family'])->json('data.id');
        $res = $this->put($mummy, $id, self::MEHNDI, ['expected_adults' => 3])->assertStatus(201);
        $this->assertEquals(['rsvp' => 'not_asked', 'people' => 3, 'version' => 1], array_intersect_key($res->json('data'), array_flip(['rsvp', 'people', 'version'])));
        $this->assertSame('Invited Sharma family to Mehndi', $res->json('meta.undo.summary'));
        $again = $this->put($mummy, $id, self::MEHNDI)->assertStatus(200);
        $this->assertArrayNotHasKey('undo', $again->json('meta'));
        $this->assertSame(1, $again->json('data.version'));
        // Undo the invite: the row is soft deleted, never removed.
        $mummy->postJson('/undo/' . $res->json('meta.undo.batch_id'), new \stdClass())->assertStatus(200);
        $this->assertSame([], $mummy->get("/households/$id")->json('data.invitations'));
        $this->assertSame(1, $this->rows('household_events'));
        // RSVP set, removed, re-invited: the old row and RSVP come back.
        $this->put($mummy, $id, self::MEHNDI)->assertStatus(200);
        $this->patchRsvp($mummy, $id, self::MEHNDI, 'coming', 3)->assertStatus(200);
        $this->del($mummy, "/households/$id/invitations/" . self::MEHNDI, 4)->assertStatus(200);
        $revived = $this->put($mummy, $id, self::MEHNDI)->assertStatus(200);
        $this->assertSame('coming', $revived->json('data.rsvp'));
        $this->assertSame(1, $this->rows('household_events'));
        $lines = array_column($mummy->get("/households/$id/history")->json('data'), 'sentence');
        $this->assertSame([
            'Mummy invited Sharma family to Mehndi again.', 'Mummy removed Sharma family from Mehndi.', 'Mummy marked Sharma family Coming for Mehndi.',
            'Mummy invited Sharma family to Mehndi again.', 'Mummy brought back Sharma family · Mehndi (Undo).',
        ], array_slice($lines, 0, 5));

        $this->db()->run('UPDATE events SET guests_invited = 0 WHERE public_id = ?', [self::HALDI]);
        $this->put($mummy, $id, self::HALDI)->assertStatus(422);
        $this->assertSame("This event doesn't take guest invitations.", $this->put($mummy, $id, self::HALDI)->json('error.message'));
        $this->put($mummy, $id, '01JA7Q3M2K8V5R1T9W4X6Y0Z2B')->assertStatus(404);
        $this->put($this->loginAs('nani'), $id, self::WEDDING)->assertStatus(403);
        $this->put($mummy, $id, self::WEDDING, ['expected_adults' => 99])->assertStatus(422);
    }

    #[Endpoint('PATCH /households/{id}/invitations/{event_id}')]
    public function test_rsvp_uses_invitation_version_so_family_edit_and_rsvp_both_succeed(): void
    {
        $mummy = $this->loginAs('mummy');
        $id = $this->add($mummy, ['name' => 'Sharma family', 'adults' => 3, 'children' => 1, 'food' => 'mixed', 'jain_count' => 2, 'invite_event_ids' => [self::MEHNDI]])->json('data.id');
        $this->loginAs('papa')->patchJson("/households/$id", ['notes' => 'Bring sweets'], 1)->assertStatus(200);
        $res = $mummy->patchJson("/households/$id/invitations/" . self::MEHNDI, ['rsvp' => 'coming', 'expected_children' => 0, 'rsvp_note' => 'Phone call'], 1)->assertStatus(200);
        $this->assertEquals(['rsvp' => 'coming', 'people' => 3, 'version' => 2, 'rsvp_note' => 'Phone call'],
            array_intersect_key($res->json('data'), array_flip(['rsvp', 'people', 'version', 'rsvp_note'])));
        $this->assertSame('Mummy', $res->json('data.rsvp_updated_by.name'));
        $this->assertSame('2026-10-08T09:12:31Z', $res->json('data.rsvp_updated_at'));
        $h = $mummy->get('/events/' . self::MEHNDI . '/headcount')->json('data');
        $this->assertSame([3, 2], [$h['people_coming'], $h['jain_coming']]);
        // DS-01 on invitations
        $before = $this->row('SELECT * FROM household_events');
        $this->loginAs('papa')->patchJson("/households/$id/invitations/" . self::MEHNDI, ['rsvp' => 'not_coming'], 1)->assertStatus(409)->assertErrorCode('version_conflict');
        $this->assertSame($before, $this->row('SELECT * FROM household_events'));
        $mummy->patchJson("/households/$id/invitations/" . self::MEHNDI, ['rsvp' => 'maybe'], 2)->assertStatus(422);
        $mummy->patchJson("/households/$id/invitations/" . self::WEDDING, ['rsvp' => 'coming'], 1)->assertStatus(404);
    }

    #[Endpoint('DELETE /households/{id}/invitations/{event_id}')]
    public function test_remove_from_event_with_undo(): void
    {
        $mummy = $this->loginAs('mummy');
        $id = $this->add($mummy, ['name' => 'Sharma family', 'invite_event_ids' => [self::MEHNDI]])->json('data.id');
        $this->del($mummy, "/households/$id/invitations/" . self::MEHNDI, 2)->assertStatus(409);
        $res = $this->del($mummy, "/households/$id/invitations/" . self::MEHNDI, 1)->assertStatus(200);
        $this->assertSame('Removed Sharma family from Mehndi', $res->json('meta.undo.summary'));
        $this->assertSame(0, $mummy->get('/events/' . self::MEHNDI . '/headcount')->json('data.families_invited'));
        $this->del($mummy, "/households/$id/invitations/" . self::MEHNDI, 2)->assertStatus(409)->assertErrorCode('record_deleted');
        $mummy->postJson('/undo/' . $res->json('meta.undo.batch_id'), new \stdClass())->assertStatus(200);
        $this->assertSame(1, $mummy->get('/events/' . self::MEHNDI . '/headcount')->json('data.families_invited'));
    }

    #[Endpoint('POST /households/{id}/invitations/{event_id}/whatsapp-opened')]
    public function test_whatsapp_tap_is_bookkeeping_no_version_bump(): void
    {
        $mummy = $this->loginAs('mummy');
        $id = $this->add($mummy, ['name' => 'Sharma family', 'phone' => '9829012345', 'invite_event_ids' => [self::MEHNDI]])->json('data.id');
        $before = $this->row('SELECT version, updated_at FROM household_events');
        $res = $mummy->postJson("/households/$id/invitations/" . self::MEHNDI . '/whatsapp-opened', new \stdClass())->assertStatus(200);
        $this->assertSame('2026-10-08T09:12:31Z', $res->json('data.last_reminder_opened_at'));
        $this->assertSame($before, $this->row('SELECT version, updated_at FROM household_events'));
        $lines = array_column($mummy->get("/households/$id/history")->json('data'), 'sentence');
        $this->assertSame('Mummy opened a WhatsApp reminder to Sharma family for Mehndi.', $lines[0]);
        $mummy->postJson("/households/$id/invitations/" . self::WEDDING . '/whatsapp-opened', new \stdClass())->assertStatus(404);
    }

    /** SEC-10 for this session: Viewer can't write any guest route; Family can't restore. */
    public function test_sec10_powers(): void
    {
        $mummy = $this->loginAs('mummy');
        $id = $this->add($mummy, ['name' => 'Sharma family', 'invite_event_ids' => [self::MEHNDI]])->json('data.id');
        $nani = $this->loginAs('nani');
        $this->del($nani, "/households/$id", 1)->assertStatus(403);
        $this->del($nani, "/households/$id/invitations/" . self::MEHNDI, 1)->assertStatus(403);
        $nani->postJson("/households/$id/invitations/" . self::MEHNDI . '/whatsapp-opened', new \stdClass())->assertStatus(403);
        $this->del($mummy, "/households/$id", 1)->assertStatus(200);
        $mummy->postJson("/households/$id/restore", new \stdClass(), [], ['ifMatch' => 2])->assertStatus(403);
    }
}
