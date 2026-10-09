<?php
declare(strict_types=1);

namespace AM\Modules\Guests;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Db\UnitOfWork;
use AM\Kernel\App;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Modules\Events\InvitationDef;
use AM\Safety\AuditLog;
use DateTimeImmutable;
use DateTimeZone;

/**
 * GET /households/export — the filtered guest list as CSV (FEATURES B8):
 * UTF-8 with BOM (Hindi and ₹ open right in Excel), RFC 4180, IST times,
 * formula-safe cells (AC-EXP-07). Admins only; every download is audited.
 */
final class GuestCsv
{
    public static function export(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireAdmin($viewer);
        $db = $app->db();
        [$where, $args] = HouseholdsController::filters($db, $request->query);
        $families = $db->all('SELECT h.* FROM households h WHERE ' . implode(' AND ', $where) . ' ORDER BY h.name, h.id', $args);
        $events = $db->all('SELECT id, name FROM events WHERE deleted_at IS NULL AND guests_invited = 1 ORDER BY start_at IS NULL, start_at, sort_order, id');
        $answers = [];
        foreach ($db->all('SELECT he.household_id, he.event_id, he.rsvp FROM household_events he JOIN households h ON h.id = he.household_id
                           WHERE he.deleted_at IS NULL AND h.deleted_at IS NULL') as $r) {
            $answers[(int) $r['household_id']][(int) $r['event_id']] = InvitationDef::RSVP[$r['rsvp']];
        }
        $ist = new DateTimeZone('Asia/Kolkata');
        $head = ['Family name', 'Phone', 'Other phone', 'Side', 'Group', 'Relation', 'Area', 'City', 'Address', 'Adults', 'Children', 'People',
            'Food', 'Jain people', 'Important', ...array_column($events, 'name'), 'Notes', 'Added on (IST)'];
        $lines = [self::line($head)];
        foreach ($families as $h) {
            $row = [$h['name'], $h['phone'], $h['alt_phone'], HouseholdDef::SIDES[$h['side']], $h['group_name'], $h['relation'], $h['area'], $h['city'],
                $h['address'], $h['adults'], $h['children'], (int) $h['adults'] + (int) $h['children'], HouseholdDef::FOOD[$h['food']], $h['jain_count'],
                (int) $h['is_vip'] ? 'Yes' : 'No'];
            foreach ($events as $e) {
                $row[] = $answers[(int) $h['id']][(int) $e['id']] ?? 'Not invited';
            }
            $row[] = $h['notes'];
            $row[] = (new DateTimeImmutable($h['created_at'], new DateTimeZone('UTC')))->setTimezone($ist)->format('Y-m-d H:i');
            $lines[] = self::line($row);
        }
        $day = $app->clock->todayIst();
        $n = count($families);
        UnitOfWork::run($app, $request, static function (Db $db) use ($app, $request, $n): Response {
            AuditLog::record($app, $db, $request, ['action' => 'export', 'entity_type' => 'household', 'note' => "the guest list as CSV ($n families)"]);
            return Response::ok(null);
        });
        $r = new Response(200);
        $r->body = "\u{FEFF}" . implode("\r\n", $lines) . "\r\n";
        $r->headers['Content-Type'] = 'text/csv; charset=utf-8';
        $r->headers['Content-Disposition'] = "attachment; filename=\"guests_$day.csv\"";
        $r->headers['Cache-Control'] = 'no-store';
        return $r;
    }

    /** One RFC 4180 line. */
    public static function line(array $cells): string
    {
        return implode(',', array_map(static function ($v): string {
            $s = self::safe($v === null ? '' : (string) $v);
            return preg_match('/[",\r\n]/', $s) ? '"' . str_replace('"', '""', $s) . '"' : $s;
        }, $cells));
    }

    /** Formula safety (AC-EXP-07): =, @, tab or CR first, or + / - that isn't a phone or a number → a leading '. */
    public static function safe(string $s): string
    {
        if ($s === '') {
            return $s;
        }
        $first = $s[0];
        $risky = in_array($first, ['=', '@', "\t", "\r"], true)
            || (($first === '+' || $first === '-') && !preg_match('/^\+\d{8,15}$/', $s) && !preg_match('/^-?\d+(\.\d+)?$/', $s));
        return $risky ? "'" . $s : $s;
    }
}
