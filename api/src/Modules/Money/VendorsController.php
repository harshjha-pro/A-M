<?php
declare(strict_types=1);

namespace AM\Modules\Money;

use AM\Auth\Permissions;
use AM\Http\BaseController;
use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Repo\BaseRepository;
use AM\Repo\Cursor;
use AM\Repo\Refs;

/** /vendors (API.md §6.8): contacts for everyone; amounts and balances only for money users. */
final class VendorsController
{
    public const QUERY = ['q', 'category', 'booked', 'sort', 'limit', 'cursor'];

    public static function list(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        $db = $app->db();
        $q = $request->query;
        $where = ['deleted_at IS NULL'];
        $args = [];
        if (($q['q'] ?? '') !== '') {
            $like = '%' . addcslashes(mb_substr(trim((string) $q['q']), 0, 100), '%_\\') . '%';
            $where[] = '(name LIKE ? OR contact_person LIKE ? OR phone LIKE ?)';
            array_push($args, $like, $like, $like);
        }
        if (isset($q['category'])) {
            if (!array_key_exists($q['category'], VendorDef::CATEGORIES)) {
                throw HttpError::make(400, 'bad_request');
            }
            $where[] = 'category = ?';
            $args[] = $q['category'];
        }
        if (isset($q['booked'])) {
            if (!in_array($q['booked'], ['true', 'false'], true)) {
                throw HttpError::make(400, 'bad_request');
            }
            $where[] = 'is_booked = ' . ($q['booked'] === 'true' ? '1' : '0');
        }
        if (($q['sort'] ?? 'name') !== 'name') {
            throw HttpError::make(400, 'bad_request');
        }
        $cursor = new Cursor('vendors', array_diff_key($q, ['cursor' => 1, 'limit' => 1]));
        $limit = Cursor::limit($request);
        $offset = $cursor->offset($request);
        $take = $limit + 1;
        $base = 'FROM vendors WHERE ' . implode(' AND ', $where);
        $rows = $db->all("SELECT * $base ORDER BY name, id LIMIT $take OFFSET $offset", $args);
        [$rows, $meta] = $cursor->pageOffset($rows, $limit, $offset);
        $meta['total'] = (int) $db->value("SELECT COUNT(*) $base", $args);
        $refs = new Refs($db, $app->clock->todayIst());
        return Response::ok(array_map(static fn ($r) => VendorDef::present($app, $db, $refs, $r, $viewer), $rows), 200, $meta);
    }

    public static function get(Request $request, App $app, array $params): Response
    {
        $db = $app->db();
        $row = BaseRepository::find($db, VendorDef::class, $params['id'], false, false);
        $view = VendorDef::present($app, $db, new Refs($db, $app->clock->todayIst()), $row, $request->attr('user'));
        return Response::ok($view)->withHeader('ETag', '"' . $view['version'] . '"');
    }

    /** Anyone who edits adds and edits vendors; the agreed amount needs money access (SEC-12); delete is admin-only. */
    public static function canWrite(): callable
    {
        return static function (?array $v, string $action, ?array $row): void {
            $action === 'delete' ? Permissions::requireAdmin($v) : Permissions::requireEditor($v);
        };
    }

    public static function create(Request $request, App $app, array $params): Response
    {
        self::guardAmount($request);
        return BaseController::create($request, $app, VendorDef::class, self::canWrite());
    }

    public static function update(Request $request, App $app, array $params): Response
    {
        self::guardAmount($request);
        return BaseController::update($request, $app, $params, VendorDef::class, self::canWrite());
    }

    /** SEC-12: a non-money user sending an amount is refused before anything is written. */
    private static function guardAmount(Request $request): void
    {
        $json = $request->attr('json');
        if (is_array($json) && array_key_exists('agreed_amount_paise', $json)) {
            Permissions::requireEditor($request->attr('user'));
            Permissions::requireMoney($request->attr('user'));
        }
    }
}
