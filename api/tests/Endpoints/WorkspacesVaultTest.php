<?php
declare(strict_types=1);

namespace Tests\Endpoints;

use Tests\Support\ApiClient;
use Tests\Support\ApiTestCase;
use Tests\Support\Endpoint;
use Tests\Support\TestResponse;

/**
 * Workspaces and the Attachment Vault (version 1.0.17, step A): the owner's 7 workspaces,
 * linked to calendar events; tasks in a workspace; files of any size in 2 MB pieces;
 * the editable ID unique across the app; one attachment in many places; documents in the
 * Vault; Ayush and Mahi only.
 */
final class WorkspacesVaultTest extends ApiTestCase
{
    private const MEHNDI_WS = '01JC0WS0000000000000000002';
    private const CHUNK = 2097152;

    private function upload(ApiClient $c, string $bytes, string $name = 'clip.mp4', string $mime = 'video/mp4'): string
    {
        $start = $c->postJson('/attachment-uploads', ['name' => $name, 'mime_type' => $mime, 'size_bytes' => strlen($bytes), 'sha256' => hash('sha256', $bytes)]);
        $id = (string) $start->json('data.upload_id');
        if ($start->json('data.complete')) {
            return $id;
        }
        foreach (str_split($bytes, self::CHUNK) as $i => $piece) {
            $c->upload("/attachment-uploads/$id/chunks", $piece, 'blob', ['seq' => (string) $i, 'sha256' => null], ['field' => 'chunk'])->assertStatus(200);
        }
        $c->postJson("/attachment-uploads/$id/finish", new \stdClass())->assertStatus(200);
        return $id;
    }

    private function jpeg(int $seed = 1): string
    {
        $im = imagecreatetruecolor(40, 30);
        imagefill($im, 0, 0, imagecolorallocate($im, ($seed * 37) % 255, 90, 120));
        ob_start();
        imagejpeg($im, null, 80);
        return (string) ob_get_clean();
    }

    private function add(ApiClient $c, array $body): TestResponse
    {
        return $c->postJson('/attachments', $body);
    }

    #[Endpoint('GET /workspaces')]
    #[Endpoint('GET /workspaces/{id}')]
    public function test_the_owners_7_workspaces_linked_to_events_and_only_admins_see_them(): void
    {
        $mahi = $this->loginAs('mahi');
        $list = $mahi->get('/workspaces')->assertStatus(200)->assertEnvelope()->json('data');
        $this->assertSame(['Engagement', 'Mehndi', 'Carnival', 'DJ Night', 'Mayra', 'Reception', 'Varmala & Phere'], array_column($list, 'name'));
        $byName = array_column($list, null, 'name');
        $this->assertSame('Mehndi', $byName['Mehndi']['event']['name']);
        $this->assertSame('Wedding', $byName['Varmala & Phere']['event']['name']);
        $this->assertNull($byName['Carnival']['event']);
        foreach (['papa', 'mummy', 'nani'] as $who) {
            $this->loginAs($who)->get('/workspaces')->assertStatus(403);
            $this->loginAs($who)->get('/workspaces/' . self::MEHNDI_WS)->assertStatus(403);
            $this->loginAs($who)->get('/attachments')->assertStatus(403);
        }
        // The calendar event shows its workspace to admins only.
        $ev = $byName['Mehndi']['event']['id'];
        $this->assertSame(['id' => self::MEHNDI_WS, 'name' => 'Mehndi'], $mahi->get("/events/$ev")->json('data.workspace'));
        $this->assertNull($this->loginAs('papa')->get("/events/$ev")->json('data.workspace'));
    }

    #[Endpoint('POST /workspaces')]
    #[Endpoint('PATCH /workspaces/{id}')]
    #[Endpoint('DELETE /workspaces/{id}')]
    #[Endpoint('POST /workspaces/{id}/restore')]
    public function test_add_rename_link_delete_and_restore_a_workspace(): void
    {
        $ayush = $this->loginAs('ayush');
        $this->loginAs('papa')->postJson('/workspaces', ['name' => 'Haldi'])->assertStatus(403);
        $w = $ayush->postJson('/workspaces', ['name' => 'Haldi'])->assertStatus(201)->json('data');
        $this->assertSame(80, $w['sort_order']);
        $this->assertSame('A workspace called Mehndi already exists.', $ayush->postJson('/workspaces', ['name' => 'Mehndi'])->assertStatus(422)->json('error.fields.name'));
        $haldi = (string) $this->db()->value("SELECT public_id FROM events WHERE type = 'haldi'");
        $mehndiEv = (string) $this->db()->value("SELECT public_id FROM events WHERE type = 'mehndi'");
        $this->assertSame('This event already has a workspace: Mehndi.', $ayush->patchJson("/workspaces/{$w['id']}", ['event_id' => $mehndiEv], 1)->assertStatus(422)->json('error.fields.event_id'));
        $w = $ayush->patchJson("/workspaces/{$w['id']}", ['name' => 'Haldi & Chooda', 'event_id' => $haldi], 1)->assertStatus(200)->json('data');
        $this->assertSame(['Haldi & Chooda', 'Haldi'], [$w['name'], $w['event']['name']]);
        $d = $ayush->request('DELETE', "/workspaces/{$w['id']}", null, [], [], ['ifMatch' => 2])->assertStatus(200);
        $this->assertSame('Deleted Haldi & Chooda', $d->json('meta.undo.summary'));
        $this->assertNotContains('Haldi & Chooda', array_column($ayush->get('/workspaces')->json('data'), 'name'));
        $ayush->postJson("/workspaces/{$w['id']}/restore", new \stdClass(), [], ['ifMatch' => 3])->assertStatus(200);
        $this->assertContains('Haldi & Chooda', array_column($ayush->get('/workspaces')->json('data'), 'name'));
    }

    public function test_tasks_belong_to_a_workspace_and_show_in_its_strip(): void
    {
        $ayush = $this->loginAs('ayush');
        $t = $ayush->postJson('/tasks', ['title' => 'Book mehndi artist', 'workspace_id' => self::MEHNDI_WS, 'workspace_section' => 'bride_outfit', 'due_date' => '2026-12-01'])->assertStatus(201)->json('data');
        $this->assertSame(['id' => self::MEHNDI_WS, 'name' => 'Mehndi'], $t['workspace']);
        $this->assertSame('bride_outfit', $t['workspace_section']);
        $ayush->postJson('/tasks', ['title' => 'Not in a workspace'])->assertStatus(201);
        $ws = $ayush->get('/workspaces/' . self::MEHNDI_WS)->json('data');
        $this->assertSame(['Book mehndi artist'], array_column($ws['tasks'], 'title'));
        $this->assertSame(1, $ws['counts']['tasks_open']);
        $this->assertSame(['Book mehndi artist'], array_column($ayush->get('/tasks', ['view' => 'all', 'workspace' => self::MEHNDI_WS])->json('data'), 'title'));
        // Family edits tasks but doesn't move them between workspaces.
        $this->loginAs('papa')->patchJson("/tasks/{$t['id']}", ['workspace_id' => null], 1)->assertStatus(403);
        $this->loginAs('papa')->patchJson("/tasks/{$t['id']}", ['notes' => 'Ask Rekha'], 1)->assertStatus(200);
        // A section without a workspace means nothing: dropped.
        $x = $ayush->postJson('/tasks', ['title' => 'Loose', 'workspace_section' => 'menu', 'allow_duplicate' => true])->json('data');
        $this->assertNull($x['workspace_section']);
    }

    #[Endpoint('POST /attachment-uploads')]
    #[Endpoint('POST /attachment-uploads/{id}/chunks')]
    #[Endpoint('POST /attachment-uploads/{id}/finish')]
    #[Endpoint('POST /attachments')]
    #[Endpoint('GET /attachments/{id}/file')]
    public function test_a_big_video_in_pieces_any_size_stored_in_the_database_with_byte_ranges(): void
    {
        $mahi = $this->loginAs('mahi');
        $video = random_bytes(self::CHUNK * 2 + 12345); // 3 pieces
        $start = $mahi->postJson('/attachment-uploads', ['name' => 'trial.mp4', 'mime_type' => 'video/mp4', 'size_bytes' => strlen($video), 'sha256' => hash('sha256', $video)])->assertStatus(201)->json('data');
        $this->assertSame([false, 3, self::CHUNK, []], [$start['complete'], $start['chunk_count'], $start['chunk_size'], $start['received']]);
        $id = $start['upload_id'];
        $pieces = str_split($video, self::CHUNK);
        $send = fn (int $i, ?string $b = null) => $mahi->upload("/attachment-uploads/$id/chunks", $b ?? $pieces[$i], 'blob', ['seq' => (string) $i, 'sha256' => null], ['field' => 'chunk']);
        $send(0)->assertStatus(200);
        $send(0)->assertStatus(200); // sent twice (weak signal): stored once
        $this->assertSame([0, 2], $send(2)->json('data.received'));
        $send(1, 'too short')->assertStatus(422);
        $this->assertSame([0, 2], $mahi->postJson("/attachment-uploads/$id/finish", new \stdClass())->assertStatus(422)->assertErrorCode('upload_incomplete')->json('error.received'));
        $send(1)->assertStatus(200);
        $done = $mahi->postJson("/attachment-uploads/$id/finish", new \stdClass())->assertStatus(200)->json('data');
        $this->assertTrue($done['complete']);
        $this->assertSame(3, $this->rows('vault_file_chunks'));
        $a = $this->add($mahi, ['kind' => 'video', 'upload_id' => $id, 'title' => 'Lehenga trial', 'workspace_id' => self::MEHNDI_WS, 'section' => 'bride_outfit'])->assertStatus(201)->json('data');
        $this->assertSame(['ATT-000001', 'video', 'Mehndi › Bride outfit'], [$a['code'], $a['kind'], $a['used_in'][0]['path']]);
        $file = $mahi->get("/attachments/{$a['id']}/file");
        $file->assertStatus(200);
        $this->assertSame($video, $file->body());
        $this->assertSame('bytes', $file->header('Accept-Ranges'));
        // A range across a piece boundary
        $from = self::CHUNK - 10;
        $part = $mahi->get("/attachments/{$a['id']}/file", [], ['range' => 'bytes=' . $from . '-' . ($from + 19)]);
        $part->assertStatus(206);
        $this->assertSame(substr($video, $from, 20), $part->body());
        $this->assertSame("bytes $from-" . ($from + 19) . '/' . strlen($video), $part->header('Content-Range'));
        $this->assertSame(substr($video, -5), $mahi->get("/attachments/{$a['id']}/file", [], ['range' => 'bytes=-5'])->body());
        $mahi->get("/attachments/{$a['id']}/file", [], ['range' => 'bytes=' . strlen($video) . '-'])->assertStatus(416);
        // The same file again is not sent again.
        $again = $mahi->postJson('/attachment-uploads', ['name' => 'copy.mp4', 'mime_type' => 'video/mp4', 'size_bytes' => strlen($video), 'sha256' => hash('sha256', $video)])->assertStatus(200)->json('data');
        $this->assertTrue($again['complete']);
        $this->loginAs('papa')->get("/attachments/{$a['id']}/file")->assertStatus(403);
    }

    public function test_a_wrong_checksum_starts_the_upload_again(): void
    {
        $c = $this->loginAs('ayush');
        $bytes = random_bytes(1000);
        $id = $c->postJson('/attachment-uploads', ['name' => 'x.bin', 'size_bytes' => 1000, 'sha256' => str_repeat('0', 64)])->json('data.upload_id');
        $c->upload("/attachment-uploads/$id/chunks", $bytes, 'blob', ['seq' => '0', 'sha256' => null], ['field' => 'chunk'])->assertStatus(200);
        $c->postJson("/attachment-uploads/$id/finish", new \stdClass())->assertStatus(422)->assertErrorCode('checksum_mismatch');
        $this->assertSame(0, $this->rows('vault_file_chunks'));
        $this->add($c, ['kind' => 'document', 'upload_id' => $id, 'title' => 'X'])->assertStatus(422);
    }

    #[Endpoint('GET /attachments/check-code')]
    #[Endpoint('PATCH /attachments/{id}')]
    public function test_the_editable_id_is_unique_across_the_app_capitals_ignored(): void
    {
        $c = $this->loginAs('ayush');
        $photo = $this->add($c, ['kind' => 'photo', 'upload_id' => $this->upload($c, $this->jpeg(), 'lehenga.jpg', 'image/jpeg'), 'title' => 'Red lehenga sketch', 'workspace_id' => self::MEHNDI_WS, 'section' => 'bride_outfit'])->assertStatus(201)->json('data');
        $this->assertSame('image/jpeg', $photo['file']['mime_type']);
        $this->assertSame([40, 30], [$photo['file']['width_px'], $photo['file']['height_px']]);
        $link = $this->add($c, ['kind' => 'link', 'url' => 'https://example.com/decor', 'title' => 'Decor idea', 'code' => 'MEHNDI-DECOR-02'])->assertStatus(201)->json('data');
        $this->assertSame('MEHNDI-DECOR-02', $link['code']);
        // Change the photo's ID; another one can't take it, whatever the capitals.
        $p = $c->patchJson("/attachments/{$photo['id']}", ['code' => 'BRIDE-LEHENGA-01'], 1)->assertStatus(200)->json('data');
        $this->assertSame('BRIDE-LEHENGA-01', $p['code']);
        $err = $c->patchJson("/attachments/{$link['id']}", ['code' => 'bride-lehenga-01'], 1)->assertStatus(422)->json('error.fields.code');
        $this->assertSame("ID bride-lehenga-01 is already used by 'Red lehenga sketch' (Mehndi › Bride outfit).", $err);
        $this->assertSame('Use 3 to 30 letters, numbers, - or _ (no spaces).', $c->patchJson("/attachments/{$link['id']}", ['code' => 'has space'], 1)->assertStatus(422)->json('error.fields.code'));
        $this->assertFalse($c->get('/attachments/check-code', ['code' => 'Bride-Lehenga-01'])->json('data.available'));
        $this->assertTrue($c->get('/attachments/check-code', ['code' => 'BRIDE-LEHENGA-01', 'except' => $photo['id']])->json('data.available'));
        $this->assertTrue($c->get('/attachments/check-code', ['code' => 'FREE-ONE'])->json('data.available'));
        // A deleted attachment keeps its ID until it is gone for good.
        $c->request('DELETE', "/attachments/{$photo['id']}", null, [], [], ['ifMatch' => 2])->assertStatus(200);
        $this->assertStringContainsString('(Deleted items)', $c->patchJson("/attachments/{$link['id']}", ['code' => 'BRIDE-LEHENGA-01'], 1)->assertStatus(422)->json('error.fields.code'));
        // History says it in plain words.
        $this->assertStringContainsString('changed ID from ATT-000001 to BRIDE-LEHENGA-01', implode("\n", array_column($c->get("/attachments/{$photo['id']}/history")->json('data'), 'sentence')));
    }

    #[Endpoint('GET /attachments')]
    #[Endpoint('GET /attachments/{id}')]
    #[Endpoint('POST /attachments/{id}/links')]
    #[Endpoint('DELETE /attachment-links/{id}')]
    #[Endpoint('POST /attachment-links/{id}/restore')]
    public function test_one_attachment_many_places_unlink_keeps_it_filters_and_storage(): void
    {
        $c = $this->loginAs('mahi');
        $reception = '01JC0WS0000000000000000006';
        $fabric = $this->add($c, ['kind' => 'text', 'body' => 'Gold zari on maroon', 'title' => 'Fabric note', 'workspace_id' => self::MEHNDI_WS, 'section' => 'bride_outfit', 'is_favourite' => true])->assertStatus(201)->json('data');
        $c->postJson("/attachments/{$fabric['id']}/links", ['workspace_id' => $reception, 'section' => 'decor'])->assertStatus(200);
        $twice = $c->postJson("/attachments/{$fabric['id']}/links", ['workspace_id' => $reception, 'section' => 'decor'])->assertStatus(200)->json('data');
        $this->assertSame(['Mehndi › Bride outfit', 'Reception › Theme & decoration'], array_column($twice['used_in'], 'path'));
        $loose = $this->add($c, ['kind' => 'link', 'url' => 'https://example.com/x', 'title' => 'Loose idea'])->assertStatus(201)->json('data');
        $ids = fn (array $q) => array_column($c->get('/attachments', $q)->assertStatus(200)->json('data'), 'title');
        $this->assertSame(['Fabric note'], $ids(['workspace' => $reception]));
        $this->assertSame(['Fabric note'], $ids(['section' => 'bride_outfit']));
        $this->assertSame(['Fabric note'], $ids(['favourite' => '1']));
        $this->assertSame(['Loose idea'], $ids(['unlinked' => '1']));
        $this->assertSame(['Fabric note'], $ids(['q' => 'fabric']));
        $this->assertSame(['Loose idea'], $ids(['kind' => 'link']));
        $c->get('/attachments', ['kind' => 'gif'])->assertStatus(400);
        $meta = $c->get('/attachments')->json('meta.storage');
        $this->assertSame(3221225472, $meta['limit_bytes']);
        $this->assertFalse($meta['warn']);
        // Unlink from Reception only: still in Mehndi and in the Vault; Undo brings the link back.
        $u = $c->request('DELETE', '/attachment-links/' . $twice['used_in'][1]['link_id'], null, [], [], ['ifMatch' => 1])->assertStatus(200);
        $this->assertSame(['Mehndi › Bride outfit'], array_column($c->get("/attachments/{$fabric['id']}")->json('data.used_in'), 'path'));
        $c->postJson('/attachment-links/' . $twice['used_in'][1]['link_id'] . '/restore', new \stdClass(), [], ['ifMatch' => 2])->assertStatus(200);
        $this->assertCount(2, $c->get("/attachments/{$fabric['id']}")->json('data.used_in'));
        $this->assertNotEmpty($u->json('meta.undo.batch_id'));
    }

    #[Endpoint('DELETE /attachments/{id}')]
    #[Endpoint('POST /attachments/{id}/restore')]
    public function test_delete_everywhere_with_undo_and_documents_live_in_the_vault(): void
    {
        $c = $this->loginAs('ayush');
        $a = $this->add($c, ['kind' => 'link', 'url' => 'https://example.com/m', 'title' => 'Menu idea', 'workspace_id' => self::MEHNDI_WS, 'section' => 'menu'])->json('data');
        $d = $c->request('DELETE', "/attachments/{$a['id']}", null, [], [], ['ifMatch' => 1])->assertStatus(200);
        $this->assertSame(1, $this->rows('attachment_links', 'deleted_at IS NOT NULL'), 'its link went in the same batch');
        $this->assertSame([], $c->get('/attachments', ['workspace' => self::MEHNDI_WS])->json('data'));
        $c->postJson('/undo/' . $d->json('meta.undo.batch_id'), new \stdClass())->assertStatus(200);
        $this->assertSame(['Menu idea'], array_column($c->get('/attachments', ['workspace' => self::MEHNDI_WS])->json('data'), 'title'));
        $c->postJson("/attachments/{$a['id']}/restore", new \stdClass(), [], ['ifMatch' => 3])->assertStatus(200); // already back: fine
        // A new document shows in the Vault with the next ID; it is deleted in Documents, not here.
        $pdf = "%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n";
        $doc = $c->upload('/documents', $pdf, 'contract.pdf', ['type' => 'contract', 'title' => 'Tent contract'])->assertStatus(201)->json('data');
        $v = array_values(array_filter($c->get('/attachments', ['kind' => 'document'])->json('data'), static fn ($x) => $x['title'] === 'Tent contract'))[0];
        $this->assertSame(['ATT-000002', $doc['id'], "/api/v1/documents/{$doc['id']}/file", 'Documents'], [$v['code'], $v['document']['id'], $v['file_url'], $v['used_in'][0]['path']]);
        $this->assertSame('This is a document. Change or delete it in Documents.', $c->request('DELETE', "/attachments/{$v['id']}", null, [], [], ['ifMatch' => 1])->assertStatus(422)->json('error.message'));
        $c->patchJson("/attachments/{$v['id']}", ['code' => 'TENT-CONTRACT', 'is_favourite' => true], 1)->assertStatus(200);
        $c->request('DELETE', "/documents/{$doc['id']}", null, [], [], ['ifMatch' => 1])->assertStatus(200);
        $this->assertSame([], array_values(array_filter($c->get('/attachments')->json('data'), static fn ($x) => $x['title'] === 'Tent contract')), 'a deleted document leaves the Vault too');
    }

    public function test_family_cannot_add_attachments_or_upload(): void
    {
        foreach (['papa', 'mummy', 'nani'] as $who) {
            $p = $this->loginAs($who);
            $p->postJson('/attachments', ['kind' => 'link', 'url' => 'https://example.com', 'title' => 'x'])->assertStatus(403);
            $p->postJson('/attachment-uploads', ['name' => 'a', 'size_bytes' => 1, 'sha256' => str_repeat('a', 64)])->assertStatus(403);
            $p->postJson('/workspaces', ['name' => 'Mine'])->assertStatus(403);
        }
    }

    /** Bug found by the phone tests: every 2 MB piece counted against the 120 writes / 5 min, so a long video failed. */
    public function test_upload_pieces_have_their_own_limit_and_never_use_up_the_writes(): void
    {
        $c = $this->loginAs('mahi');
        $id = $c->postJson('/attachment-uploads', ['name' => 'long.mp4', 'size_bytes' => 10, 'sha256' => hash('sha256', '0123456789')])->json('data.upload_id');
        for ($i = 0; $i < 130; $i++) {
            $c->upload("/attachment-uploads/$id/chunks", '0123456789', 'blob', ['seq' => '0', 'sha256' => null], ['field' => 'chunk'])->assertStatus(200);
        }
        $c->postJson("/attachment-uploads/$id/finish", new \stdClass())->assertStatus(200);
        $this->add($c, ['kind' => 'video', 'upload_id' => $id, 'title' => 'Long video'])->assertStatus(201);
    }
}
