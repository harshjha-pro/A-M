<?php
declare(strict_types=1);

namespace AM\Middleware;

use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Kernel\Strings;
use Throwable;

/**
 * Any exception becomes the JSON error envelope. A planned HttpError keeps its
 * code and message. Anything else is logged with the request id and answered
 * with a plain 500: never a path, SQL, stack trace or PHP version (SEC-29).
 */
final class ErrorHandler implements Middleware
{
    public function process(Request $request, App $app, callable $next): Response
    {
        try {
            return $next($request);
        } catch (HttpError $e) {
            return Response::fromHttpError($e);
        } catch (Throwable $e) {
            // 1.0.21: a table or column the code needs is missing — a migration was not imported yet.
            // Say so plainly (and which one), instead of the general "something went wrong".
            if ($e instanceof \PDOException && in_array((string) $e->getCode(), ['42S02', '42S22'], true)) {
                $app->logger->exception((string) $request->attr('request_id', '-'), $e, ['reason' => 'schema_behind']);
                return Response::error(503, 'db_update_needed', self::updateMessage($app));
            }
            $route = $request->attr('route');
            $app->logger->exception((string) $request->attr('request_id', '-'), $e, [
                'endpoint' => $route ? $route->name() : $request->method . ' ' . $request->path,
                'user_id' => $request->attr('user')['id'] ?? null,
            ]);
            return Response::error(500, 'server_error', Strings::get('server_error'));
        }
    }

    /** "The database needs an update: import 005 to 008 in phpMyAdmin, in order." */
    private static function updateMessage(App $app): string
    {
        $have = null;
        try {
            $have = \AM\Db\SchemaInfo::read($app->db())['version'];
        } catch (Throwable) {
            // no schema_migrations either: fall back to the general wording
        }
        $want = \AM\Kernel\AppInfo::EXPECTED_SCHEMA_VERSION;
        return $have !== null && $have < $want
            ? Strings::get('db_update_needed', ['from' => sprintf('%03d', $have + 1), 'to' => sprintf('%03d', $want)])
            : Strings::get('db_update_needed_any');
    }
}
