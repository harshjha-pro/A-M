<?php
// Fake SMTP server for sandbox tests (plain, no TLS). Saves each message as a
// file in OUT_DIR. Usage: php tools/fake-smtp.php 2525 /tmp/mail [user] [pass]
// With user/pass given, AUTH LOGIN must match (a wrong password gets 535).
declare(strict_types=1);

[$_, $port, $out] = $argv + [null, '2525', sys_get_temp_dir() . '/fake-mail'];
$user = $argv[3] ?? null;
$pass = $argv[4] ?? null;
@mkdir($out, 0700, true);
$server = stream_socket_server("tcp://127.0.0.1:$port", $errno, $errstr);
if (!$server) {
    fwrite(STDERR, "fake-smtp: $errstr\n");
    exit(1);
}
while ($c = @stream_socket_accept($server, -1)) {
    $say = static fn (string $l) => fwrite($c, $l . "\r\n");
    $say('220 fake-smtp ready');
    $from = '';
    $to = [];
    $authStep = 0;
    $authUser = '';
    while (($line = fgets($c)) !== false) {
        $cmd = rtrim($line, "\r\n");
        if ($authStep === 1) { $authUser = base64_decode($cmd); $authStep = 2; $say('334 UGFzc3dvcmQ6'); continue; }
        if ($authStep === 2) {
            $authStep = 0;
            $ok = $user === null || ($authUser === $user && base64_decode($cmd) === $pass);
            $say($ok ? '235 ok' : '535 Authentication failed');
            continue;
        }
        $verb = strtoupper(substr($cmd, 0, 4));
        if ($verb === 'EHLO' || $verb === 'HELO') { fwrite($c, "250-fake-smtp\r\n250 AUTH LOGIN\r\n"); }
        elseif ($cmd === 'AUTH LOGIN') { $authStep = 1; $say('334 VXNlcm5hbWU6'); }
        elseif ($verb === 'MAIL') { $from = $cmd; $say('250 ok'); }
        elseif ($verb === 'RCPT') { $to[] = $cmd; $say('250 ok'); }
        elseif ($verb === 'DATA') {
            $say('354 go');
            $data = '';
            while (($l = fgets($c)) !== false && rtrim($l, "\r\n") !== '.') { $data .= $l; }
            file_put_contents($out . '/' . microtime(true) . '-' . bin2hex(random_bytes(3)) . '.eml', "X-Envelope: $from " . implode(' ', $to) . "\r\n" . $data);
            $say('250 queued');
        }
        elseif ($verb === 'QUIT') { $say('221 bye'); break; }
        else { $say('250 ok'); }
    }
    fclose($c);
}
