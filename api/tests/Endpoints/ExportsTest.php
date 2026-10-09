<?php
declare(strict_types=1);

namespace Tests\Endpoints;

use AM\Db\Db;
use AM\Modules\Exports\ExportsController;
use AM\Modules\Exports\Restore;
use AM\Modules\Exports\Snapshot;
use Tests\Support\ApiClient;
use Tests\Support\ApiTestCase;
use Tests\Support\Endpoint;
use Tests\Support\TestDb;
use Tests\Support\TestResponse;
use ZipArchive;

/**
 * /exports… — FEATURES B8 (AC-EXP-01…08), API.md §9.1, TESTING DS-21/22/23, SEC-33.
 * People: Ayush owner, Mahi partner, Papa family + money, Mummy family, Nani viewer.
 */
final class ExportsTest extends ApiTestCase
{
    private const TENT_VENDOR = '01JA6ZB0000000000000000001';

    protected function tearDown(): void
    {
        ExportsController::$whileReading = null;
        parent::tearDown();
    }

    private function jpeg(int $seed): string
    {
        $im = imagecreatetruecolor(40, 30);
        imagefill($im, 0, 0, imagecolorallocate($im, ($seed * 37) % 255, ($seed * 91) % 255, 120));
        ob_start();
        imagejpeg($im, null, 80);
        return (string) ob_get_clean();
    }

    private function export(ApiClient $c, array $opts = []): TestResponse
    {
        return $c->postJson('/exports', ['kind' => 'full'], [], $opts);
    }

    /** Download a URL (path + query) as given in download_urls, with a fresh anonymous client unless one is given. */
    private function fetch(string $url, ?ApiClient $c = null): TestResponse
    {
        $parts = parse_url($url);
        parse_str($parts['query'] ?? '', $q);
        return ($c ?? new ApiClient($this->app))->get(substr($parts['path'], strlen('/api/v1')), $q);
    }

    /** @return array<string,string> name → bytes */
    private function unzip(string $bytes): array
    {
        $f = $this->logDir . '/x-' . bin2hex(random_bytes(3)) . '.zip';
        file_put_contents($f, $bytes);
        $z = new ZipArchive();
        $this->assertTrue($z->open($f, ZipArchive::CHECKCONS) === true, 'ZIP opens and is consistent');
        $out = [];
        for ($i = 0; $i < $z->numFiles; $i++) {
            $name = (string) $z->getNameIndex($i);
            $out[$name] = (string) $z->getFromIndex($i);
        }
        $z->close();
        return $out;
    }

    /** CSV rows after the header (RFC 4180, BOM dropped). */
    private function csvRows(string $csv): array
    {
        $this->assertStringStartsWith("\u{FEFF}", $csv, 'CSV starts with a UTF-8 BOM');
        $h = fopen('php://memory', 'r+');
        fwrite($h, substr($csv, 3));
        rewind($h);
        $rows = [];
        while (($r = fgetcsv($h, null, ',', '"', '')) !== false) {
            $rows[] = $r;
        }
        return $rows;
    }

    /** Wedding data the export must carry exactly: Hindi, emoji, money, a receipt, deleted rows, a formula. */
    private function fill(ApiClient $ayush): array
    {
        $fam = $ayush->postJson('/households', ['name' => 'राम शर्मा 🙏', 'phone' => '+919829012345', 'side' => 'groom', 'adults' => 2, 'notes' => '=HYPERLINK("http://x","click")'])->assertStatus(201)->json('data');
        $gone = $ayush->postJson('/households', ['name' => 'Old Family', 'side' => 'bride', 'adults' => 1])->assertStatus(201)->json('data');
        $ayush->request('DELETE', "/households/{$gone['id']}", null, ['if-match' => '"1"'])->assertStatus(200);
        $pay = $ayush->postJson('/payments', ['title' => 'Tent advance', 'amount_paise' => 12500000, 'vendor_id' => self::TENT_VENDOR, 'due_date' => '2026-12-01'])->assertStatus(201)->json('data');
        $receipt = $ayush->upload('/documents', $this->jpeg(1), 'bill.jpg', ['type' => 'receipt', 'payment_id' => $pay['id']])->assertStatus(201)->json('data');
        $old = $ayush->upload('/documents', $this->jpeg(2), 'old.jpg', ['type' => 'photo', 'title' => 'मेहंदी photo'])->assertStatus(201)->json('data');
        $ayush->request('DELETE', "/documents/{$old['id']}", null, ['if-match' => '"1"'])->assertStatus(200);
        return compact('fam', 'gone', 'pay', 'receipt', 'old');
    }

    #[Endpoint('POST /exports')]
    #[Endpoint('GET /exports/{id}/download')]
    public function test_ds21_every_row_every_file_hindi_bom_ist_rupees_formula_safe(): void
    {
        $ayush = $this->loginAs('ayush');
        $data = $this->fill($ayush);
        $e = $this->export($ayush)->assertStatus(201)->assertEnvelope()->json('data');
        $this->assertSame(['full', 'ready', 1], [$e['kind'], $e['status'], $e['parts']]);
        $this->assertSame('wedding-export_2026-10-08.zip', $e['file_name']);
        $this->assertSame('2026-10-09T09:12:31Z', $e['expires_at']);
        $this->assertCount(1, $e['download_urls']);
        $this->assertMatchesRegularExpression('#^/api/v1/exports/[0-9A-Z]{26}/download\?part=1&t=[A-Za-z0-9_-]{43}$#', $e['download_urls'][0]);

        $res = $this->fetch($e['download_urls'][0])->assertStatus(200); // the token alone, no cookie (iPhone download sheet)
        $this->assertSame('application/zip', $res->header('Content-Type'));
        $this->assertSame('attachment; filename="wedding-export_2026-10-08.zip"', $res->header('Content-Disposition'));
        $this->assertSame('private, no-store', $res->header('Cache-Control'));
        $this->assertSame('no-referrer', $res->header('Referrer-Policy'));
        $zip = $this->unzip($res->body());

        // AC-EXP-01: README, summary, manifest, json, csv
        foreach (['README.txt', 'summary.html', 'manifest.json', 'json/all.json', 'csv/households.csv', 'csv/audit_log.csv', 'csv/documents.csv'] as $f) {
            $this->assertArrayHasKey($f, $zip, "$f in the ZIP");
        }
        $all = json_decode($zip['json/all.json'], true, 512, JSON_THROW_ON_ERROR);
        $db = $this->db();
        $tables = array_column($db->all("SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'"), 't');
        foreach ($tables as $t) {
            if (in_array($t, Snapshot::SKIP_TABLES, true)) {
                $this->assertArrayNotHasKey("csv/$t.csv", $zip, "$t is not exported");
                continue;
            }
            $count = $this->rows($t);
            if ($t === 'audit_log') {
                $count -= $this->rows('audit_log', "entity_type = 'export'"); // making and downloading it came after the snapshot
            } elseif ($t === 'exports') {
                $count -= 1; // its own row too
            }
            $this->assertCount($count + 1, $this->csvRows($zip["csv/$t.csv"]), "csv/$t.csv has every row incl. deleted (AC-EXP-03)");
            $this->assertCount($count, $all['tables'][$t]['rows'], "json $t");
        }
        // No secrets anywhere
        foreach ($zip as $name => $bytes) {
            if (str_starts_with($name, 'csv/') || str_starts_with($name, 'json/')) {
                foreach (Snapshot::SECRET_COLUMNS as $c) {
                    $this->assertStringNotContainsString($c, $bytes, "$c in $name");
                }
                $this->assertStringNotContainsString('$2y$', $bytes, "a password hash in $name");
            }
        }
        // Hindi, emoji, phone kept, formula made safe (AC-EXP-02/07), deleted rows have deleted_at
        $fam = $this->csvRows($zip['csv/households.csv']);
        $head = $fam[0];
        $byName = [];
        foreach (array_slice($fam, 1) as $r) {
            $byName[$r[array_search('name', $head, true)]] = array_combine($head, $r);
        }
        $ram = $byName['राम शर्मा 🙏'];
        $this->assertSame('+919829012345', $ram['phone']);
        $this->assertSame('\'=HYPERLINK("http://x","click")', $ram['notes']);
        $this->assertSame('2026-10-08 14:42', $ram['created_at'], 'IST, not UTC');
        $this->assertSame('2026-10-08 14:42', $byName['Old Family']['deleted_at']);
        // Money in rupees with 2 decimals; paise in the JSON
        $pays = $this->csvRows($zip['csv/payments.csv']);
        $this->assertContains('amount_rupees', $pays[0]);
        $col = array_search('amount_rupees', $pays[0], true);
        $this->assertContains('125000.00', array_column(array_slice($pays, 1), $col));
        $pcols = $all['tables']['payments']['columns'];
        $this->assertContains(12500000, array_column($all['tables']['payments']['rows'], array_search('amount_paise', $pcols, true)));
        // Every file, same SHA-256, incl. the deleted document's; mapped in documents.csv
        foreach ($db->all('SELECT sha256 FROM files') as $f) {
            $found = array_filter($zip, static fn ($b, $n) => str_starts_with($n, 'documents/') && hash('sha256', $b) === $f['sha256'], ARRAY_FILTER_USE_BOTH);
            $this->assertCount(1, $found, 'file ' . $f['sha256'] . ' in documents/');
        }
        $docs = $this->csvRows($zip['csv/documents.csv']);
        $map = array_column(array_map(static fn ($r) => array_combine($docs[0], $r), array_slice($docs, 1)), 'file_in_zip', 'public_id');
        $this->assertSame('documents/' . $data['old']['id'] . '_मेहंदी photo.jpg', $map[$data['old']['id']]);
        $this->assertArrayHasKey($map[$data['receipt']['id']], $zip);
        // Readable summary
        $this->assertStringContainsString('<h2>Guests by side</h2>', $zip['summary.html']);
        $this->assertStringContainsString('₹1,25,000', $zip['summary.html']);
        $this->assertStringContainsString('Shree Tent House', $zip['summary.html']);
        $this->assertStringContainsString('Rows per table', $zip['README.txt']);
        // Audited: one line for making it, one per download
        $this->assertSame(2, $this->rows('audit_log', "action = 'export' AND entity_type = 'export'"));
        $this->assertStringContainsString('with the download link', (string) $db->value("SELECT note FROM audit_log WHERE action = 'export' ORDER BY id DESC LIMIT 1"));
    }

    #[Endpoint('POST /exports')]
    public function test_ds22_export_restores_into_an_empty_database(): void
    {
        $ayush = $this->loginAs('ayush');
        $this->fill($ayush);
        $e = $this->export($ayush)->assertStatus(201)->json('data');
        $zip = $this->unzip($this->fetch($e['download_urls'][0])->body());
        $dir = $this->logDir . '/unzipped';
        foreach ($zip as $name => $bytes) {
            @mkdir(dirname("$dir/$name"), 0700, true);
            file_put_contents("$dir/$name", $bytes);
        }

        $target = TestDb::name() . '_restore';
        TestDb::rebuild($target, false); // migrations only, like a new hosting account
        try {
            $tdb = Db::connect(TestDb::env(['DB_NAME' => $target]));
            $r = new Restore($tdb);
            $counts = $r->data("$dir/json/all.json");
            $files = $r->files($dir, $this->logDir . '/restored-storage');
            $this->assertSame(2, $files['copied']);
            $src = $this->db();
            foreach ($counts as $t => $n) {
                $cols = array_column($src->all("SELECT column_name AS c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND extra NOT IN ('VIRTUAL GENERATED', 'STORED GENERATED') ORDER BY ordinal_position", [$t]), 'c');
                $this->assertContains('id', $cols);
                $cols = array_values(array_diff($cols, Snapshot::SECRET_COLUMNS));
                $list = implode(', ', array_map(static fn ($c) => "`$c`", $cols));
                $before = $src->all("SELECT $list FROM `$t`" . match ($t) {
                    'audit_log' => " WHERE entity_type <> 'export'", // making and downloading it came after the snapshot
                    'exports' => ' WHERE 0',
                    default => '',
                } . ' ORDER BY 1');
                $this->assertSame($before, $tdb->all("SELECT $list FROM `$t` ORDER BY 1"), "every row of $t matches (AC-EXP-05)");
            }
            $this->assertSame('!restored-set-a-new-password-0', $tdb->value('SELECT password_hash FROM users ORDER BY id LIMIT 1'), 'nobody can log in until a new password is set');
            $this->assertFalse(password_verify('test-1234', (string) $tdb->value('SELECT password_hash FROM users ORDER BY id LIMIT 1')));
            // A second run refuses: the database is no longer empty
            $this->expectExceptionMessage('already has people in it');
            (new Restore($tdb))->data("$dir/json/all.json");
        } finally {
            TestDb::server()->exec("DROP DATABASE IF EXISTS `$target`");
        }
    }

    #[Endpoint('POST /exports')]
    public function test_ds23_snapshot_is_consistent_while_someone_writes(): void
    {
        $ayush = $this->loginAs('ayush');
        $ayush->postJson('/households', ['name' => 'Sharma Family', 'side' => 'groom', 'adults' => 3])->assertStatus(201);
        $famId = (int) $this->db()->value('SELECT id FROM households WHERE deleted_at IS NULL ORDER BY id LIMIT 1');
        $this->assertGreaterThan(0, $famId);
        $oldName = (string) $this->db()->value('SELECT name FROM households WHERE id = ?', [$famId]);
        $before = $this->rows('households');
        ExportsController::$whileReading = static function () use ($famId): void {
            // A second connection (another phone) changes a family and adds one while the export reads.
            $other = TestDb::connect();
            $other->exec('START TRANSACTION');
            $other->prepare('UPDATE households SET name = ?, version = version + 1 WHERE id = ?')->execute(['Renamed Mid-Export', $famId]);
            $other->exec("INSERT INTO households (public_id, name, name_norm, side, adults, created_by, updated_by) VALUES ('01JA7Q3M2K8V5R1T9W4X6YDS23', 'Added Mid-Export', 'added mid-export', 'bride', 1, 1, 1)");
            $other->exec('COMMIT');
        };
        $e = $this->export($ayush)->assertStatus(201)->json('data');
        $this->assertSame('Renamed Mid-Export', $this->db()->value('SELECT name FROM households WHERE id = ?', [$famId]), 'the write happened');
        $zip = $this->unzip($this->fetch($e['download_urls'][0])->body());
        $rows = $this->csvRows($zip['csv/households.csv']);
        $names = array_column(array_slice($rows, 1), array_search('name', $rows[0], true));
        $this->assertCount($before, $names, 'the family added mid-export is not in it');
        $this->assertContains($oldName, $names, 'the old name, never half');
        $this->assertNotContains('Renamed Mid-Export', $names);
        $this->assertStringNotContainsString('Added Mid-Export', $zip['json/all.json']);
    }

    #[Endpoint('POST /exports')]
    public function test_ac_exp_04_only_owner_and_partner_and_three_an_hour(): void
    {
        foreach (['papa', 'mummy', 'nani'] as $who) {
            $this->export($this->loginAs($who))->assertStatus(403);
        }
        $mahi = $this->loginAs('mahi');
        for ($i = 0; $i < 3; $i++) {
            $this->export($mahi)->assertStatus(201);
        }
        $this->export($mahi)->assertStatus(429)->assertErrorCode('rate_limited');
        $this->assertSame(3, $this->rows('exports'));
    }

    #[Endpoint('POST /exports')]
    public function test_retry_with_the_same_key_gives_the_same_export_and_a_new_token(): void
    {
        $ayush = $this->loginAs('ayush');
        $key = '5b1f0b52-3a2d-4c1e-9f00-000000011001';
        $a = $this->export($ayush, ['idem' => $key])->assertStatus(201)->json('data');
        $b = $this->export($ayush, ['idem' => $key])->assertStatus(201)->json('data');
        $this->assertSame($a['id'], $b['id']);
        $this->assertSame(1, $this->rows('exports'));
        $this->assertNotSame($a['download_urls'][0], $b['download_urls'][0]);
        $this->fetch($a['download_urls'][0])->assertStatus(401); // the old token was replaced
        $this->fetch($b['download_urls'][0])->assertStatus(200);
        $stored = (string) $this->db()->value('SELECT response_body FROM idempotency_keys WHERE idem_key = ?', [$key]);
        $this->assertStringNotContainsString('&t=', $stored, 'the token is never stored in the replay table');
    }

    #[Endpoint('GET /exports/{id}/download')]
    public function test_sec33_token_only_for_its_export_and_24_hours(): void
    {
        $ayush = $this->loginAs('ayush');
        $a = $this->export($ayush)->assertStatus(201)->json('data');
        $b = $this->export($ayush)->assertStatus(201)->json('data');
        parse_str((string) parse_url($a['download_urls'][0], PHP_URL_QUERY), $qa);
        $anon = new ApiClient($this->app);
        $anon->get("/exports/{$b['id']}/download", ['t' => $qa['t']])->assertStatus(401);           // A's token on B
        $anon->get("/exports/{$a['id']}/download", ['t' => str_repeat('x', 43)])->assertStatus(401); // made up
        $anon->get("/exports/{$a['id']}/download")->assertStatus(401)->assertErrorCode('not_logged_in');
        $this->loginAs('papa')->get("/exports/{$a['id']}/download")->assertStatus(403);              // Family, no token
        $this->loginAs('papa')->get("/exports/{$b['id']}/download", ['t' => $qa['t']])->assertStatus(403);
        $ayush->get("/exports/{$a['id']}/download")->assertStatus(200);                             // admin cookie alone
        $ayush->get("/exports/{$a['id']}/download", ['part' => '2'])->assertStatus(404);
        // AC-EXP-08: after 24 h → 410, even before the nightly clean-up
        $this->clock->advance('+24 hours 1 second');
        $this->fetch($a['download_urls'][0])->assertStatus(410)->assertErrorCode('export_expired');
        $this->assertSame('expired', $ayush->get("/exports/{$a['id']}")->assertStatus(200)->json('data.status'));
    }

    #[Endpoint('GET /exports/{id}/download')]
    public function test_files_over_the_part_size_split_into_parts(): void
    {
        $this->app = $this->makeApp(['EXPORT_PART_BYTES' => '1000']);
        $ayush = $this->loginAs('ayush');
        $f1 = $ayush->upload('/documents', $this->jpeg(3), 'a.jpg', ['type' => 'photo', 'title' => 'First'])->assertStatus(201)->json('data');
        $f2 = $ayush->upload('/documents', $this->jpeg(4), 'b.jpg', ['type' => 'photo', 'title' => 'Second'])->assertStatus(201)->json('data');
        $e = $this->export($ayush)->assertStatus(201)->json('data');
        $this->assertSame(2, $e['parts']);
        $this->assertCount(2, $e['download_urls']);
        $p1 = $this->unzip($this->fetch($e['download_urls'][0])->body());
        $r2 = $this->fetch($e['download_urls'][1])->assertStatus(200);
        $this->assertSame('attachment; filename="wedding-export_2026-10-08_files-part2.zip"', $r2->header('Content-Disposition'));
        $p2 = $this->unzip($r2->body());
        $this->assertArrayHasKey('json/all.json', $p1);
        $this->assertArrayHasKey("documents/{$f1['id']}_First.jpg", $p1);
        $this->assertSame(["documents/{$f2['id']}_Second.jpg"], array_keys($p2), 'part 2 holds only more files');
    }

    #[Endpoint('GET /exports')]
    #[Endpoint('GET /exports/{id}')]
    public function test_recent_exports_and_last_success_without_tokens(): void
    {
        $ayush = $this->loginAs('ayush');
        $this->assertSame([], $ayush->get('/exports')->assertStatus(200)->json('data'));
        $e = $this->export($ayush)->assertStatus(201)->json('data');
        $list = $ayush->get('/exports')->assertStatus(200);
        $this->assertSame($e['id'], $list->json('data.0.id'));
        $this->assertSame("/api/v1/exports/{$e['id']}/download?part=1", $list->json('data.0.download_urls.0'), 'no token outside the 201');
        $this->assertSame(['id' => $e['id'], 'created_at' => '2026-10-08T09:12:31Z'], $list->json('meta.last_success'));
        $this->assertSame('Ayush', $list->json('data.0.requested_by.name'));
        $this->assertSame($e['id'], $ayush->get("/exports/{$e['id']}")->assertStatus(200)->json('data.id'));
        $ayush->get('/exports/01JA7Q3M2K8V5R1T9W4X6Y0ZZZ')->assertStatus(404);
        $this->loginAs('papa')->get('/exports')->assertStatus(403);
        $this->loginAs('papa')->get("/exports/{$e['id']}")->assertStatus(403);
    }

    #[Endpoint('POST /exports')]
    public function test_a_failed_export_says_try_again_and_leaves_nothing_half_made(): void
    {
        $ayush = $this->loginAs('ayush');
        mkdir($this->logDir . '/storage', 0700, true);
        file_put_contents($this->logDir . '/storage/exports', 'not a folder'); // the folder can't be made
        $this->export($ayush)->assertStatus(500)->assertErrorCode('export_failed');
        $this->assertSame('failed', $this->db()->value('SELECT status FROM exports'));
        $this->assertSame('Export failed — try again.', $ayush->get('/exports')->json('data.0.error'));
        $this->assertNull($ayush->get('/exports')->json('meta.last_success'));
        $this->assertStringContainsString('export', $this->logFile('php-error.log'));
    }

    public function test_limits_2000_families_and_500_files_fast_and_flat_memory(): void
    {
        $db = $this->db();
        $values = [];
        for ($i = 1; $i <= 2000; $i++) {
            $values[] = sprintf("('01JB%022d', 'परिवार %d', 'परिवार %d', '+9198%08d', 'groom', 2, 1, 1)", $i, $i, $i, $i);
        }
        $db->pdo->exec('INSERT INTO households (public_id, name, name_norm, phone, side, adults, created_by, updated_by) VALUES ' . implode(',', $values));
        $store = $this->logDir . '/storage/uploads/2026/10';
        mkdir($store, 0700, true);
        $bytes = str_repeat('x', 20000);
        $rows = [];
        for ($i = 1; $i <= 500; $i++) {
            $uuid = sprintf('00000000-0000-4000-8000-%012d', $i);
            file_put_contents("$store/$uuid.jpg", $bytes . $i);
            $rows[] = sprintf("('01JC%022d', 'uploads/2026/10/%s.jpg', 'p%d.jpg', 'image/jpeg', %d, '%s', 1)", $i, $uuid, $i, strlen($bytes . $i), hash('sha256', $bytes . $i));
        }
        $db->pdo->exec('INSERT INTO files (public_id, storage_path, original_name, mime_type, size_bytes, sha256, created_by) VALUES ' . implode(',', $rows));
        $ayush = $this->loginAs('ayush');
        $memBefore = memory_get_usage();
        $t = microtime(true);
        $e = $this->export($ayush)->assertStatus(201)->json('data');
        $snapshot = microtime(true) - $t;
        $peakAfterSnapshot = memory_get_peak_usage() - $memBefore;
        $t = microtime(true);
        $raw = $this->fetch($e['download_urls'][0])->assertStatus(200)->body();
        $download = microtime(true) - $t;
        $zip = $this->unzip($raw);
        $this->assertCount(500, array_filter(array_keys($zip), static fn ($n) => str_starts_with($n, 'documents/')));
        $this->assertLessThan(60, $snapshot + $download, 'well inside the 360 s PHP limit');
        $this->assertLessThan(64 * 1024 * 1024, $peakAfterSnapshot, 'snapshot memory stays flat (rows streamed)');
        fwrite(STDERR, sprintf("\n[limits] export of 2,000 families + 500 files: snapshot %.1f s, download %.1f s, ZIP %.1f MB\n", $snapshot, $download, strlen($raw) / 1048576));
    }
}
