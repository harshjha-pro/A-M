<?php
declare(strict_types=1);

namespace Tests\Support;

use AM\Kernel\App;
use AM\Kernel\Request;
use AM\Kernel\Uuid;

/**
 * Sends requests to the API in-process (no web server), like one phone:
 * a cookie jar, the CSRF token in memory, and the headers the real app sends
 * (TESTING §1.2). Every write gets a fresh Idempotency-Key unless one is given.
 */
final class ApiClient
{
    /** @var array<string,string> */
    public array $defaultHeaders = [
        'origin' => 'https://wedding.lumorrahouse.com',
        'x-client-version' => '1.0.7',
        'x-device' => 'Android · browser',
    ];

    /** @var array<string,string> */
    public array $cookies = [];
    public ?string $csrf = null;
    public ?string $lastIdemKey = null;

    public function __construct(public readonly App $app, public string $ip = '203.0.113.7') {}

    /**
     * @param array{idem?: string|false, ifMatch?: int|string, csrf?: string|false, raw?: bool} $opts
     */
    public function request(string $method, string $path, ?string $body = null, array $headers = [], array $query = [], array $opts = []): TestResponse
    {
        $method = strtoupper($method);
        $h = array_change_key_case($headers + $this->defaultHeaders, CASE_LOWER);
        if ($body !== null && !isset($h['content-type'])) {
            $h['content-type'] = 'application/json';
        }
        if (in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            $csrf = $opts['csrf'] ?? $this->csrf;
            if ($csrf !== false && $csrf !== null && !isset($h['x-csrf-token'])) {
                $h['x-csrf-token'] = $csrf;
            }
            $idem = $opts['idem'] ?? Uuid::v4();
            if ($idem !== false && !isset($h['idempotency-key'])) {
                $h['idempotency-key'] = $idem;
                $this->lastIdemKey = $idem;
            }
            if (isset($opts['ifMatch'])) {
                $h['if-match'] = '"' . $opts['ifMatch'] . '"';
            }
        }
        $fullPath = str_starts_with($path, '/api/') ? $path : '/api/v1' . $path;
        $req = new Request($method, $fullPath, $query, $h, $body ?? '', $this->ip, $this->cookies);
        $res = new TestResponse($this->app->handle($req));
        $this->takeCookie($res);
        return $res;
    }

    public function get(string $path, array $query = [], array $headers = []): TestResponse
    {
        return $this->request('GET', $path, null, $headers, $query);
    }

    public function postJson(string $path, mixed $data, array $headers = [], array $opts = []): TestResponse
    {
        return $this->request('POST', $path, json_encode($data, JSON_UNESCAPED_UNICODE), $headers, [], $opts);
    }

    public function patchJson(string $path, mixed $data, int|string $ifMatch, array $opts = []): TestResponse
    {
        return $this->request('PATCH', $path, json_encode($data, JSON_UNESCAPED_UNICODE), [], [], $opts + ['ifMatch' => $ifMatch]);
    }

    /** Log in; keeps the cookie and CSRF token like the app does. */
    public function login(string $phone, string $password = 'test-1234'): TestResponse
    {
        $res = $this->postJson('/auth/login', ['phone' => $phone, 'password' => $password]);
        if ($res->status() === 200) {
            $this->csrf = (string) $res->json('data.csrf_token');
        }
        return $res;
    }

    /** The session cookie this "phone" holds. */
    public function cookie(): ?string
    {
        return $this->cookies['__Host-am_session'] ?? null;
    }

    private function takeCookie(TestResponse $res): void
    {
        $set = $res->header('Set-Cookie');
        if ($set === null || !preg_match('/^([^=]+)=([^;]*)/', $set, $m)) {
            return;
        }
        if (preg_match('/Max-Age=0\b/', $set) || $m[2] === '') {
            unset($this->cookies[$m[1]]);
        } else {
            $this->cookies[$m[1]] = $m[2];
        }
    }
}
