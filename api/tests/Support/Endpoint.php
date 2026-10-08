<?php
declare(strict_types=1);

namespace Tests\Support;

use Attribute;

/** Marks which API operation a test covers, e.g. #[Endpoint('GET /health')] (TESTING §1.3 coverage gate). */
#[Attribute(Attribute::TARGET_METHOD | Attribute::IS_REPEATABLE)]
final class Endpoint
{
    public function __construct(public readonly string $operation) {}
}
