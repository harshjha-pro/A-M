<?php
declare(strict_types=1);

namespace AM\Modules\HomePhotos;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Db\UnitOfWork;
use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\RateLimiter;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Kernel\Strings;
use AM\Repo\BaseRepository;
use AM\Repo\Refs;

/**
 * /home-photos (version 1.0.16). The image bytes are stored in the database
 * (photo_blobs), so they survive hosts without a lasting disk (Vercel) and go
 * into every backup and export. Upload: admins; list and image: anyone logged in.
 */
final class HomePhotosController
{
    public const MAX_BYTES = 3145728; // 3 MB (DB ck_photo_blobs_size); the phone compresses to ~300 KB first
    public const MIMES = ['image/jpeg', 'image/png', 'image/webp'];

    /** GET /home-photos — every live photo, by place then order. */
    public static function list(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        $db = $app->db();
        $rows = $db->all("SELECT * FROM home_photos WHERE deleted_at IS NULL ORDER BY FIELD(slot, 'cover', 'couple', 'monogram'), sort_order, id");
        $refs = new Refs($db, $app->clock->todayIst());
        $data = array_map(static fn ($r) => HomePhotoDef::present($app, $db, $refs, $r, $viewer), $rows);
        return Response::ok($data, 200, ['total' => count($data), 'max' => HomePhotoDef::MAX]);
    }

    /** POST /home-photos — multipart: file, slot, sha256. */
    public static function upload(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireAdmin($viewer);
        $file = $request->files['file'] ?? null;
        try {
            return self::store($request, $app, $viewer, $file);
        } finally {
            if ($file !== null && !$file['php_upload'] && is_file($file['tmp_name'])) {
                @unlink($file['tmp_name']);
            }
        }
    }

    private static function store(Request $request, App $app, array $viewer, ?array $file): Response
    {
        $declared = (int) $request->header('content-length', '0');
        if ($file === null || $file['error'] !== UPLOAD_ERR_OK || (int) $file['size'] === 0) {
            if ($declared > self::MAX_BYTES || ($file !== null && in_array($file['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true))) {
                throw self::tooBig(max($declared, (int) ($file['size'] ?? 0)));
            }
            throw new HttpError(422, 'validation_failed', Strings::get('file_required'), ['fields' => ['file' => Strings::get('file_required')]]);
        }
        (new RateLimiter($app))->hit('upload:user:' . $viewer['id'], 60, 3600);
        $form = $request->form;
        $slot = (string) ($form['slot'] ?? '');
        $sha = strtolower((string) ($form['sha256'] ?? ''));
        $fields = [];
        if (!isset(HomePhotoDef::SLOTS[$slot])) {
            $fields['slot'] = Strings::get('field_bad_choice');
        }
        if (!preg_match('/^[0-9a-f]{64}$/', $sha)) {
            $fields['sha256'] = Strings::get('field_required');
        }
        if ($fields !== []) {
            throw new HttpError(422, 'validation_failed', Strings::get(count($fields) === 1 ? 'validation_failed_one' : 'validation_failed', ['n' => count($fields)]), ['fields' => $fields]);
        }
        $tmp = $file['tmp_name'];
        $size = (int) filesize($tmp);
        if ($size > self::MAX_BYTES) {
            throw self::tooBig($size);
        }
        $mime = (string) (new \finfo(FILEINFO_MIME_TYPE))->file($tmp); // by content, never by name
        if (in_array($mime, ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'], true)) {
            throw new HttpError(415, 'unsupported_type', Strings::get('heic_not_supported'));
        }
        $info = in_array($mime, self::MIMES, true) ? @getimagesize($tmp) : false;
        if ($info === false) {
            throw new HttpError(415, 'unsupported_type', Strings::get('photo_only_images'));
        }
        if (!hash_equals($sha, (string) hash_file('sha256', $tmp))) {
            throw HttpError::make(422, 'checksum_mismatch');
        }
        $bytes = (string) file_get_contents($tmp);
        [$w, $h] = [min((int) $info[0], 65535), min((int) $info[1], 65535)];

        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $viewer, $slot, $sha, $mime, $size, $w, $h, $bytes): Response {
            $key = (string) $request->attr('idem_key');
            if ($key !== '' && ($old = $db->one('SELECT * FROM home_photos WHERE client_uuid = ?', [$key])) !== null) {
                return self::reply($app, $db, $old, $viewer, 200);
            }
            // Lock the place's rows so two uploads at once can't pass the limit together.
            $live = $db->all('SELECT id, sort_order FROM home_photos WHERE slot = ? AND deleted_at IS NULL FOR UPDATE', [$slot]);
            if (count($live) >= HomePhotoDef::MAX[$slot]) {
                $msg = Strings::get('photo_slot_full', ['max' => HomePhotoDef::MAX[$slot], 'what' => HomePhotoDef::PLURAL[$slot]]);
                throw new HttpError(422, 'validation_failed', $msg, ['fields' => ['slot' => $msg]]);
            }
            $blobId = $db->value('SELECT id FROM photo_blobs WHERE sha256 = ? FOR UPDATE', [$sha]);
            if ($blobId === null) {
                $db->run(
                    'INSERT INTO photo_blobs (sha256, mime_type, size_bytes, width_px, height_px, data, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [$sha, $mime, $size, $w, $h, $bytes, $app->clock->dbNow(), $viewer['id']],
                );
                $blobId = (int) $db->pdo->lastInsertId();
            }
            $order = $live === [] ? 0 : max(array_map(static fn ($r) => (int) $r['sort_order'], $live)) + 1;
            $r = BaseRepository::create($app, $db, $request, HomePhotoDef::class, ['slot' => $slot, 'sort_order' => $order, 'blob_id' => (int) $blobId]);
            return self::reply($app, $db, $r['row'], $viewer, 201);
        });
    }

    /**
     * GET /home-photos/{id}/image — the bytes. The API never lets the browser cache
     * (SecurityHeaders); the service worker keeps a copy instead, keyed by the URL,
     * which carries the image's hash (?v=), so a new photo gets a new URL.
     */
    public static function image(Request $request, App $app, array $params): Response
    {
        $db = $app->db();
        $row = BaseRepository::find($db, HomePhotoDef::class, $params['id']);
        if ($row['deleted_at'] !== null && !Permissions::isAdmin($request->attr('user'))) {
            throw HttpError::make(404, 'not_found');
        }
        $b = $db->one('SELECT sha256, mime_type, data FROM photo_blobs WHERE id = ?', [$row['blob_id']]);
        if ($b === null) {
            throw HttpError::make(404, 'not_found');
        }
        $etag = '"' . $b['sha256'] . '"';
        if (trim($request->header('if-none-match')) === $etag) {
            return (new Response(304))->withHeader('ETag', $etag)->withHeader('Cache-Control', 'private, no-store');
        }
        $r = new Response(200);
        $r->body = (string) $b['data'];
        return $r->withHeader('Content-Type', (string) $b['mime_type'])
            ->withHeader('Content-Length', (string) strlen($r->body))
            ->withHeader('Cache-Control', 'private, no-store')
            ->withHeader('X-Content-Type-Options', 'nosniff')
            ->withHeader('ETag', $etag);
    }

    private static function tooBig(int $bytes): HttpError
    {
        $mb = $bytes > 0 ? rtrim(rtrim(number_format($bytes / 1048576, 1), '0'), '.') . ' MB' : 'over 3 MB';
        return new HttpError(413, 'file_too_big', Strings::get('photo_too_big', ['size' => $mb]));
    }

    private static function reply(App $app, Db $db, array $row, ?array $viewer, int $status): Response
    {
        $view = HomePhotoDef::present($app, $db, new Refs($db, $app->clock->todayIst()), $row, $viewer);
        return Response::ok($view, $status)->withHeader('ETag', '"' . $view['version'] . '"');
    }
}
