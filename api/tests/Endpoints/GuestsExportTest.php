<?php
declare(strict_types=1);

namespace Tests\Endpoints;

use Tests\Support\ApiTestCase;
use Tests\Support\Endpoint;

/** GET /households/export — FEATURES B8 (US-EXP-04), AC-EXP-07, SEC-28, SEC-10 (Family can't export), audited. */
final class GuestsExportTest extends ApiTestCase
{
    private const MEHNDI = '01M4DK5T3E6QZBMNQ0V7KQWW23';

    #[Endpoint('GET /households/export')]
    public function test_csv_bom_ist_formula_safe_filtered_audited(): void
    {
        $mummy = $this->loginAs('mummy');
        $a = $mummy->postJson('/households', ['name' => 'शर्मा परिवार', 'phone' => '9829012345', 'side' => 'groom', 'notes' => '=HYPERLINK("http://x")', 'invite_event_ids' => [self::MEHNDI]])->json('data.id');
        $mummy->postJson('/households', ['name' => 'Gupta ji', 'side' => 'bride', 'notes' => '@SUM(A1)', 'area' => '-2+3'])->assertStatus(201);
        $mummy->patchJson("/households/$a/invitations/" . self::MEHNDI, ['rsvp' => 'coming'], 1)->assertStatus(200);
        $ayush = $this->loginAs('ayush');
        $res = $ayush->get('/households/export', ['side' => 'groom'])->assertStatus(200);
        $this->assertSame('text/csv; charset=utf-8', $res->header('Content-Type'));
        $this->assertSame('attachment; filename="guests_2026-10-08.csv"', $res->header('Content-Disposition'));
        $body = $res->body();
        $this->assertStringStartsWith("\u{FEFF}Family name,Phone,Other phone,Side,", $body);
        $lines = explode("\r\n", trim(substr($body, 3)));
        $this->assertCount(2, $lines, 'header + the one groom family');
        $this->assertStringContainsString(',Engagement,Haldi,Mehndi,Sangeet,Mayra,Wedding,Reception,Notes,Added on (IST)', $lines[0]);
        $this->assertSame(
            "शर्मा परिवार,+919829012345,,Groom's side,,,,Bhilwara,,2,0,2,Veg,0,No,Not invited,Not invited,Coming,Not invited,Not invited,Not invited,Not invited,\"'=HYPERLINK(\"\"http://x\"\")\",2026-10-08 14:42",
            $lines[1],
        );
        $all = $ayush->get('/households/export')->body();
        $this->assertStringContainsString("'@SUM(A1)", $all);
        $this->assertStringContainsString(",'-2+3,", $all, 'SEC-28');
        $lines = array_column($ayush->get('/activity')->json('data'), 'sentence');
        $this->assertSame('Ayush downloaded the guest list as CSV (2 families).', $lines[0]);
        $this->loginAs('papa')->get('/households/export')->assertStatus(403);
        $ayush->get('/households/export', ['rsvp' => 'coming'])->assertStatus(422);
    }
}
