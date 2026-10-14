-- =============================================================================
-- A&M Wedding Planner — migration 006_outfits.sql
-- Workspace step B: outfits (version 1.0.18). Run AFTER 005.
-- Target: MySQL 8.0.16+ (also runs on MariaDB 10.4+).
--
--   1. outfits: one row per outfit in a workspace, for the bride or groom
--      (close / extended family, male / female, already allowed for step C).
--   2. outfit_steps: the outfit's timeline (Selected → Stitched → Trial done →
--      Final approved by default; steps can be added, renamed, reordered),
--      each with the date it was done.
--   3. accessories: things that go with an outfit (Maang tikka, Kaleere, …);
--      also usable by a workspace section without an outfit (step C: decoration).
--   4. notes: short notes on an outfit, an accessory or a timeline step.
--   5. attachment_links: + outfit_id / accessory_id / outfit_step_id, so the
--      moodboard and step / accessory attachments come from the Vault.
--   6. tasks: + target_type / target_id (the outfit, accessory or step a task came from).
--
-- Card tracking (planned) moves to 007.
-- =============================================================================

-- Fails here, changing nothing, if 006 already ran.
INSERT INTO schema_migrations (version, name, applied_by)
VALUES (6, '006_outfits', 'phpMyAdmin');

CREATE TABLE outfits (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id        CHAR(26) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  client_uuid      CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  workspace_id     BIGINT UNSIGNED NOT NULL,
  person           ENUM('bride','groom','close_male','close_female','extended_male','extended_female') NOT NULL,
  title            VARCHAR(120) NOT NULL,
  sort_order       SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  version          INT UNSIGNED NOT NULL DEFAULT 1,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by       BIGINT UNSIGNED NULL,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by       BIGINT UNSIGNED NULL,
  deleted_at       DATETIME NULL,
  deleted_by       BIGINT UNSIGNED NULL,
  delete_batch_id  BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_outfits_public_id (public_id),
  UNIQUE KEY uq_outfits_client_uuid (client_uuid),
  KEY ix_outfits_place (workspace_id, person, deleted_at, sort_order),
  CONSTRAINT fk_outfits_workspace  FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_outfits_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_outfits_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_outfits_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_outfits_batch      FOREIGN KEY (delete_batch_id) REFERENCES change_batches (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_outfits_version CHECK (version >= 1),
  CONSTRAINT ck_outfits_deleted CHECK ((deleted_at IS NULL) = (delete_batch_id IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE outfit_steps (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id        CHAR(26) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  client_uuid      CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  outfit_id        BIGINT UNSIGNED NOT NULL,
  name             VARCHAR(60) NOT NULL,
  sort_order       SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  done_on          DATE NULL COMMENT 'IST date the step was done; NULL = not yet',
  version          INT UNSIGNED NOT NULL DEFAULT 1,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by       BIGINT UNSIGNED NULL,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by       BIGINT UNSIGNED NULL,
  deleted_at       DATETIME NULL,
  deleted_by       BIGINT UNSIGNED NULL,
  delete_batch_id  BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_outfit_steps_public_id (public_id),
  UNIQUE KEY uq_outfit_steps_client_uuid (client_uuid),
  KEY ix_outfit_steps_outfit (outfit_id, deleted_at, sort_order),
  CONSTRAINT fk_outfit_steps_outfit     FOREIGN KEY (outfit_id) REFERENCES outfits (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_outfit_steps_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_outfit_steps_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_outfit_steps_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_outfit_steps_batch      FOREIGN KEY (delete_batch_id) REFERENCES change_batches (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_outfit_steps_version CHECK (version >= 1),
  CONSTRAINT ck_outfit_steps_deleted CHECK ((deleted_at IS NULL) = (delete_batch_id IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE accessories (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id        CHAR(26) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  client_uuid      CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  workspace_id     BIGINT UNSIGNED NOT NULL,
  section          VARCHAR(40) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  outfit_id        BIGINT UNSIGNED NULL COMMENT 'NULL = belongs to the section (step C: decoration)',
  name             VARCHAR(120) NOT NULL,
  sort_order       SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  version          INT UNSIGNED NOT NULL DEFAULT 1,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by       BIGINT UNSIGNED NULL,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by       BIGINT UNSIGNED NULL,
  deleted_at       DATETIME NULL,
  deleted_by       BIGINT UNSIGNED NULL,
  delete_batch_id  BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_accessories_public_id (public_id),
  UNIQUE KEY uq_accessories_client_uuid (client_uuid),
  KEY ix_accessories_outfit (outfit_id, deleted_at, sort_order),
  KEY ix_accessories_place (workspace_id, section, deleted_at),
  CONSTRAINT fk_accessories_workspace  FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_accessories_outfit     FOREIGN KEY (outfit_id) REFERENCES outfits (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_accessories_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_accessories_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_accessories_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_accessories_batch      FOREIGN KEY (delete_batch_id) REFERENCES change_batches (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_accessories_version CHECK (version >= 1),
  CONSTRAINT ck_accessories_deleted CHECK ((deleted_at IS NULL) = (delete_batch_id IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notes (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id        CHAR(26) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  client_uuid      CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  workspace_id     BIGINT UNSIGNED NOT NULL,
  outfit_id        BIGINT UNSIGNED NULL,
  accessory_id     BIGINT UNSIGNED NULL,
  outfit_step_id   BIGINT UNSIGNED NULL,
  body             TEXT NOT NULL,
  version          INT UNSIGNED NOT NULL DEFAULT 1,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by       BIGINT UNSIGNED NULL,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by       BIGINT UNSIGNED NULL,
  deleted_at       DATETIME NULL,
  deleted_by       BIGINT UNSIGNED NULL,
  delete_batch_id  BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_notes_public_id (public_id),
  UNIQUE KEY uq_notes_client_uuid (client_uuid),
  KEY ix_notes_outfit (outfit_id, deleted_at),
  KEY ix_notes_accessory (accessory_id, deleted_at),
  KEY ix_notes_step (outfit_step_id, deleted_at),
  CONSTRAINT fk_notes_workspace  FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_notes_outfit     FOREIGN KEY (outfit_id) REFERENCES outfits (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_notes_accessory  FOREIGN KEY (accessory_id) REFERENCES accessories (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_notes_step       FOREIGN KEY (outfit_step_id) REFERENCES outfit_steps (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_notes_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_notes_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_notes_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_notes_batch      FOREIGN KEY (delete_batch_id) REFERENCES change_batches (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_notes_version CHECK (version >= 1),
  CONSTRAINT ck_notes_deleted CHECK ((deleted_at IS NULL) = (delete_batch_id IS NULL)),
  CONSTRAINT ck_notes_one_place CHECK ((outfit_id IS NOT NULL) + (accessory_id IS NOT NULL) + (outfit_step_id IS NOT NULL) = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE attachment_links
  ADD COLUMN outfit_id      BIGINT UNSIGNED NULL AFTER target_id,
  ADD COLUMN accessory_id   BIGINT UNSIGNED NULL AFTER outfit_id,
  ADD COLUMN outfit_step_id BIGINT UNSIGNED NULL AFTER accessory_id,
  ADD KEY ix_attachment_links_outfit (outfit_id, deleted_at),
  ADD KEY ix_attachment_links_accessory (accessory_id, deleted_at),
  ADD KEY ix_attachment_links_step (outfit_step_id, deleted_at),
  ADD CONSTRAINT fk_attachment_links_outfit    FOREIGN KEY (outfit_id) REFERENCES outfits (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT fk_attachment_links_accessory FOREIGN KEY (accessory_id) REFERENCES accessories (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT fk_attachment_links_step      FOREIGN KEY (outfit_step_id) REFERENCES outfit_steps (id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE tasks
  ADD COLUMN target_type VARCHAR(20) CHARACTER SET ascii COLLATE ascii_general_ci NULL COMMENT 'outfit, accessory or outfit_step' AFTER workspace_section,
  ADD COLUMN target_id   BIGINT UNSIGNED NULL AFTER target_type,
  ADD KEY ix_tasks_target (target_type, target_id, deleted_at);

-- Demo data fix (1.0.17 seed): an id with a letter outside the ID alphabet could not be unlinked.
-- Changes nothing on a database without the demo data.
UPDATE attachment_links SET public_id = '01JC0VN0000000000000000001' WHERE public_id = '01JC0VL0000000000000000001';

UPDATE schema_migrations SET finished_at = CURRENT_TIMESTAMP WHERE version = 6;
