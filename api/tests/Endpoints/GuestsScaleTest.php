<?php
declare(strict_types=1);

namespace Tests\Endpoints;

use Tests\Support\ApiClient;
use Tests\Support\ApiTestCase;
use Tests\Support\Endpoint;
use Tests\Support\TestDb;

/** Headcount on the demo data (DATABASE §7.4) and the guest list with 2,000 families (TESTING §7.1). */
final class GuestsScaleTest extends ApiTestCase
{
    #[Endpoint('GET /events/{id}/headcount')]
    public function test_headcount_matches_database_7_4_on_demo_data(): void
    {
        TestDb::rebuild('am_test_demo', false);
        $pdo = TestDb::connect('am_test_demo');
        $r = TestDb::runFile($pdo, TestDb::root() . '/db/dev/seed_demo.sql');
        $this->assertNull($r['error'], (string) $r['error']);
        try {
            $this->clock->set('2026-10-08T08:30:00Z');
            $c = new ApiClient($this->makeApp(['DB_NAME' => 'am_test_demo']));
            $c->login('+919829000003', 'demo-1234')->assertStatus(200);
            // The documented query, word for word in its sums.
            $expected = $pdo->query(
                "SELECT e.public_id, COUNT(he.id) AS families_invited, COALESCE(SUM(he.rsvp = 'coming'), 0) AS families_coming,
                   COALESCE(SUM(CASE WHEN he.rsvp = 'coming' THEN COALESCE(he.expected_adults, h.adults) + COALESCE(he.expected_children, h.children) END), 0) AS people_coming,
                   COALESCE(SUM(CASE WHEN he.rsvp = 'waiting' THEN COALESCE(he.expected_adults, h.adults) + COALESCE(he.expected_children, h.children) END), 0) AS people_waiting,
                   COALESCE(SUM(CASE WHEN he.rsvp = 'not_asked' THEN COALESCE(he.expected_adults, h.adults) + COALESCE(he.expected_children, h.children) END), 0) AS people_not_asked,
                   COALESCE(SUM(he.rsvp = 'not_coming'), 0) AS families_not_coming,
                   COALESCE(SUM(CASE WHEN he.rsvp = 'coming' THEN CASE h.food
                       WHEN 'jain' THEN COALESCE(he.expected_adults, h.adults) + COALESCE(he.expected_children, h.children)
                       WHEN 'mixed' THEN LEAST(h.jain_count, COALESCE(he.expected_adults, h.adults) + COALESCE(he.expected_children, h.children))
                       ELSE 0 END END), 0) AS jain_coming
                 FROM events e LEFT JOIN (household_events he JOIN households h ON h.id = he.household_id AND h.deleted_at IS NULL)
                   ON he.event_id = e.id AND he.deleted_at IS NULL
                 WHERE e.deleted_at IS NULL AND e.guests_invited = 1 GROUP BY e.id, e.public_id ORDER BY e.id",
            )->fetchAll(\PDO::FETCH_ASSOC);
            $this->assertNotEmpty($expected);
            foreach ($expected as $row) {
                $h = $c->get('/events/' . $row['public_id'] . '/headcount')->assertStatus(200)->json('data');
                foreach (array_diff_key($row, ['public_id' => 1]) as $k => $v) {
                    $this->assertSame((int) $v, $h[$k], "$k for {$h['event']['name']}");
                }
            }
            $wedding = $pdo->query("SELECT public_id FROM events WHERE type = 'wedding' AND deleted_at IS NULL")->fetchColumn();
            $this->assertSame(60, $c->get("/events/$wedding/headcount")->json('data.families_invited'), 'the deleted family is not counted (60, not 61)');
            $deleted = $pdo->query('SELECT name FROM households WHERE deleted_at IS NOT NULL')->fetchAll(\PDO::FETCH_COLUMN);
            $listed = array_column($c->get('/households', ['limit' => '200'])->json('data'), 'name');
            $this->assertSame([], array_values(array_intersect($deleted, $listed)), 'SEC-07: deleted family not on the list');
        } finally {
            TestDb::server()->exec('DROP DATABASE IF EXISTS am_test_demo');
        }
    }

    #[Endpoint('GET /households')]
    public function test_list_of_50_with_2000_families_under_300ms(): void
    {
        $db = $this->db();
        $events = array_map('intval', array_column($db->all('SELECT id FROM events WHERE guests_invited = 1 ORDER BY id'), 'id'));
        $areas = ['Shastri Nagar', 'Subhash Nagar', 'Azad Nagar', 'Bapu Nagar', 'RC Vyas Colony'];
        $sides = ['bride', 'groom', 'both'];
        $values = [];
        $params = [];
        for ($i = 1; $i <= 2000; $i++) {
            $values[] = '(?, ?, ?, ?, ?, ?, ?, ?, 1, 1)';
            array_push($params, $i + 10000, sprintf('01JB%022d', $i), "Family $i", "family $i", sprintf('+9198%08d', $i), $sides[$i % 3], $areas[$i % 5], 1 + $i % 4);
            if (count($values) === 500) {
                $db->run('INSERT INTO households (id, public_id, name, name_norm, phone, side, area, adults, created_by, updated_by) VALUES ' . implode(',', $values), $params);
                $values = $params = [];
            }
        }
        $inv = [];
        $n = 0;
        foreach (range(10001, 12000) as $hid) {
            foreach ($events as $k => $eid) {
                if (($hid + $k) % 2 === 0 || $k < 2) { // ~3.5 invitations per family
                    $inv[] = "($hid, $eid, '" . ['not_asked', 'waiting', 'coming', 'not_coming'][($hid + $k) % 4] . "')";
                    $n++;
                }
            }
        }
        foreach (array_chunk($inv, 1000) as $chunk) {
            $db->run('INSERT INTO household_events (household_id, event_id, rsvp) VALUES ' . implode(',', $chunk));
        }
        $this->assertGreaterThanOrEqual(6000, $n);
        $c = $this->loginAs('mummy');
        $c->get('/households'); // warm up
        foreach ([[], ['q' => 'Family 19'], ['side' => 'groom'], ['event' => '01M4DK5T3H1KPRF5DMTQJ2GCYG', 'rsvp' => 'coming'], ['sort' => 'area']] as $q) {
            $t = hrtime(true);
            $res = $c->get('/households', $q)->assertStatus(200);
            $ms = (hrtime(true) - $t) / 1e6;
            $this->assertLessThanOrEqual(300, $ms, 'list ' . json_encode($q) . " took {$ms} ms");
            $this->assertLessThanOrEqual(50, count($res->json('data')));
        }
        $this->assertSame(2000, $c->get('/households')->json('meta.total'));
    }
}
