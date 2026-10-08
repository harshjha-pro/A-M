<?php
declare(strict_types=1);

namespace Tests\Support;

/**
 * Splits a .sql file into statements the way the mysql client / phpMyAdmin
 * does: respects quotes, backticks and comments. Our migrations have no
 * DELIMITER blocks (no procedures or triggers, DATABASE rule 6).
 */
final class SqlScript
{
    /** @return list<string> */
    public static function statements(string $sql): array
    {
        $out = [];
        $buf = '';
        $len = strlen($sql);
        $quote = null;
        for ($i = 0; $i < $len; $i++) {
            $c = $sql[$i];
            $next = $i + 1 < $len ? $sql[$i + 1] : '';
            if ($quote !== null) {
                $buf .= $c;
                if ($c === '\\' && $quote !== '`') {
                    $buf .= $next;
                    $i++;
                } elseif ($c === $quote) {
                    if ($next === $quote) { // doubled quote '' inside a string
                        $buf .= $next;
                        $i++;
                    } else {
                        $quote = null;
                    }
                }
                continue;
            }
            if ($c === '-' && $next === '-' && ($i + 2 >= $len || ctype_space($sql[$i + 2]))) {
                $end = strpos($sql, "\n", $i);
                $i = $end === false ? $len : $end;
                $buf .= "\n";
                continue;
            }
            if ($c === '#') {
                $end = strpos($sql, "\n", $i);
                $i = $end === false ? $len : $end;
                $buf .= "\n";
                continue;
            }
            if ($c === '/' && $next === '*') {
                $end = strpos($sql, '*/', $i + 2);
                $i = $end === false ? $len : $end + 1;
                $buf .= ' ';
                continue;
            }
            if ($c === "'" || $c === '"' || $c === '`') {
                $quote = $c;
                $buf .= $c;
                continue;
            }
            if ($c === ';') {
                if (trim($buf) !== '') {
                    $out[] = trim($buf);
                }
                $buf = '';
                continue;
            }
            $buf .= $c;
        }
        if (trim($buf) !== '') {
            $out[] = trim($buf);
        }
        return $out;
    }
}
