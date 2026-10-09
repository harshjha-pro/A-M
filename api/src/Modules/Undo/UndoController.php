<?php
declare(strict_types=1);

namespace AM\Modules\Undo;

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
use AM\Repo\Entities;
use AM\Safety\ChangeBatches;

/** POST /undo/{batch_id} — the person who acted, within 10 minutes (FEATURES A2, API.md §7). */
final class UndoController
{
    private const UNDOABLE = ['delete', 'bulk_update', 'import', 'status_change', 'pay_part'];

    public static function undo(Request $request, App $app, array $params): Response
    {
        $user = $request->attr('user');
        Permissions::requireEditor($user); // a Viewer never makes an undoable change (SEC-09)
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $params, $user): Response {
            $batch = ChangeBatches::byPublicId($db, $params['batch_id'], true);
            if ($batch === null || !in_array($batch['action'], self::UNDOABLE, true)) {
                throw HttpError::make(404, 'not_found');
            }
            if ((int) $batch['user_id'] !== (int) $user['id']) {
                throw new HttpError(403, 'forbidden', Strings::get('undo_not_yours')); // SEC-08
            }
            if ($batch['undone_at'] !== null) {
                return Response::ok(self::result($batch, 0, [], true));
            }
            $age = $app->clock->now()->getTimestamp() - strtotime($batch['created_at'] . ' UTC');
            if ($age > BaseController::UNDO_MINUTES * 60) {
                throw HttpError::make(403, 'undo_expired'); // AC-UND-04
            }
            $r = BaseRepository::undo($app, $db, $request, $batch);
            return Response::ok(self::result($batch, $r['undone'], $r['skipped'], $r['already_undone']));
        });
    }

    private static function result(array $batch, int $undone, array $skipped, bool $already): array
    {
        if ($already) {
            $message = Strings::get('already_undone');
        } elseif ($skipped === []) {
            $message = Strings::get('undo_done');
        } else {
            $def = Entities::forType((string) $batch['entity_type']);
            $n = count($skipped);
            $what = $n === 1 ? ($def ? '1 ' . $def::LABEL . ' was' : '1 item was') : ($def ? "$n " . $def::LABEL_PLURAL . ' were' : "$n items were");
            $message = "Undone. $what changed by someone else and " . ($n === 1 ? 'was left as it is.' : 'were left as they are.');
        }
        return [
            'batch_id' => $batch['public_id'],
            'undone' => $undone,
            'skipped' => $skipped,
            'message' => $message,
            'already_undone' => $already,
        ];
    }
}
