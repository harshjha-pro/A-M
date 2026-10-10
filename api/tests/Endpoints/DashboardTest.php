<?php
declare(strict_types=1);

namespace Tests\Endpoints;

use Tests\Support\ApiClient;
use Tests\Support\ApiTestCase;
use Tests\Support\Endpoint;
use Tests\Support\TestDb;

/**
 * GET /dashboard — FEATURES B2 (AC-DASH-01…05), DATABASE §7, TESTING §1.3, SEC-07.
 * Frozen clock: Thu 8 Oct 2026, 2:42 PM IST; wedding 14–16 Feb 2027.
 */
final class DashboardTest extends ApiTestCase
{
    private const MEHNDI = '01M4DK5T3E6QZBMNQ0V7KQWW23';

    #[Endpoint('GET /dashboard')]
    public function test_cards_per_role(): void
    {
        $cards = fn (string $who) => array_keys($this->loginAs($who)->get('/dashboard')->assertStatus(200)->assertEnvelope()->json('data'));
        $this->assertSame(['countdown', 'my_tasks', 'overdue', 'payments_due', 'budget', 'headcount', 'safety', 'recent_activity', 'start_here'], $cards('ayush'));
        $this->assertSame(['countdown', 'my_tasks', 'overdue', 'payments_due', 'budget', 'headcount'], $cards('papa'));
        $this->assertSame(['countdown', 'my_tasks', 'overdue', 'headcount'], $cards('mummy'), 'AC-DASH-03: no money cards at all');
        $this->assertSame(['countdown', 'headcount'], $cards('nani'), 'Viewer: countdown and headcount only');
        $body = $this->loginAs('mummy')->get('/dashboard')->body();
        $this->assertStringNotContainsString('_paise', $body);
        $this->loginAs('papa')->get('/dashboard', ['payments_window_days' => '91'])->assertStatus(400);
        $this->loginAs('papa')->get('/dashboard', ['payments_window_days' => '0'])->assertStatus(400);
        $this->assertSame(90, $this->loginAs('papa')->get('/dashboard', ['payments_window_days' => '90'])->json('data.payments_due.window_days'));
    }

    #[Endpoint('GET /dashboard')]
    public function test_ac_dash_01_countdown_in_ist_late_at_night(): void
    {
        $c = $this->loginAs('nani');
        $this->assertSame(129, $c->get('/dashboard')->json('data.countdown.days_to_wedding'));
        $this->clock->set('2026-10-08T18:29:00Z'); // 11:59 PM IST, still 8 Oct
        $this->assertSame(129, $c->get('/dashboard')->json('data.countdown.days_to_wedding'));
        $this->clock->set('2026-10-08T18:31:00Z'); // 00:01 on 9 Oct in India (still 8 Oct in UTC)
        $this->assertSame(128, $c->get('/dashboard')->json('data.countdown.days_to_wedding'));
        $this->clock->set('2027-02-14T03:00:00Z'); // 4 months on: the 90-day login has ended, so log in again
        $c = $this->loginAs('nani');
        $cd = $c->get('/dashboard')->json('data.countdown');
        $this->assertSame([null, 1, 3], [$cd['days_to_wedding'], $cd['wedding_day'], $cd['wedding_days']]);
        $this->clock->set('2027-02-17T03:00:00Z');
        $cd = $c->get('/dashboard')->json('data.countdown');
        $this->assertSame([null, null], [$cd['days_to_wedding'], $cd['wedding_day']]);
    }

    #[Endpoint('GET /dashboard')]
    public function test_next_event_is_the_next_dated_one(): void
    {
        $a = $this->loginAs('ayush');
        $this->assertNull($a->get('/dashboard')->json('data.countdown.next_event'));
        $a->patchJson('/events/' . self::MEHNDI, ['start_at' => '2027-02-14T18:00:00+05:30', 'venue_name' => 'Porwal Niwas'], 1)->assertStatus(200);
        $a->postJson('/events', ['name' => 'Makeup trial', 'type' => 'other', 'start_at' => '2026-10-08T14:00:00+05:30'])->assertStatus(201); // already started: not "next"
        $next = $a->get('/dashboard')->json('data.countdown.next_event');
        $this->assertSame(['Mehndi', 'Porwal Niwas'], [$next['name'], $next['venue_name']]);
    }

    #[Endpoint('GET /dashboard')]
    public function test_ac_dash_02_my_overdue_first_then_today_and_sec07(): void
    {
        $a = $this->loginAs('ayush');
        $m = [$this->pid('mummy')];
        $today = $a->postJson('/tasks', ['title' => 'Due today', 'due_date' => '2026-10-08', 'assignee_ids' => $m])->json('data');
        $a->postJson('/tasks', ['title' => 'Due yesterday', 'due_date' => '2026-10-07', 'assignee_ids' => $m])->assertStatus(201);
        $a->postJson('/tasks', ['title' => 'Today 2 PM (passed)', 'due_date' => '2026-10-08', 'due_time' => '14:00', 'assignee_ids' => $m])->assertStatus(201);
        $a->postJson('/tasks', ['title' => 'Next week', 'due_date' => '2026-10-15', 'assignee_ids' => $m])->assertStatus(201);
        $a->postJson('/tasks', ['title' => 'Not mine, overdue', 'due_date' => '2026-10-01'])->assertStatus(201);
        $gone = $a->postJson('/tasks', ['title' => 'Deleted overdue', 'due_date' => '2026-10-01', 'assignee_ids' => $m])->json('data');
        $a->request('DELETE', '/tasks/' . $gone['id'], null, [], [], ['ifMatch' => 1])->assertStatus(200);

        $d = $this->loginAs('mummy')->get('/dashboard')->json('data');
        $this->assertSame(['Due yesterday', 'Today 2 PM (passed)', 'Due today'], array_column($d['my_tasks']['items'], 'title'));
        $this->assertSame([true, true, false], array_column($d['my_tasks']['items'], 'overdue'));
        $this->assertSame(3, $d['my_tasks']['total']);
        $this->assertFalse($d['my_tasks']['upcoming']);
        $this->assertSame(3, $d['overdue']['total'], 'everyone: yesterday, 2 PM, not-mine; the deleted one never counts (SEC-07)');

        // Nothing due: the next 3 upcoming instead.
        $this->loginAs('mummy')->postJson('/tasks/' . $today['id'] . '/done', new \stdClass(), [], ['ifMatch' => 1])->assertStatus(200);
        $papa = $this->loginAs('papa')->get('/dashboard')->json('data.my_tasks');
        $this->assertSame([], $papa['items']);
        $a->postJson('/tasks', ['title' => 'Papa later', 'due_date' => '2026-10-20', 'assignee_ids' => [$this->pid('papa')]])->assertStatus(201);
        $papa = $this->loginAs('papa')->get('/dashboard')->json('data.my_tasks');
        $this->assertSame(['Papa later'], array_column($papa['items'], 'title'));
        $this->assertTrue($papa['upcoming']);
    }

    #[Endpoint('GET /dashboard')]
    public function test_ac_dash_04_headcount_per_guest_event(): void
    {
        $db = $this->db();
        $db->run("INSERT INTO households (id, public_id, name, name_norm, side, adults, children, food, created_by, updated_by) VALUES
            (901, '01JA7Q3M2K8V5R1T9W4X6Y0H01', 'Family A', 'a', 'bride', 2, 1, 'veg', 1, 1),
            (902, '01JA7Q3M2K8V5R1T9W4X6Y0H02', 'Family B', 'b', 'groom', 4, 0, 'veg', 1, 1),
            (903, '01JA7Q3M2K8V5R1T9W4X6Y0H03', 'Family C', 'c', 'groom', 3, 0, 'jain', 1, 1)");
        $mehndi = (int) $this->row('SELECT id FROM events WHERE public_id = ?', [self::MEHNDI])['id'];
        $db->run("INSERT INTO household_events (household_id, event_id, rsvp) VALUES (901, ?, 'coming'), (902, ?, 'coming'), (903, ?, 'waiting')", [$mehndi, $mehndi, $mehndi]);
        $hc = $this->loginAs('nani')->get('/dashboard')->json('data.headcount');
        $this->assertCount(7, $hc);
        $m = array_values(array_filter($hc, static fn ($h) => $h['event']['name'] === 'Mehndi'))[0];
        $this->assertSame([7, 3, 0], [$m['people_coming'], $m['people_waiting'], $m['people_not_asked']]);
    }

    #[Endpoint('GET /dashboard')]
    public function test_ac_dash_05_safety_backup_27_hours_old_is_red(): void
    {
        $db = $this->db();
        $db->run("INSERT INTO backup_runs (kind, status, started_at, finished_at, file_name) VALUES ('nightly_db', 'ok', '2026-10-07 06:12:00', '2026-10-07 06:12:31', 'x')");
        try {
            $app = $this->makeApp(['BACKUP_EXPECTED' => 'true']);
            $c = new ApiClient($app);
            $c->login(self::PEOPLE['ayush'][0])->assertStatus(200);
            $s = $c->get('/dashboard')->json('data.safety');
            $this->assertSame('red', $s['checks']['backup']['status']);
            $this->assertSame(27.0, (float) $s['checks']['backup']['hours_ago']);
            $this->assertSame(0, $s['trash_batches']);
        } finally {
            $db->run('DELETE FROM backup_runs');
        }
    }

    #[Endpoint('GET /dashboard')]
    public function test_start_here_and_recent_activity_for_admins(): void
    {
        $a = $this->loginAs('ayush');
        $d = $a->get('/dashboard')->json('data');
        $this->assertSame(['event_dates' => false, 'members' => true, 'guests' => false, 'payment' => false], array_column($d['start_here'], 'done', 'key'));
        $a->postJson('/tasks', ['title' => 'Book tent'])->assertStatus(201);
        $recent = $a->get('/dashboard')->json('data.recent_activity');
        $this->assertSame('Ayush added Book tent.', $recent[0]['sentence']);
        $this->assertLessThanOrEqual(10, count($recent));
    }

    /** DATABASE §7 "Results below are from the demo data": Mummy (user 3) at 2:00 PM IST on 8 Oct 2026. */
    #[Endpoint('GET /dashboard')]
    public function test_documented_demo_results(): void
    {
        TestDb::rebuild('am_test_demo', false);
        $r = TestDb::runFile(TestDb::connect('am_test_demo'), TestDb::root() . '/db/dev/seed_demo.sql');
        $this->assertNull($r['error'], (string) $r['error']);
        try {
            $this->clock->set('2026-10-08T08:30:00Z');
            $c = new ApiClient($this->makeApp(['DB_NAME' => 'am_test_demo']));
            $c->login('+919829000003', 'demo-1234')->assertStatus(200);
            $d = $c->get('/dashboard')->assertStatus(200)->json('data');
            $today = array_values(array_filter($d['my_tasks']['items'], static fn ($t) => !$t['overdue']));
            $this->assertSame(['Call Mama ji about Mayra arrangements'], array_column($today, 'title'), '§7.1: 1 row');
            $this->assertSame('18:00', $today[0]['due_time']);
            $this->assertSame(4, $d['overdue']['total'], '§7.2: 4 rows');
            $this->assertSame(5, $d['payments_due']['total'], '§7.3: 5 payments');
            $this->assertSame(52000000, $d['payments_due']['total_paise'], '§7.3: ₹5,20,000');
            $this->assertSame(1, count(array_filter($d['payments_due']['items'], static fn ($p) => $p['overdue'])), '§7.3: one overdue (tent, 6 Oct)');
            $this->assertSame([400000000, 79535000, 168000000], [$d['budget']['planned_paise'], $d['budget']['spent_paise'], $d['budget']['still_to_pay_paise']], '§7.5 totals');
        } finally {
            TestDb::server()->exec('DROP DATABASE IF EXISTS am_test_demo');
        }
    }
}
