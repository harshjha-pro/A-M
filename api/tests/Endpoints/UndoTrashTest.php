<?php
declare(strict_types=1);

namespace Tests\Endpoints;

use Tests\Support\ApiClient;
use Tests\Support\ApiTestCase;
use Tests\Support\Endpoint;

/** POST /undo, /trash … — FEATURES A2 + B9, DS-11, DS-13, DS-14, SEC-08, SEC-32. */
final class UndoTrashTest extends ApiTestCase
{
    /** Columns compared after delete → undo/restore (DS-11). */
    private const SKIP = ['version', 'updated_at', 'updated_by', 'deleted_at', 'deleted_by', 'delete_batch_id'];

    /** @return array{0: ApiClient, 1: string drill id, 2: string batch id, 3: array row before} */
    private function deleted(string $who = 'ayush'): array
    {
        $c = $this->loginAs($who);
        $id = $c->postJson('/restore-drills', ['done_on' => '2026-10-02', 'result' => 'passed', 'backup_file' => 'राम शर्मा 🙂.sql.gz', 'notes' => "Line 1\nLine 2"])
            ->assertStatus(201)->json('data.id');
        $before = $this->row('SELECT * FROM restore_drills WHERE public_id = ?', [$id]);
        $this->clock->advance('+1 minute');
        $batch = $c->request('DELETE', "/restore-drills/$id", null, [], [], ['ifMatch' => 1])->assertStatus(200)->json('meta.undo.batch_id');
        return [$c, $id, $batch, $before];
    }

    private function assertSameExceptStamps(array $before, string $id): void
    {
        $after = $this->row('SELECT * FROM restore_drills WHERE public_id = ?', [$id]);
        foreach (self::SKIP as $k) {
            unset($before[$k], $after[$k]);
        }
        $this->assertSame($before, $after);
        $this->assertNull($this->row('SELECT deleted_at FROM restore_drills WHERE public_id = ?', [$id])['deleted_at']);
    }

    #[Endpoint('POST /undo/{batch_id}')]
    public function test_ds11_delete_then_undo_gives_back_the_same_row(): void
    {
        [$c, $id, $batch, $before] = $this->deleted();
        $this->clock->advance('+9 minutes');
        $res = $c->postJson("/undo/$batch", new \stdClass())->assertStatus(200)->assertEnvelope();
        $this->assertSame(['batch_id' => $batch, 'undone' => 1, 'skipped' => [], 'message' => 'Undone.', 'already_undone' => false], $res->json('data'));
        $this->assertSameExceptStamps($before, $id);
        $this->assertSame(1, $this->rows('audit_log', "action = 'undo'"));
        $this->assertNotNull($this->row('SELECT undone_at FROM change_batches WHERE public_id = ?', [$batch])['undone_at']);
    }

    #[Endpoint('POST /undo/{batch_id}')]
    public function test_ds13_undo_twice_and_too_late(): void
    {
        [$c, , $batch] = $this->deleted();
        $c->postJson("/undo/$batch", new \stdClass())->assertStatus(200);
        $again = $c->postJson("/undo/$batch", new \stdClass())->assertStatus(200);
        $this->assertTrue($again->json('data.already_undone'));
        $this->assertSame('This was already undone.', $again->json('data.message'));
        $this->assertSame(1, $this->rows('audit_log', "action = 'undo'"));

        [$c2, , $batch2] = $this->deleted('mahi');
        $this->clock->advance('+11 minutes');
        $late = $c2->postJson("/undo/$batch2", new \stdClass())->assertStatus(403)->assertErrorCode('undo_expired');
        $this->assertStringContainsString('Deleted items', $late->json('error.message'));
    }

    #[Endpoint('POST /undo/{batch_id}')]
    public function test_sec08_only_the_person_who_acted_can_undo(): void
    {
        [, $id, $batch] = $this->deleted('ayush');
        $res = $this->loginAs('mahi')->postJson("/undo/$batch", new \stdClass())->assertStatus(403)->assertErrorCode('forbidden');
        $this->assertStringStartsWith('Only the person who did this', $res->json('error.message'));
        $this->loginAs('mummy')->postJson("/undo/$batch", new \stdClass())->assertStatus(403);
        $this->assertNotNull($this->row('SELECT deleted_at FROM restore_drills WHERE public_id = ?', [$id])['deleted_at']);
        $this->loginAs('ayush')->postJson('/undo/01JA6ZZZZZZZZZZZZZZZZZZZZZ', new \stdClass())->assertStatus(404);
    }

    #[Endpoint('POST /undo/{batch_id}')]
    public function test_undo_skips_a_row_changed_since_and_names_it(): void
    {
        [$c, $id, $batch] = $this->deleted();
        // Mahi restores it from Deleted items and edits it before Ayush taps Undo.
        $mahi = $this->loginAs('mahi');
        $mahi->postJson("/trash/$batch/restore", new \stdClass())->assertStatus(200);
        $mahi->patchJson("/restore-drills/$id", ['notes' => 'Mahi checked'], 3)->assertStatus(200);
        $res = $c->postJson("/undo/$batch", new \stdClass())->assertStatus(200);
        $this->assertSame(0, $res->json('data.undone'));
        $this->assertSame('changed_since', $res->json('data.skipped.0.reason'));
        $this->assertSame('Mahi', $res->json('data.skipped.0.changed_by.name'));
        $this->assertSame('Restore drill · 2 Oct 2026', $res->json('data.skipped.0.name'));
        $this->assertSame('Undone. 1 restore drill was changed by someone else and was left as it is.', $res->json('data.message'));
        $this->assertSame('Mahi checked', $this->row('SELECT notes FROM restore_drills')['notes']);
    }

    #[Endpoint('POST /undo/{batch_id}')]
    public function test_ds05_a_retried_undo_is_a_replay(): void
    {
        [$c, , $batch] = $this->deleted();
        $key = '5b1f0b52-3a2d-4c1e-9f00-0000000000c3';
        $one = $c->postJson("/undo/$batch", new \stdClass(), [], ['idem' => $key])->assertStatus(200);
        $two = $c->postJson("/undo/$batch", new \stdClass(), [], ['idem' => $key])->assertStatus(200);
        $this->assertSame('true', $two->header('Idempotent-Replayed'));
        $this->assertSame($one->json('data'), $two->json('data'));
        $this->assertFalse($two->json('data.already_undone'));
    }

    #[Endpoint('GET /trash')]
    public function test_deleted_items_list_newest_first_with_filters(): void
    {
        [, , $b1] = $this->deleted('ayush');
        $this->clock->advance('+1 day');
        [, , $b2] = $this->deleted('mahi');
        $ayush = $this->loginAs('ayush');
        $list = $ayush->get('/trash')->assertStatus(200)->assertEnvelope();
        $this->assertSame([$b2, $b1], array_column($list->json('data'), 'batch_id'));
        $this->assertSame('Restore drill · 2 Oct 2026', $list->json('data.0.summary'));
        $this->assertSame('Mahi', $list->json('data.0.user.name'));
        $this->assertSame(1, $list->json('data.0.item_count'));

        $this->assertSame([$b1], array_column($ayush->get('/trash', ['user' => $this->pid('ayush')])->json('data'), 'batch_id'));
        $this->assertSame([$b2], array_column($ayush->get('/trash', ['from' => '2026-10-09'])->json('data'), 'batch_id'));
        $this->assertSame([$b1], array_column($ayush->get('/trash', ['to' => '2026-10-08'])->json('data'), 'batch_id'));
        $this->assertSame([], $ayush->get('/trash', ['type' => 'task'])->json('data'));

        $p1 = $ayush->get('/trash', ['limit' => '1'])->assertStatus(200);
        $this->assertTrue($p1->json('meta.has_more'));
        $p2 = $ayush->get('/trash', ['limit' => '1', 'cursor' => $p1->json('meta.next_cursor')]);
        $this->assertSame([$b1], array_column($p2->json('data'), 'batch_id'));
        $ayush->get('/trash', ['limit' => '1', 'type' => 'restore_drill', 'cursor' => $p1->json('meta.next_cursor')])->assertStatus(400)->assertErrorCode('bad_cursor');
        $ayush->get('/trash', ['from' => '8 Oct'])->assertStatus(400);

        $this->loginAs('papa')->get('/trash')->assertStatus(403); // AC-TRS-05
    }

    #[Endpoint('GET /trash/{batch_id}')]
    public function test_one_batch_shows_its_items(): void
    {
        [$c, $id, $batch] = $this->deleted();
        $res = $c->get("/trash/$batch")->assertStatus(200);
        $this->assertSame($batch, $res->json('data.batch.batch_id'));
        $this->assertSame([['type' => 'restore_drill', 'id' => $id, 'name' => 'Restore drill · 2 Oct 2026', 'child_count' => 0]], $res->json('data.items'));
        $c->get('/trash/01JA6ZZZZZZZZZZZZZZZZZZZZZ')->assertStatus(404);
        $this->loginAs('mummy')->get("/trash/$batch")->assertStatus(403);
    }

    #[Endpoint('POST /trash/{batch_id}/restore')]
    public function test_ds14_restore_after_11_minutes_from_deleted_items(): void
    {
        [, $id, $batch, $before] = $this->deleted();
        $this->clock->advance('+11 minutes');
        $this->loginAs('papa')->postJson("/trash/$batch/restore", new \stdClass())->assertStatus(403);
        $mahi = $this->loginAs('mahi');
        $res = $mahi->postJson("/trash/$batch/restore", new \stdClass())->assertStatus(200);
        $this->assertSame(1, $res->json('data.restored'));
        $this->assertFalse($res->json('data.already_restored'));
        $this->assertSameExceptStamps($before, $id);
        $again = $mahi->postJson("/trash/$batch/restore", new \stdClass())->assertStatus(200);
        $this->assertTrue($again->json('data.already_restored'));
        $this->assertSame([], $mahi->get('/trash')->json('data'), 'restored batches leave the list');
        $this->assertSame(1, $this->rows('audit_log', "action = 'restore'"));
    }

    #[Endpoint('POST /trash/{batch_id}/restore')]
    public function test_ds15_restore_only_that_batch_and_chosen_items(): void
    {
        [$c, $idA, $batchA] = $this->deleted();
        [, $idB, $batchB] = $this->deleted();
        $c->postJson("/trash/$batchB/restore", ['items' => [['type' => 'restore_drill', 'id' => $idB]]])->assertStatus(200);
        $this->assertNull($this->row('SELECT deleted_at FROM restore_drills WHERE public_id = ?', [$idB])['deleted_at']);
        $this->assertNotNull($this->row('SELECT deleted_at FROM restore_drills WHERE public_id = ?', [$idA])['deleted_at']);
        $c->postJson("/trash/$batchA/restore", ['items' => [['type' => 'restore_drill', 'id' => $idB]]])->assertStatus(404);
        $c->postJson("/trash/$batchA/restore", ['items' => []])->assertStatus(422);
        $c->postJson("/trash/$batchA/restore", ['what' => 1])->assertStatus(422);
    }

    #[Endpoint('DELETE /trash/{batch_id}')]
    public function test_sec32_purge_is_refused_and_nothing_is_removed(): void
    {
        [$c, $id, $batch] = $this->deleted();
        $this->clock->set('2027-05-15T10:00:00Z');
        $c = $this->loginAs('ayush');
        $c->request('DELETE', "/trash/$batch", json_encode(['confirm' => 'DELETE FOREVER', 'export_id' => '01JA6ZZZZZZZZZZZZZZZZZZZZZ']))
            ->assertStatus(403)->assertErrorCode('purge_not_allowed_yet');
        $this->loginAs('mahi')->request('DELETE', "/trash/$batch", '{}')->assertStatus(403)->assertErrorCode('forbidden');
        $this->clock->set('2027-06-01T10:00:00Z');
        $this->loginAs('ayush')->request('DELETE', "/trash/$batch", '{}')->assertStatus(403);
        $this->assertSame(1, $this->rows('restore_drills', 'public_id = ?', [$id]), 'row still exists');
    }
}
