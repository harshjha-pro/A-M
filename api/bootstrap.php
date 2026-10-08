<?php
declare(strict_types=1);

// A&M Wedding API. On Hostinger this file lives in private/app/ and is
// required by public_html/api/index.php. It reads private/.env.
require __DIR__ . '/autoload.php';

\AM\Kernel\App::main();
