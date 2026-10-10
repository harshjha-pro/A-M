<?php
declare(strict_types=1);

// Test bootstrap (TESTING §1.2): every run rebuilds the test database from the
// real migration files, in order, then loads db/test/fixtures.sql.
require dirname(__DIR__) . '/vendor/autoload.php';

date_default_timezone_set('UTC');
\Tests\Support\TestDb::rebuild();
\Tests\Support\TestDb::snapshot();
