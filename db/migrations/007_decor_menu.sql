-- =============================================================================
-- A&M Wedding Planner — migration 007_decor_menu.sql
-- Workspace step C: family outfits, theme & decoration, menu (version 1.0.19). Run AFTER 006.
-- Target: MySQL 8.0.16+ (also runs on MariaDB 10.4+).
--
--   1. outfits: person + 'decor' (a decor item — Stage, Entry gate, Mandap — has the
--      same page as an outfit: timeline, moodboard, accessories/props, notes, tasks),
--      and + vendor_id (the decorator / tailor). Family outfits need no change.
--   2. workspaces: + theme_name, theme_colours (Theme & decoration) and caterer_id (Menu).
--   3. menu_categories / menu_items: the menu of a workspace; each item Normal or Jain,
--      ⭐ must-have, a short note.
--   4. attachment_links: + menu_item_id (a dish photo or menu PDF from the Vault).
--   tasks.target_type also takes 'menu_item' (no column change).
--
-- Card tracking (planned) moves to 008.
-- =============================================================================

-- Fails here, changing nothing, if 007 already ran.
INSERT INTO schema_migrations (version, name, applied_by)
VALUES (7, '007_decor_menu', 'phpMyAdmin');

ALTER TABLE outfits
  MODIFY COLUMN person ENUM('bride','groom','close_male','close_female','extended_male','extended_female','decor') NOT NULL,
  ADD COLUMN vendor_id BIGINT UNSIGNED NULL AFTER title,
  ADD CONSTRAINT fk_outfits_vendor FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE workspaces
  ADD COLUMN theme_name    VARCHAR(80) NULL AFTER notes,
  ADD COLUMN theme_colours VARCHAR(120) NULL AFTER theme_name,
  ADD COLUMN caterer_id    BIGINT UNSIGNED NULL AFTER theme_colours,
  ADD CONSTRAINT fk_workspaces_caterer FOREIGN KEY (caterer_id) REFERENCES vendors (id) ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE menu_categories (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id        CHAR(26) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  client_uuid      CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  workspace_id     BIGINT UNSIGNED NOT NULL,
  name             VARCHAR(80) NOT NULL,
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
  UNIQUE KEY uq_menu_categories_public_id (public_id),
  UNIQUE KEY uq_menu_categories_client_uuid (client_uuid),
  KEY ix_menu_categories_ws (workspace_id, deleted_at, sort_order),
  CONSTRAINT fk_menu_categories_workspace  FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_menu_categories_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_menu_categories_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_menu_categories_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_menu_categories_batch      FOREIGN KEY (delete_batch_id) REFERENCES change_batches (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_menu_categories_version CHECK (version >= 1),
  CONSTRAINT ck_menu_categories_deleted CHECK ((deleted_at IS NULL) = (delete_batch_id IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE menu_items (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id        CHAR(26) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  client_uuid      CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  workspace_id     BIGINT UNSIGNED NOT NULL,
  category_id      BIGINT UNSIGNED NOT NULL,
  name             VARCHAR(120) NOT NULL,
  diet             ENUM('normal','jain') NOT NULL DEFAULT 'normal',
  is_must_have     TINYINT(1) NOT NULL DEFAULT 0,
  note             VARCHAR(500) NULL,
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
  UNIQUE KEY uq_menu_items_public_id (public_id),
  UNIQUE KEY uq_menu_items_client_uuid (client_uuid),
  KEY ix_menu_items_category (category_id, deleted_at, sort_order),
  KEY ix_menu_items_ws (workspace_id, deleted_at),
  CONSTRAINT fk_menu_items_workspace  FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_menu_items_category   FOREIGN KEY (category_id) REFERENCES menu_categories (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_menu_items_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_menu_items_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_menu_items_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_menu_items_batch      FOREIGN KEY (delete_batch_id) REFERENCES change_batches (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_menu_items_version CHECK (version >= 1),
  CONSTRAINT ck_menu_items_deleted CHECK ((deleted_at IS NULL) = (delete_batch_id IS NULL)),
  CONSTRAINT ck_menu_items_must CHECK (is_must_have IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE attachment_links
  ADD COLUMN menu_item_id BIGINT UNSIGNED NULL AFTER outfit_step_id,
  ADD KEY ix_attachment_links_menu_item (menu_item_id, deleted_at),
  ADD CONSTRAINT fk_attachment_links_menu_item FOREIGN KEY (menu_item_id) REFERENCES menu_items (id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE tasks
  MODIFY COLUMN target_type VARCHAR(20) CHARACTER SET ascii COLLATE ascii_general_ci NULL COMMENT 'outfit, accessory, outfit_step or menu_item';

UPDATE schema_migrations SET finished_at = CURRENT_TIMESTAMP WHERE version = 7;
