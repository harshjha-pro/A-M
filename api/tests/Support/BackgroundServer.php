<?php
declare(strict_types=1);

namespace Tests\Support;

/** Starts a helper process (fake B2, fake SMTP) on a free local port, and stops it. */
final class BackgroundServer
{
    /** @var resource */
    private $proc;
    public readonly int $port;

    /** @param callable(int): list<string> $command port → argv */
    public function __construct(callable $command, array $env = [])
    {
        $this->port = self::freePort();
        $this->proc = proc_open($command($this->port), [0 => ['pipe', 'r'], 1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']], $pipes, null, $env + getenv());
        for ($i = 0; $i < 50; $i++) {
            $s = @fsockopen('127.0.0.1', $this->port, $e, $m, 0.1);
            if ($s) {
                fclose($s);
                return;
            }
            usleep(100_000);
        }
        throw new \RuntimeException('Helper server did not start: ' . implode(' ', $command($this->port)));
    }

    public function stop(): void
    {
        $status = proc_get_status($this->proc);
        if ($status['running']) {
            // php -S forks no children; kill the whole group to be safe.
            posix_kill($status['pid'], SIGTERM);
        }
        proc_close($this->proc);
    }

    public static function freePort(): int
    {
        $s = stream_socket_server('tcp://127.0.0.1:0');
        $name = stream_socket_get_name($s, false);
        fclose($s);
        return (int) substr($name, strrpos($name, ':') + 1);
    }
}
