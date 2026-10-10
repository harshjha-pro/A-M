<?php
declare(strict_types=1);

// Vercel TEST hosting only (docs/VERCEL.md). On Hostinger the entry is public_html/api/index.php.
// There is no .env file here: every setting comes from the Vercel project's environment
// variables (DB_HOST, DB_NAME, DB_USER, DB_PASS, APP_URL, …), which the app reads the same way.

// Vercel's own link parameters (?x-vercel-protection-bypass=…, ?x-vercel-set-bypass-cookie=…)
// are not ours: drop them, or the API's strict query check answers 400.
foreach (array_keys($_GET) as $k) {
    if (str_starts_with((string) $k, 'x-vercel-')) {
        unset($_GET[$k]);
    }
}

if ($_GET !== []) { error_log('vercel.php query keys: ' . implode(',', array_keys($_GET))); } // TEMP: which keys arrive
require __DIR__ . '/bootstrap.php';
