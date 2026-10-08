<?php
declare(strict_types=1);

namespace AM\Validation;

use AM\Kernel\HttpError;
use AM\Kernel\Phone;
use AM\Kernel\Strings;
use AM\Kernel\Time;

/**
 * Reads and checks a JSON body field by field, collecting plain-words errors.
 * The server is the authority (the phone's checks are only a convenience).
 * Call fail() at the end: 422 validation_failed with error.fields (API.md §2.2).
 */
final class Fields
{
    /** @var array<string,string> */
    private array $errors = [];

    /** @param array<string,mixed> $body */
    public function __construct(private readonly array $body) {}

    /** @param mixed $json the decoded body */
    public static function from(mixed $json): self
    {
        if ($json === null) {
            $json = [];
        }
        if (!is_array($json) || (array_is_list($json) && $json !== [])) {
            throw HttpError::make(400, 'bad_request');
        }
        return new self($json);
    }

    public function has(string $key): bool
    {
        return array_key_exists($key, $this->body);
    }

    /** @return list<string> */
    public function keys(): array
    {
        return array_keys($this->body);
    }

    /** Refuse keys the endpoint doesn't take (catches typos and smuggled fields). */
    public function only(array $allowed): self
    {
        foreach (array_keys($this->body) as $k) {
            if (!in_array($k, $allowed, true)) {
                $this->errors[(string) $k] = Strings::get('field_not_allowed');
            }
        }
        return $this;
    }

    public function error(string $field, string $message): self
    {
        $this->errors[$field] ??= $message;
        return $this;
    }

    public function hasErrors(): bool
    {
        return $this->errors !== [];
    }

    /** Trimmed text. "" → null. Lengths count characters (Hindi, emoji). */
    public function text(string $key, int $max, bool $required = false, int $min = 1): ?string
    {
        $v = $this->body[$key] ?? null;
        if ($v !== null && !is_string($v)) {
            $this->error($key, Strings::get('field_bad_text'));
            return null;
        }
        $v = $v === null ? null : trim($v);
        if ($v === '' || $v === null) {
            if ($required) {
                $this->error($key, Strings::get('field_required'));
            }
            return null;
        }
        if (preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', $v)) {
            $this->error($key, Strings::get('field_bad_text'));
            return null;
        }
        $len = mb_strlen($v);
        if ($len > $max) {
            $this->error($key, Strings::get('field_too_long', ['max' => $max]));
            return null;
        }
        if ($len < $min) {
            $this->error($key, Strings::get('field_required'));
            return null;
        }
        return $v;
    }

    /** Raw string (passwords: never trimmed). */
    public function raw(string $key, bool $required = false, int $max = 128): ?string
    {
        $v = $this->body[$key] ?? null;
        if ($v === null || $v === '') {
            if ($required) {
                $this->error($key, Strings::get('field_required'));
            }
            return null;
        }
        if (!is_string($v) || strlen($v) > $max * 4) {
            $this->error($key, Strings::get('field_bad_text'));
            return null;
        }
        return $v;
    }

    public function bool(string $key): ?bool
    {
        if (!array_key_exists($key, $this->body)) {
            return null;
        }
        $v = $this->body[$key];
        if (!is_bool($v)) {
            $this->error($key, Strings::get('field_bad_bool'));
            return null;
        }
        return $v;
    }

    /** @param list<string> $values */
    public function enum(string $key, array $values, bool $required = false): ?string
    {
        $v = $this->body[$key] ?? null;
        if ($v === null || $v === '') {
            if ($required) {
                $this->error($key, Strings::get('field_required'));
            }
            return null;
        }
        if (!is_string($v) || !in_array($v, $values, true)) {
            $this->error($key, Strings::get('field_bad_choice'));
            return null;
        }
        return $v;
    }

    /** YYYY-MM-DD (an IST calendar date, no zone). */
    public function date(string $key, bool $required = false): ?string
    {
        $v = $this->body[$key] ?? null;
        if ($v === null || $v === '') {
            if ($required) {
                $this->error($key, Strings::get('field_required'));
            }
            return null;
        }
        if (!Time::isDate($v)) {
            $this->error($key, Strings::get('field_bad_date'));
            return null;
        }
        return $v;
    }

    /** Integer paise, 0 … max. Never a float or a string. */
    public function paise(string $key, int $max = 100000000000): ?int
    {
        $v = $this->body[$key] ?? null;
        if ($v === null) {
            return null;
        }
        if (!is_int($v) || $v < 0 || $v > $max) {
            $this->error($key, Strings::get('field_bad_amount'));
            return null;
        }
        return $v;
    }

    /** Mobile (or international) number → E.164. Landlines refused for logins. */
    public function phone(string $key, bool $required = false, bool $allowLandline = false): ?string
    {
        $v = $this->body[$key] ?? null;
        if ($v === null || $v === '') {
            if ($required) {
                $this->error($key, Strings::get('field_required'));
            }
            return null;
        }
        $n = is_string($v) ? Phone::normalize($v) : null;
        if ($n === null || (!$allowLandline && $n['kind'] === 'landline')) {
            $this->error($key, Strings::get('field_bad_phone'));
            return null;
        }
        return $n['e164'];
    }

    public function email(string $key): ?string
    {
        $v = $this->text($key, 190);
        if ($v !== null && !filter_var($v, FILTER_VALIDATE_EMAIL)) {
            $this->error($key, Strings::get('field_bad_email'));
            return null;
        }
        return $v === null ? null : strtolower($v);
    }

    /** Throws 422 if anything was wrong. */
    public function fail(): void
    {
        if ($this->errors === []) {
            return;
        }
        $n = count($this->errors);
        throw new HttpError(
            422,
            'validation_failed',
            $n === 1 ? Strings::get('validation_failed_one') : Strings::get('validation_failed', ['n' => $n]),
            ['fields' => $this->errors],
        );
    }
}
