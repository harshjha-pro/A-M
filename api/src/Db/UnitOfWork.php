<?php
declare(strict_types=1);

namespace AM\Db;

use AM\Kernel\App;
use AM\Kernel\Request;
use AM\Kernel\Response;
use Throwable;

/**
 * ONE transaction per write (DATABASE rule 4, API.md §5.3 step 2):
 * the change, its audit_log row(s) and the stored idempotent reply commit
 * together, or not at all. A reply of 400+ rolls everything back.
 */
final class UnitOfWork
{
    /** @param callable(Db): Response $work */
    public static function run(App $app, Request $request, callable $work): Response
    {
        $db = $app->db();
        $db->pdo->beginTransaction();
        try {
            $response = $work($db);
            if ($response->status >= 400) {
                $db->pdo->rollBack();
                return $response;
            }
            $claim = $request->attr('idem_claim');
            if ($claim !== null) {
                Idempotency::storeReply($app, $db, $request, $claim, $response);
            }
            $db->pdo->commit();
            return $response;
        } catch (Throwable $e) {
            if ($db->pdo->inTransaction()) {
                $db->pdo->rollBack();
            }
            throw $e;
        }
    }
}
