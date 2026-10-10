<?php
declare(strict_types=1);

namespace Tests\Endpoints;

use Tests\Support\ApiClient;
use Tests\Support\ApiTestCase;
use Tests\Support\Endpoint;

/**
 * GET /sync — the offline cache (API.md §9.2, PWA.md §5.1, TESTING §1.3 /sync row, SEC-07).
 * Rows look exactly like the normal endpoints' rows and are filtered by the same rules.
 */
final class SyncTest extends ApiTestCase
{
    private const MEHNDI = '01M4DK5T3E6QZBMNQ0V7KQWW23';
    private const TENT_VENDOR = '01JA6ZB0000000000000000001';

    private function family(ApiClient $c, string $name): array
    {
        return $c->postJson('/households', ['name' => $name, 'side' => 'groom', 'adults' => 2])->assertStatus(201)->json('data');
    }

    private function jpeg(int $seed): string
    {
        $im = imagecreatetruecolor(20, 20);
        imagefill($im, 0, 0, imagecolorallocate($im, $seed * 40 % 255, 90, 120));
        ob_start();
        imagejpeg($im, null, 80);
        return (string) ob_get_clean();
    }

    /** Every page of one sync, merged. */
    private function all(ApiClient $c, array $query = []): array
    {
        $pages = [];
        $cursor = null;
        do {
            $d = $c->get('/sync', $query + ($cursor ? ['cursor' => $cursor] : []))->assertStatus(200)->assertEnvelope()->json('data');
            $pages[] = $d;
            $cursor = $d['cursor'];
        } while ($d['has_more']);
        $merged = $pages[0];
        foreach (array_slice($pages, 1) as $p) {
            foreach ($p['changes'] as $t => $rows) {
                if (is_array($rows) && array_is_list($rows)) {
                    $merged['changes'][$t] = array_merge($merged['changes'][$t] ?? [], $rows);
                }
            }
        }
        $merged['pages'] = count($pages);
        return $merged;
    }

    #[Endpoint('GET /sync')]
    public function test_full_snapshot_rows_match_the_normal_endpoints(): void
    {
        $ayush = $this->loginAs('ayush');
        $fam = $this->family($ayush, 'Sharma Family');
        $ayush->request('PUT', "/households/{$fam['id']}/invitations/" . self::MEHNDI, '{}')->assertStatus(201);
        $task = $ayush->postJson('/tasks', ['title' => 'Book the band'])->assertStatus(201)->json('data');
        $ayush->postJson("/tasks/{$task['id']}/items", ['key' => '5b1f0b52-3a2d-4c1e-9f00-000000013001', 'text' => 'Call Raju'])->assertStatus(201);

        $d = $this->all($ayush);
        $this->assertSame('2026-10-08T09:12:31Z', $d['server_time']);
        $this->assertSame('2026-10-08T09:10:31Z', $d['next_since'], 'server_time − 120 s');
        $this->assertFalse($d['full_resync_required']);
        $this->assertSame([], $d['deleted']);
        $this->assertSame(['settings', 'members', 'events', 'tags', 'budget_categories', 'households', 'tasks', 'vendors', 'payments', 'documents'], array_keys($d['changes']));

        // Same shape as the screens get online
        $listed = $ayush->get('/households')->json('data.0');
        $this->assertSame($listed, $d['changes']['households'][0]);
        $this->assertSame($ayush->get("/tasks/{$task['id']}")->json('data'), $d['changes']['tasks'][0]);
        $this->assertSame('Call Raju', $d['changes']['tasks'][0]['items'][0]['text']);
        $this->assertSame($ayush->get('/events/' . self::MEHNDI)->json('data'), array_values(array_filter($d['changes']['events'], static fn ($e) => $e['id'] === self::MEHNDI))[0]);
        $this->assertSame($ayush->get('/vendors/' . self::TENT_VENDOR)->json('data'), $d['changes']['vendors'][0]);
        $this->assertSame($ayush->get('/settings')->json('data'), $d['changes']['settings']);
        $this->assertSame($ayush->get('/members')->json('data.0.name') !== null, true);
        $this->assertCount(count($ayush->get('/members')->json('data')), $d['changes']['members']);
    }

    #[Endpoint('GET /sync')]
    public function test_since_sends_only_changes_children_resend_parents_and_lists_deletions(): void
    {
        $ayush = $this->loginAs('ayush');
        $a = $this->family($ayush, 'Agarwal Family');
        $b = $this->family($ayush, 'Bansal Family');
        $c = $this->family($ayush, 'Chopra Family');
        $task = $ayush->postJson('/tasks', ['title' => 'Order sweets'])->assertStatus(201)->json('data');
        $this->clock->advance('+3 minutes'); // past the 2-minute overlap, so the next sync is only what changes after this one
        $first = $this->all($ayush);
        $this->assertCount(3, $first['changes']['households']);

        $this->clock->advance('+10 minutes'); // well past the 2-minute overlap
        // An invitation added to A → A comes again; B deleted → in deleted; a checklist line on the task → the task again.
        $ayush->request('PUT', "/households/{$a['id']}/invitations/" . self::MEHNDI, '{}')->assertStatus(201);
        $ayush->request('DELETE', "/households/{$b['id']}", null, ['if-match' => '"1"'])->assertStatus(200);
        $ayush->postJson("/tasks/{$task['id']}/items", ['key' => '5b1f0b52-3a2d-4c1e-9f00-000000013002', 'text' => 'Kaju katli'])->assertStatus(201);
        $this->clock->advance('+1 minute');

        $d = $this->all($ayush, ['since' => $first['next_since']]);
        $this->assertSame([$a['id']], array_column($d['changes']['households'], 'id'), 'only the family whose invitation changed');
        $this->assertCount(1, $d['changes']['households'][0]['invitations']);
        $this->assertSame([$task['id']], array_column($d['changes']['tasks'], 'id'));
        $this->assertSame([['type' => 'household', 'id' => $b['id']]], array_map(static fn ($x) => ['type' => $x['type'], 'id' => $x['id']], $d['deleted']));
        $this->assertNotContains($c['id'], array_column($d['changes']['households'], 'id'));
        $this->assertNotEmpty($d['changes']['events'], 'small sets always come whole');

        // Restored → changed again
        $this->clock->advance('+1 minute');
        $since = $d['next_since'];
        $this->clock->advance('+3 minutes');
        $ayush->request('POST', "/households/{$b['id']}/restore", '{}', ['if-match' => '"2"'])->assertStatus(200);
        $again = $this->all($ayush, ['since' => gmdate('Y-m-d\TH:i:s\Z', strtotime($since) + 120)]);
        $this->assertSame([$b['id']], array_column($again['changes']['households'], 'id'));
    }

    #[Endpoint('GET /sync')]
    public function test_pages_cover_every_row_once_with_one_server_time(): void
    {
        $ayush = $this->loginAs('ayush');
        for ($i = 1; $i <= 5; $i++) {
            $this->family($ayush, "Family $i");
        }
        $ayush->postJson('/tasks', ['title' => 'T1'])->assertStatus(201);
        $ayush->postJson('/tasks', ['title' => 'T2'])->assertStatus(201);
        $first = $ayush->get('/sync', ['limit' => '2'])->assertStatus(200)->json('data');
        $this->assertTrue($first['has_more']);
        $this->clock->advance('+5 seconds');
        $d = $this->all($ayush, ['limit' => '2']);
        $this->assertGreaterThanOrEqual(4, $d['pages']);
        $this->assertCount(5, $d['changes']['households']);
        $this->assertCount(5, array_unique(array_column($d['changes']['households'], 'id')));
        $this->assertCount(2, $d['changes']['tasks']);
        // A later page keeps the first page's server_time (so next_since never skips a change)
        $p2 = $ayush->get('/sync', ['limit' => '2', 'cursor' => $first['cursor']])->json('data');
        $this->assertSame($first['server_time'], $p2['server_time']);
        $ayush->get('/sync', ['cursor' => 'not-a-cursor'])->assertStatus(400);
        $ayush->get('/sync', ['limit' => '1001'])->assertStatus(400);
        $ayush->get('/sync', ['since' => 'yesterday'])->assertStatus(400);
        $ayush->get('/sync', ['types' => 'households,secrets'])->assertStatus(400);
        $only = $ayush->get('/sync', ['types' => 'events,households'])->json('data.changes');
        $this->assertSame(['events', 'households'], array_keys($only));
    }

    #[Endpoint('GET /sync')]
    public function test_sec07_money_and_private_documents_filtered_for_each_role(): void
    {
        $ayush = $this->loginAs('ayush');
        $pay = $ayush->postJson('/payments', ['title' => 'Tent advance', 'amount_paise' => 5000000, 'vendor_id' => self::TENT_VENDOR])->assertStatus(201)->json('data');
        $ayush->upload('/documents', $this->jpeg(1), 'bill.jpg', ['type' => 'receipt', 'payment_id' => $pay['id']])->assertStatus(201);
        $ayush->upload('/documents', $this->jpeg(2), 'id.jpg', ['type' => 'id', 'is_private' => 'true'])->assertStatus(201);
        $ayush->upload('/documents', $this->jpeg(3), 'contract.jpg', ['type' => 'contract'])->assertStatus(201);

        $admin = $this->all($ayush);
        $this->assertCount(3, $admin['changes']['documents']);
        $this->assertCount(1, $admin['changes']['payments']);
        $this->assertNotNull($admin['changes']['vendors'][0]['balance'] ?? null);

        $papa = $this->all($this->loginAs('papa')); // family + money
        $this->assertSame(['receipt', 'contract'], array_column($papa['changes']['documents'], 'type'), 'no private ID');
        $this->assertCount(1, $papa['changes']['payments']);

        foreach (['mummy', 'nani'] as $who) { // no money
            $d = $this->all($this->loginAs($who));
            $this->assertArrayNotHasKey('payments', $d['changes'], $who);
            $this->assertArrayNotHasKey('budget_categories', $d['changes'], $who);
            $this->assertSame(['contract'], array_column($d['changes']['documents'], 'type'), $who);
            $this->assertNull($d['changes']['vendors'][0]['balance'] ?? null, "$who: no vendor amounts");
            $this->assertNull($d['changes']['settings']['total_budget_paise'] ?? null, "$who: no budget");
            $this->assertStringNotContainsString('5000000', json_encode($d), "$who: no amounts anywhere");
            $this->assertSame($this->loginAs($who)->get('/members')->json('data'), $d['changes']['members'], "$who: members exactly like GET /members");
        }
        (new ApiClient($this->app))->get('/sync')->assertStatus(401);
    }

    #[Endpoint('GET /sync')]
    public function test_full_resync_when_too_old_or_this_person_changed(): void
    {
        $papa = $this->loginAs('papa');
        $first = $papa->get('/sync')->json('data');
        $this->clock->advance('+1 hour');
        $this->assertFalse($papa->get('/sync', ['since' => $first['next_since']])->json('data.full_resync_required'));
        // Money access turned off for Papa → rows he can no longer see can't be "deleted": start again
        $this->loginAs('ayush')->patchJson('/members/' . $this->pid('papa'), ['can_see_money' => false], 1)->assertStatus(200);
        $this->clock->advance('+1 minute');
        $papaAgain = $this->loginAs('papa');
        $r = $papaAgain->get('/sync', ['since' => $first['next_since']])->json('data');
        $this->assertTrue($r['full_resync_required']);
        $this->assertSame([], $r['changes']['households']);
        $this->assertTrue($papaAgain->get('/sync', ['since' => '2026-08-01T00:00:00Z'])->json('data.full_resync_required'), 'older than 30 days');
    }

    #[Endpoint('GET /sync')]
    public function test_thirty_syncs_per_five_minutes_and_later_pages_do_not_count(): void
    {
        $ayush = $this->loginAs('ayush');
        for ($i = 0; $i < 3; $i++) {
            $this->family($ayush, "Family $i");
        }
        $first = $ayush->get('/sync', ['limit' => '1'])->assertStatus(200)->json('data');
        for ($i = 0; $i < 29; $i++) {
            $ayush->get('/sync', ['types' => 'settings'])->assertStatus(200);
        }
        $ayush->get('/sync', ['limit' => '1', 'cursor' => $first['cursor']])->assertStatus(200); // a later page still works
        $ayush->get('/sync', ['types' => 'settings'])->assertStatus(429)->assertErrorCode('rate_limited');
    }

    public function test_size_500_families_3500_invitations_is_a_few_mb_and_fast(): void
    {
        $db = $this->db();
        $events = array_column($db->all('SELECT id FROM events WHERE deleted_at IS NULL ORDER BY id LIMIT 7'), 'id');
        $this->assertCount(7, $events);
        $values = [];
        for ($i = 1; $i <= 500; $i++) {
            $values[] = sprintf("('01JD%022d', 'परिवार %d Sharma', 'परिवार %d sharma', '+9197%08d', 'groom', 3, 1, 1)", $i, $i, $i, $i);
        }
        $db->pdo->exec('INSERT INTO households (public_id, name, name_norm, phone, side, adults, created_by, updated_by) VALUES ' . implode(',', $values));
        $db->pdo->exec('INSERT INTO household_events (household_id, event_id, rsvp, created_by, updated_by) SELECT h.id, e.id, \'waiting\', 1, 1 FROM households h CROSS JOIN events e WHERE h.public_id LIKE \'01JD%\' AND e.id IN (' . implode(',', $events) . ')');
        $this->assertSame(3500, $this->rows('household_events'));
        $ayush = $this->loginAs('ayush');
        $t = microtime(true);
        $d = $this->all($ayush);
        $secs = microtime(true) - $t;
        $bytes = strlen((string) json_encode($d));
        $this->assertCount(500, $d['changes']['households']);
        $this->assertLessThan(4 * 1024 * 1024, $bytes, 'about 2–3 MB');
        $this->assertLessThan(10, $secs);
        fwrite(STDERR, sprintf("\n[sync] 500 families + 3,500 invitations: %.1f MB in %d pages, %.2f s\n", $bytes / 1048576, $d['pages'], $secs));
    }
}
