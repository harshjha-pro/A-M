<?php
declare(strict_types=1);

namespace AM\Kernel;

use AM\Db\Db;
use AM\Http\Routes;
use AM\Middleware;
use Closure;
use Throwable;

/**
 * Builds the API and runs one request through the chain (IMPLEMENTATION §2.3):
 *
 *   RequestId → SecurityHeaders → ErrorHandler → MethodGuard → RouteMatch →
 *   JsonBody → MaintenanceGuard → ClientVersion → RateLimit → Session →
 *   AuthRequired → Csrf → Idempotency → controller
 *
 * Session, Csrf and Idempotency are stubs until Sessions 2–3: there is no way
 * to log in yet, so every non-anonymous route answers 401.
 */
final class App
{
    private ?Db $db = null;

    /** @var Closure(Env): Db */
    private Closure $dbFactory;

    public readonly Router $router;

    public function __construct(
        public readonly Env $env,
        public readonly Clock $clock,
        public readonly Logger $logger,
        ?Closure $dbFactory = null,
        ?Router $router = null,
    ) {
        $this->dbFactory = $dbFactory ?? static fn (Env $env): Db => Db::connect($env);
        $this->router = $router ?? Routes::build();
    }

    /** private/.env sits beside private/app (this code). */
    public static function fromEnvFile(?string $file = null): self
    {
        $file ??= getenv('AM_ENV_FILE') ?: dirname(__DIR__, 3) . '/.env';
        $env = Env::load($file);
        $clock = new SystemClock();
        return new self($env, $clock, new Logger($env->get('LOG_DIR'), $clock));
    }

    /** Remembers a failed connect, so one request doesn't wait on a dead server twice. */
    private ?Throwable $dbError = null;

    /** Opens the database on first use. Throws if MySQL is down. */
    public function db(): Db
    {
        if ($this->db !== null) {
            return $this->db;
        }
        if ($this->dbError !== null) {
            throw $this->dbError;
        }
        try {
            return $this->db = ($this->dbFactory)($this->env);
        } catch (Throwable $e) {
            $this->dbError = $e;
            throw $e;
        }
    }

    /** Forget the connection (tests use this after swapping databases). */
    public function resetDb(): void
    {
        $this->db = null;
        $this->dbError = null;
    }

    /** @return list<Middleware\Middleware> */
    private function chain(): array
    {
        return [
            new Middleware\RequestId(),
            new Middleware\SecurityHeaders(),
            new Middleware\ErrorHandler(),
            new Middleware\MethodGuard(),
            new Middleware\RouteMatch(),
            new Middleware\JsonBody(),
            new Middleware\MaintenanceGuard(),
            new Middleware\ClientVersion(),
            new Middleware\RateLimit(),
            new Middleware\Session(),
            new Middleware\AuthRequired(),
            new Middleware\Csrf(),
            new Middleware\Idempotency(),
        ];
    }

    public function handle(Request $request): Response
    {
        $steps = $this->chain();
        $dispatch = function (Request $r): Response {
            /** @var Route $route */
            $route = $r->attr('route');
            return ($route->handler)($r, $this, $r->attr('params', []));
        };
        $next = array_reduce(
            array_reverse($steps),
            fn (callable $next, Middleware\Middleware $m): callable => fn (Request $r): Response => $m->process($r, $this, $next),
            $dispatch,
        );

        try {
            $response = $next($request);
        } catch (Throwable $e) {
            // Only reachable if a middleware outside ErrorHandler fails. Still no details.
            $this->logger->exception((string) $request->attr('request_id', '-'), $e);
            $response = Response::error(500, 'server_error', Strings::get('server_error'));
        }

        $response->finalize((string) $request->attr('request_id', '-'), $this->clock->isoNow());
        if ($request->method === 'HEAD') {
            $response->body = '';
        }
        return $response;
    }

    /** Entry point used by public_html/api/index.php → private/app/bootstrap.php. */
    public static function main(): void
    {
        ini_set('display_errors', '0');
        ini_set('expose_php', '0');
        set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
            if (!(error_reporting() & $severity)) {
                return false;
            }
            throw new \ErrorException($message, 0, $severity, $file, $line);
        });
        try {
            $app = self::fromEnvFile();
            $app->handle(Request::fromGlobals())->send();
        } catch (Throwable $e) {
            error_log('A&M API fatal: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
            header('Cache-Control: no-store');
            echo Response::encode(['ok' => false, 'error' => ['code' => 'server_error', 'message' => Strings::get('server_error')], 'meta' => (object) []]);
        }
    }
}
