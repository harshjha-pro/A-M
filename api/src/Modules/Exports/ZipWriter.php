<?php
declare(strict_types=1);

namespace AM\Modules\Exports;

use DateTimeImmutable;
use RuntimeException;

/**
 * A ZIP written straight to the reply while it is built (API.md §9.1): data files
 * deflated, photos and PDFs stored as they are. Nothing is copied to disk, so an
 * export never doubles the storage used. Our own small writer instead of a library
 * (decision, Session 11): the server ships no third-party PHP packages.
 *
 * Plain ZIP (no ZIP64): every part stays far below 4 GB (files split at 200 MB).
 * Sizes and CRC are worked out before each local header, so no data descriptors:
 * every unzip tool (Windows, macOS, Android, iPhone Files) reads it.
 */
final class ZipWriter
{
    private const LIMIT = 0xFFFFFFFF;

    /** @var list<array{name:string, crc:int, csize:int, size:int, method:int, offset:int, time:int, date:int}> */
    private array $entries = [];
    private int $offset = 0;
    private bool $done = false;

    /** @param \Closure(string):void $out receives the bytes in order */
    public function __construct(private readonly \Closure $out, private readonly DateTimeImmutable $when) {}

    /** A text file built in memory (CSV, JSON, HTML, README): deflated. */
    public function addString(string $name, string $data): void
    {
        $packed = gzdeflate($data, 6);
        if ($packed === false) {
            throw new RuntimeException('Could not compress ' . $name);
        }
        $crc = (int) hexdec(hash('crc32b', $data));
        $this->header($name, $crc, strlen($packed), strlen($data), 8);
        $this->emit($packed);
    }

    /** A stored file (photo, PDF): read in 1 MB chunks, stored as it is. */
    public function addFile(string $name, string $path): void
    {
        $size = filesize($path);
        $crc = hash_file('crc32b', $path);
        if ($size === false || $crc === false) {
            throw new RuntimeException('Could not read ' . $name);
        }
        $this->header($name, (int) hexdec($crc), $size, $size, 0);
        $fh = fopen($path, 'rb');
        if ($fh === false) {
            throw new RuntimeException('Could not open ' . $name);
        }
        try {
            while (!feof($fh)) {
                $chunk = fread($fh, 1048576);
                if ($chunk === false) {
                    throw new RuntimeException('Could not read ' . $name);
                }
                if ($chunk !== '') {
                    $this->emit($chunk);
                }
            }
        } finally {
            fclose($fh);
        }
    }

    /** Central directory and end record. */
    public function finish(): void
    {
        if ($this->done) {
            return;
        }
        $start = $this->offset;
        foreach ($this->entries as $e) {
            $this->emit(pack('VvvvvvvVVVvvvvvVV', 0x02014b50, 20, 20, 0x0800, $e['method'], $e['time'], $e['date'],
                $e['crc'], $e['csize'], $e['size'], strlen($e['name']), 0, 0, 0, 0, 0, $e['offset']) . $e['name']);
        }
        $size = $this->offset - $start;
        $n = count($this->entries);
        if ($n > 0xFFFF || $start > self::LIMIT) {
            throw new RuntimeException('Export part too large for a plain ZIP.');
        }
        $this->emit(pack('VvvvvVVv', 0x06054b50, 0, 0, $n, $n, $size, $start, 0));
        $this->done = true;
    }

    public function bytesWritten(): int
    {
        return $this->offset;
    }

    private function header(string $name, int $crc, int $csize, int $size, int $method): void
    {
        if ($this->done) {
            throw new RuntimeException('ZIP already finished.');
        }
        if ($csize > self::LIMIT || $size > self::LIMIT || $this->offset > self::LIMIT) {
            throw new RuntimeException('Export part too large for a plain ZIP.');
        }
        [$time, $date] = $this->dosTime();
        $this->entries[] = ['name' => $name, 'crc' => $crc, 'csize' => $csize, 'size' => $size, 'method' => $method, 'offset' => $this->offset, 'time' => $time, 'date' => $date];
        // Flag 0x0800: names are UTF-8 (Hindi titles).
        $this->emit(pack('VvvvvvVVVvv', 0x04034b50, 20, 0x0800, $method, $time, $date, $crc, $csize, $size, strlen($name), 0) . $name);
    }

    /** @return array{0:int, 1:int} MS-DOS time and date (local IST, as the family sees it). */
    private function dosTime(): array
    {
        $t = $this->when;
        return [
            ((int) $t->format('G') << 11) | ((int) $t->format('i') << 5) | intdiv((int) $t->format('s'), 2),
            (((int) $t->format('Y') - 1980) << 9) | ((int) $t->format('n') << 5) | (int) $t->format('j'),
        ];
    }

    private function emit(string $bytes): void
    {
        ($this->out)($bytes);
        $this->offset += strlen($bytes);
    }
}
