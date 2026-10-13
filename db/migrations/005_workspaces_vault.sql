-- =============================================================================
-- A&M Wedding Planner — migration 005_workspaces_vault.sql
-- Workspace step A + Attachment Vault (version 1.0.17). Run AFTER 004.
-- Target: MySQL 8.0.16+ (also runs on MariaDB 10.4+).
--
--   1. workspaces: one per function (Engagement, Mehndi, …), optionally linked
--      to one calendar event. The 7 owner's defaults are added at the end.
--   2. vault_files + vault_file_chunks: file bytes IN the database, in 2 MB
--      pieces, so any size uploads through hosts with small request limits
--      (Vercel ~4.5 MB) and the bytes survive hosts without a lasting disk.
--      A file row is complete only after every piece arrived and the SHA-256
--      of the whole matched. Never changed afterwards.
--   3. attachments: every attachment in the app (photo, video, document, link,
--      text) with an editable ID ("code") that is UNIQUE across the app,
--      capitals ignored (the column's collation). Deleted ones keep their ID.
--   4. attachment_links: where an attachment is used (one attachment, many places).
--   5. tasks.workspace_id / workspace_section: a task can belong to a workspace.
--   6. Existing documents become Vault attachments (kind 'document', ATT-000001…).
--
-- Card tracking (planned) moves to 006.
-- =============================================================================

-- Fails here, changing nothing, if 005 already ran.
INSERT INTO schema_migrations (version, name, applied_by)
VALUES (5, '005_workspaces_vault', 'phpMyAdmin');

CREATE TABLE workspaces (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id        CHAR(26) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  client_uuid      CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  name             VARCHAR(80) NOT NULL,
  event_id         BIGINT UNSIGNED NULL COMMENT 'The calendar event this workspace is for (optional)',
  sort_order       SMALLINT UNSIGNED NOT NULL DEFAULT 0,
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
  UNIQUE KEY uq_workspaces_public_id (public_id),
  UNIQUE KEY uq_workspaces_client_uuid (client_uuid),
  KEY ix_workspaces_live_order (deleted_at, sort_order),
  KEY ix_workspaces_event (event_id, deleted_at),
  CONSTRAINT fk_workspaces_event      FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_workspaces_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_workspaces_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_workspaces_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_workspaces_batch      FOREIGN KEY (delete_batch_id) REFERENCES change_batches (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_workspaces_version CHECK (version >= 1),
  CONSTRAINT ck_workspaces_deleted CHECK ((deleted_at IS NULL) = (delete_batch_id IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vault_files (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id     CHAR(26) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL COMMENT 'The upload id the phone uses',
  sha256        CHAR(64) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  mime_type     VARCHAR(100) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  size_bytes    BIGINT UNSIGNED NOT NULL,
  chunk_count   INT UNSIGNED NOT NULL,
  width_px      SMALLINT UNSIGNED NULL,
  height_px     SMALLINT UNSIGNED NULL,
  is_complete   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    BIGINT UNSIGNED NULL,
  completed_at  DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vault_files_public_id (public_id),
  KEY ix_vault_files_sha (sha256, is_complete),
  KEY ix_vault_files_incomplete (is_complete, created_at),
  CONSTRAINT fk_vault_files_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_vault_files_size CHECK (size_bytes >= 1),
  CONSTRAINT ck_vault_files_complete CHECK ((is_complete = 1) = (completed_at IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Vault file bytes live in vault_file_chunks. Unfinished uploads are removed after 1 day.';

CREATE TABLE vault_file_chunks (
  file_id   BIGINT UNSIGNED NOT NULL,
  seq       INT UNSIGNED NOT NULL COMMENT '0-based; every piece is 2 MB except the last',
  data      MEDIUMBLOB NOT NULL,
  PRIMARY KEY (file_id, seq),
  CONSTRAINT fk_vault_file_chunks_file FOREIGN KEY (file_id) REFERENCES vault_files (id) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE attachments (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id        CHAR(26) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  client_uuid      CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  code             VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Editable ID, unique app-wide, capitals ignored',
  kind             ENUM('photo','video','document','link','text') NOT NULL,
  title            VARCHAR(160) NOT NULL,
  note             TEXT NULL,
  url              VARCHAR(2000) NULL COMMENT 'kind = link (or a video link)',
  body             TEXT NULL COMMENT 'kind = text',
  file_id          BIGINT UNSIGNED NULL COMMENT 'Uploaded bytes (vault_files)',
  document_id      BIGINT UNSIGNED NULL COMMENT 'A Documents record shown in the Vault (bytes stay with the document)',
  is_favourite     TINYINT UNSIGNED NOT NULL DEFAULT 0,
  vendor_id        BIGINT UNSIGNED NULL,
  task_id          BIGINT UNSIGNED NULL,
  version          INT UNSIGNED NOT NULL DEFAULT 1,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by       BIGINT UNSIGNED NULL,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by       BIGINT UNSIGNED NULL,
  deleted_at       DATETIME NULL,
  deleted_by       BIGINT UNSIGNED NULL,
  delete_batch_id  BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_attachments_public_id (public_id),
  UNIQUE KEY uq_attachments_client_uuid (client_uuid),
  UNIQUE KEY uq_attachments_code (code),
  UNIQUE KEY uq_attachments_document (document_id),
  KEY ix_attachments_live_created (deleted_at, created_at),
  KEY ix_attachments_kind (deleted_at, kind),
  KEY ix_attachments_vendor (vendor_id, deleted_at),
  KEY ix_attachments_task (task_id, deleted_at),
  CONSTRAINT fk_attachments_file       FOREIGN KEY (file_id) REFERENCES vault_files (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_attachments_document   FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_attachments_vendor     FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_attachments_task       FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_attachments_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_attachments_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_attachments_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_attachments_batch      FOREIGN KEY (delete_batch_id) REFERENCES change_batches (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_attachments_version CHECK (version >= 1),
  CONSTRAINT ck_attachments_deleted CHECK ((deleted_at IS NULL) = (delete_batch_id IS NULL)),
  CONSTRAINT ck_attachments_code CHECK (CHAR_LENGTH(code) BETWEEN 3 AND 30),
  CONSTRAINT ck_attachments_link CHECK (kind <> 'link' OR url IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE attachment_links (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id        CHAR(26) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  client_uuid      CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  attachment_id    BIGINT UNSIGNED NOT NULL,
  workspace_id     BIGINT UNSIGNED NOT NULL,
  section          VARCHAR(40) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL DEFAULT 'general' COMMENT 'general, bride_outfit, … (later steps add more)',
  target_type      VARCHAR(40) CHARACTER SET ascii COLLATE ascii_general_ci NULL COMMENT 'A thing inside the section (later steps: accessory, menu item, …)',
  target_id        BIGINT UNSIGNED NULL,
  version          INT UNSIGNED NOT NULL DEFAULT 1,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by       BIGINT UNSIGNED NULL,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by       BIGINT UNSIGNED NULL,
  deleted_at       DATETIME NULL,
  deleted_by       BIGINT UNSIGNED NULL,
  delete_batch_id  BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_attachment_links_public_id (public_id),
  UNIQUE KEY uq_attachment_links_client_uuid (client_uuid),
  KEY ix_attachment_links_attachment (attachment_id, deleted_at),
  KEY ix_attachment_links_place (workspace_id, section, deleted_at),
  CONSTRAINT fk_attachment_links_attachment FOREIGN KEY (attachment_id) REFERENCES attachments (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_attachment_links_workspace  FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_attachment_links_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_attachment_links_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_attachment_links_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_attachment_links_batch      FOREIGN KEY (delete_batch_id) REFERENCES change_batches (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_attachment_links_version CHECK (version >= 1),
  CONSTRAINT ck_attachment_links_deleted CHECK ((deleted_at IS NULL) = (delete_batch_id IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE tasks
  ADD COLUMN workspace_id      BIGINT UNSIGNED NULL AFTER household_id,
  ADD COLUMN workspace_section VARCHAR(40) CHARACTER SET ascii COLLATE ascii_general_ci NULL AFTER workspace_id,
  ADD KEY ix_tasks_workspace (workspace_id, deleted_at, status),
  ADD CONSTRAINT fk_tasks_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- The owner's 7 workspaces, linked to the matching calendar event where there is one.
INSERT INTO workspaces (public_id, name, sort_order, event_id) VALUES
  ('01JC0WS0000000000000000001', 'Engagement', 10, (SELECT MIN(id) FROM events WHERE type = 'engagement' AND deleted_at IS NULL)),
  ('01JC0WS0000000000000000002', 'Mehndi', 20, (SELECT MIN(id) FROM events WHERE type = 'mehndi' AND deleted_at IS NULL)),
  ('01JC0WS0000000000000000003', 'Carnival', 30, NULL),
  ('01JC0WS0000000000000000004', 'DJ Night', 40, NULL),
  ('01JC0WS0000000000000000005', 'Mayra', 50, (SELECT MIN(id) FROM events WHERE type = 'mayra' AND deleted_at IS NULL)),
  ('01JC0WS0000000000000000006', 'Reception', 60, (SELECT MIN(id) FROM events WHERE type = 'reception' AND deleted_at IS NULL)),
  ('01JC0WS0000000000000000007', 'Varmala & Phere', 70, (SELECT MIN(id) FROM events WHERE type = 'wedding' AND deleted_at IS NULL));

-- Every existing document shows in the Vault with an ID (deleted ones too, so Undo brings both back).
INSERT INTO attachments (public_id, code, kind, title, document_id, vendor_id, created_at, created_by, updated_at, updated_by)
SELECT CONCAT('01JC0VA', LPAD(d.id, 19, '0')), CONCAT('ATT-', LPAD(d.id, 6, '0')), 'document', LEFT(d.title, 160), d.id, d.vendor_id,
       d.created_at, d.created_by, d.created_at, d.created_by
FROM documents d ORDER BY d.id;

UPDATE schema_migrations SET finished_at = CURRENT_TIMESTAMP WHERE version = 5;
