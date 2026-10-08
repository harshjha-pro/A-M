<?php
declare(strict_types=1);

namespace AM\Db;

use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Kernel\Time;
use PDOException;

/**
 * Idempotency-Key storage (API.md §5). One stored reply per (user, key) for 48 h.
 *
 *   claim()      own autocommit INSERT … status 'processing'
 *   storeReply() inside the UnitOfWork transaction: status 'done' + the reply
 *   release()    after any failure: the key is free again (DATABASE rule 12)
 *
 * Secrets (password_once, setup_link, csrf_token) are NEVER stored: the route's
 * on_replay rebuilds them, cancelling the first ones (API.md §3.5).
 */
final class Idempotency
{
    public const TTL = 48 * 3600;
    public const STALE_PROCESSING = 120;
    public const SECRET_KEYS = ['password_once', 'setup_link', 'setup_link_expires_at', 'csrf_token'];

    /**
     * @return array{claim:?array, replay:?Response}
     *   claim  = ['id' => int] when this request should run
     *   replay = the stored reply when it already ran
     */
    public static function claim(App $app, Request $request, int $userId, string $key): array
    {
        $db = $app->db();
        $now = $app->clock->now()->getTimestamp();
        $hash = self::requestHash($request);
        $path = substr($request->path, 0, 200);

        for ($attempt = 0; $attempt < 2; $attempt++) {
            try {
                $db->run(
                    "INSERT INTO idempotency_keys (idem_key, user_id, method, path, request_hash, status, created_at, expires_at)
                     VALUES (?, ?, ?, ?, ?, 'processing', ?, ?)",
                    [strtolower($key), $userId, $request->method, $path, $hash, Time::db($now), Time::db($now + self::TTL)],
                );
                return ['claim' => ['id' => (int) $db->pdo->lastInsertId()], 'replay' => null];
            } catch (PDOException $e) {
                if (($e->errorInfo[1] ?? 0) !== 1062) {
                    throw $e;
                }
            }
            $row = $db->one('SELECT * FROM idempotency_keys WHERE user_id = ? AND idem_key = ?', [$userId, strtolower($key)]);
            if ($row === null) {
                continue; // released between our insert and read: try again
            }
            if (strtotime($row['expires_at'] . ' UTC') <= $now) {
                // Past 48 h: the old reply is gone; creates are still protected by client_uuid.
                $db->run('DELETE FROM idempotency_keys WHERE id = ?', [$row['id']]);
                continue;
            }
            if ($row['method'] !== $request->method || $row['path'] !== $path || !hash_equals($row['request_hash'], $hash)) {
                throw HttpError::make(422, 'idempotency_key_reused');
            }
            if ($row['status'] === 'done') {
                return ['claim' => null, 'replay' => self::replay($row)];
            }
            // Still processing.
            if ($now - strtotime($row['created_at'] . ' UTC') < self::STALE_PROCESSING) {
                throw HttpError::make(409, 'request_in_progress', [], [], ['Retry-After' => '2']);
            }
            // The PHP process that claimed it died: take it over.
            $db->run('UPDATE idempotency_keys SET created_at = ? WHERE id = ?', [Time::db($now), $row['id']]);
            return ['claim' => ['id' => (int) $row['id']], 'replay' => null];
        }
        throw HttpError::make(409, 'request_in_progress', [], [], ['Retry-After' => '2']);
    }

    /** Called inside the UnitOfWork transaction. */
    public static function storeReply(App $app, Db $db, Request $request, array $claim, Response $response): void
    {
        $response->finalize((string) $request->attr('request_id', '-'), $app->clock->isoNow());
        $payload = $response->payload;
        $hadSecrets = false;
        if (is_array($payload['data'] ?? null)) {
            foreach (self::SECRET_KEYS as $k) {
                if (array_key_exists($k, $payload['data'])) {
                    unset($payload['data'][$k]);
                    $hadSecrets = true;
                }
            }
        }
        if ($hadSecrets) {
            $payload['data']['_secrets_removed'] = true;
        }
        $body = $payload !== null ? Response::encode($payload) : $response->body;
        $db->run(
            "UPDATE idempotency_keys SET status = 'done', response_code = ?, response_body = ? WHERE id = ?",
            [$response->status, $body, $claim['id']],
        );
        $request->attributes['idem_claim_done'] = true;
    }

    /** A failed request leaves nothing behind, so the user can fix it and retry with the same key (API.md §5.1). */
    public static function release(App $app, array $claim): void
    {
        $app->db()->run("DELETE FROM idempotency_keys WHERE id = ? AND status = 'processing'", [$claim['id']]);
    }

    private static function replay(array $row): Response
    {
        $r = new Response((int) $row['response_code']);
        $payload = json_decode((string) $row['response_body'], true);
        if (is_array($payload) && array_key_exists('ok', $payload)) {
            $r->payload = $payload;
            $r->headers['Content-Type'] = 'application/json; charset=utf-8';
            if (isset($payload['data']['version']) && is_int($payload['data']['version'])) {
                $r->headers['ETag'] = '"' . $payload['data']['version'] . '"';
            }
        } else {
            $r->body = (string) $row['response_body'];
        }
        $r->headers['Idempotent-Replayed'] = 'true';
        return $r;
    }

    /** SHA-256 of method + path + the body as canonical JSON (keys sorted). */
    public static function requestHash(Request $request): string
    {
        $json = $request->attr('json');
        $canonical = $json === null ? $request->body : Response::encode(self::sortKeys($json));
        return hash('sha256', $request->method . ' ' . $request->path . "\n" . $canonical);
    }

    private static function sortKeys(mixed $v): mixed
    {
        if (!is_array($v)) {
            return $v;
        }
        if (!array_is_list($v)) {
            ksort($v, SORT_STRING);
        }
        return array_map([self::class, 'sortKeys'], $v);
    }
}
