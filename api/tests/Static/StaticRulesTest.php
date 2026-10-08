<?php
declare(strict_types=1);

namespace Tests\Static;

use PHPUnit\Framework\TestCase;

/** TESTING DS-19, DS-20, DS-27 and the "no secrets in code" rule, as static checks over the source. */
final class StaticRulesTest extends TestCase
{
    /** @return array<string,string> path => code */
    private function sources(): array
    {
        $root = dirname(__DIR__, 2);
        $out = [];
        $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($root . '/src'));
        foreach ($it as $f) {
            if ($f->isFile() && $f->getExtension() === 'php') {
                $out[substr($f->getPathname(), strlen($root) + 1)] = (string) file_get_contents($f->getPathname());
            }
        }
        $this->assertNotEmpty($out);
        return $out;
    }

    public function test_ds19_no_hard_delete_except_ephemeral_tables(): void
    {
        $allowed = ['sessions', 'rate_limits', 'idempotency_keys', 'login_attempts'];
        foreach ($this->sources() as $path => $code) {
            preg_match_all('/DELETE\s+FROM\s+`?(\w+)`?/i', $code, $m);
            foreach ($m[1] as $table) {
                $this->assertContains(strtolower($table), $allowed, "Hard DELETE FROM $table in $path");
            }
        }
    }

    public function test_ds20_audit_log_is_append_only(): void
    {
        foreach ($this->sources() as $path => $code) {
            $this->assertDoesNotMatchRegularExpression('/UPDATE\s+`?audit_log/i', $code, "UPDATE audit_log in $path");
            $this->assertDoesNotMatchRegularExpression('/DELETE\s+FROM\s+`?audit_log/i', $code, "DELETE audit_log in $path");
            $this->assertDoesNotMatchRegularExpression('/TRUNCATE/i', $code, "TRUNCATE in $path");
        }
    }

    public function test_ds27_no_floats_near_money(): void
    {
        foreach ($this->sources() as $path => $code) {
            foreach (explode("\n", $code) as $n => $line) {
                if (str_contains($line, '_paise')) {
                    $this->assertDoesNotMatchRegularExpression('/\(float\)|floatval|\bfloat\b|round\(/i', $line, "Float near paise in $path:" . ($n + 1));
                }
            }
        }
    }

    public function test_sql_uses_placeholders_not_string_building(): void
    {
        foreach ($this->sources() as $path => $code) {
            // A query string glued together with a PHP variable: "... WHERE id = " . $id
            $this->assertDoesNotMatchRegularExpression(
                '/(SELECT|INSERT|UPDATE|DELETE)[^;\n]*["\']\s*\.\s*\$/i',
                $code,
                "SQL built from a variable in $path — use ? placeholders",
            );
        }
    }

    public function test_no_secrets_in_the_repository(): void
    {
        $root = dirname(__DIR__, 3);
        $this->assertFileDoesNotExist("$root/.env", 'A real .env must never be in the project');
        $gitignore = (string) file_get_contents("$root/.gitignore");
        foreach (['.env', 'config.php', 'backup.key', 'vendor/', 'node_modules/', 'dist/'] as $rule) {
            $this->assertStringContainsString($rule, $gitignore, ".gitignore must block $rule");
        }
        foreach ($this->sources() as $path => $code) {
            $this->assertDoesNotMatchRegularExpression('/(password|secret|token)\s*=\s*[\'"][^\'"]{6,}[\'"]/i', $code, "Hard-coded secret in $path");
        }
    }

    public function test_no_debug_output(): void
    {
        foreach ($this->sources() as $path => $code) {
            $this->assertDoesNotMatchRegularExpression('/\b(var_dump|print_r|phpinfo|dd)\s*\(/', $code, "Debug output in $path");
        }
    }
}
