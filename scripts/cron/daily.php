<?php
// daily.php — A&M Wedding daily clean-up (cron, 3:00 AM IST). CLI only.
// Lives in private/cron/ on both sites; reads private/.env. Logic: api/src/Safety/DailyJob.php.
//   php daily.php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

$app = getenv('AM_APP_DIR') ?: __DIR__ . '/../app';
require $app . '/autoload.php';

$envFile = getenv('AM_ENV_FILE') ?: dirname(__DIR__) . '/.env';
$env = \AM\Kernel\Env::load($envFile);
$clock = new \AM\Kernel\SystemClock();
date_default_timezone_set('Asia/Kolkata');
try {
    $job = new \AM\Safety\DailyJob($env, \AM\Db\Db::connect($env), $clock, \AM\Mail\Mailer::fromEnv($env));
    $code = $job->run();
    foreach ($job->lines as $l) {
        echo '[' . date('Y-m-d H:i:s') . ' IST] ' . $l . "\n";
    }
    exit($code);
} catch (Throwable $e) {
    echo '[' . date('Y-m-d H:i:s') . ' IST] FAILED: ' . $e->getMessage() . "\n";
    exit(1);
}
