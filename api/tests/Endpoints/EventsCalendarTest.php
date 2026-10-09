<?php
declare(strict_types=1);

namespace Tests\Endpoints;

use AM\Kernel\Uuid;
use Tests\Support\ApiTestCase;
use Tests\Support\Endpoint;

/**
 * /events… and /calendar — FEATURES B4 (AC-EVT-01…08), API.md §6.4,
 * TESTING §1.3 events + calendar rows, DS-01/04/11 on events.
 * Frozen clock: Thu 8 Oct 2026, 2:42 PM IST.
 */
final class EventsCalendarTest extends ApiTestCase
{
    private const MEHNDI = '01M4DK5T3E6QZBMNQ0V7KQWW23';
    private const HALDI = '01M4DK5T3D9GHKDKJRDJRR373Z';
    private const WEDDING = '01M4DK5T3H1KPRF5DMTQJ2GCYG';

    /** Two families invited to Mehndi: Sharma (2+1, coming, Jain) and Verma (4, waiting); a deleted one ignored. */
    private function invite(): void
    {
        $db = $this->db();
        $db->run("INSERT INTO households (id, public_id, name, name_norm, side, adults, children, food, created_by, updated_by) VALUES
            (901, '01JA7Q3M2K8V5R1T9W4X6Y0H01', 'Sharma family', 'sharma', 'bride', 2, 1, 'jain', 1, 1),
            (902, '01JA7Q3M2K8V5R1T9W4X6Y0H02', 'Verma ji', 'verma', 'groom', 4, 0, 'veg', 1, 1)");
        $mehndi = (int) $this->row('SELECT id FROM events WHERE public_id = ?', [self::MEHNDI])['id'];
        $db->run("INSERT INTO household_events (household_id, event_id, rsvp) VALUES (901, ?, 'coming'), (902, ?, 'waiting')", [$mehndi, $mehndi]);
    }

    #[Endpoint('GET /events')]
    public function test_ac_evt_01_seven_events_with_date_not_set(): void
    {
        $res = $this->loginAs('nani')->get('/events')->assertStatus(200)->assertEnvelope();
        $this->assertSame(['Engagement', 'Haldi', 'Mehndi', 'Sangeet', 'Mayra', 'Wedding', 'Reception'], array_column($res->json('data'), 'name'));
        $this->assertNull($res->json('data.0.start_at'));
        $this->assertNull($res->json('data.0.date'));
        $this->assertTrue($res->json('data.0.guests_invited'));
        $this->assertArrayNotHasKey('payments', $res->json('data.0.counts'), 'money count hidden from non-money users');
        $this->assertArrayHasKey('payments', $this->loginAs('papa')->get('/events')->json('data.0.counts'));
        $this->loginAs('nani')->get('/events', ['guests_invited' => 'maybe'])->assertStatus(400);
    }

    #[Endpoint('PATCH /events/{id}')]
    public function test_admin_sets_date_and_venue_in_ist_family_cannot(): void
    {
        $ayush = $this->loginAs('ayush');
        $res = $ayush->patchJson('/events/' . self::MEHNDI, [
            'start_at' => '2027-02-14T18:00:00+05:30', 'end_at' => '2027-02-14T23:00:00+05:30',
            'venue_name' => 'Sukhadia Bhawan', 'venue_address' => 'Bhilwara', 'map_url' => 'https://maps.app.goo.gl/abc', 'dress_code' => 'Green',
        ], 1)->assertStatus(200);
        $this->assertSame('2027-02-14T12:30:00Z', $res->json('data.start_at'));
        $this->assertSame('2027-02-14', $res->json('data.date'));
        $this->assertSame(2, $res->json('data.version'));
        $lines = array_column($ayush->get('/events/' . self::MEHNDI . '/history')->json('data'), 'sentence');
        $this->assertStringStartsWith('Ayush changed Starts, Ends, Venue, Address, Map link and Dress code for Mehndi.', $lines[0]);

        $this->loginAs('papa')->patchJson('/events/' . self::MEHNDI, ['venue_name' => 'x'], 2)->assertStatus(403); // AC-EVT-05
        $bad = $ayush->patchJson('/events/' . self::MEHNDI, ['end_at' => '2027-02-14T17:00:00+05:30', 'map_url' => 'http://maps.example.com'], 2);
        $bad->assertStatus(422);
        $this->assertSame('End time must be after the start time.', $bad->json('error.fields.end_at')); // AC-EVT-08
        $this->assertSame('Paste a link that starts with https://', $bad->json('error.fields.map_url'));
        $ayush->patchJson('/events/' . self::MEHNDI, ['start_at' => '14 Feb 6 PM'], 2)->assertStatus(422);
    }

    #[Endpoint('PATCH /events/{id}')]
    public function test_all_day_starts_at_ist_midnight_and_ds01_stale_version(): void
    {
        $ayush = $this->loginAs('ayush');
        $res = $ayush->patchJson('/events/' . self::HALDI, ['all_day' => true, 'start_at' => '2027-02-13T10:00:00+05:30'], 1)->assertStatus(200);
        $this->assertSame('2027-02-12T18:30:00Z', $res->json('data.start_at'));
        $this->assertSame('2027-02-13', $res->json('data.date'));
        $before = $this->row('SELECT * FROM events WHERE public_id = ?', [self::HALDI]);
        $mahi = $this->loginAs('mahi');
        $mahi->patchJson('/events/' . self::HALDI, ['venue_name' => 'Home'], 1)->assertStatus(409)->assertErrorCode('version_conflict');
        $this->assertSame($before, $this->row('SELECT * FROM events WHERE public_id = ?', [self::HALDI]));
    }

    #[Endpoint('POST /events')]
    public function test_custom_event_duplicate_same_type_same_ist_day(): void
    {
        $ayush = $this->loginAs('ayush');
        $ayush->patchJson('/events/' . self::HALDI, ['start_at' => '2027-02-13T09:00:00+05:30'], 1)->assertStatus(200);
        $res = $ayush->postJson('/events', ['name' => 'Ganesh puja', 'type' => 'other', 'start_at' => '2027-02-13T07:00:00+05:30', 'notes' => 'At home'])->assertStatus(201);
        $this->assertFalse($res->json('data.guests_invited'), 'custom events are not guest events by default');
        $this->assertSame(80, $res->json('data.sort_order'));
        $dup = $ayush->postJson('/events', ['name' => 'Haldi (groom side)', 'type' => 'haldi', 'side' => 'groom', 'start_at' => '2027-02-13T23:30:00+05:30']);
        $dup->assertStatus(409)->assertErrorCode('duplicate_found');
        $this->assertSame('Haldi is already on Sat, 13 Feb 2027. Add anyway?', $dup->json('error.message'));
        $ayush->postJson('/events', ['name' => 'Haldi (groom side)', 'type' => 'haldi', 'side' => 'groom', 'start_at' => '2027-02-13T23:30:00+05:30', 'allow_duplicate' => true])->assertStatus(201);
        $ayush->postJson('/events', ['name' => 'Haldi 2', 'type' => 'haldi', 'start_at' => '2027-02-14T00:30:00+05:30'])->assertStatus(201); // next IST day
        $this->loginAs('papa')->postJson('/events', ['name' => 'x', 'type' => 'other'])->assertStatus(403);
        $ayush->postJson('/events', ['type' => 'party'])->assertStatus(422);
        // DS-04
        $key = '5b1f0b52-3a2d-4c1e-9f00-0000000006a1';
        $a = $ayush->postJson('/events', ['name' => 'Makeup trial', 'type' => 'other'], [], ['idem' => $key])->assertStatus(201);
        $b = $ayush->postJson('/events', ['name' => 'Makeup trial', 'type' => 'other'], [], ['idem' => $key])->assertStatus(201);
        $this->assertSame($a->json('data'), $b->json('data'));
        $this->assertSame(1, $this->rows('events', "name = 'Makeup trial'"));
    }

    #[Endpoint('GET /events/{id}')]
    public function test_event_page_counts_and_headcount(): void
    {
        $this->invite();
        $ayush = $this->loginAs('ayush');
        $ayush->postJson('/tasks', ['title' => 'Mehndi cones', 'event_id' => self::MEHNDI])->assertStatus(201);
        $res = $this->loginAs('mummy')->get('/events/' . self::MEHNDI)->assertStatus(200);
        $this->assertSame(['tasks' => 1, 'invitations' => 2, 'documents' => 0], $res->json('data.counts'));
        $this->assertSame(7, $res->json('data.headcount.people_up_to'), '3 coming + 4 waiting');
        $this->loginAs('mummy')->get('/events/1')->assertStatus(404);
    }

    #[Endpoint('GET /events/{id}/headcount')]
    public function test_headcount_matches_database_7_4(): void
    {
        $this->invite();
        $h = $this->loginAs('nani')->get('/events/' . self::MEHNDI . '/headcount')->assertStatus(200)->json('data');
        $this->assertSame([
            'event' => ['id' => self::MEHNDI, 'name' => 'Mehndi'],
            'families_invited' => 2, 'families_coming' => 1, 'families_not_coming' => 0,
            'people_coming' => 3, 'people_waiting' => 4, 'people_not_asked' => 0, 'jain_coming' => 3, 'people_up_to' => 7,
        ], $h);
        $this->db()->run("INSERT INTO change_batches (id, public_id, action, entity_type, summary, user_id) VALUES (900, '01JA7Q3M2K8V5R1T9W4X6Y0B01', 'delete', 'household', 'Verma ji', 1)");
        $this->db()->run('UPDATE households SET deleted_at = UTC_TIMESTAMP(), deleted_by = 1, delete_batch_id = 900 WHERE id = 902'); // a deleted family is not counted
        $this->assertSame(1, $this->loginAs('nani')->get('/events/' . self::MEHNDI . '/headcount')->json('data.families_invited'));
    }

    #[Endpoint('GET /events/{id}/delete-preview')]
    public function test_delete_preview_counts_admin_only(): void
    {
        $this->invite();
        $this->loginAs('ayush')->postJson('/tasks', ['title' => 'Mehndi cones', 'event_id' => self::MEHNDI])->assertStatus(201);
        $res = $this->loginAs('mahi')->get('/events/' . self::MEHNDI . '/delete-preview')->assertStatus(200);
        $this->assertSame(['tasks' => 1, 'invitations' => 2, 'payments' => 0, 'documents' => 0], $res->json('data'));
        $this->loginAs('papa')->get('/events/' . self::MEHNDI . '/delete-preview')->assertStatus(403);
    }

    #[Endpoint('DELETE /events/{id}')]
    public function test_ac_evt_06_ds11_delete_takes_invitations_undo_brings_them_back(): void
    {
        $this->invite();
        $ayush = $this->loginAs('ayush');
        $task = $ayush->postJson('/tasks', ['title' => 'Mehndi cones', 'event_id' => self::MEHNDI])->json('data');
        $strip = static fn (array $rows) => array_map(static function ($r) {
            unset($r['version'], $r['updated_at'], $r['updated_by'], $r['deleted_at'], $r['deleted_by'], $r['delete_batch_id']);
            return $r;
        }, $rows);
        $before = [$strip($this->db()->all('SELECT * FROM events WHERE public_id = ?', [self::MEHNDI])), $strip($this->db()->all('SELECT * FROM household_events ORDER BY id'))];
        $this->loginAs('papa')->request('DELETE', '/events/' . self::MEHNDI, null, [], [], ['ifMatch' => 1])->assertStatus(403);
        $res = $ayush->request('DELETE', '/events/' . self::MEHNDI, null, [], [], ['ifMatch' => 1])->assertStatus(200);
        $this->assertSame(0, $this->rows('household_events', 'deleted_at IS NULL'));
        $this->assertNotContains('Mehndi', array_column($ayush->get('/events')->json('data'), 'name'));
        $this->assertSame(['id' => self::MEHNDI, 'name' => 'Mehndi', 'deleted' => true], $ayush->get('/tasks/' . $task['id'])->json('data.event'), 'tasks keep the link, labelled deleted');
        $trash = $ayush->get('/trash/' . $res->json('meta.undo.batch_id'))->json('data');
        $this->assertSame([['type' => 'event', 'id' => self::MEHNDI, 'name' => 'Mehndi', 'child_count' => 2]], $trash['items']);
        $ayush->postJson('/undo/' . $res->json('meta.undo.batch_id'), new \stdClass())->assertStatus(200);
        $after = [$strip($this->db()->all('SELECT * FROM events WHERE public_id = ?', [self::MEHNDI])), $strip($this->db()->all('SELECT * FROM household_events ORDER BY id'))];
        $this->assertSame($before, $after);
    }

    #[Endpoint('POST /events/{id}/restore')]
    public function test_restore_after_11_minutes(): void
    {
        $this->invite();
        $ayush = $this->loginAs('ayush');
        $ayush->request('DELETE', '/events/' . self::MEHNDI, null, [], [], ['ifMatch' => 1])->assertStatus(200);
        $this->clock->advance('+11 minutes');
        $this->loginAs('mummy')->postJson('/events/' . self::MEHNDI . '/restore', new \stdClass(), [], ['ifMatch' => 2])->assertStatus(403);
        $res = $this->loginAs('mahi')->postJson('/events/' . self::MEHNDI . '/restore', new \stdClass(), [], ['ifMatch' => 2])->assertStatus(200);
        $this->assertSame(2, $res->json('data.counts.invitations'));
    }

    #[Endpoint('GET /calendar')]
    public function test_ac_evt_03_agenda_items_by_ist_day_money_only_for_money_users(): void
    {
        $ayush = $this->loginAs('ayush');
        $ayush->patchJson('/events/' . self::MEHNDI, ['start_at' => '2026-10-20T18:00:00+05:30'], 1)->assertStatus(200);
        $ayush->patchJson('/events/' . self::HALDI, ['start_at' => '2026-10-20T01:00:00+05:30'], 1)->assertStatus(200); // 19 Oct 19:30 UTC, but 20 Oct in India
        $ayush->postJson('/tasks', ['title' => 'Pay tent advance', 'due_date' => '2026-10-20', 'assignee_ids' => [$this->pid('mummy')]])->assertStatus(201);
        $ayush->postJson('/tasks', ['title' => 'Book band', 'due_date' => '2026-10-20', 'due_time' => '11:00', 'event_id' => self::MEHNDI])->assertStatus(201);
        $ayush->postJson('/tasks', ['title' => 'Done one', 'due_date' => '2026-10-20', 'status' => 'done'])->assertStatus(201);
        $cat = (int) $this->row('SELECT id FROM budget_categories ORDER BY id LIMIT 1')['id'];
        $this->db()->run("INSERT INTO payments (public_id, title, category_id, amount_paise, status, due_date, created_by, updated_by) VALUES
            ('01JA7Q3M2K8V5R1T9W4X6Y0P01', 'Tent advance', ?, 5000000, 'due', '2026-10-20', 1, 1)", [$cat]);

        $q = ['from' => '2026-10-08', 'to' => '2026-12-31', 'include_undated' => 'true'];
        $money = $this->loginAs('papa')->get('/calendar', $q)->assertStatus(200)->assertEnvelope()->json('data');
        $this->assertSame('2026-10-20', $money['days'][0]['date']);
        $this->assertSame(
            [['task', 'Pay tent advance', null], ['payment', 'Tent advance', null], ['event', 'Haldi', '01:00'], ['task', 'Book band', '11:00'], ['event', 'Mehndi', '18:00']],
            self::sortForAssert($money['days'][0]['items']),
            'untimed first, then by IST time; Haldi at 1 AM IST is on 20 Oct although it is 19 Oct in UTC; done tasks are not listed',
        );
        $this->assertSame(['Engagement', 'Sangeet', 'Mayra', 'Wedding', 'Reception'], array_column($money['undated'], 'name'));
        $this->assertSame('Mehndi', $money['days'][0]['items'][array_search('Book band', array_column($money['days'][0]['items'], 'title'), true)]['linked_event']['name']);

        $plain = $this->loginAs('mummy')->get('/calendar', $q)->json('data');
        $this->assertNotContains('payment', array_column($plain['days'][0]['items'], 'type'), 'AC-EVT-03');
        $mine = $this->loginAs('mummy')->get('/calendar', $q + ['mine' => 'true', 'types' => 'task'])->json('data');
        $this->assertSame(['Pay tent advance'], array_column($mine['days'][0]['items'], 'title'));
        $this->assertArrayNotHasKey('undated', $this->loginAs('mummy')->get('/calendar', ['from' => '2026-10-08', 'to' => '2026-10-31'])->json('data'));
    }

    /** @return list<array{0:string,1:string,2:?string}> */
    private static function sortForAssert(array $items): array
    {
        return array_map(static fn ($i) => [$i['type'], $i['title'], $i['time']], $items);
    }

    #[Endpoint('GET /calendar')]
    public function test_range_rules(): void
    {
        $c = $this->loginAs('nani');
        $c->get('/calendar', ['from' => '2026-10-01', 'to' => '2027-01-02'])->assertStatus(200); // 93 days
        $res = $c->get('/calendar', ['from' => '2026-10-01', 'to' => '2027-01-03'])->assertStatus(422);
        $this->assertSame('Pick at most 93 days at a time.', $res->json('error.fields.to'));
        $c->get('/calendar', ['from' => '2026-10-10', 'to' => '2026-10-01'])->assertStatus(422);
        $c->get('/calendar', ['from' => '2026-10-10'])->assertStatus(422);
        $c->get('/calendar', ['from' => '2026-10-01', 'to' => '2026-10-31', 'types' => 'event,party'])->assertStatus(400);
        $c->get('/calendar', ['from' => '2026-10-01', 'to' => '2026-10-31', 'mine' => 'yes'])->assertStatus(400);
        $this->assertSame([], $c->get('/calendar', ['from' => '2026-10-01', 'to' => '2026-10-31'])->json('data.days'));
    }

    #[Endpoint('POST /tasks')]
    public function test_a_task_can_link_to_an_event_and_not_to_a_deleted_one(): void
    {
        $ayush = $this->loginAs('ayush');
        $t = $ayush->postJson('/tasks', ['title' => 'Haldi turmeric', 'event_id' => self::HALDI])->assertStatus(201)->json('data');
        $this->assertSame('Haldi', $t['event']['name']);
        $ayush->request('DELETE', '/events/' . self::WEDDING, null, [], [], ['ifMatch' => 1])->assertStatus(200);
        $ayush->postJson('/tasks', ['title' => 'x', 'event_id' => self::WEDDING])->assertStatus(422);
        $this->assertSame(Uuid::isValid(Uuid::v4()), true);
    }
}
