<?php
declare(strict_types=1);

namespace AM\Http;

use AM\Kernel\Router;
use AM\Modules\Auth\AuthController;
use AM\Modules\ClientLog\ClientLogController;
use AM\Modules\Health\HealthController;
use AM\Modules\Members\MembersController;
use AM\Modules\Settings\SettingsController;
use AM\Modules\Setup\SetupController;

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

        return $r;
    }
}
