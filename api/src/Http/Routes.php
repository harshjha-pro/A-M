<?php
declare(strict_types=1);

namespace AM\Http;

use AM\Auth\Permissions;
use AM\Kernel\App;
use AM\Kernel\Request;
use AM\Kernel\Router;
use AM\Modules\Auth\AuthController;
use AM\Modules\ClientLog\ClientLogController;
use AM\Modules\Dashboard\DashboardController;
use AM\Modules\Documents\DocumentDef;
use AM\Modules\Documents\DocumentsController;
use AM\Modules\Events\CalendarController;
use AM\Modules\Exports\ExportsController;
use AM\Modules\Events\EventDef;
use AM\Modules\Events\EventsController;
use AM\Modules\Guests\BulkController;
use AM\Modules\Guests\GuestCsv;
use AM\Modules\Guests\HouseholdDef;
use AM\Modules\Guests\HouseholdsController;
use AM\Modules\Guests\ImportsController;
use AM\Modules\Guests\InvitationsController;
use AM\Modules\Health\HealthController;
use AM\Modules\Members\MembersController;
use AM\Modules\Money\BudgetCategoryDef;
use AM\Modules\Money\MoneyController;
use AM\Modules\Money\PaymentDef;
use AM\Modules\Money\PaymentsController;
use AM\Modules\Money\VendorDef;
use AM\Modules\Money\VendorsController;
use AM\Modules\Settings\SettingsController;
use AM\Modules\History\HistoryController;
use AM\Modules\Safety\RestoreDrillDef;
use AM\Modules\Safety\SafetyController;
use AM\Modules\Setup\SetupController;
use AM\Modules\Trash\TrashController;
use AM\Modules\Undo\UndoController;
use AM\Modules\Tasks\TagDef;
use AM\Modules\Tasks\TaskDef;
use AM\Modules\Tasks\TaskItemsController;
use AM\Modules\Tasks\TasksController;

/**
 * Every API operation. Each one must also be in docs/openapi.yaml and have at
 * least one test (EndpointCoverageTest).
 *
 * Options: anon (no session needed) · origin_check (anonymous write that still
 * needs our Origin: login, setup, links) · idempotent (default true for
 * logged-in writes) · query (allowed query parameters) · on_replay.
 */
final class Routes
{
    public static function build(): Router
    {
        $r = new Router();

        // Health and phone-side error reports (Session 1)
        $r->add('GET', '/health', HealthController::show(...), ['anon' => true]);
        $r->add('POST', '/client-log', ClientLogController::store(...), [
            'anon' => true,
            'idempotent' => false,          // a duplicate log line is harmless (TESTING §9.3)
            'max_body' => 16 * 1024,
            'maintenance_exempt' => true,   // never touches app tables
            'client_version_exempt' => true, // an old app's crash reports are the most useful ones
        ]);

        // Log in and sessions (API.md §3). No Idempotency-Key: no session yet, or naturally safe (§5.3).
        $authAnon = ['anon' => true, 'origin_check' => true, 'idempotent' => false];
        $r->add('POST', '/auth/login', AuthController::login(...), $authAnon);
        $r->add('POST', '/auth/logout', AuthController::logout(...), ['idempotent' => false]);
        $r->add('POST', '/auth/logout-all', AuthController::logoutAll(...), ['idempotent' => false]);
        $r->add('GET', '/session', AuthController::session(...));
        $r->add('POST', '/auth/password/change', AuthController::changePassword(...));
        $r->add('POST', '/auth/password-reset/request', AuthController::resetRequest(...), $authAnon);
        $r->add('POST', '/auth/password-link/inspect', AuthController::linkInspect(...), $authAnon);
        $r->add('POST', '/auth/password-link/complete', AuthController::linkComplete(...), $authAnon);
        $r->add('POST', '/setup/owner', SetupController::owner(...), $authAnon);

        // Members (API.md §6.2)
        $r->add('GET', '/members', MembersController::list(...), ['query' => ['include_inactive']]);
        $r->add('POST', '/members', MembersController::create(...), ['on_replay' => MembersController::createReplay(...)]);
        $r->add('GET', '/members/{id}', MembersController::get(...));
        $r->add('PATCH', '/members/{id}', MembersController::update(...));
        $r->add('POST', '/members/{id}/password-reset', MembersController::resetPassword(...), ['on_replay' => MembersController::resetReplay(...)]);
        $r->add('GET', '/me/sessions', MembersController::mySessions(...));

        // Wedding settings (API.md §6.3)
        $r->add('GET', '/settings', SettingsController::get(...));
        $r->add('PATCH', '/settings', SettingsController::update(...));
        $r->add('GET', '/settings/history', SettingsController::history(...), ['query' => ['cursor', 'limit']]);

        // Data safety (Session 3): restore drills, undo, Deleted items, history, activity, backups
        BaseController::register($r, RestoreDrillDef::class, ...BaseController::adminOnly());
        $r->add('GET', '/backups', SafetyController::backups(...), ['query' => ['limit']]);
        $r->add('POST', '/undo/{batch_id}', UndoController::undo(...));
        $page = ['cursor', 'limit'];
        $r->add('GET', '/trash', TrashController::list(...), ['query' => ['type', 'user', 'from', 'to', ...$page]]);
        $r->add('GET', '/trash/{batch_id}', TrashController::get(...));
        $r->add('DELETE', '/trash/{batch_id}', TrashController::purge(...));
        $r->add('POST', '/trash/{batch_id}/restore', TrashController::restore(...));
        $r->add('GET', '/{resource}/{id}/history', HistoryController::record(...), ['query' => $page]);
        $r->add('GET', '/activity', HistoryController::activity(...), ['query' => ['user', 'type', 'action', 'from', 'to', ...$page]]);

        // Tasks and tags (Session 5): the first module on the shared base code
        $r->add('GET', '/tasks', TasksController::list(...), ['query' => TasksController::QUERY]);
        $r->add('POST', '/tasks', TasksController::create(...));
        $r->add('GET', '/tasks/{id}', TasksController::get(...));
        $r->add('PATCH', '/tasks/{id}', TasksController::update(...));
        $r->add('DELETE', '/tasks/{id}', static fn (Request $q, App $a, array $p) => BaseController::delete($q, $a, $p, TaskDef::class, TasksController::canWrite($a)));
        $r->add('POST', '/tasks/{id}/restore', static fn (Request $q, App $a, array $p) => BaseController::restore($q, $a, $p, TaskDef::class));
        $r->add('POST', '/tasks/{id}/done', TasksController::done(...));
        $r->add('POST', '/tasks/{id}/items', TaskItemsController::add(...));
        $r->add('PATCH', '/tasks/{id}/items/{key}', TaskItemsController::update(...));
        $r->add('DELETE', '/tasks/{id}/items/{key}', TaskItemsController::delete(...));
        BaseController::register(
            $r,
            TagDef::class,
            static fn (?array $v) => null,                               // everyone reads tags
            static fn (?array $v, string $action, ?array $row) => TagDef::canWrite($v, $action),
        );

        // Events and calendar (Session 6). Reads for everyone; writes for admins, through the shared base code.
        $evAdmin = static fn (?array $v, string $action, ?array $row) => Permissions::requireAdmin($v);
        $r->add('GET', '/calendar', CalendarController::show(...), ['query' => CalendarController::QUERY]);
        $r->add('GET', '/events', EventsController::list(...), ['query' => ['guests_invited']]);
        $r->add('POST', '/events', static fn (Request $q, App $a, array $p) => BaseController::create($q, $a, EventDef::class, $evAdmin));
        $r->add('GET', '/events/{id}', EventsController::get(...));
        $r->add('PATCH', '/events/{id}', static fn (Request $q, App $a, array $p) => BaseController::update($q, $a, $p, EventDef::class, $evAdmin));
        $r->add('DELETE', '/events/{id}', static fn (Request $q, App $a, array $p) => BaseController::delete($q, $a, $p, EventDef::class, $evAdmin));
        $r->add('POST', '/events/{id}/restore', static fn (Request $q, App $a, array $p) => BaseController::restore($q, $a, $p, EventDef::class));
        $r->add('GET', '/events/{id}/headcount', EventsController::headcount(...));
        $r->add('GET', '/events/{id}/delete-preview', EventsController::deletePreview(...));

        // Guests and RSVP (Session 8). Fixed paths before /households/{id}.
        $hhWrite = HouseholdsController::canWrite();
        $r->add('GET', '/households', HouseholdsController::list(...), ['query' => HouseholdsController::QUERY]);
        $r->add('POST', '/households', HouseholdsController::create(...));
        $r->add('GET', '/households/duplicate-check', HouseholdsController::duplicateCheck(...), ['query' => ['phone', 'alt_phone', 'name', 'city', 'exclude']]);
        $r->add('GET', '/households/suggestions', HouseholdsController::suggestions(...), ['query' => ['field', 'q']]);
        $r->add('POST', '/households/bulk', BulkController::run(...));
        $r->add('GET', '/households/export', GuestCsv::export(...), ['query' => array_diff(HouseholdsController::QUERY, ['sort', 'limit', 'cursor'])]);
        $r->add('GET', '/households/{id}', HouseholdsController::get(...));
        $r->add('PATCH', '/households/{id}', static fn (Request $q, App $a, array $p) => BaseController::update($q, $a, $p, HouseholdDef::class, $hhWrite));
        $r->add('DELETE', '/households/{id}', static fn (Request $q, App $a, array $p) => BaseController::delete($q, $a, $p, HouseholdDef::class, $hhWrite));
        $r->add('POST', '/households/{id}/restore', static fn (Request $q, App $a, array $p) => BaseController::restore($q, $a, $p, HouseholdDef::class));
        $r->add('PUT', '/households/{id}/invitations/{event_id}', InvitationsController::put(...));
        $r->add('PATCH', '/households/{id}/invitations/{event_id}', InvitationsController::patch(...));
        $r->add('DELETE', '/households/{id}/invitations/{event_id}', InvitationsController::delete(...));
        $r->add('POST', '/households/{id}/invitations/{event_id}/whatsapp-opened', InvitationsController::whatsappOpened(...));

        // Guest import (Session 8b): the phone reads the file and sends rows (≤ 3,000, 5 MB)
        $big = ['max_body' => ImportsController::MAX_BODY];
        $r->add('POST', '/imports/preview', ImportsController::preview(...), $big);
        $r->add('POST', '/imports', ImportsController::run(...), $big);
        $r->add('GET', '/imports', ImportsController::list(...), ['query' => ['cursor', 'limit']]);
        $r->add('GET', '/imports/{id}', ImportsController::get(...));
        $r->add('POST', '/imports/{id}/undo', ImportsController::undo(...));

        // Money (Session 9). Money users only, except vendor contacts (API.md §6.8).
        $money = static fn (?array $v, string $action, ?array $row) => \AM\Auth\Permissions::requireMoney($v);
        $r->add('GET', '/money/summary', MoneyController::summary(...));
        $r->add('GET', '/budget-categories', MoneyController::categories(...));
        $r->add('POST', '/budget-categories', static fn (Request $q, App $a, array $p) => BaseController::create($q, $a, BudgetCategoryDef::class, $money));
        $r->add('PATCH', '/budget-categories/{id}', static fn (Request $q, App $a, array $p) => BaseController::update($q, $a, $p, BudgetCategoryDef::class, $money));
        $r->add('DELETE', '/budget-categories/{id}', MoneyController::deleteCategory(...));
        $r->add('POST', '/budget-categories/{id}/restore', static fn (Request $q, App $a, array $p) => BaseController::restore($q, $a, $p, BudgetCategoryDef::class));
        $r->add('GET', '/vendors', VendorsController::list(...), ['query' => VendorsController::QUERY]);
        $r->add('POST', '/vendors', VendorsController::create(...));
        $r->add('GET', '/vendors/{id}', VendorsController::get(...));
        $r->add('PATCH', '/vendors/{id}', VendorsController::update(...));
        $r->add('DELETE', '/vendors/{id}', static fn (Request $q, App $a, array $p) => BaseController::delete($q, $a, $p, VendorDef::class, VendorsController::canWrite()));
        $r->add('POST', '/vendors/{id}/restore', static fn (Request $q, App $a, array $p) => BaseController::restore($q, $a, $p, VendorDef::class));
        $r->add('GET', '/payments', PaymentsController::list(...), ['query' => PaymentsController::QUERY]);
        $r->add('POST', '/payments', PaymentsController::create(...));
        $r->add('GET', '/payments/{id}', PaymentsController::get(...));
        $r->add('PATCH', '/payments/{id}', static fn (Request $q, App $a, array $p) => BaseController::update($q, $a, $p, PaymentDef::class, PaymentsController::canWrite()));
        $r->add('DELETE', '/payments/{id}', static fn (Request $q, App $a, array $p) => BaseController::delete($q, $a, $p, PaymentDef::class, PaymentsController::canWrite()));
        $r->add('POST', '/payments/{id}/restore', static fn (Request $q, App $a, array $p) => BaseController::restore($q, $a, $p, PaymentDef::class));
        $r->add('POST', '/payments/{id}/mark-paid', PaymentsController::markPaid(...));
        $r->add('POST', '/payments/{id}/pay-part', PaymentsController::payPart(...));

        // Documents and uploads (Session 10). Multipart, one file per request (API.md §8).
        $r->add('GET', '/documents', DocumentsController::list(...), ['query' => DocumentsController::QUERY]);
        $r->add('POST', '/documents', DocumentsController::upload(...), ['max_body' => 16 * 1024 * 1024]);
        $r->add('GET', '/documents/{id}', DocumentsController::get(...));
        $r->add('PATCH', '/documents/{id}', DocumentsController::update(...));
        $r->add('GET', '/documents/{id}/file', DocumentsController::file(...), ['query' => ['download']]);
        $r->add('DELETE', '/documents/{id}', static fn (Request $q, App $a, array $p) => BaseController::delete($q, $a, $p, DocumentDef::class, DocumentsController::canWrite()));
        // Full export (Session 11, API.md §9.1)
        $r->add('POST', '/exports', ExportsController::create(...), ['on_replay' => ExportsController::createReplay(...)]);
        $r->add('GET', '/exports', ExportsController::list(...));
        $r->add('GET', '/exports/{id}', ExportsController::get(...));
        $r->add('GET', '/exports/{id}/download', ExportsController::download(...), ['anon' => true, 'query' => ['part', 't']]);
        $r->add('GET', '/exports/{id}/summary', ExportsController::summary(...), ['anon' => true, 'query' => ['t']]);
        $r->add('POST', '/documents/{id}/restore', static fn (Request $q, App $a, array $p) => BaseController::restore($q, $a, $p, DocumentDef::class));

        // Home (Session 7)
        $r->add('GET', '/dashboard', DashboardController::show(...), ['query' => ['payments_window_days']]);

        return $r;
    }
}
