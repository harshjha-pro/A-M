-- =============================================================================
-- A&M Wedding Planner — migration 002_open_answers.sql
-- Applies the owner's answers of 8 Oct 2026 (DATABASE.md v1.1, §10).
-- Target: MySQL 8.0.16+ (also runs on MariaDB 10.4+). Run AFTER 001_init.
--
--   1. Mayra is one event, groom side only.
--   2. Food: only veg is served. The 'nonveg' option is removed.
--      SAFETY: if any family is saved as Non-veg, the file stops at the food
--      ALTER ("Data truncated for column 'food'") before changing anything else.
--      Nothing is converted silently. To recover:
--        a) SELECT id, name FROM households WHERE food = 'nonveg';
--           change those families to Veg / Jain / Mixed in the app;
--        b) DELETE FROM schema_migrations WHERE version = 2 AND finished_at IS NULL;
--        c) run this file again.
--   3. Audit-log tamper check: each backup run records the audit_log row
--      count and highest id. Safety card goes red if either ever goes down.
--
-- Not changed: Roka is not seeded (Engagement covers it). users.email stays
-- nullable (filled in later). Payments-card window is a query parameter only.
-- =============================================================================

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '+00:00';

-- Guard: a second run stops here (duplicate key).
INSERT INTO schema_migrations (version, name, applied_by)
VALUES (2, '002_open_answers', 'phpMyAdmin');

-- A. Food first, so if it stops nothing else has changed yet.
--    Options: veg, jain, mixed (mixed = veg family with some Jain members).
ALTER TABLE households
  MODIFY food ENUM('veg','jain','mixed') NOT NULL DEFAULT 'veg';

-- B. Mayra → groom side. Audit first (same values the UPDATE will produce), so
--    History shows "System changed Side from Both to Groom".
INSERT INTO audit_log (user_id, action, entity_type, entity_id, entity_version, before_json, after_json, note)
SELECT NULL, 'update', 'event', id, version + 1,
       JSON_OBJECT('side', side), JSON_OBJECT('side', 'groom'),
       'Migration 002: Mayra is groom side only'
FROM events
WHERE type = 'mayra' AND deleted_at IS NULL AND side <> 'groom';

UPDATE events
SET side = 'groom', version = version + 1
WHERE type = 'mayra' AND deleted_at IS NULL AND side <> 'groom';

-- C. Audit tamper check, filled in by the nightly backup job.
ALTER TABLE backup_runs
  ADD COLUMN audit_row_count BIGINT UNSIGNED NULL AFTER row_counts_json,
  ADD COLUMN audit_max_id    BIGINT UNSIGNED NULL AFTER audit_row_count;

UPDATE schema_migrations SET finished_at = CURRENT_TIMESTAMP WHERE version = 2;
