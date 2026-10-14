-- =============================================================================
-- A&M Wedding Planner — migration 008_contacts_timeline.sql
-- Workspace step D: contacts, guest details, event timeline (version 1.0.20). Run AFTER 007.
-- Target: MySQL 8.0.16+ (also runs on MariaDB 10.4+).
--
--   1. workspace_contacts: vendors linked to a workspace (one vendor in many workspaces),
--      with an optional role ("Stage & lights").
--   2. workspaces: + guest_notes (Guest details: seating, VIPs, pickups).
--   3. timeline_steps: the event timeline — purpose, time (optional), duration in minutes,
--      a note; the 7 default workspaces get suggested steps (edit or delete them).
--   4. attachment_links: + timeline_step_id.
--   tasks.target_type also takes 'timeline_step' (no column change).
--
-- Card tracking (planned) moves to 009.
-- =============================================================================

-- Fails here, changing nothing, if 008 already ran.
INSERT INTO schema_migrations (version, name, applied_by)
VALUES (8, '008_contacts_timeline', 'phpMyAdmin');

CREATE TABLE workspace_contacts (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id        CHAR(26) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  client_uuid      CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  workspace_id     BIGINT UNSIGNED NOT NULL,
  vendor_id        BIGINT UNSIGNED NOT NULL,
  role             VARCHAR(120) NULL,
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
  UNIQUE KEY uq_workspace_contacts_public_id (public_id),
  UNIQUE KEY uq_workspace_contacts_client_uuid (client_uuid),
  KEY ix_workspace_contacts_ws (workspace_id, deleted_at, sort_order),
  KEY ix_workspace_contacts_vendor (vendor_id, deleted_at),
  CONSTRAINT fk_workspace_contacts_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_workspace_contacts_vendor    FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_workspace_contacts_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_workspace_contacts_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_workspace_contacts_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_workspace_contacts_batch      FOREIGN KEY (delete_batch_id) REFERENCES change_batches (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_workspace_contacts_version CHECK (version >= 1),
  CONSTRAINT ck_workspace_contacts_deleted CHECK ((deleted_at IS NULL) = (delete_batch_id IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE workspaces
  ADD COLUMN guest_notes TEXT NULL AFTER caterer_id;

CREATE TABLE timeline_steps (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id        CHAR(26) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  client_uuid      CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  workspace_id     BIGINT UNSIGNED NOT NULL,
  purpose          VARCHAR(120) NOT NULL,
  start_time       TIME NULL COMMENT 'IST clock time; NULL = follows the step before',
  duration_min     SMALLINT UNSIGNED NOT NULL,
  note             TEXT NULL,
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
  UNIQUE KEY uq_timeline_steps_public_id (public_id),
  UNIQUE KEY uq_timeline_steps_client_uuid (client_uuid),
  KEY ix_timeline_steps_ws (workspace_id, deleted_at, sort_order),
  CONSTRAINT fk_timeline_steps_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_timeline_steps_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_timeline_steps_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_timeline_steps_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_timeline_steps_batch      FOREIGN KEY (delete_batch_id) REFERENCES change_batches (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_timeline_steps_version CHECK (version >= 1),
  CONSTRAINT ck_timeline_steps_deleted CHECK ((deleted_at IS NULL) = (delete_batch_id IS NULL)),
  CONSTRAINT ck_timeline_steps_duration CHECK (duration_min BETWEEN 1 AND 1440)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE attachment_links
  ADD COLUMN timeline_step_id BIGINT UNSIGNED NULL AFTER menu_item_id,
  ADD KEY ix_attachment_links_timeline_step (timeline_step_id, deleted_at),
  ADD CONSTRAINT fk_attachment_links_timeline_step FOREIGN KEY (timeline_step_id) REFERENCES timeline_steps (id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE tasks
  MODIFY COLUMN target_type VARCHAR(20) CHARACTER SET ascii COLLATE ascii_general_ci NULL COMMENT 'outfit, accessory, outfit_step, menu_item or timeline_step';

-- Suggested steps for the 7 default workspaces (only where the workspace is still there).
INSERT INTO timeline_steps (public_id, workspace_id, purpose, duration_min, sort_order)
SELECT s.public_id, w.id, s.purpose, s.duration_min, s.sort_order
FROM (
  SELECT '01JE0TS0000000000000000001' AS public_id, '01JC0WS0000000000000000001' AS ws, 'Guests arrive' AS purpose, 30 AS duration_min, 10 AS sort_order
  UNION ALL SELECT '01JE0TS0000000000000000002', '01JC0WS0000000000000000001', 'Ganesh puja', 20, 20
  UNION ALL SELECT '01JE0TS0000000000000000003', '01JC0WS0000000000000000001', 'Ring ceremony', 20, 30
  UNION ALL SELECT '01JE0TS0000000000000000004', '01JC0WS0000000000000000001', 'Blessings and photos', 40, 40
  UNION ALL SELECT '01JE0TS0000000000000000005', '01JC0WS0000000000000000001', 'Lunch', 60, 50
  UNION ALL SELECT '01JE0TS0000000000000000006', '01JC0WS0000000000000000002', 'Guests arrive', 30, 10
  UNION ALL SELECT '01JE0TS0000000000000000007', '01JC0WS0000000000000000002', 'Bride''s mehndi', 120, 20
  UNION ALL SELECT '01JE0TS0000000000000000008', '01JC0WS0000000000000000002', 'Music and dance', 60, 30
  UNION ALL SELECT '01JE0TS0000000000000000009', '01JC0WS0000000000000000002', 'Lunch', 60, 40
  UNION ALL SELECT '01JE0TS0000000000000000010', '01JC0WS0000000000000000003', 'Guests arrive', 30, 10
  UNION ALL SELECT '01JE0TS0000000000000000011', '01JC0WS0000000000000000003', 'Games and stalls', 120, 20
  UNION ALL SELECT '01JE0TS0000000000000000012', '01JC0WS0000000000000000003', 'Dinner', 60, 30
  UNION ALL SELECT '01JE0TS0000000000000000013', '01JC0WS0000000000000000004', 'Guests arrive', 30, 10
  UNION ALL SELECT '01JE0TS0000000000000000014', '01JC0WS0000000000000000004', 'Family performances', 60, 20
  UNION ALL SELECT '01JE0TS0000000000000000015', '01JC0WS0000000000000000004', 'DJ and dance', 120, 30
  UNION ALL SELECT '01JE0TS0000000000000000016', '01JC0WS0000000000000000004', 'Dinner', 60, 40
  UNION ALL SELECT '01JE0TS0000000000000000017', '01JC0WS0000000000000000005', 'Mayra party arrives', 20, 10
  UNION ALL SELECT '01JE0TS0000000000000000018', '01JC0WS0000000000000000005', 'Mayra rasam', 45, 20
  UNION ALL SELECT '01JE0TS0000000000000000019', '01JC0WS0000000000000000005', 'Blessings and gifts', 30, 30
  UNION ALL SELECT '01JE0TS0000000000000000020', '01JC0WS0000000000000000005', 'Lunch', 60, 40
  UNION ALL SELECT '01JE0TS0000000000000000021', '01JC0WS0000000000000000006', 'Couple entry', 15, 10
  UNION ALL SELECT '01JE0TS0000000000000000022', '01JC0WS0000000000000000006', 'Stage greetings and photos', 120, 20
  UNION ALL SELECT '01JE0TS0000000000000000023', '01JC0WS0000000000000000006', 'Dinner', 90, 30
  UNION ALL SELECT '01JE0TS0000000000000000024', '01JC0WS0000000000000000006', 'Send-off', 15, 40
  UNION ALL SELECT '01JE0TS0000000000000000025', '01JC0WS0000000000000000007', 'Baraat arrival', 60, 10
  UNION ALL SELECT '01JE0TS0000000000000000026', '01JC0WS0000000000000000007', 'Varmala', 30, 20
  UNION ALL SELECT '01JE0TS0000000000000000027', '01JC0WS0000000000000000007', 'Dinner', 60, 30
  UNION ALL SELECT '01JE0TS0000000000000000028', '01JC0WS0000000000000000007', 'Phere', 120, 40
  UNION ALL SELECT '01JE0TS0000000000000000029', '01JC0WS0000000000000000007', 'Vidaai', 30, 50
) s
JOIN workspaces w ON w.public_id = s.ws AND w.deleted_at IS NULL;

UPDATE schema_migrations SET finished_at = CURRENT_TIMESTAMP WHERE version = 8;
