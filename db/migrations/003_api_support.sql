-- =============================================================================
-- A&M Wedding Planner — migration 003_api_support.sql
-- Supports API.md v1.1 (owner's answers of 8 Oct 2026). Run AFTER 002.
-- Target: MySQL 8.0.16+ (also runs on MariaDB 10.4+).
--
--   1. rate_limits: one counter row per (bucket, time window). Used by PHP
--      for every limit in API.md §10.1 except login (login_attempts does that).
--      Ephemeral: PHP deletes windows older than 1 day.
--   2. task_items.client_uuid: the API addresses checklist items by this key
--      (API.md API11). Any row without one gets a UUID now. PHP fills it on
--      every new item, so after this it is never NULL.
--
-- Nothing existing is renamed, dropped or retyped. If this file stops part-way:
-- read the error, finish the remaining statements by hand, then run the last
-- UPDATE (it sets finished_at). Do not re-run the whole file.
-- =============================================================================

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '+00:00';

-- Guard: a second run stops here (duplicate key).
INSERT INTO schema_migrations (version, name, applied_by)
VALUES (3, '003_api_support', 'phpMyAdmin');

-- 1. Rate-limit counters (fixed windows).
--    PHP: INSERT INTO rate_limits (bucket, window_start, hits) VALUES (?, ?, 1)
--         ON DUPLICATE KEY UPDATE hits = hits + 1;   then compare hits to the limit.
CREATE TABLE rate_limits (
  bucket        VARCHAR(120) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'e.g. write:user:12, anon:ip:103.21.58.10',
  window_start  DATETIME NOT NULL COMMENT 'UTC start of the fixed window',
  hits          INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start),
  KEY ix_rate_limits_window (window_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Ephemeral. PHP deletes windows older than 1 day. Not exported, not audited.';

-- 2. Every checklist item gets a key (API addresses items by it).
-- updated_at = updated_at keeps the row from looking edited (DATABASE rule 11).
UPDATE task_items SET client_uuid = UUID(), updated_at = updated_at WHERE client_uuid IS NULL;

UPDATE schema_migrations SET finished_at = CURRENT_TIMESTAMP WHERE version = 3;
