<?php
declare(strict_types=1);

namespace Tests\Endpoints;

use Tests\Support\ApiClient;
use Tests\Support\ApiTestCase;
use Tests\Support\Endpoint;
use Tests\Support\TestResponse;

/**
 * /home-photos (1.0.16): Home cover slideshow (8), couple photos (4), monogram (1).
 * Bytes stored in the database (photo_blobs); only Ayush and Mahi add, reorder, remove.
 */
final class HomePhotosTest extends ApiTestCase
{
    private function jpeg(int $seed = 1, int $w = 60, int $h = 40): string
    {
        $im = imagecreatetruecolor($w, $h);
        imagefill($im, 0, 0, imagecolorallocate($im, ($seed * 37) % 255, ($seed * 91) % 255, 120));
        ob_start();
        imagejpeg($im, null, 80);
        return (string) ob_get_clean();
    }

    private function up(ApiClient $c, string $bytes, string $slot = 'cover', array $opts = []): TestResponse
    {
        return $c->upload('/home-photos', $bytes, 'photo.jpg', ['slot' => $slot], $opts);
    }

    #[Endpoint('POST /home-photos')]
    public function test_upload_stores_bytes_in_the_database_and_replays_once(): void
    {
        $mahi = $this->loginAs('mahi');
        $bytes = $this->jpeg(1, 64, 48);
        $key = '5b1f0b52-3a2d-4c1e-9f00-000000002001';
        $d = $this->up($mahi, $bytes, 'couple', ['idem' => $key])->assertStatus(201)->assertEnvelope()->json('data');
        $this->assertSame(['couple', 0, 'image/jpeg', strlen($bytes), 64, 48], [$d['slot'], $d['sort_order'], $d['mime_type'], $d['size_bytes'], $d['width_px'], $d['height_px']]);
        $this->assertSame("/api/v1/home-photos/{$d['id']}/image?v=" . substr(hash('sha256', $bytes), 0, 16), $d['url']);
        $this->assertSame($bytes, $this->db()->value('SELECT data FROM photo_blobs'));
        // the same key again → the same photo, nothing new
        $this->assertSame($d, $this->up($mahi, $bytes, 'couple', ['idem' => $key])->json('data'));
        $this->assertSame([1, 1], [$this->rows('home_photos'), $this->rows('photo_blobs')]);
        // the audit log never holds image bytes
        $after = (string) $this->db()->value("SELECT after_json FROM audit_log WHERE entity_type = 'home_photo'");
        $this->assertArrayNotHasKey('data', json_decode($after, true));
        // the same image in another place reuses its bytes
        $this->up($mahi, $bytes, 'cover')->assertStatus(201);
        $this->assertSame([2, 1], [$this->rows('home_photos'), $this->rows('photo_blobs')]);
    }

    #[Endpoint('POST /home-photos')]
    public function test_only_ayush_and_mahi_upload(): void
    {
        foreach (['papa', 'mummy', 'nani'] as $who) {
            $this->up($this->loginAs($who), $this->jpeg())->assertStatus(403);
        }
        $this->up($this->loginAs('ayush'), $this->jpeg())->assertStatus(201);
    }

    public function test_limits_per_place_and_bad_input(): void
    {
        $ayush = $this->loginAs('ayush');
        $this->up($ayush, $this->jpeg(1), 'monogram')->assertStatus(201);
        $r = $this->up($ayush, $this->jpeg(2), 'monogram')->assertStatus(422)->assertErrorCode('validation_failed');
        $this->assertSame('Up to 1 monogram. Remove one first.', $r->json('error.fields.slot'));
        for ($i = 1; $i <= 4; $i++) {
            $this->assertSame($i - 1, $this->up($ayush, $this->jpeg(10 + $i), 'couple')->assertStatus(201)->json('data.sort_order'));
        }
        $this->assertSame('Up to 4 couple photos. Remove one first.', $this->up($ayush, $this->jpeg(20), 'couple')->assertStatus(422)->json('error.fields.slot'));
        $this->up($ayush, $this->jpeg(3), 'wall')->assertStatus(422);
        $this->up($ayush, "%PDF-1.4\n%%EOF\n", 'cover')->assertStatus(415);
        $ayush->upload('/home-photos', $this->jpeg(4), 'x.jpg', ['slot' => 'cover', 'sha256' => str_repeat('0', 64)])->assertStatus(422)->assertErrorCode('checksum_mismatch');
        $this->assertSame(0, $this->rows('home_photos', "slot = 'cover'"));
    }

    #[Endpoint('GET /home-photos')]
    #[Endpoint('GET /home-photos/{id}/image')]
    public function test_everyone_sees_the_list_and_images(): void
    {
        $ayush = $this->loginAs('ayush');
        $bytes = $this->jpeg(5);
        $c2 = $this->up($ayush, $this->jpeg(6), 'cover')->json('data.id');
        $m = $this->up($ayush, $bytes, 'monogram')->json('data.id');
        $c1 = $this->up($ayush, $this->jpeg(7), 'cover')->json('data.id');
        $nani = $this->loginAs('nani');
        $list = $nani->get('/home-photos')->assertStatus(200);
        $this->assertSame([$c2, $c1, $m], array_column($list->json('data'), 'id'));
        $this->assertSame(['cover' => 8, 'couple' => 4, 'monogram' => 1], $list->json('meta.max'));
        $img = $nani->get("/home-photos/$m/image", ['v' => 'abc']);
        $img->assertStatus(200);
        $this->assertSame($bytes, $img->body());
        $this->assertSame('image/jpeg', $img->header('Content-Type'));
        $this->assertSame('private, no-store', $img->header('Cache-Control'));
        $etag = (string) $img->header('ETag');
        $nani->get("/home-photos/$m/image", [], ['if-none-match' => $etag])->assertStatus(304);
        (new ApiClient($this->app))->get("/home-photos/$m/image")->assertStatus(401);
        $nani->get('/home-photos/01JA6ZA0000000000000000999/image')->assertStatus(404);
    }

    #[Endpoint('PATCH /home-photos/{id}')]
    public function test_reorder_admins_only(): void
    {
        $id = $this->up($this->loginAs('ayush'), $this->jpeg())->json('data.id');
        $this->loginAs('papa')->patchJson("/home-photos/$id", ['sort_order' => 3], 1)->assertStatus(403);
        $r = $this->loginAs('mahi')->patchJson("/home-photos/$id", ['sort_order' => 3], 1)->assertStatus(200);
        $this->assertSame([3, 2], [$r->json('data.sort_order'), $r->json('data.version')]);
        $this->loginAs('mahi')->patchJson("/home-photos/$id", ['slot' => 'couple'], 2)->assertStatus(422);
    }

    #[Endpoint('DELETE /home-photos/{id}')]
    #[Endpoint('POST /home-photos/{id}/restore')]
    public function test_remove_undo_restore_and_the_limit_on_restore(): void
    {
        $ayush = $this->loginAs('ayush');
        $id = $this->up($ayush, $this->jpeg(1), 'monogram')->json('data.id');
        $this->loginAs('papa')->request('DELETE', "/home-photos/$id", null, [], [], ['ifMatch' => 1])->assertStatus(403);
        $d = $ayush->request('DELETE', "/home-photos/$id", null, [], [], ['ifMatch' => 1])->assertStatus(200);
        $this->assertSame('Deleted Monogram', $d->json('meta.undo.summary'));
        $this->assertSame([], $this->loginAs('nani')->get('/home-photos')->json('data'));
        $this->loginAs('nani')->get("/home-photos/$id/image")->assertStatus(404);
        $ayush->get("/home-photos/$id/image")->assertStatus(200); // admins still see it in Deleted items
        $this->assertSame(1, $this->rows('photo_blobs'), 'the bytes stay for Undo');
        // a new monogram fills the place: restoring the old one is refused
        $this->up($ayush, $this->jpeg(2), 'monogram')->assertStatus(201);
        $r = $ayush->postJson("/home-photos/$id/restore", new \stdClass(), [], ['ifMatch' => 2])->assertStatus(422);
        $this->assertSame('Up to 1 monogram. Remove one first.', $r->json('error.message'));
        $new = $this->db()->value("SELECT public_id FROM home_photos WHERE deleted_at IS NULL");
        $ayush->request('DELETE', "/home-photos/$new", null, [], [], ['ifMatch' => 1])->assertStatus(200);
        $this->loginAs('papa')->postJson("/home-photos/$id/restore", new \stdClass(), [], ['ifMatch' => 2])->assertStatus(403);
        $ayush->postJson("/home-photos/$id/restore", new \stdClass(), [], ['ifMatch' => 2])->assertStatus(200);
    }
}
