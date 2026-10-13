<?php
declare(strict_types=1);

namespace AM\Modules\Vault;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Db\UnitOfWork;
use AM\Kernel\App;
use AM\Kernel\HttpError;
use AM\Kernel\Request;
use AM\Kernel\Response;
use AM\Kernel\Strings;
use AM\Kernel\Ulid;
use AM\Modules\Workspaces\WorkspaceDef;
use AM\Repo\BaseRepository;
use AM\Repo\Cursor;
use AM\Repo\Refs;
use AM\Validation\Fields;
use PDOException;

/**
 * The Attachment Vault (version 1.0.17, API.md §6.9b). Ayush and Mahi only.
 *
 * Files of any size arrive in 2 MB pieces (hosts cap one request at ~4.5 MB):
 *   POST /attachment-uploads            {name, mime_type, size_bytes, sha256} → {upload_id, chunk_size, chunk_count, received}
 *   POST /attachment-uploads/{id}/chunks  multipart: seq, chunk           (a piece sent twice is stored once)
 *   POST /attachment-uploads/{id}/finish  checks every piece and the SHA-256 of the whole
 * then POST /attachments {kind, upload_id | url | body, title, …, workspace_id?, section?}.
 * A file already in the Vault (same SHA-256) is not sent again: start replies complete = true.
 */
final class VaultController
{
    public const CHUNK = 2097152; // 2 MB; every piece is this size except the last
    public const STORAGE_WARN_BYTES = 2684354560; // 2.5 GB of the 3 GB database
    public const LIST_QUERY = ['q', 'workspace', 'section', 'kind', 'favourite', 'vendor', 'unlinked', 'limit', 'cursor'];

    /* ------------------------------------------------------------ uploads */

    public static function startUpload(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireAdmin($viewer);
        $f = Fields::from($request->attr('json'));
        $f->only(['name', 'mime_type', 'size_bytes', 'sha256']);
        $name = $f->text('name', 255, true);
        $mime = strtolower(trim((string) ($f->value('mime_type') ?? '')));
        if ($mime === '' || !preg_match('#^[a-z0-9.+-]+/[a-z0-9.+-]+$#', $mime) || strlen($mime) > 100) {
            $mime = 'application/octet-stream';
        }
        $size = $f->value('size_bytes');
        if (!is_int($size) || $size < 1) {
            $f->error('size_bytes', Strings::get('field_required'));
        }
        $sha = strtolower((string) ($f->value('sha256') ?? ''));
        if (!preg_match('/^[0-9a-f]{64}$/', $sha)) {
            $f->error('sha256', Strings::get('field_required'));
        }
        $f->fail();
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $viewer, $name, $mime, $size, $sha): Response {
            $done = $db->one('SELECT * FROM vault_files WHERE sha256 = ? AND size_bytes = ? AND is_complete = 1 ORDER BY id LIMIT 1', [$sha, $size]);
            if ($done !== null) {
                return Response::ok(self::uploadView($db, $done), 200);
            }
            $count = (int) ceil($size / self::CHUNK);
            $db->run(
                'INSERT INTO vault_files (public_id, sha256, mime_type, original_name, size_bytes, chunk_count, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [Ulid::generate($app->clock), $sha, $mime, $name, $size, $count, $app->clock->dbNow(), $viewer['id']],
            );
            $row = $db->one('SELECT * FROM vault_files WHERE id = ?', [(int) $db->pdo->lastInsertId()]);
            return Response::ok(self::uploadView($db, $row), 201);
        });
    }

    public static function chunk(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireAdmin($viewer);
        $file = $request->files['chunk'] ?? null;
        try {
            $seq = $request->form['seq'] ?? '';
            if (!ctype_digit((string) $seq) || $file === null || $file['error'] !== UPLOAD_ERR_OK) {
                throw new HttpError(422, 'validation_failed', Strings::get('file_required'), ['fields' => ['chunk' => Strings::get('file_required')]]);
            }
            $bytes = (string) file_get_contents($file['tmp_name']);
            return UnitOfWork::run($app, $request, function (Db $db) use ($params, $seq, $bytes): Response {
                $vf = self::pendingFile($db, $params['id']);
                $seq = (int) $seq;
                $last = (int) $vf['chunk_count'] - 1;
                $want = $seq < $last ? self::CHUNK : (int) $vf['size_bytes'] - self::CHUNK * $last;
                if ($seq > $last || strlen($bytes) !== $want) {
                    throw new HttpError(422, 'validation_failed', Strings::get('upload_not_complete'), ['fields' => ['chunk' => Strings::get('upload_not_complete')]]);
                }
                $db->run('INSERT INTO vault_file_chunks (file_id, seq, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)', [$vf['id'], $seq, $bytes]);
                return Response::ok(self::uploadView($db, $vf));
            });
        } finally {
            if ($file !== null && !$file['php_upload'] && is_file($file['tmp_name'])) {
                @unlink($file['tmp_name']);
            }
        }
    }

    public static function finish(Request $request, App $app, array $params): Response
    {
        Permissions::requireAdmin($request->attr('user'));
        $db = $app->db();
        $vf = $db->one('SELECT * FROM vault_files WHERE public_id = ?', [$params['id']]);
        if ($vf === null) {
            throw HttpError::make(404, 'not_found');
        }
        $meta = null;
        if ((int) $vf['is_complete'] !== 1) {
            $have = (int) $db->value('SELECT COUNT(*) FROM vault_file_chunks WHERE file_id = ?', [$vf['id']]);
            if ($have !== (int) $vf['chunk_count']) {
                throw new HttpError(422, 'upload_incomplete', Strings::get('upload_not_complete'), ['received' => self::received($db, (int) $vf['id'])]);
            }
            $hash = hash_init('sha256');
            $first = '';
            for ($i = 0; $i < (int) $vf['chunk_count']; $i++) {
                $data = (string) $db->value('SELECT data FROM vault_file_chunks WHERE file_id = ? AND seq = ?', [$vf['id'], $i]);
                if ($i === 0) {
                    $first = $data;
                }
                hash_update($hash, $data);
            }
            if (!hash_equals((string) $vf['sha256'], hash_final($hash))) {
                // Outside any transaction, so the clean-up stays: the phone sends every piece again.
                $db->run('DELETE FROM vault_file_chunks WHERE file_id = ?', [$vf['id']]);
                throw HttpError::make(422, 'checksum_mismatch');
            }
            $mime = (string) (new \finfo(FILEINFO_MIME_TYPE))->buffer($first);
            if ($mime === '' || $mime === 'application/octet-stream' || $mime === 'text/plain') {
                $mime = (string) $vf['mime_type'];
            }
            $w = $h = null;
            if (str_starts_with($mime, 'image/') && ($info = @getimagesizefromstring($first)) !== false) {
                [$w, $h] = [min((int) $info[0], 65535), min((int) $info[1], 65535)];
            }
            $meta = [$mime, $w, $h];
        }
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $vf, $meta): Response {
            if ($meta !== null) {
                $db->run('UPDATE vault_files SET is_complete = 1, completed_at = ?, mime_type = ?, width_px = ?, height_px = ? WHERE id = ? AND is_complete = 0',
                    [$app->clock->dbNow(), $meta[0], $meta[1], $meta[2], $vf['id']]);
            }
            return Response::ok(self::uploadView($db, $db->one('SELECT * FROM vault_files WHERE id = ?', [$vf['id']])));
        });
    }

    private static function pendingFile(Db $db, string $publicId): array
    {
        $vf = $db->one('SELECT * FROM vault_files WHERE public_id = ? FOR UPDATE', [$publicId]);
        if ($vf === null) {
            throw HttpError::make(404, 'not_found');
        }
        return $vf;
    }

    /** @return list<int> */
    private static function received(Db $db, int $fileId): array
    {
        return array_map('intval', array_column($db->all('SELECT seq FROM vault_file_chunks WHERE file_id = ? ORDER BY seq', [$fileId]), 'seq'));
    }

    private static function uploadView(Db $db, array $vf): array
    {
        $complete = (int) $vf['is_complete'] === 1;
        return [
            'upload_id' => $vf['public_id'],
            'complete' => $complete,
            'chunk_size' => self::CHUNK,
            'chunk_count' => (int) $vf['chunk_count'],
            'received' => $complete ? range(0, (int) $vf['chunk_count'] - 1) : self::received($db, (int) $vf['id']),
            'mime_type' => $vf['mime_type'],
            'size_bytes' => (int) $vf['size_bytes'],
        ];
    }

    /* -------------------------------------------------------- attachments */

    public static function list(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireAdmin($viewer);
        $db = $app->db();
        $q = $request->query;
        $where = ['a.deleted_at IS NULL', '(a.document_id IS NULL OR EXISTS (SELECT 1 FROM documents d WHERE d.id = a.document_id AND d.deleted_at IS NULL))'];
        $args = [];
        if (($q['q'] ?? '') !== '') {
            $like = '%' . addcslashes(mb_substr(trim((string) $q['q']), 0, 100), '%_\\') . '%';
            $where[] = '(a.code LIKE ? OR a.title LIKE ? OR a.note LIKE ?)';
            array_push($args, $like, $like, $like);
        }
        if (isset($q['kind'])) {
            if (!isset(AttachmentDef::KINDS[$q['kind']])) {
                throw HttpError::make(400, 'bad_request');
            }
            $where[] = 'a.kind = ?';
            $args[] = $q['kind'];
        }
        if (($q['favourite'] ?? '') === '1') {
            $where[] = 'a.is_favourite = 1';
        }
        if (isset($q['vendor'])) {
            $where[] = 'a.vendor_id = (SELECT id FROM vendors WHERE public_id = ?)';
            $args[] = (string) $q['vendor'];
        }
        if (isset($q['section']) && !isset(WorkspaceDef::SECTIONS[$q['section']])) {
            throw HttpError::make(400, 'bad_request');
        }
        if (isset($q['workspace']) || isset($q['section'])) {
            $sub = 'SELECT 1 FROM attachment_links l JOIN workspaces w ON w.id = l.workspace_id WHERE l.attachment_id = a.id AND l.deleted_at IS NULL AND w.deleted_at IS NULL';
            if (isset($q['workspace'])) {
                $sub .= ' AND w.public_id = ?';
                $args[] = (string) $q['workspace'];
            }
            if (isset($q['section'])) {
                $sub .= ' AND l.section = ?';
                $args[] = (string) $q['section'];
            }
            $where[] = "EXISTS ($sub)";
        }
        if (($q['unlinked'] ?? '') === '1') {
            $where[] = 'a.document_id IS NULL AND NOT EXISTS (SELECT 1 FROM attachment_links l JOIN workspaces w ON w.id = l.workspace_id WHERE l.attachment_id = a.id AND l.deleted_at IS NULL AND w.deleted_at IS NULL)';
        }
        $cursor = new Cursor('attachments', array_diff_key($q, ['cursor' => 1, 'limit' => 1]));
        $limit = Cursor::limit($request, 50);
        $where[] = 'a.id < ?';
        $args[] = $cursor->before($request);
        $take = $limit + 1;
        $rows = $db->all('SELECT a.* FROM attachments a WHERE ' . implode(' AND ', $where) . " ORDER BY a.id DESC LIMIT $take", $args);
        [$rows, $meta] = $cursor->page($rows, $limit);
        $refs = new Refs($db, $app->clock->todayIst());
        $meta['storage'] = self::storage($db);
        return Response::ok(array_map(static fn ($r) => AttachmentDef::present($app, $db, $refs, $r, $viewer), $rows), 200, $meta);
    }

    /** How full the database is (Hostinger: 3 GB per database). */
    public static function storage(Db $db): array
    {
        $used = (int) ($db->value('SELECT COALESCE(SUM(data_length + index_length), 0) FROM information_schema.TABLES WHERE table_schema = DATABASE()') ?? 0);
        $vault = (int) ($db->value('SELECT COALESCE(SUM(size_bytes), 0) FROM vault_files WHERE is_complete = 1') ?? 0);
        return ['database_bytes' => $used, 'vault_bytes' => $vault, 'limit_bytes' => 3221225472, 'warn' => $used >= self::STORAGE_WARN_BYTES];
    }

    public static function get(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireAdmin($viewer);
        $db = $app->db();
        $row = BaseRepository::find($db, AttachmentDef::class, $params['id']);
        return self::reply($app, $db, $row, $viewer, 200);
    }

    /** GET /attachments/check-code?code=&except= — the editable ID, checked while typing. */
    public static function checkCode(Request $request, App $app, array $params): Response
    {
        Permissions::requireAdmin($request->attr('user'));
        $db = $app->db();
        $code = trim((string) ($request->query['code'] ?? ''));
        if (!preg_match(AttachmentDef::CODE_RE, $code)) {
            return Response::ok(['available' => false, 'message' => Strings::get('attachment_code_format')]);
        }
        $except = 0;
        if (isset($request->query['except'])) {
            $except = (int) ($db->value('SELECT id FROM attachments WHERE public_id = ?', [(string) $request->query['except']]) ?? 0);
        }
        $owner = AttachmentDef::codeOwner($db, $code, $except);
        return Response::ok($owner === null ? ['available' => true, 'message' => null]
            : ['available' => false, 'message' => Strings::get('attachment_code_taken', ['code' => $code, 'title' => $owner['title'], 'where' => $owner['where']])]);
    }

    public static function create(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireAdmin($viewer);
        $json = $request->attr('json');
        $f = Fields::from($json);
        $kind = $f->enum('kind', array_keys(AttachmentDef::KINDS), true);
        $values = AttachmentDef::input($app, $f, true, null);
        $db = $app->db();
        $fileId = null;
        $uploadId = $f->value('upload_id');
        if (in_array($kind, ['photo', 'video', 'document'], true) && !($kind === 'video' && ($values['url'] ?? null) !== null)) {
            $vf = is_string($uploadId) ? $db->one('SELECT id, is_complete FROM vault_files WHERE public_id = ?', [$uploadId]) : null;
            if ($vf === null || (int) $vf['is_complete'] !== 1) {
                $f->error('upload_id', Strings::get('attachment_needs_file'));
            } else {
                $fileId = (int) $vf['id'];
            }
        }
        $workspaceId = null;
        $section = 'general';
        if ($f->has('workspace_id')) {
            $workspaceId = is_string($f->value('workspace_id')) ? $db->value('SELECT id FROM workspaces WHERE public_id = ? AND deleted_at IS NULL', [$f->value('workspace_id')]) : null;
            if ($workspaceId === null) {
                $f->error('workspace_id', Strings::get('field_bad_link'));
            }
            $section = $f->enum('section', array_keys(WorkspaceDef::SECTIONS)) ?? 'general';
        }
        $f->fail();
        try {
            return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $viewer, $kind, $values, $fileId, $workspaceId, $section): Response {
                $values += ['kind' => $kind, 'file_id' => $fileId];
                $values['code'] ??= AttachmentDef::nextCode($db);
                $r = BaseRepository::create($app, $db, $request, AttachmentDef::class, $values);
                if ($r['created'] && $workspaceId !== null) {
                    self::addLink($app, $db, $request, (int) $r['row']['id'], (int) $workspaceId, $section, true);
                }
                return self::reply($app, $db, $r['row'], $viewer, $r['created'] ? 201 : 200);
            });
        } catch (PDOException $e) {
            if ($e->getCode() === '23000' && str_contains($e->getMessage(), 'uq_attachments_code')) {
                throw new HttpError(422, 'validation_failed', Strings::get('validation_failed_one'), ['fields' => ['code' => Strings::get('attachment_code_format')]]);
            }
            throw $e;
        }
    }

    /** POST /attachments/{id}/links {workspace_id, section} — use it in one more place. */
    public static function link(Request $request, App $app, array $params): Response
    {
        $viewer = $request->attr('user');
        Permissions::requireAdmin($viewer);
        $f = Fields::from($request->attr('json'));
        $f->only(['workspace_id', 'section']);
        $db = $app->db();
        $ws = is_string($f->value('workspace_id')) ? $db->value('SELECT id FROM workspaces WHERE public_id = ? AND deleted_at IS NULL', [$f->value('workspace_id')]) : null;
        if ($ws === null) {
            $f->error('workspace_id', Strings::get('field_bad_link'));
        }
        $section = $f->enum('section', array_keys(WorkspaceDef::SECTIONS)) ?? 'general';
        $f->fail();
        return UnitOfWork::run($app, $request, function (Db $db) use ($app, $request, $viewer, $params, $ws, $section): Response {
            $row = BaseRepository::find($db, AttachmentDef::class, $params['id'], true, false);
            self::addLink($app, $db, $request, (int) $row['id'], (int) $ws, $section, false);
            return self::reply($app, $db, $db->one('SELECT * FROM attachments WHERE id = ?', [$row['id']]), $viewer, 200);
        });
    }

    private static function addLink(App $app, Db $db, Request $request, int $attachmentId, int $workspaceId, string $section, bool $fresh): void
    {
        $exists = $db->value('SELECT 1 FROM attachment_links WHERE attachment_id = ? AND workspace_id = ? AND section = ? AND target_type IS NULL AND deleted_at IS NULL',
            [$attachmentId, $workspaceId, $section]);
        if ($exists !== null) {
            return; // already used there: nothing to add
        }
        // The first link of a new attachment reuses the request's key on its own table; a later link is
        // made without one (the request's key already guards the whole call through its stored reply).
        $key = $request->attributes['idem_key'] ?? null;
        if (!$fresh) {
            $request->attributes['idem_key'] = '';
        }
        try {
            BaseRepository::create($app, $db, $request, AttachmentLinkDef::class, ['attachment_id' => $attachmentId, 'workspace_id' => $workspaceId, 'section' => $section]);
        } finally {
            $request->attributes['idem_key'] = $key;
        }
    }

    /** GET /attachments/{id}/file — the bytes, with single byte ranges (videos on iPhone need them). */
    public static function file(Request $request, App $app, array $params): Response
    {
        Permissions::requireAdmin($request->attr('user'));
        $db = $app->db();
        $row = BaseRepository::find($db, AttachmentDef::class, $params['id']);
        $vf = $row['file_id'] !== null ? $db->one('SELECT * FROM vault_files WHERE id = ? AND is_complete = 1', [$row['file_id']]) : null;
        if ($vf === null) {
            throw HttpError::make(404, 'not_found');
        }
        $size = (int) $vf['size_bytes'];
        $start = 0;
        $end = $size - 1;
        $status = 200;
        $range = $request->header('range');
        if ($range !== '') {
            if (!preg_match('/^bytes=(\d*)-(\d*)$/', trim($range), $m) || ($m[1] === '' && $m[2] === '')) {
                return (new Response(416))->withHeader('Content-Range', "bytes */$size");
            }
            if ($m[1] === '') {
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
        $fileId = (int) $vf['id'];
        $r = Response::streamed(static function (\Closure $out) use ($db, $fileId, $start, $end): void {
            for ($seq = intdiv($start, self::CHUNK); $seq <= intdiv($end, self::CHUNK); $seq++) {
                $data = (string) $db->value('SELECT data FROM vault_file_chunks WHERE file_id = ? AND seq = ?', [$fileId, $seq]);
                $from = max(0, $start - $seq * self::CHUNK);
                $to = min(strlen($data) - 1, $end - $seq * self::CHUNK);
                $out(substr($data, $from, $to - $from + 1));
            }
        }, $status);
        $r->withHeader('Content-Type', (string) $vf['mime_type'])
            ->withHeader('Content-Disposition', 'inline; filename*=UTF-8\'\'' . rawurlencode((string) $vf['original_name']))
            ->withHeader('Content-Length', (string) ($end - $start + 1))
            ->withHeader('Cache-Control', 'private, no-store')
            ->withHeader('X-Content-Type-Options', 'nosniff')
            ->withHeader('ETag', '"' . $vf['sha256'] . '"')
            ->withHeader('Accept-Ranges', 'bytes');
        if ($status === 206) {
            $r->withHeader('Content-Range', "bytes $start-$end/$size");
        }
        return $r;
    }

    private static function reply(App $app, Db $db, array $row, ?array $viewer, int $status): Response
    {
        $view = AttachmentDef::present($app, $db, new Refs($db, $app->clock->todayIst()), $row, $viewer);
        return Response::ok($view, $status)->withHeader('ETag', '"' . $view['version'] . '"');
    }
}
