<?php
declare(strict_types=1);

namespace Tests\Backup;

use AM\Kernel\Env;
use AM\Mail\Mailer;
use AM\Mail\SmtpTransport;
use PHPUnit\Framework\TestCase;
use Tests\Support\BackgroundServer;
use Tests\Support\TestDb;

/** The one mailer (IMPLEMENTATION I12): SMTP, daily cap, switch-off, mail() fallback. */
final class MailerTest extends TestCase
{
    private static string $dir;
    private static BackgroundServer $smtp;

    public static function setUpBeforeClass(): void
    {
        self::$dir = sys_get_temp_dir() . '/am-mailer-test-' . bin2hex(random_bytes(4));
        mkdir(self::$dir . '/mail', 0700, true);
        $root = TestDb::root();
        self::$smtp = new BackgroundServer(static fn (int $p) => [PHP_BINARY, "$root/tools/fake-smtp.php", (string) $p, self::$dir . '/mail', 'planner@lumorrahouse.com', 'pw']);
    }

    public static function tearDownAfterClass(): void
    {
        self::$smtp->stop();
        exec('rm -rf ' . escapeshellarg(self::$dir));
    }

    protected function setUp(): void
    {
        array_map('unlink', glob(self::$dir . '/mail/*') ?: []);
        @unlink(self::$dir . '/mail-count.json');
    }

    private function mailer(array $over = []): Mailer
    {
        return new Mailer($over + [
            'enabled' => true, 'cap' => 3, 'state_dir' => self::$dir,
            'from' => 'planner@lumorrahouse.com', 'from_name' => 'A&M Wedding',
            'smtp_host' => '127.0.0.1', 'smtp_port' => self::$smtp->port, 'smtp_secure' => 'none',
            'smtp_user' => 'planner@lumorrahouse.com', 'smtp_pass' => 'pw',
        ]);
    }

    private function received(): array
    {
        $f = glob(self::$dir . '/mail/*.eml') ?: [];
        sort($f);
        return array_map('file_get_contents', $f);
    }

    public function test_sends_plain_text_utf8_over_smtp(): void
    {
        $m = $this->mailer();
        $this->assertTrue($m->send(['ayush@example.com', 'mahi@example.com'], 'Backup ठीक है ✓', "Line one\nराम शर्मा\n.starts with a dot"), (string) $m->lastError);
        $eml = $this->received()[0];
        $this->assertStringContainsString('X-Envelope: MAIL FROM:<planner@lumorrahouse.com> RCPT TO:<ayush@example.com> RCPT TO:<mahi@example.com>', $eml);
        $this->assertStringContainsString('Content-Type: text/plain; charset=UTF-8', $eml);
        $this->assertStringContainsString('Subject: =?UTF-8?B?' . base64_encode('Backup ठीक है ✓') . '?=', $eml);
        $body = base64_decode(substr($eml, strpos($eml, "\r\n\r\n") + 4));
        $this->assertSame("Line one\r\nराम शर्मा\r\n.starts with a dot", $body);
    }

    public function test_never_sends_when_alerts_are_off(): void
    {
        $m = $this->mailer(['enabled' => false]);
        $this->assertFalse($m->send(['a@example.com'], 's', 'b'));
        $this->assertSame('Email is switched off (ALERTS_ENABLED=false).', $m->lastError);
        $this->assertSame([], $this->received());
    }

    public function test_refuses_after_the_daily_cap(): void
    {
        $m = $this->mailer();
        for ($i = 0; $i < 3; $i++) {
            $this->assertTrue($m->send(['a@example.com'], "n$i", 'b'));
        }
        $this->assertFalse($m->send(['a@example.com'], 'n3', 'b'));
        $this->assertSame('Daily email limit reached (3). Nothing sent.', $m->lastError);
        $this->assertCount(3, $this->received());
        // A new IST day resets the count.
        file_put_contents(self::$dir . '/mail-count.json', json_encode(['day' => '2000-01-01', 'count' => 3]));
        $this->assertTrue($m->send(['a@example.com'], 'n4', 'b'));
    }

    public function test_falls_back_to_mail_when_smtp_fails(): void
    {
        $m = $this->mailer(['smtp_pass' => 'wrong']);
        $calls = [];
        $m->mailFn = static function (string $to, string $s, string $b, string $h) use (&$calls): bool {
            $calls[] = [$to, $h];
            return true;
        };
        $this->assertTrue($m->send(['a@example.com', 'b@example.com'], 'x', 'y'));
        $this->assertSame('a@example.com, b@example.com', $calls[0][0]);
        $this->assertStringContainsString('From: A&M Wedding <planner@lumorrahouse.com>', $calls[0][1]);
        $this->assertStringContainsString('SMTP AUTH refused: 535', (string) $m->lastError);
        $this->assertStringNotContainsString('wrong', (string) $m->lastError, 'never prints the password');
    }

    public function test_from_env_reads_the_env_names(): void
    {
        $m = Mailer::fromEnv(Env::fromArray(['ALERTS_ENABLED' => 'false', 'LOG_DIR' => self::$dir]));
        $this->assertFalse($m->send(['a@example.com'], 's', 'b'));
        $this->assertSame(['a@example.com', 'b@example.com'], Mailer::list(' a@example.com , ,b@example.com'));
    }

    public function test_rejects_header_injection_in_addresses(): void
    {
        $this->expectException(\RuntimeException::class);
        SmtpTransport::message('planner@lumorrahouse.com', 'x', ["a@example.com\r\nBcc: evil@example.com"], 's', 'b');
    }
}
