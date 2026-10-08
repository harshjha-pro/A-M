<?php
declare(strict_types=1);

namespace AM\Kernel;

use DateTimeImmutable;
use DateTimeZone;

/**
 * All "now" in the API comes from a Clock (IMPLEMENTATION §2.5 rule 4).
 * Tests swap in FrozenClock and move time instead of sleeping.
 */
abstract class Clock
{
    abstract public function now(): DateTimeImmutable;

    /** UTC, ISO 8601 with Z and seconds precision: 2026-10-08T09:12:31Z */
    public function isoNow(): string
    {
        return $this->now()->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s\Z');
    }

    /** UTC "Y-m-d H:i:s" for DATETIME columns. */
    public function dbNow(): string
    {
        return $this->now()->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    }

    /** Today's calendar date in India, whatever the server's zone. */
    public function todayIst(): string
    {
        return $this->now()->setTimezone(new DateTimeZone('Asia/Kolkata'))->format('Y-m-d');
    }
}
