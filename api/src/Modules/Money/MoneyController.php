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
use AM\Repo\BaseRepository;
use AM\Repo\Refs;
use AM\Repo\Versioned;
use AM\Safety\AuditLog;
use AM\Safety\ChangeBatches;

/** /money/summary and /budget-categories (API.md §6.8, DATABASE §7.5). Money users only. */
final class MoneyController
{
    /** GET /money/summary — totals card + per-category table. */
    public static function summary(Request $request, App $app, array $params): Response
    {
        Permissions::requireMoney($request->attr('user'));
        return Response::ok(self::totals($app->db()));
    }

    /** The totals card + categories (also used by the export's summary.html, inside its snapshot). */
    public static function totals(Db $db): array
    {
        $cats = self::categoryRows($db);
        $s = $db->one(
            "SELECT s.total_budget_paise AS total,
                    (SELECT COALESCE(SUM(planned_paise), 0) FROM budget_categories WHERE deleted_at IS NULL) AS split,
                    (SELECT COALESCE(SUM(amount_paise), 0) FROM payments WHERE deleted_at IS NULL AND status = 'paid') AS spent,
                    (SELECT COALESCE(SUM(amount_paise), 0) FROM payments WHERE deleted_at IS NULL AND status = 'due') AS due
             FROM settings s WHERE s.id = 1",
        ) ?? [];
        $split = (int) ($s['split'] ?? 0);
        $planned = $s['total'] !== null ? (int) $s['total'] : $split; // the total budget from Settings if set, else Σ planned
        $spent = (int) ($s['spent'] ?? 0);
        $due = (int) ($s['due'] ?? 0);
        return [
            'planned_paise' => $planned,
            'spent_paise' => $spent,
            'still_to_pay_paise' => $due,
            'left_paise' => $planned - $spent,
            'free_paise' => $planned - $spent - $due,
            'not_yet_split_paise' => $s['total'] !== null ? max(0, $planned - $split) : 0,
            'total_budget_set' => $s['total'] !== null,
            'categories' => $cats,
        ];
    }

    /** DATABASE §7.5: live categories, plus a deleted one while it still holds live money (fix R3). */
    private static function categoryRows(Db $db): array
    {
        $rows = $db->all(
            "SELECT c.*, COALESCE(SUM(CASE WHEN p.status = 'paid' THEN p.amount_paise END), 0) AS spent,
                    COALESCE(SUM(CASE WHEN p.status = 'due' THEN p.amount_paise END), 0) AS due
             FROM budget_categories c LEFT JOIN payments p ON p.category_id = c.id AND p.deleted_at IS NULL
             WHERE c.deleted_at IS NULL OR p.id IS NOT NULL
             GROUP BY c.id ORDER BY c.sort_order, c.id",
        );
        return array_map(static function ($r) {
            $v = BudgetCategoryDef::view($r, (int) $r['spent'], (int) $r['due']);
            if ($v['deleted']) {
                $v['name'] .= ' (deleted)';
            }
            return $v;
        }, $rows);
    }

    /** GET /budget-categories */
    public static function categories(Request $request, App $app, array $params): Response
    {
        Permissions::requireMoney($request->attr('user'));
        $cats = self::categoryRows($app->db());
        return Response::ok($cats, 200, ['total' => count($cats)]);
    }

    /**
     * DELETE /budget-categories/{id} (admins). With payments: needs move_payments_to;
     * moves and deletes in ONE batch, so one Undo puts both back (AC-MON-07, DS-11).
     */
    public static function deleteCategory(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireAdmin($viewer);
        Permissions::requireMoney($viewer);
        $expected = Versioned::ifMatch($request);
        $body = $request->attr('json');
        $target = is_array($body) && is_string($body['move_payments_to'] ?? null) ? $body['move_payments_to'] : null;
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $params, $viewer, $expected, $target): Response {
            $row = BaseRepository::find($db, BudgetCategoryDef::class, $params['id'], true); // FOR UPDATE: a payment saved now waits (R3)
            if ($row['deleted_at'] !== null) {
                throw Versioned::deletedError($app, $db, $request, $row);
            }
            $refs = new Refs($db, $app->clock->todayIst());
            if ((int) $row['version'] !== $expected) {
                throw Versioned::conflictError($app, $db, 'budget_category', $row, $expected, static fn ($x) => BudgetCategoryDef::present($app, $db, $refs, $x, $viewer));
            }
            if ((int) $row['is_fallback']) {
                throw new HttpError(422, 'rule_blocked', Strings::get('fallback_category'), ['rule' => 'fallback_category']);
            }
            $payments = $db->all('SELECT * FROM payments WHERE category_id = ? AND deleted_at IS NULL FOR UPDATE', [$row['id']]);
            $to = null;
            if ($payments !== []) {
                if ($target === null) {
                    throw new HttpError(422, 'rule_blocked', Strings::get('category_has_payments', ['n' => count($payments)]), ['rule' => 'category_has_payments', 'count' => count($payments)]);
                }
                $to = $db->one('SELECT * FROM budget_categories WHERE public_id = ? AND deleted_at IS NULL FOR UPDATE', [$target]);
                if ($to === null || (int) $to['id'] === (int) $row['id']) {
                    throw new HttpError(422, 'validation_failed', Strings::get('move_target_bad'), ['fields' => ['move_payments_to' => Strings::get('move_target_bad')]]);
                }
            }
            $summary = $row['name'] . ($payments !== [] ? ' · ' . count($payments) . " payments moved to {$to['name']}" : '');
            $batch = ChangeBatches::create($app, $db, $request, 'delete', 'budget_category', mb_substr($summary, 0, 200));
            $user = $request->attr('user');
            foreach ($payments as $p) {
                $db->run('UPDATE payments SET category_id = ?, version = version + 1, updated_at = ?, updated_by = ? WHERE id = ?',
                    [$to['id'], $app->clock->dbNow(), $user['id'], $p['id']]);
                $after = $db->one('SELECT * FROM payments WHERE id = ?', [$p['id']]);
                AuditLog::record($app, $db, $request, [
                    'action' => 'update', 'entity_type' => 'payment', 'entity_id' => (int) $p['id'], 'entity_version' => (int) $after['version'],
                    'batch_id' => $batch['id'], 'before' => $p, 'after' => $after,
                ]);
            }
            $n = BaseRepository::softDeleteInBatch($app, $db, $request, BudgetCategoryDef::class, $row, $batch['id']);
            ChangeBatches::setCount($db, $batch['id'], $n + count($payments));
            return Response::ok(['moved' => count($payments)], 200, ['undo' => BaseController::undoMeta($app, $batch['public_id'], "Deleted $summary")]);
        });
    }
}
