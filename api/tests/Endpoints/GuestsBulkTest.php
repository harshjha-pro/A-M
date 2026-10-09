<?php
declare(strict_types=1);

namespace Tests\Endpoints;

use Tests\Support\ApiClient;
use Tests\Support\ApiTestCase;
use Tests\Support\Endpoint;
use Tests\Support\TestResponse;

/**
 * POST /households/bulk — FEATURES B5, API.md §6.7, TESTING §1.3 bulk row,
 * AC-GST-05, DS-12, DS-25, SEC-10 (bulk delete), SEC-21 (bulk limit).
 * Frozen clock: Thu 8 Oct 2026, 2:42 PM IST (09:12:31Z).
 */
final class GuestsBulkTest extends ApiTestCase
{
    private const MEHNDI = '01M4DK5T3E6QZBMNQ0V7KQWW23';
    private const RECEPTION = '01M4DK5T3JCJAF3HDCPWRTYSHQ';
    private const LOADED = '2026-10-08T09:00:00Z'; // the phone loaded the list 12 minutes ago

    /** n families straight into the table, last edited before the list was loaded. @return list<string> public ids */
    private function families(int $n, string $side = 'groom', int $from = 1): array
    {
        $ids = [];
        $db = $this->db();
        for ($i = $from; $i < $from + $n; $i++) {
            $pid = sprintf('01JC%022d', $i);
            $db->run("INSERT INTO households (public_id, name, name_norm, side, adults, created_by, updated_by, created_at, updated_at)
                      VALUES (?, ?, ?, ?, 2, 1, 1, '2026-10-01 05:00:00', '2026-10-01 05:00:00')", [$pid, sprintf('Family %04d', $i), sprintf('family %04d', $i), $side]);
            $ids[] = $pid;
        }
        return $ids;
    }

    private function bulk(ApiClient $c, array $body): TestResponse
    {
        return $c->postJson('/households/bulk', $body + ['as_of' => self::LOADED]);
    }

    private function eventId(string $pid): int
    {
        return (int) $this->row('SELECT id FROM events WHERE public_id = ?', [$pid])['id'];
    }

    #[Endpoint('POST /households/bulk')]
    public function test_ac_gst_05_invite_all_filtered_skips_invited_and_undo_removes_exactly_the_new(): void
    {
        $groom = $this->families(26, 'groom');
        $this->families(4, 'bride', 100);
        $rec = $this->eventId(self::RECEPTION);
        foreach (array_slice($groom, 0, 2) as $pid) { // 2 already invited, one already Coming
            $hid = (int) $this->row('SELECT id FROM households WHERE public_id = ?', [$pid])['id'];
            $this->db()->run("INSERT INTO household_events (household_id, event_id, rsvp, created_at, updated_at) VALUES (?, ?, 'coming', '2026-10-01 05:00:00', '2026-10-01 05:00:00')", [$hid, $rec]);
        }
        $mummy = $this->loginAs('mummy');
        $res = $this->bulk($mummy, ['action' => 'invite', 'event_id' => self::RECEPTION, 'filter' => ['side' => 'groom']])->assertStatus(200)->assertEnvelope();
        $this->assertSame(24, $res->json('data.affected'));
        $this->assertCount(2, $res->json('data.skipped'));
        $this->assertSame('already_invited', $res->json('data.skipped.0.reason'));
        $this->assertSame('Invited 24 families to Reception', $res->json('meta.undo.summary'));
        $this->assertSame(2, $this->rows('household_events', "event_id = ? AND rsvp = 'coming'", [$rec]), 'existing answers untouched');
        $this->assertSame(26, $this->rows('household_events', 'event_id = ? AND deleted_at IS NULL', [$rec]));
        $mummy->postJson('/undo/' . $res->json('meta.undo.batch_id'), new \stdClass())->assertStatus(200);
        $this->assertSame(2, $this->rows('household_events', 'event_id = ? AND deleted_at IS NULL', [$rec]), 'Undo removes exactly the 24');
        $this->assertSame(26, $this->rows('household_events', 'event_id = ?', [$rec]), 'soft, never removed');
    }

    #[Endpoint('POST /households/bulk')]
    public function test_ds12_bulk_answer_30_one_edited_since_undo_skips_and_names_it(): void
    {
        $ids = $this->families(30);
        $mehndi = $this->eventId(self::MEHNDI);
        $this->db()->run("INSERT INTO household_events (household_id, event_id, created_at, updated_at) SELECT id, ?, '2026-10-01 05:00:00', '2026-10-01 05:00:00' FROM households", [$mehndi]);
        $ayush = $this->loginAs('ayush');
        $res = $this->bulk($ayush, ['action' => 'set_rsvp', 'event_id' => self::MEHNDI, 'rsvp' => 'waiting', 'ids' => $ids])->assertStatus(200);
        $this->assertSame(30, $res->json('data.affected'));
        $this->assertSame(30, $this->rows('household_events', "rsvp = 'waiting' AND rsvp_updated_by = 1"));
        // Mummy changes one answer after the bulk action.
        $this->loginAs('mummy')->patchJson("/households/{$ids[4]}/invitations/" . self::MEHNDI, ['rsvp' => 'coming'], 2)->assertStatus(200);
        $u = $ayush->postJson('/undo/' . $res->json('meta.undo.batch_id'), new \stdClass())->assertStatus(200);
        $this->assertSame(29, $u->json('data.undone'));
        $this->assertSame([['type' => 'invitation', 'id' => null, 'name' => 'Family 0005 · Mehndi', 'reason' => 'changed_since', 'changed_by' => ['id' => $this->pid('mummy'), 'name' => 'Mummy']]], $u->json('data.skipped'));
        $this->assertSame(29, $this->rows('household_events', "rsvp = 'not_asked'"));
        $this->assertSame(1, $this->rows('household_events', "rsvp = 'coming'"));
    }

    #[Endpoint('POST /households/bulk')]
    public function test_ds25_as_of_skips_rows_changed_after_loading_set_side(): void
    {
        $ids = $this->families(5);
        $this->loginAs('mummy')->patchJson("/households/{$ids[0]}", ['area' => 'Azad Nagar'], 1)->assertStatus(200);
        $this->loginAs('mummy')->patchJson("/households/{$ids[1]}", ['area' => 'Azad Nagar'], 1)->assertStatus(200);
        $papa = $this->loginAs('papa');
        $res = $this->bulk($papa, ['action' => 'set_side', 'side' => 'both', 'ids' => $ids])->assertStatus(200);
        $this->assertSame(3, $res->json('data.affected'));
        $this->assertSame(['changed_since_loaded', 'changed_since_loaded'], array_column($res->json('data.skipped'), 'reason'));
        $this->assertSame('Mummy', $res->json('data.skipped.0.changed_by.name'));
        $this->assertSame(3, $this->rows('households', "side = 'both'"));
        $lines = array_column($this->loginAs('ayush')->get('/activity')->json('data'), 'sentence');
        $this->assertContains("Papa changed Side from Groom's side to Both sides for Family 0003.", $lines);
        $papa->postJson('/undo/' . $res->json('meta.undo.batch_id'), new \stdClass())->assertStatus(200);
        $this->assertSame(0, $this->rows('households', "side = 'both'"));
    }

    #[Endpoint('POST /households/bulk')]
    public function test_uninvite_and_delete_with_undo_and_trash(): void
    {
        $ids = $this->families(3);
        $mehndi = $this->eventId(self::MEHNDI);
        $this->db()->run("INSERT INTO household_events (household_id, event_id, created_at, updated_at) SELECT id, ?, '2026-10-01 05:00:00', '2026-10-01 05:00:00' FROM households", [$mehndi]);
        $mummy = $this->loginAs('mummy');
        $r = $this->bulk($mummy, ['action' => 'uninvite', 'event_id' => self::MEHNDI, 'ids' => [$ids[0], $ids[1]]])->assertStatus(200);
        $this->assertSame('Removed 2 families from Mehndi', $r->json('meta.undo.summary'));
        $this->assertSame(1, $this->rows('household_events', 'deleted_at IS NULL'));
        $again = $this->bulk($mummy, ['action' => 'uninvite', 'event_id' => self::MEHNDI, 'ids' => [$ids[0]]])->assertStatus(200);
        $this->assertSame(['not_invited'], array_column($again->json('data.skipped'), 'reason'));
        $this->assertArrayNotHasKey('undo', $again->json('meta'));

        $this->bulk($mummy, ['action' => 'delete', 'ids' => $ids])->assertStatus(403); // SEC-10: bulk delete is admin-only
        $ayush = $this->loginAs('ayush');
        $d = $this->bulk($ayush, ['action' => 'delete', 'ids' => $ids])->assertStatus(200);
        $this->assertSame(3, $d->json('data.affected'));
        $this->assertSame(0, $this->rows('households', 'deleted_at IS NULL'));
        $this->assertSame(0, $this->rows('household_events', 'deleted_at IS NULL'), 'invitations go with their families');
        $trash = $ayush->get('/trash')->json('data.0');
        $this->assertSame('Deleted 3 families', $trash['summary']);
        $ayush->postJson('/undo/' . $d->json('meta.undo.batch_id'), new \stdClass())->assertStatus(200);
        $this->assertSame(3, $this->rows('households', 'deleted_at IS NULL'));
        $this->assertSame(1, $this->rows('household_events', 'deleted_at IS NULL'));
    }

    #[Endpoint('POST /households/bulk')]
    public function test_limits_and_validation(): void
    {
        $papa = $this->loginAs('papa');
        $tooMany = array_map(static fn ($i) => sprintf('01JD%022d', $i), range(1, 2001));
        $r = $this->bulk($papa, ['action' => 'set_side', 'side' => 'bride', 'ids' => $tooMany])->assertStatus(422);
        $this->assertSame('Please choose 2,000 families or fewer.', $r->json('error.message'));
        $this->families(2001);
        $this->bulk($papa, ['action' => 'set_side', 'side' => 'bride', 'filter' => new \stdClass()])->assertStatus(422);
        $this->bulk($papa, ['action' => 'invite', 'ids' => []])->assertStatus(422); // no event
        $this->bulk($papa, ['action' => 'invite', 'event_id' => self::MEHNDI])->assertStatus(422); // neither ids nor filter
        $this->bulk($papa, ['action' => 'shout', 'ids' => []])->assertStatus(422);
        $papa->postJson('/households/bulk', ['action' => 'set_side', 'side' => 'bride', 'ids' => []])->assertStatus(422); // as_of required
        $this->bulk($this->loginAs('nani'), ['action' => 'set_side', 'side' => 'bride', 'ids' => []])->assertStatus(403);
    }

    /** SEC-21: bulk actions 10 per 10 minutes per person; the 11th → 429. */
    public function test_sec21_bulk_rate_limit(): void
    {
        $ids = $this->families(1);
        $papa = $this->loginAs('papa');
        for ($i = 0; $i < 10; $i++) {
            $this->bulk($papa, ['action' => 'set_side', 'side' => $i % 2 ? 'groom' : 'bride', 'ids' => $ids])->assertStatus(200);
        }
        $this->bulk($papa, ['action' => 'set_side', 'side' => 'both', 'ids' => $ids])->assertStatus(429);
    }
}
