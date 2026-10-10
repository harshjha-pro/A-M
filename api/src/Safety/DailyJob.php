<?php
declare(strict_types=1);

namespace AM\Safety;

use AM\Db\Db;
use AM\Kernel\Clock;
use AM\Kernel\Env;
use AM\Mail\Mailer;
use DateTimeImmutable;
use DateTimeZone;
use Throwable;

/**
 * The daily clean-up (scripts/cron/daily.php, 3:00 AM IST; IMPLEMENTATION Session 4):
 *   1. error digest: emails both of you ONLY if new errors were logged in the last 24 h
 *      (count + the 10 most common), from php-error.log and client-error.log (TESTING §9.3);
 *   2. deletes only the ephemeral rows DATABASE rule 12 allows: sessions expired or ended
 *      > 30 days ago, login_attempts > 30 days, idempotency_keys past expires_at,
 *      rate_limits windows older than 1 day;
 *   3. exports older than 24 h: snapshot folder removed, row marked 'expired' (the row stays);
 *   4. logs rotated weekly, rotated copies kept 8 weeks.
 * Each step runs on its own: one failing never stops the others.
 */
final class DailyJob
{
    public const KEEP_LOG_WEEKS = 8;
    public const LOGS = ['php-error.log', 'client-error.log', 'cron.log'];

    /** @var list<string> */
    public array $lines = [];

    public function __construct(
        private readonly Env $env,
        private readonly Db $db,
        private readonly Clock $clock,
        private readonly ?Mailer $mailer = null,
    ) {}

    /** @return int 0 ok, 1 if any step failed */
    public function run(): int
    {
        $ok = true;
        foreach (['digest', 'purgeTables', 'expireExports', 'rotateLogs'] as $step) {
            try {
                $this->$step();
            } catch (Throwable $e) {
                $ok = false;
                $this->say("$step FAILED: " . $e->getMessage());
            }
        }
        $this->say($ok ? 'Daily clean-up done.' : 'Daily clean-up finished with problems.');
        return $ok ? 0 : 1;
    }

    /** @return array<string,int> rows deleted per table */
    public function purgeTables(): array
    {
        $now = $this->clock->now()->getTimestamp();
        $d30 = gmdate('Y-m-d H:i:s', $now - 30 * 86400);
        $d1 = gmdate('Y-m-d H:i:s', $now - 86400);
        $nowDb = gmdate('Y-m-d H:i:s', $now);
        $n = [
            'sessions' => $this->db->run('DELETE FROM sessions WHERE expires_at < ? OR revoked_at < ?', [$d30, $d30])->rowCount(),
            'login_attempts' => $this->db->run('DELETE FROM login_attempts WHERE attempted_at < ?', [$d30])->rowCount(),
            'idempotency_keys' => $this->db->run('DELETE FROM idempotency_keys WHERE expires_at < ?', [$nowDb])->rowCount(),
            'rate_limits' => $this->db->run('DELETE FROM rate_limits WHERE window_start < ?', [$d1])->rowCount(),
        ];
        $this->say('Cleared: ' . implode(', ', array_map(static fn ($t, $c) => "$t $c", array_keys($n), $n)) . '.');
        return $n;
    }

    /**
     * Exports live 24 h (API.md §9.1). Each export is a snapshot folder exports/<id>/
     * (the ZIP is built while it downloads). Past expires_at: folder removed, row
     * marked expired (the row stays). Folders with no ready row (a failed or
     * half-made export) go once they are a day old.
     */
    public function expireExports(): int
    {
        $now = $this->clock->now()->getTimestamp();
        $nowDb = gmdate('Y-m-d H:i:s', $now);
        $removed = 0;
        $dir = rtrim($this->env->get('STORAGE_ROOT'), '/') . '/exports';
        if (is_dir($dir)) {
            $live = array_flip(array_column($this->db->all(
                "SELECT public_id FROM exports WHERE status = 'ready' AND (expires_at IS NULL OR expires_at >= ?)",
                [$nowDb],
            ), 'public_id'));
            foreach (glob($dir . '/*', GLOB_ONLYDIR) ?: [] as $d) {
                $id = basename($d);
                if (preg_match('/^[0-9A-Z]{26}$/', $id) && !isset($live[$id]) && (filemtime($d) < $now - 86400 || $this->db->value('SELECT 1 FROM exports WHERE public_id = ?', [$id]) !== null)) {
                    \AM\Modules\Exports\ExportsController::removeDir($d);
                    $removed++;
                }
            }
            foreach (glob($dir . '/*.zip') ?: [] as $f) { // ZIPs from before Session 11
                if (filemtime($f) < $now - 86400 && @unlink($f)) {
                    $removed++;
                }
            }
        }
        $this->db->run(
            "UPDATE exports SET status = 'expired' WHERE status = 'ready' AND expires_at IS NOT NULL AND expires_at < ?",
            [$nowDb],
        );
        $this->say("Export files removed: $removed.");
        return $removed;
    }

    /**
     * Once per ISO week: name.log → name-YYYY-Www.log (the week it covered), and
     * delete rotated copies older than 8 weeks.
     */
    public function rotateLogs(): void
    {
        $dir = $this->env->get('LOG_DIR');
        if ($dir === '' || !is_dir($dir)) {
            $this->say('No log folder.');
            return;
        }
        $now = $this->ist();
        $week = $now->format('o-\WW');
        $marker = $dir . '/.rotated-week';
        $last = is_file($marker) ? trim((string) file_get_contents($marker)) : '';
        if ($last !== $week) {
            $label = $last !== '' ? $last : $now->modify('-7 days')->format('o-\WW');
            foreach (self::LOGS as $log) {
                $f = "$dir/$log";
                if (is_file($f) && filesize($f) > 0) {
                    rename($f, $dir . '/' . substr($log, 0, -4) . "-$label.log");
                }
            }
            file_put_contents($marker, $week);
            $this->say("Logs rotated (week $label).");
        }
        $cutoff = $now->modify('-' . self::KEEP_LOG_WEEKS . ' weeks')->format('o-\WW');
        foreach (glob($dir . '/*-[0-9][0-9][0-9][0-9]-W[0-9][0-9].log') ?: [] as $f) {
            if (preg_match('/-(\d{4}-W\d{2})\.log$/', $f, $m) && $m[1] < $cutoff) {
                unlink($f);
            }
        }
    }

    /** @return array{count:int, top:array<string,int>} */
    public function digest(): array
    {
        $dir = $this->env->get('LOG_DIR');
        $since = $this->clock->now()->getTimestamp() - 86400;
        $counts = [];
        $total = 0;
        foreach (['php-error.log' => 'Server', 'client-error.log' => 'Phone'] as $log => $where) {
            $f = "$dir/$log";
            if ($dir === '' || !is_file($f)) {
                continue;
            }
            foreach (file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
                $e = json_decode($line, true);
                if (!is_array($e) || strtotime((string) ($e['at'] ?? '')) < $since) {
                    continue;
                }
                $what = $where . ': ' . mb_substr((string) ($e['message'] ?? $e['code'] ?? 'unknown'), 0, 160);
                $counts[$what] = ($counts[$what] ?? 0) + 1;
                $total++;
            }
        }
        arsort($counts);
        $top = array_slice($counts, 0, 10, true);
        if ($total === 0) {
            $this->say('No new errors in the last 24 h. No digest email.');
            return ['count' => 0, 'top' => []];
        }
        $body = "$total problem" . ($total === 1 ? '' : 's') . " were logged in the last 24 hours.\n\nMost common:\n";
        foreach ($top as $what => $n) {
            $body .= "  {$n}× $what\n";
        }
        $body .= "\nThe full lines are in private/logs/ on the server. Nothing needs doing unless something repeats or someone complained.";
        $sent = $this->mailer?->send(Mailer::list($this->env->get('ALERT_TO')), "[A&M Wedding] $total errors in the last 24 h", $body) ?? false;
        $this->say("Error digest: $total errors, email " . ($sent ? 'sent.' : 'not sent' . ($this->mailer?->lastError ? ' (' . $this->mailer->lastError . ')' : '') . '.'));
        return ['count' => $total, 'top' => $top];
    }

    private function ist(): DateTimeImmutable
    {
        return $this->clock->now()->setTimezone(new DateTimeZone('Asia/Kolkata'));
    }

    private function say(string $line): void
    {
        $this->lines[] = $line;
    }
}
