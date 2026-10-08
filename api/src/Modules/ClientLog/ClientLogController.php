<?php
declare(strict_types=1);

namespace AM\Modules\ClientLog;

use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Logger;
use AM\Kernel\RateLimiter;
use AM\Kernel\Request;
use AM\Kernel\Response;

/**
 * POST /api/v1/client-log (TESTING §9.3)
 * Phone-side errors go to private/logs/client-error.log, never the database
 * or audit_log. Works with or without a session. No Idempotency-Key needed:
 * a duplicate log line is harmless. 30 per hour per session (or IP).
 */
final class ClientLogController
{
    /** field => max characters */
    private const FIELDS = [
        'at' => 40,
        'app_version' => 20,
        'device' => 60,
        'screen' => 100,
        'code' => 60,
        'message' => 500,
        'request_id' => 40,
        'stack' => 2000,
    ];

    public static function store(Request $request, App $app, array $params): Response
    {
        if ($request->contentType() !== 'application/json') {
            throw HttpError::make(400, 'bad_request');
        }
        $body = $request->attr('json');
        if (!is_array($body) || array_is_list($body) && $body !== []) {
            throw HttpError::make(400, 'bad_request');
        }

        $user = $request->attr('user');
        $who = $user !== null ? 'user:' . $user['id'] : 'ip:' . RateLimiter::clientIp($request, $app);
        (new RateLimiter($app))->hit('client_log:' . $who, 30, 3600);

        $entry = [
            'request_id_server' => (string) $request->attr('request_id'),
            'user_id' => $user['id'] ?? null,
        ];
        foreach (self::FIELDS as $field => $max) {
            $value = $body[$field] ?? null;
            if ($value === null) {
                continue;
            }
            if (!is_scalar($value)) {
                throw HttpError::make(400, 'bad_request');
            }
            // Strip control characters (keeps one log line per report), cap length, mask phone numbers.
            $text = (string) preg_replace('/[\x00-\x08\x0B-\x1F\x7F]/u', ' ', (string) $value);
            // Mask before cutting, so a phone number cut in half can't slip through.
            $entry[$field] = mb_substr(Logger::mask($text), 0, $max);
        }
        $app->logger->client($entry);

        return Response::ok(new \stdClass());
    }
}
