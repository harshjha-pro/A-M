<?php
declare(strict_types=1);

namespace AM\Mail;

use AM\Kernel\Env;
use Throwable;

/**
 * The one mailer (IMPLEMENTATION I12): plain text from planner@lumorrahouse.com
 * over SMTP, PHP mail() only as a fallback. Used by backup alerts, the daily
 * error digest, and later password-reset and reminder emails.
 *
 *  - ALERTS_ENABLED=false → never sends (returns false with a reason).
 *  - MAIL_DAILY_CAP (default 30) per IST day, counted in a small file, so a
 *    loop can never flood both inboxes or burn Hostinger's sending limit.
 */
final class Mailer
{
    public ?string $lastError = null;

    /** @var (callable(string, string, string, string): bool)|null for tests: replaces mail() */
    public $mailFn = null;

    /**
     * @param array{enabled:bool, cap:int, state_dir:string, from:string, from_name:string,
     *              smtp_host?:string, smtp_port?:int, smtp_secure?:string, smtp_user?:string, smtp_pass?:string,
     *              allow_mail_fallback?:bool} $c
     */
    public function __construct(private readonly array $c) {}

    public static function fromEnv(Env $env): self
    {
        return new self([
            'enabled' => $env->bool('ALERTS_ENABLED', false),
            'cap' => $env->int('MAIL_DAILY_CAP', 30),
            'state_dir' => $env->get('LOG_DIR'),
            'from' => $env->get('MAIL_FROM', 'planner@lumorrahouse.com'),
            'from_name' => $env->get('MAIL_FROM_NAME', 'A&M Wedding'),
            'smtp_host' => $env->get('SMTP_HOST'),
            'smtp_port' => $env->int('SMTP_PORT', 465),
            'smtp_secure' => $env->get('SMTP_SECURE', 'ssl'),
            'smtp_user' => $env->get('SMTP_USER'),
            'smtp_pass' => $env->get('SMTP_PASS'),
        ]);
    }

    /** "a@x.com, b@y.com" → list */
    public static function list(string $csv): array
    {
        return array_values(array_filter(array_map('trim', explode(',', $csv)), static fn ($a) => $a !== ''));
    }

    /** @param list<string> $to */
    public function send(array $to, string $subject, string $body): bool
    {
        $this->lastError = null;
        if (!$this->c['enabled']) {
            return $this->fail('Email is switched off (ALERTS_ENABLED=false).');
        }
        if ($to === []) {
            return $this->fail('No one to send to.');
        }
        if (!$this->claimSlot()) {
            return $this->fail("Daily email limit reached ({$this->c['cap']}). Nothing sent.");
        }
        $host = (string) ($this->c['smtp_host'] ?? '');
        if ($host !== '') {
            try {
                (new SmtpTransport($host, (int) ($this->c['smtp_port'] ?? 465), (string) ($this->c['smtp_secure'] ?? 'ssl'),
                    (string) ($this->c['smtp_user'] ?? ''), (string) ($this->c['smtp_pass'] ?? '')))
                    ->send($this->c['from'], $this->c['from_name'], $to, $subject, $body);
                return true;
            } catch (Throwable $e) {
                $this->lastError = 'SMTP: ' . $e->getMessage();
                if (!($this->c['allow_mail_fallback'] ?? true)) {
                    return false;
                }
            }
        }
        $headers = 'From: ' . SmtpTransport::encode($this->c['from_name']) . ' <' . $this->c['from'] . ">\r\n"
            . "MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n";
        $fn = $this->mailFn ?? static fn (string $t, string $s, string $b, string $h): bool => @mail($t, $s, $b, $h);
        $ok = (bool) $fn(implode(', ', $to), SmtpTransport::encode($subject), $body, $headers);
        if (!$ok) {
            $this->lastError = trim(($this->lastError ? $this->lastError . ' · ' : '') . 'mail() refused the email.');
        }
        return $ok;
    }

    private function fail(string $why): bool
    {
        $this->lastError = $why;
        return false;
    }

    /** One more email today (IST)? Counted in <state_dir>/mail-count.json under a lock. */
    private function claimSlot(): bool
    {
        $dir = (string) $this->c['state_dir'];
        if ($dir === '' || (!is_dir($dir) && !@mkdir($dir, 0700, true))) {
            return true; // nowhere to count: still send (alerts matter more than the cap)
        }
        $file = $dir . '/mail-count.json';
        $fh = @fopen($file, 'c+');
        if ($fh === false) {
            return true;
        }
        try {
            flock($fh, LOCK_EX);
            $today = (new \DateTimeImmutable('now', new \DateTimeZone('Asia/Kolkata')))->format('Y-m-d');
            $state = json_decode((string) stream_get_contents($fh), true);
            $count = is_array($state) && ($state['day'] ?? '') === $today ? (int) $state['count'] : 0;
            if ($count >= (int) $this->c['cap']) {
                return false;
            }
            ftruncate($fh, 0);
            rewind($fh);
            fwrite($fh, (string) json_encode(['day' => $today, 'count' => $count + 1]));
            return true;
        } finally {
            flock($fh, LOCK_UN);
            fclose($fh);
        }
    }
}
