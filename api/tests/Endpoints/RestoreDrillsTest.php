<?php
declare(strict_types=1);

namespace Tests\Endpoints;

use Tests\Support\ApiClient;
use Tests\Support\ApiTestCase;
use Tests\Support\Endpoint;

/**
 * /restore-drills — the first record type on the shared base code (FEATURES B10).
 * Covers the generic list / create / update / delete / restore routes.
 */
final class RestoreDrillsTest extends ApiTestCase
{
    /** @return array{0: ApiClient, 1: array} */
    private function drill(string $who = 'ayush', array $body = []): array
    {
        $c = $this->loginAs($who);
        $res = $c->postJson('/restore-drills', $body + ['done_on' => '2026-10-08', 'result' => 'passed', 'backup_file' => 'am-2026-10-07.sql.gz', 'notes' => 'All 31 tables matched.']);
        $res->assertStatus(201);
        return [$c, $res->json('data')];
    }

    #[Endpoint('POST /restore-drills')]
    public function test_admin_logs_a_drill_with_one_audit_row(): void
    {
        [, $d] = $this->drill();
        $this->assertSame(1, $d['version']);
        $this->assertSame('Ayush', $d['done_by']['name']);
        $this->assertMatchesRegularExpression('/^[0-9A-HJKMNP-TV-Z]{26}$/', $d['id']);
        $a = $this->db()->all("SELECT action, entity_version FROM audit_log WHERE entity_type = 'restore_drill'");
        $this->assertSame([['action' => 'create', 'entity_version' => '1']], array_map(fn ($r) => array_map('strval', $r), $a));
    }

    #[Endpoint('POST /restore-drills')]
    public function test_validation_and_permissions(): void
    {
        $ayush = $this->loginAs('ayush');
        $res = $ayush->postJson('/restore-drills', ['done_on' => '2026-10-09', 'result' => 'maybe', 'extra' => 1]);
        $res->assertStatus(422)->assertErrorCode('validation_failed');
        $this->assertSame("Pick today or an earlier date.", $res->json('error.fields.done_on'));
        $this->assertArrayHasKey('result', $res->json('error.fields'));
        $this->assertArrayHasKey('extra', $res->json('error.fields'));
        $this->loginAs('papa')->postJson('/restore-drills', ['done_on' => '2026-10-08', 'result' => 'passed'])->assertStatus(403);
        $this->assertSame(0, (int) $this->row('SELECT COUNT(*) n FROM restore_drills')['n']);
    }

    #[Endpoint('POST /restore-drills')]
    public function test_ds04_same_key_twice_makes_one_drill(): void
    {
        $c = $this->loginAs('mahi');
        $body = ['done_on' => '2026-10-01', 'result' => 'failed', 'notes' => 'Drive file was empty'];
        $one = $c->postJson('/restore-drills', $body, [], ['idem' => '5b1f0b52-3a2d-4c1e-9f00-0000000000a1'])->assertStatus(201);
        $two = $c->postJson('/restore-drills', $body, [], ['idem' => '5b1f0b52-3a2d-4c1e-9f00-0000000000a1'])->assertStatus(201);
        $this->assertSame('true', $two->header('Idempotent-Replayed'));
        $this->assertSame($one->json('data'), $two->json('data'));
        $this->assertSame(1, (int) $this->row('SELECT COUNT(*) n FROM restore_drills')['n']);
    }

    #[Endpoint('GET /restore-drills')]
    public function test_list_is_admin_only_and_hides_deleted(): void
    {
        [$c, $d] = $this->drill();
        $this->drill('mahi', ['done_on' => '2026-09-01']);
        $c->request('DELETE', '/restore-drills/' . $d['id'], null, [], [], ['ifMatch' => 1])->assertStatus(200);
        $list = $c->get('/restore-drills')->assertStatus(200)->assertEnvelope();
        $this->assertSame(1, $list->json('meta.total'));
        $this->assertSame('2026-09-01', $list->json('data.0.done_on'));
        $this->loginAs('papa')->get('/restore-drills')->assertStatus(403);
    }

    #[Endpoint('PATCH /restore-drills/{id}')]
    public function test_update_bumps_version_and_ds01_stale_version_changes_nothing(): void
    {
        [$c, $d] = $this->drill();
        $c->patchJson('/restore-drills/' . $d['id'], ['notes' => 'Checked twice'], 1)->assertStatus(200);
        $mahi = $this->loginAs('mahi');
        $before = $this->row('SELECT * FROM restore_drills');
        $audits = (int) $this->row('SELECT COUNT(*) n FROM audit_log')['n'];

        $res = $mahi->patchJson('/restore-drills/' . $d['id'], ['notes' => 'Old copy'], 1);
        $res->assertStatus(409)->assertErrorCode('version_conflict');
        $this->assertSame(2, $res->json('error.current_version'));
        $this->assertSame(['notes'], $res->json('error.changed_fields'));
        $this->assertSame($before, $this->row('SELECT * FROM restore_drills'), 'row byte-for-byte unchanged');
        $this->assertSame($audits, (int) $this->row('SELECT COUNT(*) n FROM audit_log')['n'], 'no audit row');
    }

    #[Endpoint('DELETE /restore-drills/{id}')]
    public function test_ds18_delete_is_soft_and_offers_undo_for_10_minutes(): void
    {
        [$c, $d] = $this->drill();
        $res = $c->request('DELETE', '/restore-drills/' . $d['id'], null, [], [], ['ifMatch' => 1])->assertStatus(200);
        $this->assertSame('Deleted Restore drill · 8 Oct 2026', $res->json('meta.undo.summary'));
        $this->assertSame('2026-10-08T09:22:31Z', $res->json('meta.undo.until'));
        $row = $this->row('SELECT deleted_at, deleted_by, delete_batch_id, version FROM restore_drills');
        $this->assertNotNull($row['deleted_at']);
        $this->assertSame('1', (string) $row['deleted_by']);
        $this->assertNotNull($row['delete_batch_id']);
        $this->assertSame('2', (string) $row['version']);
        $b = $this->row('SELECT * FROM change_batches WHERE id = ?', [$row['delete_batch_id']]);
        $this->assertSame($res->json('meta.undo.batch_id'), $b['public_id']);
        $this->assertSame(['delete', '1'], [$b['action'], (string) $b['item_count']]);
    }

    #[Endpoint('DELETE /restore-drills/{id}')]
    public function test_sec06_deleted_record_by_id(): void
    {
        [$c, $d] = $this->drill();
        $c->request('DELETE', '/restore-drills/' . $d['id'], null, [], [], ['ifMatch' => 1])->assertStatus(200);
        $c->patchJson('/restore-drills/' . $d['id'], ['notes' => 'x'], 2)->assertStatus(409)->assertErrorCode('record_deleted');
        $again = $c->request('DELETE', '/restore-drills/' . $d['id'], null, [], [], ['ifMatch' => 2]);
        $again->assertStatus(409)->assertErrorCode('record_deleted');
        $this->assertSame(1, (int) $this->row("SELECT COUNT(*) n FROM change_batches WHERE action = 'delete'")['n']);
        $c->request('DELETE', '/restore-drills/01JA6ZZZZZZZZZZZZZZZZZZZZZ', null, [], [], ['ifMatch' => 1])->assertStatus(404);
        $c->request('DELETE', '/restore-drills/' . $d['id'], null, [], [], [])->assertStatus(428);
    }

    #[Endpoint('DELETE /restore-drills/{id}')]
    public function test_ds05_a_retried_delete_is_a_replay(): void
    {
        [$c, $d] = $this->drill();
        $key = '5b1f0b52-3a2d-4c1e-9f00-0000000000b2';
        $one = $c->request('DELETE', '/restore-drills/' . $d['id'], null, [], [], ['ifMatch' => 1, 'idem' => $key])->assertStatus(200);
        $two = $c->request('DELETE', '/restore-drills/' . $d['id'], null, [], [], ['ifMatch' => 1, 'idem' => $key])->assertStatus(200);
        $this->assertSame('true', $two->header('Idempotent-Replayed'));
        $this->assertSame($one->json('meta.undo'), $two->json('meta.undo'));
        $this->assertSame('2', (string) $this->row('SELECT version FROM restore_drills')['version'], 'version bumped once');
    }

    #[Endpoint('POST /restore-drills/{id}/restore')]
    public function test_restore_one_record_admin_only_twice_is_fine(): void
    {
        [$c, $d] = $this->drill();
        $c->request('DELETE', '/restore-drills/' . $d['id'], null, [], [], ['ifMatch' => 1])->assertStatus(200);
        $this->loginAs('papa')->postJson('/restore-drills/' . $d['id'] . '/restore', new \stdClass(), [], ['ifMatch' => 2])->assertStatus(403);
        $c->postJson('/restore-drills/' . $d['id'] . '/restore', new \stdClass(), [], ['ifMatch' => 1])->assertStatus(409)->assertErrorCode('version_conflict');
        $res = $this->loginAs('mahi')->postJson('/restore-drills/' . $d['id'] . '/restore', new \stdClass(), [], ['ifMatch' => 2])->assertStatus(200);
        $this->assertSame(3, $res->json('data.version'));
        $this->assertSame([], $res->json('meta.warnings'));
        $this->assertNull($this->row('SELECT deleted_at FROM restore_drills')['deleted_at']);
        $again = $c->postJson('/restore-drills/' . $d['id'] . '/restore', new \stdClass(), [], ['ifMatch' => 2])->assertStatus(200);
        $this->assertTrue($again->json('meta.already_restored'));
        $this->assertSame(1, (int) $this->row("SELECT COUNT(*) n FROM audit_log WHERE action = 'restore'")['n']);
    }
}
