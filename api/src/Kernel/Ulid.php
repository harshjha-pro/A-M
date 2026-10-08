<?php
declare(strict_types=1);

namespace AM\Kernel;

/** 26-character ULIDs for public_id (CONTEXT §8): sortable by time, not guessable. */
final class Ulid
{
    private const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

    public static function generate(?Clock $clock = null): string
    {
        $ms = (int) floor(((float) ($clock ?? new SystemClock())->now()->format('U.u')) * 1000);
        $time = '';
        for ($i = 0; $i < 10; $i++) {
            $time = self::ALPHABET[$ms % 32] . $time;
            $ms = intdiv($ms, 32);
        }
        $rand = '';
        $bytes = random_bytes(16);
        for ($i = 0; $i < 16; $i++) {
            $rand .= self::ALPHABET[ord($bytes[$i]) % 32];
        }
        return $time . $rand;
    }

    public static function isValid(string $value): bool
    {
        return (bool) preg_match('/^[0-9A-HJKMNP-TV-Z]{26}$/', $value);
    }
}
