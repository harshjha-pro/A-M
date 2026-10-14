-- =============================================================================
-- A&M Wedding Planner — migration 004_home_photos.sql
-- Home screen photos (version 1.0.16). Run AFTER 003.
-- Target: MySQL 8.0.16+ (also runs on MariaDB 10.4+).
--
--   1. photo_blobs: the image bytes, stored IN the database (owner's choice "b",
--      so they survive on Vercel and go into every backup and export).
--      Immutable: a row is never changed, only added. One row per distinct
--      image (sha256 unique). Kept out of home_photos so the audit log, which
--      copies a whole row, never holds image bytes.
--   2. home_photos: which image shows where on Home — slot 'cover' (carousel,
--      up to 8), 'couple' (up to 4) or 'monogram' (1). Normal versioned row
--      with soft delete and Undo, like every other record.
--
-- Card tracking (planned as 004 in DATABASE.md) moves to 005.
-- =============================================================================

-- Fails here, changing nothing, if 004 already ran.
INSERT INTO schema_migrations (version, name, applied_by)
VALUES (4, '004_home_photos', 'phpMyAdmin');

CREATE TABLE photo_blobs (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sha256      CHAR(64) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  mime_type   VARCHAR(40) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  size_bytes  INT UNSIGNED NOT NULL,
  width_px    SMALLINT UNSIGNED NOT NULL,
  height_px   SMALLINT UNSIGNED NOT NULL,
  data        MEDIUMBLOB NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by  BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_photo_blobs_sha256 (sha256),
  CONSTRAINT fk_photo_blobs_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_photo_blobs_size CHECK (size_bytes BETWEEN 1 AND 3145728),
  CONSTRAINT ck_photo_blobs_mime CHECK (mime_type IN ('image/jpeg','image/png','image/webp'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Home photo bytes. Immutable. Up to 3 MB each (the phone compresses first).';

CREATE TABLE home_photos (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id        CHAR(26) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  client_uuid      CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  slot             ENUM('cover','couple','monogram') NOT NULL,
  sort_order       SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  blob_id          BIGINT UNSIGNED NOT NULL,
  version          INT UNSIGNED NOT NULL DEFAULT 1,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by       BIGINT UNSIGNED NULL,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by       BIGINT UNSIGNED NULL,
  deleted_at       DATETIME NULL,
  deleted_by       BIGINT UNSIGNED NULL,
  delete_batch_id  BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_home_photos_public_id (public_id),
  UNIQUE KEY uq_home_photos_client_uuid (client_uuid),
  KEY ix_home_photos_live_slot (deleted_at, slot, sort_order),
  CONSTRAINT fk_home_photos_blob       FOREIGN KEY (blob_id) REFERENCES photo_blobs (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_home_photos_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_home_photos_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_home_photos_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_home_photos_batch      FOREIGN KEY (delete_batch_id) REFERENCES change_batches (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_home_photos_version CHECK (version >= 1),
  CONSTRAINT ck_home_photos_deleted CHECK ((deleted_at IS NULL) = (delete_batch_id IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

UPDATE schema_migrations SET finished_at = CURRENT_TIMESTAMP WHERE version = 4;
