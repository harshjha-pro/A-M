<?php
declare(strict_types=1);

namespace AM\Repo;

use AM\Db\Db;

/**
 * Links to people as objects, never bare ids (API.md §1.1):
 * {"id": "01JA…", "name": "Mummy"} and "left": true for a member who left.
 */
final class Refs
{
    /** @var array<int, array<string,mixed>> */
    private array $users = [];

    public function __construct(private readonly Db $db, private readonly string $todayIst) {}

    public function user(?int $id): ?array
    {
        if ($id === null) {
            return null;
        }
        $u = $this->users[$id] ??= $this->db->one('SELECT id, public_id, name, is_active, access_ends_on FROM users WHERE id = ?', [$id]) ?? [];
        if ($u === []) {
            return null;
        }
        $ref = ['id' => $u['public_id'], 'name' => $u['name']];
        if ($this->hasLeft($u)) {
            $ref['left'] = true;
        }
        return $ref;
    }

    /** Deactivated, or past the access end date (IST). */
    public function hasLeft(array $u): bool
    {
        return (int) $u['is_active'] === 0 || ($u['access_ends_on'] !== null && $u['access_ends_on'] < $this->todayIst);
    }
}
