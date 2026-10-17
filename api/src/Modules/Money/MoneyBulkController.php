<?php
declare(strict_types=1);

namespace AM\Modules\Money;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Kernel\App;
use AM\Kernel\RateLimiter;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Kernel\Strings;
use AM\Repo\BaseRepository;
use AM\Repo\Bulk;
use AM\Validation\Fields;

/**
 * Vendors and payments in bulk (1.0.24, admin-operations brief §9, §10), on the shared bulk loop:
 * one batch, one Undo, rows changed after the list loaded are skipped and named.
 *
 *   POST /vendors/bulk   set_category · set_booked (editors) · delete (Ayush and Mahi only)
 *   GET  /vendors/export?ids=          editors; the agreed amount only for money users
 *   POST /payments/bulk  set_category · set_event (money users). Never paid, amount or delete:
 *                        those stay one at a time on purpose.
 *   GET  /payments/export?ids=         money users
 */
final class MoneyBulkController
{
    public const MAX = 500;

    public static function vendors(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireEditor($viewer);
        $f = Fields::from($request->attr('json'));
        $f->only(['action', 'ids', 'as_of', 'category', 'is_booked']);
        $action = $f->enum('action', ['set_category', 'set_booked', 'delete'], true);
        $value = match ($action) {
            'set_category' => $f->enum('category', array_keys(VendorDef::CATEGORIES), true),
            'set_booked' => $f->bool('is_booked'),
            default => null,
        };
        if ($action === 'set_booked' && $value === null) {
            $f->error('is_booked', Strings::get('bulk_needs_value'));
        }
        $f->fail();
        if ($action === 'delete') {
            Permissions::requireAdmin($viewer);
        }
        $asOf = Bulk::asOf($f);
        $f->fail();
        $db = $app->db();
        $ids = Bulk::ids($db, $f, 'vendors', self::MAX, 'name, id');
        (new RateLimiter($app))->hit('bulk:user:' . $viewer['id'], 10, 600);
        $label = match ($action) {
            'set_category' => 'Set type ' . VendorDef::CATEGORIES[$value] . ' for %s',
            'set_booked' => ($value ? 'Marked booked: ' : 'Marked not booked: ') . '%s',
            default => 'Deleted %s',
        };
        $summaryFor = static fn (int $n) => sprintf($label, $n === 1 ? '1 vendor' : number_format($n) . ' vendors');
        $col = $action === 'set_category' ? 'category' : 'is_booked';
        $new = $action === 'set_booked' ? (int) $value : $value;
        return Bulk::run($app, $request, 'vendors', VendorDef::TYPE, 'name', $ids, $asOf, $action === 'delete' ? 'delete' : 'bulk_update', $summaryFor,
            static function (Db $db, array $row, int $batchId) use ($app, $request, $action, $col, $new): bool|string|null {
                if ($action === 'delete') {
                    BaseRepository::softDeleteInBatch($app, $db, $request, VendorDef::class, $row, $batchId);
                    return true;
                }
                if ((string) $row[$col] === (string) $new) {
                    return null;
                }
                Bulk::setColumns($app, $db, $request, 'vendors', VendorDef::TYPE, $row, [$col => $new], $batchId);
                return true;
            });
    }

    public static function exportVendors(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireEditor($viewer);
        $ids = Bulk::exportIds($request, self::MAX);
        $money = Permissions::canSeeMoney($viewer);
        $db = $app->db();
        $in = implode(',', array_fill(0, count($ids), '?'));
        $rows = [['Name', 'Type', 'Contact', 'Phone', 'Other phone', 'Booked', ...($money ? ['Agreed (₹)', 'Paid (₹)', 'Due (₹)'] : []), 'Notes']];
        foreach ($db->all("SELECT * FROM vendors WHERE public_id IN ($in) AND deleted_at IS NULL ORDER BY name, id", $ids) as $v) {
            $m = [];
            if ($money) {
                $t = $db->one("SELECT COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_paise END), 0) paid, COALESCE(SUM(CASE WHEN status = 'due' THEN amount_paise END), 0) due
                               FROM payments WHERE vendor_id = ? AND deleted_at IS NULL", [$v['id']]);
                $m = [self::rupees($v['agreed_amount_paise']), self::rupees($t['paid']), self::rupees($t['due'])];
            }
            $rows[] = [$v['name'], VendorDef::CATEGORIES[$v['category']] ?? $v['category'], $v['contact_person'], $v['phone'], $v['alt_phone'],
                (int) $v['is_booked'] ? 'Yes' : 'No', ...$m, $v['notes']];
        }
        return Bulk::csv($app, $request, VendorDef::TYPE, 'vendors', $rows, 'vendors');
    }

    public static function payments(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireMoney($viewer);
        $f = Fields::from($request->attr('json'));
        $f->only(['action', 'ids', 'as_of', 'category_id', 'event_id']);
        $action = $f->enum('action', ['set_category', 'set_event'], true);
        $f->fail();
        $db = $app->db();
        $key = $action === 'set_category' ? 'category_id' : 'event_id';
        $raw = $f->value($key);
        $target = null;
        $name = 'no event';
        if ($action === 'set_category' || ($raw !== null && $raw !== '')) {
            $table = $action === 'set_category' ? 'budget_categories' : 'events';
            $t = is_string($raw) ? $db->one("SELECT id, name FROM `$table` WHERE public_id = ? AND deleted_at IS NULL", [$raw]) : null;
            if ($t === null) {
                $f->error($key, Strings::get(!$f->has($key) ? 'bulk_needs_value' : 'field_bad_choice'));
            } else {
                [$target, $name] = [(int) $t['id'], (string) $t['name']];
            }
        } elseif (!$f->has($key)) {
            $f->error($key, Strings::get('bulk_needs_value'));
        }
        $asOf = Bulk::asOf($f);
        $f->fail();
        $ids = Bulk::ids($db, $f, 'payments', self::MAX);
        (new RateLimiter($app))->hit('bulk:user:' . $viewer['id'], 10, 600);
        $label = ($action === 'set_category' ? 'Set category ' : 'Set event ') . $name . ' for %s';
        $summaryFor = static fn (int $n) => sprintf($label, $n === 1 ? '1 payment' : number_format($n) . ' payments');
        return Bulk::run($app, $request, 'payments', PaymentDef::TYPE, 'title', $ids, $asOf, 'bulk_update', $summaryFor,
            static function (Db $db, array $row, int $batchId) use ($app, $request, $key, $target): ?bool {
                if (($row[$key] === null ? null : (int) $row[$key]) === $target) {
                    return null;
                }
                Bulk::setColumns($app, $db, $request, 'payments', PaymentDef::TYPE, $row, [$key => $target], $batchId);
                return true;
            });
    }

    public static function exportPayments(Request $request, App $app, array $params): Response
    {
        Permissions::requireMoney($request->attr('user'));
        $ids = Bulk::exportIds($request, self::MAX);
        $db = $app->db();
        $in = implode(',', array_fill(0, count($ids), '?'));
        $rows = [['Title', 'Amount (₹)', 'Status', 'Due date', 'Paid on', 'Method', 'Paid by', 'Reference', 'Category', 'Vendor', 'Event', 'Notes']];
        foreach ($db->all("SELECT p.*, c.name AS category_name, v.name AS vendor_name, e.name AS event_name FROM payments p
                           LEFT JOIN budget_categories c ON c.id = p.category_id LEFT JOIN vendors v ON v.id = p.vendor_id LEFT JOIN events e ON e.id = p.event_id
                           WHERE p.public_id IN ($in) AND p.deleted_at IS NULL ORDER BY p.status = 'paid', p.due_date IS NULL, p.due_date, p.paid_on DESC, p.id", $ids) as $p) {
            $rows[] = [$p['title'], self::rupees($p['amount_paise']), $p['status'] === 'paid' ? 'Paid' : 'Due', $p['due_date'], $p['paid_on'], $p['method'], $p['paid_by'],
                $p['reference'], $p['category_name'], $p['vendor_name'], $p['event_name'], $p['notes']];
        }
        return Bulk::csv($app, $request, PaymentDef::TYPE, 'payments', $rows, 'payments');
    }

    /** 1234567 paise → "12345.67" (plain, so spreadsheets add it up). */
    private static function rupees(mixed $paise): ?string
    {
        return $paise === null ? null : number_format(((int) $paise) / 100, 2, '.', '');
    }
}
