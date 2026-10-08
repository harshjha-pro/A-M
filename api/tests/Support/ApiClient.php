<?php
declare(strict_types=1);

namespace Tests\Support;

use AM\Kernel\App;
use AM\Kernel\Request;

/**
 * Sends requests to the API in-process (no web server), with the headers the
 * real app sends (TESTING §1.2). Cookies, CSRF and If-Match helpers grow with
 * Session 2–3.
 */
final class ApiClient
{
    /** @var array<string,string> */
    public array $defaultHeaders = [
        'origin' => 'https://wedding.lumorrahouse.com',
        'x-client-version' => '1.0.1',
        'x-device' => 'Android · browser',
    ];

    public function __construct(public readonly App $app, public string $ip = '203.0.113.7') {}

    public function request(string $method, string $path, ?string $body = null, array $headers = [], array $query = []): TestResponse
    {
        $h = array_change_key_case($headers + $this->defaultHeaders, CASE_LOWER);
        if ($body !== null && !isset($h['content-type'])) {
            $h['content-type'] = 'application/json';
        }
        $fullPath = str_starts_with($path, '/api/') ? $path : '/api/v1' . $path;
        $req = new Request(strtoupper($method), $fullPath, $query, $h, $body ?? '', $this->ip);
        return new TestResponse($this->app->handle($req));
    }

    public function get(string $path, array $query = [], array $headers = []): TestResponse
    {
        return $this->request('GET', $path, null, $headers, $query);
    }

    public function postJson(string $path, mixed $data, array $headers = []): TestResponse
    {
        return $this->request('POST', $path, json_encode($data, JSON_UNESCAPED_UNICODE), $headers);
    }
}
