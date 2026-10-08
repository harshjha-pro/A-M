-- =============================================================================
-- db/test/fixtures.sql — small base data for AUTOMATED TESTS ONLY (TESTING §1.2)
-- Not seed_demo.sql (that one is for people on staging). Never run on live.
-- Loaded after 001 → 002 → 003. Password for every user: test-1234
-- Events (7), budget categories (14) and tags (9) come from 001_init.
-- =============================================================================
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '+00:00';

INSERT INTO users (id, public_id, client_uuid, name, phone, password_hash, role, can_see_money, is_active, created_by, updated_by) VALUES
  (1, '01JA6ZA0000000000000000001', NULL, 'Ayush',  '+919829000101', '$2y$10$y54HFnTQ0WFl7uIfqqpvC.1TTiPxErNHu4JZ3eIun/48ZwuDQ/8G6', 'owner',   1, 1, NULL, NULL),
  (2, '01JA6ZA0000000000000000002', NULL, 'Mahi',   '+919829000102', '$2y$10$y54HFnTQ0WFl7uIfqqpvC.1TTiPxErNHu4JZ3eIun/48ZwuDQ/8G6', 'partner', 1, 1, 1, 1),
  (3, '01JA6ZA0000000000000000003', NULL, 'Papa',   '+919829000103', '$2y$10$y54HFnTQ0WFl7uIfqqpvC.1TTiPxErNHu4JZ3eIun/48ZwuDQ/8G6', 'family',  1, 1, 1, 1),
  (4, '01JA6ZA0000000000000000004', NULL, 'Mummy',  '+919829000104', '$2y$10$y54HFnTQ0WFl7uIfqqpvC.1TTiPxErNHu4JZ3eIun/48ZwuDQ/8G6', 'family',  0, 1, 1, 1),
  (5, '01JA6ZA0000000000000000005', NULL, 'Nani',   '+919829000105', '$2y$10$y54HFnTQ0WFl7uIfqqpvC.1TTiPxErNHu4JZ3eIun/48ZwuDQ/8G6', 'viewer',  0, 1, 1, 1);

INSERT INTO vendors (public_id, name, category, phone, created_by, updated_by) VALUES
  ('01JA6ZB0000000000000000001', 'Shree Tent House', 'tent_decor', '+919829000201', 1, 1),
  ('01JA6ZB0000000000000000002', 'Rajesh ji Halwai', 'caterer',    '+919829000202', 1, 1);
