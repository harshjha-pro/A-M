<?php
declare(strict_types=1);

namespace Tests\Endpoints;

use AM\Kernel\Uuid;
use Tests\Support\ApiClient;
use Tests\Support\ApiTestCase;
use Tests\Support\Endpoint;

/** Checklist items (/tasks/{id}/items…) and tags (/tags…) — FEATURES B3, API.md §6.5. */
final class TaskItemsTagsTest extends ApiTestCase
{
    private function task(ApiClient $c, array $body = []): array
    {
        return $c->postJson('/tasks', $body + ['title' => 'Shopping list', 'allow_duplicate' => true])->assertStatus(201)->json('data');
    }

    private function tagId(string $name): string
    {
        return (string) $this->row('SELECT public_id FROM tags WHERE name = ? AND deleted_at IS NULL', [$name])['public_id'];
    }

    #[Endpoint('POST /tasks/{id}/items')]
    public function test_add_item_with_its_key_retry_returns_the_same(): void
    {
        $c = $this->loginAs('mummy');
        $t = $this->task($c);
        $key = Uuid::v4();
        $one = $c->postJson('/tasks/' . $t['id'] . '/items', ['key' => $key, 'text' => 'Kesar'], ['idempotency-key' => $key])->assertStatus(201);
        $this->assertSame(['key' => $key, 'version' => 1, 'text' => 'Kesar', 'is_done' => false, 'sort_order' => 0, 'done_by' => null, 'done_at' => null], $one->json('data'));
        $c->postJson('/tasks/' . $t['id'] . '/items', ['key' => Uuid::v4(), 'text' => 'Elaichi'])->assertStatus(201);
        $this->assertSame(1, $c->postJson('/tasks/' . $t['id'] . '/items', ['key' => Uuid::v4(), 'text' => 'Pista'])->json('data.sort_order') - 1);
        // Same item key again with a new request key: the existing item, not a second one.
        $c->postJson('/tasks/' . $t['id'] . '/items', ['key' => $key, 'text' => 'Kesar'])->assertStatus(200);
        $this->assertSame(3, $this->rows('task_items'));
        $c->postJson('/tasks/' . $t['id'] . '/items', ['key' => 'nope', 'text' => ''])->assertStatus(422);
        $this->loginAs('nani')->postJson('/tasks/' . $t['id'] . '/items', ['key' => Uuid::v4(), 'text' => 'x'])->assertStatus(403);
        $other = $this->task($c, ['title' => 'Other']);
        $c->postJson('/tasks/' . $other['id'] . '/items', ['key' => $key, 'text' => 'Kesar'])->assertStatus(422);
    }

    #[Endpoint('PATCH /tasks/{id}/items/{key}')]
    public function test_tick_uses_the_items_version_and_says_when_all_are_done(): void
    {
        $a = $this->loginAs('ayush');
        [$k1, $k2] = [Uuid::v4(), Uuid::v4()];
        $t = $this->task($a, ['items' => [['key' => $k1, 'text' => 'Rings'], ['key' => $k2, 'text' => 'Bangles']]]);
        $path = '/tasks/' . $t['id'] . '/items/';
        $r1 = $a->patchJson($path . $k1, ['is_done' => true], 1)->assertStatus(200);
        $this->assertTrue($r1->json('data.is_done'));
        $this->assertSame('Ayush', $r1->json('data.done_by.name'));
        $this->assertArrayNotHasKey('last_item_done', $r1->json('meta'));
        $mummy = $this->loginAs('mummy');
        $mummy->patchJson($path . $k1, ['text' => 'Gold rings'], 1)->assertStatus(409)->assertErrorCode('version_conflict'); // DS-01 on items
        $r2 = $mummy->patchJson($path . $k2, ['is_done' => true], 1)->assertStatus(200);
        $this->assertTrue($r2->json('meta.last_item_done'));
        $this->assertSame('1', (string) $this->row('SELECT version FROM tasks')['version'], 'ticking does not move the task version');
        $back = $mummy->patchJson($path . $k2, ['is_done' => false], 2)->assertStatus(200);
        $this->assertNull($back->json('data.done_at'));
        $a->patchJson($path . Uuid::v4(), ['is_done' => true], 1)->assertStatus(404);
        $a->patchJson($path . $k1, [], 2)->assertStatus(422);
        $lines = array_column($a->get('/tasks/' . $t['id'] . '/history')->json('data'), 'sentence');
        $this->assertSame(['Mummy unticked ‘Bangles’.', 'Mummy ticked ‘Bangles’.', 'Ayush ticked ‘Rings’.'], array_slice($lines, 0, 3));
    }

    #[Endpoint('DELETE /tasks/{id}/items/{key}')]
    public function test_remove_item_with_undo(): void
    {
        $c = $this->loginAs('papa');
        $k = Uuid::v4();
        $t = $this->task($c, ['items' => [['key' => $k, 'text' => 'Dry fruits']]]);
        $res = $c->request('DELETE', '/tasks/' . $t['id'] . "/items/$k", null, [], [], ['ifMatch' => 1])->assertStatus(200);
        $this->assertSame('Removed ‘Dry fruits’', $res->json('meta.undo.summary'));
        $this->assertSame([], $c->get('/tasks/' . $t['id'])->json('data.items'));
        $c->request('DELETE', '/tasks/' . $t['id'] . "/items/$k", null, [], [], ['ifMatch' => 2])->assertStatus(409)->assertErrorCode('record_deleted'); // SEC-06
        $c->postJson('/undo/' . $res->json('meta.undo.batch_id'), new \stdClass())->assertStatus(200);
        $this->assertSame(['Dry fruits'], array_column($c->get('/tasks/' . $t['id'])->json('data.items'), 'text'));
    }

    #[Endpoint('GET /tags')]
    public function test_list_with_task_counts(): void
    {
        $c = $this->loginAs('ayush');
        $this->task($c, ['tag_ids' => [$this->tagId('Shopping')]]);
        $this->task($c, ['title' => 'Two', 'tag_ids' => [$this->tagId('Shopping'), $this->tagId('Gifts')]]);
        $tags = $this->loginAs('nani')->get('/tags')->assertStatus(200)->json('data');
        $byName = array_column($tags, 'task_count', 'name');
        $this->assertSame(9, count($tags));
        $this->assertSame([2, 1, 0], [$byName['Shopping'], $byName['Gifts'], $byName['Decor']]);
    }

    #[Endpoint('POST /tags')]
    public function test_family_adds_tags_duplicates_refused(): void
    {
        $m = $this->loginAs('mummy');
        $res = $m->postJson('/tags', ['name' => 'Mehndi'])->assertStatus(201);
        $this->assertSame(['Mehndi', 0], [$res->json('data.name'), $res->json('data.task_count')]);
        $dup = $m->postJson('/tags', ['name' => 'shopping'])->assertStatus(409)->assertErrorCode('duplicate_found');
        $this->assertSame('Already on the list: Shopping.', $dup->json('error.message'));
        $m->postJson('/tags', ['name' => str_repeat('x', 31)])->assertStatus(422);
        $key = '5b1f0b52-3a2d-4c1e-9f00-0000000005c3';
        $this->loginAs('papa')->postJson('/tags', ['name' => 'Sweets'], [], ['idem' => $key])->assertStatus(201);
        $this->loginAs('papa')->postJson('/tags', ['name' => 'Sweets'], [], ['idem' => $key])->assertStatus(201); // DS-04 (fresh login, same key)
        $this->assertSame(1, $this->rows('tags', "name = 'Sweets'"));
        $this->loginAs('nani')->postJson('/tags', ['name' => 'x'])->assertStatus(403);
    }

    #[Endpoint('PATCH /tags/{id}')]
    public function test_rename_is_admin_only(): void
    {
        $id = $this->tagId('Jewelry');
        $this->loginAs('papa')->patchJson("/tags/$id", ['name' => 'Jewellery'], 1)->assertStatus(403); // SEC-10
        $this->loginAs('mahi')->patchJson("/tags/$id", ['name' => 'Outfit'], 1)->assertStatus(409)->assertErrorCode('duplicate_found');
        $this->assertSame('Jewellery', $this->loginAs('mahi')->patchJson("/tags/$id", ['name' => 'Jewellery'], 1)->assertStatus(200)->json('data.name'));
    }

    #[Endpoint('DELETE /tags/{id}')]
    public function test_delete_takes_it_off_tasks_in_the_same_batch(): void
    {
        $a = $this->loginAs('ayush');
        $t = $this->task($a, ['tag_ids' => [$this->tagId('Decor'), $this->tagId('Food')]]);
        $id = $this->tagId('Decor');
        $this->loginAs('mummy')->request('DELETE', "/tags/$id", null, [], [], ['ifMatch' => 1])->assertStatus(403); // SEC-10
        $res = $a->request('DELETE', "/tags/$id", null, [], [], ['ifMatch' => 1])->assertStatus(200);
        $this->assertSame('Deleted Tag · Decor', $res->json('meta.undo.summary'));
        $this->assertSame(['Food'], array_column($a->get('/tasks/' . $t['id'])->json('data.tags'), 'name'));
        $a->postJson('/undo/' . $res->json('meta.undo.batch_id'), new \stdClass())->assertStatus(200);
        $this->assertSame(['Decor', 'Food'], array_column($a->get('/tasks/' . $t['id'])->json('data.tags'), 'name'));
    }

    #[Endpoint('POST /tags/{id}/restore')]
    public function test_restore_blocked_when_the_name_is_taken_now(): void
    {
        $a = $this->loginAs('ayush');
        $t = $this->task($a, ['tag_ids' => [$this->tagId('Travel')]]);
        $id = $this->tagId('Travel');
        $a->request('DELETE', "/tags/$id", null, [], [], ['ifMatch' => 1])->assertStatus(200);
        $a->postJson('/tags', ['name' => 'travel'])->assertStatus(201);
        $res = $a->postJson("/tags/$id/restore", new \stdClass(), [], ['ifMatch' => 2])->assertStatus(422)->assertErrorCode('rule_blocked');
        $this->assertSame('A tag called Travel already exists. Rename that one first.', $res->json('error.message'));
        $this->assertNotNull($this->row('SELECT deleted_at FROM tags WHERE public_id = ?', [$id])['deleted_at']);
        // Rename the new one, then the old one restores — with its task link.
        $new = $this->tagId('travel');
        $a->patchJson("/tags/$new", ['name' => 'Trips'], 1)->assertStatus(200);
        $a->postJson("/tags/$id/restore", new \stdClass(), [], ['ifMatch' => 2])->assertStatus(200);
        $this->assertSame(['Travel'], array_column($a->get('/tasks/' . $t['id'])->json('data.tags'), 'name'));
        $this->loginAs('papa')->postJson("/tags/$id/restore", new \stdClass(), [], ['ifMatch' => 3])->assertStatus(403);
    }
}
