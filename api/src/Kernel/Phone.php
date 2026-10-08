<?php
declare(strict_types=1);

namespace AM\Kernel;

/**
 * Phone numbers (FEATURES A9). Same rules as web/src/format/phone.js:
 * strip spaces, dashes, brackets; drop +91, a leading 91 (12 digits) or 0;
 * Indian mobile = 10 digits starting 6–9. International: + and 8–15 digits.
 * Stored as E.164: +919829012345.
 */
final class Phone
{
    /** @return array{e164:string, kind:string}|null */
    public static function normalize(string $input): ?array
    {
        $clean = (string) preg_replace('/[\s\-().]/', '', trim($input));
        if ($clean === '') {
            return null;
        }
        if (str_starts_with($clean, '+')) {
            $digits = substr($clean, 1);
            if (!ctype_digit($digits)) {
                return null;
            }
            if (str_starts_with($digits, '91')) {
                return self::indian(substr($digits, 2));
            }
            $len = strlen($digits);
            if ($len >= 8 && $len <= 15 && $digits[0] !== '0') {
                return ['e164' => '+' . $digits, 'kind' => 'international'];
            }
            return null;
        }
        if (!ctype_digit($clean)) {
            return null;
        }
        if (strlen($clean) === 12 && str_starts_with($clean, '91')) {
            $clean = substr($clean, 2);
        } elseif (str_starts_with($clean, '0')) {
            $clean = substr($clean, 1);
        }
        return self::indian($clean);
    }

    /** @return array{e164:string, kind:string}|null */
    private static function indian(string $d): ?array
    {
        if (!preg_match('/^\d{10}$/', $d)) {
            return null;
        }
        return ['e164' => '+91' . $d, 'kind' => preg_match('/^[6-9]/', $d) ? 'mobile' : 'landline'];
    }

    /** "+919829012345" → "+91 98••• ••345" (set-password link page) */
    public static function mask(string $e164): string
    {
        if (preg_match('/^\+91(\d{2})\d{6}(\d{2})$/', $e164, $m)) {
            return "+91 {$m[1]}••• ••" . substr($e164, -3);
        }
        return substr($e164, 0, 3) . str_repeat('•', max(0, strlen($e164) - 6)) . substr($e164, -3);
    }

    /** Digits only: for "not your phone number" checks and wa.me. */
    public static function digits(string $e164): string
    {
        return (string) preg_replace('/\D/', '', $e164);
    }
}
