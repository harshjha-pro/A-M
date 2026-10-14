<?php
declare(strict_types=1);

namespace Tests\Endpoints;

use Tests\Support\ApiTestCase;
use Tests\Support\Endpoint;
use Tests\Support\TestDb;

/**
 * 1.0.22 (owner's request): every task has its own ID, random when made (TSK-4M8Q2D), editable,
 * unique across tasks (capitals ignored), searchable; attachments get random IDs too (ATT-7K3F9Q)
 * instead of ATT-000001, still editable.
 */
final class TaskCodesTest extends ApiTestCase
{
    private const RE = '/^%s-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/';

    #[Endpoint('GET /tasks/check-code')]
    public function test_a_new_task_gets_a_random_id_that_can_be_changed_and_stays_unique(): void
    {
        $c = $this->loginAs('ayush');
        $a = $c->postJson('/tasks', ['title' => 'Book the band'])->assertStatus(201)->json('data');
        $b = $c->postJson('/tasks', ['title' => 'Order sweets'])->assertStatus(201)->json('data');
        $this->assertMatchesRegularExpression(sprintf(self::RE, 'TSK'), $a['code']);
        $this->assertNotSame($a['code'], $b['code']);
        $this->assertSame($a['code'], $c->get('/tasks', ['q' => strtolower($a['code'])])->json('data.0.code'), 'the ID finds the task (capitals ignored)');

        $this->assertSame(['available' => true, 'message' => null], $c->get('/tasks/check-code', ['code' => 'BAND-01'])->json('data'));
        $a = $c->patchJson("/tasks/{$a['id']}", ['code' => 'BAND-01'], 1)->assertStatus(200)->json('data');
        $this->assertSame('BAND-01', $a['code']);
        $this->assertSame("ID band-01 is already used by the task 'Book the band'.", $c->get('/tasks/check-code', ['code' => 'band-01'])->json('data.message'));
        $this->assertTrue($c->get('/tasks/check-code', ['code' => 'BAND-01', 'except' => $a['id']])->json('data.available'));
        $this->assertSame("ID band-01 is already used by the task 'Book the band'.", $c->patchJson("/tasks/{$b['id']}", ['code' => 'band-01'], 1)->assertStatus(422)->json('error.fields.code'));
        $this->assertSame('Use 3 to 30 letters, numbers, - or _ (no spaces).', $c->patchJson("/tasks/{$b['id']}", ['code' => 'my id'], 1)->assertStatus(422)->json('error.fields.code'));
        $this->assertSame('Use 3 to 30 letters, numbers, - or _ (no spaces).', $c->get('/tasks/check-code', ['code' => 'x'])->json('data.message'));
        $this->assertStringContainsString('changed ID from', implode("\n", array_column($c->get("/tasks/{$a['id']}/history")->json('data'), 'sentence')));
        $made = $c->postJson('/tasks', ['title' => 'Own ID', 'code' => 'MY-TASK'])->assertStatus(201)->json('data');
        $this->assertSame('MY-TASK', $made['code'], 'an ID can be given when adding');
        $this->loginAs('papa')->patchJson("/tasks/{$b['id']}", ['code' => 'SWEETS'], 1)->assertStatus(200); // whoever edits tasks can change it
    }

    public function test_attachments_get_random_ids_and_migration_009_gave_old_tasks_and_attachments_theirs(): void
    {
        $c = $this->loginAs('mahi');
        $att = $c->postJson('/attachments', ['kind' => 'link', 'url' => 'https://example.com', 'title' => 'Idea'])->assertStatus(201)->json('data');
        $this->assertMatchesRegularExpression(sprintf(self::RE, 'ATT'), $att['code']);
        $pdo = TestDb::connect();
        $this->assertSame(0, (int) $pdo->query("SELECT COUNT(*) FROM attachments WHERE code REGEXP '^ATT-[0-9]{6}$'")->fetchColumn(), 'no numbered IDs left');
        $this->assertSame(0, (int) $pdo->query('SELECT COUNT(*) FROM tasks WHERE code IS NULL AND deleted_at IS NULL')->fetchColumn());
    }
}
