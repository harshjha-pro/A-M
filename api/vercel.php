<?php
declare(strict_types=1);

// Vercel TEST hosting only (docs/VERCEL.md). On Hostinger the entry is public_html/api/index.php.
// There is no .env file here: every setting comes from the Vercel project's environment
// variables (DB_HOST, DB_NAME, DB_USER, DB_PASS, APP_URL, …), which the app reads the same way.
require __DIR__ . '/bootstrap.php';
