<?php
declare(strict_types=1);

namespace AM\Kernel;

/**
 * Reads settings from a .env file (private/.env on Hostinger).
 * Real environment variables win over the file, so tests and the sandbox
 * router can override a value without editing anything.
 */
final class Env
{
    /** @param array<string,string> $values */
    private function __construct(private array $values) {}

    public static function load(?string $file): self
    {
        $values = [];
        if ($file !== null && is_file($file) && is_readable($file)) {
            $values = self::parse((string) file_get_contents($file));
        }
        foreach ($values as $key => $_) {
            $real = getenv($key);
            if ($real !== false) {
                $values[$key] = $real;
            }
        }
        return new self($values);
    }

    /** @param array<string,string> $values */
    public static function fromArray(array $values): self
    {
        return new self($values);
    }

    /** @return array<string,string> */
    public static function parse(string $text): array
    {
        $out = [];
        foreach (preg_split('/\R/', $text) ?: [] as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#') {
                continue;
            }
            if (!preg_match('/^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/', $line, $m)) {
                continue;
            }
            $value = $m[2];
            if ($value !== '' && ($value[0] === '"' || $value[0] === "'")) {
                $quote = $value[0];
                $end = strpos($value, $quote, 1);
                $value = $end === false ? substr($value, 1) : substr($value, 1, $end - 1);
            } else {
                // "value   # comment" -> "value"
                $value = trim((string) preg_replace('/\s+#.*$/', '', $value));
            }
            $out[$m[1]] = $value;
        }
        return $out;
    }

    public function get(string $key, string $default = ''): string
    {
        $real = getenv($key);
        if ($real !== false && !array_key_exists($key, $this->values)) {
            return $real;
        }
        return $this->values[$key] ?? $default;
    }

    public function int(string $key, int $default = 0): int
    {
        $v = $this->get($key, '');
        return preg_match('/^-?\d+$/', $v) ? (int) $v : $default;
    }

    public function bool(string $key, bool $default = false): bool
    {
        $v = strtolower($this->get($key, ''));
        if ($v === '') {
            return $default;
        }
        return in_array($v, ['1', 'true', 'yes', 'on'], true);
    }

    public function with(string $key, string $value): self
    {
        $copy = clone $this;
        $copy->values[$key] = $value;
        return $copy;
    }
}
