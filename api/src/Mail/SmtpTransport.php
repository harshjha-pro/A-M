<?php
declare(strict_types=1);

namespace AM\Mail;

use RuntimeException;

/**
 * A small SMTP client for plain-text mail (IMPLEMENTATION I12): implicit TLS
 * on 465 ("ssl", Hostinger), STARTTLS on 587 ("tls"), or plain ("none", only
 * for the sandbox fake server). AUTH LOGIN. No attachments, no HTML.
 *
 * Built instead of shipping PHPMailer so the server still needs no Composer
 * packages at runtime. Throws RuntimeException on any SMTP error.
 */
final class SmtpTransport
{
    /** @var resource|null */
    private $socket = null;

    public function __construct(
        private readonly string $host,
        private readonly int $port = 465,
        private readonly string $secure = 'ssl',
        private readonly string $user = '',
        private readonly string $pass = '',
        private readonly int $timeout = 20,
    ) {}

    /** @param list<string> $to */
    public function send(string $from, string $fromName, array $to, string $subject, string $body): void
    {
        $prefix = $this->secure === 'ssl' ? 'ssl://' : 'tcp://';
        $ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'SNI_enabled' => true]]);
        $errno = 0;
        $errstr = '';
        $s = @stream_socket_client($prefix . $this->host . ':' . $this->port, $errno, $errstr, $this->timeout, STREAM_CLIENT_CONNECT, $ctx);
        if ($s === false) {
            throw new RuntimeException("SMTP connect to {$this->host}:{$this->port} failed: $errstr");
        }
        $this->socket = $s;
        stream_set_timeout($s, $this->timeout);
        try {
            $this->expect([220]);
            $helo = gethostname() ?: 'localhost';
            $this->cmd("EHLO $helo", [250]);
            if ($this->secure === 'tls') {
                $this->cmd('STARTTLS', [220]);
                if (!stream_socket_enable_crypto($s, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                    throw new RuntimeException('SMTP STARTTLS failed');
                }
                $this->cmd("EHLO $helo", [250]);
            }
            if ($this->user !== '') {
                $this->cmd('AUTH LOGIN', [334]);
                $this->cmd(base64_encode($this->user), [334]);
                $this->cmd(base64_encode($this->pass), [235], 'AUTH (password hidden)');
            }
            $this->cmd('MAIL FROM:<' . self::addr($from) . '>', [250]);
            foreach ($to as $rcpt) {
                $this->cmd('RCPT TO:<' . self::addr($rcpt) . '>', [250, 251]);
            }
            $this->cmd('DATA', [354]);
            $this->write(self::message($from, $fromName, $to, $subject, $body) . "\r\n.\r\n");
            $this->expect([250]);
            $this->cmd('QUIT', [221]);
        } finally {
            fclose($s);
            $this->socket = null;
        }
    }

    /** Headers + base64 body, every line dot-stuffed and CRLF-terminated. */
    public static function message(string $from, string $fromName, array $to, string $subject, string $body): string
    {
        $domain = substr(strrchr($from, '@') ?: '@localhost', 1);
        $headers = [
            'Date: ' . gmdate('D, d M Y H:i:s') . ' +0000',
            'From: ' . self::encode($fromName) . ' <' . self::addr($from) . '>',
            'To: ' . implode(', ', array_map(self::addr(...), $to)),
            'Subject: ' . self::encode($subject),
            'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . $domain . '>',
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: base64',
        ];
        $text = str_replace(["\r\n", "\r"], "\n", $body);
        $encoded = rtrim(chunk_split(base64_encode(str_replace("\n", "\r\n", $text)), 76, "\r\n"));
        return implode("\r\n", $headers) . "\r\n\r\n" . $encoded;
    }

    /** RFC 2047 for anything outside plain ASCII. */
    public static function encode(string $text): string
    {
        return preg_match('/[^\x20-\x7E]/', $text) ? '=?UTF-8?B?' . base64_encode($text) . '?=' : $text;
    }

    private static function addr(string $a): string
    {
        $a = trim($a);
        if (!filter_var($a, FILTER_VALIDATE_EMAIL)) {
            throw new RuntimeException('Not an email address: ' . preg_replace('/[^\w@.\-+]/', '?', $a));
        }
        return $a;
    }

    private function cmd(string $line, array $codes, ?string $shown = null): string
    {
        $this->write($line . "\r\n");
        return $this->expect($codes, $shown ?? $line);
    }

    private function write(string $data): void
    {
        if (@fwrite($this->socket, $data) === false) {
            throw new RuntimeException('SMTP write failed');
        }
    }

    private function expect(array $codes, string $after = 'connect'): string
    {
        $reply = '';
        while (($line = fgets($this->socket, 1024)) !== false) {
            $reply .= $line;
            if (strlen($line) < 4 || $line[3] === ' ') {
                break;
            }
        }
        $code = (int) substr($reply, 0, 3);
        if (!in_array($code, $codes, true)) {
            $what = str_starts_with($after, 'AUTH') || preg_match('/^[A-Za-z0-9+\/=]+$/', $after) ? 'AUTH' : strtok($after, ' ');
            throw new RuntimeException("SMTP $what refused: " . trim($reply ?: 'no reply'));
        }
        return $reply;
    }
}
