<?php
declare(strict_types=1);

namespace AM\Repo;

use AM\Kernel\HttpError;
use AM\Kernel\Request;

/**
 * Cursor paging (API.md §1.4): the cursor holds the last row's id and a hash
 * of the filters. Changing a filter with an old cursor → 400 bad_cursor
 * ("This list changed. Pull down to refresh."). Lists here are newest first,
 * by id, so a new row never shifts a page.
 */
final class Cursor
{
    /** @param array<string,mixed> $filters */
    public function __construct(private readonly string $list, private readonly array $filters = []) {}

    public function encode(int $lastId): string
    {
        $data = ['i' => $lastId, 'l' => $this->list, 'f' => $this->hash()];
        return rtrim(strtr(base64_encode((string) json_encode($data)), '+/', '-_'), '=');
    }

    /** id to continue below (PHP_INT_MAX for the first page). */
    public function before(Request $request): int
    {
        $c = $request->query['cursor'] ?? '';
        if ($c === '') {
            return PHP_INT_MAX;
        }
        $data = json_decode((string) base64_decode(strtr($c, '-_', '+/'), true), true);
        if (!is_array($data) || ($data['l'] ?? null) !== $this->list || ($data['f'] ?? null) !== $this->hash() || !is_int($data['i'] ?? null)) {
            throw HttpError::make(400, 'bad_cursor');
        }
        return $data['i'];
    }

    /** ?limit= 1…200, default given. */
    public static function limit(Request $request, int $default = 50): int
    {
        $l = $request->query['limit'] ?? (string) $default;
        if (!ctype_digit($l) || (int) $l < 1 || (int) $l > 200) {
            throw HttpError::make(400, 'bad_request');
        }
        return (int) $l;
    }

    /**
     * Cut one extra row off and build meta.
     * @param list<array> $rows fetched with LIMIT $limit + 1, newest first
     * @return array{0: list<array>, 1: array}
     */
    public function page(array $rows, int $limit): array
    {
        $more = count($rows) > $limit;
        $rows = array_slice($rows, 0, $limit);
        $meta = ['has_more' => $more];
        if ($more && $rows !== []) {
            $meta['next_cursor'] = $this->encode((int) end($rows)['id']);
        }
        return [$rows, $meta];
    }

    private function hash(): string
    {
        $f = $this->filters;
        ksort($f);
        return substr(hash('sha256', (string) json_encode($f)), 0, 12);
    }
}
