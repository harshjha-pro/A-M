<?php
declare(strict_types=1);

namespace Tests\Endpoints;

use Tests\Support\ApiClient;
use Tests\Support\ApiTestCase;
use Tests\Support\Endpoint;
use Tests\Support\TestResponse;

/**
 * /imports… — FEATURES A8 (AC-IMP-01…09), API.md §6.7, TESTING §1.3 import row,
 * SEC-10 (Family can't import), DS-04 (same key twice → one import).
 */
final class GuestsImportTest extends ApiTestCase
{
    private const MEHNDI = '01M4DK5T3E6QZBMNQ0V7KQWW23';
    private const RECEPTION = '01M4DK5T3JCJAF3HDCPWRTYSHQ';

    private function body(array $rows, array $extra = []): array
    {
        return $extra + ['source' => 'xlsx', 'file_name' => 'AM_Guest_List.xlsx', 'defaults' => ['side' => 'groom'], 'rows' => array_map(
            static fn ($r, $i) => $r + ['row_no' => $i + 2], $rows, array_keys($rows))];
    }

    private function preview(ApiClient $c, array $rows, array $extra = []): TestResponse
    {
        return $c->postJson('/imports/preview', $this->body($rows, $extra));
    }

    private function existing(): void
    {
        $this->loginAs('ayush')->postJson('/households', ['name' => 'Sharma family', 'phone' => '9829012345', 'side' => 'groom', 'city' => 'Bhilwara'])->assertStatus(201);
    }

    #[Endpoint('POST /imports/preview')]
    public function test_preview_counts_statuses_and_writes_nothing(): void
    {
        $this->existing();
        $ayush = $this->loginAs('ayush');
        $before = [$this->rows('households'), $this->rows('audit_log'), $this->rows('change_batches')];
        $res = $this->preview($ayush, [
            ['name' => 'EXAMPLE Ramesh Sharma & family', 'phone' => '98290 00000'],
            ['name' => 'Ramesh Sharma', 'phone' => 9829012345],                    // AC-IMP-09: a number from Excel; same phone as Sharma family
            ['name' => 'Gupta ji', 'phone' => '9414011111', 'side' => 'ladkiwale', 'event_ids' => [self::MEHNDI, self::RECEPTION]],
            ['name' => 'Verma ji', 'phone' => '+91 94140 11111'],                  // AC-IMP-03: same phone as the row above
            ['name' => '', 'phone' => '12345'],
            ['name' => 'Jain sahab', 'food' => 'Jain', 'adults' => '3', 'children' => 1, 'is_vip' => 'Yes'],
        ])->assertStatus(200)->assertEnvelope();
        $this->assertSame(['new' => 1, 'duplicates' => 3, 'errors' => 1, 'skipped_examples' => 1], $res->json('data.counts'));
        $rows = $res->json('data.rows');
        $this->assertSame(['skipped_example', 'duplicate', 'duplicate', 'duplicate', 'error', 'new'], array_column($rows, 'status'));
        $this->assertSame('+919829012345', $rows[1]['normalised']['phone']);
        $this->assertSame('Sharma family', $rows[1]['matches'][0]['name']);
        $this->assertSame('phone', $rows[1]['matches'][0]['match_on']);
        $this->assertSame('bride', $rows[2]['normalised']['side'], 'ladkiwale = bride side');
        $this->assertSame(4, $rows[3]['matches'][0]['row_no']); // Gupta ji's row
        $this->assertSame(['name', 'phone'], array_keys($rows[4]['errors']));
        $this->assertEquals(['side' => 'groom', 'food' => 'jain', 'jain_count' => 4, 'is_vip' => true, 'city' => 'Bhilwara'],
            array_intersect_key($rows[5]['normalised'], array_flip(['side', 'food', 'jain_count', 'is_vip', 'city'])));
        $this->assertSame($before, [$this->rows('households'), $this->rows('audit_log'), $this->rows('change_batches')], 'preview writes nothing');

        $this->preview($this->loginAs('papa'), [['name' => 'x']])->assertStatus(403); // SEC-10
        $tooMany = array_fill(0, 3001, ['name' => 'x']);
        $this->preview($ayush, $tooMany)->assertStatus(422);
        $ayush->postJson('/imports/preview', ['source' => 'pdf', 'rows' => []])->assertStatus(422);
    }

    #[Endpoint('POST /imports')]
    public function test_ac_imp_01_04_08_run_with_decisions_one_batch_and_activity_line(): void
    {
        $this->existing();
        $this->db()->run("UPDATE households SET area = NULL, city = 'Bhilwara'");
        $ayush = $this->loginAs('ayush');
        $sharma = $this->row('SELECT public_id FROM households')['public_id'];
        $rows = [
            ['name' => 'EXAMPLE family', 'phone' => '98290 00000'],
            ['name' => 'Ramesh Sharma', 'phone' => '9829012345', 'area' => 'Shastri Nagar', 'city' => 'Udaipur', 'event_ids' => [self::MEHNDI], 'decision' => 'update_existing', 'update_target_id' => $sharma],
            ['name' => 'Gupta ji', 'phone' => '9414011111', 'event_ids' => [self::MEHNDI]],
            ['name' => 'Verma ji', 'phone' => '9414022222'],
            ['name' => '', 'decision' => 'skip'],
        ];
        $res = $ayush->postJson('/imports', $this->body($rows, ['defaults' => ['side' => 'groom', 'event_ids' => [self::RECEPTION]]]))->assertStatus(201);
        $this->assertSame(['rows_read' => 5, 'created_count' => 2, 'updated_count' => 1, 'skipped_count' => 1, 'error_count' => 1, 'invitations_count' => 5],
            array_intersect_key($res->json('data'), array_flip(['rows_read', 'created_count', 'updated_count', 'skipped_count', 'error_count', 'invitations_count'])));
        $this->assertSame('Imported 2 families from AM_Guest_List.xlsx', $res->json('meta.undo.summary'));
        $s = $this->row('SELECT area, city FROM households WHERE public_id = ?', [$sharma]);
        $this->assertSame(['area' => 'Shastri Nagar', 'city' => 'Bhilwara'], $s, 'AC-IMP-04: fills empty fields, never overwrites');
        $gupta = (int) $this->row("SELECT id FROM households WHERE name = 'Gupta ji'")['id'];
        $this->assertSame(2, $this->rows('household_events', 'household_id = ?', [$gupta]), 'AC-IMP-08: its own events + "invite everyone to"');
        $this->assertSame(0, $this->rows('households', "name LIKE 'EXAMPLE%'"));
        $this->assertSame(1, $this->rows('change_batches', "action = 'import'"));
        $lines = array_column($ayush->get('/activity')->json('data'), 'sentence');
        $this->assertSame('Ayush imported AM_Guest_List.xlsx (2 added · 1 updated · 1 skipped).', $lines[0]);
        $this->assertContains('Ayush added Gupta ji.', $lines);
        // An error row that isn't skipped → 422 and nothing imported.
        $before = $this->rows('households');
        $bad = $ayush->postJson('/imports', $this->body([['name' => 'Fine family'], ['name' => 'Bad phone', 'phone' => '123']]))->assertStatus(422);
        $this->assertArrayHasKey('rows.3', $bad->json('error.fields'));
        $this->assertSame($before, $this->rows('households'));
        // update_existing must point at one of the row's matches.
        $ayush->postJson('/imports', $this->body([['name' => 'X', 'phone' => '9829012345', 'decision' => 'update_existing', 'update_target_id' => '01JA7Q3M2K8V5R1T9W4X6Y0Z2B']]))->assertStatus(422);
        $this->loginAs('papa')->postJson('/imports', $this->body([['name' => 'x']]))->assertStatus(403);
    }

    #[Endpoint('POST /imports')]
    public function test_ac_imp_01_duplicates_default_to_skip_and_ds04_same_key_one_import(): void
    {
        $this->existing();
        $ayush = $this->loginAs('ayush');
        $rows = [['name' => 'A', 'phone' => '9829012345'], ['name' => 'B', 'phone' => '9414000001'], ['name' => 'C', 'phone' => '9414000002']];
        $key = '5b1f0b52-3a2d-4c1e-9f00-0000000008b1';
        $a = $ayush->postJson('/imports', $this->body($rows), [], ['idem' => $key])->assertStatus(201);
        $b = $ayush->postJson('/imports', $this->body($rows), [], ['idem' => $key])->assertStatus(201);
        $this->assertSame($a->json('data'), $b->json('data'));
        $this->assertSame(1, $this->rows('imports'));
        $this->assertSame(['created_count' => 2, 'skipped_count' => 1], array_intersect_key($a->json('data'), array_flip(['created_count', 'skipped_count'])));
        $add = [['name' => 'A again', 'phone' => '9829012345', 'decision' => 'add_anyway']];
        $this->assertSame(1, $ayush->postJson('/imports', $this->body($add))->assertStatus(201)->json('data.created_count'));
    }

    #[Endpoint('GET /imports')]
    public function test_list_imports_admin_only(): void
    {
        $ayush = $this->loginAs('ayush');
        $ayush->postJson('/imports', $this->body([['name' => 'One']]))->assertStatus(201);
        $ayush->postJson('/imports', $this->body([['name' => 'Two'], ['name' => 'Three']], ['source' => 'paste', 'file_name' => null]))->assertStatus(201);
        $list = $ayush->get('/imports')->assertStatus(200)->json('data');
        $this->assertSame([2, 1], array_column($list, 'created_count'));
        $this->assertSame([null, 'AM_Guest_List.xlsx'], array_column($list, 'file_name'));
        $this->assertSame('Ayush', $list[0]['created_by']['name']);
        $this->loginAs('papa')->get('/imports')->assertStatus(403);
    }

    #[Endpoint('GET /imports/{id}')]
    public function test_get_one_import(): void
    {
        $ayush = $this->loginAs('ayush');
        $id = $ayush->postJson('/imports', $this->body([['name' => 'One']]))->json('data.id');
        $this->assertSame(1, $ayush->get("/imports/$id")->assertStatus(200)->json('data.created_count'));
        $this->loginAs('papa')->get("/imports/$id")->assertStatus(403);
        $ayush->get('/imports/01JA7Q3M2K8V5R1T9W4X6Y0Z2B')->assertStatus(404);
    }

    #[Endpoint('POST /imports/{id}/undo')]
    public function test_ac_imp_05_undo_this_import_keeps_edited_families_and_reverts_updates(): void
    {
        $this->existing();
        $this->db()->run('UPDATE households SET area = NULL');
        $ayush = $this->loginAs('ayush');
        $sharma = $this->row('SELECT public_id FROM households')['public_id'];
        $res = $ayush->postJson('/imports', $this->body([
            ['name' => 'Sharma again', 'phone' => '9829012345', 'area' => 'Shastri Nagar', 'decision' => 'update_existing', 'update_target_id' => $sharma],
            ['name' => 'Gupta ji', 'event_ids' => [self::MEHNDI]],
            ['name' => 'Verma ji', 'event_ids' => [self::MEHNDI]],
        ]))->assertStatus(201);
        $verma = $this->row("SELECT public_id FROM households WHERE name = 'Verma ji'")['public_id'];
        $this->loginAs('mummy')->patchJson("/households/$verma", ['notes' => 'Called'], 1)->assertStatus(200); // edited after the import
        $this->clock->set('2026-10-10T09:00:00Z'); // two days later: no 10-minute limit here
        $ayush = $this->loginAs('ayush');
        $u = $ayush->postJson('/imports/' . $res->json('data.id') . '/undo', new \stdClass())->assertStatus(200);
        $this->assertSame([['type' => 'household', 'name' => 'Verma ji', 'reason' => 'changed_since']],
            array_map(static fn ($s) => array_intersect_key($s, array_flip(['type', 'name', 'reason'])), $u->json('data.skipped')));
        $this->assertSame('Undone. 1 family was changed since and was kept.', $u->json('data.message'));
        $this->assertSame(['Sharma family', 'Verma ji'], array_column($this->db()->all('SELECT name FROM households WHERE deleted_at IS NULL ORDER BY name'), 'name'));
        $this->assertNull($this->row('SELECT area FROM households WHERE public_id = ?', [$sharma])['area'], 'the filled area is taken back');
        $this->assertSame(1, $this->rows('household_events', 'deleted_at IS NULL'), "Verma's invitation stays with Verma");
        $this->assertNotNull($ayush->get('/imports/' . $res->json('data.id'))->json('data.undone_at'));
        $this->assertTrue($ayush->postJson('/imports/' . $res->json('data.id') . '/undo', new \stdClass())->json('data.already_undone'));
        $this->loginAs('papa')->postJson('/imports/' . $res->json('data.id') . '/undo', new \stdClass())->assertStatus(403);
    }

    /** 3,000 rows: preview and import inside the request time budget (TESTING §7.1 spirit). */
    public function test_three_thousand_rows(): void
    {
        $ayush = $this->loginAs('ayush');
        $rows = [];
        for ($i = 1; $i <= 3000; $i++) {
            $rows[] = ['name' => "Family $i", 'phone' => sprintf('94%08d', $i), 'event_ids' => [self::MEHNDI]];
        }
        $t = hrtime(true);
        $this->assertSame(3000, $ayush->postJson('/imports/preview', $this->body($rows))->assertStatus(200)->json('data.counts.new'));
        $t1 = (hrtime(true) - $t) / 1e9;
        $t = hrtime(true);
        $this->assertSame(3000, $ayush->postJson('/imports', $this->body($rows))->assertStatus(201)->json('data.created_count'));
        $t2 = (hrtime(true) - $t) / 1e9;
        fwrite(STDERR, sprintf("[3000 rows: preview %.2f s, import %.2f s]\n", $t1, $t2));
        $this->assertLessThan(5, $t1, "preview took {$t1} s");
        $this->assertLessThan(25, $t2, "import took {$t2} s");
        $this->assertSame(3000, $this->rows('household_events'));
    }
}
