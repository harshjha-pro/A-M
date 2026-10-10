<?php
// restore-from-export.php — put an export back into a NEW database (DS-22, AC-EXP-05).
// Emergency use only (hosting gone, database lost). Shipped as private/app/tools/.
//
//   1. Make a new empty database, run db/migrations/*.sql into it (phpMyAdmin → Import).
//   2. Unzip the export (all parts into one folder).
//   3. php restore-from-export.php --export=/path/to/unzipped --env=/path/to/.env [--files]
//      --files also copies documents/ into STORAGE_ROOT (checked by SHA-256).
//   4. Everyone needs a new password: passwords are never in an export (README.txt).
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

$opts = getopt('', ['export:', 'env:', 'files']);
if (!isset($opts['export'], $opts['env'])) {
    fwrite(STDERR, "Usage: php restore-from-export.php --export=<unzipped export folder> --env=<.env file> [--files]\n");
    exit(2);
}
foreach ([__DIR__ . '/../autoload.php', __DIR__ . '/../api/autoload.php'] as $a) {
    if (is_file($a)) { require $a; break; }
}
$dir = rtrim($opts['export'], '/');
$json = is_file($dir) ? $dir : "$dir/json/all.json";
try {
    $env = \AM\Kernel\Env::load($opts['env']);
    $restore = new \AM\Modules\Exports\Restore(\AM\Db\Db::connect($env));
    $restore->data($json);
    if (isset($opts['files'])) {
        $root = $env->get('STORAGE_ROOT');
        if ($root === '') {
            throw new RuntimeException('STORAGE_ROOT is not set in the .env file.');
        }
        $restore->files($dir, $root);
    }
    echo implode("\n", $restore->lines), "\nRestore done. Next: set new passwords (README.txt).\n";
    exit(0);
} catch (Throwable $e) {
    fwrite(STDERR, 'Restore FAILED, nothing changed in the database: ' . $e->getMessage() . "\n");
    exit(1);
}
