<?php
declare(strict_types=1);

namespace AM\Kernel;

use DateTimeImmutable;
use DateTimeZone;

final class SystemClock extends Clock
{
    public function now(): DateTimeImmutable
    {
        return new DateTimeImmutable('now', new DateTimeZone('UTC'));
    }
}
