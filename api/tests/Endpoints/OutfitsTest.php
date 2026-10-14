<?php
declare(strict_types=1);

namespace Tests\Endpoints;

use Tests\Support\ApiClient;
use Tests\Support\ApiTestCase;
use Tests\Support\Endpoint;

/**
 * Outfits (version 1.0.18, Workspace step B): bride / groom outfits in a workspace with the
 * default timeline (editable steps with dates), moodboard from the Vault (favourite, vendor,
 * task, unique ID), accessories with their own notes / attachments / tasks, notes, and tasks
 * that come from the outfit, an accessory or a step. Delete takes everything with it (one Undo).
 */
final class OutfitsTest extends ApiTestCase
{
    private const MEHNDI = '01JC0WS0000000000000000002';

    private function outfit(ApiClient $c, string $title = 'Mehndi lehenga', string $person = 'bride'): array
    {
        return $c->postJson('/outfits', ['workspace_id' => self::MEHNDI, 'person' => $person, 'title' => $title])->assertStatus(201)->json('data');
    }

    #[Endpoint('POST /outfits')]
    #[Endpoint('GET /outfits/{id}')]
    public function test_a_new_outfit_has_the_default_timeline_and_shows_on_the_workspace(): void
    {
        $mahi = $this->loginAs('mahi');
        $o = $this->outfit($mahi);
        $this->assertSame(['bride', 'Bride', 'bride_outfit', 'Mehndi lehenga'], [$o['person'], $o['person_label'], $o['section'], $o['title']]);
        $this->assertSame(['Selected', 'Stitched', 'Trial done', 'Final approved'], array_column($o['steps'], 'name'));
        $this->assertSame([false, false, false, false], array_column($o['steps'], 'done'));
        $this->assertSame([[], [], [], []], [$o['moodboard'], $o['accessories'], $o['notes'], $o['tasks']]);
        $this->outfit($mahi, 'Sherwani', 'groom');
        $ws = $mahi->get('/workspaces/' . self::MEHNDI)->json('data');
        $this->assertSame([['bride', 'Mehndi lehenga'], ['groom', 'Sherwani']], array_map(static fn ($x) => [$x['person'], $x['title']], $ws['outfits']));
        $this->assertSame($o, $mahi->get("/outfits/{$o['id']}")->json('data'));
        $mahi->postJson('/outfits', ['workspace_id' => self::MEHNDI, 'person' => 'aunt', 'title' => 'X'])->assertStatus(422);
        $this->loginAs('nani')->postJson('/outfits', ['workspace_id' => self::MEHNDI, 'person' => 'bride', 'title' => 'X'])->assertStatus(403); // view only
        $this->loginAs('nani')->get("/outfits/{$o['id']}")->assertStatus(200); // 1.0.21: visible to all
    }

    #[Endpoint('POST /outfits/{id}/steps')]
    #[Endpoint('PATCH /outfit-steps/{id}')]
    #[Endpoint('DELETE /outfit-steps/{id}')]
    #[Endpoint('POST /outfit-steps/{id}/restore')]
    public function test_timeline_steps_mark_done_with_a_date_add_rename_reorder_delete(): void
    {
        $c = $this->loginAs('ayush');
        $o = $this->outfit($c);
        [$selected, $stitched] = $o['steps'];
        $s = $c->patchJson("/outfit-steps/{$selected['id']}", ['done_on' => '2026-10-05'], 1)->assertStatus(200)->json('data');
        $this->assertSame(['2026-10-05', true], [$s['done_on'], $s['done']]);
        $this->assertSame('Pick today or an earlier date.', $c->patchJson("/outfit-steps/{$stitched['id']}", ['done_on' => '2026-12-01'], 1)->assertStatus(422)->json('error.fields.done_on'));
        $o = $c->postJson("/outfits/{$o['id']}/steps", ['name' => 'Dupatta dyed'])->assertStatus(201)->json('data');
        $this->assertSame('Dupatta dyed', $o['steps'][4]['name']);
        $c->patchJson("/outfit-steps/{$o['steps'][4]['id']}", ['name' => 'Dupatta dyed pink', 'sort_order' => 15], 1)->assertStatus(200);
        $this->assertSame(['Selected', 'Dupatta dyed pink', 'Stitched', 'Trial done', 'Final approved'], array_column($c->get("/outfits/{$o['id']}")->json('data.steps'), 'name'));
        $d = $c->request('DELETE', "/outfit-steps/{$stitched['id']}", null, [], [], ['ifMatch' => 1])->assertStatus(200);
        $this->assertSame('Deleted Stitched', $d->json('meta.undo.summary'));
        $this->assertNotContains('Stitched', array_column($c->get("/outfits/{$o['id']}")->json('data.steps'), 'name'));
        $c->postJson("/outfit-steps/{$stitched['id']}/restore", new \stdClass(), [], ['ifMatch' => 2])->assertStatus(200);
        $this->assertContains('Stitched', array_column($c->get("/outfits/{$o['id']}")->json('data.steps'), 'name'));
        $this->assertStringContainsString('changed Done on from not done to 5 Oct 2026', implode("\n", array_column($c->get("/outfits/{$o['id']}/history")->json('data'), 'sentence')));
    }

    #[Endpoint('POST /outfits/{id}/accessories')]
    #[Endpoint('PATCH /accessories/{id}')]
    #[Endpoint('DELETE /accessories/{id}')]
    #[Endpoint('POST /accessories/{id}/restore')]
    #[Endpoint('POST /notes')]
    #[Endpoint('PATCH /notes/{id}')]
    #[Endpoint('DELETE /notes/{id}')]
    #[Endpoint('POST /notes/{id}/restore')]
    public function test_accessories_and_notes_each_with_attachments_and_tasks(): void
    {
        $c = $this->loginAs('mahi');
        $o = $this->outfit($c);
        $o = $c->postJson("/outfits/{$o['id']}/accessories", ['name' => 'Maang tikka'])->assertStatus(201)->json('data');
        $acc = $o['accessories'][0];
        $this->assertSame('Maang tikka', $acc['name']);
        // A note on the outfit, on the accessory and on a step
        $c->postJson('/notes', ['outfit_id' => $o['id'], 'body' => 'Pastel green, light dupatta'])->assertStatus(201);
        $c->postJson('/notes', ['accessory_id' => $acc['id'], 'body' => 'Kundan, from Nani'])->assertStatus(201);
        $c->postJson('/notes', ['outfit_step_id' => $o['steps'][2]['id'], 'body' => 'Trial at 4 PM'])->assertStatus(201);
        $c->postJson('/notes', ['outfit_id' => $o['id'], 'accessory_id' => $acc['id'], 'body' => 'two places'])->assertStatus(422);
        $c->postJson('/notes', ['body' => 'nowhere'])->assertStatus(422);
        // Attachments: the moodboard, the accessory, a step
        $c->postJson('/attachments', ['kind' => 'link', 'url' => 'https://example.com/lehenga', 'title' => 'Lehenga idea', 'outfit_id' => $o['id'], 'is_favourite' => true])->assertStatus(201);
        $tikka = $c->postJson('/attachments', ['kind' => 'link', 'url' => 'https://example.com/tikka', 'title' => 'Tikka photo', 'accessory_id' => $acc['id'], 'code' => 'TIKKA-01'])->assertStatus(201)->json('data');
        $this->assertSame('Mehndi › Bride outfit › Mehndi lehenga › Maang tikka', $tikka['used_in'][0]['path']);
        $this->assertSame("/outfits/{$o['id']}", $tikka['used_in'][0]['to']);
        $c->postJson('/attachments', ['kind' => 'text', 'body' => 'Fits well, shorten sleeves', 'title' => 'Trial note', 'outfit_step_id' => $o['steps'][2]['id']])->assertStatus(201);
        // Tasks from the accessory and the outfit
        $t = $c->postJson('/tasks', ['title' => 'Polish the tikka', 'accessory_id' => $acc['id']])->assertStatus(201)->json('data');
        $this->assertSame(['type' => 'accessory', 'id' => $acc['id'], 'name' => 'Maang tikka', 'outfit_id' => $o['id']], $t['target']);
        $this->assertSame([self::MEHNDI, 'bride_outfit'], [$t['workspace']['id'], $t['workspace_section']]);
        $c->postJson('/tasks', ['title' => 'Book tailor', 'outfit_id' => $o['id']])->assertStatus(201);

        $full = $c->get("/outfits/{$o['id']}")->json('data');
        $this->assertSame(['Lehenga idea'], array_column($full['moodboard'], 'title'), 'step and accessory files are not on the moodboard');
        $this->assertSame(['Pastel green, light dupatta'], array_column($full['notes'], 'body'));
        $this->assertSame(['Book tailor'], array_column($full['tasks'], 'title'));
        $this->assertSame(['Kundan, from Nani'], array_column($full['accessories'][0]['notes'], 'body'));
        $this->assertSame(['Tikka photo'], array_column($full['accessories'][0]['attachments'], 'title'));
        $this->assertSame(['Polish the tikka'], array_column($full['accessories'][0]['tasks'], 'title'));
        $this->assertSame(['Trial at 4 PM'], array_column($full['steps'][2]['notes'], 'body'));
        $this->assertSame(['Trial note'], array_column($full['steps'][2]['attachments'], 'title'));
        $this->assertSame(['attachments' => 1, 'accessories' => 1, 'tasks_open' => 1], $full['counts']);
        // The workspace strip shows both tasks; edit and delete a note
        $this->assertSame(['Polish the tikka', 'Book tailor'], array_column($c->get('/workspaces/' . self::MEHNDI)->json('data.tasks'), 'title'));
        $note = $full['notes'][0];
        $c->patchJson("/notes/{$note['id']}", ['body' => 'Pastel green, heavy dupatta'], 1)->assertStatus(200);
        $c->request('DELETE', "/notes/{$note['id']}", null, [], [], ['ifMatch' => 2])->assertStatus(200);
        $this->assertSame([], $c->get("/outfits/{$o['id']}")->json('data.notes'));
        $c->postJson("/notes/{$note['id']}/restore", new \stdClass(), [], ['ifMatch' => 3])->assertStatus(200);
        // Rename and delete the accessory (its note and file link go with it; Undo)
        $c->patchJson("/accessories/{$acc['id']}", ['name' => 'Kundan maang tikka'], 1)->assertStatus(200);
        $c->request('DELETE', "/accessories/{$acc['id']}", null, [], [], ['ifMatch' => 2])->assertStatus(200);
        $this->assertSame([], $c->get("/outfits/{$o['id']}")->json('data.accessories'));
        $this->assertSame([], $c->get("/attachments/{$tikka['id']}")->json('data.used_in'), 'the file stays in the Vault, unlinked');
        $c->postJson("/accessories/{$acc['id']}/restore", new \stdClass(), [], ['ifMatch' => 3])->assertStatus(200);
        $this->assertSame(['Kundan, from Nani'], array_column($c->get("/outfits/{$o['id']}")->json('data.accessories.0.notes'), 'body'));
        $this->assertCount(1, $c->get("/attachments/{$tikka['id']}")->json('data.used_in'));
    }

    #[Endpoint('PATCH /outfits/{id}')]
    #[Endpoint('DELETE /outfits/{id}')]
    #[Endpoint('POST /outfits/{id}/restore')]
    public function test_delete_an_outfit_takes_everything_with_it_and_undo_brings_it_back(): void
    {
        $c = $this->loginAs('ayush');
        $o = $this->outfit($c);
        $c->patchJson("/outfits/{$o['id']}", ['title' => 'Mehndi lehenga (pastel)'], 1)->assertStatus(200);
        $o = $c->postJson("/outfits/{$o['id']}/accessories", ['name' => 'Kaleere'])->json('data');
        $c->postJson('/notes', ['accessory_id' => $o['accessories'][0]['id'], 'body' => 'From Mama ji'])->assertStatus(201);
        $pic = $c->postJson('/attachments', ['kind' => 'link', 'url' => 'https://example.com/x', 'title' => 'Moodboard pic', 'outfit_id' => $o['id']])->json('data');
        $task = $c->postJson('/tasks', ['title' => 'Steam the lehenga', 'outfit_id' => $o['id']])->json('data');
        $d = $c->request('DELETE', "/outfits/{$o['id']}", null, [], [], ['ifMatch' => 2])->assertStatus(200);
        $this->assertSame('Deleted Mehndi lehenga (pastel)', $d->json('meta.undo.summary'));
        $this->assertSame('Mehndi lehenga (pastel) · 7 linked', $this->db()->value('SELECT summary FROM change_batches WHERE public_id = ?', [$d->json('meta.undo.batch_id')]), '4 steps, 1 accessory, its note, 1 link');
        $this->assertSame([], $c->get('/workspaces/' . self::MEHNDI)->json('data.outfits'));
        $c->get("/outfits/{$o['id']}")->assertStatus(404);
        $this->assertSame([], $c->get("/attachments/{$pic['id']}")->json('data.used_in'));
        $this->assertSame('Steam the lehenga', $c->get("/tasks/{$task['id']}")->json('data.title'), 'its tasks stay');
        $c->postJson('/undo/' . $d->json('meta.undo.batch_id'), new \stdClass())->assertStatus(200);
        $back = $c->get("/outfits/{$o['id']}")->json('data');
        $this->assertSame([4, 'Kaleere', ['From Mama ji'], ['Moodboard pic']], [count($back['steps']), $back['accessories'][0]['name'], array_column($back['accessories'][0]['notes'], 'body'), array_column($back['moodboard'], 'title')]);
        $this->loginAs('nani')->request('DELETE', "/outfits/{$o['id']}", null, [], [], ['ifMatch' => 4])->assertStatus(403);
    }

    public function test_pick_from_the_vault_onto_a_moodboard_and_deleting_the_workspace_takes_outfits_too(): void
    {
        $c = $this->loginAs('mahi');
        $o = $this->outfit($c);
        $a = $c->postJson('/attachments', ['kind' => 'link', 'url' => 'https://example.com/y', 'title' => 'Old idea'])->json('data');
        $c->postJson("/attachments/{$a['id']}/links", ['outfit_id' => $o['id']])->assertStatus(200);
        $c->postJson("/attachments/{$a['id']}/links", ['outfit_id' => $o['id']])->assertStatus(200); // twice: one link
        $this->assertSame(['Old idea'], array_column($c->get("/outfits/{$o['id']}")->json('data.moodboard'), 'title'));
        $this->assertSame(1, $this->rows('attachment_links', 'outfit_id IS NOT NULL AND deleted_at IS NULL'));
        $c->request('DELETE', '/workspaces/' . self::MEHNDI, null, [], [], ['ifMatch' => 1])->assertStatus(200);
        $this->assertSame(1, $this->rows('outfits', 'deleted_at IS NOT NULL'));
    }
}
