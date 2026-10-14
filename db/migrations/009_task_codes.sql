-- =============================================================================
-- A&M Wedding Planner — migration 009_task_codes.sql
-- Unique IDs for tasks; random IDs for attachments (version 1.0.22). Run AFTER 008.
-- Target: MySQL 8.0.16+ (also runs on MariaDB 10.4+).
--
--   1. tasks + code: an editable ID unique across tasks (capitals ignored), like TSK-4M8Q2D.
--      Every existing task gets a random one, oldest first.
--   2. attachments: the numbered IDs (ATT-000001 …) become random ones (ATT-7K3F9Q), oldest
--      first. IDs typed by hand (MEHNDI-DECOR-01) are kept.
--   New tasks and attachments get a random ID from the app; it can be changed any time.
--   (tasks.code stays NULL-able so rows written outside the app, e.g. demo data, can be filled after.)
--   Letters and digits that look alike (0/O, 1/I/L, U) are not used.
--
-- Card tracking (planned) moves to 010.
-- =============================================================================

-- Fails here, changing nothing, if 009 already ran.
INSERT INTO schema_migrations (version, name, applied_by)
VALUES (9, '009_task_codes', 'phpMyAdmin');

ALTER TABLE tasks
  ADD COLUMN code VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT 'Editable ID, unique across tasks, capitals ignored' AFTER public_id;

UPDATE tasks SET code = CONCAT('TSK-', CONCAT(SUBSTRING('23456789ABCDEFGHJKMNPQRSTVWXYZ', 1 + MOD(CONV(SUBSTRING(MD5(public_id), 1, 2), 16, 10), 30), 1), SUBSTRING('23456789ABCDEFGHJKMNPQRSTVWXYZ', 1 + MOD(CONV(SUBSTRING(MD5(public_id), 3, 2), 16, 10), 30), 1), SUBSTRING('23456789ABCDEFGHJKMNPQRSTVWXYZ', 1 + MOD(CONV(SUBSTRING(MD5(public_id), 5, 2), 16, 10), 30), 1), SUBSTRING('23456789ABCDEFGHJKMNPQRSTVWXYZ', 1 + MOD(CONV(SUBSTRING(MD5(public_id), 7, 2), 16, 10), 30), 1), SUBSTRING('23456789ABCDEFGHJKMNPQRSTVWXYZ', 1 + MOD(CONV(SUBSTRING(MD5(public_id), 9, 2), 16, 10), 30), 1), SUBSTRING('23456789ABCDEFGHJKMNPQRSTVWXYZ', 1 + MOD(CONV(SUBSTRING(MD5(public_id), 11, 2), 16, 10), 30), 1))) WHERE code IS NULL ORDER BY id;

-- The rare clash (two tasks drew the same letters): the later one draws again.
UPDATE tasks t JOIN (SELECT b.id FROM tasks a JOIN tasks b ON b.code = a.code AND b.id > a.id) d ON d.id = t.id
SET t.code = CONCAT('TSK-', CONCAT(SUBSTRING('23456789ABCDEFGHJKMNPQRSTVWXYZ', 1 + MOD(CONV(SUBSTRING(MD5(CONCAT(t.public_id, '-again')), 1, 2), 16, 10), 30), 1), SUBSTRING('23456789ABCDEFGHJKMNPQRSTVWXYZ', 1 + MOD(CONV(SUBSTRING(MD5(CONCAT(t.public_id, '-again')), 3, 2), 16, 10), 30), 1), SUBSTRING('23456789ABCDEFGHJKMNPQRSTVWXYZ', 1 + MOD(CONV(SUBSTRING(MD5(CONCAT(t.public_id, '-again')), 5, 2), 16, 10), 30), 1), SUBSTRING('23456789ABCDEFGHJKMNPQRSTVWXYZ', 1 + MOD(CONV(SUBSTRING(MD5(CONCAT(t.public_id, '-again')), 7, 2), 16, 10), 30), 1), SUBSTRING('23456789ABCDEFGHJKMNPQRSTVWXYZ', 1 + MOD(CONV(SUBSTRING(MD5(CONCAT(t.public_id, '-again')), 9, 2), 16, 10), 30), 1), SUBSTRING('23456789ABCDEFGHJKMNPQRSTVWXYZ', 1 + MOD(CONV(SUBSTRING(MD5(CONCAT(t.public_id, '-again')), 11, 2), 16, 10), 30), 1)));

ALTER TABLE tasks
  ADD UNIQUE KEY uq_tasks_code (code),
  ADD CONSTRAINT ck_tasks_code CHECK (CHAR_LENGTH(code) BETWEEN 3 AND 30);

-- Attachments: numbered IDs → random ones (one at a time, so the unique key never clashes).
UPDATE attachments SET code = CONCAT('ATT-', CONCAT(SUBSTRING('23456789ABCDEFGHJKMNPQRSTVWXYZ', 1 + MOD(CONV(SUBSTRING(MD5(public_id), 1, 2), 16, 10), 30), 1), SUBSTRING('23456789ABCDEFGHJKMNPQRSTVWXYZ', 1 + MOD(CONV(SUBSTRING(MD5(public_id), 3, 2), 16, 10), 30), 1), SUBSTRING('23456789ABCDEFGHJKMNPQRSTVWXYZ', 1 + MOD(CONV(SUBSTRING(MD5(public_id), 5, 2), 16, 10), 30), 1), SUBSTRING('23456789ABCDEFGHJKMNPQRSTVWXYZ', 1 + MOD(CONV(SUBSTRING(MD5(public_id), 7, 2), 16, 10), 30), 1), SUBSTRING('23456789ABCDEFGHJKMNPQRSTVWXYZ', 1 + MOD(CONV(SUBSTRING(MD5(public_id), 9, 2), 16, 10), 30), 1), SUBSTRING('23456789ABCDEFGHJKMNPQRSTVWXYZ', 1 + MOD(CONV(SUBSTRING(MD5(public_id), 11, 2), 16, 10), 30), 1)))
WHERE code REGEXP '^ATT-[0-9]{6}$' ORDER BY id;

UPDATE schema_migrations SET finished_at = CURRENT_TIMESTAMP WHERE version = 9;
