<?php
declare(strict_types=1);

namespace Tests\Unit;

use AM\Kernel\AppInfo;
use AM\Kernel\Env;
use AM\Kernel\FrozenClock;
use AM\Kernel\HttpError;
use AM\Kernel\Logger;
use AM\Kernel\Router;
use AM\Kernel\Response;
use AM\Kernel\Strings;
use AM\Kernel\Ulid;
use AM\Kernel\Uuid;
use PHPUnit\Framework\TestCase;

final class KernelTest extends TestCase
{
    public function test_env_parser(): void
    {
        $vars = Env::parse(<<<'ENV'
        # comment
        APP_ENV=live                       # live | staging | test
        APP_NAME="A&M Wedding"
        DB_PASS='p#ss word'
        EMPTY=
        lower=ignored
        STORAGE=/home/u1/private/storage   # holds uploads
        ENV);
        $this->assertSame('live', $vars['APP_ENV']);
        $this->assertSame('A&M Wedding', $vars['APP_NAME']);
        $this->assertSame('p#ss word', $vars['DB_PASS']);
        $this->assertSame('', $vars['EMPTY']);
        $this->assertSame('/home/u1/private/storage', $vars['STORAGE']);
        $this->assertArrayNotHasKey('lower', $vars);
        $env = Env::fromArray(['A' => 'true', 'N' => '42', 'B' => 'no']);
        $this->assertTrue($env->bool('A'));
        $this->assertFalse($env->bool('B'));
        $this->assertSame(42, $env->int('N'));
        $this->assertSame(7, $env->int('MISSING', 7));
    }

    public function test_env_example_parses_and_has_no_real_secrets(): void
    {
        $text = (string) file_get_contents(dirname(__DIR__, 3) . '/.env.example');
        $vars = Env::parse($text);
        foreach (['APP_ENV', 'APP_URL', 'DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASS', 'LOG_DIR', 'STORAGE_ROOT', 'MIN_CLIENT_VERSION', 'BACKUP_EXPECTED', 'SETUP_TOKEN'] as $k) {
            $this->assertArrayHasKey($k, $vars, ".env.example is missing $k");
        }
        $this->assertSame('change-me', $vars['DB_PASS']);
        $this->assertSame('false', $vars['BACKUP_EXPECTED']);
    }

    public function test_ulid_and_uuid(): void
    {
        $clock = new FrozenClock('2026-10-08T09:12:31Z');
        $a = Ulid::generate($clock);
        $clock->advance('+1 second');
        $b = Ulid::generate($clock);
        $this->assertTrue(Ulid::isValid($a));
        $this->assertSame(26, strlen($a));
        $this->assertLessThan(0, strcmp(substr($a, 0, 10), substr($b, 0, 10)), 'ULIDs sort by time');
        $this->assertTrue(Ulid::isValid('01M4DK5T3CM3FTBFESYSCKJ2KK'), 'Seed ids are valid');
        $this->assertFalse(Ulid::isValid('42'));
        $u = Uuid::v4();
        $this->assertTrue(Uuid::isValid($u));
        $this->assertFalse(Uuid::isValid('not-a-uuid'));
    }

    public function test_clock_ist_date(): void
    {
        $clock = new FrozenClock('2026-10-08T19:00:00Z'); // 00:30 IST next day
        $this->assertSame('2026-10-09', $clock->todayIst());
        $this->assertSame('2026-10-08T19:00:00Z', $clock->isoNow());
        $this->assertSame('2026-10-08 19:00:00', $clock->dbNow());
    }

    public function test_logger_masks_phones_only(): void
    {
        $this->assertSame('call [phone] now', Logger::mask('call +91 98290 12345 now'));
        $this->assertSame('call [phone]', Logger::mask('call 098290-12345'));
        $this->assertSame('on 2026-10-08 at 10:42', Logger::mask('on 2026-10-08 at 10:42'));
        $this->assertSame('₹1,25,000', Logger::mask('₹1,25,000'));
    }

    public function test_router_matches_params_and_methods(): void
    {
        $r = new Router();
        $r->add('GET', '/households/{id}', static fn () => Response::ok([]));
        $r->add('PUT', '/households/{id}/invitations/{event_id}', static fn () => Response::ok([]));
        [$route, $params] = $r->match('GET', '/api/v1/households/01JA7Q3M2K8V5R1T9W4X6Y0Z2B');
        $this->assertSame('GET /households/{id}', $route->name());
        $this->assertSame(['id' => '01JA7Q3M2K8V5R1T9W4X6Y0Z2B'], $params);
        [, $p2] = $r->match('PUT', '/api/v1/households/A/invitations/B');
        $this->assertSame(['id' => 'A', 'event_id' => 'B'], $p2);
        try {
            $r->match('DELETE', '/api/v1/households/A');
            $this->fail('expected 405');
        } catch (HttpError $e) {
            $this->assertSame(405, $e->status);
        }
        try {
            $r->match('GET', '/api/v1/households/A/x');
            $this->fail('expected 404');
        } catch (HttpError $e) {
            $this->assertSame(404, $e->status);
        }
    }

    public function test_every_error_code_has_a_plain_message(): void
    {
        foreach (['bad_request', 'not_logged_in', 'forbidden', 'csrf_failed', 'not_found', 'version_conflict', 'record_deleted',
                  'duplicate_found', 'request_in_progress', 'validation_failed', 'update_required', 'version_required',
                  'idempotency_key_required', 'idempotency_key_reused', 'rate_limited', 'server_error', 'app_updating',
                  'service_unavailable', 'method_not_allowed', 'body_too_big'] as $code) {
            $this->assertTrue(Strings::has($code), "Missing message for $code");
            $msg = Strings::get($code);
            $this->assertDoesNotMatchRegularExpression('/\b(sync|cache|session|409|SQL|exception)\b/i', $msg, "Jargon in $code");
        }
        $this->assertSame('Too many tries. Please wait 3 minutes.', Strings::get('rate_limited', ['n' => 3]));
    }

    public function test_versions_match_everywhere(): void
    {
        $root = dirname(__DIR__, 3);
        $version = trim((string) file_get_contents("$root/VERSION"));
        $this->assertMatchesRegularExpression('/^\d+\.\d+\.\d+(\.\d+)?$/', $version);
        $this->assertSame($version, AppInfo::version());
        $pkg = json_decode((string) file_get_contents("$root/web/package.json"), true);
        $this->assertSame($version, $pkg['version'], 'web/package.json version must equal VERSION');
    }
}
