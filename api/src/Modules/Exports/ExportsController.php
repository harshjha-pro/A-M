<?php
declare(strict_types=1);

namespace AM\Modules\Exports;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Db\UnitOfWork;
use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\RateLimiter;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Kernel\Strings;
use AM\Kernel\Time;
use AM\Kernel\Ulid;
use AM\Modules\Documents\FileStore;
use AM\Repo\Refs;
use AM\Safety\AuditLog;
use DateTimeImmutable;
use DateTimeZone;
use Throwable;

/**
 * Full export (API.md §9.1, FEATURES B8). Owner and Partner only.
 *   POST /exports                    snapshot into STORAGE_ROOT/exports/<id>/ (3 per hour)
 *   GET  /exports, /exports/{id}     recent exports, one export
 *   GET  /exports/{id}/download      the ZIP, built while it streams; ?part=N; ?t=<token>
 * The token (32 random bytes, only its SHA-256 stored) lets the iPhone's download sheet,
 * which has no app cookie, fetch the file. Valid for that export only, for 24 hours.
 */
final class ExportsController
{
    public const TTL = 24 * 3600;
    public const PER_HOUR = 3;

    /** Tests only (DS-23): something to do while the snapshot is being read. */
    public static ?\Closure $whileReading = null;

    /** POST /exports */
    public static function create(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireAdmin($viewer); // AC-EXP-04
        $kind = $request->attr('json')['kind'] ?? 'full';
        if ($kind !== 'full') {
            throw new HttpError(422, 'validation_failed', Strings::get('validation_failed_one'), ['fields' => ['kind' => Strings::get('export_kind')]]);
        }
        (new RateLimiter($app))->hit('export:all', self::PER_HOUR, 3600); // the 4th in an hour → 429
        $store = FileStore::fromEnv($app->env);
        $publicId = Ulid::generate($app->clock);
        $base = $store->root() . '/exports';
        $dir = "$base/$publicId";
        $now = $app->clock->now();
        $db = $app->db();
        try {
            if (!is_dir($dir) && !@mkdir($dir, 0750, true) && !is_dir($dir)) {
                throw new \RuntimeException('Could not create ' . $dir);
            }
            if (!is_file("$base/.htaccess")) {
                @file_put_contents("$base/.htaccess", "Require all denied\n");
            }
            $result = Snapshot::build($db, $dir, $store, $now, max(1, $app->env->int('EXPORT_PART_BYTES', Snapshot::PART_BYTES)), self::$whileReading);
        } catch (Throwable $e) {
            self::removeDir($dir);
            $app->logger->exception((string) $request->attr('request_id'), $e, ['where' => 'export']);
            $db->run(
                "INSERT INTO exports (public_id, kind, status, requested_by, progress_pct, parts, created_at, started_at, finished_at, error)
                 VALUES (?, 'full', 'failed', ?, 0, 1, ?, ?, ?, ?)",
                [$publicId, $viewer['id'], $app->clock->dbNow(), $app->clock->dbNow(), $app->clock->dbNow(), mb_substr($e->getMessage(), 0, 1000)],
            );
            throw HttpError::make(500, 'export_failed');
        }

        $token = self::newToken();
        $day = $now->setTimezone(new DateTimeZone('Asia/Kolkata'))->format('Y-m-d');
        return UnitOfWork::run($app, $request, static function (Db $db) use ($app, $request, $viewer, $publicId, $result, $token, $now, $day): Response {
            $db->run(
                "INSERT INTO exports (public_id, kind, status, requested_by, progress_pct, parts, file_name, size_bytes, download_token_hash, created_at, started_at, finished_at, expires_at)
                 VALUES (?, 'full', 'ready', ?, 100, ?, ?, ?, ?, ?, ?, ?, ?)",
                [$publicId, $viewer['id'], $result['parts'], "wedding-export_$day.zip", $result['size_bytes'], hash('sha256', $token),
                    $app->clock->dbNow(), $app->clock->dbNow(), $app->clock->dbNow(), gmdate('Y-m-d H:i:s', $now->getTimestamp() + self::TTL)],
            );
            $id = (int) $db->pdo->lastInsertId();
            AuditLog::record($app, $db, $request, [
                'action' => 'export', 'entity_type' => 'export', 'entity_id' => $id,
                'note' => sprintf('a full export (%d families, %d files)', $result['tables']['households'] ?? 0, $result['files']),
            ]);
            $row = $db->one('SELECT * FROM exports WHERE id = ?', [$id]);
            return Response::ok(self::view($app, $db, $row, $token), 201);
        });
    }

    /** A retried POST (same Idempotency-Key): the stored reply has no token, so a fresh one is issued for the same export. */
    public static function createReplay(Request $request, App $app, array $params, Response $stored): Response
    {
        $publicId = (string) ($stored->payload['data']['id'] ?? '');
        return UnitOfWork::run($app, $request, static function (Db $db) use ($app, $publicId, $stored): Response {
            $row = $db->one('SELECT * FROM exports WHERE public_id = ? FOR UPDATE', [$publicId]);
            if ($row === null || self::status($app, $row) !== 'ready') {
                return $stored;
            }
            $token = self::newToken();
            $db->run('UPDATE exports SET download_token_hash = ? WHERE id = ?', [hash('sha256', $token), $row['id']]);
            return Response::ok(self::view($app, $db, $row, $token), (int) $stored->status);
        });
    }

    /** GET /exports — the last 10, and when the last good one was made (Settings shows it). */
    public static function list(Request $request, App $app, array $params): Response
    {
        Permissions::requireAdmin($request->attr('user'));
        $db = $app->db();
        $rows = $db->all('SELECT * FROM exports WHERE kind = ? ORDER BY id DESC LIMIT 10', ['full']);
        $last = $db->one("SELECT public_id, created_at FROM exports WHERE kind = 'full' AND status IN ('ready', 'expired') ORDER BY id DESC LIMIT 1");
        return Response::ok(array_map(static fn ($r) => self::view($app, $db, $r, null), $rows), 200, [
            'last_success' => $last === null ? null : ['id' => $last['public_id'], 'created_at' => Time::iso($last['created_at'])],
        ]);
    }

    /** GET /exports/{id} */
    public static function get(Request $request, App $app, array $params): Response
    {
        Permissions::requireAdmin($request->attr('user'));
        $db = $app->db();
        $row = $db->one('SELECT * FROM exports WHERE public_id = ?', [$params['id']]);
        if ($row === null) {
            throw HttpError::make(404, 'not_found');
        }
        return Response::ok(self::view($app, $db, $row, null));
    }

    /** GET /exports/{id}/download?part=N&t=… — anonymous route: the session or the token decides. */
    public static function download(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        $token = (string) ($request->query['t'] ?? '');
        $isAdmin = $viewer !== null && Permissions::isAdmin($viewer);
        if (!$isAdmin && $token === '') {
            if ($viewer === null) {
                throw HttpError::make(401, 'not_logged_in');
            }
            throw HttpError::make(403, 'forbidden'); // Family / Viewer
        }
        $db = $app->db();
        $row = $db->one('SELECT * FROM exports WHERE public_id = ?', [$params['id']]);
        $tokenOk = $token !== '' && $row !== null && $row['download_token_hash'] !== null && hash_equals($row['download_token_hash'], hash('sha256', $token));
        if (!$isAdmin && !$tokenOk) {
            // A token from another export, a made-up one, or one for an export that doesn't exist (SEC-33).
            throw $viewer === null ? HttpError::make(401, 'not_logged_in') : HttpError::make(403, 'forbidden');
        }
        if ($row === null || $row['status'] === 'failed' || $row['status'] === 'queued' || $row['status'] === 'running') {
            throw HttpError::make(404, 'not_found');
        }
        $store = FileStore::fromEnv($app->env);
        $dir = $store->root() . '/exports/' . $row['public_id'];
        if (self::status($app, $row) === 'expired' || !is_file("$dir/manifest.json")) {
            throw HttpError::make(410, 'export_expired'); // AC-EXP-08
        }
        $part = (string) ($request->query['part'] ?? '1');
        if (!ctype_digit($part) || (int) $part < 1 || (int) $part > (int) $row['parts']) {
            throw HttpError::make(404, 'not_found');
        }
        $part = (int) $part;
        $parts = (int) $row['parts'];
        $manifest = json_decode((string) file_get_contents("$dir/manifest.json"), true, 512, JSON_THROW_ON_ERROR);

        UnitOfWork::run($app, $request, static function (Db $db) use ($app, $request, $row, $viewer, $part, $parts): Response {
            AuditLog::record($app, $db, $request, [
                'action' => 'export', 'entity_type' => 'export', 'entity_id' => (int) $row['id'],
                'user_id' => $viewer['id'] ?? (int) $row['requested_by'],
                'note' => 'a full export' . ($parts > 1 ? ", part $part of $parts" : '') . ($viewer === null ? ' (with the download link)' : ''),
            ]);
            return Response::ok(null);
        });

        $name = (string) ($row['file_name'] ?: 'wedding-export.zip');
        if ($part > 1) {
            $name = substr($name, 0, -4) . "_files-part$part.zip";
        }
        $when = (new DateTimeImmutable($row['created_at'], new DateTimeZone('UTC')))->setTimezone(new DateTimeZone('Asia/Kolkata'));
        $r = Response::streamed(static function (\Closure $out) use ($dir, $part, $manifest, $store, $when): void {
            @set_time_limit(0); // a 200 MB part on a slow phone takes a while
            $zip = new ZipWriter($out, $when);
            if ($part === 1) {
                foreach (Snapshot::dataFiles($dir) as $f) {
                    $zip->addString($f, (string) file_get_contents("$dir/$f"));
                }
            }
            foreach ($manifest['files'] as $f) {
                if (($f['part'] ?? null) === $part && empty($f['missing'])) {
                    $abs = $store->absolute((string) $f['storage_path']);
                    if (is_file($abs)) {
                        $zip->addFile((string) $f['path_in_zip'], $abs);
                    }
                }
            }
            $zip->finish();
        });
        $r->headers['Content-Type'] = 'application/zip';
        $r->headers['Content-Disposition'] = 'attachment; filename="' . $name . '"';
        $r->headers['Cache-Control'] = 'private, no-store';
        $r->headers['X-Content-Type-Options'] = 'nosniff';
        return $r;
    }

    /** 'ready' turns 'expired' after 24 h even before the nightly clean-up marks the row. */
    public static function status(App $app, array $row): string
    {
        if ($row['status'] === 'ready' && $row['expires_at'] !== null && strtotime($row['expires_at'] . ' UTC') <= $app->clock->now()->getTimestamp()) {
            return 'expired';
        }
        return (string) $row['status'];
    }

    /** The Export shape (API.md §9.1). Download URLs carry the token only in the 201 reply. */
    private static function view(App $app, Db $db, array $row, ?string $token): array
    {
        $status = self::status($app, $row);
        $urls = [];
        if ($status === 'ready') {
            for ($p = 1; $p <= (int) $row['parts']; $p++) {
                $urls[] = '/api/v1/exports/' . $row['public_id'] . '/download?part=' . $p . ($token !== null ? '&t=' . $token : '');
            }
        }
        $filesBytes = null;
        $manifest = $status === 'ready' ? self::manifestPath($app, $row) : null;
        if ($manifest !== null && is_file($manifest)) {
            $m = json_decode((string) file_get_contents($manifest), true);
            $filesBytes = array_sum(array_map(static fn ($f) => empty($f['missing']) ? (int) $f['size_bytes'] : 0, $m['files'] ?? []));
        }
        return [
            'id' => $row['public_id'],
            'kind' => $row['kind'],
            'status' => $status,
            'parts' => (int) $row['parts'],
            'size_bytes' => $row['size_bytes'] !== null ? (int) $row['size_bytes'] : null,
            'files_bytes' => $filesBytes,
            'file_name' => $row['file_name'],
            'created_at' => Time::iso($row['created_at']),
            'expires_at' => $row['expires_at'] !== null ? Time::iso($row['expires_at']) : null,
            'download_urls' => $urls,
            'requested_by' => (new Refs($db, $app->clock->todayIst()))->user((int) $row['requested_by']),
            'error' => $status === 'failed' ? Strings::get('export_failed') : null,
        ];
    }

    private static function manifestPath(App $app, array $row): ?string
    {
        $root = rtrim($app->env->get('STORAGE_ROOT'), '/');
        return $root === '' ? null : "$root/exports/{$row['public_id']}/manifest.json";
    }

    /** 32 random bytes, URL-safe. */
    private static function newToken(): string
    {
        return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    }

    public static function removeDir(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }
        $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($dir, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($it as $f) {
            $f->isDir() ? @rmdir($f->getPathname()) : @unlink($f->getPathname());
        }
        @rmdir($dir);
    }
}
