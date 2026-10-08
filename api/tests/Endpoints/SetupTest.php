<?php
declare(strict_types=1);

namespace Tests\Endpoints;

use AM\Kernel\App;
use AM\Kernel\Logger;
use Tests\Support\ApiClient;
use Tests\Support\ApiTestCase;
use Tests\Support\Endpoint;
use Tests\Support\TestDb;

/** POST /setup/owner — on an empty database, like the first run on live (SEC-34). */
final class SetupTest extends ApiTestCase
{
    private const DB = 'am_test_setup';
    private const TOKEN = 'k3J9-very-long-random-setup-token-77';

    protected function setUp(): void
    {
        parent::setUp();
        TestDb::rebuild(self::DB, false); // migrations only: no owner yet
    }

    public static function tearDownAfterClass(): void
    {
        TestDb::server()->exec('DROP DATABASE IF EXISTS `' . self::DB . '`');
    }

    private function client(string $token = self::TOKEN): ApiClient
    {
        $env = TestDb::env(['DB_NAME' => self::DB, 'SETUP_TOKEN' => $token, 'LOG_DIR' => $this->logDir]);
        return new ApiClient(new App($env, $this->clock, new Logger($this->logDir, $this->clock)));
    }

    private function body(array $over = []): array
    {
        return $over + ['setup_token' => self::TOKEN, 'name' => 'Ayush Porwal', 'phone' => '98290 12345', 'password' => 'lotus-4821'];
    }

    #[Endpoint('POST /setup/owner')]
    public function test_creates_the_owner_once_and_logs_them_in(): void
    {
        $api = $this->client();
        $res = $api->postJson('/setup/owner', $this->body());
        $res->assertStatus(201)->assertEnvelope();
        $this->assertSame('owner', $res->json('data.user.role'));
        $this->assertSame('+919829012345', $res->json('data.user.phone'));
        $this->assertStringContainsString('__Host-am_session=', (string) $res->header('Set-Cookie'));
        $api->csrf = (string) $res->json('data.csrf_token');
        $this->assertTrue($api->get('/session')->assertStatus(200)->json('data.permissions.owner'));

        // SEC-34: never again
        $again = $this->client()->postJson('/setup/owner', $this->body(['phone' => '9829099999']));
        $again->assertStatus(410)->assertErrorCode('setup_done');
        $pdo = TestDb::connect(self::DB);
        $this->assertSame(1, (int) $pdo->query("SELECT COUNT(*) FROM users")->fetchColumn());
        $this->assertSame(1, (int) $pdo->query("SELECT COUNT(*) FROM audit_log WHERE entity_type = 'user' AND action = 'create'")->fetchColumn());
    }

    #[Endpoint('POST /setup/owner')]
    public function test_wrong_missing_or_placeholder_token_is_refused(): void
    {
        $this->client()->postJson('/setup/owner', $this->body(['setup_token' => 'guess']))->assertStatus(403)->assertErrorCode('forbidden');
        $this->client('')->postJson('/setup/owner', $this->body(['setup_token' => '']))->assertStatus(403);
        $this->client('change-me-long-random')->postJson('/setup/owner', $this->body(['setup_token' => 'change-me-long-random']))->assertStatus(403);
        $this->assertSame(0, (int) TestDb::connect(self::DB)->query('SELECT COUNT(*) FROM users')->fetchColumn());
    }

    #[Endpoint('POST /setup/owner')]
    public function test_validation_and_limits(): void
    {
        $r = $this->client()->postJson('/setup/owner', $this->body(['name' => '', 'phone' => '12345']));
        $r->assertStatus(422);
        $this->assertSame(['name', 'phone'], array_keys($r->json('error.fields')));
        $r = $this->client()->postJson('/setup/owner', $this->body(['password' => '98290 12345']));
        $this->assertSame('Choose at least 6 letters or numbers. Not your phone number.', $r->assertStatus(422)->json('error.fields.password'));
        $api = $this->client();
        for ($i = 0; $i < 5; $i++) {
            $api->postJson('/setup/owner', $this->body(['setup_token' => 'wrong-' . $i]));
        }
        $api->postJson('/setup/owner', $this->body())->assertStatus(429); // SEC-21: 6th in an hour
    }

    #[Endpoint('POST /setup/owner')]
    public function test_needs_our_origin(): void
    {
        $this->client()->postJson('/setup/owner', $this->body(), ['origin' => 'https://evil.example'])->assertStatus(403)->assertErrorCode('csrf_failed');
    }
}
