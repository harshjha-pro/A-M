<?php
declare(strict_types=1);

namespace AM\Kernel;

use DateTimeImmutable;
use DateTimeZone;

/** A clock that only moves when told to. Used by tests (TESTING §1.2). */
final class FrozenClock extends Clock
{
    private DateTimeImmutable $now;

    public function __construct(string $utc = '2026-10-08T09:12:31Z')
    {
        $this->now = new DateTimeImmutable($utc, new DateTimeZone('UTC'));
    }

    public function now(): DateTimeImmutable
    {
        return $this->now;
    }

    public function set(string $utc): void
    {
        $this->now = new DateTimeImmutable($utc, new DateTimeZone('UTC'));
    }

    /** e.g. advance('+11 minutes'), advance('+49 hours') */
    public function advance(string $modifier): void
    {
        $this->now = $this->now->modify($modifier);
    }
}
