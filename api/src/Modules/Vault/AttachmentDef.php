<?php
declare(strict_types=1);

namespace AM\Modules\Vault;

use AM\Auth\Permissions;
use AM\Db\Db;
use AM\Kernel\App;
use AM\Kernel\Strings;
use AM\Kernel\Time;
use AM\Repo\EntityDef;
use AM\Repo\Refs;
use AM\Safety\History;
use AM\Validation\Fields;

/**
 * One attachment in the Vault (version 1.0.17): photo, video, document, link or text,
 * with an editable ID ("code") unique across the app (capitals ignored). Only Ayush and
 * Mahi see the Vault. Deleting it removes it from every place (its links go in the same
 * batch, one Undo). A document from Documents shows here too; it is changed in Documents.
 */
final class AttachmentDef extends EntityDef
{
    public const TABLE = 'attachments';
    public const TYPE = 'attachment';
    public const RESOURCE = 'attachments';
    public const LABEL = 'attachment';
    public const LABEL_PLURAL = 'attachments';
    public const FIELD_LABELS = [
        'code' => 'ID', 'title' => 'Title', 'note' => 'Note', 'url' => 'Link', 'body' => 'Text',
        'is_favourite' => 'Favourite', 'vendor' => 'Vendor', 'task' => 'Task',
    ];
    public const CHILDREN = [AttachmentLinkDef::class => 'attachment_id'];
    public const KINDS = ['photo' => 'Photo', 'video' => 'Video', 'document' => 'Document', 'link' => 'Link', 'text' => 'Text'];
    public const CODE_RE = '/^[A-Za-z0-9_-]{3,30}$/';

    public static function name(array $row): string
    {
        return trim((string) ($row['code'] ?? '') . ' ' . (string) ($row['title'] ?? '')) ?: 'an attachment';
    }

    public static function canView(?array $viewer, array $row): bool
    {
        return Permissions::isAdmin($viewer);
    }

    /** Every place this attachment is used, as "where it's used" lines. @return list<array> */
    public static function usedIn(Db $db, Refs $refs, array $row, ?array $viewer): array
    {
        $out = [];
        if ($row['document_id'] !== null) {
            $d = $db->one('SELECT d.public_id, d.title, v.name AS vendor, p.title AS payment, e.name AS event
                           FROM documents d LEFT JOIN vendors v ON v.id = d.vendor_id LEFT JOIN payments p ON p.id = d.payment_id LEFT JOIN events e ON e.id = d.event_id
                           WHERE d.id = ?', [$row['document_id']]);
            if ($d !== null) {
                $where = array_values(array_filter([$d['vendor'], $d['payment'], $d['event']]));
                $out[] = ['kind' => 'document', 'path' => 'Documents' . ($where !== [] ? ' › ' . implode(' · ', $where) : ''), 'to' => '/documents/' . $d['public_id']];
            }
        }
        foreach ($db->all('SELECT * FROM attachment_links WHERE attachment_id = ? AND deleted_at IS NULL ORDER BY id', [$row['id']]) as $l) {
            $w = $db->one('SELECT public_id, deleted_at FROM workspaces WHERE id = ?', [$l['workspace_id']]);
            if ($w === null || $w['deleted_at'] !== null) {
                continue;
            }
            $out[] = ['kind' => 'link', 'link_id' => $l['public_id'], 'link_version' => (int) $l['version'], 'workspace_id' => $w['public_id'], 'section' => $l['section'],
                'path' => AttachmentLinkDef::path($db, $l), 'to' => '/workspaces/' . $w['public_id'] . '#' . $l['section']];
        }
        return $out;
    }

    public static function present(App $app, Db $db, Refs $refs, array $row, ?array $viewer): array
    {
        $file = null;
        $fileUrl = null;
        if ($row['file_id'] !== null) {
            $f = $db->one('SELECT mime_type, original_name, size_bytes, width_px, height_px, sha256 FROM vault_files WHERE id = ?', [$row['file_id']]) ?? [];
            $file = ['mime_type' => $f['mime_type'] ?? null, 'name' => $f['original_name'] ?? null, 'size_bytes' => (int) ($f['size_bytes'] ?? 0),
                'width_px' => isset($f['width_px']) ? (int) $f['width_px'] : null, 'height_px' => isset($f['height_px']) ? (int) $f['height_px'] : null];
            $fileUrl = '/api/v1/attachments/' . $row['public_id'] . '/file?v=' . substr((string) ($f['sha256'] ?? ''), 0, 16);
        }
        $document = null;
        if ($row['document_id'] !== null) {
            $d = $db->one('SELECT d.public_id, d.title, d.deleted_at, f.mime_type, f.size_bytes, f.width_px, f.height_px, f.original_name
                           FROM documents d JOIN files f ON f.id = d.file_id WHERE d.id = ?', [$row['document_id']]);
            if ($d !== null) {
                $document = ['id' => $d['public_id'], 'title' => $d['title']] + ($d['deleted_at'] !== null ? ['deleted' => true] : []);
                $file = ['mime_type' => $d['mime_type'], 'name' => $d['original_name'], 'size_bytes' => (int) $d['size_bytes'],
                    'width_px' => $d['width_px'] !== null ? (int) $d['width_px'] : null, 'height_px' => $d['height_px'] !== null ? (int) $d['height_px'] : null];
                $fileUrl = '/api/v1/documents/' . $d['public_id'] . '/file';
            }
        }
        $ref = static function (string $table, string $col, $id) use ($db): ?array {
            if ($id === null) {
                return null;
            }
            $r = $db->one("SELECT public_id, `$col` AS name, deleted_at FROM `$table` WHERE id = ?", [$id]);
            return $r === null ? null : ['id' => $r['public_id'], 'name' => $r['name']] + ($r['deleted_at'] !== null ? ['deleted' => true] : []);
        };
        return [
            'id' => $row['public_id'],
            'version' => (int) $row['version'],
            'code' => $row['code'],
            'kind' => $row['kind'],
            'title' => $row['title'],
            'note' => $row['note'],
            'url' => $row['url'],
            'body' => $row['body'],
            'is_favourite' => (bool) $row['is_favourite'],
            'vendor' => $ref('vendors', 'name', $row['vendor_id']),
            'task' => $ref('tasks', 'title', $row['task_id']),
            'file' => $file,
            'file_url' => $fileUrl,
            'document' => $document,
            'used_in' => self::usedIn($db, $refs, $row, $viewer),
            'created_at' => Time::iso($row['created_at']),
            'created_by' => $refs->user($row['created_by'] !== null ? (int) $row['created_by'] : null),
            'updated_at' => Time::iso($row['updated_at']),
            'updated_by' => $refs->user($row['updated_by'] !== null ? (int) $row['updated_by'] : null),
        ];
    }

    /** PATCH (and the details of a new one; the controller adds kind, file and the first link). */
    public static function input(App $app, Fields $f, bool $create, ?array $current): array
    {
        $db = $app->db();
        $f->only($create ? ['kind', 'upload_id', 'workspace_id', 'section', 'code', 'title', 'note', 'url', 'body', 'is_favourite', 'vendor_id', 'task_id']
            : ['code', 'title', 'note', 'url', 'body', 'is_favourite', 'vendor_id', 'task_id']);
        $out = [];
        if ($f->has('code')) {
            $code = trim((string) $f->value('code'));
            if (!preg_match(self::CODE_RE, $code)) {
                $f->error('code', Strings::get('attachment_code_format'));
            } elseif (($taken = self::codeOwner($db, $code, (int) ($current['id'] ?? 0))) !== null) {
                $f->error('code', Strings::get('attachment_code_taken', ['code' => $code, 'title' => $taken['title'], 'where' => $taken['where']]));
            } else {
                $out['code'] = $code;
            }
        }
        if ($create || $f->has('title')) {
            $out['title'] = $f->text('title', 160, true);
        }
        if ($f->has('note') || $create) {
            $out['note'] = $f->text('note', 5000);
        }
        $kind = $current['kind'] ?? null;
        if ($f->has('url') || ($create && in_array($f->value('kind'), ['link', 'video'], true))) {
            $url = trim((string) ($f->value('url') ?? ''));
            if ($url === '') {
                if ($kind === 'link' || ($create && $f->value('kind') === 'link')) {
                    $f->error('url', Strings::get('field_required'));
                }
                $out['url'] = null;
            } elseif (!preg_match('#^https?://\S+$#i', $url) || mb_strlen($url) > 2000) {
                $f->error('url', Strings::get('field_bad_url'));
            } else {
                $out['url'] = $url;
            }
        }
        if ($f->has('body') || ($create && $f->value('kind') === 'text')) {
            $out['body'] = $f->text('body', 20000, ($create && $f->value('kind') === 'text') || $kind === 'text');
        }
        if ($f->has('is_favourite')) {
            $out['is_favourite'] = (int) (bool) $f->bool('is_favourite');
        }
        foreach (['vendor_id' => ['vendors'], 'task_id' => ['tasks']] as $k => [$table]) {
            if (!$f->has($k)) {
                continue;
            }
            $v = $f->value($k);
            if ($v === null || $v === '') {
                $out[$k] = null;
                continue;
            }
            $id = is_string($v) ? $db->value("SELECT id FROM `$table` WHERE public_id = ? AND deleted_at IS NULL", [$v]) : null;
            if ($id === null) {
                $f->error($k, Strings::get('field_bad_link'));
            } else {
                $out[$k] = (int) $id;
            }
        }
        return $out;
    }

    /** Who already has this ID (deleted ones keep theirs). @return array{title:string, where:string}|null */
    public static function codeOwner(Db $db, string $code, int $exceptId = 0): ?array
    {
        $r = $db->one('SELECT * FROM attachments WHERE code = ? AND id <> ?', [$code, $exceptId]);
        if ($r === null) {
            return null;
        }
        if ($r['deleted_at'] !== null) {
            return ['title' => (string) $r['title'], 'where' => 'Deleted items'];
        }
        $l = $db->one('SELECT * FROM attachment_links WHERE attachment_id = ? AND deleted_at IS NULL ORDER BY id LIMIT 1', [$r['id']]);
        $where = $r['document_id'] !== null ? 'Documents' : ($l !== null ? AttachmentLinkDef::path($db, $l) : 'Vault, not linked yet');
        return ['title' => (string) $r['title'], 'where' => $where];
    }

    /** The next free ATT-000001-style ID. */
    public static function nextCode(Db $db): string
    {
        $max = (int) ($db->value("SELECT MAX(CAST(SUBSTRING(code, 5) AS UNSIGNED)) FROM attachments WHERE code LIKE 'ATT-%' AND SUBSTRING(code, 5) REGEXP '^[0-9]+$'") ?? 0);
        do {
            $code = sprintf('ATT-%06d', ++$max);
        } while ($db->value('SELECT 1 FROM attachments WHERE code = ?', [$code]) !== null);
        return $code;
    }

    public static function formatValue(string $field, mixed $value): string
    {
        return $field === 'is_favourite' ? ((int) $value ? 'Yes' : 'No') : History::formatValue($value);
    }

    public static function canWrite(): callable
    {
        return static function (?array $v, string $action, ?array $row): void {
            Permissions::requireAdmin($v);
            if ($row !== null && $row['document_id'] !== null && $action === 'delete') {
                throw new \AM\Kernel\HttpError(422, 'rule_blocked', Strings::get('attachment_doc_in_documents'), ['rule' => 'document_in_documents']);
            }
        };
    }
}
