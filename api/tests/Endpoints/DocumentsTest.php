<?php
declare(strict_types=1);

namespace Tests\Endpoints;

use Tests\Support\ApiClient;
use Tests\Support\ApiTestCase;
use Tests\Support\Endpoint;
use Tests\Support\TestResponse;

/**
 * /documents… — FEATURES B7 (AC-DOC-02…06), API.md §6.9 and §8, TESTING §1.3 documents row,
 * SEC-02/03/25, DS-04/11. People: Ayush owner, Papa family + money, Mummy family no money, Nani viewer.
 */
final class DocumentsTest extends ApiTestCase
{
    private const MEHNDI = '01M4DK5T3E6QZBMNQ0V7KQWW23';
    private const TENT_VENDOR = '01JA6ZB0000000000000000001';

    private function jpeg(int $w = 40, int $h = 30, int $seed = 1): string
    {
        $im = imagecreatetruecolor($w, $h);
        imagefill($im, 0, 0, imagecolorallocate($im, ($seed * 37) % 255, ($seed * 91) % 255, 120));
        ob_start();
        imagejpeg($im, null, 80);
        return (string) ob_get_clean();
    }

    private function pdf(string $text = 'Contract'): string
    {
        return "%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n% $text\ntrailer << /Root 1 0 R >>\n%%EOF\n";
    }

    private function up(ApiClient $c, string $bytes, array $fields = [], string $name = 'IMG_4021.jpg', array $opts = []): TestResponse
    {
        return $c->upload('/documents', $bytes, $name, $fields + ['type' => 'receipt'], $opts);
    }

    private function storedFiles(): array
    {
        $dir = $this->logDir . '/storage/uploads';
        if (!is_dir($dir)) {
            return [];
        }
        $out = [];
        foreach (new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($dir, \FilesystemIterator::SKIP_DOTS)) as $f) {
            if ($f->getFilename() !== '.htaccess') {
                $out[] = $f->getPathname();
            }
        }
        return $out;
    }

    #[Endpoint('POST /documents')]
    public function test_upload_photo_stored_outside_web_auto_title_ds04(): void
    {
        $ayush = $this->loginAs('ayush');
        $bytes = $this->jpeg(64, 48);
        $key = '5b1f0b52-3a2d-4c1e-9f00-000000001001';
        $r = $this->up($ayush, $bytes, ['vendor_id' => self::TENT_VENDOR, 'event_id' => self::MEHNDI], 'IMG_4021.jpg', ['idem' => $key])->assertStatus(201)->assertEnvelope();
        $d = $r->json('data');
        $this->assertSame('Receipt – Shree Tent House – 8 Oct 2026', $d['title']);
        $this->assertSame(['original_name' => 'IMG_4021.jpg', 'mime_type' => 'image/jpeg', 'size_bytes' => strlen($bytes), 'width_px' => 64, 'height_px' => 48],
            array_intersect_key($d['file'], array_flip(['original_name', 'mime_type', 'size_bytes', 'width_px', 'height_px'])));
        $this->assertSame(['Shree Tent House', 'Mehndi'], [$d['vendor']['name'], $d['event']['name']]);
        $this->assertSame("/api/v1/documents/{$d['id']}/file", $d['file_url']);
        $files = $this->storedFiles();
        $this->assertCount(1, $files);
        $this->assertMatchesRegularExpression('#/storage/uploads/2026/10/[0-9a-f-]{36}\.jpg$#', $files[0]);
        $this->assertSame($bytes, file_get_contents($files[0]));
        $this->assertFileExists($this->logDir . '/storage/uploads/.htaccess');
        // DS-04: the same key again → the same document, no second file
        $again = $this->up($ayush, $bytes, ['vendor_id' => self::TENT_VENDOR, 'event_id' => self::MEHNDI], 'IMG_4021.jpg', ['idem' => $key])->assertStatus(201);
        $this->assertSame($d, $again->json('data'));
        $this->assertSame(1, $this->rows('documents'));
        $this->up($this->loginAs('nani'), $this->jpeg())->assertStatus(403);
    }

    #[Endpoint('POST /documents')]
    public function test_ac_doc_04_same_file_twice_then_save_again_on_the_same_file(): void
    {
        $papa = $this->loginAs('papa');
        $bytes = $this->pdf();
        $this->up($papa, $bytes, ['type' => 'contract', 'title' => 'Tent contract'], 'contract.pdf')->assertStatus(201);
        $dup = $this->up($papa, $bytes, ['type' => 'contract'], 'contract (1).pdf')->assertStatus(409)->assertErrorCode('duplicate_found');
        $this->assertSame("This file is already saved as 'Tent contract'.", $dup->json('error.message'));
        $this->up($papa, $bytes, ['type' => 'contract', 'allow_duplicate' => 'true'], 'contract (1).pdf')->assertStatus(201);
        $this->assertSame([2, 1], [$this->rows('documents'), $this->rows('files')]);
        $this->assertCount(1, $this->storedFiles());
    }

    #[Endpoint('POST /documents')]
    public function test_sec25_dangerous_uploads_refused_nothing_kept(): void
    {
        $papa = $this->loginAs('papa');
        $svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
        $this->up($papa, $svg, [], 'logo.svg')->assertStatus(415)->assertErrorCode('unsupported_type');
        $this->up($papa, '<html><body>hi</body></html>', [], 'page.html')->assertStatus(415);
        $this->up($papa, "<?php echo 'x';", [], 'photo.jpg')->assertStatus(415); // a .php renamed .jpg
        $this->up($papa, "MZ\x90\x00\x03" . str_repeat("\x00", 200), [], 'contract.pdf')->assertStatus(415); // AC-DOC-06: an .exe renamed .pdf
        $heic = "\x00\x00\x00\x18ftypheic\x00\x00\x00\x00mif1heic" . str_repeat("\x00", 64);
        $h = $this->up($papa, $heic, [], 'IMG_0001.HEIC');
        $this->assertContains($h->status(), [415]);
        $this->up($papa, '', [], 'empty.jpg')->assertStatus(422);
        $big = $this->up($papa, str_repeat('A', 10485761), [], 'big.jpg')->assertStatus(413)->assertErrorCode('file_too_big'); // AC-DOC-05
        $this->assertSame('This file is too big (10 MB). Max 10 MB.', $big->json('error.message'));
        $this->up($papa, $this->jpeg(), ['sha256' => str_repeat('0', 64)])->assertStatus(422)->assertErrorCode('checksum_mismatch');
        $this->up($papa, $this->jpeg(), ['type' => 'selfie'])->assertStatus(422);
        $this->assertSame(0, $this->rows('files'));
        $this->assertSame([], $this->storedFiles(), 'no file on disk');
    }

    #[Endpoint('GET /documents')]
    public function test_list_visibility_private_and_payment_linked_ac_doc_03(): void
    {
        $ayush = $this->loginAs('ayush');
        $pay = $ayush->postJson('/payments', ['title' => 'Tent advance', 'amount_paise' => 5000000, 'vendor_id' => self::TENT_VENDOR])->json('data.id');
        $this->up($ayush, $this->jpeg(seed: 1), ['payment_id' => $pay])->assertStatus(201);
        $this->up($ayush, $this->jpeg(seed: 2), ['type' => 'id', 'title' => 'Aadhaar'])->assertStatus(201); // IDs default to private
        $this->up($ayush, $this->pdf('quote'), ['type' => 'quotation', 'title' => 'Tent quote', 'vendor_id' => self::TENT_VENDOR], 'quote.pdf')->assertStatus(201);
        $titles = fn (ApiClient $c, array $q = []) => array_column($c->get('/documents', $q)->assertStatus(200)->json('data'), 'title');
        $this->assertSame(['Tent quote', 'Aadhaar', 'Receipt – Shree Tent House – 8 Oct 2026'], $titles($ayush));
        $this->assertSame(['Tent quote', 'Receipt – Shree Tent House – 8 Oct 2026'], $titles($this->loginAs('papa')));
        $this->assertSame(['Tent quote'], $titles($this->loginAs('mummy')), 'no private, no payment-linked');
        $this->assertSame(['Tent quote'], $titles($this->loginAs('nani')));
        $this->assertSame(['Receipt – Shree Tent House – 8 Oct 2026'], $titles($ayush, ['payment' => $pay]));
        $this->assertSame(['Tent quote'], $titles($ayush, ['type' => 'quotation']));
        $this->assertSame(['Tent quote', 'Receipt – Shree Tent House – 8 Oct 2026'], $titles($ayush, ['vendor' => self::TENT_VENDOR]), 'a receipt also shows on its vendor');
        $this->assertSame(1, $ayush->get("/payments/$pay")->json('data.receipt_count'));
        $ayush->get('/documents', ['type' => 'selfie'])->assertStatus(400);
    }

    #[Endpoint('GET /documents/{id}')]
    public function test_sec02_private_document_by_id(): void
    {
        $ayush = $this->loginAs('ayush');
        $id = $this->up($ayush, $this->jpeg(), ['type' => 'id', 'title' => 'Passport'])->json('data.id');
        $this->assertTrue($ayush->get("/documents/$id")->assertStatus(200)->json('data.is_private'));
        $this->loginAs('papa')->get("/documents/$id")->assertStatus(403);
        $this->loginAs('papa')->get('/documents/1')->assertStatus(404);
    }

    #[Endpoint('GET /documents/{id}/file')]
    public function test_file_download_headers_range_and_sec02_sec03_ac_doc_02(): void
    {
        $ayush = $this->loginAs('ayush');
        $bytes = $this->pdf(str_repeat('x', 500));
        $id = $this->up($ayush, $bytes, ['type' => 'contract', 'title' => 'शर्मा contract'], 'शर्मा contract.pdf')->json('data.id');
        $f = $ayush->get("/documents/$id/file")->assertStatus(200);
        $this->assertSame($bytes, $f->body());
        $this->assertSame('application/pdf', $f->header('Content-Type'));
        $this->assertSame("inline; filename*=UTF-8''" . rawurlencode('शर्मा contract.pdf'), $f->header('Content-Disposition'));
        $this->assertSame('private, no-store', $f->header('Cache-Control'));
        $this->assertSame('"' . hash('sha256', $bytes) . '"', $f->header('ETag'));
        $this->assertSame('bytes', $f->header('Accept-Ranges'));
        $this->assertStringStartsWith('attachment;', $ayush->get("/documents/$id/file", ['download' => '1'])->header('Content-Disposition'));
        $part = $ayush->get("/documents/$id/file", [], ['range' => 'bytes=0-7'])->assertStatus(206);
        $this->assertSame('%PDF-1.4', $part->body());
        $this->assertSame('bytes 0-7/' . strlen($bytes), $part->header('Content-Range'));
        $this->assertSame(substr($bytes, -6), $ayush->get("/documents/$id/file", [], ['range' => 'bytes=-6'])->assertStatus(206)->body());
        $ayush->get("/documents/$id/file", [], ['range' => 'bytes=99999-'])->assertStatus(416);
        // AC-DOC-02: not logged in → 401; private → 403 (SEC-02); payment-linked for a non-money user → 403 (SEC-03)
        (new ApiClient($this->app))->get("/documents/$id/file")->assertStatus(401);
        $priv = $this->up($ayush, $this->jpeg(seed: 5), ['type' => 'id'])->json('data.id');
        $denied = $this->loginAs('papa')->get("/documents/$priv/file")->assertStatus(403);
        $this->assertStringStartsWith('application/json', (string) $denied->header('Content-Type'), 'an error message, never the file bytes');
        $this->assertStringNotContainsString("\xFF\xD8\xFF", $denied->body());
        $pay = $ayush->postJson('/payments', ['title' => 'Band advance', 'amount_paise' => 100000])->json('data.id');
        $rec = $this->up($ayush, $this->jpeg(seed: 6), ['payment_id' => $pay])->json('data.id');
        $this->loginAs('mummy')->get("/documents/$rec/file")->assertStatus(403);
        $this->loginAs('papa')->get("/documents/$rec/file")->assertStatus(200);
    }

    #[Endpoint('PATCH /documents/{id}')]
    public function test_edit_details_family_own_uploads_only(): void
    {
        $papa = $this->loginAs('papa');
        $id = $this->up($papa, $this->jpeg(), ['type' => 'other'])->json('data.id');
        $papa->patchJson("/documents/$id", ['title' => 'Mehndi decor idea', 'type' => 'photo', 'event_id' => self::MEHNDI], 1)->assertStatus(200);
        $this->assertSame(['Mehndi decor idea', 'photo', 'Mehndi'], array_values(array_intersect_key($papa->get("/documents/$id")->json('data'), array_flip(['title', 'type'])) + ['e' => $papa->get("/documents/$id")->json('data.event.name')]));
        $papa->patchJson("/documents/$id", ['is_private' => true], 2)->assertStatus(403); // only admins set private
        $this->loginAs('mummy')->patchJson("/documents/$id", ['title' => 'Mine now'], 2)->assertStatus(403); // not her upload
        $this->loginAs('ayush')->patchJson("/documents/$id", ['is_private' => true], 2)->assertStatus(200);
        $this->assertSame('Papa changed Title, Type and Event for Mehndi decor idea.', mb_substr($this->loginAs('ayush')->get("/documents/$id/history")->json('data.1.sentence'), 0));
    }

    #[Endpoint('DELETE /documents/{id}')]
    public function test_ds11_delete_undo_and_payment_with_receipts(): void
    {
        $papa = $this->loginAs('papa');
        $id = $this->up($papa, $this->jpeg())->json('data.id');
        $before = $this->row('SELECT * FROM documents');
        $this->loginAs('mummy')->request('DELETE', "/documents/$id", null, [], [], ['ifMatch' => 1])->assertStatus(403);
        $r = $papa->request('DELETE', "/documents/$id", null, [], [], ['ifMatch' => 1])->assertStatus(200);
        $papa->get("/documents/$id/file")->assertStatus(404);
        $this->loginAs('ayush')->get("/documents/$id/file")->assertStatus(200); // admins can still open it from Deleted items
        $this->assertCount(1, $this->storedFiles(), 'the file stays on disk');
        $papa = $this->loginAs('papa');
        $papa->postJson('/undo/' . $r->json('meta.undo.batch_id'), new \stdClass())->assertStatus(200);
        $strip = static fn (array $x) => array_diff_key($x, array_flip(['version', 'updated_at', 'updated_by']));
        $this->assertSame($strip($before), $strip($this->row('SELECT * FROM documents')));
        // a payment with its receipt: both go, both come back
        $pay = $papa->postJson('/payments', ['title' => 'Tent advance', 'amount_paise' => 5000000])->json('data.id');
        $this->up($papa, $this->jpeg(seed: 9), ['payment_id' => $pay])->assertStatus(201);
        $d = $papa->request('DELETE', "/payments/$pay", null, [], [], ['ifMatch' => 1])->assertStatus(200);
        $this->assertSame(1, $this->rows('documents', 'deleted_at IS NOT NULL'));
        $papa->postJson('/undo/' . $d->json('meta.undo.batch_id'), new \stdClass())->assertStatus(200);
        $this->assertSame(0, $this->rows('documents', 'deleted_at IS NOT NULL'));
    }

    #[Endpoint('POST /documents/{id}/restore')]
    public function test_restore_admin_only(): void
    {
        $papa = $this->loginAs('papa');
        $id = $this->up($papa, $this->jpeg())->json('data.id');
        $papa->request('DELETE', "/documents/$id", null, [], [], ['ifMatch' => 1])->assertStatus(200);
        $papa->postJson("/documents/$id/restore", new \stdClass(), [], ['ifMatch' => 2])->assertStatus(403);
        $this->loginAs('ayush')->postJson("/documents/$id/restore", new \stdClass(), [], ['ifMatch' => 2])->assertStatus(200);
    }

    /** A receipt can only be linked to a payment by someone with money access. */
    public function test_receipt_link_needs_money(): void
    {
        $pay = $this->loginAs('ayush')->postJson('/payments', ['title' => 'Tent advance', 'amount_paise' => 5000000])->json('data.id');
        $this->up($this->loginAs('mummy'), $this->jpeg(), ['payment_id' => $pay])->assertStatus(403);
        $this->assertSame(0, $this->rows('files'));
    }
}
