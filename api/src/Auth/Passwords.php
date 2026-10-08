<?php
declare(strict_types=1);

namespace AM\Auth;

use AM\Kernel\Phone;
use AM\Kernel\Strings;

/**
 * Password rules (FEATURES B1): at least 6 characters, not the phone number,
 * not in a top-100 common list. Hashes via password_hash(); never logged.
 */
final class Passwords
{
    private const COMMON = [
        '123456', '1234567', '12345678', '123456789', '1234567890', '111111', '000000', '123123', '654321', '666666',
        '121212', '112233', '159753', '987654', '999999', '888888', '777777', '555555', '222222', '123321',
        'password', 'password1', 'password123', 'passw0rd', 'qwerty', 'qwerty123', 'qwertyuiop', 'asdfgh', 'zxcvbn', 'abc123',
        'abcdef', 'abcd1234', 'iloveyou', 'india', 'india123', 'india@123', 'bharat', 'hindustan', 'welcome', 'welcome1',
        'welcome123', 'admin', 'admin123', 'letmein', 'monkey', 'dragon', 'sunshine', 'princess', 'football', 'cricket',
        'sachin', 'krishna', 'ganesh', 'shivaji', 'jaishriram', 'jaimatadi', 'omnamahshivay', 'shiva', 'hanuman', 'ramram',
        'radhe', 'radheradhe', 'radhekrishna', 'sairam', 'om123', 'love123', 'lovely', 'baby123', 'mother', 'father',
        'family', 'wedding', 'shaadi', 'marriage', 'mahi', 'ayush', 'ayushmahi', 'mahiayush', 'porwal', 'jagetiya',
        'bhilwara', 'rajasthan', 'udaipur', 'jaipur', 'mumbai', 'delhi', 'computer', 'internet', 'samsung', 'iphone',
        'apple', 'google', 'whatsapp', 'secret', 'master', 'superman', 'batman', 'hello123', 'test123', 'demo1234',
    ];

    /** Hash for a missing user, so a wrong phone takes as long as a wrong password. */
    private const DUMMY_HASH = '$2y$10$tIpbv8itvObU9YHVtfeTb.zDY0Xmpg8WTXwooyhmKr1YKki0q/07.';

    private const WORDS = [
        'rose', 'lotus', 'mango', 'tulsi', 'peacock', 'diya', 'kesar', 'chandan', 'mehndi', 'haldi',
        'sitar', 'tabla', 'moti', 'heera', 'sona', 'chandi', 'gulab', 'kamal', 'neem', 'pipal',
    ];

    public static function hash(string $password): string
    {
        return password_hash($password, PASSWORD_DEFAULT);
    }

    /** Constant-ish time: always runs one verify, even without a user. */
    public static function verify(string $password, ?string $hash): bool
    {
        $ok = password_verify($password, $hash ?? self::DUMMY_HASH);
        return $hash !== null && $ok;
    }

    /** null = fine, else the message to show under the field. */
    public static function problem(string $password, ?string $phoneE164 = null): ?string
    {
        if (mb_strlen($password) < 6 || mb_strlen($password) > 128) {
            return Strings::get('password_rules');
        }
        if ($phoneE164 !== null) {
            $digits = Phone::digits($phoneE164);
            $pwDigits = (string) preg_replace('/\D/', '', $password);
            $local = substr($digits, -10);
            if ($pwDigits !== '' && ($pwDigits === $digits || $pwDigits === $local || str_contains($pwDigits, $local))) {
                return Strings::get('password_rules');
            }
        }
        if (in_array(strtolower($password), self::COMMON, true)) {
            return Strings::get('password_too_common');
        }
        return null;
    }

    /** Easy to read out on the phone: "rose-4821". */
    public static function generate(): string
    {
        return self::WORDS[random_int(0, count(self::WORDS) - 1)] . '-' . random_int(1000, 9999);
    }

    /** A hash nobody can log in with (invite-by-link members). */
    public static function unusableHash(): string
    {
        return self::hash(bin2hex(random_bytes(32)));
    }
}
