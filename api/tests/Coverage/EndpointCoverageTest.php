<?php
declare(strict_types=1);

namespace Tests\Coverage;

use AM\Http\Routes;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use Tests\Support\Endpoint;

/**
 * Coverage gate (TESTING §1.3, §0.2 rule 4):
 *  1. every built route is in docs/openapi.yaml;
 *  2. every built route has at least one #[Endpoint] test;
 *  3. every #[Endpoint] names an operation that exists in openapi.yaml.
 * Operations in openapi.yaml that are not built yet are listed in
 * TEST-REPORT.md as "pending" (they are built session by session).
 */
final class EndpointCoverageTest extends TestCase
{
    /** @return list<string> "GET /health" … */
    public static function openApiOperations(): array
    {
        $yaml = (string) file_get_contents(dirname(__DIR__, 3) . '/docs/openapi.yaml');
        $ops = [];
        $inPaths = false;
        $path = null;
        foreach (explode("\n", $yaml) as $line) {
            if ($line === 'paths:') {
                $inPaths = true;
                continue;
            }
            if ($inPaths && preg_match('/^\S/', $line)) {
                break;
            }
            if (!$inPaths) {
                continue;
            }
            if (preg_match('#^  (/\S*):\s*$#', $line, $m)) {
                $path = $m[1];
            } elseif ($path && preg_match('/^    (get|post|put|patch|delete):/', $line, $m)) {
                $ops[] = strtoupper($m[1]) . ' ' . $path;
            }
        }
        return $ops;
    }

    /** @return array<string,list<string>> operation => tests */
    public static function coveredOperations(): array
    {
        $root = dirname(__DIR__);
        $out = [];
        $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($root));
        foreach ($it as $f) {
            if (!$f->isFile() || !str_ends_with($f->getFilename(), 'Test.php')) {
                continue;
            }
            $rel = substr($f->getPathname(), strlen($root) + 1, -4);
            $class = 'Tests\\' . str_replace('/', '\\', $rel);
            if (!class_exists($class)) {
                continue;
            }
            foreach ((new ReflectionClass($class))->getMethods() as $method) {
                foreach ($method->getAttributes(Endpoint::class) as $attr) {
                    $out[$attr->newInstance()->operation][] = $class . '::' . $method->getName();
                }
            }
        }
        return $out;
    }

    public function test_openapi_file_is_readable(): void
    {
        $ops = self::openApiOperations();
        $this->assertGreaterThanOrEqual(100, count($ops), 'openapi.yaml should list the whole contract');
        $this->assertContains('GET /health', $ops);
        $this->assertContains('POST /client-log', $ops);
    }

    public function test_every_built_route_is_documented_and_tested(): void
    {
        $ops = self::openApiOperations();
        $tested = self::coveredOperations();
        foreach (Routes::build()->routes() as $route) {
            $this->assertContains($route->name(), $ops, "{$route->name()} is built but not in docs/openapi.yaml");
            $this->assertArrayHasKey($route->name(), $tested, "{$route->name()} is built but has no #[Endpoint] test");
        }
    }

    public function test_every_endpoint_attribute_points_at_a_real_operation(): void
    {
        $ops = self::openApiOperations();
        foreach (self::coveredOperations() as $op => $tests) {
            $this->assertContains($op, $ops, "Test(s) " . implode(', ', $tests) . " point at '$op', which is not in openapi.yaml");
        }
    }
}
