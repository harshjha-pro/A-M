<?php
declare(strict_types=1);

namespace Tests\Endpoints;

use Tests\Support\ApiTestCase;
use Tests\Support\Endpoint;

/**
 * Vendors and payments in bulk (1.0.24, admin-operations brief §9, §10): POST /vendors/bulk,
 * GET /vendors/export, POST /payments/bulk, GET /payments/export, duplicate vendor names.
 * Frozen clock: Thu 8 Oct 2026, 2:42 PM IST.
 */
final class MoneyBulkTest extends ApiTestCase
{
    private const LOADED = '2026-10-08T09:00:00Z';
    private const NOW = '2026-10-08T09:12:31Z';
    private const TENT = '01JA6ZB0000000000000000001';
    private const HALWAI = '01JA6ZB0000000000000000002';
    private const CLOTHING = '01M4DK5T3QATV30ZX2E0B6P7GZ';
    private const MEHNDI = '01M4DK5T3E6QZBMNQ0V7KQWW23';

    protected function setUp(): void
    {
        parent::setUp();
        $this->db()->run("UPDATE vendors SET updated_at = '2026-10-01 05:00:00'");
    }

    /** @return list<string> */
    private function payments(int $n): array
    {
        $ids = [];
        for ($i = 0; $i < $n; $i++) {
            $pid = sprintf('01JP%022d', $i + 1);
            $this->db()->run("INSERT INTO payments (public_id, title, amount_paise, status, due_date, category_id, created_by, updated_by, created_at, updated_at)
                              VALUES (?, ?, ?, 'due', '2026-11-01', (SELECT id FROM budget_categories WHERE is_fallback = 1 LIMIT 1), 1, 1, '2026-10-01 05:00:00', '2026-10-01 05:00:00')",
                [$pid, $i === 0 ? '=cmd()' : "Payment $i", 100000 * ($i + 1)]);
            $ids[] = $pid;
        }
        return $ids;
    }

    #[Endpoint('POST /vendors/bulk')]
    public function test_vendor_type_and_booked_for_editors_delete_only_admins_with_undo(): void
    {
        $ids = [self::TENT, self::HALWAI];
        $r = $this->loginAs('mummy')->postJson('/vendors/bulk', ['action' => 'set_category', 'category' => 'florist', 'ids' => $ids, 'as_of' => self::LOADED])->assertStatus(200)->json();
        $this->assertSame(2, $r['data']['affected']);
        $this->assertSame('Set type Florist for 2 vendors', $r['meta']['undo']['summary']);
        $this->assertSame(['florist', 'florist'], array_column($this->db()->all('SELECT category FROM vendors ORDER BY id'), 'category'));
        $this->loginAs('mummy')->postJson('/undo/' . $r['data']['batch_id'], [])->assertStatus(200);
        $this->assertSame('tent_decor', $this->row('SELECT category FROM vendors WHERE public_id = ?', [self::TENT])['category']);

        $this->loginAs('mummy')->postJson('/vendors/bulk', ['action' => 'delete', 'ids' => $ids, 'as_of' => self::NOW])->assertStatus(403);
        $this->loginAs('nani')->postJson('/vendors/bulk', ['action' => 'set_booked', 'is_booked' => true, 'ids' => $ids, 'as_of' => self::NOW])->assertStatus(403);
        $this->loginAs('ayush')->postJson('/vendors/bulk', ['action' => 'set_booked', 'ids' => $ids, 'as_of' => self::NOW])->assertStatus(422);

        $ayush = $this->loginAs('ayush');
        $d = $ayush->postJson('/vendors/bulk', ['action' => 'delete', 'ids' => $ids, 'as_of' => self::NOW])->assertStatus(200)->json('data');
        $this->assertSame(2, $d['affected']);
        $this->assertSame(0, $this->rows('vendors', 'deleted_at IS NULL'));
        $ayush->postJson('/undo/' . $d['batch_id'], [])->assertStatus(200);
        $this->assertSame(2, $this->rows('vendors', 'deleted_at IS NULL'), 'one Undo brings both back');
    }

    #[Endpoint('POST /vendors/bulk')]
    public function test_a_vendor_changed_after_loading_is_skipped_and_named(): void
    {
        $this->db()->run("UPDATE vendors SET updated_at = '2026-10-08 09:05:00', updated_by = 2 WHERE public_id = ?", [self::HALWAI]);
        $r = $this->loginAs('ayush')->postJson('/vendors/bulk', ['action' => 'set_booked', 'is_booked' => true, 'ids' => [self::TENT, self::HALWAI], 'as_of' => self::LOADED])->assertStatus(200)->json('data');
        $this->assertSame(1, $r['affected']);
        $this->assertSame(['Rajesh ji Halwai', 'changed_since_loaded', 'Mahi'], [$r['skipped'][0]['name'], $r['skipped'][0]['reason'], $r['skipped'][0]['changed_by']['name']]);
    }

    #[Endpoint('POST /vendors')]
    public function test_the_same_vendor_name_warns_before_adding_and_add_anyway_works(): void
    {
        $papa = $this->loginAs('papa');
        $dup = $papa->postJson('/vendors', ['name' => '  shree tent HOUSE ', 'category' => 'tent_decor'])->assertStatus(409)->assertErrorCode('duplicate_found');
        $this->assertSame('name', $dup->json('error.details.matches.0.match_on') ?? $dup->json('error.matches.0.match_on'));
        $papa->postJson('/vendors', ['name' => 'Shree Tent House', 'category' => 'tent_decor', 'allow_duplicate' => true])->assertStatus(201);
    }

    #[Endpoint('GET /vendors/export')]
    public function test_vendor_export_money_columns_only_for_money_users(): void
    {
        $this->db()->run("UPDATE vendors SET agreed_amount_paise = 15000000, name = '@SUM(A1)' WHERE public_id = ?", [self::TENT]);
        $q = ['ids' => self::TENT . ',' . self::HALWAI];
        $papa = $this->loginAs('papa')->get('/vendors/export', $q)->assertStatus(200)->body();
        $this->assertStringContainsString('Agreed (₹)', $papa);
        $this->assertStringContainsString('150000.00', $papa);
        $this->assertStringContainsString("'@SUM(A1)", $papa, 'formula-safe');
        $mummy = $this->loginAs('mummy')->get('/vendors/export', $q)->assertStatus(200)->body();
        $this->assertStringNotContainsString('Agreed', $mummy);
        $this->assertStringNotContainsString('150000', $mummy);
        $this->loginAs('nani')->get('/vendors/export', $q)->assertStatus(403);
    }

    #[Endpoint('POST /payments/bulk')]
    public function test_payment_category_and_event_for_money_users_only_no_money_actions(): void
    {
        $ids = $this->payments(3);
        $papa = $this->loginAs('papa');
        $r = $papa->postJson('/payments/bulk', ['action' => 'set_category', 'category_id' => self::CLOTHING, 'ids' => $ids, 'as_of' => self::LOADED])->assertStatus(200)->json();
        $this->assertSame(3, $r['data']['affected']);
        $this->assertStringStartsWith('Set category ', $r['meta']['undo']['summary']);
        $amounts = array_column($this->db()->all('SELECT amount_paise, status FROM payments ORDER BY id'), 'amount_paise');
        $this->assertSame(['100000', '200000', '300000'], array_map('strval', $amounts), 'amounts never change');
        $e = $papa->postJson('/payments/bulk', ['action' => 'set_event', 'event_id' => self::MEHNDI, 'ids' => $ids, 'as_of' => self::NOW])->assertStatus(200)->json('data');
        $this->assertSame(3, $e['affected']);
        $papa->postJson('/payments/bulk', ['action' => 'set_event', 'event_id' => null, 'ids' => $ids, 'as_of' => self::NOW])->assertStatus(200);
        $this->assertSame(0, $this->rows('payments', 'event_id IS NOT NULL'));
        $papa->postJson('/undo/' . $r['data']['batch_id'], [])->assertStatus(200);

        foreach (['mark_paid', 'set_amount', 'delete'] as $no) {
            $papa->postJson('/payments/bulk', ['action' => $no, 'ids' => $ids, 'as_of' => self::NOW])->assertStatus(422);
        }
        $papa->postJson('/payments/bulk', ['action' => 'set_category', 'ids' => $ids, 'as_of' => self::NOW])->assertStatus(422);
        $this->loginAs('mummy')->postJson('/payments/bulk', ['action' => 'set_category', 'category_id' => self::CLOTHING, 'ids' => $ids, 'as_of' => self::NOW])->assertStatus(403);
    }

    #[Endpoint('GET /payments/export')]
    public function test_payment_export_for_money_users(): void
    {
        $ids = $this->payments(2);
        $body = $this->loginAs('mahi')->get('/payments/export', ['ids' => implode(',', $ids)])->assertStatus(200)->body();
        $lines = explode("\r\n", trim($body));
        $this->assertStringStartsWith("\u{FEFF}Title,Amount (₹),Status", $lines[0]);
        $this->assertCount(3, $lines);
        $this->assertStringContainsString("'=cmd()", $body);
        $this->assertStringContainsString('1000.00', $body);
        $this->loginAs('mummy')->get('/payments/export', ['ids' => implode(',', $ids)])->assertStatus(403);
    }
}
