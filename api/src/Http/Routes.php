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
use AM\Modules\Events\CalendarController;
use AM\Modules\Events\EventDef;
use AM\Modules\Events\EventsController;
use AM\Modules\Health\HealthController;
use AM\Modules\Members\MembersController;
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

        // Home (Session 7)
        $r->add('GET', '/dashboard', DashboardController::show(...), ['query' => ['payments_window_days']]);

        return $r;
    }
}
