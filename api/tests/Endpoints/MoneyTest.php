<?php
declare(strict_types=1);

namespace Tests\Endpoints;

use Tests\Support\ApiClient;
use Tests\Support\ApiTestCase;
use Tests\Support\Endpoint;
use Tests\Support\TestDb;
use Tests\Support\TestResponse;

/**
 * Money — FEATURES B6 (AC-MON-01…08, 10), API.md §6.8, TESTING §1.3 money rows,
 * DS-01/05/11/27, SEC-01/12/13, S10, DATABASE R3.
 * People: Ayush owner, Mahi partner, Papa family + money, Mummy family no money, Nani viewer.
 * Frozen clock: Thu 8 Oct 2026, 2:42 PM IST.
 */
final class MoneyTest extends ApiTestCase
{
    private const TENT = '01M4DK5T3N4MV1HPCRZJ0K44XB';
    private const CLOTHING = '01M4DK5T3QATV30ZX2E0B6P7GZ';
    private const MISC = '01M4DK5T4047VSDK59NPGBMAH7';
    private const MEHNDI = '01M4DK5T3E6QZBMNQ0V7KQWW23';

    private function pay(ApiClient $c, array $body, array $opts = []): TestResponse
    {
        return $c->postJson('/payments', $body + ['title' => 'Tent advance', 'amount_paise' => 5000000], [], $opts);
    }

    private function vendor(ApiClient $c, array $body = []): string
    {
        return $c->postJson('/vendors', $body + ['name' => 'Gupta Tent House', 'category' => 'tent_decor', 'phone' => '9414012345'])->assertStatus(201)->json('data.id');
    }

    private function del(ApiClient $c, string $path, int $v, mixed $body = null): TestResponse
    {
        return $c->request('DELETE', $path, $body === null ? null : json_encode($body), [], [], ['ifMatch' => $v]);
    }

    #[Endpoint('GET /money/summary')]
    public function test_ac_mon_01_05_totals_and_category_over(): void
    {
        $ayush = $this->loginAs('ayush');
        $this->db()->run('UPDATE settings SET total_budget_paise = 400000000');
        $ayush->patchJson('/budget-categories/' . self::CLOTHING, ['planned_paise' => 20000000], 1)->assertStatus(200);
        $this->pay($ayush, ['title' => 'Lehenga advance', 'amount_paise' => 15000000, 'category_id' => self::CLOTHING, 'status' => 'paid', 'paid_on' => '2026-10-01', 'method' => 'upi'])->assertStatus(201);
        $this->pay($ayush, ['title' => 'Lehenga balance', 'amount_paise' => 8000000, 'category_id' => self::CLOTHING, 'due_date' => '2026-11-01'])->assertStatus(201);
        $this->pay($ayush, ['title' => 'Tent advance', 'amount_paise' => 50000000, 'category_id' => self::TENT, 'status' => 'paid', 'paid_on' => '2026-10-02', 'method' => 'cash'])->assertStatus(201);
        $this->pay($ayush, ['title' => 'Tent balance', 'amount_paise' => 22000000, 'category_id' => self::TENT, 'due_date' => '2026-12-01'])->assertStatus(201);
        $s = $ayush->get('/money/summary')->assertStatus(200)->assertEnvelope()->json('data');
        // AC-MON-01 shape: planned 40 lakh, spent 6.5 lakh, due 3 lakh → left 33.5 lakh, free 30.5 lakh
        $this->assertSame([400000000, 65000000, 30000000, 335000000, 305000000, 380000000],
            [$s['planned_paise'], $s['spent_paise'], $s['still_to_pay_paise'], $s['left_paise'], $s['free_paise'], $s['not_yet_split_paise']]);
        $clothing = array_values(array_filter($s['categories'], static fn ($c) => $c['id'] === self::CLOTHING))[0];
        $this->assertSame(['planned_paise' => 20000000, 'spent_paise' => 15000000, 'due_paise' => 8000000, 'left_paise' => 5000000, 'is_over' => true],
            array_intersect_key($clothing, array_flip(['planned_paise', 'spent_paise', 'due_paise', 'left_paise', 'is_over']))); // AC-MON-05: over by ₹30,000
        $this->assertCount(14, $s['categories']);
        $this->loginAs('mummy')->get('/money/summary')->assertStatus(403)->assertErrorCode('no_money_access'); // SEC-01
    }

    /** DATABASE §7.5 demo results: Planned ₹40,00,000 · Spent ₹7,95,350 · Still to pay ₹16,80,000; Clothing over. */
    #[Endpoint('GET /money/summary')]
    public function test_documented_demo_results(): void
    {
        TestDb::rebuild('am_test_demo', false);
        $r = TestDb::runFile(TestDb::connect('am_test_demo'), TestDb::root() . '/db/dev/seed_demo.sql');
        $this->assertNull($r['error'], (string) $r['error']);
        try {
            $c = new ApiClient($this->makeApp(['DB_NAME' => 'am_test_demo']));
            $c->login('+919829000001', 'demo-1234')->assertStatus(200);
            $s = $c->get('/money/summary')->assertStatus(200)->json('data');
            $this->assertSame([400000000, 79535000, 168000000], [$s['planned_paise'], $s['spent_paise'], $s['still_to_pay_paise']]);
            $over = array_column(array_filter($s['categories'], static fn ($x) => $x['is_over']), 'name');
            $this->assertContains('Clothing', $over);
            $clothing = array_values(array_filter($s['categories'], static fn ($x) => $x['name'] === 'Clothing'))[0];
            $this->assertSame(10250000, $clothing['spent_paise'] + $clothing['due_paise'], '₹1,02,500 against ₹1,00,000');
        } finally {
            TestDb::server()->exec('DROP DATABASE IF EXISTS am_test_demo');
        }
    }

    #[Endpoint('GET /budget-categories')]
    public function test_categories_list_money_only(): void
    {
        $list = $this->loginAs('papa')->get('/budget-categories')->assertStatus(200)->json('data');
        $this->assertSame('Venue', $list[0]['name']);
        $this->assertTrue(end($list)['is_fallback']);
        $this->loginAs('mummy')->get('/budget-categories')->assertStatus(403)->assertErrorCode('no_money_access');
    }

    #[Endpoint('POST /budget-categories')]
    public function test_add_category_unique_name(): void
    {
        $papa = $this->loginAs('papa');
        $c = $papa->postJson('/budget-categories', ['name' => 'Mehndi favours', 'planned_paise' => 2500000])->assertStatus(201);
        $this->assertSame(150, $c->json('data.sort_order'));
        $papa->postJson('/budget-categories', ['name' => 'Venue'])->assertStatus(409)->assertErrorCode('duplicate_found');
        $this->loginAs('mummy')->postJson('/budget-categories', ['name' => 'X'])->assertStatus(403);
    }

    #[Endpoint('PATCH /budget-categories/{id}')]
    public function test_plan_a_category_history_hides_money_from_non_money(): void
    {
        $papa = $this->loginAs('papa');
        $papa->patchJson('/budget-categories/' . self::TENT, ['planned_paise' => 35000000], 1)->assertStatus(200);
        $papa->patchJson('/budget-categories/' . self::TENT, ['planned_paise' => 1], 1)->assertStatus(409)->assertErrorCode('version_conflict'); // DS-01
        $this->assertSame('Papa changed Planned from ₹0 to ₹3,50,000 for Tent & Decor.', $papa->get('/budget-categories/' . self::TENT . '/history')->json('data.0.sentence'));
        $this->loginAs('mummy')->get('/budget-categories/' . self::TENT . '/history')->assertStatus(403);
    }

    #[Endpoint('DELETE /budget-categories/{id}')]
    public function test_ac_mon_07_delete_with_payments_needs_move_ds11_undo_puts_both_back(): void
    {
        $ayush = $this->loginAs('ayush');
        $ids = [];
        foreach ([1, 2, 3, 4] as $i) {
            $ids[] = $this->pay($ayush, ['title' => "Clothes $i", 'amount_paise' => 100000 * $i, 'category_id' => self::CLOTHING])->json('data.id');
        }
        $cat = $this->row('SELECT * FROM budget_categories WHERE public_id = ?', [self::CLOTHING]);
        $pays = $this->db()->all('SELECT * FROM payments ORDER BY id');
        $r = $this->del($ayush, '/budget-categories/' . self::CLOTHING, 1)->assertStatus(422);
        $this->assertSame('category_has_payments', $r->json('error.rule'));
        $this->assertSame('Move 4 payments to another category first.', $r->json('error.message'));
        $this->del($ayush, '/budget-categories/' . self::MISC, 1)->assertStatus(422); // the fallback can't go
        $this->del($this->loginAs('papa'), '/budget-categories/' . self::CLOTHING, 1, ['move_payments_to' => self::MISC])->assertStatus(403); // admins only
        $ok = $this->del($ayush, '/budget-categories/' . self::CLOTHING, 1, ['move_payments_to' => self::MISC])->assertStatus(200);
        $this->assertSame(4, $ok->json('data.moved'));
        $this->assertSame('Deleted Clothing · 4 payments moved to Miscellaneous', $ok->json('meta.undo.summary'));
        $this->assertSame(4, $this->rows('payments', 'category_id = (SELECT id FROM budget_categories WHERE public_id = ?)', [self::MISC]));
        $ayush->postJson('/undo/' . $ok->json('meta.undo.batch_id'), new \stdClass())->assertStatus(200);
        $skip = ['version', 'updated_at', 'updated_by'];
        $strip = static fn (array $r) => array_diff_key($r, array_flip($skip));
        $this->assertSame($strip($cat), $strip($this->row('SELECT * FROM budget_categories WHERE public_id = ?', [self::CLOTHING])));
        $this->assertSame(array_map($strip, $pays), array_map($strip, $this->db()->all('SELECT * FROM payments ORDER BY id')));
    }

    #[Endpoint('POST /budget-categories/{id}/restore')]
    public function test_restore_category_blocked_when_name_taken(): void
    {
        $ayush = $this->loginAs('ayush');
        $this->del($ayush, '/budget-categories/' . self::TENT, 1)->assertStatus(200);
        $ayush->postJson('/budget-categories', ['name' => 'Tent & Decor'])->assertStatus(201);
        $r = $ayush->postJson('/budget-categories/' . self::TENT . '/restore', new \stdClass(), [], ['ifMatch' => 2])->assertStatus(422);
        $this->assertSame('A category called Tent & Decor already exists.', $r->json('error.message'));
    }

    #[Endpoint('GET /vendors')]
    public function test_ac_mon_06_vendor_contacts_for_all_amounts_only_for_money(): void
    {
        $papa = $this->loginAs('papa');
        $v = $this->vendor($papa, ['agreed_amount_paise' => 35000000, 'contact_person' => 'Rajesh ji', 'is_booked' => true]);
        $list = $this->loginAs('mummy')->get('/vendors', ['q' => 'Gupta'])->assertStatus(200)->json('data');
        $this->assertSame(['Gupta Tent House', '+919414012345', 'Rajesh ji'], [$list[0]['name'], $list[0]['phone'], $list[0]['contact_person']]);
        $this->assertArrayNotHasKey('agreed_amount_paise', $list[0]);
        $this->assertArrayNotHasKey('balance', $list[0]);
        $this->assertStringNotContainsString('_paise', $this->loginAs('nani')->get("/vendors/$v")->body(), 'S10');
        $booked = array_column($papa->get('/vendors', ['booked' => 'true'])->json('data'), 'agreed_amount_paise', 'name');
        $this->assertSame(35000000, $booked['Gupta Tent House']);
        $this->assertNotContains('Gupta Tent House', array_column($papa->get('/vendors', ['category' => 'caterer'])->json('data'), 'name'));
        $this->assertSame(2, $papa->get('/vendors', ['q' => 'rajesh'])->json('meta.total'), 'contact person and name both searched');
    }

    #[Endpoint('POST /vendors')]
    public function test_add_vendor_duplicate_phone_and_sec12_amount_smuggling(): void
    {
        $mummy = $this->loginAs('mummy');
        $this->vendor($mummy);
        $before = $this->rows('vendors');
        $mummy->postJson('/vendors', ['name' => 'Sneaky', 'category' => 'other', 'agreed_amount_paise' => 100])->assertStatus(403)->assertErrorCode('no_money_access');
        $this->assertSame($before, $this->rows('vendors'), 'SEC-12: nothing written');
        $d = $this->loginAs('papa')->postJson('/vendors', ['name' => 'Tent wala', 'category' => 'tent_decor', 'phone' => '+91 94140 12345'])->assertStatus(409);
        $this->assertSame('Already in vendors: Gupta Tent House (+91 94••• ••345)', $d->json('error.message'));
        $this->loginAs('nani')->postJson('/vendors', ['name' => 'X', 'category' => 'other'])->assertStatus(403);
    }

    #[Endpoint('GET /vendors/{id}')]
    public function test_ac_mon_10_vendor_balance_not_yet_scheduled(): void
    {
        $papa = $this->loginAs('papa');
        $v = $this->vendor($papa, ['agreed_amount_paise' => 35000000]);
        $this->pay($papa, ['vendor_id' => $v, 'amount_paise' => 10000000, 'status' => 'paid', 'paid_on' => '2026-10-01', 'method' => 'upi'])->assertStatus(201);
        $this->pay($papa, ['vendor_id' => $v, 'title' => 'Tent balance', 'amount_paise' => 15000000, 'due_date' => '2026-12-01'])->assertStatus(201);
        $this->assertSame(['agreed_paise' => 35000000, 'paid_paise' => 10000000, 'due_paise' => 15000000, 'not_scheduled_paise' => 10000000], $papa->get("/vendors/$v")->json('data.balance'));
        $this->loginAs('mummy')->get('/vendors/1')->assertStatus(404);
    }

    #[Endpoint('PATCH /vendors/{id}')]
    public function test_edit_vendor_amount_needs_money(): void
    {
        $v = $this->vendor($this->loginAs('papa'));
        $mummy = $this->loginAs('mummy');
        $mummy->patchJson("/vendors/$v", ['contact_person' => 'Rajesh ji'], 1)->assertStatus(200);
        $mummy->patchJson("/vendors/$v", ['agreed_amount_paise' => 1], 2)->assertStatus(403);
        $this->assertNull($this->row('SELECT agreed_amount_paise FROM vendors')['agreed_amount_paise']);
        $this->loginAs('papa')->patchJson("/vendors/$v", ['agreed_amount_paise' => 35000000], 2)->assertStatus(200);
        $lines = array_column($mummy->get("/vendors/$v/history")->json('data'), 'sentence');
        $this->assertStringNotContainsString('3,50,000', implode(' ', $lines), 'no amounts in history for a non-money viewer');
        $this->assertSame('Papa changed Agreed amount from (empty) to ₹3,50,000 for Gupta Tent House.', $this->loginAs('papa')->get("/vendors/$v/history")->json('data.0.sentence'));
    }

    #[Endpoint('DELETE /vendors/{id}')]
    public function test_delete_vendor_payments_keep_the_name_marked_deleted(): void
    {
        $ayush = $this->loginAs('ayush');
        $v = $this->vendor($ayush);
        $p = $this->pay($ayush, ['vendor_id' => $v])->json('data.id');
        $this->del($this->loginAs('papa'), "/vendors/$v", 1)->assertStatus(403);
        $this->del($ayush, "/vendors/$v", 1)->assertStatus(200);
        $this->assertSame(['id' => $v, 'name' => 'Gupta Tent House', 'deleted' => true], $ayush->get("/payments/$p")->json('data.vendor'));
        $this->assertSame(5000000, $ayush->get('/money/summary')->json('data.still_to_pay_paise'), 'totals unchanged');
    }

    #[Endpoint('POST /vendors/{id}/restore')]
    public function test_restore_vendor(): void
    {
        $ayush = $this->loginAs('ayush');
        $v = $this->vendor($ayush);
        $this->del($ayush, "/vendors/$v", 1)->assertStatus(200);
        $ayush->postJson("/vendors/$v/restore", new \stdClass(), [], ['ifMatch' => 2])->assertStatus(200);
        $this->assertNull($this->row('SELECT deleted_at FROM vendors WHERE public_id = ?', [$v])['deleted_at']);
    }

    #[Endpoint('GET /payments')]
    public function test_list_filters_totals_and_sec13_money_off_applies_at_once(): void
    {
        $papa = $this->loginAs('papa');
        $v = $this->vendor($papa);
        $this->pay($papa, ['vendor_id' => $v, 'title' => 'Tent advance', 'status' => 'paid', 'paid_on' => '2026-10-02', 'method' => 'cash'])->assertStatus(201);
        $this->pay($papa, ['vendor_id' => $v, 'title' => 'Tent second', 'amount_paise' => 7500000, 'due_date' => '2026-10-06'])->assertStatus(201);
        $this->pay($papa, ['title' => 'Mithai', 'amount_paise' => 125000, 'status' => 'paid', 'paid_on' => '2026-10-08', 'method' => 'upi', 'event_id' => self::MEHNDI])->assertStatus(201);
        $this->pay($papa, ['title' => 'Pandit dakshina', 'amount_paise' => 1100000])->assertStatus(201);
        $res = $papa->get('/payments')->assertStatus(200);
        $this->assertSame(['Tent second', 'Pandit dakshina', 'Mithai', 'Tent advance'], array_column($res->json('data'), 'title'));
        $this->assertSame(['amount_paise' => 13725000, 'due_paise' => 8600000, 'paid_paise' => 5125000], $res->json('meta.totals'));
        $this->assertTrue($res->json('data.0.overdue')); // AC-MON-03: due 6 Oct, today 8 Oct
        $this->assertTrue($res->json('data.1.no_date'));
        $this->assertSame('expense', $res->json('data.2.kind'));
        $this->assertSame('Miscellaneous', $res->json('data.3.category.name'), 'no vendor history → Miscellaneous');
        $titles = fn (array $q) => array_column($papa->get('/payments', $q)->json('data'), 'title');
        $this->assertSame(['Tent second'], $titles(['status' => 'overdue']));
        $this->assertSame(['Pandit dakshina'], $titles(['status' => 'no_date']));
        $this->assertSame(['Pandit dakshina', 'Mithai'], $titles(['kind' => 'expense', 'sort' => '-amount_paise']));
        $this->assertSame(['Mithai'], $titles(['event' => self::MEHNDI]));
        $this->assertSame(['Tent second', 'Tent advance'], $titles(['vendor' => $v]));
        $this->assertSame(['Tent second', 'Mithai', 'Tent advance'], $titles(['month' => '2026-10']));
        $this->assertSame(['Mithai'], $titles(['q' => 'mith']));
        $papa->get('/payments', ['month' => '2026-13'])->assertStatus(400);
        $this->loginAs('mummy')->get('/payments')->assertStatus(403)->assertErrorCode('no_money_access'); // SEC-01
        $this->db()->run('UPDATE users SET can_see_money = 0 WHERE id = 3'); // SEC-13: Ayush turns Papa's money off
        $papa->get('/payments')->assertStatus(403)->assertErrorCode('no_money_access');
    }

    #[Endpoint('POST /payments')]
    public function test_create_rules_new_vendor_duplicate_ds04_ds27(): void
    {
        $papa = $this->loginAs('papa');
        $bad = $this->pay($papa, ['amount_paise' => 0, 'status' => 'paid', 'paid_on' => '2026-10-09', 'method' => 'upi'])->assertStatus(422);
        $this->assertSame(['amount_paise', 'paid_on'], array_keys($bad->json('error.fields')));
        $this->pay($papa, ['amount_paise' => 1000000001])->assertStatus(422);
        $this->pay($papa, ['amount_paise' => '500'])->assertStatus(422, 'never a string');
        // "Paid already" defaults to today + UPI
        $p = $this->pay($papa, ['title' => 'Cash to tailor', 'amount_paise' => 1, 'status' => 'paid'])->assertStatus(201);
        $this->assertSame(['paid', '2026-10-08', 'upi', 1], [$p->json('data.status'), $p->json('data.paid_on'), $p->json('data.method'), $p->json('data.amount_paise')]); // DS-27: ₹0.01
        $max = $this->pay($papa, ['title' => 'Big', 'amount_paise' => 1000000000])->assertStatus(201);
        $this->assertSame(1000000000, $max->json('data.amount_paise'));
        // New vendor typed in "Paid to" → created in the same transaction
        $n = $this->pay($papa, ['title' => 'Band advance', 'amount_paise' => 2100000, 'new_vendor' => ['name' => 'Jai Ho Band', 'category' => 'band_dj', 'phone' => '9414099999'], 'category_id' => self::TENT])->assertStatus(201);
        $this->assertSame('Jai Ho Band', $n->json('data.vendor.name'));
        $this->assertSame('payment', $n->json('data.kind'));
        // AC-MON-08: same vendor + amount within 2 days
        $vid = $n->json('data.vendor.id');
        $dup = $this->pay($papa, ['title' => 'Band advance again', 'amount_paise' => 2100000, 'vendor_id' => $vid, 'due_date' => '2026-10-10'])->assertStatus(409);
        $this->assertSame("Looks like a duplicate of 'Band advance' ₹21,000 on 8 Oct.", $dup->json('error.message'));
        $second = $this->pay($papa, ['title' => 'Band balance', 'amount_paise' => 2100000, 'vendor_id' => $vid, 'due_date' => '2026-10-10', 'allow_duplicate' => true])->assertStatus(201);
        $this->assertSame('Tent & Decor', $second->json('data.category.name'), "vendor's last used category");
        // DS-04
        $key = '5b1f0b52-3a2d-4c1e-9f00-000000000901';
        $a = $this->pay($papa, ['title' => 'Mithai', 'amount_paise' => 50000], ['idem' => $key])->assertStatus(201);
        $b = $this->pay($papa, ['title' => 'Mithai', 'amount_paise' => 50000], ['idem' => $key])->assertStatus(201);
        $this->assertSame($a->json('data'), $b->json('data'));
        $this->assertSame(1, $this->rows('payments', "title = 'Mithai'"));
        $this->pay($this->loginAs('mummy'), [])->assertStatus(403);
    }

    #[Endpoint('POST /payments')]
    public function test_r3_payment_into_a_deleted_category_is_refused(): void
    {
        $ayush = $this->loginAs('ayush');
        $this->del($ayush, '/budget-categories/' . self::TENT, 1)->assertStatus(200);
        $r = $this->pay($this->loginAs('mahi'), ['category_id' => self::TENT])->assertStatus(422);
        $this->assertSame('This category was deleted. Pick another.', $r->json('error.fields.category_id'));
    }

    #[Endpoint('GET /payments/{id}')]
    public function test_one_payment(): void
    {
        $papa = $this->loginAs('papa');
        $id = $this->pay($papa, ['event_id' => self::MEHNDI])->json('data.id');
        $d = $papa->get("/payments/$id")->assertStatus(200)->json('data');
        $this->assertSame(['Mehndi', 0, 'expense'], [$d['event']['name'], $d['receipt_count'], $d['kind']]);
        $this->loginAs('mummy')->get("/payments/$id")->assertStatus(403);
    }

    #[Endpoint('PATCH /payments/{id}')]
    public function test_edit_payment_state_rules_and_ds01(): void
    {
        $papa = $this->loginAs('papa');
        $id = $this->pay($papa, ['due_date' => '2026-11-01'])->json('data.id');
        $papa->patchJson("/payments/$id", ['status' => 'paid', 'method' => null], 1)->assertStatus(422);
        $papa->patchJson("/payments/$id", ['status' => 'paid', 'paid_on' => '2026-10-07', 'method' => 'cheque'], 1)->assertStatus(200);
        $papa->patchJson("/payments/$id", ['amount_paise' => 6000000], 1)->assertStatus(409)->assertErrorCode('version_conflict');
        $back = $papa->patchJson("/payments/$id", ['status' => 'due'], 2)->assertStatus(200);
        $this->assertSame([null, null], [$back->json('data.paid_on'), $back->json('data.method')]);
        $lines = array_column($papa->get("/payments/$id/history")->json('data'), 'sentence');
        $this->assertSame('Papa changed Status, Paid on and Paid by (method) for Tent advance.', $lines[0]);
    }

    #[Endpoint('DELETE /payments/{id}')]
    public function test_ds11_delete_payment_with_receipts_and_undo(): void
    {
        $papa = $this->loginAs('papa');
        $id = $this->pay($papa, [])->json('data.id');
        $pid = (int) $this->row('SELECT id FROM payments')['id'];
        $this->db()->run("INSERT INTO files (id, public_id, storage_path, original_name, mime_type, size_bytes, sha256, created_by) VALUES (1, '01JA7Q3M2K8V5R1T9W4X6Y0F01', 'uploads/2026/10/a.jpg', 'receipt.jpg', 'image/jpeg', 10, REPEAT('a', 64), 3)");
        $this->db()->run("INSERT INTO documents (public_id, title, type, file_id, payment_id, created_by, updated_by) VALUES ('01JA7Q3M2K8V5R1T9W4X6Y0D01', 'Receipt', 'receipt', 1, ?, 3, 3)", [$pid]);
        $before = [$this->row('SELECT * FROM payments'), $this->row('SELECT * FROM documents')];
        $r = $this->del($papa, "/payments/$id", 1)->assertStatus(200);
        $this->assertSame(1, $this->rows('documents', 'deleted_at IS NOT NULL'), 'its receipt goes in the same batch');
        $papa->postJson('/undo/' . $r->json('meta.undo.batch_id'), new \stdClass())->assertStatus(200);
        $strip = static fn (array $x) => array_diff_key($x, array_flip(['version', 'updated_at', 'updated_by']));
        $this->assertSame(array_map($strip, $before), array_map($strip, [$this->row('SELECT * FROM payments'), $this->row('SELECT * FROM documents')]));
        $this->del($this->loginAs('mummy'), "/payments/$id", 3)->assertStatus(403);
    }

    #[Endpoint('POST /payments/{id}/restore')]
    public function test_restore_payment_admin_only(): void
    {
        $papa = $this->loginAs('papa');
        $id = $this->pay($papa, [])->json('data.id');
        $this->del($papa, "/payments/$id", 1)->assertStatus(200);
        $papa->postJson("/payments/$id/restore", new \stdClass(), [], ['ifMatch' => 2])->assertStatus(403);
        $this->loginAs('ayush')->postJson("/payments/$id/restore", new \stdClass(), [], ['ifMatch' => 2])->assertStatus(200);
    }

    #[Endpoint('POST /payments/{id}/mark-paid')]
    public function test_mark_paid_undo_ds05_replay_and_twice_422(): void
    {
        $papa = $this->loginAs('papa');
        $id = $this->pay($papa, ['due_date' => '2026-10-06'])->json('data.id');
        $key = '5b1f0b52-3a2d-4c1e-9f00-000000000902';
        $body = ['paid_on' => '2026-10-08', 'method' => 'cash', 'paid_by' => 'Papa'];
        $a = $papa->postJson("/payments/$id/mark-paid", $body, [], ['idem' => $key, 'ifMatch' => 1])->assertStatus(200);
        $this->assertSame(['paid', false, 2], [$a->json('data.status'), $a->json('data.overdue'), $a->json('data.version')]);
        $this->assertSame('Marked paid: Tent advance · ₹50,000', $a->json('meta.undo.summary'));
        $b = $papa->postJson("/payments/$id/mark-paid", $body, [], ['idem' => $key, 'ifMatch' => 1])->assertStatus(200); // DS-05: a replay, not a 409
        $this->assertSame('true', $b->header('Idempotent-Replayed'));
        $this->assertSame(2, (int) $this->row('SELECT version FROM payments')['version']);
        $papa->postJson("/payments/$id/mark-paid", $body, [], ['ifMatch' => 2])->assertStatus(422); // twice → 422
        $papa->postJson("/payments/$id/mark-paid", ['paid_on' => '2026-10-09', 'method' => 'cash'], [], ['ifMatch' => 2])->assertStatus(422);
        $papa->postJson('/undo/' . $a->json('meta.undo.batch_id'), new \stdClass())->assertStatus(200);
        $this->assertSame(['due', null], array_values($this->row('SELECT status, paid_on FROM payments')));
    }

    #[Endpoint('POST /payments/{id}/pay-part')]
    public function test_ac_mon_04_pay_part_one_batch_undo_restores_exactly(): void
    {
        $papa = $this->loginAs('papa');
        $v = $this->vendor($papa);
        $id = $this->pay($papa, ['vendor_id' => $v, 'title' => 'Tent balance', 'amount_paise' => 10000000, 'due_date' => '2026-12-01'])->json('data.id');
        $before = $this->row('SELECT * FROM payments');
        $papa->postJson("/payments/$id/pay-part", ['amount_paise' => 10000000, 'paid_on' => '2026-10-08', 'method' => 'upi'], [], ['ifMatch' => 1])->assertStatus(422);
        $r = $papa->postJson("/payments/$id/pay-part", ['amount_paise' => 4000000, 'paid_on' => '2026-10-08', 'method' => 'upi', 'reference' => 'UPI 4821'], [], ['ifMatch' => 1])->assertStatus(200);
        $this->assertSame([4000000, 'paid', $id], [$r->json('data.paid.amount_paise'), $r->json('data.paid.status'), $r->json('data.paid.split_from.id')]);
        $this->assertSame([6000000, 'due'], [$r->json('data.due.amount_paise'), $r->json('data.due.status')]);
        $s = $papa->get('/money/summary')->json('data');
        $this->assertSame([4000000, 6000000], [$s['spent_paise'], $s['still_to_pay_paise']]);
        $papa->postJson('/undo/' . $r->json('meta.undo.batch_id'), new \stdClass())->assertStatus(200);
        $strip = static fn (array $x) => array_diff_key($x, array_flip(['version', 'updated_at', 'updated_by']));
        $this->assertSame($strip($before), $strip($this->row('SELECT * FROM payments WHERE public_id = ?', [$id])));
        $this->assertSame(1, $this->rows('payments', 'deleted_at IS NULL'));
        $this->assertSame(10000000, $papa->get('/money/summary')->json('data.still_to_pay_paise'));
    }
}
