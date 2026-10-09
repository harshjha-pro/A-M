<?php
declare(strict_types=1);

namespace Tests\Endpoints;

use Tests\Support\ApiClient;
use Tests\Support\ApiTestCase;
use Tests\Support\Endpoint;

/** Record History, Activity, backups and the admin health view (FEATURES A5, B10; API.md §6, §11). */
final class HistoryActivityTest extends ApiTestCase
{
    #[Endpoint('GET /{resource}/{id}/history')]
    public function test_record_history_in_plain_sentences(): void
    {
        $ayush = $this->loginAs('ayush');
        $id = $ayush->postJson('/restore-drills', ['done_on' => '2026-10-05', 'result' => 'failed'])->assertStatus(201)->json('data.id');
        $this->clock->advance('+1 minute');
        $ayush->patchJson("/restore-drills/$id", ['result' => 'passed', 'notes' => 'Second try worked'], 1)->assertStatus(200);
        $this->clock->advance('+1 minute');
        $ayush->patchJson("/restore-drills/$id", ['done_on' => '2026-10-06'], 2)->assertStatus(200);
        $this->clock->advance('+1 minute');
        $batch = $ayush->request('DELETE', "/restore-drills/$id", null, [], [], ['ifMatch' => 3])->json('meta.undo.batch_id');
        $ayush->postJson("/undo/$batch", new \stdClass())->assertStatus(200);

        $res = $ayush->get("/restore-drills/$id/history")->assertStatus(200)->assertEnvelope();
        $this->assertSame([
            'Ayush brought back Restore drill · 6 Oct 2026 (Undo).',
            'Ayush deleted Restore drill · 6 Oct 2026.',
            'Ayush changed Date from 5 Oct 2026 to 6 Oct 2026 for Restore drill · 6 Oct 2026.',
            'Ayush changed Result and Notes for Restore drill · 5 Oct 2026.', // named as it was then,
            'Ayush added Restore drill · 5 Oct 2026.',
        ], array_column($res->json('data'), 'sentence'));
        $this->assertSame($batch, $res->json('data.1.batch_id'));
        $this->assertSame(['field' => 'result', 'label' => 'Result', 'from' => 'failed', 'to' => 'passed'], $res->json('data.3.changes.0'));
        $this->assertSame('Android · browser', $res->json('data.0.device'));

        $this->loginAs('papa')->get("/restore-drills/$id/history")->assertStatus(403);
        $ayush->get('/restore-drills/01JA6ZZZZZZZZZZZZZZZZZZZZZ/history')->assertStatus(404);
        $ayush->get("/nothing-here/$id/history")->assertStatus(404);
        $ayush->get("/restore-drills/$id/history", ['cursor' => 'x'])->assertStatus(400)->assertErrorCode('bad_cursor');
    }

    #[Endpoint('GET /{resource}/{id}/history')]
    public function test_member_history_hides_admin_fields_from_family(): void
    {
        $ayush = $this->loginAs('ayush');
        $v = $this->memberVersion('mummy');
        $ayush->patchJson('/members/' . $this->pid('mummy'), ['can_see_money' => true], $v)->assertStatus(200);
        $ayush->patchJson('/members/' . $this->pid('mummy'), ['name' => 'Mummy ji'], $v + 1)->assertStatus(200);

        $admin = array_column($ayush->get('/members/' . $this->pid('mummy') . '/history')->assertStatus(200)->json('data'), 'sentence');
        $this->assertSame('Ayush changed Name from Mummy to Mummy ji for Mummy ji.', $admin[0]);
        $this->assertSame('Ayush changed Can see money from No to Yes for Mummy.', $admin[1]);

        $family = $this->loginAs('papa')->get('/members/' . $this->pid('mummy') . '/history')->assertStatus(200)->json('data');
        $this->assertSame('Ayush changed Name from Mummy to Mummy ji for Mummy ji.', $family[0]['sentence']);
        $this->assertSame([], $family[1]['changes'], 'money access change not shown to family');
        $this->assertStringNotContainsString('money', strtolower($family[1]['sentence']));
    }

    #[Endpoint('GET /activity')]
    public function test_activity_feed_for_admins_with_filters(): void
    {
        $ayush = $this->loginAs('ayush');
        $ayush->patchJson('/settings', ['city' => 'Udaipur'], 1)->assertStatus(200);
        $this->clock->advance('+1 day');
        $mahi = $this->loginAs('mahi');
        $mahi->patchJson('/settings', ['total_budget_paise' => 12500000], 2)->assertStatus(200);
        $mahi->postJson('/restore-drills', ['done_on' => '2026-10-09', 'result' => 'passed'])->assertStatus(201);

        $all = $ayush->get('/activity')->assertStatus(200)->assertEnvelope()->json('data');
        $sentences = array_column($all, 'sentence');
        $this->assertSame('Mahi added Restore drill · 9 Oct 2026.', $sentences[0]);
        $this->assertSame('Mahi changed Total budget from (empty) to ₹1,25,000.', $sentences[1]);
        $this->assertContains('Ayush changed City from Bhilwara to Udaipur.', $sentences);

        $onlyMahi = $ayush->get('/activity', ['user' => $this->pid('mahi')])->json('data');
        $this->assertSame(['Mahi'], array_values(array_unique(array_map(fn ($l) => $l['user']['name'], $onlyMahi))));
        $types = array_map(fn ($l) => $l['entity']['type'], $ayush->get('/activity', ['type' => 'settings'])->json('data'));
        $this->assertSame(['settings'], array_values(array_unique($types)));
        $this->assertSame(['create'], array_values(array_unique(array_column($ayush->get('/activity', ['action' => 'create'])->json('data'), 'action'))));
        $day1 = array_column($ayush->get('/activity', ['from' => '2026-10-08', 'to' => '2026-10-08'])->json('data'), 'sentence');
        $this->assertContains('Ayush changed City from Bhilwara to Udaipur.', $day1);
        $this->assertNotContains('Mahi added Restore drill · 9 Oct 2026.', $day1);

        $p1 = $ayush->get('/activity', ['limit' => '2'])->json();
        $this->assertTrue($p1['meta']['has_more']);
        $p2 = $ayush->get('/activity', ['limit' => '2', 'cursor' => $p1['meta']['next_cursor']])->assertStatus(200)->json('data');
        $this->assertNotSame($p1['data'][0]['at'] . $p1['data'][0]['sentence'], $p2[0]['at'] . $p2[0]['sentence']);
        $ayush->get('/activity', ['limit' => '2', 'user' => $this->pid('mahi'), 'cursor' => $p1['meta']['next_cursor']])->assertStatus(400)->assertErrorCode('bad_cursor');

        $this->loginAs('papa')->get('/activity')->assertStatus(403); // AC-ACT-04
    }

    #[Endpoint('GET /activity')]
    public function test_activity_hides_money_from_admins_without_money(): void
    {
        // Admins always see money (CONTEXT), so the rule is checked through History directly for a non-money viewer.
        $ayush = $this->loginAs('ayush');
        $ayush->patchJson('/settings', ['total_budget_paise' => 12500000, 'city' => 'Udaipur'], 1)->assertStatus(200);
        $a = $this->row("SELECT a.*, NULL AS batch_public_id FROM audit_log a WHERE entity_type = 'settings' ORDER BY id DESC LIMIT 1");
        $refs = new \AM\Repo\Refs($this->db(), '2026-10-08');
        $line = \AM\Safety\History::line($refs, $a, \AM\Modules\Settings\SettingsDef::class, ['id' => 4, 'role' => 'family', 'can_see_money' => 0]);
        $this->assertSame('Ayush changed City from Bhilwara to Udaipur.', $line['sentence']);
        $this->assertSame(['city'], array_column($line['changes'], 'field'));
    }

    #[Endpoint('GET /backups')]
    public function test_backups_list_for_the_safety_card(): void
    {
        $db = $this->db();
        $db->run("INSERT INTO backup_runs (kind, status, started_at, finished_at, file_name, size_bytes, destination, error) VALUES
            ('nightly_db', 'ok', '2026-10-06 20:47:00', '2026-10-06 20:47:30', 'wedding_20261007_0217.sql.gz.enc', 2048, 'gdrive:A&M backups', NULL),
            ('nightly_db', 'failed', '2026-10-07 20:47:00', '2026-10-07 20:48:00', NULL, NULL, NULL, 'Drive quota full')");
        try {
            $ayush = $this->loginAs('ayush');
            $res = $ayush->get('/backups')->assertStatus(200)->assertEnvelope();
            $this->assertSame(['failed', 'ok'], array_column($res->json('data'), 'status'));
            $this->assertSame('Drive quota full', $res->json('data.0.error'));
            $this->assertSame('2026-10-06T20:47:30Z', $res->json('data.1.finished_at'));
            $this->assertSame(2048, $res->json('data.1.size_bytes'));
            $this->assertCount(1, $ayush->get('/backups', ['limit' => '1'])->json('data'));
            $ayush->get('/backups', ['limit' => '61'])->assertStatus(400);
            $ayush->get('/backups', ['limit' => '0'])->assertStatus(400);
            $this->loginAs('papa')->get('/backups')->assertStatus(403);
        } finally {
            $db->run('DELETE FROM backup_runs');
        }
    }

    #[Endpoint('GET /health')]
    public function test_logged_in_admin_sees_every_check(): void
    {
        $ayush = $this->loginAs('ayush');
        $id = $ayush->postJson('/restore-drills', ['done_on' => '2026-10-01', 'result' => 'passed'])->json('data.id');
        $ayush->request('DELETE', "/restore-drills/$id", null, [], [], ['ifMatch' => 1])->assertStatus(200);
        $res = $ayush->get('/health')->assertStatus(200)->assertEnvelope();
        $d = $res->json('data');
        $this->assertSame(trim((string) file_get_contents(dirname(__DIR__, 3) . '/VERSION')), $d['app_version']);
        foreach (['database', 'storage', 'backup', 'audit_log', 'restore_drill', 'reminders', 'last_export'] as $k) {
            $this->assertArrayHasKey($k, $d['checks']);
        }
        $this->assertSame('green', $d['checks']['storage']['status']);
        $this->assertGreaterThan(0, $d['checks']['storage']['db_bytes']);
        $this->assertSame('not_in_use', $d['checks']['restore_drill']['status'], 'the only passed drill is deleted');
        $this->assertSame(1, $d['trash_batches']);
        $this->assertSame('2026-10-08T09:12:31Z', $d['server_time']);
        $this->assertMatchesRegularExpression('/^8\.\d+$/', $d['php_version']);

        // Family and anonymous still get only ok/fail.
        $this->assertSame('{"status":"ok"}', $this->loginAs('papa')->get('/health')->body());
        $this->assertSame('{"status":"ok"}', (new ApiClient($this->app))->get('/health')->body());
    }
}
