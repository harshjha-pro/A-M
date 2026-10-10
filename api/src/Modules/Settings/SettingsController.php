<?php
declare(strict_types=1);

namespace AM\Modules\Settings;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Db\UnitOfWork;
use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Kernel\Strings;
use AM\Kernel\Time;
use AM\Repo\Cursor;
use AM\Repo\Refs;
use AM\Repo\Versioned;
use AM\Safety\AuditLog;
use AM\Safety\History;
use AM\Validation\Fields;

/** Wedding facts — one row, never deleted (FEATURES B10, API.md §6.3). */
final class SettingsController
{
    public const LABELS = [
        'bride_name' => "Bride's name",
        'groom_name' => "Groom's name",
        'bride_side_label' => "Bride's side name",
        'groom_side_label' => "Groom's side name",
        'wedding_start_date' => 'Start date',
        'wedding_end_date' => 'End date',
        'city' => 'City',
        'total_budget_paise' => 'Total budget',
    ];
    private const MONEY = ['total_budget_paise'];

    public static function present(Db $db, Refs $refs, array $s, ?array $viewer): array
    {
        $out = [
            'version' => (int) $s['version'],
            'bride_name' => $s['bride_name'],
            'groom_name' => $s['groom_name'],
            'bride_side_label' => $s['bride_side_label'],
            'groom_side_label' => $s['groom_side_label'],
            'wedding_start_date' => $s['wedding_start_date'],
            'wedding_end_date' => $s['wedding_end_date'],
            'city' => $s['city'],
            'total_budget_paise' => $s['total_budget_paise'] === null ? null : (int) $s['total_budget_paise'],
            'timezone' => $s['timezone'],
            'currency' => $s['currency'],
            'setup_completed_at' => Time::iso($s['setup_completed_at']),
            'updated_at' => Time::iso($s['updated_at']),
            'updated_by' => $refs->user($s['updated_by'] !== null ? (int) $s['updated_by'] : null),
        ];
        if (!Permissions::canSeeMoney($viewer)) {
            foreach (self::MONEY as $k) {
                unset($out[$k]); // removed, not nulled (API.md §1.5, TESTING S10)
            }
        }
        return $out;
    }

    /** GET /settings */
    public static function get(Request $request, App $app, array $params): Response
    {
        $db = $app->db();
        $s = $db->one('SELECT * FROM settings WHERE id = 1');
        $view = self::present($db, new Refs($db, $app->clock->todayIst()), $s, $request->attr('user'));
        return Response::ok($view)->withHeader('ETag', '"' . $view['version'] . '"');
    }

    /** PATCH /settings — admins */
    public static function update(Request $request, App $app, array $params): Response
    {
        $user = $request->attr('user');
        Permissions::requireAdmin($user);
        $expected = Versioned::ifMatch($request);
        $json = $request->attr('json');
        if (is_array($json) && array_intersect(array_keys($json), self::MONEY) !== [] && !Permissions::canSeeMoney($user)) {
            throw HttpError::make(403, 'no_money_access'); // SEC-12
        }
        $f = Fields::from($json);
        $f->only(array_keys(self::LABELS));
        if ($f->keys() === []) {
            throw HttpError::make(422, 'validation_failed', [], ['fields' => []]);
        }
        $changes = [];
        foreach (['bride_name' => 80, 'groom_name' => 80, 'bride_side_label' => 40, 'groom_side_label' => 40, 'city' => 60] as $k => $max) {
            if ($f->has($k)) {
                $changes[$k] = $f->text($k, $max, true);
            }
        }
        foreach (['wedding_start_date', 'wedding_end_date'] as $k) {
            if ($f->has($k)) {
                $changes[$k] = $f->date($k, true);
            }
        }
        if ($f->has('total_budget_paise')) {
            $changes['total_budget_paise'] = $f->paise('total_budget_paise');
        }

        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $user, $expected, $f, $changes): Response {
            $refs = new Refs($db, $app->clock->todayIst());
            $current = $db->one('SELECT * FROM settings WHERE id = 1 FOR UPDATE');
            $start = $changes['wedding_start_date'] ?? $current['wedding_start_date'];
            $end = $changes['wedding_end_date'] ?? $current['wedding_end_date'];
            if ($start !== null && $end !== null && $end < $start) {
                $f->error('wedding_end_date', Strings::get('field_end_before_start'));
            }
            $f->fail();
            $present = static fn (array $row) => self::present($db, $refs, $row, $user);
            $r = Versioned::update($app, $db, $request, 'settings', 'settings', 1, $expected, $changes, $present, false);
            if ($r['changed'] !== []) {
                AuditLog::record($app, $db, $request, [
                    'action' => 'update', 'entity_type' => 'settings', 'entity_id' => 1,
                    'entity_version' => (int) $r['after']['version'], 'before' => $r['before'], 'after' => $r['after'],
                ]);
            }
            $view = self::present($db, $refs, $r['after'], $user);
            return Response::ok($view)->withHeader('ETag', '"' . $view['version'] . '"');
        });
    }

    /** GET /settings/history — plain sentences, newest first, cursor paged (API.md §1.4) */
    public static function history(Request $request, App $app, array $params): Response
    {
        $user = $request->attr('user');
        Permissions::requireAdmin($user);
        $cursor = new Cursor('settings');
        $limit = Cursor::limit($request);
        $db = $app->db();
        $refs = new Refs($db, $app->clock->todayIst());
        $rows = $db->all(
            "SELECT a.*, cb.public_id AS batch_public_id FROM audit_log a LEFT JOIN change_batches cb ON cb.id = a.batch_id
             WHERE a.entity_type = 'settings' AND a.id < ? ORDER BY a.id DESC LIMIT " . ($limit + 1),
            [$cursor->before($request)],
        );
        [$rows, $meta] = $cursor->page($rows, $limit);
        $lines = array_map(static function (array $a) use ($refs, $user): array {
            $line = History::line($refs, $a, SettingsDef::class, $user);
            $line['entity'] = ['type' => 'settings', 'id' => null, 'name' => 'Wedding details'];
            return $line;
        }, $rows);
        return Response::ok($lines, 200, $meta);
    }
}
