<?php
declare(strict_types=1);

namespace Tests\Endpoints;

use Tests\Support\ApiClient;
use Tests\Support\ApiTestCase;
use Tests\Support\Endpoint;
use Tests\Support\TestResponse;

/**
 * POST /tasks/bulk and GET /tasks/export (1.0.24, admin-operations brief §6, §14).
 * Frozen clock: Thu 8 Oct 2026, 2:42 PM IST.
 */
final class TaskBulkTest extends ApiTestCase
{
    private const LOADED = '2026-10-08T09:00:00Z'; // the phone loaded the list 12 minutes ago
    private const MEHNDI = '01M4DK5T3E6QZBMNQ0V7KQWW23';
    private const NOW = '2026-10-08T09:12:31Z'; // a list loaded again just now

    /** @return list<string> public ids, made by $by (user id), updated before LOADED */
    private function seed(int $n, int $by = 1, string $status = 'todo', ?string $due = '2026-10-10'): array
    {
        $ids = [];
        for ($i = 0; $i < $n; $i++) {
            $pid = sprintf('01JT%04d%018d', $by, $i + 1);
            $this->db()->run("INSERT INTO tasks (public_id, code, title, status, priority, due_date, created_by, updated_by, created_at, updated_at)
                              VALUES (?, ?, ?, ?, 'normal', ?, ?, ?, '2026-10-01 05:00:00', '2026-10-01 05:00:00')",
                [$pid, sprintf('TSK-B%d%04d', $by, $i), sprintf('Task %d-%d', $by, $i), $status, $due, $by, $by]);
            $ids[] = $pid;
        }
        return $ids;
    }

    private function bulk(ApiClient $c, array $body): TestResponse
    {
        return $c->postJson('/tasks/bulk', $body + ['as_of' => self::LOADED]);
    }

    private function task(string $pid): array
    {
        return $this->row('SELECT * FROM tasks WHERE public_id = ?', [$pid]);
    }

    #[Endpoint('POST /tasks/bulk')]
    public function test_status_priority_due_change_only_that_field_one_undo(): void
    {
        $ids = $this->seed(3);
        $ayush = $this->loginAs('ayush');
        $r = $this->bulk($ayush, ['action' => 'set_priority', 'priority' => 'urgent', 'ids' => $ids])->assertStatus(200)->json();
        $this->assertSame(3, $r['data']['affected']);
        $this->assertSame('Set Urgent for 3 tasks', $r['meta']['undo']['summary']);
        foreach ($ids as $id) {
            $t = $this->task($id);
            $this->assertSame(['urgent', 'todo', '2026-10-10', 2], [$t['priority'], $t['status'], $t['due_date'], (int) $t['version']], 'only priority changed');
        }
        $ayush->postJson('/undo/' . $r['data']['batch_id'], [])->assertStatus(200);
        $this->assertSame('normal', $this->task($ids[0])['priority'], 'one Undo puts all three back');

        $loaded = $ayush->get('/tasks')->json('meta.server_time') ?? '2026-10-08T09:12:31Z';
        $r = $ayush->postJson('/tasks/bulk', ['action' => 'set_due', 'due_date' => '2026-10-15', 'ids' => $ids, 'as_of' => $loaded])->assertStatus(200)->json('data');
        $this->assertSame(3, $r['affected']);
        $this->assertSame(['2026-10-15', 1], [$this->task($ids[1])['due_date'], (int) $this->task($ids[1])['postpone_count']], 'a later date counts as a postpone');
        $this->bulk($ayush, ['action' => 'set_status', 'status' => 'shopping', 'ids' => $ids])->assertStatus(422);
        $this->bulk($ayush, ['action' => 'set_status', 'ids' => $ids])->assertStatus(422);
        $this->bulk($ayush, ['action' => 'set_due', 'due_date' => '15/10/2026', 'ids' => $ids])->assertStatus(422);
        $this->bulk($ayush, ['action' => 'set_event', 'event_id' => '01JA6ZZZZZZZZZZZZZZZZZZZZZ', 'ids' => $ids])->assertStatus(422);
    }

    #[Endpoint('POST /tasks/bulk')]
    public function test_rows_changed_after_loading_are_skipped_and_named(): void
    {
        $ids = $this->seed(2);
        $this->db()->run("UPDATE tasks SET updated_at = '2026-10-08 09:05:00', updated_by = 2 WHERE public_id = ?", [$ids[1]]);
        $r = $this->bulk($this->loginAs('papa'), ['action' => 'done', 'ids' => $ids])->assertStatus(200)->json('data');
        $this->assertSame(1, $r['affected']);
        $this->assertSame([['id' => $ids[1], 'name' => 'Task 1-1', 'reason' => 'changed_since_loaded']], array_map(
            static fn ($s) => ['id' => $s['id'], 'name' => $s['name'], 'reason' => $s['reason']], $r['skipped']));
        $this->assertSame('Mahi', $r['skipped'][0]['changed_by']['name']);
        $this->assertSame(['done', 'todo'], [$this->task($ids[0])['status'], $this->task($ids[1])['status']]);
        $this->assertSame(3, (int) $this->task($ids[0])['completed_by']);
    }

    #[Endpoint('POST /tasks/bulk')]
    public function test_permissions_viewer_no_family_deletes_only_own_or_assigned(): void
    {
        $mine = $this->seed(1, 4);   // made by Mummy
        $others = $this->seed(2, 1); // made by Ayush
        $this->db()->run('INSERT INTO task_assignees (task_id, user_id, created_at) SELECT id, 4, NOW() FROM tasks WHERE public_id = ?', [$others[0]]);
        $this->bulk($this->loginAs('nani'), ['action' => 'done', 'ids' => $mine])->assertStatus(403);
        $r = $this->bulk($this->loginAs('mummy'), ['action' => 'delete', 'ids' => [...$mine, ...$others]])->assertStatus(200)->json('data');
        $this->assertSame(2, $r['affected'], 'her own task and the one assigned to her');
        $this->assertSame([[$others[1], 'not_yours']], array_map(static fn ($s) => [$s['id'], $s['reason']], $r['skipped']));
        $this->assertNull($this->task($others[1])['deleted_at']);
        $this->assertNotNull($this->task($mine[0])['deleted_at']);
        $this->loginAs('mummy')->postJson('/undo/' . $r['batch_id'], [])->assertStatus(200);
        $this->assertNull($this->task($mine[0])['deleted_at'], 'Undo brings deleted tasks back');
        $this->bulk($this->loginAs('ayush'), ['action' => 'done', 'ids' => array_fill(0, 1, 'not-an-id')])->assertStatus(200);
        $this->bulk($this->loginAs('ayush'), ['action' => 'done', 'ids' => []])->assertStatus(422);
        $this->bulk($this->loginAs('ayush'), ['action' => 'archive', 'ids' => $mine])->assertStatus(422);
    }

    #[Endpoint('POST /tasks/bulk')]
    public function test_add_and_remove_assignees_and_tags_keep_the_rest_and_undo(): void
    {
        $ids = $this->seed(2);
        $this->db()->run('INSERT INTO task_assignees (task_id, user_id, created_at) SELECT id, 2, NOW() FROM tasks WHERE public_id = ?', [$ids[0]]);
        $ayush = $this->loginAs('ayush');
        $r = $this->bulk($ayush, ['action' => 'add_assignees', 'assignee_ids' => [$this->pid('papa')], 'ids' => $ids])->assertStatus(200)->json();
        $this->assertSame(2, $r['data']['affected']);
        $people = fn (string $pid) => array_column($this->db()->all('SELECT a.user_id FROM task_assignees a JOIN tasks t ON t.id = a.task_id
            WHERE t.public_id = ? AND a.deleted_at IS NULL ORDER BY a.user_id', [$pid]), 'user_id');
        $this->assertSame([2, 3], array_map('intval', $people($ids[0])), 'Mahi stays, Papa added');
        $this->assertSame([3], array_map('intval', $people($ids[1])));
        $ayush->postJson('/undo/' . $r['data']['batch_id'], [])->assertStatus(200);
        $this->assertSame([2], array_map('intval', $people($ids[0])), 'Undo takes Papa off again, Mahi stays');
        $this->assertSame([], $people($ids[1]));

        $r = $this->bulk($ayush, ['action' => 'remove_assignees', 'assignee_ids' => [$this->pid('mahi')], 'ids' => $ids, 'as_of' => self::NOW])->assertStatus(200)->json('data');
        $this->assertSame(1, $r['affected'], 'only the task that had Mahi changed');
        $tag = (string) $this->row("SELECT public_id FROM tags WHERE deleted_at IS NULL ORDER BY id LIMIT 1")['public_id'];
        $this->bulk($ayush, ['action' => 'add_tags', 'tag_ids' => [$tag], 'ids' => $ids, 'as_of' => self::NOW])->assertStatus(200);
        $history = $ayush->get("/tasks/{$ids[1]}/history")->json('data');
        $this->assertNotEmpty($history, 'the change shows in the task history');
        $this->bulk($ayush, ['action' => 'add_assignees', 'assignee_ids' => ['01JA6ZZZZZZZZZZZZZZZZZZZZZ'], 'ids' => $ids])->assertStatus(422);
    }

    #[Endpoint('POST /tasks/bulk')]
    public function test_workspace_move_clears_section_and_event_change(): void
    {
        $ids = $this->seed(1);
        $ws = $this->db()->value('SELECT public_id FROM workspaces WHERE deleted_at IS NULL ORDER BY id LIMIT 1');
        if ($ws === null) {
            $ws = $this->loginAs('ayush')->postJson('/workspaces', ['name' => 'Haldi'])->assertStatus(201)->json('data.id');
        }
        $this->db()->run("UPDATE tasks SET workspace_section = NULL WHERE public_id = ?", [$ids[0]]);
        $this->bulk($this->loginAs('ayush'), ['action' => 'set_workspace', 'workspace_id' => $ws, 'ids' => $ids])->assertStatus(200);
        $this->assertNotNull($this->task($ids[0])['workspace_id']);
        $this->bulk($this->loginAs('ayush'), ['action' => 'set_event', 'event_id' => self::MEHNDI, 'ids' => $ids, 'as_of' => self::NOW])->assertStatus(200);
        $this->assertNotNull($this->task($ids[0])['event_id']);
        $this->bulk($this->loginAs('nani'), ['action' => 'set_workspace', 'workspace_id' => null, 'ids' => $ids])->assertStatus(403);
    }

    #[Endpoint('GET /tasks/export')]
    public function test_export_selected_tasks_csv_formula_safe(): void
    {
        $ids = $this->seed(2);
        $this->db()->run("UPDATE tasks SET title = '=HYPERLINK(1)' WHERE public_id = ?", [$ids[1]]);
        $r = $this->loginAs('mummy')->get('/tasks/export', ['ids' => implode(',', $ids)])->assertStatus(200);
        $this->assertStringContainsString('text/csv', (string) $r->header('Content-Type'));
        $lines = explode("\r\n", trim($r->body()));
        $this->assertStringStartsWith("\u{FEFF}Task ID,Title,Status", $lines[0]);
        $this->assertCount(3, $lines);
        $this->assertStringContainsString("'=HYPERLINK(1)", $r->body());
        $this->loginAs('nani')->get('/tasks/export', ['ids' => implode(',', $ids)])->assertStatus(403);
        $this->loginAs('ayush')->get('/tasks/export', ['ids' => ''])->assertStatus(422);
    }
}
