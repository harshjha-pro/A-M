<?php
declare(strict_types=1);

namespace AM\Modules\Guests;

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
use AM\Modules\Events\InvitationDef;
use AM\Repo\BaseRepository;
use AM\Repo\Refs;
use AM\Repo\Versioned;
use AM\Safety\AuditLog;
use AM\Safety\ChangeBatches;
use AM\Validation\Fields;

/** /households/{id}/invitations/{event_id} — invite, RSVP, remove, WhatsApp tap (API.md §6.7). */
final class InvitationsController
{
    /** PUT — invite (create or revive). Already invited → 200 unchanged, no Undo. */
    public static function put(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireEditor($viewer);
        $f = Fields::from($request->attr('json') ?? []);
        $f->only(['expected_adults', 'expected_children']);
        $expected = self::expected($f);
        $f->fail();
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $params, $expected): Response {
            [$family, $event] = self::pair($db, $params, true);
            if (!(int) $event['guests_invited']) {
                $msg = Strings::get('event_no_guests');
                throw new HttpError(422, 'validation_failed', $msg, ['fields' => ['event_id' => $msg]]);
            }
            $old = $db->one('SELECT deleted_at FROM household_events WHERE household_id = ? AND event_id = ?', [$family['id'], $event['id']]);
            if ($old !== null && $old['deleted_at'] === null) {
                $row = $db->one('SELECT * FROM household_events WHERE household_id = ? AND event_id = ?', [$family['id'], $event['id']]);
                return self::reply($db, $app, $row, $family);
            }
            $summary = mb_substr("Invited {$family['name']} to {$event['name']}", 0, 200);
            $batch = ChangeBatches::create($app, $db, $request, 'bulk_update', 'invitation', $summary);
            $r = Invitations::invite($app, $db, $request, $family, $event, $expected, $batch['id'], true);
            ChangeBatches::setCount($db, $batch['id'], 1);
            return self::reply($db, $app, $r['row'], $family, $r['status'] === 'created' ? 201 : 200, ['undo' => BaseController::undoMeta($app, $batch['public_id'], $summary)]);
        });
    }

    /** PATCH — RSVP and expected counts; If-Match is the invitation's version. */
    public static function patch(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireEditor($viewer);
        $version = Versioned::ifMatch($request);
        $f = Fields::from($request->attr('json'));
        $f->only(['rsvp', 'expected_adults', 'expected_children', 'rsvp_note']);
        if ($f->keys() === []) {
            throw HttpError::make(422, 'validation_failed', [], ['fields' => []]);
        }
        $changes = self::expected($f);
        if ($f->has('rsvp')) {
            $changes['rsvp'] = $f->enum('rsvp', array_keys(InvitationDef::RSVP), true);
        }
        if ($f->has('rsvp_note')) {
            $changes['rsvp_note'] = $f->text('rsvp_note', 200);
        }
        $f->fail();
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $params, $version, $changes, $viewer): Response {
            [$family, , $inv] = self::pair($db, $params, false, true); // removed meanwhile → 409 record_deleted below
            $refs = new Refs($db, $app->clock->todayIst());
            if (isset($changes['rsvp']) && $changes['rsvp'] !== $inv['rsvp']) {
                $changes['rsvp_updated_at'] = $app->clock->dbNow();
                $changes['rsvp_updated_by'] = $viewer['id'];
            }
            $present = static fn (array $x) => InvitationDef::view($refs, $x, $family);
            $r = Versioned::update($app, $db, $request, 'household_events', 'invitation', (int) $inv['id'], $version, $changes, $present);
            if ($r['changed'] !== []) {
                AuditLog::record($app, $db, $request, [
                    'action' => 'update', 'entity_type' => 'invitation', 'entity_id' => (int) $inv['id'],
                    'entity_version' => (int) $r['after']['version'], 'before' => $r['before'], 'after' => $r['after'],
                ]);
            }
            return self::reply($db, $app, $r['after'], $family);
        });
    }

    /** DELETE — remove from the event: soft, with Undo, no confirm. */
    public static function delete(Request $request, App $app, array $params): Response
    {
        Permissions::requireEditor($request->attr('user'));
        $version = Versioned::ifMatch($request);
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $params, $version): Response {
            [$family, $event, $inv] = self::pair($db, $params, false, true);
            if ($inv['deleted_at'] !== null) {
                throw Versioned::deletedError($app, $db, $request, $inv);
            }
            if ((int) $inv['version'] !== $version) {
                $refs = new Refs($db, $app->clock->todayIst());
                throw Versioned::conflictError($app, $db, 'invitation', $inv, $version, static fn ($x) => InvitationDef::view($refs, $x, $family));
            }
            $batch = BaseRepository::softDelete($app, $db, $request, InvitationDef::class, $inv);
            $summary = "Removed {$family['name']} from {$event['name']}";
            $db->run('UPDATE change_batches SET summary = ? WHERE id = ?', [mb_substr($summary, 0, 200), $batch['id']]);
            return Response::ok(new \stdClass(), 200, ['undo' => BaseController::undoMeta($app, $batch['public_id'], $summary)]);
        });
    }

    /** POST …/whatsapp-opened — bookkeeping only: no version bump, updated_at kept (DATABASE rule 11). Never means "sent". */
    public static function whatsappOpened(Request $request, App $app, array $params): Response
    {
        Permissions::requireEditor($request->attr('user'));
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $params): Response {
            [, , $inv] = self::pair($db, $params, false);
            $now = $app->clock->dbNow();
            $db->run('UPDATE household_events SET last_reminder_opened_at = ?, updated_at = updated_at WHERE id = ?', [$now, $inv['id']]);
            AuditLog::record($app, $db, $request, [
                'action' => 'whatsapp_opened', 'entity_type' => 'invitation', 'entity_id' => (int) $inv['id'],
                'entity_version' => (int) $inv['version'], 'after' => ['household_id' => $inv['household_id'], 'event_id' => $inv['event_id']],
            ]);
            return Response::ok(['last_reminder_opened_at' => Time::iso($now)]);
        });
    }

    /** @return array<string, ?int> */
    private static function expected(Fields $f): array
    {
        $out = [];
        foreach (['expected_adults', 'expected_children'] as $k) {
            if ($f->has($k)) {
                $out[$k] = $f->value($k) === null ? null : HouseholdDef::int($f, $k, 0, 50);
            }
        }
        return $out;
    }

    /**
     * Live family + live event (+ the invitation, locked).
     * @return array{0: array, 1: array, 2: ?array}
     */
    private static function pair(Db $db, array $params, bool $forInvite, bool $includeDeletedInvitation = false): array
    {
        $family = BaseRepository::find($db, HouseholdDef::class, $params['id'], true, false);
        $event = $db->one('SELECT * FROM events WHERE public_id = ? AND deleted_at IS NULL', [$params['event_id']]);
        if ($event === null) {
            throw HttpError::make(404, 'not_found');
        }
        if ($forInvite) {
            return [$family, $event, null];
        }
        $inv = $db->one('SELECT * FROM household_events WHERE household_id = ? AND event_id = ? FOR UPDATE', [$family['id'], $event['id']]);
        if ($inv === null || ($inv['deleted_at'] !== null && !$includeDeletedInvitation)) {
            throw HttpError::make(404, 'not_found');
        }
        return [$family, $event, $inv];
    }

    private static function reply(Db $db, App $app, array $row, array $family, int $status = 200, array $meta = []): Response
    {
        $view = InvitationDef::view(new Refs($db, $app->clock->todayIst()), $row, $family);
        return Response::ok($view, $status, $meta)->withHeader('ETag', '"' . $view['version'] . '"');
    }
}
