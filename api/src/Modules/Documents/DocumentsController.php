<?php
declare(strict_types=1);

namespace AM\Modules\Documents;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Db\UnitOfWork;
use AM\Http\BaseController;
use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\RateLimiter;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Kernel\Strings;
use AM\Kernel\Ulid;
use AM\Repo\BaseRepository;
use AM\Repo\Cursor;
use AM\Repo\Refs;
use DateTimeImmutable;
use DateTimeZone;

/** /documents (API.md §6.9 and §8, FEATURES B7). */
final class DocumentsController
{
    public const MAX_BYTES = 10485760; // 10 MB (DB ck_files_size)
    public const QUERY = ['type', 'vendor', 'event', 'payment', 'q', 'sort', 'limit', 'cursor'];

    /* ------------------------------------------------------------------ list */

    public static function list(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        $db = $app->db();
        $q = $request->query;
        [$vis, $args] = DocumentDef::visibleSql($viewer);
        $where = ['d.deleted_at IS NULL', $vis];
        if (isset($q['type'])) {
            if (!array_key_exists($q['type'], DocumentDef::TYPES)) {
                throw HttpError::make(400, 'bad_request');
            }
            $where[] = 'd.type = ?';
            $args[] = $q['type'];
        }
        foreach (['vendor' => ['vendors', 'vendor_id'], 'event' => ['events', 'event_id'], 'payment' => ['payments', 'payment_id']] as $k => [$table, $col]) {
            if (isset($q[$k])) {
                $id = $db->value("SELECT id FROM `$table` WHERE public_id = ?", [(string) $q[$k]]);
                if ($id === null) {
                    throw HttpError::make(404, 'not_found');
                }
                $where[] = "d.$col = ?";
                $args[] = (int) $id;
            }
        }
        if (($q['q'] ?? '') !== '') {
            $where[] = 'd.title LIKE ?';
            $args[] = '%' . addcslashes(mb_substr(trim((string) $q['q']), 0, 100), '%_\\') . '%';
        }
        if (($q['sort'] ?? '-created_at') !== '-created_at') {
            throw HttpError::make(400, 'bad_request');
        }
        $cursor = new Cursor('documents', array_diff_key($q, ['cursor' => 1, 'limit' => 1]));
        $limit = Cursor::limit($request, 30);
        $where[] = 'd.id < ?';
        $args[] = $cursor->before($request);
        $take = $limit + 1;
        $rows = $db->all('SELECT d.* FROM documents d WHERE ' . implode(' AND ', $where) . " ORDER BY d.id DESC LIMIT $take", $args);
        [$rows, $meta] = $cursor->page($rows, $limit);
        $refs = new Refs($db, $app->clock->todayIst());
        return Response::ok(array_map(static fn ($r) => DocumentDef::present($app, $db, $refs, $r, $viewer), $rows), 200, $meta);
    }

    public static function get(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        $db = $app->db();
        $row = BaseRepository::find($db, DocumentDef::class, $params['id'], false, false);
        if (!DocumentDef::canView($viewer, $row)) {
            throw HttpError::make(403, 'forbidden'); // SEC-02 / AC-DOC-03
        }
        $view = DocumentDef::present($app, $db, new Refs($db, $app->clock->todayIst()), $row, $viewer);
        return Response::ok($view)->withHeader('ETag', '"' . $view['version'] . '"');
    }

    /* ---------------------------------------------------------------- upload */

    /** POST /documents — multipart (API.md §8.2). One file, one document. */
    public static function upload(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireEditor($viewer);
        $file = $request->files['file'] ?? null;
        try {
            return self::store($request, $app, $viewer, $file);
        } finally {
            // A test temp file that was not moved into place is removed (real PHP uploads vanish on their own).
            if ($file !== null && !$file['php_upload'] && is_file($file['tmp_name'])) {
                @unlink($file['tmp_name']);
            }
        }
    }

    private static function store(Request $request, App $app, array $viewer, ?array $file): Response
    {
        $declared = (int) $request->header('content-length', '0');
        if ($file === null || in_array($file['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
            if ($declared > self::MAX_BYTES || ($file !== null && $file['error'] !== UPLOAD_ERR_OK)) {
                throw self::tooBig(max($declared, (int) ($file['size'] ?? 0)));
            }
            throw new HttpError(422, 'validation_failed', Strings::get('file_required'), ['fields' => ['file' => Strings::get('file_required')]]);
        }
        if ($file['error'] !== UPLOAD_ERR_OK || $file['size'] === 0) {
            throw new HttpError(422, 'validation_failed', Strings::get('file_required'), ['fields' => ['file' => Strings::get('file_required')]]);
        }
        (new RateLimiter($app))->hit('upload:user:' . $viewer['id'], 60, 3600); // API.md §10.1
        $form = $request->form;
        $type = $form['type'] ?? '';
        $fields = [];
        if (!array_key_exists($type, DocumentDef::TYPES)) {
            $fields['type'] = Strings::get('field_bad_choice');
        }
        $title = trim((string) ($form['title'] ?? ''));
        if (mb_strlen($title) > 120) {
            $fields['title'] = Strings::get('field_too_long', ['max' => 120]);
        }
        $notes = trim((string) ($form['notes'] ?? ''));
        if (mb_strlen($notes) > 5000) {
            $fields['notes'] = Strings::get('field_too_long', ['max' => 5000]);
        }
        $private = in_array($form['is_private'] ?? '', ['true', '1'], true);
        if (isset($form['is_private']) && $private && !Permissions::isAdmin($viewer)) {
            throw HttpError::make(403, 'forbidden'); // only Ayush and Mahi mark documents private
        }
        if (!isset($form['is_private']) && $type === 'id' && Permissions::isAdmin($viewer)) {
            $private = true; // IDs are private unless said otherwise (B7)
        }
        if (($form['payment_id'] ?? '') !== '') {
            Permissions::requireMoney($viewer); // linking a receipt to a payment needs money access
        }
        $sha = strtolower((string) ($form['sha256'] ?? ''));
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
        $mime = (string) (new \finfo(FILEINFO_MIME_TYPE))->file($tmp); // by content, never by name (AC-DOC-06)
        if (in_array($mime, ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'], true)) {
            throw new HttpError(415, 'unsupported_type', Strings::get('heic_not_supported'));
        }
        if (!isset(FileStore::EXT[$mime])) {
            throw HttpError::make(415, 'unsupported_type');
        }
        $w = $h = null;
        if ($mime !== 'application/pdf') {
            $info = @getimagesize($tmp);
            if ($info === false) {
                throw HttpError::make(415, 'unsupported_type');
            }
            [$w, $h] = [min((int) $info[0], 65535), min((int) $info[1], 65535)];
        }
        if (!hash_equals($sha, (string) hash_file('sha256', $tmp))) {
            throw HttpError::make(422, 'checksum_mismatch'); // the temp file is dropped (finally)
        }
        $store = FileStore::fromEnv($app->env);

        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $viewer, $file, $form, $type, $title, $notes, $private, $sha, $mime, $size, $w, $h, $tmp, $store): Response {
            $key = (string) $request->attr('idem_key');
            if ($key !== '' && ($old = $db->one('SELECT * FROM documents WHERE client_uuid = ?', [$key])) !== null) {
                return self::reply($app, $db, $old, $viewer, 200);
            }
            $links = self::links($db, $form);
            $existing = $db->one('SELECT * FROM files WHERE sha256 = ? FOR UPDATE', [$sha]);
            $newPath = null;
            try {
                if ($existing !== null) {
                    $store->repair($existing['storage_path'], $tmp, (int) $existing['size_bytes']);
                    if (!in_array($form['allow_duplicate'] ?? '', ['true', '1'], true)) {
                        $docs = $db->all('SELECT public_id, title, is_private, payment_id FROM documents WHERE file_id = ? AND deleted_at IS NULL ORDER BY id LIMIT 5', [$existing['id']]);
                        $seen = array_values(array_filter($docs, static fn ($d) => DocumentDef::canView($viewer, $d)));
                        if ($docs !== []) {
                            $name = $seen[0]['title'] ?? 'another document';
                            throw new HttpError(409, 'duplicate_found', Strings::get('document_duplicate', ['title' => $name]), [
                                'matches' => array_map(static fn ($d) => ['id' => $d['public_id'], 'name' => $d['title'], 'match_on' => 'sha256'], $seen),
                            ]);
                        }
                    }
                    $fileId = (int) $existing['id'];
                } else {
                    $ym = (new DateTimeImmutable('now', new DateTimeZone('Asia/Kolkata')))->setTimestamp($app->clock->now()->getTimestamp())->format('Y-m');
                    $newPath = $store->put($tmp, $mime, $file['php_upload'], $ym);
                    $db->run(
                        'INSERT INTO files (public_id, storage_path, original_name, mime_type, size_bytes, sha256, width_px, height_px, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [Ulid::generate($app->clock), $newPath, mb_substr(basename($file['name']) ?: 'file', 0, 255), $mime, $size, $sha, $w, $h, $app->clock->dbNow(), $viewer['id']],
                    );
                    $fileId = (int) $db->pdo->lastInsertId();
                }
                $values = [
                    'title' => $title !== '' ? $title : self::autoTitle($db, $app, $type, $links),
                    'type' => $type, 'file_id' => $fileId, 'is_private' => (int) $private, 'notes' => $notes !== '' ? $notes : null,
                ] + $links;
                $r = BaseRepository::create($app, $db, $request, DocumentDef::class, $values);
                return self::reply($app, $db, $r['row'], $viewer, 201);
            } catch (\Throwable $e) {
                if ($newPath !== null) {
                    @unlink($store->absolute($newPath)); // the transaction failed: no file without a row
                }
                throw $e;
            }
        });
    }

    /** payment_id, vendor_id, event_id from the form → live row ids. */
    private static function links(Db $db, array $form): array
    {
        $out = ['payment_id' => null, 'vendor_id' => null, 'event_id' => null];
        $bad = [];
        foreach (['payment_id' => 'payments', 'vendor_id' => 'vendors', 'event_id' => 'events'] as $k => $table) {
            $v = (string) ($form[$k] ?? '');
            if ($v === '') {
                continue;
            }
            $id = $db->value("SELECT id FROM `$table` WHERE public_id = ? AND deleted_at IS NULL", [$v]);
            if ($id === null) {
                $bad[$k] = Strings::get('field_bad_choice');
            } else {
                $out[$k] = (int) $id;
            }
        }
        if ($bad !== []) {
            throw new HttpError(422, 'validation_failed', Strings::get('validation_failed_one'), ['fields' => $bad]);
        }
        if ($out['payment_id'] !== null && $out['vendor_id'] === null) { // a receipt also shows on its vendor's page
            $vid = $db->value('SELECT vendor_id FROM payments WHERE id = ?', [$out['payment_id']]);
            $out['vendor_id'] = $vid !== null ? (int) $vid : null;
        }
        return $out;
    }

    /** "Receipt – Shree Tent House – 12 Oct 2026" (FEATURES B7). */
    private static function autoTitle(Db $db, App $app, string $type, array $links): string
    {
        $what = null;
        if ($links['vendor_id'] !== null) {
            $what = $db->value('SELECT name FROM vendors WHERE id = ?', [$links['vendor_id']]);
        }
        if ($what === null && $links['event_id'] !== null) {
            $what = $db->value('SELECT name FROM events WHERE id = ?', [$links['event_id']]);
        }
        if ($what === null && $links['payment_id'] !== null) {
            $what = $db->value('SELECT title FROM payments WHERE id = ?', [$links['payment_id']]);
        }
        $date = (new DateTimeImmutable($app->clock->todayIst()))->format('j M Y');
        return mb_substr(implode(' – ', array_filter([DocumentDef::TYPES[$type], $what, $date])), 0, 120);
    }

    private static function tooBig(int $bytes): HttpError
    {
        $mb = $bytes > 0 ? rtrim(rtrim(number_format($bytes / 1048576, 1), '0'), '.') . ' MB' : 'over 10 MB';
        return new HttpError(413, 'file_too_big', Strings::get('file_too_big', ['size' => $mb]));
    }

    /* -------------------------------------------------------------- download */

    /** GET /documents/{id}/file — same visibility as the document; single byte ranges (206). */
    public static function file(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        $db = $app->db();
        $row = BaseRepository::find($db, DocumentDef::class, $params['id']);
        if ($row['deleted_at'] !== null && !Permissions::isAdmin($viewer)) {
            throw HttpError::make(404, 'not_found'); // admins can still open it from Deleted items
        }
        if (!DocumentDef::canView($viewer, $row)) {
            throw HttpError::make(403, 'forbidden');
        }
        $f = $db->one('SELECT * FROM files WHERE id = ?', [$row['file_id']]);
        $path = $f !== null ? FileStore::fromEnv($app->env)->absolute($f['storage_path']) : '';
        if ($f === null || !is_file($path)) {
            throw HttpError::make(404, 'not_found');
        }
        $size = (int) filesize($path);
        $start = 0;
        $end = $size - 1;
        $status = 200;
        $range = $request->header('range');
        if ($range !== '') {
            if (!preg_match('/^bytes=(\d*)-(\d*)$/', trim($range), $m) || ($m[1] === '' && $m[2] === '')) {
                return (new Response(416))->withHeader('Content-Range', "bytes */$size");
            }
            if ($m[1] === '') { // the last N bytes
                $start = max(0, $size - (int) $m[2]);
            } else {
                $start = (int) $m[1];
                $end = $m[2] === '' ? $size - 1 : min((int) $m[2], $size - 1);
            }
            if ($start > $end || $start >= $size) {
                return (new Response(416))->withHeader('Content-Range', "bytes */$size");
            }
            $status = 206;
        }
        $name = (string) $f['original_name'];
        $disposition = ($request->query['download'] ?? '') === '1' ? 'attachment' : 'inline';
        $r = Response::file($path, $start, $end - $start + 1, $status)
            ->withHeader('Content-Type', (string) $f['mime_type'])
            ->withHeader('Content-Disposition', $disposition . "; filename*=UTF-8''" . rawurlencode($name))
            ->withHeader('Content-Length', (string) ($end - $start + 1))
            ->withHeader('Cache-Control', 'private, no-store')
            ->withHeader('X-Content-Type-Options', 'nosniff')
            ->withHeader('ETag', '"' . $f['sha256'] . '"')
            ->withHeader('Accept-Ranges', 'bytes');
        if ($status === 206) {
            $r->withHeader('Content-Range', "bytes $start-$end/$size");
        }
        return $r;
    }

    /* ------------------------------------------------------ edit and delete */

    /** Admins all; Family their own uploads (and payment links need money, private needs admin). */
    public static function canWrite(): callable
    {
        return static function (?array $v, string $action, ?array $row): void {
            Permissions::requireEditor($v);
            if ($row !== null) {
                DocumentDef::assertCanEdit($v, $row);
            }
        };
    }

    public static function update(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        $json = $request->attr('json');
        if (is_array($json) && array_key_exists('is_private', $json)) {
            Permissions::requireAdmin($viewer);
        }
        if (is_array($json) && ($json['payment_id'] ?? null) !== null) {
            Permissions::requireMoney($viewer);
        }
        return BaseController::update($request, $app, $params, DocumentDef::class, self::canWrite());
    }

    private static function reply(App $app, Db $db, array $row, ?array $viewer, int $status): Response
    {
        $view = DocumentDef::present($app, $db, new Refs($db, $app->clock->todayIst()), $row, $viewer);
        return Response::ok($view, $status)->withHeader('ETag', '"' . $view['version'] . '"');
    }
}
