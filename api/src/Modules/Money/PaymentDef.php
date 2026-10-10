<?php
declare(strict_types=1);

namespace AM\Modules\Money;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Kernel\App;
use AM\Kernel\Strings;
use AM\Kernel\Time;
use AM\Modules\Documents\DocumentDef;
use AM\Repo\EntityDef;
use AM\Repo\Refs;
use AM\Safety\History;
use AM\Validation\Fields;
use DateTimeImmutable;

/**
 * Payments and expenses (FEATURES B6). "Payment" when it has a vendor, else "Expense".
 * Money in integer paise only (DS-27). Receipts (documents) go and come back with it.
 */
final class PaymentDef extends EntityDef
{
    public const TABLE = 'payments';
    public const TYPE = 'payment';
    public const RESOURCE = 'payments';
    public const LABEL = 'payment';
    public const LABEL_PLURAL = 'payments';
    public const FIELD_LABELS = [
        'title' => 'Title', 'amount_paise' => 'Amount', 'category_id' => 'Category', 'vendor_id' => 'Paid to', 'event_id' => 'Event',
        'status' => 'Status', 'due_date' => 'Due date', 'paid_on' => 'Paid on', 'method' => 'Paid by (method)', 'paid_by' => 'Paid by',
        'reference' => 'Reference', 'notes' => 'Notes',
    ];
    public const MONEY_FIELDS = ['amount_paise'];
    public const CHILDREN = [DocumentDef::class => 'payment_id'];
    public const METHODS = ['cash' => 'Cash', 'upi' => 'UPI', 'bank' => 'Bank transfer', 'cheque' => 'Cheque', 'card' => 'Card', 'other' => 'Other'];
    public const MAX_PAISE = 1000000000; // 1,000,000,000 paise = ₹1 crore (API.md §6.8, TESTING §1.3)

    public static function name(array $row): string
    {
        return (string) ($row['title'] ?? 'a payment');
    }

    public static function canView(?array $viewer, array $row): bool
    {
        return Permissions::canSeeMoney($viewer);
    }

    public static function present(App $app, Db $db, Refs $refs, array $row, ?array $viewer): array
    {
        $names = self::refs($db, [$row]);
        return self::view($row, $names, $app->clock->todayIst());
    }

    /** Category, vendor, event and receipt lookups for a page of rows (one query each). */
    public static function refs(Db $db, array $rows): array
    {
        $out = ['budget_categories' => [], 'vendors' => [], 'events' => [], 'payments' => [], 'receipts' => []];
        $cols = ['budget_categories' => 'category_id', 'vendors' => 'vendor_id', 'events' => 'event_id', 'payments' => 'split_from_payment_id'];
        foreach ($cols as $table => $col) {
            $ids = array_values(array_unique(array_filter(array_map(static fn ($r) => $r[$col] !== null ? (int) $r[$col] : null, $rows))));
            if ($ids === []) {
                continue;
            }
            $in = implode(',', array_fill(0, count($ids), '?'));
            $nameCol = $table === 'payments' ? 'title' : 'name';
            foreach ($db->all("SELECT id, public_id, `$nameCol` AS name, deleted_at FROM `$table` WHERE id IN ($in)", $ids) as $r) {
                $out[$table][(int) $r['id']] = $r;
            }
        }
        $ids = array_map(static fn ($r) => (int) $r['id'], $rows);
        if ($ids !== []) {
            $in = implode(',', array_fill(0, count($ids), '?'));
            foreach ($db->all("SELECT payment_id, COUNT(*) AS n FROM documents WHERE payment_id IN ($in) AND deleted_at IS NULL GROUP BY payment_id", $ids) as $r) {
                $out['receipts'][(int) $r['payment_id']] = (int) $r['n'];
            }
        }
        return $out;
    }

    /** API shape Payment. A deleted vendor/category still shows, marked deleted ("(deleted vendor)"). */
    public static function view(array $r, array $refs, string $today): array
    {
        $ref = static function (string $table, $id) use ($refs): ?array {
            $x = $id !== null ? ($refs[$table][(int) $id] ?? null) : null;
            if ($x === null) {
                return null;
            }
            $o = ['id' => $x['public_id'], 'name' => $x['name']];
            if ($x['deleted_at'] !== null) {
                $o['deleted'] = true;
            }
            return $o;
        };
        $due = $r['status'] === 'due';
        return [
            'id' => $r['public_id'],
            'version' => (int) $r['version'],
            'title' => $r['title'],
            'kind' => $r['vendor_id'] !== null ? 'payment' : 'expense',
            'amount_paise' => (int) $r['amount_paise'],
            'status' => $r['status'],
            'overdue' => $due && $r['due_date'] !== null && $r['due_date'] < $today,
            'no_date' => $due && $r['due_date'] === null,
            'due_date' => $r['due_date'],
            'paid_on' => $r['paid_on'],
            'method' => $r['method'],
            'paid_by' => $r['paid_by'],
            'reference' => $r['reference'],
            'notes' => $r['notes'],
            'category' => $ref('budget_categories', $r['category_id']),
            'vendor' => $ref('vendors', $r['vendor_id']),
            'event' => $ref('events', $r['event_id']),
            'split_from' => $ref('payments', $r['split_from_payment_id']),
            'receipt_count' => $refs['receipts'][(int) $r['id']] ?? 0,
            'created_at' => Time::iso($r['created_at']),
            'updated_at' => Time::iso($r['updated_at']),
        ];
    }

    /**
     * Create (all fields) or PATCH (sent fields). The final state must hold together:
     * paid → paid_on (not in the future, IST) + method; due → no paid_on/method.
     */
    public static function input(App $app, Fields $f, bool $create, ?array $current): array
    {
        $f->only(['title', 'amount_paise', 'category_id', 'vendor_id', 'event_id', 'status', 'due_date', 'paid_on', 'method', 'paid_by', 'reference',
            'notes', 'new_vendor', 'allow_duplicate']);
        $db = $app->db();
        $out = [];
        if ($create || $f->has('title')) {
            $out['title'] = $f->text('title', 120, true);
        }
        if ($create || $f->has('amount_paise')) {
            $v = $f->value('amount_paise');
            if (!is_int($v) || $v < 1 || $v > self::MAX_PAISE) {
                $f->error('amount_paise', Strings::get('field_bad_amount'));
            } else {
                $out['amount_paise'] = $v;
            }
        }
        if ($f->has('category_id')) {
            $c = is_string($f->value('category_id'))
                ? $db->one('SELECT id, deleted_at FROM budget_categories WHERE public_id = ? LOCK IN SHARE MODE', [$f->value('category_id')]) : null; // R3
            if ($c === null) {
                $f->error('category_id', Strings::get('field_bad_choice'));
            } elseif ($c['deleted_at'] !== null) {
                $f->error('category_id', Strings::get('category_deleted_pick'));
            } else {
                $out['category_id'] = (int) $c['id'];
            }
        }
        foreach (['vendor_id' => 'vendors', 'event_id' => 'events'] as $k => $table) {
            if (!$f->has($k)) {
                continue;
            }
            $v = $f->value($k);
            if ($v === null || $v === '') {
                $out[$k] = null;
                continue;
            }
            $id = is_string($v) ? $db->value("SELECT id FROM `$table` WHERE public_id = ? AND deleted_at IS NULL", [$v]) : null;
            if ($id === null) {
                $f->error($k, Strings::get('field_bad_choice'));
            } else {
                $out[$k] = (int) $id;
            }
        }
        if ($create || $f->has('status')) {
            $out['status'] = $f->enum('status', ['due', 'paid']) ?? ($create ? 'due' : $current['status']);
        }
        foreach (['due_date', 'paid_on'] as $k) {
            if ($f->has($k)) {
                $out[$k] = $f->date($k);
            }
        }
        if ($f->has('method')) {
            $out['method'] = $f->enum('method', array_keys(self::METHODS));
        }
        foreach (['paid_by' => 60, 'reference' => 60, 'notes' => 5000] as $k => $max) {
            if ($create || $f->has($k)) {
                $out[$k] = $f->text($k, $max);
            }
        }
        // The final state.
        $status = $out['status'] ?? $current['status'] ?? 'due';
        if ($status === 'paid') {
            $paidOn = array_key_exists('paid_on', $out) ? $out['paid_on'] : ($current['paid_on'] ?? null);
            $method = array_key_exists('method', $out) ? $out['method'] : ($current['method'] ?? null);
            if ($paidOn === null && $create && !$f->has('paid_on')) {
                $out['paid_on'] = $paidOn = $app->clock->todayIst(); // "Paid already" defaults to today
            }
            if ($method === null && $create && !$f->has('method')) {
                $out['method'] = $method = 'upi';
            }
            if ($paidOn === null || $method === null) {
                $f->error($paidOn === null ? 'paid_on' : 'method', Strings::get('paid_needs_details'));
            } elseif ($paidOn > $app->clock->todayIst()) {
                $f->error('paid_on', Strings::get('paid_in_future'));
            }
        } elseif ($create || array_key_exists('status', $out)) {
            $out['paid_on'] = null;
            $out['method'] = null;
        }
        return $out;
    }

    /** "₹50,000 on 12 Oct" */
    public static function amountOn(int $paise, ?string $date): string
    {
        return History::rupees($paise) . ($date ? ' on ' . (new DateTimeImmutable($date))->format('j M') : '');
    }

    public static function formatValue(string $field, mixed $value): string
    {
        return match ($field) {
            'amount_paise' => History::rupees($value === null ? null : (int) $value),
            'status' => $value === 'paid' ? 'Paid' : 'Due',
            'method' => $value === null ? '(empty)' : (self::METHODS[(string) $value] ?? (string) $value),
            default => History::formatValue($value),
        };
    }
}
