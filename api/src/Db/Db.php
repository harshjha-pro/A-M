<?php
declare(strict_types=1);

namespace AM\Db;

use AM\Kernel\Env;
use PDO;
use PDOStatement;

/**
 * The only way PHP talks to MySQL. Connect rules from DATABASE.md §5 rule 1:
 * utf8mb4, UTC, strict sql_mode, exceptions, real prepared statements.
 */
final class Db
{
    public const SQL_MODE = 'STRICT_ALL_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO';

    public function __construct(public readonly PDO $pdo) {}

    public static function connect(Env $env): self
    {
        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
            $env->get('DB_HOST', 'localhost'),
            $env->int('DB_PORT', 3306),
            $env->get('DB_NAME'),
        );
        $pdo = new PDO($dsn, $env->get('DB_USER'), $env->get('DB_PASS'), [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_STRINGIFY_FETCHES => false,
            PDO::ATTR_TIMEOUT => 5,
        ]);
        $pdo->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
        $pdo->exec("SET time_zone = '+00:00'");
        $pdo->exec("SET SESSION sql_mode = '" . self::SQL_MODE . "'");
        return new self($pdo);
    }

    /** @param list<mixed> $params */
    public function run(string $sql, array $params = []): PDOStatement
    {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    /** @return array<string,mixed>|null */
    public function one(string $sql, array $params = []): ?array
    {
        $row = $this->run($sql, $params)->fetch();
        return $row === false ? null : $row;
    }

    /** @return list<array<string,mixed>> */
    public function all(string $sql, array $params = []): array
    {
        return $this->run($sql, $params)->fetchAll();
    }

    public function value(string $sql, array $params = []): mixed
    {
        $v = $this->run($sql, $params)->fetchColumn();
        return $v === false ? null : $v;
    }
}
