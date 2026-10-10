<?php
declare(strict_types=1);

namespace Tests\Endpoints;

use AM\Kernel\Uuid;
use Tests\Support\ApiClient;
use Tests\Support\ApiTestCase;
use Tests\Support\Endpoint;

/**
 * /tasks — FEATURES B3 (AC-TASK-01…10), API.md §6.5, TESTING §1.3 tasks row,
 * DS-01/04/05/11/12/15/17 on tasks, SEC-10.
 * Frozen clock: Thu 8 Oct 2026, 2:42 PM IST (week Mon 5 – Sun 11 Oct).
 */
final class TasksTest extends ApiTestCase
{
    private const MEHNDI = '01M4DK5T3E6QZBMNQ0V7KQWW23';
    private const TENT = '01JA6ZB0000000000000000001';

    private function tag(string $name): string
    {
        return (string) $this->row('SELECT public_id FROM tags WHERE name = ?', [$name])['public_id'];
    }

    private function add(ApiClient $c, array $body): array
    {
        $res = $c->postJson('/tasks', $body + ['allow_duplicate' => true]);
        $res->assertStatus(201);
        return $res->json('data');
    }

    #[Endpoint('POST /tasks')]
    public function test_ac_task_01_three_taps_assigned_to_me(): void
    {
        $papa = $this->loginAs('papa');
        $res = $papa->postJson('/tasks', ['title' => '  Call tent wala ']);
        $res->assertStatus(201)->assertEnvelope();
        $t = $res->json('data');
        $this->assertSame('"1"', $res->header('ETag'));
        $this->assertSame('Call tent wala', $t['title']);
        $this->assertSame(['todo', 'normal', 1], [$t['status'], $t['priority'], $t['version']]);
        $this->assertSame([['id' => $this->pid('papa'), 'name' => 'Papa']], $t['assignees']);
        $this->assertSame([], $t['items']);
        $this->assertFalse($t['overdue']);
        $this->assertSame(1, $this->rows('audit_log', "action = 'create' AND entity_type = 'task'"));
    }

    #[Endpoint('POST /tasks')]
    public function test_create_with_everything(): void
    {
        $ayush = $this->loginAs('ayush');
        $k1 = Uuid::v4();
        $t = $this->add($ayush, [
            'title' => 'Mehndi cones', 'notes' => "Ask for 2 quotes\nराम शर्मा", 'priority' => 'urgent',
            'due_date' => '2026-10-20', 'due_time' => '18:00', 'event_id' => self::MEHNDI, 'vendor_id' => self::TENT,
            'assignee_ids' => [$this->pid('mummy'), $this->pid('papa')], 'tag_ids' => [$this->tag('Shopping')], 'new_tags' => ['Mehndi stuff', 'shopping'],
            'items' => [['key' => $k1, 'text' => 'Buy 20 cones'], ['key' => Uuid::v4(), 'text' => 'Book artist', 'is_done' => true]],
        ]);
        $this->assertSame('18:00', $t['due_time']);
        $this->assertSame(['id' => self::MEHNDI, 'name' => 'Mehndi'], $t['event']);
        $this->assertSame('Shree Tent House', $t['vendor']['name']);
        $this->assertSame(['Mummy', 'Papa'], array_column($t['assignees'], 'name'));
        $this->assertSame(['Mehndi stuff', 'Shopping'], array_column($t['tags'], 'name'), 'new tag made once; "shopping" reuses Shopping');
        $this->assertSame(1, $this->rows('tags', "name = 'Shopping'"));
        $this->assertSame(['Buy 20 cones', 'Book artist'], array_column($t['items'], 'text'));
        $this->assertSame($k1, $t['items'][0]['key']);
        $this->assertTrue($t['items'][1]['is_done']);
        $this->assertSame('Ayush', $t['items'][1]['done_by']['name']);
        $this->assertSame("Ask for 2 quotes\nराम शर्मा", $t['notes']);
    }

    #[Endpoint('POST /tasks')]
    public function test_validation(): void
    {
        $c = $this->loginAs('ayush');
        $res = $c->postJson('/tasks', ['title' => '', 'due_time' => '18:00', 'priority' => 'asap', 'event_id' => '01JA6ZZZZZZZZZZZZZZZZZZZZZ', 'mood' => 1]);
        $res->assertStatus(422)->assertErrorCode('validation_failed');
        $f = $res->json('error.fields');
        $this->assertSame('Please fill this in.', $f['title']);
        $this->assertSame('Pick a date first.', $f['due_time']);
        $this->assertArrayHasKey('priority', $f);
        $this->assertSame("This item doesn't exist or was removed.", $f['event_id']);
        $this->assertArrayHasKey('mood', $f);
        $c->postJson('/tasks', ['title' => 'x', 'due_date' => '2026-10-20', 'due_time' => '25:00'])->assertStatus(422);
        $many = array_fill(0, 11, $this->pid('papa'));
        $this->assertSame('Choose at most 10.', $c->postJson('/tasks', ['title' => 'x', 'assignee_ids' => $many])->json('error.fields.assignee_ids'));
        $this->db()->run("UPDATE users SET is_active = 0 WHERE id = 5");
        $this->assertSame('Choose people who are active members.', $c->postJson('/tasks', ['title' => 'x', 'assignee_ids' => [$this->pid('nani')]])->json('error.fields.assignee_ids'));
        $this->assertSame(0, $this->rows('tasks'));
    }

    #[Endpoint('POST /tasks')]
    public function test_similar_open_task_is_flagged_unless_add_anyway(): void
    {
        $c = $this->loginAs('mummy');
        $c->postJson('/tasks', ['title' => 'Book tent wala'])->assertStatus(201);
        $res = $c->postJson('/tasks', ['title' => 'book TENT wala'])->assertStatus(409)->assertErrorCode('duplicate_found');
        $this->assertSame('A similar task exists: Book tent wala', $res->json('error.message'));
        $this->assertSame('Book tent wala', $res->json('error.matches.0.name'));
        $c->postJson('/tasks', ['title' => 'book TENT wala', 'allow_duplicate' => true])->assertStatus(201);
        $this->assertSame(2, $this->rows('tasks'));
    }

    #[Endpoint('POST /tasks')]
    public function test_ds04_same_key_twice_one_task_and_viewer_403(): void
    {
        $c = $this->loginAs('mahi');
        $key = '5b1f0b52-3a2d-4c1e-9f00-0000000005a1';
        $one = $c->postJson('/tasks', ['title' => 'Call tent wala'], [], ['idem' => $key])->assertStatus(201);
        $two = $c->postJson('/tasks', ['title' => 'Call tent wala'], [], ['idem' => $key])->assertStatus(201);
        $this->assertSame('true', $two->header('Idempotent-Replayed'));
        $this->assertSame($one->json('data'), $two->json('data'));
        $this->assertSame(1, $this->rows('tasks'));
        $this->loginAs('nani')->postJson('/tasks', ['title' => 'x'])->assertStatus(403); // AC-TASK-08
    }

    /** @return array<string,string> name => id */
    private function seedViews(): array
    {
        $a = $this->loginAs('ayush');
        $m = $this->pid('mummy');
        $ids = [];
        foreach ([
            't1' => ['title' => 'Overdue waiting', 'due_date' => '2026-10-07', 'status' => 'waiting', 'assignee_ids' => [$m]],
            't2' => ['title' => 'Today no time', 'due_date' => '2026-10-08', 'tag_ids' => [$this->tag('Shopping')]],
            't3' => ['title' => 'Today 2 PM', 'due_date' => '2026-10-08', 'due_time' => '14:00', 'priority' => 'urgent', 'assignee_ids' => [$m]],
            't4' => ['title' => 'Saturday', 'due_date' => '2026-10-10', 'tag_ids' => [$this->tag('Shopping')], 'priority' => 'low'],
            't5' => ['title' => 'Someday'],
            't6' => ['title' => 'Done long ago', 'due_date' => '2026-10-01', 'status' => 'done'],
            't7' => ['title' => 'Cancelled', 'status' => 'cancelled'],
        ] as $k => $body) {
            $ids[$k] = $this->add($a, $body)['id'];
            $this->clock->advance('+1 second');
        }
        return $ids;
    }

    #[Endpoint('GET /tasks')]
    public function test_views_chips_and_default_sort(): void
    {
        $ids = $this->seedViews();
        $titles = fn (array $q, string $who = 'ayush') => array_column($this->loginAs($who)->get('/tasks', $q)->assertStatus(200)->json('data'), 'title');

        $all = $this->loginAs('ayush')->get('/tasks')->assertStatus(200)->assertEnvelope();
        $this->assertSame('all', $all->json('meta.view'));
        $this->assertSame(['Overdue waiting', 'Today 2 PM', 'Done long ago', 'Today no time', 'Saturday', 'Someday'], array_column($all->json('data'), 'title'),
            'overdue first, then due date (none last), then priority; cancelled hidden');
        $this->assertSame(6, $all->json('meta.total'));
        $this->assertSame(['mine' => 4, 'today' => 2, 'week' => 4, 'overdue' => 2, 'no_date' => 1], $all->json('meta.chip_counts'), 'Ayush is the default assignee of the tasks he added');
        $this->assertTrue($all->json('data.0.overdue'));
        $this->assertTrue($all->json('data.1.overdue'), '2 PM today has passed (AC-TASK-03)');
        $this->assertFalse($all->json('data.3.overdue'));
        $this->assertTrue($all->json('data.3.due_today'));

        $this->assertSame(['Overdue waiting', 'Today 2 PM'], $titles(['view' => 'overdue']));
        $this->assertNotContains('Done long ago', $titles(['view' => 'overdue']), 'AC-TASK-06');
        $this->assertSame(['Today 2 PM', 'Today no time'], $titles(['view' => 'today']));
        $this->assertSame(['Overdue waiting', 'Today 2 PM', 'Today no time', 'Saturday'], $titles(['view' => 'week']));
        $this->assertSame(['Someday'], $titles(['view' => 'no_date']));
        $this->assertSame(['Cancelled', 'Done long ago'], $titles(['view' => 'closed', 'sort' => '-created_at']));

        // Family's default view is My tasks.
        $mine = $this->loginAs('mummy')->get('/tasks')->json();
        $this->assertSame('mine', $mine['meta']['view']);
        $this->assertSame(['Overdue waiting', 'Today 2 PM'], array_column($mine['data'], 'title'));
        $this->assertSame(2, $mine['meta']['chip_counts']['mine']);
    }

    #[Endpoint('GET /tasks')]
    public function test_ac_task_02_03_overdue_follows_india_time(): void
    {
        $a = $this->loginAs('ayush');
        $this->add($a, ['title' => 'Due 10 Oct', 'due_date' => '2026-10-10', 'status' => 'waiting']);
        $this->add($a, ['title' => 'Due 10 Oct 6 PM', 'due_date' => '2026-10-10', 'due_time' => '18:00']);
        $this->clock->set('2026-10-10T12:29:00Z'); // 5:59 PM IST
        $this->assertSame([], array_column($a->get('/tasks', ['view' => 'overdue'])->json('data'), 'title'));
        $this->assertSame(['Due 10 Oct', 'Due 10 Oct 6 PM'], array_column($a->get('/tasks', ['view' => 'today', 'sort' => 'title'])->json('data'), 'title'));
        $this->clock->set('2026-10-10T12:31:00Z'); // 6:01 PM IST
        $this->assertSame(['Due 10 Oct 6 PM'], array_column($a->get('/tasks', ['view' => 'overdue'])->json('data'), 'title'));
        $this->clock->set('2026-10-10T18:31:00Z'); // 00:01 on 11 Oct IST
        $this->assertSame(['Due 10 Oct', 'Due 10 Oct 6 PM'], array_column($a->get('/tasks', ['view' => 'overdue', 'sort' => 'title'])->json('data'), 'title'));
    }

    #[Endpoint('GET /tasks')]
    public function test_filters_search_and_paging(): void
    {
        $ids = $this->seedViews();
        $a = $this->loginAs('ayush');
        $this->assertSame(['Today no time', 'Saturday'], array_column($a->get('/tasks', ['tag' => $this->tag('Shopping')])->json('data'), 'title'), 'AC-TASK-09');
        $this->assertSame(['Overdue waiting', 'Today 2 PM'], array_column($a->get('/tasks', ['assignee' => $this->pid('mummy')])->json('data'), 'title'));
        $this->assertSame(['Today 2 PM'], array_column($a->get('/tasks', ['priority' => 'urgent'])->json('data'), 'title'));
        $this->assertSame(['Today 2 PM', 'Today no time'], array_column($a->get('/tasks', ['q' => 'today'])->json('data'), 'title'));
        $this->assertSame([], $a->get('/tasks', ['q' => '100%_'])->json('data'));
        $p1 = $a->get('/tasks', ['limit' => '4'])->json();
        $this->assertTrue($p1['meta']['has_more']);
        $p2 = $a->get('/tasks', ['limit' => '4', 'cursor' => $p1['meta']['next_cursor']])->json();
        $this->assertSame(['Saturday', 'Someday'], array_column($p2['data'], 'title'));
        $this->assertFalse($p2['meta']['has_more']);
        $a->get('/tasks', ['limit' => '4', 'view' => 'today', 'cursor' => $p1['meta']['next_cursor']])->assertStatus(400)->assertErrorCode('bad_cursor');
        foreach ([['view' => 'soon'], ['sort' => 'random'], ['status' => 'maybe'], ['priority' => 'high']] as $bad) {
            $a->get('/tasks', $bad)->assertStatus(400);
        }
    }

    #[Endpoint('GET /tasks/{id}')]
    public function test_get_one_and_404s(): void
    {
        $t = $this->add($this->loginAs('ayush'), ['title' => 'One']);
        $res = $this->loginAs('nani')->get('/tasks/' . $t['id'])->assertStatus(200);
        $this->assertSame('One', $res->json('data.title'));
        $this->assertSame('"1"', $res->header('ETag'));
        $this->loginAs('nani')->get('/tasks/2')->assertStatus(404); // SEC-04
        $this->loginAs('nani')->get('/tasks/01JA6ZZZZZZZZZZZZZZZZZZZZZ')->assertStatus(404);
    }

    #[Endpoint('PATCH /tasks/{id}')]
    public function test_ac_task_04_05_postpone_counts_only_later_dates(): void
    {
        $mummy = $this->loginAs('mummy');
        $t = $this->add($mummy, ['title' => 'Book tent wala', 'due_date' => '2026-10-12']);
        $res = $mummy->patchJson('/tasks/' . $t['id'], ['due_date' => '2026-10-19'], 1)->assertStatus(200);
        $this->assertSame(1, $res->json('data.postpone_count'));
        $this->assertSame(2, $res->json('data.version'));
        $res = $mummy->patchJson('/tasks/' . $t['id'], ['due_date' => '2026-10-15'], 2)->assertStatus(200);
        $this->assertSame(1, $res->json('data.postpone_count'), 'AC-TASK-05: earlier is not a postpone');
        $lines = array_column($mummy->get('/tasks/' . $t['id'] . '/history')->json('data'), 'sentence');
        $this->assertSame('Mummy changed Due date from 19 Oct 2026 to 15 Oct 2026 for Book tent wala.', $lines[0]);
        $this->assertSame('Mummy postponed Book tent wala from 12 Oct to 19 Oct.', $lines[1]);
        $this->assertSame('Mummy added Book tent wala.', $lines[2]);
    }

    #[Endpoint('PATCH /tasks/{id}')]
    public function test_lists_replace_and_bump_the_version(): void
    {
        $a = $this->loginAs('ayush');
        $keep = Uuid::v4();
        $drop = Uuid::v4();
        $t = $this->add($a, ['title' => 'Jewellery', 'tag_ids' => [$this->tag('Jewelry')],
            'items' => [['key' => $keep, 'text' => 'Rings'], ['key' => $drop, 'text' => 'Necklace']]]);
        $res = $a->patchJson('/tasks/' . $t['id'], ['assignee_ids' => [$this->pid('mummy'), $this->pid('papa')]], 1)->assertStatus(200);
        $this->assertSame(2, $res->json('data.version'), 'assignee change alone moves the version');
        $this->assertSame(['Mummy', 'Papa'], array_column($res->json('data.assignees'), 'name'));
        $res = $a->patchJson('/tasks/' . $t['id'], ['tag_ids' => [], 'new_tags' => ['Gold'],
            'items' => [['key' => $keep, 'text' => 'Rings (2)', 'is_done' => true], ['key' => Uuid::v4(), 'text' => 'Bangles']]], 2)->assertStatus(200);
        $this->assertSame(['Gold'], array_column($res->json('data.tags'), 'name'));
        $this->assertSame(['Rings (2)', 'Bangles'], array_column($res->json('data.items'), 'text'));
        $this->assertSame(2, $res->json('data.items.0.version'));
        $this->assertNotNull($this->row('SELECT deleted_at FROM task_items WHERE client_uuid = ?', [$drop])['deleted_at'], 'removed item → Deleted items');
        $this->assertSame(1, $this->rows('change_batches', "action = 'delete' AND entity_type = 'task_item'"));
        $lines = array_column($a->get('/tasks/' . $t['id'] . '/history')->json('data'), 'sentence');
        $this->assertContains('Ayush changed Assigned to from Ayush to Mummy, Papa for Jewellery.', $lines);
        $this->assertContains('Ayush changed Tags from Jewelry to Gold for Jewellery.', $lines);
        $this->assertContains('Ayush changed Text and Done for ‘Rings (2)’.', $lines);
        // Same lists again: nothing changes, no new version.
        $same = $a->patchJson('/tasks/' . $t['id'], ['assignee_ids' => [$this->pid('papa'), $this->pid('mummy')]], 3)->assertStatus(200);
        $this->assertSame(3, $same->json('data.version'));
    }

    #[Endpoint('PATCH /tasks/{id}')]
    public function test_ds01_stale_version_and_ds05_retry_is_a_replay(): void
    {
        $papa = $this->loginAs('papa');
        $mummy = $this->loginAs('mummy');
        $t = $this->add($papa, ['title' => 'Sweets']);
        $papa->patchJson('/tasks/' . $t['id'], ['priority' => 'urgent'], 1)->assertStatus(200);
        $before = $this->row('SELECT * FROM tasks');
        $audits = $this->rows('audit_log');
        $res = $mummy->patchJson('/tasks/' . $t['id'], ['title' => 'Sweets box'], 1)->assertStatus(409)->assertErrorCode('version_conflict');
        $this->assertSame(['priority'], $res->json('error.changed_fields'));
        $this->assertSame('Papa', $res->json('error.changed_by.name'));
        $this->assertSame($before, $this->row('SELECT * FROM tasks'));
        $this->assertSame($audits, $this->rows('audit_log'));

        $key = '5b1f0b52-3a2d-4c1e-9f00-0000000005b2';
        $one = $mummy->patchJson('/tasks/' . $t['id'], ['title' => 'Sweets box'], 2, ['idem' => $key])->assertStatus(200);
        $two = $mummy->patchJson('/tasks/' . $t['id'], ['title' => 'Sweets box'], 2, ['idem' => $key])->assertStatus(200);
        $this->assertSame('true', $two->header('Idempotent-Replayed'));
        $this->assertSame($one->json('data'), $two->json('data'));
        $this->assertSame('3', (string) $this->row('SELECT version FROM tasks')['version']);
    }

    #[Endpoint('PATCH /tasks/{id}')]
    public function test_status_done_and_reopen_by_edit(): void
    {
        $a = $this->loginAs('ayush');
        $t = $this->add($a, ['title' => 'x', 'due_date' => '2026-10-09']);
        $done = $a->patchJson('/tasks/' . $t['id'], ['status' => 'done'], 1)->assertStatus(200)->json('data');
        $this->assertSame('Ayush', $done['completed_by']['name']);
        $open = $a->patchJson('/tasks/' . $t['id'], ['status' => 'doing', 'due_date' => null], 2)->assertStatus(200)->json('data');
        $this->assertNull($open['completed_at']);
        $this->assertNull($open['due_date']);
        $this->loginAs('nani')->patchJson('/tasks/' . $t['id'], ['title' => 'y'], 3)->assertStatus(403);
    }

    #[Endpoint('POST /tasks/{id}/done')]
    public function test_ac_task_07_assignee_ticks_done_undo_and_twice(): void
    {
        $t = $this->add($this->loginAs('ayush'), ['title' => 'Haldi turmeric', 'status' => 'doing', 'assignee_ids' => [$this->pid('mummy')]]);
        $mummy = $this->loginAs('mummy');
        $res = $mummy->postJson('/tasks/' . $t['id'] . '/done', new \stdClass(), [], ['ifMatch' => 1])->assertStatus(200);
        $this->assertSame('done', $res->json('data.status'));
        $this->assertSame('Mummy', $res->json('data.completed_by.name'));
        $this->assertSame('Done: Haldi turmeric', $res->json('meta.undo.summary'));
        $batch = $res->json('meta.undo.batch_id');

        $again = $this->loginAs('papa')->postJson('/tasks/' . $t['id'] . '/done', new \stdClass(), [], ['ifMatch' => 1])->assertStatus(200);
        $this->assertTrue($again->json('meta.already_done'));
        $this->assertSame('Already done by Mummy.', $again->json('meta.message'));

        $mummy->postJson("/undo/$batch", new \stdClass())->assertStatus(200);
        $row = $this->row('SELECT status, completed_at, completed_by, version FROM tasks');
        $this->assertSame(['doing', null, null, '3'], [$row['status'], $row['completed_at'], $row['completed_by'], (string) $row['version']]);
        $lines = array_column($mummy->get('/tasks/' . $t['id'] . '/history')->json('data'), 'sentence');
        $this->assertSame('Mummy marked Haldi turmeric done.', $lines[1]);
        $this->loginAs('nani')->postJson('/tasks/' . $t['id'] . '/done', new \stdClass(), [], ['ifMatch' => 3])->assertStatus(403);
        $mummy->postJson('/tasks/' . $t['id'] . '/done', new \stdClass())->assertStatus(428);
    }

    #[Endpoint('POST /tasks/{id}/done')]
    public function test_ds12_undo_skips_a_task_changed_since(): void
    {
        $t = $this->add($this->loginAs('mummy'), ['title' => 'Flowers']);
        $mummy = $this->loginAs('mummy');
        $batch = $mummy->postJson('/tasks/' . $t['id'] . '/done', new \stdClass(), [], ['ifMatch' => 1])->json('meta.undo.batch_id');
        $this->loginAs('papa')->patchJson('/tasks/' . $t['id'], ['notes' => 'Marigold'], 2)->assertStatus(200);
        $res = $mummy->postJson("/undo/$batch", new \stdClass())->assertStatus(200);
        $this->assertSame(0, $res->json('data.undone'));
        $this->assertSame('Papa', $res->json('data.skipped.0.changed_by.name'));
        $this->assertSame('Undone. 1 task was changed by someone else and was left as it is.', $res->json('data.message'));
        $this->assertSame('done', $this->row('SELECT status FROM tasks')['status']);
    }

    #[Endpoint('DELETE /tasks/{id}')]
    public function test_sec10_family_deletes_only_their_own_tasks(): void
    {
        $ayush = $this->loginAs('ayush');
        $theirs = $this->add($ayush, ['title' => 'Ayush only']);
        $assigned = $this->add($ayush, ['title' => 'For Mummy', 'assignee_ids' => [$this->pid('mummy')]]);
        $mummy = $this->loginAs('mummy');
        $own = $this->add($mummy, ['title' => 'Mine']);
        $res = $mummy->request('DELETE', '/tasks/' . $theirs['id'], null, [], [], ['ifMatch' => 1])->assertStatus(403);
        $this->assertSame('You can delete only tasks you added or that are yours.', $res->json('error.message'));
        $mummy->request('DELETE', '/tasks/' . $assigned['id'], null, [], [], ['ifMatch' => 1])->assertStatus(200);
        $mummy->request('DELETE', '/tasks/' . $own['id'], null, [], [], ['ifMatch' => 1])->assertStatus(200);
        $this->loginAs('mahi')->request('DELETE', '/tasks/' . $theirs['id'], null, [], [], ['ifMatch' => 1])->assertStatus(200);
        $this->loginAs('nani')->request('DELETE', '/tasks/' . $own['id'], null, [], [], ['ifMatch' => 2])->assertStatus(403);
    }

    /** Every column except version, updated_* and deleted_* (DS-11). */
    private function snapshot(int $taskId): array
    {
        $strip = static function (array $rows): array {
            return array_map(static function (array $r) {
                unset($r['version'], $r['updated_at'], $r['updated_by'], $r['deleted_at'], $r['deleted_by'], $r['delete_batch_id']);
                return $r;
            }, $rows);
        };
        return [
            'task' => $strip($this->db()->all('SELECT * FROM tasks WHERE id = ?', [$taskId])),
            'items' => $strip($this->db()->all('SELECT * FROM task_items WHERE task_id = ? AND deleted_at IS NULL ORDER BY id', [$taskId])),
            'assignees' => $strip($this->db()->all('SELECT * FROM task_assignees WHERE task_id = ? AND deleted_at IS NULL ORDER BY id', [$taskId])),
            'tags' => $strip($this->db()->all('SELECT * FROM task_tags WHERE task_id = ? AND deleted_at IS NULL ORDER BY id', [$taskId])),
        ];
    }

    #[Endpoint('DELETE /tasks/{id}')]
    public function test_ac_task_10_ds11_delete_then_undo_gives_back_everything(): void
    {
        $a = $this->loginAs('ayush');
        $t = $this->add($a, ['title' => 'Outfits', 'assignee_ids' => [$this->pid('mummy'), $this->pid('papa')], 'tag_ids' => [$this->tag('Outfit'), $this->tag('Bride')],
            'items' => [['key' => Uuid::v4(), 'text' => 'Lehenga'], ['key' => Uuid::v4(), 'text' => 'Sherwani', 'is_done' => true], ['key' => Uuid::v4(), 'text' => 'Dupatta']]]);
        $id = (int) $this->row('SELECT id FROM tasks')['id'];
        $before = $this->snapshot($id);
        $res = $a->request('DELETE', '/tasks/' . $t['id'], null, [], [], ['ifMatch' => 1])->assertStatus(200);
        $this->assertSame('Deleted Outfits', $res->json('meta.undo.summary'));
        $this->assertSame(0, $this->rows('task_items', 'task_id = ? AND deleted_at IS NULL', [$id]));
        $this->assertSame(0, $this->rows('task_assignees', 'task_id = ? AND deleted_at IS NULL', [$id]));
        $this->assertSame([], $a->get('/tasks')->json('data'));
        $batch = $res->json('meta.undo.batch_id');
        $trash = $a->get("/trash/$batch")->assertStatus(200)->json('data');
        $this->assertSame([['type' => 'task', 'id' => $t['id'], 'name' => 'Outfits', 'child_count' => 7]], $trash['items']);
        $this->assertSame('Outfits · 7 linked', $trash['batch']['summary']);

        $u = $a->postJson("/undo/$batch", new \stdClass())->assertStatus(200);
        $this->assertSame(4, $u->json('data.undone'), 'task + 3 items (links are part of the task)');
        $this->assertSame($before, $this->snapshot($id));
        $this->assertSame('3', (string) $this->row('SELECT version FROM tasks')['version'], 'version = before + 2');
        $this->assertSame(1, $this->rows('audit_log', "action = 'delete' AND entity_type = 'task'"));
        $this->assertSame(1, $this->rows('audit_log', "action = 'undo' AND entity_type = 'task'"));
    }

    #[Endpoint('POST /tasks/{id}/restore')]
    public function test_ds14_restore_after_11_minutes_admin_only(): void
    {
        $mummy = $this->loginAs('mummy');
        $t = $this->add($mummy, ['title' => 'Gifts', 'items' => [['key' => Uuid::v4(), 'text' => 'Silver coins']]]);
        $mummy->request('DELETE', '/tasks/' . $t['id'], null, [], [], ['ifMatch' => 1])->assertStatus(200);
        $this->clock->advance('+11 minutes');
        $mummy->postJson('/tasks/' . $t['id'] . '/restore', new \stdClass(), [], ['ifMatch' => 2])->assertStatus(403);
        $res = $this->loginAs('mahi')->postJson('/tasks/' . $t['id'] . '/restore', new \stdClass(), [], ['ifMatch' => 2])->assertStatus(200);
        $this->assertSame(['Silver coins'], array_column($res->json('data.items'), 'text'));
        $this->assertSame(['Mummy'], array_column($res->json('data.assignees'), 'name'));
    }

    #[Endpoint('POST /tasks/{id}/restore')]
    public function test_ds15_ds17_restore_only_that_batch_and_child_brings_parent(): void
    {
        $a = $this->loginAs('ayush');
        $k1 = Uuid::v4();
        $t = $this->add($a, ['title' => 'Decor', 'items' => [['key' => $k1, 'text' => 'Lights'], ['key' => Uuid::v4(), 'text' => 'Flowers']]]);
        $itemBatch = $a->request('DELETE', '/tasks/' . $t['id'] . "/items/$k1", null, [], [], ['ifMatch' => 1])->assertStatus(200)->json('meta.undo.batch_id');
        $taskBatch = $a->request('DELETE', '/tasks/' . $t['id'], null, [], [], ['ifMatch' => 1])->assertStatus(200)->json('meta.undo.batch_id');
        $a->postJson("/trash/$taskBatch/restore", new \stdClass())->assertStatus(200);
        $this->assertSame(['Flowers'], array_column($a->get('/tasks/' . $t['id'])->json('data.items'), 'text'), 'DS-15: the item deleted earlier stays deleted');

        // DS-17: delete the task again, then restore only the old item: the task comes back too.
        $v = $a->get('/tasks/' . $t['id'])->json('data.version');
        $a->request('DELETE', '/tasks/' . $t['id'], null, [], [], ['ifMatch' => $v])->assertStatus(200);
        $a->postJson("/trash/$itemBatch/restore", new \stdClass())->assertStatus(200);
        $back = $a->get('/tasks/' . $t['id'])->assertStatus(200)->json('data');
        $this->assertSame(['Lights', 'Flowers'], array_column($back['items'], 'text'));
    }
}
