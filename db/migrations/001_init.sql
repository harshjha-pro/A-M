-- =============================================================================
-- A&M Wedding Planner — Release 1 database
-- File: 001_init.sql  (delivered as schema.sql)
-- Target: Hostinger MariaDB 10.4+ / MySQL 8.0.16+ (CHECK constraints enforced)
-- Tested: MariaDB 10.11.14 and MySQL 8.0.46 in a sandbox, 8 Oct 2026
--
-- HOW TO RUN (phpMyAdmin)
--   1. Export the database first (Export -> Quick -> SQL). Keep the file.
--   2. Select the wedding database in the left panel.
--   3. Import -> choose this file -> Character set: utf-8 -> Go.
--      Leave "Enable foreign key checks" ticked.
--   4. The first statement after schema_migrations records version 1.
--      If you run this file twice, it stops at that line with
--      "Duplicate entry '1'". That is the guard. Nothing else runs.
--
-- RULES BAKED IN
--   * All times are UTC. Every connection must run SET time_zone = '+00:00'
--     (this file does; the PHP PDO bootstrap must too).
--   * No triggers, no stored procedures, no events. All logic lives in PHP.
--   * No ON DELETE CASCADE. Every foreign key is RESTRICT, because the app
--     never hard-deletes business rows. A mistaken DELETE in phpMyAdmin
--     fails loudly instead of wiping children.
--   * Money is BIGINT paise (signed, with CHECK >= 0, so maths like
--     planned - spent can go negative without an "out of range" error).
-- =============================================================================

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '+00:00';
SET foreign_key_checks = 1;

-- -----------------------------------------------------------------------------
-- 0. Migration ledger
-- -----------------------------------------------------------------------------
CREATE TABLE schema_migrations (
  version      INT UNSIGNED NOT NULL,
  name         VARCHAR(120) NOT NULL,
  started_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at  DATETIME NULL,
  applied_by   VARCHAR(80) NULL,
  notes        VARCHAR(500) NULL,
  PRIMARY KEY (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='One row per applied migration file. finished_at NULL = it failed part-way.';

-- Guard: a second run of this file stops here (duplicate key).
INSERT INTO schema_migrations (version, name, applied_by)
VALUES (1, '001_init', 'phpMyAdmin');

-- -----------------------------------------------------------------------------
-- 1. People and access
-- -----------------------------------------------------------------------------
CREATE TABLE users (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id        CHAR(26) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  client_uuid      CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  name             VARCHAR(80) NOT NULL,
  phone            VARCHAR(16) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL COMMENT 'E.164, e.g. +919829012345',
  email            VARCHAR(190) NULL COMMENT 'R2a: email fallback for reminders',
  password_hash    VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'PHP password_hash(); never logged',
  role             ENUM('owner','partner','family','viewer') NOT NULL DEFAULT 'family',
  can_see_money    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  is_active        TINYINT UNSIGNED NOT NULL DEFAULT 1,
  access_ends_on   DATE NULL COMMENT 'IST date; access stops the day after',
  must_change_password TINYINT UNSIGNED NOT NULL DEFAULT 0,
  password_changed_at DATETIME NULL,
  -- No last_seen_at here: "last seen" = MAX(sessions.last_used_at). Writing it on every
  -- request would bump updated_at and could clash with admin edits (self-review fix R1).
  -- standard columns
  version          INT UNSIGNED NOT NULL DEFAULT 1,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by       BIGINT UNSIGNED NULL,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by       BIGINT UNSIGNED NULL,
  deleted_at       DATETIME NULL COMMENT 'Members are deactivated, never deleted. Kept for uniform code.',
  deleted_by       BIGINT UNSIGNED NULL,
  delete_batch_id  BIGINT UNSIGNED NULL,
  -- uniqueness helpers (NULL rows are ignored by UNIQUE)
  owner_slot       TINYINT GENERATED ALWAYS AS (IF(role = 'owner', 1, NULL)) STORED,
  active_phone     VARCHAR(16) CHARACTER SET ascii COLLATE ascii_general_ci
                   GENERATED ALWAYS AS (IF(is_active = 1 AND deleted_at IS NULL, phone, NULL)) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_public_id (public_id),
  UNIQUE KEY uq_users_client_uuid (client_uuid),
  UNIQUE KEY uq_users_one_owner (owner_slot),
  UNIQUE KEY uq_users_active_phone (active_phone),
  KEY ix_users_phone (phone),
  CONSTRAINT ck_users_version   CHECK (version >= 1),
  CONSTRAINT ck_users_money     CHECK (role NOT IN ('owner','partner') OR can_see_money = 1),
  CONSTRAINT ck_users_owner_on  CHECK (role <> 'owner' OR is_active = 1),
  CONSTRAINT ck_users_flags     CHECK (can_see_money IN (0,1) AND is_active IN (0,1) AND must_change_password IN (0,1)),
  CONSTRAINT ck_users_deleted   CHECK ((deleted_at IS NULL) = (delete_batch_id IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE users
  ADD CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT fk_users_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT fk_users_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Groups every delete, bulk action, import and undo so it can be reversed as one.
-- (FEATURES B9 calls this delete_batches; it also serves A2 undo and A8 imports.)
CREATE TABLE change_batches (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id        CHAR(26) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL COMMENT 'Used in POST /undo/{batch_id}',
  action           ENUM('delete','bulk_update','import','status_change','pay_part','restore','undo','merge') NOT NULL,
  entity_type      VARCHAR(40) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL COMMENT 'Main type, e.g. household',
  item_count       INT UNSIGNED NOT NULL DEFAULT 0,
  summary          VARCHAR(200) NOT NULL COMMENT 'Plain sentence for Trash, e.g. Sharma family · 3 invitations',
  user_id          BIGINT UNSIGNED NULL COMMENT 'NULL = system job',
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  undone_at        DATETIME NULL,
  undone_by        BIGINT UNSIGNED NULL,
  undo_batch_id    BIGINT UNSIGNED NULL COMMENT 'The batch that reversed this one',
  PRIMARY KEY (id),
  UNIQUE KEY uq_change_batches_public_id (public_id),
  KEY ix_change_batches_action_created (action, created_at),
  KEY ix_change_batches_user_created (user_id, created_at),
  KEY ix_change_batches_type_created (entity_type, created_at),
  CONSTRAINT fk_change_batches_user   FOREIGN KEY (user_id)   REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_change_batches_undone FOREIGN KEY (undone_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_change_batches_undo   FOREIGN KEY (undo_batch_id) REFERENCES change_batches (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_change_batches_undone CHECK (undone_by IS NULL OR undone_at IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE users
  ADD CONSTRAINT fk_users_delete_batch FOREIGN KEY (delete_batch_id) REFERENCES change_batches (id) ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE sessions (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  token_hash       CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'SHA-256 of the cookie value. The raw token is never stored.',
  csrf_hash        CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'SHA-256 of the CSRF token returned by GET /session',
  user_id          BIGINT UNSIGNED NOT NULL,
  device_label     VARCHAR(60) NULL COMMENT 'e.g. iPhone · installed',
  user_agent       VARCHAR(255) NULL,
  ip               VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at       DATETIME NOT NULL COMMENT 'Sliding: last use + 90 days',
  revoked_at       DATETIME NULL,
  revoked_reason   ENUM('logout','logout_all','password_reset','password_change','deactivated','access_ended','expired') NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sessions_token (token_hash),
  KEY ix_sessions_user (user_id, revoked_at),
  KEY ix_sessions_user_last_used (user_id, last_used_at),
  KEY ix_sessions_expires (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Ephemeral. PHP may hard-delete rows expired > 30 days.';

CREATE TABLE login_attempts (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  phone            VARCHAR(16) CHARACTER SET ascii COLLATE ascii_general_ci NULL COMMENT 'Normalised phone as typed; may not belong to a user',
  ip               VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  user_id          BIGINT UNSIGNED NULL,
  succeeded        TINYINT UNSIGNED NOT NULL DEFAULT 0,
  attempted_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_login_attempts_phone (phone, attempted_at),
  KEY ix_login_attempts_ip (ip, attempted_at),
  CONSTRAINT fk_login_attempts_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Rate limit: 5 fails per phone or 20 per IP in 15 min. Ephemeral; purge > 30 days.';

CREATE TABLE password_resets (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id          BIGINT UNSIGNED NOT NULL COMMENT 'Whose password was reset',
  reset_by         BIGINT UNSIGNED NULL COMMENT 'Admin who did it. NULL = self-service link (Later)',
  method           ENUM('admin_set','admin_generated','self_change','link') NOT NULL,
  token_hash       CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL COMMENT 'Only for a future self-service link',
  expires_at       DATETIME NULL,
  used_at          DATETIME NULL,
  sessions_revoked INT UNSIGNED NOT NULL DEFAULT 0,
  ip               VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_password_resets_token (token_hash),
  KEY ix_password_resets_user (user_id, created_at),
  CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id)  REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_password_resets_by   FOREIGN KEY (reset_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Log of every password reset/change. Never stores the password.';

-- Stores the response of every write so a retry returns the same answer.
CREATE TABLE idempotency_keys (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  idem_key         CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL COMMENT 'Client UUID sent in Idempotency-Key header',
  user_id          BIGINT UNSIGNED NOT NULL,
  method           ENUM('POST','PUT','PATCH','DELETE') NOT NULL,
  path             VARCHAR(200) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  request_hash     CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'SHA-256 of the body; same key + different body = 422',
  status           ENUM('processing','done') NOT NULL DEFAULT 'processing',
  response_code    SMALLINT UNSIGNED NULL,
  response_body    MEDIUMTEXT NULL COMMENT 'JSON; replayed on retry',
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at       DATETIME NOT NULL COMMENT 'created_at + 48 h',
  PRIMARY KEY (id),
  UNIQUE KEY uq_idempotency_user_key (user_id, idem_key),
  KEY ix_idempotency_expires (expires_at),
  CONSTRAINT fk_idempotency_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Ephemeral. PHP may hard-delete expired rows.';

-- -----------------------------------------------------------------------------
-- 2. Wedding facts (exactly one row; CONTEXT decision 1)
-- -----------------------------------------------------------------------------
CREATE TABLE settings (
  id                   BIGINT UNSIGNED NOT NULL DEFAULT 1,
  bride_name           VARCHAR(80) NOT NULL,
  groom_name           VARCHAR(80) NOT NULL,
  bride_side_label     VARCHAR(40) NOT NULL,
  groom_side_label     VARCHAR(40) NOT NULL,
  wedding_start_date   DATE NOT NULL,
  wedding_end_date     DATE NOT NULL,
  city                 VARCHAR(60) NOT NULL,
  total_budget_paise   BIGINT NULL,
  timezone             VARCHAR(40) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL DEFAULT 'Asia/Kolkata',
  currency             CHAR(3) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL DEFAULT 'INR',
  setup_completed_at   DATETIME NULL,
  version              INT UNSIGNED NOT NULL DEFAULT 1,
  created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by           BIGINT UNSIGNED NULL,
  updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by           BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_settings_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_settings_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_settings_one_row  CHECK (id = 1),
  CONSTRAINT ck_settings_version  CHECK (version >= 1),
  CONSTRAINT ck_settings_dates    CHECK (wedding_end_date >= wedding_start_date),
  CONSTRAINT ck_settings_budget   CHECK (total_budget_paise IS NULL OR total_budget_paise >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Single row (id = 1). Cannot be deleted, so no deleted_* columns.';

-- -----------------------------------------------------------------------------
-- 3. Files (bytes on disk, outside public_html) — immutable
-- -----------------------------------------------------------------------------
CREATE TABLE files (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id        CHAR(26) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  storage_path     VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'uploads/YYYY/MM/<uuid>.<ext>, relative to the private storage root',
  original_name    VARCHAR(255) NOT NULL,
  mime_type        VARCHAR(100) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL COMMENT 'From finfo, not the browser',
  size_bytes       BIGINT UNSIGNED NOT NULL,
  sha256           CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  width_px         SMALLINT UNSIGNED NULL,
  height_px        SMALLINT UNSIGNED NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by       BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_files_public_id (public_id),
  UNIQUE KEY uq_files_storage_path (storage_path),
  UNIQUE KEY uq_files_sha256 (sha256),
  CONSTRAINT fk_files_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_files_size CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  CONSTRAINT ck_files_mime CHECK (mime_type IN ('image/jpeg','image/png','image/webp','application/pdf'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Never updated or deleted in R1. Same bytes = same row (sha256 unique); documents point here.';

-- -----------------------------------------------------------------------------
-- 4. Events
-- -----------------------------------------------------------------------------
CREATE TABLE events (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id        CHAR(26) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  client_uuid      CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  name             VARCHAR(80) NOT NULL,
  type             ENUM('engagement','roka','haldi','mehndi','sangeet','mayra','wedding','reception','other') NOT NULL DEFAULT 'other',
  side             ENUM('bride','groom','both') NOT NULL DEFAULT 'both',
  guests_invited   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  start_at         DATETIME NULL COMMENT 'UTC. NULL = Date not set',
  end_at           DATETIME NULL COMMENT 'UTC',
  all_day          TINYINT UNSIGNED NOT NULL DEFAULT 0,
  venue_name       VARCHAR(120) NULL,
  venue_address    VARCHAR(300) NULL,
  map_url          VARCHAR(500) NULL,
  dress_code       VARCHAR(120) NULL,
  notes            TEXT NULL,
  sort_order       SMALLINT NOT NULL DEFAULT 0,
  version          INT UNSIGNED NOT NULL DEFAULT 1,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by       BIGINT UNSIGNED NULL,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by       BIGINT UNSIGNED NULL,
  deleted_at       DATETIME NULL,
  deleted_by       BIGINT UNSIGNED NULL,
  delete_batch_id  BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_events_public_id (public_id),
  UNIQUE KEY uq_events_client_uuid (client_uuid),
  KEY ix_events_live_start (deleted_at, start_at),
  KEY ix_events_live_invited (deleted_at, guests_invited, sort_order),
  CONSTRAINT fk_events_created_by   FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_events_updated_by   FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_events_deleted_by   FOREIGN KEY (deleted_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_events_delete_batch FOREIGN KEY (delete_batch_id) REFERENCES change_batches (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_events_version CHECK (version >= 1),
  CONSTRAINT ck_events_end     CHECK (end_at IS NULL OR (start_at IS NOT NULL AND end_at > start_at)),
  CONSTRAINT ck_events_map     CHECK (map_url IS NULL OR map_url LIKE 'https://%'),
  CONSTRAINT ck_events_notes   CHECK (notes IS NULL OR CHAR_LENGTH(notes) <= 5000),
  CONSTRAINT ck_events_flags   CHECK (guests_invited IN (0,1) AND all_day IN (0,1)),
  CONSTRAINT ck_events_deleted CHECK ((deleted_at IS NULL) = (delete_batch_id IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. Guests: households (UI "Family") and invitations + RSVP
-- -----------------------------------------------------------------------------
CREATE TABLE households (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id        CHAR(26) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  client_uuid      CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  name             VARCHAR(120) NOT NULL,
  name_norm        VARCHAR(120) NOT NULL COMMENT 'Set by PHP: lower-case, without ji/family/&. For duplicate checks.',
  phone            VARCHAR(16) CHARACTER SET ascii COLLATE ascii_general_ci NULL COMMENT 'E.164',
  alt_phone        VARCHAR(16) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  side             ENUM('bride','groom','both') NOT NULL,
  group_name       VARCHAR(80) NULL,
  relation         VARCHAR(40) NULL,
  area             VARCHAR(80) NULL,
  city             VARCHAR(60) NULL,
  address          VARCHAR(300) NULL,
  adults           TINYINT UNSIGNED NOT NULL DEFAULT 2,
  children         TINYINT UNSIGNED NOT NULL DEFAULT 0,
  food             ENUM('veg','jain','nonveg','mixed') NOT NULL DEFAULT 'veg',
  jain_count       TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Used only when food = mixed',
  is_vip           TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'UI: Important',
  notes            TEXT NULL,
  version          INT UNSIGNED NOT NULL DEFAULT 1,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by       BIGINT UNSIGNED NULL,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by       BIGINT UNSIGNED NULL,
  deleted_at       DATETIME NULL,
  deleted_by       BIGINT UNSIGNED NULL,
  delete_batch_id  BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_households_public_id (public_id),
  UNIQUE KEY uq_households_client_uuid (client_uuid),
  KEY ix_households_live_name (deleted_at, name),
  KEY ix_households_live_side (deleted_at, side, name),
  KEY ix_households_live_group (deleted_at, group_name),
  KEY ix_households_live_area (deleted_at, area),
  KEY ix_households_live_food (deleted_at, food),
  KEY ix_households_live_vip (deleted_at, is_vip),
  KEY ix_households_phone (phone),
  KEY ix_households_alt_phone (alt_phone),
  KEY ix_households_name_city (name_norm, city),
  CONSTRAINT fk_households_created_by   FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_households_updated_by   FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_households_deleted_by   FOREIGN KEY (deleted_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_households_delete_batch FOREIGN KEY (delete_batch_id) REFERENCES change_batches (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_households_version CHECK (version >= 1),
  CONSTRAINT ck_households_people  CHECK (adults <= 50 AND children <= 50 AND adults + children >= 1),
  CONSTRAINT ck_households_jain    CHECK (jain_count <= adults + children),
  CONSTRAINT ck_households_vip     CHECK (is_vip IN (0,1)),
  CONSTRAINT ck_households_notes   CHECK (notes IS NULL OR CHAR_LENGTH(notes) <= 5000),
  CONSTRAINT ck_households_deleted CHECK ((deleted_at IS NULL) = (delete_batch_id IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE household_events (
  id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_uuid            CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  household_id           BIGINT UNSIGNED NOT NULL,
  event_id               BIGINT UNSIGNED NOT NULL,
  rsvp                   ENUM('not_asked','waiting','coming','not_coming') NOT NULL DEFAULT 'not_asked',
  expected_adults        TINYINT UNSIGNED NULL COMMENT 'NULL = use households.adults',
  expected_children      TINYINT UNSIGNED NULL COMMENT 'NULL = use households.children',
  rsvp_note              VARCHAR(200) NULL,
  rsvp_updated_at        DATETIME NULL,
  rsvp_updated_by        BIGINT UNSIGNED NULL,
  last_reminder_opened_at DATETIME NULL,
  version                INT UNSIGNED NOT NULL DEFAULT 1,
  created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by             BIGINT UNSIGNED NULL,
  updated_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by             BIGINT UNSIGNED NULL,
  deleted_at             DATETIME NULL,
  deleted_by             BIGINT UNSIGNED NULL,
  delete_batch_id        BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_household_events_pair (household_id, event_id) COMMENT 'Includes deleted rows: re-inviting revives the old row',
  UNIQUE KEY uq_household_events_client_uuid (client_uuid),
  KEY ix_household_events_event (event_id, deleted_at, rsvp),
  CONSTRAINT fk_household_events_household  FOREIGN KEY (household_id) REFERENCES households (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_household_events_event      FOREIGN KEY (event_id)     REFERENCES events (id)     ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_household_events_rsvp_by    FOREIGN KEY (rsvp_updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_household_events_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_household_events_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_household_events_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_household_events_batch      FOREIGN KEY (delete_batch_id) REFERENCES change_batches (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_household_events_version CHECK (version >= 1),
  CONSTRAINT ck_household_events_people  CHECK ((expected_adults IS NULL OR expected_adults <= 50) AND (expected_children IS NULL OR expected_children <= 50)),
  CONSTRAINT ck_household_events_deleted CHECK ((deleted_at IS NULL) = (delete_batch_id IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Invitation of one family to one event, with its RSVP.';

-- -----------------------------------------------------------------------------
-- 6. Money: categories, vendors, payments
-- -----------------------------------------------------------------------------
CREATE TABLE budget_categories (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id        CHAR(26) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  client_uuid      CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  name             VARCHAR(60) NOT NULL,
  planned_paise    BIGINT NOT NULL DEFAULT 0,
  sort_order       SMALLINT NOT NULL DEFAULT 0,
  is_fallback      TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '1 = Miscellaneous (default category)',
  version          INT UNSIGNED NOT NULL DEFAULT 1,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by       BIGINT UNSIGNED NULL,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by       BIGINT UNSIGNED NULL,
  deleted_at       DATETIME NULL,
  deleted_by       BIGINT UNSIGNED NULL,
  delete_batch_id  BIGINT UNSIGNED NULL,
  live_name        VARCHAR(60) GENERATED ALWAYS AS (IF(deleted_at IS NULL, name, NULL)) STORED,
  fallback_slot    TINYINT GENERATED ALWAYS AS (IF(is_fallback = 1, 1, NULL)) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uq_budget_categories_public_id (public_id),
  UNIQUE KEY uq_budget_categories_one_fallback (fallback_slot),
  UNIQUE KEY uq_budget_categories_client_uuid (client_uuid),
  UNIQUE KEY uq_budget_categories_live_name (live_name),
  KEY ix_budget_categories_live_sort (deleted_at, sort_order),
  CONSTRAINT fk_budget_categories_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_budget_categories_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_budget_categories_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_budget_categories_batch      FOREIGN KEY (delete_batch_id) REFERENCES change_batches (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_budget_categories_version CHECK (version >= 1),
  CONSTRAINT ck_budget_categories_planned CHECK (planned_paise >= 0),
  CONSTRAINT ck_budget_categories_fallback CHECK (is_fallback = 0 OR deleted_at IS NULL),
  CONSTRAINT ck_budget_categories_deleted CHECK ((deleted_at IS NULL) = (delete_batch_id IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vendors (
  id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id            CHAR(26) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  client_uuid          CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  name                 VARCHAR(120) NOT NULL,
  category             ENUM('venue','caterer','tent_decor','photo_video','makeup','mehndi_artist','band_dj','florist','transport','printer','pandit','jeweller','tailor','other') NOT NULL DEFAULT 'other',
  contact_person       VARCHAR(80) NULL,
  phone                VARCHAR(16) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  alt_phone            VARCHAR(16) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  agreed_amount_paise  BIGINT NULL COMMENT 'Money users only (API strips it for others)',
  is_booked            TINYINT UNSIGNED NOT NULL DEFAULT 0,
  notes                TEXT NULL,
  version              INT UNSIGNED NOT NULL DEFAULT 1,
  created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by           BIGINT UNSIGNED NULL,
  updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by           BIGINT UNSIGNED NULL,
  deleted_at           DATETIME NULL,
  deleted_by           BIGINT UNSIGNED NULL,
  delete_batch_id      BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vendors_public_id (public_id),
  UNIQUE KEY uq_vendors_client_uuid (client_uuid),
  KEY ix_vendors_live_name (deleted_at, name),
  KEY ix_vendors_live_category (deleted_at, category),
  KEY ix_vendors_phone (phone),
  CONSTRAINT fk_vendors_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_vendors_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_vendors_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_vendors_batch      FOREIGN KEY (delete_batch_id) REFERENCES change_batches (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_vendors_version CHECK (version >= 1),
  CONSTRAINT ck_vendors_agreed  CHECK (agreed_amount_paise IS NULL OR agreed_amount_paise >= 0),
  CONSTRAINT ck_vendors_booked  CHECK (is_booked IN (0,1)),
  CONSTRAINT ck_vendors_notes   CHECK (notes IS NULL OR CHAR_LENGTH(notes) <= 5000),
  CONSTRAINT ck_vendors_deleted CHECK ((deleted_at IS NULL) = (delete_batch_id IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One table for payments and expenses (FEATURES C7).
CREATE TABLE payments (
  id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id              CHAR(26) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  client_uuid            CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  title                  VARCHAR(120) NOT NULL,
  vendor_id              BIGINT UNSIGNED NULL COMMENT 'NULL = shown as an Expense',
  category_id            BIGINT UNSIGNED NOT NULL,
  event_id               BIGINT UNSIGNED NULL,
  amount_paise           BIGINT NOT NULL,
  status                 ENUM('due','paid') NOT NULL DEFAULT 'due',
  due_date               DATE NULL COMMENT 'IST date',
  paid_on                DATE NULL COMMENT 'IST date',
  method                 ENUM('cash','upi','bank','cheque','card','other') NULL,
  paid_by                VARCHAR(60) NULL,
  reference              VARCHAR(60) NULL,
  notes                  TEXT NULL,
  split_from_payment_id  BIGINT UNSIGNED NULL COMMENT 'Pay part: the Due row this Paid row was split from',
  version                INT UNSIGNED NOT NULL DEFAULT 1,
  created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by             BIGINT UNSIGNED NULL,
  updated_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by             BIGINT UNSIGNED NULL,
  deleted_at             DATETIME NULL,
  deleted_by             BIGINT UNSIGNED NULL,
  delete_batch_id        BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payments_public_id (public_id),
  UNIQUE KEY uq_payments_client_uuid (client_uuid),
  KEY ix_payments_live_status_due (deleted_at, status, due_date),
  KEY ix_payments_live_paid_on (deleted_at, paid_on),
  KEY ix_payments_category (category_id, deleted_at, status),
  KEY ix_payments_vendor (vendor_id, deleted_at, status),
  KEY ix_payments_event (event_id, deleted_at),
  KEY ix_payments_split (split_from_payment_id),
  CONSTRAINT fk_payments_vendor     FOREIGN KEY (vendor_id)   REFERENCES vendors (id)           ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_payments_category   FOREIGN KEY (category_id) REFERENCES budget_categories (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_payments_event      FOREIGN KEY (event_id)    REFERENCES events (id)            ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_payments_split      FOREIGN KEY (split_from_payment_id) REFERENCES payments (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_payments_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_payments_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_payments_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_payments_batch      FOREIGN KEY (delete_batch_id) REFERENCES change_batches (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_payments_version CHECK (version >= 1),
  CONSTRAINT ck_payments_amount  CHECK (amount_paise > 0 AND amount_paise <= 1000000000),
  CONSTRAINT ck_payments_state   CHECK (
       (status = 'paid' AND paid_on IS NOT NULL AND method IS NOT NULL)
    OR (status = 'due'  AND paid_on IS NULL)),
  CONSTRAINT ck_payments_notes   CHECK (notes IS NULL OR CHAR_LENGTH(notes) <= 5000),
  CONSTRAINT ck_payments_deleted CHECK ((deleted_at IS NULL) = (delete_batch_id IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 7. Tasks
-- -----------------------------------------------------------------------------
CREATE TABLE tasks (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id        CHAR(26) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  client_uuid      CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  title            VARCHAR(200) NOT NULL,
  notes            TEXT NULL,
  status           ENUM('todo','doing','waiting','done','cancelled') NOT NULL DEFAULT 'todo',
  priority         ENUM('urgent','normal','low') NOT NULL DEFAULT 'normal' COMMENT 'ENUM order = sort order',
  due_date         DATE NULL COMMENT 'IST calendar date',
  due_time         TIME NULL COMMENT 'IST wall-clock time',
  event_id         BIGINT UNSIGNED NULL,
  vendor_id        BIGINT UNSIGNED NULL,
  household_id     BIGINT UNSIGNED NULL,
  completed_at     DATETIME NULL,
  completed_by     BIGINT UNSIGNED NULL,
  postpone_count   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  version          INT UNSIGNED NOT NULL DEFAULT 1,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by       BIGINT UNSIGNED NULL,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by       BIGINT UNSIGNED NULL,
  deleted_at       DATETIME NULL,
  deleted_by       BIGINT UNSIGNED NULL,
  delete_batch_id  BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tasks_public_id (public_id),
  UNIQUE KEY uq_tasks_client_uuid (client_uuid),
  KEY ix_tasks_live_status_due (deleted_at, status, due_date, priority),
  KEY ix_tasks_live_priority (deleted_at, priority),
  KEY ix_tasks_live_title (deleted_at, title),
  KEY ix_tasks_event (event_id, deleted_at, status),
  KEY ix_tasks_vendor (vendor_id, deleted_at),
  KEY ix_tasks_household (household_id, deleted_at),
  CONSTRAINT fk_tasks_event        FOREIGN KEY (event_id)     REFERENCES events (id)     ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_tasks_vendor       FOREIGN KEY (vendor_id)    REFERENCES vendors (id)    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_tasks_household    FOREIGN KEY (household_id) REFERENCES households (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_tasks_completed_by FOREIGN KEY (completed_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_tasks_created_by   FOREIGN KEY (created_by)   REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_tasks_updated_by   FOREIGN KEY (updated_by)   REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_tasks_deleted_by   FOREIGN KEY (deleted_by)   REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_tasks_batch        FOREIGN KEY (delete_batch_id) REFERENCES change_batches (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_tasks_version   CHECK (version >= 1),
  CONSTRAINT ck_tasks_time      CHECK (due_time IS NULL OR due_date IS NOT NULL),
  CONSTRAINT ck_tasks_completed CHECK ((status = 'done') = (completed_at IS NOT NULL)),
  CONSTRAINT ck_tasks_notes     CHECK (notes IS NULL OR CHAR_LENGTH(notes) <= 5000),
  CONSTRAINT ck_tasks_deleted   CHECK ((deleted_at IS NULL) = (delete_batch_id IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Child collection of a task. Changes always bump tasks.version in the same transaction.
CREATE TABLE task_assignees (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  task_id          BIGINT UNSIGNED NOT NULL,
  user_id          BIGINT UNSIGNED NOT NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by       BIGINT UNSIGNED NULL,
  deleted_at       DATETIME NULL,
  deleted_by       BIGINT UNSIGNED NULL,
  delete_batch_id  BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_task_assignees_pair (task_id, user_id) COMMENT 'Re-assigning revives the old row',
  KEY ix_task_assignees_user (user_id, deleted_at, task_id),
  CONSTRAINT fk_task_assignees_task       FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_task_assignees_user       FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_task_assignees_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_task_assignees_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_task_assignees_batch      FOREIGN KEY (delete_batch_id) REFERENCES change_batches (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE task_items (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_uuid      CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  task_id          BIGINT UNSIGNED NOT NULL,
  text             VARCHAR(200) NOT NULL,
  is_done          TINYINT UNSIGNED NOT NULL DEFAULT 0,
  done_at          DATETIME NULL,
  done_by          BIGINT UNSIGNED NULL,
  sort_order       SMALLINT NOT NULL DEFAULT 0,
  version          INT UNSIGNED NOT NULL DEFAULT 1,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by       BIGINT UNSIGNED NULL,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by       BIGINT UNSIGNED NULL,
  deleted_at       DATETIME NULL,
  deleted_by       BIGINT UNSIGNED NULL,
  delete_batch_id  BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_task_items_client_uuid (client_uuid),
  KEY ix_task_items_task (task_id, deleted_at, sort_order),
  CONSTRAINT fk_task_items_task       FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_task_items_done_by    FOREIGN KEY (done_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_task_items_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_task_items_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_task_items_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_task_items_batch      FOREIGN KEY (delete_batch_id) REFERENCES change_batches (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_task_items_version CHECK (version >= 1),
  CONSTRAINT ck_task_items_done    CHECK (is_done IN (0,1) AND (is_done = 1) = (done_at IS NOT NULL)),
  CONSTRAINT ck_task_items_deleted CHECK ((deleted_at IS NULL) = (delete_batch_id IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Checklist inside a task.';

CREATE TABLE tags (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id        CHAR(26) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  client_uuid      CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  name             VARCHAR(30) NOT NULL,
  version          INT UNSIGNED NOT NULL DEFAULT 1,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by       BIGINT UNSIGNED NULL,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by       BIGINT UNSIGNED NULL,
  deleted_at       DATETIME NULL,
  deleted_by       BIGINT UNSIGNED NULL,
  delete_batch_id  BIGINT UNSIGNED NULL,
  live_name        VARCHAR(30) GENERATED ALWAYS AS (IF(deleted_at IS NULL, name, NULL)) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tags_public_id (public_id),
  UNIQUE KEY uq_tags_client_uuid (client_uuid),
  UNIQUE KEY uq_tags_live_name (live_name),
  CONSTRAINT fk_tags_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_tags_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_tags_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_tags_batch      FOREIGN KEY (delete_batch_id) REFERENCES change_batches (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_tags_version CHECK (version >= 1),
  CONSTRAINT ck_tags_name    CHECK (CHAR_LENGTH(TRIM(name)) >= 1),
  CONSTRAINT ck_tags_deleted CHECK ((deleted_at IS NULL) = (delete_batch_id IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE task_tags (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  task_id          BIGINT UNSIGNED NOT NULL,
  tag_id           BIGINT UNSIGNED NOT NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by       BIGINT UNSIGNED NULL,
  deleted_at       DATETIME NULL,
  deleted_by       BIGINT UNSIGNED NULL,
  delete_batch_id  BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_task_tags_pair (task_id, tag_id) COMMENT 'Re-tagging revives the old row',
  KEY ix_task_tags_tag (tag_id, deleted_at, task_id),
  CONSTRAINT fk_task_tags_task       FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_task_tags_tag        FOREIGN KEY (tag_id)  REFERENCES tags (id)  ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_task_tags_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_task_tags_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_task_tags_batch      FOREIGN KEY (delete_batch_id) REFERENCES change_batches (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 8. Documents (metadata + links; bytes live in files)
-- -----------------------------------------------------------------------------
CREATE TABLE documents (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id        CHAR(26) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  client_uuid      CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  title            VARCHAR(120) NOT NULL,
  type             ENUM('contract','quotation','receipt','booking','id','photo','other') NOT NULL DEFAULT 'other',
  file_id          BIGINT UNSIGNED NOT NULL,
  payment_id       BIGINT UNSIGNED NULL,
  vendor_id        BIGINT UNSIGNED NULL,
  event_id         BIGINT UNSIGNED NULL,
  is_private       TINYINT UNSIGNED NOT NULL DEFAULT 0,
  notes            TEXT NULL,
  version          INT UNSIGNED NOT NULL DEFAULT 1,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by       BIGINT UNSIGNED NULL COMMENT 'Uploader (Family may edit/delete only their own)',
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by       BIGINT UNSIGNED NULL,
  deleted_at       DATETIME NULL,
  deleted_by       BIGINT UNSIGNED NULL,
  delete_batch_id  BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_documents_public_id (public_id),
  UNIQUE KEY uq_documents_client_uuid (client_uuid),
  KEY ix_documents_live_type (deleted_at, type, created_at),
  KEY ix_documents_live_created (deleted_at, created_at),
  KEY ix_documents_payment (payment_id, deleted_at),
  KEY ix_documents_vendor (vendor_id, deleted_at),
  KEY ix_documents_event (event_id, deleted_at),
  KEY ix_documents_file (file_id),
  CONSTRAINT fk_documents_file       FOREIGN KEY (file_id)    REFERENCES files (id)    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_documents_payment    FOREIGN KEY (payment_id) REFERENCES payments (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_documents_vendor     FOREIGN KEY (vendor_id)  REFERENCES vendors (id)  ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_documents_event      FOREIGN KEY (event_id)   REFERENCES events (id)   ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_documents_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_documents_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_documents_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_documents_batch      FOREIGN KEY (delete_batch_id) REFERENCES change_batches (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_documents_version CHECK (version >= 1),
  CONSTRAINT ck_documents_private CHECK (is_private IN (0,1)),
  CONSTRAINT ck_documents_notes   CHECK (notes IS NULL OR CHAR_LENGTH(notes) <= 5000),
  CONSTRAINT ck_documents_deleted CHECK ((deleted_at IS NULL) = (delete_batch_id IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 9. Imports (A8)
-- -----------------------------------------------------------------------------
CREATE TABLE imports (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id        CHAR(26) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  client_uuid      CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  batch_id         BIGINT UNSIGNED NOT NULL COMMENT 'All rows created/updated by this import',
  source           ENUM('xlsx','csv','paste','vcf') NOT NULL,
  file_name        VARCHAR(255) NULL,
  rows_read        INT UNSIGNED NOT NULL DEFAULT 0,
  created_count    INT UNSIGNED NOT NULL DEFAULT 0,
  updated_count    INT UNSIGNED NOT NULL DEFAULT 0,
  skipped_count    INT UNSIGNED NOT NULL DEFAULT 0,
  error_count      INT UNSIGNED NOT NULL DEFAULT 0,
  invitations_count INT UNSIGNED NOT NULL DEFAULT 0,
  version          INT UNSIGNED NOT NULL DEFAULT 1,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by       BIGINT UNSIGNED NULL,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by       BIGINT UNSIGNED NULL,
  deleted_at       DATETIME NULL,
  deleted_by       BIGINT UNSIGNED NULL,
  delete_batch_id  BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_imports_public_id (public_id),
  UNIQUE KEY uq_imports_client_uuid (client_uuid),
  UNIQUE KEY uq_imports_batch (batch_id),
  KEY ix_imports_created (created_at),
  CONSTRAINT fk_imports_batch       FOREIGN KEY (batch_id)   REFERENCES change_batches (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_imports_created_by  FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_imports_updated_by  FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_imports_deleted_by  FOREIGN KEY (deleted_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_imports_del_batch   FOREIGN KEY (delete_batch_id) REFERENCES change_batches (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_imports_version CHECK (version >= 1),
  CONSTRAINT ck_imports_deleted CHECK ((deleted_at IS NULL) = (delete_batch_id IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Undo state lives on change_batches (undone_at).';

-- -----------------------------------------------------------------------------
-- 10. Audit log (append-only by convention: PHP has no UPDATE/DELETE path)
-- -----------------------------------------------------------------------------
CREATE TABLE audit_log (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id          BIGINT UNSIGNED NULL COMMENT 'NULL = system job (cron, migration)',
  action           ENUM('create','update','delete','restore','undo','import','export',
                        'login','login_failed','logout','password_reset','role_change',
                        'merge','whatsapp_opened','backup','restore_drill') NOT NULL,
  entity_type      VARCHAR(40) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL COMMENT 'Table name in singular, e.g. household',
  entity_id        BIGINT UNSIGNED NULL,
  entity_version   INT UNSIGNED NULL COMMENT 'Row version AFTER this change. Undo reverts only if the row is still at this version.',
  batch_id         BIGINT UNSIGNED NULL,
  before_json      JSON NULL COMMENT 'Full row before (NULL on create). Password hashes never included.',
  after_json       JSON NULL COMMENT 'Full row after (NULL on hard events like login)',
  ip               VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  device           VARCHAR(60) NULL COMMENT 'e.g. iPhone · installed',
  note             VARCHAR(200) NULL COMMENT 'e.g. Postponed from 12 Oct to 19 Oct',
  PRIMARY KEY (id),
  KEY ix_audit_entity (entity_type, entity_id, id),
  KEY ix_audit_created (created_at),
  KEY ix_audit_user (user_id, created_at),
  KEY ix_audit_batch (batch_id),
  KEY ix_audit_action (action, created_at),
  CONSTRAINT fk_audit_user  FOREIGN KEY (user_id)  REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_audit_batch FOREIGN KEY (batch_id) REFERENCES change_batches (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Written in the same transaction as the change. Never updated or deleted.';

-- -----------------------------------------------------------------------------
-- 11. Safety: backups, restore drills, exports
-- -----------------------------------------------------------------------------
CREATE TABLE backup_runs (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  kind             ENUM('nightly_db','manual_db','pre_migration') NOT NULL DEFAULT 'nightly_db',
  status           ENUM('running','ok','failed') NOT NULL DEFAULT 'running',
  started_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at      DATETIME NULL,
  file_name        VARCHAR(120) NULL COMMENT 'wedding_YYYYMMDD_HHMM.sql.gz.enc',
  size_bytes       BIGINT UNSIGNED NULL,
  sha256           CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  destination      VARCHAR(120) NULL COMMENT 'e.g. gmail:backup-account, gdrive:folder',
  row_counts_json  JSON NULL COMMENT '{"households": 512, ...} for restore checks',
  error            VARCHAR(1000) NULL,
  PRIMARY KEY (id),
  KEY ix_backup_runs_started (started_at),
  KEY ix_backup_runs_status (status, finished_at),
  CONSTRAINT ck_backup_runs_done CHECK (status = 'running' OR finished_at IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Written by the backup cron. Safety card: red if last ok > 26 h.';

CREATE TABLE restore_drills (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id        CHAR(26) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  client_uuid      CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  done_on          DATE NOT NULL COMMENT 'IST date',
  done_by          BIGINT UNSIGNED NOT NULL,
  result           ENUM('passed','failed') NOT NULL,
  backup_run_id    BIGINT UNSIGNED NULL,
  backup_file      VARCHAR(120) NULL,
  notes            TEXT NULL,
  version          INT UNSIGNED NOT NULL DEFAULT 1,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by       BIGINT UNSIGNED NULL,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by       BIGINT UNSIGNED NULL,
  deleted_at       DATETIME NULL,
  deleted_by       BIGINT UNSIGNED NULL,
  delete_batch_id  BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_restore_drills_public_id (public_id),
  UNIQUE KEY uq_restore_drills_client_uuid (client_uuid),
  KEY ix_restore_drills_live_done (deleted_at, done_on),
  CONSTRAINT fk_restore_drills_done_by    FOREIGN KEY (done_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_restore_drills_backup     FOREIGN KEY (backup_run_id) REFERENCES backup_runs (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_restore_drills_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_restore_drills_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_restore_drills_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_restore_drills_batch      FOREIGN KEY (delete_batch_id) REFERENCES change_batches (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_restore_drills_version CHECK (version >= 1),
  CONSTRAINT ck_restore_drills_deleted CHECK ((deleted_at IS NULL) = (delete_batch_id IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE exports (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id           CHAR(26) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  kind                ENUM('full','guest_csv') NOT NULL DEFAULT 'full',
  status              ENUM('queued','running','ready','failed','expired') NOT NULL DEFAULT 'queued',
  requested_by        BIGINT UNSIGNED NOT NULL,
  progress_pct        TINYINT UNSIGNED NOT NULL DEFAULT 0,
  parts               TINYINT UNSIGNED NOT NULL DEFAULT 1,
  file_name           VARCHAR(120) NULL COMMENT 'wedding-export_YYYY-MM-DD.zip',
  size_bytes          BIGINT UNSIGNED NULL,
  sha256              CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  download_token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  filter_json         JSON NULL COMMENT 'For guest_csv: the list filter used',
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at          DATETIME NULL,
  finished_at         DATETIME NULL,
  expires_at          DATETIME NULL COMMENT 'finished_at + 24 h; file deleted after',
  error               VARCHAR(1000) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_exports_public_id (public_id),
  UNIQUE KEY uq_exports_token (download_token_hash),
  KEY ix_exports_status_created (status, created_at),
  CONSTRAINT fk_exports_user FOREIGN KEY (requested_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_exports_pct  CHECK (progress_pct <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 12. Reminders (tables ready in R1; filled and used from R2a)
-- -----------------------------------------------------------------------------
CREATE TABLE push_subscriptions (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id          BIGINT UNSIGNED NOT NULL,
  endpoint         VARCHAR(1000) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  endpoint_hash    CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'SHA-256 of endpoint (long URLs cannot be indexed directly)',
  p256dh           VARCHAR(200) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  auth_secret      VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  platform         ENUM('ios','android','desktop','other') NOT NULL DEFAULT 'other',
  device_label     VARCHAR(60) NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_success_at  DATETIME NULL,
  last_failure_at  DATETIME NULL,
  failure_count    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  revoked_at       DATETIME NULL COMMENT 'Set on 404/410 from the push service or on logout',
  PRIMARY KEY (id),
  UNIQUE KEY uq_push_subscriptions_endpoint (endpoint_hash),
  KEY ix_push_subscriptions_user (user_id, revoked_at),
  CONSTRAINT fk_push_subscriptions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reminder_runs (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  started_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at      DATETIME NULL,
  status           ENUM('running','ok','failed') NOT NULL DEFAULT 'running',
  due_count        INT UNSIGNED NOT NULL DEFAULT 0,
  sent_count       INT UNSIGNED NOT NULL DEFAULT 0,
  failed_count     INT UNSIGNED NOT NULL DEFAULT 0,
  host             VARCHAR(60) NULL,
  error            VARCHAR(1000) NULL,
  PRIMARY KEY (id),
  KEY ix_reminder_runs_started (started_at),
  KEY ix_reminder_runs_status (status, started_at),
  CONSTRAINT ck_reminder_runs_done CHECK (status = 'running' OR finished_at IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='One row per cron run (every 15 min). Health: red if newest started_at > 30 min ago.';

CREATE TABLE reminders (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id        CHAR(26) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  client_uuid      CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  entity_type      ENUM('task','payment','event','test') NOT NULL,
  entity_id        BIGINT UNSIGNED NULL COMMENT 'NULL for test reminders',
  user_id          BIGINT UNSIGNED NOT NULL COMMENT 'Recipient',
  remind_at        DATETIME NOT NULL COMMENT 'UTC',
  channel          ENUM('push','email','push_then_email') NOT NULL DEFAULT 'push_then_email',
  status           ENUM('pending','sending','sent','failed','cancelled') NOT NULL DEFAULT 'pending',
  dedupe_key       VARCHAR(120) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL COMMENT 'e.g. payment:12:due-3d:user:5 — stops duplicate reminders',
  claimed_run_id   BIGINT UNSIGNED NULL COMMENT 'Cron run that is sending it',
  attempts         TINYINT UNSIGNED NOT NULL DEFAULT 0,
  sent_at          DATETIME NULL,
  sent_via         ENUM('push','email') NULL,
  last_error       VARCHAR(500) NULL,
  version          INT UNSIGNED NOT NULL DEFAULT 1,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by       BIGINT UNSIGNED NULL,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by       BIGINT UNSIGNED NULL,
  deleted_at       DATETIME NULL,
  deleted_by       BIGINT UNSIGNED NULL,
  delete_batch_id  BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_reminders_public_id (public_id),
  UNIQUE KEY uq_reminders_client_uuid (client_uuid),
  UNIQUE KEY uq_reminders_dedupe (dedupe_key),
  KEY ix_reminders_due (status, remind_at),
  KEY ix_reminders_entity (entity_type, entity_id),
  KEY ix_reminders_user (user_id, remind_at),
  CONSTRAINT fk_reminders_user       FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_reminders_run        FOREIGN KEY (claimed_run_id) REFERENCES reminder_runs (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_reminders_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_reminders_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_reminders_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_reminders_batch      FOREIGN KEY (delete_batch_id) REFERENCES change_batches (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_reminders_version CHECK (version >= 1),
  CONSTRAINT ck_reminders_entity  CHECK (entity_type = 'test' OR entity_id IS NOT NULL),
  CONSTRAINT ck_reminders_sent    CHECK (status <> 'sent' OR (sent_at IS NOT NULL AND sent_via IS NOT NULL)),
  CONSTRAINT ck_reminders_claim   CHECK (status <> 'sending' OR claimed_run_id IS NOT NULL),
  CONSTRAINT ck_reminders_deleted CHECK ((deleted_at IS NULL) = (delete_batch_id IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 13. Reference data (production; not demo). created_by NULL = system.
-- =============================================================================
INSERT INTO settings
  (id, bride_name, groom_name, bride_side_label, groom_side_label,
   wedding_start_date, wedding_end_date, city, total_budget_paise)
VALUES
  (1, 'Mahi Jagetiya', 'Ayush Porwal', 'Mahi''s side (Jagetiya)', 'Ayush''s side (Porwal)',
   '2027-02-14', '2027-02-16', 'Bhilwara', NULL);

-- The 7 functions, all "Date not set" (FEATURES B4 seed). Roka is not seeded (open question).
INSERT INTO events (public_id, name, type, side, guests_invited, sort_order) VALUES
  ('01M4DK5T3CM3FTBFESYSCKJ2KK', 'Engagement', 'engagement', 'both', 1, 10),
  ('01M4DK5T3D9GHKDKJRDJRR373Z', 'Haldi',      'haldi',      'both', 1, 20),
  ('01M4DK5T3E6QZBMNQ0V7KQWW23', 'Mehndi',     'mehndi',     'both', 1, 30),
  ('01M4DK5T3FSGNF39W9F0NSXEQR', 'Sangeet',    'sangeet',    'both', 1, 40),
  ('01M4DK5T3G1Z1NTP87G1YJEGRR', 'Mayra',      'mayra',      'both', 1, 50),
  ('01M4DK5T3H1KPRF5DMTQJ2GCYG', 'Wedding',    'wedding',    'both', 1, 60),
  ('01M4DK5T3JCJAF3HDCPWRTYSHQ', 'Reception',  'reception',  'both', 1, 70);

INSERT INTO budget_categories (public_id, name, planned_paise, sort_order, is_fallback) VALUES
  ('01M4DK5T3K234QEZ15HVWMK8F0', 'Venue',             0,  10, 0),
  ('01M4DK5T3MMS2GR4PB00VX1KWD', 'Catering / Halwai', 0,  20, 0),
  ('01M4DK5T3N4MV1HPCRZJ0K44XB', 'Tent & Decor',      0,  30, 0),
  ('01M4DK5T3PK11CJ5WHJWW1WDA4', 'Photo & Video',     0,  40, 0),
  ('01M4DK5T3QATV30ZX2E0B6P7GZ', 'Clothing',          0,  50, 0),
  ('01M4DK5T3RFY4QKRRWGAHTZB2Z', 'Jewelry',           0,  60, 0),
  ('01M4DK5T3SFSV858DRV7DF49A0', 'Invitations',       0,  70, 0),
  ('01M4DK5T3T3XE5AXCB0CN5V1JF', 'Makeup & Mehndi',   0,  80, 0),
  ('01M4DK5T3VJNW4K2WFMDGWVWJA', 'Music, Band & DJ',  0,  90, 0),
  ('01M4DK5T3WY95QK1T5R2EHG5RQ', 'Transport',         0, 100, 0),
  ('01M4DK5T3XQGQTTYJQH90VKFQJ', 'Stay',              0, 110, 0),
  ('01M4DK5T3Y6NWZ1KPER8BB6MGY', 'Puja & Pandit',     0, 120, 0),
  ('01M4DK5T3ZTM5Q5GSWMMC1GC1P', 'Gifts',             0, 130, 0),
  ('01M4DK5T4047VSDK59NPGBMAH7', 'Miscellaneous',     0, 140, 1);

INSERT INTO tags (public_id, name) VALUES
  ('01M4DK5T41SEEQHBHV1XDA0R7D', 'Shopping'),
  ('01M4DK5T42RQPAZA45E013CN23', 'Outfit'),
  ('01M4DK5T43FD2G1YS32SG01ZN3', 'Jewelry'),
  ('01M4DK5T440EGSGB1EWBZK4G6R', 'Gifts'),
  ('01M4DK5T454454B5E65JQ6PTSY', 'Decor'),
  ('01M4DK5T46HFV6S1F9JZQTYZW9', 'Food'),
  ('01M4DK5T47YXFNF3N1DFQ4DTYK', 'Travel'),
  ('01M4DK5T48P52H0H22FSRC18ZE', 'Bride'),
  ('01M4DK5T4978KFBPN4ZQKN83N6', 'Groom');

-- Mark the migration complete. If this row still has finished_at NULL, the file stopped part-way.
UPDATE schema_migrations SET finished_at = CURRENT_TIMESTAMP WHERE version = 1;
