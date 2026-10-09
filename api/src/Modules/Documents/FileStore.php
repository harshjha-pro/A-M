<?php
declare(strict_types=1);

namespace AM\Modules\Documents;

use AM\Kernel\Env;
use AM\Kernel\HttpError;
use AM\Kernel\Uuid;

/**
 * Where uploaded files live (API.md §8): <STORAGE_ROOT>/uploads/YYYY/MM/<uuid>.<ext>,
 * outside public_html, with a deny-all .htaccess as a second lock. Files are never
 * overwritten or deleted in Release 1.
 */
final class FileStore
{
    public const EXT = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'application/pdf' => 'pdf'];

    public function __construct(private readonly string $root) {}

    public static function fromEnv(Env $env): self
    {
        $root = rtrim($env->get('STORAGE_ROOT'), '/');
        if ($root === '') {
            throw HttpError::make(503, 'storage_unavailable');
        }
        return new self($root);
    }

    public function absolute(string $relative): string
    {
        if (!preg_match('#^uploads/\d{4}/\d{2}/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$#', $relative)) {
            throw new \LogicException('Bad storage path');
        }
        return $this->root . '/' . $relative;
    }

    /** Move an upload into place. @return string the relative path */
    public function put(string $tmp, string $mime, bool $phpUpload, string $yearMonth): string
    {
        $dir = $this->root . '/uploads';
        if (!is_dir($dir) && !@mkdir($dir, 0750, true) && !is_dir($dir)) {
            throw HttpError::make(503, 'storage_unavailable');
        }
        if (!is_file("$dir/.htaccess")) {
            @file_put_contents("$dir/.htaccess", "Require all denied\n");
        }
        [$y, $m] = explode('-', $yearMonth);
        $rel = sprintf('uploads/%s/%s/%s.%s', $y, $m, Uuid::v4(), self::EXT[$mime]);
        $abs = $this->absolute($rel);
        if (!is_dir(dirname($abs)) && !@mkdir(dirname($abs), 0750, true) && !is_dir(dirname($abs))) {
            throw HttpError::make(503, 'storage_unavailable');
        }
        $ok = $phpUpload ? move_uploaded_file($tmp, $abs) : rename($tmp, $abs);
        if (!$ok) {
            throw HttpError::make(503, 'storage_unavailable');
        }
        @chmod($abs, 0640);
        return $rel;
    }

    /** DATABASE rule 13: a stored file that went missing (or was cut short) is written again from the same bytes. */
    public function repair(string $relative, string $tmp, int $size): void
    {
        $abs = $this->absolute($relative);
        if (is_file($abs) && filesize($abs) === $size) {
            return;
        }
        if (!is_dir(dirname($abs))) {
            @mkdir(dirname($abs), 0750, true);
        }
        @copy($tmp, $abs);
    }
}
