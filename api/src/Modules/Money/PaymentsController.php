<?php
declare(strict_types=1);

namespace AM\Modules\Money;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Db\UnitOfWork;
use AM\Http\BaseController;
use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Kernel\Strings;
use AM\Kernel\Time;
use AM\Kernel\Ulid;
use AM\Repo\BaseRepository;
use AM\Repo\Cursor;
use AM\Repo\Refs;
use AM\Repo\Versioned;
use AM\Safety\AuditLog;
use AM\Safety\ChangeBatches;
use AM\Validation\Fields;
use DateTimeImmutable;

/** /payments (API.md §6.8, FEATURES B6). Money users only; restore is admin-only. */
final class PaymentsController
{
    public const QUERY = ['status', 'kind', 'category', 'vendor', 'event', 'month', 'q', 'sort', 'limit', 'cursor'];

    public static function canWrite(): callable
    {
        return static fn (?array $v, string $action, ?array $row) => Permissions::requireMoney($v);
    }

    /* ------------------------------------------------------------------ list */

    public static function list(Request $request, App $app, array $params): Response
    {
        Permissions::requireMoney($request->attr('user'));
        $db = $app->db();
        $q = $request->query;
        $today = $app->clock->todayIst();
        $where = ['p.deleted_at IS NULL'];
        $args = [];
        if (isset($q['status'])) {
            $where[] = match ($q['status']) {
                'due' => "p.status = 'due'",
                'paid' => "p.status = 'paid'",
                'overdue' => "p.status = 'due' AND p.due_date < ?",
                'no_date' => "p.status = 'due' AND p.due_date IS NULL",
                default => throw HttpError::make(400, 'bad_request'),
            };
            if ($q['status'] === 'overdue') {
                $args[] = $today;
            }
        }
        if (isset($q['kind'])) {
            $where[] = match ($q['kind']) { 'payment' => 'p.vendor_id IS NOT NULL', 'expense' => 'p.vendor_id IS NULL', default => throw HttpError::make(400, 'bad_request') };
        }
        foreach (['category' => ['budget_categories', 'category_id'], 'vendor' => ['vendors', 'vendor_id'], 'event' => ['events', 'event_id']] as $k => [$table, $col]) {
            if (isset($q[$k])) {
                $id = $db->value("SELECT id FROM `$table` WHERE public_id = ?", [(string) $q[$k]]);
                if ($id === null) {
                    throw HttpError::make(404, 'not_found');
                }
                $where[] = "p.$col = ?";
                $args[] = (int) $id;
            }
        }
        if (isset($q['month'])) {
            if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', (string) $q['month'])) {
                throw HttpError::make(400, 'bad_request');
            }
            $where[] = 'COALESCE(p.paid_on, p.due_date) >= ? AND COALESCE(p.paid_on, p.due_date) < ?';
            $first = $q['month'] . '-01';
            array_push($args, $first, (new DateTimeImmutable($first))->modify('+1 month')->format('Y-m-d'));
        }
        if (($q['q'] ?? '') !== '') {
            $like = '%' . addcslashes(mb_substr(trim((string) $q['q']), 0, 100), '%_\\') . '%';
            $where[] = '(p.title LIKE ? OR v.name LIKE ? OR p.reference LIKE ?)';
            array_push($args, $like, $like, $like);
        }
        $sorts = [
            'due_date' => "p.status = 'paid', p.due_date IS NULL, p.due_date, p.paid_on DESC, p.id DESC",
            '-paid_on' => 'p.paid_on IS NULL, p.paid_on DESC, p.id DESC',
            '-amount_paise' => 'p.amount_paise DESC, p.id DESC',
        ];
        $sort = $q['sort'] ?? 'due_date';
        if (!isset($sorts[$sort])) {
            throw HttpError::make(400, 'bad_request');
        }
        $cursor = new Cursor('payments', array_diff_key($q, ['cursor' => 1, 'limit' => 1]));
        $limit = Cursor::limit($request);
        $offset = $cursor->offset($request);
        $take = $limit + 1;
        $base = 'FROM payments p LEFT JOIN vendors v ON v.id = p.vendor_id WHERE ' . implode(' AND ', $where);
        $rows = $db->all("SELECT p.* $base ORDER BY {$sorts[$sort]} LIMIT $take OFFSET $offset", $args);
        [$rows, $meta] = $cursor->pageOffset($rows, $limit, $offset);
        $t = $db->one("SELECT COUNT(*) AS n, COALESCE(SUM(p.amount_paise), 0) AS total,
                              COALESCE(SUM(CASE WHEN p.status = 'due' THEN p.amount_paise END), 0) AS due,
                              COALESCE(SUM(CASE WHEN p.status = 'paid' THEN p.amount_paise END), 0) AS paid $base", $args) ?? [];
        $meta['total'] = (int) ($t['n'] ?? 0);
        $meta['totals'] = ['amount_paise' => (int) ($t['total'] ?? 0), 'due_paise' => (int) ($t['due'] ?? 0), 'paid_paise' => (int) ($t['paid'] ?? 0)];
        $refs = PaymentDef::refs($db, $rows);
        return Response::ok(array_map(static fn ($r) => PaymentDef::view($r, $refs, $today), $rows), 200, $meta);
    }

    public static function get(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireMoney($viewer);
        $db = $app->db();
        $row = BaseRepository::find($db, PaymentDef::class, $params['id'], false, false);
        $view = PaymentDef::present($app, $db, new Refs($db, $app->clock->todayIst()), $row, $viewer);
        return Response::ok($view)->withHeader('ETag', '"' . $view['version'] . '"');
    }

    /* ---------------------------------------------------------------- create */

    /** POST /payments — optional new_vendor created in the same transaction; duplicate check; R3 category lock. */
    public static function create(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireMoney($viewer);
        $f = Fields::from($request->attr('json'));
        $newVendor = $f->value('new_vendor');
        if ($newVendor !== null && $f->value('vendor_id') !== null) {
            $f->error('vendor_id', Strings::get('vendor_or_new'));
        }
        if ($newVendor !== null && (!is_array($newVendor) || !is_string($newVendor['name'] ?? null) || trim($newVendor['name']) === '')) {
            $f->error('new_vendor', Strings::get('field_required'));
        }
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $viewer, $f, $newVendor): Response {
            $key = (string) $request->attr('idem_key');
            if ($key !== '' && ($old = $db->one('SELECT * FROM payments WHERE client_uuid = ?', [$key])) !== null) {
                return self::reply($app, $db, $old, $viewer, 200);
            }
            $values = PaymentDef::input($app, $f, true, null);
            $f->fail();
            if (is_array($newVendor)) {
                $vf = Fields::from(array_intersect_key($newVendor, array_flip(['name', 'category', 'phone'])) + ['allow_duplicate' => true]);
                $vendor = VendorDef::input($app, $vf, true, null);
                $vf->fail();
                $values['vendor_id'] = (int) self::insertVendor($app, $db, $request, $vendor)['id'];
            }
            if (!isset($values['category_id'])) { // the vendor's last used category, else Miscellaneous
                $values['category_id'] = (int) ($db->value(
                    'SELECT p.category_id FROM payments p JOIN budget_categories c ON c.id = p.category_id AND c.deleted_at IS NULL
                     WHERE p.vendor_id = ? AND p.deleted_at IS NULL ORDER BY p.id DESC LIMIT 1', [$values['vendor_id'] ?? 0])
                    ?? $db->value('SELECT id FROM budget_categories WHERE is_fallback = 1 LOCK IN SHARE MODE'));
            }
            if (($values['vendor_id'] ?? null) !== null && ($f->value('allow_duplicate') ?? false) !== true) {
                self::assertNotDuplicate($app, $db, $values);
            }
            $r = BaseRepository::create($app, $db, $request, PaymentDef::class, $values);
            return self::reply($app, $db, $r['row'], $viewer, 201);
        });
    }

    /** Same vendor + same amount + a date within 2 days → 409 (AC-MON-08). */
    private static function assertNotDuplicate(App $app, Db $db, array $v): void
    {
        $date = $v['paid_on'] ?? $v['due_date'] ?? $app->clock->todayIst();
        $from = (new DateTimeImmutable($date))->modify('-2 days')->format('Y-m-d');
        $to = (new DateTimeImmutable($date))->modify('+2 days')->format('Y-m-d');
        $dup = $db->one(
            'SELECT public_id, title, amount_paise, COALESCE(paid_on, due_date, DATE(created_at)) AS d FROM payments
             WHERE deleted_at IS NULL AND vendor_id = ? AND amount_paise = ? AND COALESCE(paid_on, due_date, DATE(created_at)) BETWEEN ? AND ? LIMIT 1',
            [$v['vendor_id'], $v['amount_paise'], $from, $to],
        );
        if ($dup !== null) {
            throw new HttpError(409, 'duplicate_found', Strings::get('payment_duplicate', [
                'title' => $dup['title'], 'amount' => PaymentDef::amountOn((int) $dup['amount_paise'], null), 'date' => (new DateTimeImmutable($dup['d']))->format('j M'),
            ]), ['matches' => [['id' => $dup['public_id'], 'name' => $dup['title'], 'match_on' => 'same_vendor_amount']]]);
        }
    }

    private static function insertVendor(App $app, Db $db, Request $request, array $values): array
    {
        $user = $request->attr('user');
        $now = $app->clock->dbNow();
        $values += ['public_id' => Ulid::generate($app->clock), 'version' => 1, 'created_at' => $now, 'created_by' => $user['id'], 'updated_at' => $now, 'updated_by' => $user['id']];
        $cols = array_keys($values);
        $db->run('INSERT INTO vendors (`' . implode('`, `', $cols) . '`) VALUES (' . implode(', ', array_fill(0, count($cols), '?')) . ')', array_values($values));
        $row = $db->one('SELECT * FROM vendors WHERE id = ?', [(int) $db->pdo->lastInsertId()]);
        AuditLog::record($app, $db, $request, ['action' => 'create', 'entity_type' => 'vendor', 'entity_id' => (int) $row['id'], 'entity_version' => 1, 'after' => $row]);
        return $row;
    }

    /* --------------------------------------------------------------- actions */

    /** POST /payments/{id}/mark-paid — If-Match; one batch so the Undo bar can reverse it. */
    public static function markPaid(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireMoney($viewer);
        $expected = Versioned::ifMatch($request);
        $f = Fields::from($request->attr('json'));
        $f->only(['paid_on', 'method', 'paid_by', 'reference']);
        $paid = self::paidDetails($app, $f);
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $params, $viewer, $expected, $paid): Response {
            $row = BaseRepository::find($db, PaymentDef::class, $params['id'], true);
            if ($row['deleted_at'] === null && $row['status'] === 'paid') { // a second tap with a new key (the same key is a replay)
                throw new HttpError(422, 'rule_blocked', Strings::get('already_paid'), ['rule' => 'already_paid']);
            }
            $refs = new Refs($db, $app->clock->todayIst());
            $present = static fn (array $x) => PaymentDef::present($app, $db, $refs, $x, $viewer);
            $batch = ChangeBatches::create($app, $db, $request, 'status_change', 'payment', mb_substr("Paid: {$row['title']}", 0, 200));
            $r = Versioned::update($app, $db, $request, 'payments', 'payment', (int) $row['id'], $expected, ['status' => 'paid'] + $paid, $present);
            AuditLog::record($app, $db, $request, [
                'action' => 'update', 'entity_type' => 'payment', 'entity_id' => (int) $row['id'], 'entity_version' => (int) $r['after']['version'],
                'batch_id' => $batch['id'], 'before' => $r['before'], 'after' => $r['after'],
            ]);
            ChangeBatches::setCount($db, $batch['id'], 1);
            $summary = 'Marked paid: ' . $row['title'] . ' · ' . PaymentDef::amountOn((int) $row['amount_paise'], null);
            return self::reply($app, $db, $r['after'], $viewer, 200, ['undo' => BaseController::undoMeta($app, $batch['public_id'], $summary)]);
        });
    }

    /** POST /payments/{id}/pay-part — new Paid row + the Due row reduced, ONE batch, one Undo (AC-MON-04). */
    public static function payPart(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireMoney($viewer);
        $expected = Versioned::ifMatch($request);
        $f = Fields::from($request->attr('json'));
        $f->only(['amount_paise', 'paid_on', 'method', 'paid_by', 'reference']);
        $amount = $f->value('amount_paise');
        if (!is_int($amount) || $amount < 1) {
            $f->error('amount_paise', Strings::get('field_bad_amount'));
        }
        $paid = self::paidDetails($app, $f);
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $params, $viewer, $expected, $paid, $amount): Response {
            $row = BaseRepository::find($db, PaymentDef::class, $params['id'], true);
            $refs = new Refs($db, $app->clock->todayIst());
            $present = static fn (array $x) => PaymentDef::present($app, $db, $refs, $x, $viewer);
            if ($row['deleted_at'] !== null) {
                throw Versioned::deletedError($app, $db, $request, $row);
            }
            if ((int) $row['version'] !== $expected) {
                throw Versioned::conflictError($app, $db, 'payment', $row, $expected, $present);
            }
            if ($row['status'] !== 'due') {
                throw new HttpError(422, 'rule_blocked', Strings::get('already_paid'), ['rule' => 'already_paid']);
            }
            if ($amount >= (int) $row['amount_paise']) {
                $msg = Strings::get('part_too_big', ['amount' => PaymentDef::amountOn((int) $row['amount_paise'], null)]);
                throw new HttpError(422, 'validation_failed', $msg, ['fields' => ['amount_paise' => $msg]]);
            }
            $batch = ChangeBatches::create($app, $db, $request, 'pay_part', 'payment', mb_substr("Part paid: {$row['title']}", 0, 200));
            $user = $request->attr('user');
            $now = $app->clock->dbNow();
            $new = array_intersect_key($row, array_flip(['title', 'vendor_id', 'category_id', 'event_id', 'notes'])) + $paid + [
                'public_id' => Ulid::generate($app->clock), 'amount_paise' => $amount, 'status' => 'paid', 'split_from_payment_id' => $row['id'],
                'version' => 1, 'created_at' => $now, 'created_by' => $user['id'], 'updated_at' => $now, 'updated_by' => $user['id'],
            ];
            $cols = array_keys($new);
            $db->run('INSERT INTO payments (`' . implode('`, `', $cols) . '`) VALUES (' . implode(', ', array_fill(0, count($cols), '?')) . ')', array_values($new));
            $paidRow = $db->one('SELECT * FROM payments WHERE id = ?', [(int) $db->pdo->lastInsertId()]);
            AuditLog::record($app, $db, $request, ['action' => 'create', 'entity_type' => 'payment', 'entity_id' => (int) $paidRow['id'], 'entity_version' => 1,
                'batch_id' => $batch['id'], 'after' => $paidRow, 'note' => 'Part payment']);
            $r = Versioned::update($app, $db, $request, 'payments', 'payment', (int) $row['id'], $expected, ['amount_paise' => (int) $row['amount_paise'] - $amount], $present);
            AuditLog::record($app, $db, $request, ['action' => 'update', 'entity_type' => 'payment', 'entity_id' => (int) $row['id'],
                'entity_version' => (int) $r['after']['version'], 'batch_id' => $batch['id'], 'before' => $r['before'], 'after' => $r['after']]);
            ChangeBatches::setCount($db, $batch['id'], 2);
            $today = $app->clock->todayIst();
            $names = PaymentDef::refs($db, [$paidRow, $r['after']]);
            $summary = 'Part paid: ' . PaymentDef::amountOn($amount, null) . ' of ' . $row['title'];
            return Response::ok(['paid' => PaymentDef::view($paidRow, $names, $today), 'due' => PaymentDef::view($r['after'], $names, $today)], 200,
                ['undo' => BaseController::undoMeta($app, $batch['public_id'], $summary)]);
        });
    }

    /** paid_on (≤ today IST) + method required; paid_by, reference optional. */
    private static function paidDetails(App $app, Fields $f): array
    {
        $out = ['paid_on' => $f->date('paid_on', true), 'method' => $f->enum('method', array_keys(PaymentDef::METHODS), true),
            'paid_by' => $f->text('paid_by', 60), 'reference' => $f->text('reference', 60)];
        if ($out['paid_on'] !== null && $out['paid_on'] > $app->clock->todayIst()) {
            $f->error('paid_on', Strings::get('paid_in_future'));
        }
        $f->fail();
        return $out;
    }

    private static function reply(App $app, Db $db, array $row, ?array $viewer, int $status, array $meta = []): Response
    {
        $view = PaymentDef::present($app, $db, new Refs($db, $app->clock->todayIst()), $row, $viewer);
        return Response::ok($view, $status, $meta)->withHeader('ETag', '"' . $view['version'] . '"');
    }
}
