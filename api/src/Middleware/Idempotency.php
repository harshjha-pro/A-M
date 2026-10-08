<?php
declare(strict_types=1);

namespace AM\Middleware;

use AM\Db\Idempotency as Store;
use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Kernel\Uuid;
use Throwable;

/**
 * Every logged-in POST/PUT/PATCH/DELETE carries an Idempotency-Key (API.md §5):
 *   missing            → 428 idempotency_key_required
 *   already done       → the stored reply again (Idempotent-Replayed: true)
 *   still running      → 409 request_in_progress
 *   same key, new body → 422 idempotency_key_reused
 * The controller's UnitOfWork stores the reply in the same transaction as the
 * change. Any failure releases the key.
 */
final class Idempotency implements Middleware
{
    public function process(Request $request, App $app, callable $next): Response
    {
        $route = $request->attr('route');
        $user = $request->attr('user');
        if (!$request->isWrite() || $user === null || !$route->option('idempotent', true)) {
            return $next($request);
        }
        $key = $request->header('idempotency-key');
        if ($key === '' || !Uuid::isValid($key)) {
            throw HttpError::make(428, 'idempotency_key_required');
        }
        $request->attributes['idem_key'] = strtolower($key);

        ['claim' => $claim, 'replay' => $replay] = Store::claim($app, $request, (int) $user['id'], $key);
        if ($replay !== null) {
            $rebuild = $route->option('on_replay');
            if ($rebuild !== null && ($replay->payload['data']['_secrets_removed'] ?? false)) {
                // Make fresh secrets (a new link / password) and cancel the ones that never arrived.
                $fresh = $rebuild($request, $app, $request->attr('params', []), $replay);
                $fresh->headers['Idempotent-Replayed'] = 'true';
                return $fresh;
            }
            return $replay;
        }

        $request->attributes['idem_claim'] = $claim;
        try {
            $response = $next($request);
        } catch (Throwable $e) {
            $this->releaseQuietly($app, $claim);
            throw $e;
        }
        if ($response->status >= 400) {
            $this->releaseQuietly($app, $claim);
        } elseif (!$request->attr('idem_claim_done', false)) {
            // A write that didn't go through UnitOfWork (should not happen): store it anyway.
            Store::storeReply($app, $app->db(), $request, $claim, $response);
        }
        return $response;
    }

    private function releaseQuietly(App $app, array $claim): void
    {
        try {
            Store::release($app, $claim);
        } catch (Throwable) {
            // the claim expires on its own after 120 s
        }
    }
}
