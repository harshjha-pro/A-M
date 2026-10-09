<?php
// Fake Backblaze B2 (native API v2) for sandbox tests of scripts/backup/backup.php.
//   FAKE_B2_DIR=/tmp/b2 FAKE_B2_KEY=kid:appkey php -S 127.0.0.1:8099 tools/fake-b2.php
// Stores uploads under $FAKE_B2_DIR/files/<name>, hidden names in hidden.json.
// Checks Basic auth, tokens, the upload URL token and X-Bz-Content-Sha1, like the real one.
declare(strict_types=1);

$dir = getenv('FAKE_B2_DIR') ?: sys_get_temp_dir() . '/fake-b2';
$key = getenv('FAKE_B2_KEY') ?: 'kid:appkey';
@mkdir("$dir/files", 0700, true);
$base = 'http://' . $_SERVER['HTTP_HOST'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$hdr = static fn (string $n): string => $_SERVER['HTTP_' . strtoupper(str_replace('-', '_', $n))] ?? '';
$reply = static function (int $code, array $body): void {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($body);
};
$hiddenFile = "$dir/hidden.json";
$hidden = is_file($hiddenFile) ? json_decode((string) file_get_contents($hiddenFile), true) : [];
file_put_contents("$dir/requests.log", $_SERVER['REQUEST_METHOD'] . " $path\n", FILE_APPEND);

if ($path === '/b2api/v2/b2_authorize_account') {
    if ($hdr('Authorization') !== 'Basic ' . base64_encode($key)) {
        $reply(401, ['status' => 401, 'code' => 'bad_auth_token', 'message' => 'Invalid keyId or applicationKey']);
        return;
    }
    $reply(200, ['apiUrl' => $base, 'authorizationToken' => 'tok-api', 'accountId' => 'acc', 'downloadUrl' => $base]);
    return;
}
if ($path === '/upload') {
    if ($hdr('Authorization') !== 'tok-upload') {
        $reply(401, ['code' => 'bad_auth_token']);
        return;
    }
    $name = implode('/', array_map('rawurldecode', explode('/', $hdr('X-Bz-File-Name'))));
    $data = (string) file_get_contents('php://input');
    if (sha1($data) !== $hdr('X-Bz-Content-Sha1') || $name === '' || str_contains($name, '..')) {
        $reply(400, ['code' => 'bad_request', 'message' => 'sha1 or name']);
        return;
    }
    @mkdir(dirname("$dir/files/$name"), 0700, true);
    file_put_contents("$dir/files/$name", $data);
    unset($hidden[$name]);
    file_put_contents($hiddenFile, json_encode($hidden));
    $reply(200, ['fileName' => $name, 'contentLength' => strlen($data)]);
    return;
}
if ($hdr('Authorization') !== 'tok-api') {
    $reply(401, ['code' => 'bad_auth_token']);
    return;
}
$in = json_decode((string) file_get_contents('php://input'), true) ?: [];
switch ($path) {
    case '/b2api/v2/b2_get_upload_url':
        $reply(200, ['uploadUrl' => "$base/upload", 'authorizationToken' => 'tok-upload', 'bucketId' => $in['bucketId'] ?? '']);
        return;
    case '/b2api/v2/b2_list_file_names':
        $prefix = (string) ($in['prefix'] ?? '');
        $names = [];
        $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator("$dir/files", FilesystemIterator::SKIP_DOTS));
        foreach ($it as $f) {
            $n = substr($f->getPathname(), strlen("$dir/files/"));
            if (str_starts_with($n, $prefix) && !isset($hidden[$n])) {
                $names[] = $n;
            }
        }
        sort($names);
        $reply(200, ['files' => array_map(static fn ($n) => ['fileName' => $n, 'action' => 'upload'], $names), 'nextFileName' => null]);
        return;
    case '/b2api/v2/b2_hide_file':
        $hidden[(string) $in['fileName']] = true;
        file_put_contents($hiddenFile, json_encode($hidden));
        $reply(200, ['fileName' => $in['fileName'], 'action' => 'hide']);
        return;
}
$reply(404, ['code' => 'not_found']);
