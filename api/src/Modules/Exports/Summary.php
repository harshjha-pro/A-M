<?php
declare(strict_types=1);

namespace AM\Modules\Exports;

use AM\Db\Db;
use AM\Modules\Events\Headcount;
use AM\Modules\Guests\HouseholdDef;
use AM\Modules\Money\MoneyController;
use AM\Modules\Money\VendorDef;
use AM\Modules\Tasks\TaskDef;
use AM\Safety\History;
use DateTimeImmutable;
use DateTimeZone;

/**
 * summary.html in the export (FEATURES B8, US-EXP-03): wedding facts, events, tasks by
 * status, headcount per event, guests by side, budget, payments, vendor contacts.
 * One self-contained page (inline CSS, no scripts), readable on a computer and
 * print-ready (Print → Save as PDF). Runs inside the export's snapshot transaction,
 * so it agrees with the CSVs. Live rows only; deleted ones are in the CSVs.
 */
final class Summary
{
    public static function html(Db $db, DateTimeImmutable $now, array $counts): string
    {
        $ist = new DateTimeZone('Asia/Kolkata');
        $s = $db->one('SELECT * FROM settings WHERE id = 1') ?? [];
        $title = trim(($s['groom_name'] ?? 'Ayush') . ' & ' . ($s['bride_name'] ?? 'Mahi'));
        $out = [];
        $out[] = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">';
        $out[] = '<title>' . self::e($title) . ' — wedding summary</title><style>' . self::CSS . '</style></head><body>';
        $out[] = '<header><h1>' . self::e($title) . '</h1><p>' . self::e(self::dates($s)) . (isset($s['city']) ? ' · ' . self::e($s['city']) : '') . '</p>';
        $out[] = '<p class="muted">Export made ' . self::e($now->setTimezone($ist)->format('j M Y, g:i A')) . ' IST. Live records only; deleted ones are in the CSV files.</p></header>';

        // Events + headcount
        $events = $db->all('SELECT * FROM events WHERE deleted_at IS NULL ORDER BY start_at IS NULL, start_at, sort_order, id');
        $out[] = '<section><h2>Events</h2>';
        if ($events === []) {
            $out[] = '<p class="muted">No events.</p>';
        } else {
            $out[] = '<table><thead><tr><th>Event</th><th>When (IST)</th><th>Venue</th><th class="n">Families invited</th><th class="n">People coming</th><th class="n">Up to</th><th class="n">Jain</th></tr></thead><tbody>';
            foreach ($events as $e) {
                $h = (int) $e['guests_invited'] ? Headcount::forEvent($db, $e) : null;
                $out[] = '<tr><td>' . self::e($e['name']) . '</td><td>' . self::e(self::when($e, $ist)) . '</td><td>' . self::e(trim(($e['venue_name'] ?? '') . ' ' . ($e['venue_address'] ?? ''))) . '</td>'
                    . ($h ? '<td class="n">' . $h['families_invited'] . '</td><td class="n">' . $h['people_coming'] . '</td><td class="n">' . $h['people_up_to'] . '</td><td class="n">' . $h['jain_coming'] . '</td>' : '<td class="n muted" colspan="4">No guest list</td>') . '</tr>';
            }
            $out[] = '</tbody></table>';
        }
        $out[] = '</section>';

        // Guests by side
        $sides = $db->all("SELECT side, COUNT(*) AS families, COALESCE(SUM(adults + children), 0) AS people FROM households WHERE deleted_at IS NULL GROUP BY side");
        $out[] = '<section><h2>Guests by side</h2><table><thead><tr><th>Side</th><th class="n">Families</th><th class="n">People</th></tr></thead><tbody>';
        $tf = 0;
        $tp = 0;
        foreach ($sides as $r) {
            $label = match ($r['side']) { 'bride' => $s['bride_side_label'] ?? HouseholdDef::SIDES['bride'], 'groom' => $s['groom_side_label'] ?? HouseholdDef::SIDES['groom'], default => HouseholdDef::SIDES[$r['side']] ?? $r['side'] };
            $out[] = '<tr><td>' . self::e($label) . '</td><td class="n">' . (int) $r['families'] . '</td><td class="n">' . (int) $r['people'] . '</td></tr>';
            $tf += (int) $r['families'];
            $tp += (int) $r['people'];
        }
        $out[] = "<tr class=\"total\"><td>Total</td><td class=\"n\">$tf</td><td class=\"n\">$tp</td></tr></tbody></table></section>";

        // Tasks by status
        $tasks = $db->all("SELECT t.title, t.status, t.due_date,
                                  (SELECT GROUP_CONCAT(u.name ORDER BY u.name SEPARATOR ', ') FROM task_assignees ta JOIN users u ON u.id = ta.user_id WHERE ta.task_id = t.id AND ta.deleted_at IS NULL) AS owner
                           FROM tasks t WHERE t.deleted_at IS NULL ORDER BY t.due_date IS NULL, t.due_date, t.id");
        $out[] = '<section><h2>Tasks</h2>';
        $by = [];
        foreach ($tasks as $t) {
            $by[$t['status']][] = $t;
        }
        $out[] = '<p>' . implode(' · ', array_map(static fn ($k, $label) => self::e($label) . ': ' . count($by[$k] ?? []), array_keys(TaskDef::STATUS), TaskDef::STATUS)) . '</p>';
        foreach (TaskDef::STATUS as $k => $label) {
            if (empty($by[$k])) {
                continue;
            }
            $out[] = '<h3>' . self::e($label) . '</h3><table><thead><tr><th>Task</th><th>Due</th><th>Who</th></tr></thead><tbody>';
            foreach ($by[$k] as $t) {
                $out[] = '<tr><td>' . self::e($t['title']) . '</td><td>' . self::e($t['due_date'] ? (new DateTimeImmutable($t['due_date']))->format('j M Y') : '—') . '</td><td>' . self::e($t['owner'] ?? '—') . '</td></tr>';
            }
            $out[] = '</tbody></table>';
        }
        $out[] = '</section>';

        // Budget
        $m = MoneyController::totals($db);
        $r = static fn ($p) => self::e(History::rupees((int) $p));
        $out[] = '<section><h2>Budget</h2><p class="cards"><span>Planned <b>' . $r($m['planned_paise']) . '</b></span><span>Spent <b>' . $r($m['spent_paise']) . '</b></span>'
            . '<span>Still to pay <b>' . $r($m['still_to_pay_paise']) . '</b></span><span>Left <b>' . $r($m['left_paise']) . '</b></span><span>Free <b>' . $r($m['free_paise']) . '</b></span></p>';
        $out[] = '<table><thead><tr><th>Category</th><th class="n">Planned</th><th class="n">Spent</th><th class="n">Due</th></tr></thead><tbody>';
        foreach ($m['categories'] as $c) {
            $out[] = '<tr><td>' . self::e($c['name']) . '</td><td class="n">' . $r($c['planned_paise']) . '</td><td class="n">' . $r($c['spent_paise']) . '</td><td class="n">' . $r($c['due_paise']) . '</td></tr>';
        }
        $out[] = '</tbody></table></section>';

        // Payments
        $pays = $db->all("SELECT p.title, p.amount_paise, p.status, p.due_date, p.paid_on, v.name AS vendor FROM payments p LEFT JOIN vendors v ON v.id = p.vendor_id
                          WHERE p.deleted_at IS NULL ORDER BY p.status = 'paid', COALESCE(p.due_date, p.paid_on) IS NULL, COALESCE(p.due_date, p.paid_on), p.id");
        $out[] = '<section><h2>Payments</h2>';
        if ($pays === []) {
            $out[] = '<p class="muted">No payments.</p>';
        } else {
            $out[] = '<table><thead><tr><th>For</th><th>Paid to</th><th class="n">Amount</th><th>Status</th></tr></thead><tbody>';
            foreach ($pays as $p) {
                $status = $p['status'] === 'paid'
                    ? 'Paid' . ($p['paid_on'] ? ' ' . (new DateTimeImmutable($p['paid_on']))->format('j M Y') : '')
                    : ($p['due_date'] ? 'Due ' . (new DateTimeImmutable($p['due_date']))->format('j M Y') : 'Due, no date');
                $out[] = '<tr><td>' . self::e($p['title']) . '</td><td>' . self::e($p['vendor'] ?? 'Expense') . '</td><td class="n">' . $r($p['amount_paise']) . '</td><td>' . self::e($status) . '</td></tr>';
            }
            $out[] = '</tbody></table>';
        }
        $out[] = '</section>';

        // Vendors
        $vendors = $db->all('SELECT name, category, contact_person, phone, alt_phone, is_booked FROM vendors WHERE deleted_at IS NULL ORDER BY name, id');
        $out[] = '<section><h2>Vendor contacts</h2>';
        if ($vendors === []) {
            $out[] = '<p class="muted">No vendors.</p>';
        } else {
            $out[] = '<table><thead><tr><th>Vendor</th><th>Type</th><th>Contact</th><th>Phone</th></tr></thead><tbody>';
            foreach ($vendors as $v) {
                $phones = implode(', ', array_filter([$v['phone'], $v['alt_phone']]));
                $out[] = '<tr><td>' . self::e($v['name']) . ((int) $v['is_booked'] ? ' ✓' : '') . '</td><td>' . self::e(VendorDef::CATEGORIES[$v['category']] ?? $v['category']) . '</td><td>'
                    . self::e($v['contact_person'] ?? '') . '</td><td>' . self::e($phones) . '</td></tr>';
            }
            $out[] = '</tbody></table>';
        }
        $out[] = '</section>';

        $out[] = '<footer class="muted">Rows in this export: ' . self::e(implode(' · ', array_map(static fn ($t, $n) => "$t $n", array_keys($counts), $counts))) . '</footer>';
        $out[] = '</body></html>';
        return implode("\n", $out) . "\n";
    }

    private static function dates(array $s): string
    {
        if (!isset($s['wedding_start_date'])) {
            return '';
        }
        $a = new DateTimeImmutable($s['wedding_start_date']);
        $b = new DateTimeImmutable($s['wedding_end_date']);
        return $a == $b ? $a->format('j M Y') : $a->format('j') . '–' . $b->format('j M Y');
    }

    private static function when(array $e, DateTimeZone $ist): string
    {
        if ($e['start_at'] === null) {
            return 'Date not set';
        }
        $t = (new DateTimeImmutable($e['start_at'], new DateTimeZone('UTC')))->setTimezone($ist);
        return (int) $e['all_day'] ? $t->format('D, j M Y') : $t->format('D, j M Y, g:i A');
    }

    private static function e(?string $s): string
    {
        return htmlspecialchars((string) $s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    private const CSS = <<<'CSS'
        :root{color-scheme:light}
        body{font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Devanagari",sans-serif;color:#2b1d1d;background:#fff;margin:0 auto;max-width:960px;padding:24px 16px}
        h1{font-size:28px;margin:0;color:#7a1c2b}h2{font-size:20px;margin:28px 0 8px;color:#7a1c2b;border-bottom:2px solid #f0e2d8;padding-bottom:4px}h3{font-size:16px;margin:16px 0 4px}
        table{border-collapse:collapse;width:100%;margin:6px 0}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #eee;vertical-align:top}th{background:#faf3ee;font-size:13px}
        .n{text-align:right;white-space:nowrap}.muted{color:#6b5b5b}.total td{font-weight:700}
        .cards{display:flex;flex-wrap:wrap;gap:12px}.cards span{border:1px solid #eadbd0;border-radius:8px;padding:6px 10px}
        footer{margin-top:32px;font-size:12px}
        @media print{body{padding:0;font-size:12px}h2{break-after:avoid}tr{break-inside:avoid}section{break-inside:auto}}
        CSS;
}
