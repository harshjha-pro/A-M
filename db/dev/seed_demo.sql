-- =============================================================================
--  ██████  DEV ONLY — DEMO DATA — NEVER RUN ON THE LIVE DATABASE  ██████
-- =============================================================================
-- seed_demo.sql — realistic demo data for the A&M Wedding Planner
-- Run AFTER 001_init.sql and 002_open_answers.sql, on an EMPTY dev/staging database.
--
-- Safety guard: the first INSERT creates user id 1 (the owner). On a database
-- that already has an owner, it fails with a duplicate-key error and phpMyAdmin
-- stops before anything else runs.
--
-- Every demo login uses the password:  demo-1234
-- "Today" in this data is Thu 8 Oct 2026 (IST), so the dashboard has
-- overdue tasks, tasks due today, and payments due within 7 days.
-- All phone numbers are fictional.
-- =============================================================================

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '+00:00';

-- 1. Members (first row is the guard)
INSERT INTO users (id, public_id, client_uuid, name, phone, password_hash, role, can_see_money, is_active, access_ends_on, created_at, created_by, updated_by) VALUES
  (1, '01M1DHZEF8SFAKD4HRFGMT9V63', '145f656c-76cc-4d7a-ad52-c2b21bbbb90b', 'Ayush Porwal', '+919829000001', '$2y$10$uEyezwNFR7SYq8XmmgaJM.3ZrhzP7sOlhZO8DIDtUPcJ3TJjbOp4.', 'owner', 1, 1, NULL, '2026-09-01 05:01:00', NULL, NULL),
  (2, '01M1DHZFEGZBEKCQCRBHM7TDXX', 'cae54cda-528e-470b-a7ba-792d0378f603', 'Mahi Jagetiya', '+919829000002', '$2y$10$uEyezwNFR7SYq8XmmgaJM.3ZrhzP7sOlhZO8DIDtUPcJ3TJjbOp4.', 'partner', 1, 1, NULL, '2026-09-01 05:02:00', 1, 1),
  (3, '01M1DHZGDRZB1K5TRD1EG1F37T', 'ce4e7421-e783-45db-a02f-66dc67f52dcf', 'Sunita Porwal (Mummy)', '+919829000003', '$2y$10$uEyezwNFR7SYq8XmmgaJM.3ZrhzP7sOlhZO8DIDtUPcJ3TJjbOp4.', 'family', 1, 1, NULL, '2026-09-02 05:03:00', 1, 1),
  (4, '01M1DHZHD0EJ18QS1M18EH8XRC', '59062751-2e18-49cb-a615-356b2ef999dd', 'Rajendra Porwal (Papa)', '+919829000004', '$2y$10$uEyezwNFR7SYq8XmmgaJM.3ZrhzP7sOlhZO8DIDtUPcJ3TJjbOp4.', 'family', 1, 1, NULL, '2026-09-02 05:04:00', 1, 1),
  (5, '01M1DHZJC8629A07CPJ8C23YSK', '49f2c596-46d4-4868-add7-f27f9867ffad', 'Kavita Jagetiya', '+919829000005', '$2y$10$uEyezwNFR7SYq8XmmgaJM.3ZrhzP7sOlhZO8DIDtUPcJ3TJjbOp4.', 'family', 0, 1, NULL, '2026-09-02 05:05:00', 1, 1),
  (6, '01M1DHZKBGY8T96E4EHDFEPWZN', 'a3bf41da-139d-4412-9c11-9817afd08d0d', 'कमला देवी पोरवाल (Dadi)', '+919829000006', '$2y$10$uEyezwNFR7SYq8XmmgaJM.3ZrhzP7sOlhZO8DIDtUPcJ3TJjbOp4.', 'viewer', 0, 1, NULL, '2026-09-02 05:06:00', 1, 1),
  (7, '01M1DHZMARHXTF2VPJYJDAHHXB', '111f9c4a-4d5a-4788-9775-0a60a9043157', 'Neha Sharma (Planner)', '+919829000007', '$2y$10$uEyezwNFR7SYq8XmmgaJM.3ZrhzP7sOlhZO8DIDtUPcJ3TJjbOp4.', 'family', 0, 1, '2027-02-20', '2026-09-02 05:07:00', 1, 1),
  (8, '01M1DHZNA0MSNS1XZSRY0S7WYR', 'd3bb4576-c055-43d2-b316-f6134134609f', 'Rohit Porwal', '+919829000008', '$2y$10$uEyezwNFR7SYq8XmmgaJM.3ZrhzP7sOlhZO8DIDtUPcJ3TJjbOp4.', 'family', 0, 0, NULL, '2026-09-02 05:08:00', 1, 1);

-- 2. Wedding facts
UPDATE settings SET total_budget_paise = 400000000, setup_completed_at = '2026-09-01 05:30:00',
  created_by = 1, updated_by = 1, version = version + 1 WHERE id = 1;

-- 3. Event dates and venues (times are IST converted to UTC)
UPDATE events SET start_at = '2026-11-22 12:30:00', end_at = '2026-11-22 17:30:00', venue_name = 'Shree Palace Garden', venue_address = 'Pur Road, Bhilwara', map_url = 'https://maps.google.com/?q=Shree+Palace+Garden+Bhilwara', dress_code = 'Pastel', updated_by = 1, version = version + 1 WHERE type = 'engagement' AND deleted_at IS NULL;
UPDATE events SET start_at = '2027-02-14 04:30:00', end_at = '2027-02-14 07:30:00', venue_name = 'Porwal Niwas', venue_address = 'Shastri Nagar, Bhilwara', map_url = 'https://maps.google.com/?q=Porwal+Niwas+Bhilwara', dress_code = 'Yellow', updated_by = 1, version = version + 1 WHERE type = 'haldi' AND deleted_at IS NULL;
UPDATE events SET start_at = '2027-02-14 10:30:00', end_at = '2027-02-14 15:30:00', venue_name = 'Porwal Niwas', venue_address = 'Shastri Nagar, Bhilwara', map_url = 'https://maps.google.com/?q=Porwal+Niwas+Bhilwara', dress_code = 'Green', updated_by = 1, version = version + 1 WHERE type = 'mehndi' AND deleted_at IS NULL;
UPDATE events SET start_at = '2027-02-15 05:30:00', end_at = '2027-02-15 08:30:00', venue_name = 'Jagetiya Bhawan', venue_address = 'Azad Nagar, Bhilwara', map_url = 'https://maps.google.com/?q=Jagetiya+Bhawan+Bhilwara', dress_code = 'Traditional', updated_by = 1, version = version + 1 WHERE type = 'mayra' AND deleted_at IS NULL;
UPDATE events SET start_at = '2027-02-14 14:00:00', end_at = '2027-02-14 18:00:00', venue_name = 'Sukhadia Bhawan', venue_address = 'Gandhi Nagar, Bhilwara', map_url = 'https://maps.google.com/?q=Sukhadia+Bhawan+Bhilwara', dress_code = 'Indo-western', updated_by = 1, version = version + 1 WHERE type = 'sangeet' AND deleted_at IS NULL;
UPDATE events SET start_at = '2027-02-15 13:30:00', end_at = '2027-02-15 20:30:00', venue_name = 'Shree Palace Garden', venue_address = 'Pur Road, Bhilwara', map_url = 'https://maps.google.com/?q=Shree+Palace+Garden+Bhilwara', dress_code = 'Traditional', updated_by = 1, version = version + 1 WHERE type = 'wedding' AND deleted_at IS NULL;
UPDATE events SET start_at = '2027-02-16 14:00:00', end_at = '2027-02-16 18:00:00', venue_name = 'Shree Palace Garden', venue_address = 'Pur Road, Bhilwara', map_url = 'https://maps.google.com/?q=Shree+Palace+Garden+Bhilwara', dress_code = 'Formal', updated_by = 1, version = version + 1 WHERE type = 'reception' AND deleted_at IS NULL;

SET @ev_engagement := (SELECT id FROM events WHERE type = 'engagement' AND deleted_at IS NULL ORDER BY id LIMIT 1);
SET @ev_haldi := (SELECT id FROM events WHERE type = 'haldi' AND deleted_at IS NULL ORDER BY id LIMIT 1);
SET @ev_mehndi := (SELECT id FROM events WHERE type = 'mehndi' AND deleted_at IS NULL ORDER BY id LIMIT 1);
SET @ev_mayra := (SELECT id FROM events WHERE type = 'mayra' AND deleted_at IS NULL ORDER BY id LIMIT 1);
SET @ev_sangeet := (SELECT id FROM events WHERE type = 'sangeet' AND deleted_at IS NULL ORDER BY id LIMIT 1);
SET @ev_wedding := (SELECT id FROM events WHERE type = 'wedding' AND deleted_at IS NULL ORDER BY id LIMIT 1);
SET @ev_reception := (SELECT id FROM events WHERE type = 'reception' AND deleted_at IS NULL ORDER BY id LIMIT 1);

INSERT INTO events (id, public_id, client_uuid, name, type, side, guests_invited, start_at, end_at, venue_name, notes, sort_order, created_at, created_by, updated_by) VALUES
  (101, '01M1DHZP98EYGWQCQP4RSYZ58Q', '414beea8-db80-4873-a762-84efefa8037b', 'Ganesh Puja', 'other', 'groom', 0, '2027-02-12 03:30:00', '2027-02-12 05:30:00', 'Porwal Niwas', 'Pandit ji brings samagri list a week before.', 5, '2026-09-10 10:00:00', 1, 1),
  (102, '01M1DHZQ8GTXAWSA70A2MPRBGF', '28110a60-3a7e-49f5-8185-fa676cdfce53', 'Bridal makeup trial', 'other', 'bride', 0, '2026-12-05 09:30:00', '2026-12-05 11:30:00', 'Glamour by Priya, Bhilwara', NULL, 6, '2026-09-12 10:00:00', 2, 2);

-- 4. Budget: planned amount per category (₹ × 100 = paise)
UPDATE budget_categories SET planned_paise = 60000000, updated_by = 1, version = version + 1 WHERE name = 'Venue' AND deleted_at IS NULL;
SET @cat1 := (SELECT id FROM budget_categories WHERE name = 'Venue' AND deleted_at IS NULL);
UPDATE budget_categories SET planned_paise = 120000000, updated_by = 1, version = version + 1 WHERE name = 'Catering / Halwai' AND deleted_at IS NULL;
SET @cat2 := (SELECT id FROM budget_categories WHERE name = 'Catering / Halwai' AND deleted_at IS NULL);
UPDATE budget_categories SET planned_paise = 50000000, updated_by = 1, version = version + 1 WHERE name = 'Tent & Decor' AND deleted_at IS NULL;
SET @cat3 := (SELECT id FROM budget_categories WHERE name = 'Tent & Decor' AND deleted_at IS NULL);
UPDATE budget_categories SET planned_paise = 35000000, updated_by = 1, version = version + 1 WHERE name = 'Photo & Video' AND deleted_at IS NULL;
SET @cat4 := (SELECT id FROM budget_categories WHERE name = 'Photo & Video' AND deleted_at IS NULL);
UPDATE budget_categories SET planned_paise = 10000000, updated_by = 1, version = version + 1 WHERE name = 'Clothing' AND deleted_at IS NULL;
SET @cat5 := (SELECT id FROM budget_categories WHERE name = 'Clothing' AND deleted_at IS NULL);
UPDATE budget_categories SET planned_paise = 30000000, updated_by = 1, version = version + 1 WHERE name = 'Jewelry' AND deleted_at IS NULL;
SET @cat6 := (SELECT id FROM budget_categories WHERE name = 'Jewelry' AND deleted_at IS NULL);
UPDATE budget_categories SET planned_paise = 8000000, updated_by = 1, version = version + 1 WHERE name = 'Invitations' AND deleted_at IS NULL;
SET @cat7 := (SELECT id FROM budget_categories WHERE name = 'Invitations' AND deleted_at IS NULL);
UPDATE budget_categories SET planned_paise = 12000000, updated_by = 1, version = version + 1 WHERE name = 'Makeup & Mehndi' AND deleted_at IS NULL;
SET @cat8 := (SELECT id FROM budget_categories WHERE name = 'Makeup & Mehndi' AND deleted_at IS NULL);
UPDATE budget_categories SET planned_paise = 15000000, updated_by = 1, version = version + 1 WHERE name = 'Music, Band & DJ' AND deleted_at IS NULL;
SET @cat9 := (SELECT id FROM budget_categories WHERE name = 'Music, Band & DJ' AND deleted_at IS NULL);
UPDATE budget_categories SET planned_paise = 8000000, updated_by = 1, version = version + 1 WHERE name = 'Transport' AND deleted_at IS NULL;
SET @cat10 := (SELECT id FROM budget_categories WHERE name = 'Transport' AND deleted_at IS NULL);
UPDATE budget_categories SET planned_paise = 10000000, updated_by = 1, version = version + 1 WHERE name = 'Stay' AND deleted_at IS NULL;
SET @cat11 := (SELECT id FROM budget_categories WHERE name = 'Stay' AND deleted_at IS NULL);
UPDATE budget_categories SET planned_paise = 4000000, updated_by = 1, version = version + 1 WHERE name = 'Puja & Pandit' AND deleted_at IS NULL;
SET @cat12 := (SELECT id FROM budget_categories WHERE name = 'Puja & Pandit' AND deleted_at IS NULL);
UPDATE budget_categories SET planned_paise = 6000000, updated_by = 1, version = version + 1 WHERE name = 'Gifts' AND deleted_at IS NULL;
SET @cat13 := (SELECT id FROM budget_categories WHERE name = 'Gifts' AND deleted_at IS NULL);
UPDATE budget_categories SET planned_paise = 7000000, updated_by = 1, version = version + 1 WHERE name = 'Miscellaneous' AND deleted_at IS NULL;
SET @cat14 := (SELECT id FROM budget_categories WHERE name = 'Miscellaneous' AND deleted_at IS NULL);

-- 5. Vendors
INSERT INTO vendors (id, public_id, client_uuid, name, category, contact_person, phone, agreed_amount_paise, is_booked, notes, created_at, created_by, updated_by) VALUES
  (1, '01M1DHZR7RPEE6H09NB9RTKZY3', 'd7ab0aae-566c-416d-a0d3-05eebbec0088', 'Shree Tent House', 'tent_decor', 'Rajesh ji', '+919414010001', 35000000, 1, 'Advance paid in cash, ask for receipt 🙏', '2026-09-11 10:00:00', 1, 1),
  (2, '01M1DHZS70YAQWEVN2NN2DC7M7', '65e46f2c-382f-478c-b132-dadf589baff1', 'Annapurna Caterers', 'caterer', 'Mohan Lal ji (Halwai)', '+919414010002', 110000000, 1, NULL, '2026-09-12 10:00:00', 2, 2),
  (3, '01M1DHZT68MXQ33SYZ51MDQMPM', 'ddfd47b6-29fc-49e3-a1a4-1118742ff72e', 'Click Studio Bhilwara', 'photo_video', 'Vikram Soni', '+919414010003', 30000000, 1, NULL, '2026-09-13 10:00:00', 1, 1),
  (4, '01M1DHZV5G01S4MQ1YX17R738P', 'ea0e6a6e-5fb5-488e-b7d8-baa2ca9674c4', 'Glamour by Priya', 'makeup', 'Priya Mehta', '+919414010004', 8500000, 1, NULL, '2026-09-14 10:00:00', 2, 2),
  (5, '01M1DHZW4R5W29BBKAJ1GFZ5DY', '9d1fecca-50af-4c9d-89c5-83dcbc989b0b', 'Rekha Mehndi Art', 'mehndi_artist', 'Rekha ji', '+919414010005', 2500000, 1, NULL, '2026-09-15 10:00:00', 1, 1),
  (6, '01M1DHZX40VY2YAT6MXDTP8GJQ', 'da98bd58-c504-44f6-9fd7-4d10d7b207fa', 'Royal Band & DJ', 'band_dj', 'Salim bhai', '+919414010006', 14000000, 0, NULL, '2026-09-16 10:00:00', 2, 2),
  (7, '01M1DHZY38NA1Y6FBECQM02MK3', 'c6a81ba1-dc41-4ace-b103-3bb0e1c7f14f', 'Pandit Shivnarayan Sharma', 'pandit', 'Pandit ji', '+919414010007', 3100000, 1, NULL, '2026-09-17 10:00:00', 1, 1),
  (8, '01M1DHZZ2G8EHN14P01ZZWPK75', '42176f8c-79d0-4cff-9342-af160fd4f79f', 'Shree Palace Garden', 'venue', 'Manager – Deepak ji', '+919414010008', 55000000, 1, NULL, '2026-09-18 10:00:00', 2, 2),
  (9, '01M1DJ001RX9PV777VC7Q7Z3Y5', 'fc331bd9-4603-43bf-9924-8ee98670091e', 'Om Printers', 'printer', 'Suresh Agarwal', '+919414010009', 7000000, 1, NULL, '2026-09-19 10:00:00', 1, 1),
  (10, '01M1DJ0110YWEPPS5TPVB49DG2', '62c3ab7e-6a18-412d-8315-6047ff59e1e9', 'Shree Ganesh Travels', 'transport', 'Kailash ji', '+919414010010', NULL, 0, NULL, '2026-09-10 10:00:00', 2, 2),
  (11, '01M1DJ0208539P5CBH1KKDE2SX', '2d644f8f-c264-4796-96f4-ff3391692110', 'Fresh Flowers Co.', 'florist', 'Anil', '+919414010011', NULL, 0, NULL, '2026-09-11 10:00:00', 1, 1);

-- 6. Change batches (one delete per module, plus one import)
INSERT INTO change_batches (id, public_id, action, entity_type, item_count, summary, user_id, created_at) VALUES
  (1, '01M1DJ02ZGQ7WKCJQC19YSEBY2', 'import', 'household', 40, 'Imported 40 families from AM_Guest_List_Template.xlsx', 1, '2026-09-20 06:00:00'),
  (2, '01M1DJ03YRPN6MMM08WQ9PAWVZ', 'delete', 'household', 3, 'Gupta family (duplicate) · 2 invitations', 3, '2026-10-02 12:10:00'),
  (3, '01M1DJ04Y0DZ26S6T5SX8VKV2M', 'delete', 'task', 3, 'Book tent wala (old) · 2 checklist items', 4, '2026-10-05 13:40:00'),
  (4, '01M1DJ05X81DKKYSWRDPFWKQDT', 'delete', 'payment', 2, 'Printer advance (entered twice) · 1 receipt', 2, '2026-10-06 08:15:00'),
  (5, '01M1DJ06WG2FESC8JZD176WP2B', 'pay_part', 'payment', 2, 'Paid ₹2,00,000 of ₹5,50,000 to Shree Palace Garden', 1, '2026-10-01 07:00:00');

INSERT INTO imports (id, public_id, client_uuid, batch_id, source, file_name, rows_read, created_count, updated_count, skipped_count, error_count, invitations_count, created_at, created_by, updated_by) VALUES
  (1, '01M1DJ07VRVENYTEZ9R900243P', '141f6f68-1281-4d13-9681-35e545d9bf64', 1, 'xlsx', 'AM_Guest_List_Template.xlsx', 44, 40, 0, 3, 1, 0, '2026-09-20 06:00:00', 1, 1);

-- 7. Families (60 live + 1 deleted). Two share a phone to test 'Possible duplicates'.
INSERT INTO households (id, public_id, client_uuid, name, name_norm, phone, alt_phone, side, group_name, relation, area, city, address, adults, children, food, jain_count, is_vip, notes, created_at, created_by, updated_by, deleted_at, deleted_by, delete_batch_id) VALUES
  (1, '01M1DJ08V0HFGXZY3382EFCY3K', '4d8f0a10-1db8-4cb6-8909-502b37b4de27', 'Ramesh Sharma & family', 'ramesh sharma', '+919828010085', NULL, 'groom', 'Samaj', 'Neighbour', NULL, 'Udaipur', NULL, 4, 0, 'veg', 0, 1, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (2, '01M1DJ09T8J20YHSC0JGJN6Z0K', '73f4a860-5643-4bb7-a136-47409c2ac31d', 'Suresh Porwal & family', 'suresh porwal', '+919828010152', NULL, 'groom', 'Nanihal (Mama ji)', 'Bua', NULL, 'Mumbai', NULL, 1, 1, 'jain', 0, 0, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (3, '01M1DJ0ASGF5GRVCJHXX5G82XE', '7b7c7653-d25f-4e1c-a248-ee598060476b', 'Mahesh Agarwal & family', 'mahesh agarwal', '+919829010158', NULL, 'groom', 'Friends', 'Fufa', 'Kashipuri', 'Bhilwara', NULL, 4, 2, 'veg', 0, 0, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (4, '01M1DJ0BRRDRHRZX8MYWEYSHP6', '4285b5f3-c8d7-4c97-b341-52897b3ef924', 'Dinesh Kothari & family', 'dinesh kothari', '+919828010220', NULL, 'groom', 'Neighbours', 'Neighbour', 'Sanganer Road', 'Bhilwara', NULL, 5, 0, 'veg', 0, 0, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (5, '01M1DJ0CR0HQDFK2KK6P47934J', '23b6eebb-6db7-4e19-bf08-7a4b4fee38f2', 'Vinod Jain & family', 'vinod jain', '+919828010242', NULL, 'groom', 'Neighbours', 'Mausi', NULL, 'Chittorgarh', NULL, 2, 0, 'veg', 0, 0, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (6, '01M1DJ0DQ867PFC7375ZBR67DP', '3de0a2e2-5b21-4d8e-b281-3aa4454acc67', 'Prakash Porwal (Mama ji)', 'prakash porwal mama', '+919829010301', NULL, 'groom', 'Samaj', 'Friend', NULL, 'Indore', NULL, 2, 0, 'jain', 0, 1, 'Mama ji — Mayra lead. Call before 9 PM.', '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (7, '01M1DJ0EPGXBWAS1KPV7NN5YMT', 'd5937885-d0e8-4509-a746-712d23843962', 'Kailash Porwal (Chacha ji)', 'kailash porwal chacha', '+919829010356', NULL, 'groom', 'Office', 'Bua', 'Bapu Nagar', 'Bhilwara', NULL, 1, 2, 'jain', 0, 1, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (8, '01M1DJ0FNRDVPYK7ZSAX3932HF', 'af61bb70-413e-4850-a3ab-9e9c9c9b79b1', 'Om Prakash Mundra & family', 'om prakash mundra', '+919828010409', NULL, 'groom', 'Office', 'Mausi', 'R.C. Vyas Colony', 'Bhilwara', NULL, 2, 0, 'veg', 0, 0, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (9, '01M1DJ0GN0XSAV1VV70RYEG5BC', 'bf0ff3c9-c2e0-41d5-8a4b-0109775852a6', 'Sanjay Bhandari & family', 'sanjay bhandari', '+919828010425', '+919414010430', 'groom', 'Porwal parivar', 'Mama', 'Kashipuri', 'Bhilwara', NULL, 3, 1, 'veg', 0, 0, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (10, '01M1DJ0HM865VY6D7ACJV1GAQD', 'a7d083ce-1fea-4e74-a626-23f288060e83', 'Ashok Lodha & family', 'ashok lodha', '+919829010513', NULL, 'groom', 'Nanihal (Mama ji)', 'Friend', NULL, 'Ajmer', NULL, 3, 1, 'veg', 0, 0, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (11, '01M1DJ0JKG5JQWZGSQFTX97XVW', 'a6defe4a-5011-45e6-9026-3ac387df5a03', 'Girish Maheshwari & family', 'girish maheshwari', '+919829010569', NULL, 'groom', 'Porwal parivar', 'Bua', 'Azad Nagar', 'Bhilwara', NULL, 2, 3, 'veg', 0, 0, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (12, '01M1DJ0KJRS26K5T05XVQVFRVZ', 'b33f123c-2259-4e21-9d00-13ddb599a286', 'Anil Chordia & family', 'anil chordia', '+919829010650', NULL, 'groom', 'Nanihal (Mama ji)', 'Bua', 'Shastri Nagar', 'Bhilwara', NULL, 4, 3, 'veg', 0, 0, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (13, '01M1DJ0MJ0G31G9HSTV930X2MH', '30ffefe2-7748-4abf-b599-bf67180c77ea', 'राजेश पोरवाल & family', 'राजेश पोरवाल', '+919828010220', NULL, 'groom', 'Neighbours', 'Fufa', 'Azad Nagar', 'Bhilwara', NULL, 4, 0, 'veg', 0, 0, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (14, '01M1DJ0NH86RVWCWZ3H8Z15HHW', '20f1e8a6-852d-4c5a-b72a-bf0fc879c663', 'Hemant Daga & family', 'hemant daga', '+919828010771', NULL, 'groom', 'Friends', 'Mami', NULL, 'Ahmedabad', NULL, 2, 1, 'veg', 0, 0, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (15, '01M1DJ0PGGX782289578G9NZGD', '751492dc-2ba7-4643-a46c-bfadefee5ff0', 'Naresh Soni & family', 'naresh soni', '+919829010823', NULL, 'groom', 'Friends', 'Fufa', NULL, 'Ajmer', NULL, 1, 3, 'veg', 0, 0, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (16, '01M1DJ0QFRXN4Q06SK6RF0Q6W5', '114c661d-f547-4b40-8489-48e5e7feccb3', 'Rakesh Baheti & family', 'rakesh baheti', '+919829010908', NULL, 'groom', 'Porwal parivar', 'Fufa', NULL, 'Ahmedabad', NULL, 2, 2, 'mixed', 2, 0, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (17, '01M1DJ0RF0BCPZMQFX4KGQWAYD', 'c143817d-728c-4012-8ab5-81cc916c0581', 'Pawan Toshniwal & family', 'pawan toshniwal', NULL, NULL, 'groom', 'Nanihal (Mama ji)', 'Samaj', NULL, 'Ahmedabad', NULL, 4, 2, 'jain', 0, 0, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (18, '01M1DJ0SE8GR6MAX88FKTYR7DY', '0a7f2f26-414e-4928-950c-4fdc43a755ef', 'Deepak Sodani & family', 'deepak sodani', '+919828010940', '+919414010945', 'groom', 'Friends', 'Bua', NULL, 'Ahmedabad', NULL, 2, 1, 'mixed', 2, 0, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (19, '01M1DJ0TDGGFGTAF3Q13FW42HE', 'a2071cd9-a8b3-4794-a30e-cc1f25ed6ac7', 'Infosys team (Ayush)', 'infosys team ayush', '+919828010977', NULL, 'groom', 'Neighbours', 'Mama', 'Shastri Nagar', 'Bhilwara', NULL, 5, 0, 'veg', 0, 0, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (20, '01M1DJ0VCR10MQKMKT2KY5NFQ9', '27fe6329-c1d4-4a12-8c32-bbf787483c11', 'Kunal & Riya (college friends)', 'kunal riya college friends', '+919828010984', NULL, 'groom', 'Office', 'Bhai', NULL, 'Mumbai', NULL, 2, 2, 'mixed', 1, 0, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (21, '01M1DJ0WC0DGWKNT88PEDRR590', 'a96374cb-c5a8-46c4-8c0c-29e5d8167450', 'Manoj Kabra & family', 'manoj kabra', '+919828011069', NULL, 'groom', 'Neighbours', 'Bhai', NULL, 'Mumbai', NULL, 2, 0, 'veg', 0, 0, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (22, '01M1DJ0XB85B76K05C020MYQ6Q', '55328134-0878-447d-b1dc-2168f30475b8', 'Bharat Porwal (Tau ji)', 'bharat porwal tau', '+919829011119', NULL, 'groom', 'Neighbours', 'Bua', NULL, 'Udaipur', NULL, 4, 0, 'veg', 0, 1, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (23, '01M1DJ0YAGXBERE12KD8VXCXP9', '465100dd-73fc-44dc-bc83-b6945ad60382', 'Sunil Jhanwar & family', 'sunil jhanwar', '+919829011174', NULL, 'groom', 'Neighbours', 'Chacha', NULL, 'Udaipur', NULL, 2, 1, 'jain', 0, 0, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (24, '01M1DJ0Z9RFVNAG15B97J3ZJJR', '15846193-7206-45fa-91bc-18da70e0b78e', 'Yogesh Ladha & family', 'yogesh ladha', '+919828011220', NULL, 'groom', 'Neighbours', 'Friend', 'R.C. Vyas Colony', 'Bhilwara', NULL, 2, 0, 'veg', 0, 0, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (25, '01M1DJ109051PKCJKYEYYB2JG5', 'c338f42b-a305-409a-9835-5bab4d7da303', 'Arvind Nyati & family', 'arvind nyati', '+919828011285', NULL, 'groom', 'Office', 'Tau', NULL, 'Jaipur', NULL, 1, 0, 'jain', 0, 0, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (26, '01M1DJ1188MKRW7EHSZFEQC3XQ', 'ed0665fc-e1cc-4f55-a545-a72a587d7d39', 'Vijay Kankariya & family', 'vijay kankariya', '+919829011327', NULL, 'groom', 'Friends', 'Samaj', 'Subhash Nagar', 'Bhilwara', NULL, 4, 0, 'veg', 0, 0, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (27, '01M1DJ127GF76W1VSWKG8KKY2F', '9bd6946f-9400-4af7-9e5f-7908faa00651', 'Jitendra Samdani & family', 'jitendra samdani', '+919828011335', '+919414011340', 'groom', 'Nanihal (Mama ji)', 'Other', NULL, 'Mumbai', NULL, 5, 0, 'mixed', 2, 0, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (28, '01M1DJ136RCYZZ3HDDBWW6J9RQ', '7ed3175a-3e4d-4893-8556-bf872d1b3d88', 'Harish Bangar & family', 'harish bangar', '+919828011355', NULL, 'groom', 'Neighbours', 'Neighbour', 'Azad Nagar', 'Bhilwara', NULL, 2, 2, 'jain', 0, 0, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (29, '01M1DJ14603HCMHH7K75RSKFTW', 'b546817b-ffd6-4675-8078-bf6561f02913', 'Mukesh Somani & family', 'mukesh somani', '+919828011421', NULL, 'groom', 'Nanihal (Mama ji)', 'Samaj', NULL, 'Ahmedabad', NULL, 2, 0, 'veg', 0, 0, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (30, '01M1DJ1558C9DMHQYTJ9X73EFC', 'e3f92c17-204e-4d34-ba42-02a05d0b932b', 'Nitin Porwal (Bhai)', 'nitin porwal bhai', '+919829011486', NULL, 'groom', 'Friends', 'Office', NULL, 'Indore', NULL, 4, 2, 'veg', 0, 0, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (31, '01M1DJ164G8JRTZ6M5GEAD8BEF', 'ff38fae0-1cea-48be-b1cc-f4d9a500e690', 'Ramesh Jagetiya (Nana ji)', 'ramesh jagetiya nana', '+919829011554', NULL, 'bride', 'Nanihal (Nana ji)', 'Bhai', NULL, 'Jaipur', NULL, 2, 1, 'veg', 0, 1, 'Nana ji needs a wheelchair at the venue ♿', '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (32, '01M1DJ173RYW943BRREK15HJD0', 'cbc9c663-7fbc-4f4f-a433-c47962dc9b73', 'Sushil Jagetiya (Mama ji)', 'sushil jagetiya mama', '+919829011651', NULL, 'bride', 'Samaj', 'Chacha', NULL, 'Ajmer', NULL, 2, 1, 'veg', 0, 1, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (33, '01M1DJ1830F38BJ0RF32K7XG8Q', 'bbfc1fd6-fad9-45a1-9629-2757fd561366', 'Manish Jagetiya & family', 'manish jagetiya', '+919829011696', NULL, 'bride', 'Jagetiya parivar', 'Fufa', 'Shastri Nagar', 'Bhilwara', NULL, 1, 0, 'mixed', 1, 0, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (34, '01M1DJ1928FD5WMG8ACA6QBD28', 'b0235785-82eb-4e9a-9ac0-030c6235bf88', 'सुरेश जगेटिया & family', 'सुरेश जगेटिया', '+919829011783', NULL, 'bride', 'Neighbours', 'Office', NULL, 'Indore', NULL, 5, 1, 'mixed', 1, 0, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (35, '01M1DJ1A1G985G3CGP4J3AVDDF', '9449f6dc-df24-4041-a2ff-305aea0ec8c9', 'Pankaj Bhatt & family', 'pankaj bhatt', '+919828011849', NULL, 'bride', 'Nanihal (Nana ji)', 'Friend', 'Azad Nagar', 'Bhilwara', NULL, 2, 1, 'jain', 0, 0, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (36, '01M1DJ1B0RH536DPBF8MA4CMZH', '49f92b04-7352-4239-bd08-a4dd26a3c388', 'Rahul Kothari & family', 'rahul kothari', '+919829011888', '+919414011893', 'bride', 'Neighbours', 'Mami', NULL, 'Chittorgarh', NULL, 4, 0, 'veg', 0, 0, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (37, '01M1DJ1C00AYSEVDGDX8TGW42W', '6c84421b-e7af-441b-8447-6d6efb8cf88e', 'Anita Bafna (Mausi)', 'anita bafna mausi', '+919829011920', NULL, 'bride', 'Samaj', 'Chacha', 'Pur Road', 'Bhilwara', NULL, 2, 0, 'jain', 0, 0, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (38, '01M1DJ1CZ82W7XPGEKE81EE8HY', '6d78e56e-bad4-42db-beb3-aafea8fb978e', 'Dilip Surana & family', 'dilip surana', '+919828011973', NULL, 'bride', 'School friends', 'Friend', 'Kashipuri', 'Bhilwara', NULL, 4, 2, 'veg', 0, 0, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (39, '01M1DJ1DYG9WCWRDKTBE7PNDZD', '2d15ede3-aa21-42e9-a4cc-c27f23c486f1', 'Kishore Dhadda & family', 'kishore dhadda', '+919829012042', NULL, 'bride', 'Jagetiya parivar', 'Mausi', NULL, 'Mumbai', NULL, 5, 2, 'veg', 0, 0, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (40, '01M1DJ1EXR82B8S9B26KHXYG1B', '19f76928-3483-434b-990e-04424d4d0a2e', 'Shyam Sundar Mehta & family', 'shyam sundar mehta', '+919828012081', NULL, 'bride', 'Nanihal (Nana ji)', 'Bua', NULL, 'Mumbai', NULL, 4, 0, 'veg', 0, 0, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (41, '01M1DJ1FX0XEEBCQ2S5PMTWD5D', '0e0a20c3-13a5-4903-b4d0-c32308586085', 'Lalit Bhansali & family', 'lalit bhansali', '+919828012174', NULL, 'bride', 'Neighbours', 'Bua', NULL, 'Indore', NULL, 2, 0, 'jain', 0, 0, NULL, '2026-10-07 08:00:00', 4, 4, NULL, NULL, NULL),
  (42, '01M1DJ1GW8B360E1R3RHMF00W2', '0a46d62c-642b-4c53-bd32-7b35d5e675fe', 'Mahi''s school friends', 'mahi''s school friends', '+919829012227', NULL, 'bride', 'School friends', 'Mami', NULL, 'Jaipur', NULL, 4, 1, 'veg', 0, 0, NULL, '2026-10-01 09:00:00', 3, 3, NULL, NULL, NULL),
  (43, '01M1DJ1HVGQ70HT4KNHGJBG8J8', 'fe0f1916-f7d7-47f4-8e92-3406416953f1', 'Rajkumar Nahar & family', 'rajkumar nahar', '+919829012290', NULL, 'bride', 'Neighbours', 'Tau', 'Bapu Nagar', 'Bhilwara', NULL, 5, 1, 'veg', 0, 0, NULL, '2026-10-02 10:00:00', 1, 1, NULL, NULL, NULL),
  (44, '01M1DJ1JTRZQ6GARVQB3NZ06PM', 'b9cefd31-978f-410c-804d-c3b02c227435', 'Gopal Chhajed & family', 'gopal chhajed', NULL, NULL, 'bride', 'Samaj', 'Tau', 'R.C. Vyas Colony', 'Bhilwara', NULL, 4, 0, 'veg', 0, 0, NULL, '2026-10-03 11:00:00', 7, 7, NULL, NULL, NULL),
  (45, '01M1DJ1KT0WXRMXD85BQ365ZZM', '6ea64253-fb2b-4197-afdd-caa1fa6df3aa', 'Sudhir Golchha & family', 'sudhir golchha', '+919828012349', '+919414012354', 'bride', 'Neighbours', 'Bua', 'Sanganer Road', 'Bhilwara', NULL, 2, 0, 'veg', 0, 0, NULL, '2026-10-04 12:00:00', 1, 1, NULL, NULL, NULL),
  (46, '01M1DJ1MS86KWHVZ2JRYDEKN1J', '872d5a0f-b5b6-46bc-877b-12091b4fc8a9', 'Pradeep Nolkha & family', 'pradeep nolkha', '+919829012356', NULL, 'bride', 'Nanihal (Nana ji)', 'Chacha', 'Gandhi Nagar', 'Bhilwara', NULL, 4, 0, 'veg', 0, 0, NULL, '2026-10-05 13:00:00', 4, 4, NULL, NULL, NULL),
  (47, '01M1DJ1NRGC8E2W96YWWWA2DJB', 'f3a8f831-a68c-4c37-b2bf-476ddbd6e6a4', 'Vimal Sethia & family', 'vimal sethia', '+919829012400', NULL, 'bride', 'School friends', 'Tau', 'Shastri Nagar', 'Bhilwara', NULL, 4, 2, 'mixed', 2, 0, NULL, '2026-10-06 14:00:00', 2, 2, NULL, NULL, NULL),
  (48, '01M1DJ1PQRQ91FG2DVF2DFDA5W', 'd92cdfce-eb6f-487a-be6d-4179f2799803', 'Ashish Dugar & family', 'ashish dugar', '+919829012481', NULL, 'bride', 'Jagetiya parivar', 'Friend', 'Pur Road', 'Bhilwara', NULL, 2, 2, 'veg', 0, 0, NULL, '2026-10-07 03:00:00', 2, 2, NULL, NULL, NULL),
  (49, '01M1DJ1QQ0PXN8SMJR5BJHB4GY', 'cb42fc9e-be42-412a-bcf1-cc3f340fe5c6', 'Neelam Bothra (Bua)', 'neelam bothra bua', '+919828012506', NULL, 'bride', 'Nanihal (Nana ji)', 'Bua', NULL, 'Udaipur', NULL, 2, 3, 'veg', 0, 0, NULL, '2026-10-01 04:00:00', 4, 4, NULL, NULL, NULL),
  (50, '01M1DJ1RP8SXXZN3X731RWTAGB', '7b7c49bd-b5d5-427a-a78c-ceea0ebcd365', 'Tarun Kochar & family', 'tarun kochar', '+919829012552', NULL, 'bride', 'Samaj', 'Other', 'Sanganer Road', 'Bhilwara', NULL, 2, 0, 'veg', 0, 0, NULL, '2026-10-02 05:00:00', 3, 3, NULL, NULL, NULL),
  (51, '01M1DJ1SNGKGB4BD5JWN5SWF22', 'af231784-8aab-49ca-99cf-eaf78ea4f39d', 'Mohit Lunawat & family', 'mohit lunawat', '+919829012648', NULL, 'bride', 'School friends', 'Tau', 'Sanganer Road', 'Bhilwara', NULL, 4, 2, 'mixed', 1, 0, NULL, '2026-10-03 06:00:00', 4, 4, NULL, NULL, NULL),
  (52, '01M1DJ1TMRY9TBACGN2ETXQHST', 'a1054469-814f-4575-8b07-625f19f17085', 'Abhay Parakh & family', 'abhay parakh', '+919828012727', NULL, 'bride', 'Nanihal (Nana ji)', 'Mama', NULL, 'Jaipur', NULL, 2, 0, 'veg', 0, 0, NULL, '2026-10-04 07:00:00', 2, 2, NULL, NULL, NULL),
  (53, '01M1DJ1VM022Y4AN0P8ZQH20JF', '08d39c2a-a176-4719-a9d9-a8f5906e9030', 'Rajesh Choraria & family', 'rajesh choraria', '+919829012813', NULL, 'bride', 'Jagetiya parivar', 'Chacha', NULL, 'Indore', NULL, 2, 1, 'veg', 0, 0, NULL, '2026-10-05 08:00:00', 7, 7, NULL, NULL, NULL),
  (54, '01M1DJ1WK8P3EJKX5FMCYW61PY', '144ec22d-64d8-4d16-bcb1-6b8f71aba6e5', 'Sandeep Rampuria & family', 'sandeep rampuria', '+919829012847', '+919414012852', 'bride', 'Samaj', 'Samaj', NULL, 'Indore', NULL, 4, 0, 'veg', 0, 0, NULL, '2026-10-06 09:00:00', 3, 3, NULL, NULL, NULL),
  (55, '01M1DJ1XJGHJ0PSRQB61YP8PQB', '42d2c54d-25dc-4105-b362-c7eb99248ed0', 'Sharma ji (neighbour, both sides)', 'sharma neighbour, both sides', '+919829012934', NULL, 'both', 'Neighbours', 'Chacha', NULL, 'Ajmer', NULL, 2, 1, 'veg', 0, 1, NULL, '2026-10-07 10:00:00', 2, 2, NULL, NULL, NULL),
  (56, '01M1DJ1YHREY7QPB7MSPQB0HN1', '5ad1c7ca-687f-43d2-b9ba-34c039a65568', 'Porwal Samaj Adhyaksh', 'porwal samaj adhyaksh', '+919828012983', NULL, 'both', 'Samaj', 'Bhai', 'Kashipuri', 'Bhilwara', NULL, 4, 0, 'mixed', 1, 0, NULL, '2026-10-01 11:00:00', 7, 7, NULL, NULL, NULL),
  (57, '01M1DJ1ZH0NZVCCTB5BB6YWQBS', 'c741c752-ae29-4e3a-ac58-96614088e034', 'Jain Samaj Trust', 'jain samaj trust', '+919829013065', NULL, 'both', 'Samaj', 'Mami', NULL, 'Jaipur', NULL, 2, 1, 'mixed', 2, 0, NULL, '2026-10-02 12:00:00', 5, 5, NULL, NULL, NULL),
  (58, '01M1DJ20G8YCA23FY9MKZHJ512', '0f529429-915e-4a33-a367-2b0f22a05f1a', 'Dr. Ravi Khandelwal & family', 'dr. ravi khandelwal', '+919829013082', NULL, 'both', 'Friends', 'Office', NULL, 'Ajmer', NULL, 2, 0, 'mixed', 1, 0, NULL, '2026-10-03 13:00:00', 7, 7, NULL, NULL, NULL),
  (59, '01M1DJ21FGCCMCN21NAMEQFKS9', '99c0eb6f-bfe4-4a22-9473-7b10623dd7dd', 'CA Vikas Ajmera & family', 'ca vikas ajmera', '+919828013115', NULL, 'both', 'Friends', 'Mausi', NULL, 'Udaipur', NULL, 2, 1, 'veg', 0, 0, NULL, '2026-10-04 14:00:00', 4, 4, NULL, NULL, NULL),
  (60, '01M1DJ22ERTNG86WR9AC5AKZS6', '8517f505-581a-45dd-b43f-2cafb9aa0aba', 'Patel family (Dubai)', 'patel dubai', '+971501234567', NULL, 'both', 'Neighbours', 'Chacha', NULL, 'Dubai', NULL, 3, 3, 'jain', 0, 1, 'Flying in from Dubai on 13 Feb ✈️', '2026-10-05 03:00:00', 5, 5, NULL, NULL, NULL),
  (61, '01M1DJ23E0XARZAZB3J7AF24M1', 'be29cfce-f769-49d0-a8fa-87b9edab2007', 'Gupta family', 'gupta', '+919829010158', NULL, 'groom', 'Office', 'Office', NULL, 'Jaipur', NULL, 2, 0, 'veg', 0, 0, 'Entered twice by mistake', '2026-10-01 09:00:00', 3, 3, '2026-10-02 12:10:00', 3, 2);

-- 8. Invitations + RSVP. Event ids come from @ev_* variables set above.
INSERT INTO household_events (id, client_uuid, household_id, event_id, rsvp, expected_adults, expected_children, rsvp_note, rsvp_updated_at, rsvp_updated_by, last_reminder_opened_at, created_at, created_by, updated_by, deleted_at, deleted_by, delete_batch_id) VALUES
  (1, '61187466-8a36-47e8-9b81-f5e3db49f856', 1, @ev_engagement, 'coming', NULL, NULL, NULL, '2026-10-01 05:00:00', 3, NULL, '2026-09-20 06:00:00', 1, 3, NULL, NULL, NULL),
  (2, '48ab0452-bd15-4832-8341-1daf0dbd25f2', 1, @ev_haldi, 'coming', NULL, NULL, NULL, '2026-10-05 08:00:00', 1, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (3, '8ff50dea-9152-48f1-a64c-a3c6745ab8cf', 1, @ev_mehndi, 'coming', NULL, NULL, NULL, '2026-10-05 04:00:00', 3, NULL, '2026-09-20 06:00:00', 1, 3, NULL, NULL, NULL),
  (4, '31750057-5bbc-4448-b764-5e58023c4722', 1, @ev_mayra, 'coming', NULL, NULL, NULL, '2026-10-04 09:00:00', 2, NULL, '2026-09-20 06:00:00', 1, 2, NULL, NULL, NULL),
  (5, '0f56cdef-5620-480d-8316-4d4d3a8c4465', 1, @ev_sangeet, 'waiting', NULL, NULL, NULL, '2026-10-07 12:00:00', 7, NULL, '2026-09-20 06:00:00', 1, 7, NULL, NULL, NULL),
  (6, 'e7078450-4dfa-4c19-b075-787524672d38', 1, @ev_wedding, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (7, '28f86330-815b-4845-8903-01bd14e6aa89', 1, @ev_reception, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (8, '789e0667-c9b2-4dad-b1d2-1e6c6d915aa4', 2, @ev_haldi, 'not_coming', NULL, NULL, NULL, '2026-10-07 15:00:00', 2, NULL, '2026-09-20 06:00:00', 1, 2, NULL, NULL, NULL),
  (9, '22090bf3-d69c-44ba-8e3e-42c0d6196278', 2, @ev_mehndi, 'waiting', NULL, NULL, NULL, '2026-10-03 09:00:00', 1, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (10, 'e5a9e0d1-9b80-4140-becc-cb9c68997ccb', 2, @ev_mayra, 'coming', NULL, NULL, NULL, '2026-10-04 15:00:00', 7, NULL, '2026-09-20 06:00:00', 1, 7, NULL, NULL, NULL),
  (11, '540cea0c-f278-4a06-a048-74298e001f1c', 2, @ev_sangeet, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (12, 'cc9d5719-72fe-4f3a-8761-f604abab0c0c', 2, @ev_wedding, 'waiting', NULL, NULL, NULL, '2026-10-05 10:00:00', 2, NULL, '2026-09-20 06:00:00', 1, 2, NULL, NULL, NULL),
  (13, '6198eea1-b5eb-4507-889f-e3aa67fa22d6', 2, @ev_reception, 'waiting', NULL, NULL, NULL, '2026-10-01 04:00:00', 3, NULL, '2026-09-20 06:00:00', 1, 3, NULL, NULL, NULL),
  (14, '3c35f01d-497d-42fd-911e-1b6ddc00203f', 3, @ev_wedding, 'coming', NULL, NULL, NULL, '2026-10-05 05:00:00', 5, NULL, '2026-09-20 06:00:00', 1, 5, NULL, NULL, NULL),
  (15, 'b7182dd6-ba1f-4d48-821e-067afe5e2ecc', 3, @ev_reception, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (16, '27adaa90-316e-42bf-b20d-310006269ac3', 4, @ev_wedding, 'waiting', NULL, NULL, NULL, '2026-10-07 11:00:00', 2, '2026-10-07 13:00:00', '2026-09-20 06:00:00', 1, 2, NULL, NULL, NULL),
  (17, 'df0bbcf6-fdcb-444f-9053-d3b261dbb895', 4, @ev_reception, 'waiting', NULL, NULL, NULL, '2026-10-01 13:00:00', 1, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (18, '6fda7013-e16f-48d9-b67c-95332feb52c7', 5, @ev_wedding, 'coming', NULL, NULL, NULL, '2026-10-03 14:00:00', 4, NULL, '2026-09-20 06:00:00', 1, 4, NULL, NULL, NULL),
  (19, '07448611-4fd1-415c-8a59-f16493072d5c', 5, @ev_reception, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (20, '8eec4f9b-0a40-446c-83ce-9a2136b5f055', 6, @ev_engagement, 'coming', NULL, NULL, NULL, '2026-10-03 14:00:00', 7, NULL, '2026-09-20 06:00:00', 1, 7, NULL, NULL, NULL),
  (21, '807837b9-743b-413a-ac3c-23a3293ac0c9', 6, @ev_haldi, 'waiting', NULL, NULL, NULL, '2026-10-04 05:00:00', 4, '2026-10-07 13:00:00', '2026-09-20 06:00:00', 1, 4, NULL, NULL, NULL),
  (22, 'c3eb9713-ffcd-4a4b-8833-347bc99b659d', 6, @ev_mehndi, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (23, 'fca565b5-45ed-42a6-89ec-5751c5e09a3e', 6, @ev_mayra, 'coming', NULL, NULL, NULL, '2026-10-05 06:00:00', 5, NULL, '2026-09-20 06:00:00', 1, 5, NULL, NULL, NULL),
  (24, '6ade40b8-ed2b-4816-920a-f98ce1cb013b', 6, @ev_sangeet, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (25, 'b92da7f4-a874-4a48-8178-b4382550179f', 6, @ev_wedding, 'waiting', NULL, NULL, NULL, '2026-10-06 13:00:00', 3, NULL, '2026-09-20 06:00:00', 1, 3, NULL, NULL, NULL),
  (26, '318e9b37-6ade-4358-a567-de1abdff8955', 6, @ev_reception, 'not_coming', NULL, NULL, NULL, '2026-10-06 07:00:00', 4, NULL, '2026-09-20 06:00:00', 1, 4, NULL, NULL, NULL),
  (27, 'a2057571-60bd-4bf8-9285-56dd1262b376', 7, @ev_engagement, 'coming', NULL, NULL, NULL, '2026-10-03 11:00:00', 2, NULL, '2026-09-20 06:00:00', 1, 2, NULL, NULL, NULL),
  (28, '87665118-3fd1-4a60-a6c8-efb13c305500', 7, @ev_haldi, 'coming', NULL, NULL, NULL, '2026-10-02 10:00:00', 4, NULL, '2026-09-20 06:00:00', 1, 4, NULL, NULL, NULL),
  (29, '94445bfb-0c10-4a57-ac29-fb5f51866c8e', 7, @ev_mehndi, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (30, '0faf5677-cfd3-4761-8405-c1c85f319643', 7, @ev_mayra, 'coming', NULL, NULL, NULL, '2026-10-07 06:00:00', 4, NULL, '2026-09-20 06:00:00', 1, 4, NULL, NULL, NULL),
  (31, '05a1ee54-4855-4dca-9fd8-d26f73fdaf3b', 7, @ev_sangeet, 'coming', NULL, NULL, NULL, '2026-10-05 08:00:00', 3, NULL, '2026-09-20 06:00:00', 1, 3, NULL, NULL, NULL),
  (32, 'df773b5c-4cf2-48ba-92ba-54c6bb7bc833', 7, @ev_wedding, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (33, '16dcde80-292f-4a47-ad98-df16e7cae475', 7, @ev_reception, 'waiting', NULL, NULL, NULL, '2026-10-02 09:00:00', 4, '2026-10-07 13:00:00', '2026-09-20 06:00:00', 1, 4, NULL, NULL, NULL),
  (34, '499297be-769b-4e6b-a174-1d692950b3fd', 8, @ev_wedding, 'coming', NULL, NULL, NULL, '2026-10-03 04:00:00', 2, NULL, '2026-09-20 06:00:00', 1, 2, NULL, NULL, NULL),
  (35, '8e289d3f-a3b9-4f29-8335-81cb547c85f1', 8, @ev_reception, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (36, '5a195e66-39cb-4389-8a79-62066e9d24b3', 9, @ev_wedding, 'waiting', NULL, NULL, NULL, '2026-10-01 05:00:00', 5, NULL, '2026-09-20 06:00:00', 1, 5, NULL, NULL, NULL),
  (37, '87c656ca-4880-4b2d-9f20-b66cd492e7c6', 9, @ev_reception, 'waiting', NULL, NULL, NULL, '2026-10-01 13:00:00', 5, NULL, '2026-09-20 06:00:00', 1, 5, NULL, NULL, NULL),
  (38, '3b711582-7e5f-4376-ace1-d7b5e4e40f5e', 10, @ev_wedding, 'waiting', NULL, NULL, NULL, '2026-10-03 08:00:00', 2, NULL, '2026-09-20 06:00:00', 1, 2, NULL, NULL, NULL),
  (39, '6dd48f29-6dfd-444a-9145-de1f94c86351', 10, @ev_reception, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (40, '86abb48a-2e49-4ea0-bea0-5ccab9e532a9', 11, @ev_wedding, 'waiting', NULL, NULL, NULL, '2026-10-03 15:00:00', 7, NULL, '2026-09-20 06:00:00', 1, 7, NULL, NULL, NULL),
  (41, '5989c464-e928-45c1-a06c-0454f221d88f', 11, @ev_reception, 'waiting', NULL, NULL, NULL, '2026-10-07 04:00:00', 7, NULL, '2026-09-20 06:00:00', 1, 7, NULL, NULL, NULL),
  (42, '0b55a376-9202-4a70-b780-957f17ad6b4b', 12, @ev_wedding, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (43, '9329f082-6527-44f8-ab8b-3cb19072dcc3', 12, @ev_reception, 'waiting', NULL, NULL, NULL, '2026-10-06 10:00:00', 1, '2026-10-07 13:00:00', '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (44, '57e16488-f3c7-4fb5-82bd-e8d740c47873', 13, @ev_wedding, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (45, '8e1b819e-8c09-4bc9-934f-2009d0081d54', 13, @ev_reception, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (46, 'c64807d4-e7f2-4b49-904f-a9fac0e9c615', 14, @ev_wedding, 'coming', NULL, NULL, NULL, '2026-10-04 04:00:00', 3, NULL, '2026-09-20 06:00:00', 1, 3, NULL, NULL, NULL),
  (47, 'bc408543-01d0-4f3c-b8f2-c4e66b40d014', 14, @ev_reception, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (48, '0b56d533-6e43-4a05-ac41-7edc83c9309c', 15, @ev_wedding, 'not_coming', NULL, NULL, NULL, '2026-10-03 15:00:00', 2, NULL, '2026-09-20 06:00:00', 1, 2, NULL, NULL, NULL),
  (49, 'd22b22b2-3460-4917-8d55-88c4ae684305', 15, @ev_reception, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (50, '02299dcb-a70e-401d-bc53-63b6838207a0', 16, @ev_wedding, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (51, '3a85337a-4c81-4593-b0e0-9aaa2eb57feb', 16, @ev_reception, 'waiting', NULL, NULL, NULL, '2026-10-03 12:00:00', 5, '2026-10-07 13:00:00', '2026-09-20 06:00:00', 1, 5, NULL, NULL, NULL),
  (52, '199bbdf9-feb6-4ec8-af7b-b84028376e9a', 17, @ev_wedding, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (53, 'df2468bd-0022-4dd0-a465-006756a91654', 17, @ev_reception, 'waiting', NULL, NULL, NULL, '2026-10-03 12:00:00', 1, '2026-10-07 13:00:00', '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (54, 'd33fc0d7-eac4-497b-bc87-9f9e48851608', 18, @ev_wedding, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (55, 'a0d327bf-a18d-4e36-b958-9d45269c2760', 18, @ev_reception, 'coming', NULL, NULL, NULL, '2026-10-01 15:00:00', 2, NULL, '2026-09-20 06:00:00', 1, 2, NULL, NULL, NULL),
  (56, '361347c3-c723-4499-aa98-b2150e5132f5', 19, @ev_wedding, 'coming', NULL, NULL, NULL, '2026-10-07 10:00:00', 4, NULL, '2026-09-20 06:00:00', 1, 4, NULL, NULL, NULL),
  (57, 'e6629cf4-4f7f-4228-92f6-cd32242c0703', 19, @ev_reception, 'waiting', NULL, NULL, NULL, '2026-10-05 08:00:00', 3, NULL, '2026-09-20 06:00:00', 1, 3, NULL, NULL, NULL),
  (58, '4a397575-c613-455b-9705-8467fc90eaf9', 20, @ev_wedding, 'waiting', NULL, NULL, NULL, '2026-10-02 15:00:00', 5, NULL, '2026-09-20 06:00:00', 1, 5, NULL, NULL, NULL),
  (59, '220844ff-8e26-49d3-a96f-6961e95e13fc', 20, @ev_reception, 'waiting', NULL, NULL, NULL, '2026-10-05 15:00:00', 5, NULL, '2026-09-20 06:00:00', 1, 5, NULL, NULL, NULL),
  (60, '45ca0f27-857a-4981-95f0-7e5459e58e10', 21, @ev_wedding, 'waiting', NULL, NULL, NULL, '2026-10-01 14:00:00', 4, NULL, '2026-09-20 06:00:00', 1, 4, NULL, NULL, NULL),
  (61, '8f65fb72-5810-4600-a063-135c5ac2fcab', 21, @ev_reception, 'waiting', NULL, NULL, NULL, '2026-10-02 13:00:00', 5, NULL, '2026-09-20 06:00:00', 1, 5, NULL, NULL, NULL),
  (62, 'b0cfbd3c-b7d0-42ae-ae9c-9cc96495a026', 22, @ev_engagement, 'coming', NULL, NULL, NULL, '2026-10-05 11:00:00', 5, NULL, '2026-09-20 06:00:00', 1, 5, NULL, NULL, NULL),
  (63, '1d5ac9d3-3ff7-4cc9-b323-29d90153f1c2', 22, @ev_haldi, 'coming', 3, NULL, NULL, '2026-10-02 12:00:00', 7, NULL, '2026-09-20 06:00:00', 1, 7, NULL, NULL, NULL),
  (64, '372d09ad-51b7-443a-acb5-728585658dde', 22, @ev_mehndi, 'coming', NULL, NULL, NULL, '2026-10-03 08:00:00', 3, NULL, '2026-09-20 06:00:00', 1, 3, NULL, NULL, NULL),
  (65, 'e1df018f-c315-4576-9859-350678d4487e', 22, @ev_mayra, 'coming', NULL, NULL, NULL, '2026-10-05 05:00:00', 2, NULL, '2026-09-20 06:00:00', 1, 2, NULL, NULL, NULL),
  (66, '6a7c013f-9b73-4e3d-ae5a-4bbeb993d96e', 22, @ev_sangeet, 'not_coming', NULL, NULL, NULL, '2026-10-07 07:00:00', 4, NULL, '2026-09-20 06:00:00', 1, 4, NULL, NULL, NULL),
  (67, '66bb751a-2304-4670-91f7-923631173fe9', 22, @ev_wedding, 'coming', NULL, NULL, NULL, '2026-10-01 07:00:00', 4, NULL, '2026-09-20 06:00:00', 1, 4, NULL, NULL, NULL),
  (68, '386b8eb5-dd7a-436d-b5a7-6702c0b69948', 22, @ev_reception, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (69, '600db94f-9975-42d9-8483-32a60664d8df', 23, @ev_wedding, 'coming', NULL, NULL, NULL, '2026-10-01 15:00:00', 2, NULL, '2026-09-20 06:00:00', 1, 2, NULL, NULL, NULL),
  (70, 'dbf923f4-2e0b-4950-a1ad-752bb20bbb26', 23, @ev_reception, 'waiting', NULL, NULL, NULL, '2026-10-07 04:00:00', 4, '2026-10-07 13:00:00', '2026-09-20 06:00:00', 1, 4, NULL, NULL, NULL),
  (71, 'dee91bb5-5ae9-4de4-97f0-8ca32c92150c', 24, @ev_wedding, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (72, '8e2007ac-9c32-4ad0-92b6-a4b8abf9d29d', 24, @ev_reception, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (73, '5db00feb-03fe-49c2-94f0-76e1ac5c44de', 25, @ev_wedding, 'waiting', NULL, NULL, NULL, '2026-10-05 04:00:00', 1, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (74, '38deb41d-33a7-411c-a25b-4e7466435375', 25, @ev_reception, 'waiting', NULL, NULL, NULL, '2026-10-05 04:00:00', 7, NULL, '2026-09-20 06:00:00', 1, 7, NULL, NULL, NULL),
  (75, 'c8988239-d3a6-467d-901f-dc7daa28f865', 26, @ev_wedding, 'waiting', NULL, NULL, NULL, '2026-10-05 11:00:00', 1, '2026-10-07 13:00:00', '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (76, '3dc8a1cb-6c3b-44ec-9467-4d035ccaa256', 26, @ev_reception, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (77, 'ffc780aa-f7f7-43f8-9fd2-55eaa6e28c0b', 27, @ev_wedding, 'coming', NULL, NULL, NULL, '2026-10-04 11:00:00', 4, NULL, '2026-09-20 06:00:00', 1, 4, NULL, NULL, NULL),
  (78, '320daa70-df90-4512-a72b-df836e797911', 27, @ev_reception, 'coming', NULL, NULL, NULL, '2026-10-02 08:00:00', 2, NULL, '2026-09-20 06:00:00', 1, 2, NULL, NULL, NULL),
  (79, '3e517ff8-41cd-4c50-9672-9270a853defb', 28, @ev_wedding, 'coming', NULL, NULL, NULL, '2026-10-04 13:00:00', 7, NULL, '2026-09-20 06:00:00', 1, 7, NULL, NULL, NULL),
  (80, '747397b6-35ff-4c79-b78d-015ad3fec4b5', 28, @ev_reception, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (81, '230562ea-a1be-4ee3-abf4-8d7a5326a89a', 29, @ev_wedding, 'not_coming', NULL, NULL, NULL, '2026-10-05 15:00:00', 1, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (82, '2ccd8090-9c85-4638-9429-ea7663c8c8f9', 29, @ev_reception, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (83, 'bc46d740-4a7f-410e-a1a9-cf4736d387de', 30, @ev_haldi, 'coming', NULL, NULL, NULL, '2026-10-04 05:00:00', 1, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (84, 'fa09fd2c-87b1-4a5d-881c-90d4f4d0eb6a', 30, @ev_mehndi, 'waiting', NULL, NULL, NULL, '2026-10-03 05:00:00', 5, NULL, '2026-09-20 06:00:00', 1, 5, NULL, NULL, NULL),
  (85, 'cc8f6d58-089f-4b17-8b5e-0a2b88e14847', 30, @ev_mayra, 'coming', NULL, NULL, NULL, '2026-10-04 10:00:00', 3, NULL, '2026-09-20 06:00:00', 1, 3, NULL, NULL, NULL),
  (86, '8137b970-1d56-49af-ab73-50f23b0b0839', 30, @ev_sangeet, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (87, '5829b548-2c8e-4938-9721-0e90df2176aa', 30, @ev_wedding, 'coming', NULL, NULL, NULL, '2026-10-03 12:00:00', 1, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (88, '07cb1ae1-cb2d-4e8f-be16-5cc27d47ac8e', 30, @ev_reception, 'waiting', NULL, NULL, NULL, '2026-10-06 07:00:00', 1, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (89, '61715747-e410-45cc-bb6a-b65ed67ed9ab', 31, @ev_engagement, 'coming', 1, NULL, NULL, '2026-10-03 12:00:00', 2, NULL, '2026-09-20 06:00:00', 1, 2, NULL, NULL, NULL),
  (90, '9daaa1df-a47d-4784-8e20-f52360e4f87a', 31, @ev_haldi, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (91, 'd165336c-e274-457f-b0f4-746bad98392c', 31, @ev_mehndi, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (92, '01be8d2a-b21e-41e6-a1bb-afb82c3d9ac8', 31, @ev_mayra, 'coming', NULL, NULL, NULL, '2026-10-06 12:00:00', 7, NULL, '2026-09-20 06:00:00', 1, 7, NULL, NULL, NULL),
  (93, '00efb37a-53eb-45e5-8f60-ee84b31e75c5', 31, @ev_sangeet, 'not_coming', NULL, NULL, NULL, '2026-10-01 13:00:00', 3, NULL, '2026-09-20 06:00:00', 1, 3, NULL, NULL, NULL),
  (94, 'e534ebba-b33e-44ab-b079-890a82bf24c3', 31, @ev_wedding, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (95, 'dbcb069e-7bb9-4ec4-88d2-66a946eb2390', 31, @ev_reception, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (96, '1cbe4f3c-65ab-48b9-8275-fa0f1860c6c0', 32, @ev_engagement, 'coming', NULL, NULL, NULL, '2026-10-06 13:00:00', 2, NULL, '2026-09-20 06:00:00', 1, 2, NULL, NULL, NULL),
  (97, '213fa134-0f77-401f-b3f6-56996acccea6', 32, @ev_haldi, 'coming', NULL, NULL, NULL, '2026-10-04 11:00:00', 4, NULL, '2026-09-20 06:00:00', 1, 4, NULL, NULL, NULL),
  (98, 'b8b8821d-1c9c-46a1-873f-d25d113a7af2', 32, @ev_mehndi, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (99, '4f2bdd35-0f8a-4b9b-9cb4-cd0d80e0b8a4', 32, @ev_mayra, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (100, '96442092-1ddf-4f5d-9295-59e614c8e8ab', 32, @ev_sangeet, 'coming', NULL, NULL, NULL, '2026-10-06 15:00:00', 5, NULL, '2026-09-20 06:00:00', 1, 5, NULL, NULL, NULL),
  (101, '87b2448a-7925-4f1b-a79b-b74e4aa153b5', 32, @ev_wedding, 'not_coming', NULL, NULL, NULL, '2026-10-05 13:00:00', 2, NULL, '2026-09-20 06:00:00', 1, 2, NULL, NULL, NULL),
  (102, 'b6f656a9-f0d5-4cd0-9586-1ddd79d84e88', 32, @ev_reception, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (103, '7bdde8f9-2729-4f57-a57c-aec41a4087a7', 33, @ev_haldi, 'coming', NULL, NULL, NULL, '2026-10-04 11:00:00', 3, NULL, '2026-09-20 06:00:00', 1, 3, NULL, NULL, NULL),
  (104, '265331a3-5377-4120-86de-7099bf832673', 33, @ev_mehndi, 'waiting', NULL, NULL, NULL, '2026-10-05 11:00:00', 3, NULL, '2026-09-20 06:00:00', 1, 3, NULL, NULL, NULL),
  (105, 'a2044918-59ce-4ece-8470-009427accd3e', 33, @ev_sangeet, 'waiting', NULL, NULL, NULL, '2026-10-03 15:00:00', 2, '2026-10-07 13:00:00', '2026-09-20 06:00:00', 1, 2, NULL, NULL, NULL),
  (106, 'c8f060c6-0555-4395-9cf4-70cfd48d9482', 33, @ev_wedding, 'waiting', NULL, NULL, NULL, '2026-10-06 11:00:00', 5, '2026-10-07 13:00:00', '2026-09-20 06:00:00', 1, 5, NULL, NULL, NULL),
  (107, 'e79e0393-11e3-4cb9-a456-fd6bf285c69d', 33, @ev_reception, 'waiting', NULL, NULL, NULL, '2026-10-01 08:00:00', 5, '2026-10-07 13:00:00', '2026-09-20 06:00:00', 1, 5, NULL, NULL, NULL),
  (108, '8cf42cd2-787e-4f53-8874-98e95efe03ca', 34, @ev_wedding, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (109, '1d1bf1b2-9d5d-420e-bb01-a941e9e73aa0', 34, @ev_reception, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (110, '82c02620-b9f1-405d-b154-cdd3acc6bad8', 35, @ev_wedding, 'waiting', NULL, NULL, NULL, '2026-10-07 05:00:00', 3, NULL, '2026-09-20 06:00:00', 1, 3, NULL, NULL, NULL),
  (111, '956baf22-97f1-4f15-8402-eba7d87fec43', 35, @ev_reception, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (112, '40c48300-b7dc-4177-8fb5-4462492f2be5', 36, @ev_wedding, 'coming', NULL, NULL, NULL, '2026-10-07 05:00:00', 1, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (113, 'ff860622-9265-4999-b984-650cd8f69141', 36, @ev_reception, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (114, '69b05852-ebf8-40fe-a37f-b4493c904f2b', 37, @ev_haldi, 'waiting', NULL, NULL, NULL, '2026-10-01 08:00:00', 4, '2026-10-07 13:00:00', '2026-09-20 06:00:00', 1, 4, NULL, NULL, NULL),
  (115, 'cba720b2-aadc-489a-864b-ea101faea915', 37, @ev_mehndi, 'coming', NULL, NULL, NULL, '2026-10-01 10:00:00', 3, NULL, '2026-09-20 06:00:00', 1, 3, NULL, NULL, NULL),
  (116, '44024f54-b6f1-4ca1-8a7d-56c7bf0df690', 37, @ev_sangeet, 'not_coming', NULL, NULL, NULL, '2026-10-07 15:00:00', 7, NULL, '2026-09-20 06:00:00', 1, 7, NULL, NULL, NULL),
  (117, 'b0549b08-e929-4925-bea5-8274c4a052ce', 37, @ev_wedding, 'waiting', NULL, NULL, NULL, '2026-10-06 06:00:00', 1, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (118, '7e6ef33d-4570-4d79-bc29-2f076327707d', 37, @ev_reception, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (119, '95ce4f8d-6945-4a4c-9219-04667fc1f91f', 38, @ev_wedding, 'coming', NULL, NULL, NULL, '2026-10-05 09:00:00', 2, NULL, '2026-09-20 06:00:00', 1, 2, NULL, NULL, NULL),
  (120, 'd191794a-90df-4bd0-ae01-aa59eb70317a', 38, @ev_reception, 'not_coming', NULL, NULL, NULL, '2026-10-01 04:00:00', 1, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (121, '44847740-ab36-4938-a75b-029b0576ef8a', 39, @ev_wedding, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (122, '8cd7dc55-9c4a-403f-ac87-2bc8b156082c', 39, @ev_reception, 'coming', NULL, NULL, NULL, '2026-10-01 12:00:00', 5, NULL, '2026-09-20 06:00:00', 1, 5, NULL, NULL, NULL),
  (123, '6dc3fc79-b084-4a83-a723-b9c8ff0de91f', 40, @ev_wedding, 'waiting', NULL, NULL, NULL, '2026-10-05 11:00:00', 7, NULL, '2026-09-20 06:00:00', 1, 7, NULL, NULL, NULL),
  (124, '55a14931-5919-445b-a429-f9ad7574ed1a', 40, @ev_reception, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-20 06:00:00', 1, 1, NULL, NULL, NULL),
  (125, '9664ad4b-d7af-43aa-9032-1862a657f8ba', 41, @ev_wedding, 'waiting', NULL, NULL, NULL, '2026-10-01 15:00:00', 5, NULL, '2026-10-07 08:00:00', 4, 5, NULL, NULL, NULL),
  (126, '10e85948-ee9e-4b0c-8d8f-31a80fb4978e', 41, @ev_reception, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-07 08:00:00', 4, 4, NULL, NULL, NULL),
  (127, '1be7b564-4c2d-4f51-a325-018324353d09', 42, @ev_wedding, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-01 09:00:00', 3, 3, NULL, NULL, NULL),
  (128, 'bf42554c-2321-4b4e-b812-ff42d7046d99', 42, @ev_reception, 'waiting', NULL, NULL, NULL, '2026-10-02 13:00:00', 7, NULL, '2026-10-01 09:00:00', 3, 7, NULL, NULL, NULL),
  (129, 'c6cc70fb-cac9-4514-8f45-cf3ff2ecb04f', 43, @ev_wedding, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-02 10:00:00', 1, 1, NULL, NULL, NULL),
  (130, '41a98a23-cb4b-46de-b0cc-ea3d64827879', 43, @ev_reception, 'waiting', NULL, NULL, NULL, '2026-10-02 12:00:00', 7, NULL, '2026-10-02 10:00:00', 1, 7, NULL, NULL, NULL),
  (131, '68a9840f-9379-4558-9ff9-85aecc4a52b9', 44, @ev_wedding, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-03 11:00:00', 7, 7, NULL, NULL, NULL),
  (132, '0bcc1d66-1d82-48ca-89bc-1bb419ff7e0b', 44, @ev_reception, 'waiting', NULL, NULL, NULL, '2026-10-07 10:00:00', 1, NULL, '2026-10-03 11:00:00', 7, 1, NULL, NULL, NULL),
  (133, 'f27b8960-c978-4640-bada-28b8dc4c1ab3', 45, @ev_wedding, 'not_coming', NULL, NULL, NULL, '2026-10-03 07:00:00', 1, NULL, '2026-10-04 12:00:00', 1, 1, NULL, NULL, NULL),
  (134, '76ede0f6-d837-403f-b466-317cc21dd5c4', 45, @ev_reception, 'waiting', NULL, NULL, NULL, '2026-10-06 06:00:00', 5, '2026-10-07 13:00:00', '2026-10-04 12:00:00', 1, 5, NULL, NULL, NULL),
  (135, '8c16e9e8-6c8e-4676-b7c0-8ea4019a2508', 46, @ev_wedding, 'coming', NULL, NULL, NULL, '2026-10-02 07:00:00', 2, NULL, '2026-10-05 13:00:00', 4, 2, NULL, NULL, NULL),
  (136, '344b7eb2-e33d-4b08-98a8-e992c5bf6fda', 46, @ev_reception, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-05 13:00:00', 4, 4, NULL, NULL, NULL),
  (137, '03dc8802-46c4-421f-bd22-f4cbc8378630', 47, @ev_wedding, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-06 14:00:00', 2, 2, NULL, NULL, NULL),
  (138, '2fffa2cc-3a3a-4aa8-af44-d60b768b07be', 47, @ev_reception, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-06 14:00:00', 2, 2, NULL, NULL, NULL),
  (139, '376a02ee-89c6-417c-9bd2-11a0e2af56e5', 48, @ev_wedding, 'coming', NULL, NULL, NULL, '2026-10-01 05:00:00', 5, NULL, '2026-10-07 03:00:00', 2, 5, NULL, NULL, NULL),
  (140, 'f9bd9b87-b7b3-4339-80dc-13f0eee3a065', 48, @ev_reception, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-07 03:00:00', 2, 2, NULL, NULL, NULL),
  (141, 'db4a45f2-234f-4ecd-b8aa-4ce9a6e5687d', 49, @ev_haldi, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-01 04:00:00', 4, 4, NULL, NULL, NULL),
  (142, '6b8e45cd-b23c-43ae-a94e-13ad447f0ccf', 49, @ev_mehndi, 'coming', NULL, NULL, NULL, '2026-10-01 10:00:00', 5, NULL, '2026-10-01 04:00:00', 4, 5, NULL, NULL, NULL),
  (143, '7ecde054-f859-4b50-8ea3-545cea6f37c4', 49, @ev_sangeet, 'waiting', NULL, NULL, NULL, '2026-10-06 08:00:00', 2, NULL, '2026-10-01 04:00:00', 4, 2, NULL, NULL, NULL),
  (144, '20c9143e-99a9-42c3-9b4c-1da61ab221ab', 49, @ev_wedding, 'waiting', NULL, NULL, NULL, '2026-10-03 09:00:00', 4, '2026-10-07 13:00:00', '2026-10-01 04:00:00', 4, 4, NULL, NULL, NULL),
  (145, '7e65101e-bf34-432b-a6fa-643677527e12', 49, @ev_reception, 'waiting', NULL, NULL, NULL, '2026-10-01 09:00:00', 3, NULL, '2026-10-01 04:00:00', 4, 3, NULL, NULL, NULL),
  (146, '12f6f281-dc0d-426e-a852-38805f92cf93', 50, @ev_wedding, 'waiting', NULL, NULL, NULL, '2026-10-04 08:00:00', 5, NULL, '2026-10-02 05:00:00', 3, 5, NULL, NULL, NULL),
  (147, '54616758-3e78-4a6f-9d55-2f1c1656fe29', 50, @ev_reception, 'waiting', NULL, NULL, NULL, '2026-10-04 08:00:00', 4, '2026-10-07 13:00:00', '2026-10-02 05:00:00', 3, 4, NULL, NULL, NULL),
  (148, '0d223427-47b3-4b77-ae20-c42c0b676515', 51, @ev_wedding, 'not_coming', NULL, NULL, NULL, '2026-10-03 15:00:00', 1, NULL, '2026-10-03 06:00:00', 4, 1, NULL, NULL, NULL),
  (149, '4814762d-16c7-4b1c-b419-46f488f3d254', 51, @ev_reception, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-03 06:00:00', 4, 4, NULL, NULL, NULL),
  (150, '43e9596d-3b56-464f-ae3b-c883fc6a7b4d', 52, @ev_wedding, 'waiting', NULL, NULL, NULL, '2026-10-03 07:00:00', 2, NULL, '2026-10-04 07:00:00', 2, 2, NULL, NULL, NULL),
  (151, '762b7c67-224f-44ff-b7fd-0cc146aca871', 52, @ev_reception, 'waiting', NULL, NULL, NULL, '2026-10-02 14:00:00', 1, '2026-10-07 13:00:00', '2026-10-04 07:00:00', 2, 1, NULL, NULL, NULL),
  (152, 'e7440383-98e5-4deb-85e5-d7c8898cf9bc', 53, @ev_wedding, 'not_coming', NULL, NULL, NULL, '2026-10-05 12:00:00', 7, NULL, '2026-10-05 08:00:00', 7, 7, NULL, NULL, NULL),
  (153, '19e34727-40d3-47e7-97ac-26270708a147', 53, @ev_reception, 'coming', NULL, NULL, NULL, '2026-10-01 09:00:00', 3, NULL, '2026-10-05 08:00:00', 7, 3, NULL, NULL, NULL),
  (154, '1766efb9-ab7c-4ed5-b105-8e760a919451', 54, @ev_wedding, 'waiting', NULL, NULL, NULL, '2026-10-01 12:00:00', 1, NULL, '2026-10-06 09:00:00', 3, 1, NULL, NULL, NULL),
  (155, 'fa81b942-5367-4106-9685-7de8f76991db', 54, @ev_reception, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-06 09:00:00', 3, 3, NULL, NULL, NULL),
  (156, '92debbb9-aa08-4add-b7da-4155064d4edc', 55, @ev_engagement, 'coming', NULL, NULL, NULL, '2026-10-06 15:00:00', 2, NULL, '2026-10-07 10:00:00', 2, 2, NULL, NULL, NULL),
  (157, '8ff1a3e4-43ad-466c-b47a-24c250a8342a', 55, @ev_haldi, 'waiting', NULL, NULL, NULL, '2026-10-01 11:00:00', 5, NULL, '2026-10-07 10:00:00', 2, 5, NULL, NULL, NULL),
  (158, '4b92c507-92ea-4118-890f-7235cf79eb82', 55, @ev_mehndi, 'coming', NULL, NULL, NULL, '2026-10-02 14:00:00', 7, NULL, '2026-10-07 10:00:00', 2, 7, NULL, NULL, NULL),
  (159, 'dc96366b-5651-48d3-be24-d66180c87564', 55, @ev_mayra, 'coming', NULL, NULL, NULL, '2026-10-03 07:00:00', 3, NULL, '2026-10-07 10:00:00', 2, 3, NULL, NULL, NULL),
  (160, '1788d13f-e448-4cff-9e76-409a051e6e13', 55, @ev_sangeet, 'waiting', NULL, NULL, NULL, '2026-10-04 07:00:00', 4, '2026-10-07 13:00:00', '2026-10-07 10:00:00', 2, 4, NULL, NULL, NULL),
  (161, 'c048b20c-bf14-4451-b8a1-fa6f975a3fd1', 55, @ev_wedding, 'not_coming', NULL, NULL, NULL, '2026-10-04 04:00:00', 5, NULL, '2026-10-07 10:00:00', 2, 5, NULL, NULL, NULL),
  (162, '5d53838c-b8f7-43d4-a093-b37d8b5f69d9', 55, @ev_reception, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-07 10:00:00', 2, 2, NULL, NULL, NULL),
  (163, 'ac76ea30-e9cd-4722-b47d-094caf33e795', 56, @ev_haldi, 'coming', NULL, NULL, NULL, '2026-10-07 06:00:00', 3, NULL, '2026-10-01 11:00:00', 7, 3, NULL, NULL, NULL),
  (164, '151e9cae-1758-4291-afbe-a9a6b6e0a1b6', 56, @ev_mehndi, 'coming', NULL, NULL, NULL, '2026-10-05 09:00:00', 4, NULL, '2026-10-01 11:00:00', 7, 4, NULL, NULL, NULL),
  (165, 'f7222749-c4e1-46d1-bf88-d121c5577c42', 56, @ev_sangeet, 'waiting', NULL, NULL, NULL, '2026-10-02 15:00:00', 1, NULL, '2026-10-01 11:00:00', 7, 1, NULL, NULL, NULL),
  (166, 'ca5fba87-9e4a-4b60-9851-8357d90ec8e3', 56, @ev_wedding, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-01 11:00:00', 7, 7, NULL, NULL, NULL),
  (167, 'f903ba99-2b3a-4345-9f98-53ce033ff5ce', 56, @ev_reception, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-01 11:00:00', 7, 7, NULL, NULL, NULL),
  (168, '54d75765-05d5-4d7b-82a1-ee9fc98f5b81', 57, @ev_wedding, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-02 12:00:00', 5, 5, NULL, NULL, NULL),
  (169, '4f4baf55-071e-4e3f-8cc1-40a0352119d1', 57, @ev_reception, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-02 12:00:00', 5, 5, NULL, NULL, NULL),
  (170, '54f6f9d4-77da-4cc3-982f-ed375c0ae9d4', 58, @ev_wedding, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-03 13:00:00', 7, 7, NULL, NULL, NULL),
  (171, '97d6aac3-6cb4-4a8f-a6df-314833c52973', 58, @ev_reception, 'waiting', NULL, NULL, NULL, '2026-10-06 06:00:00', 7, NULL, '2026-10-03 13:00:00', 7, 7, NULL, NULL, NULL),
  (172, '40bd7ef0-1613-4707-87d0-e3bab81eafad', 59, @ev_wedding, 'coming', NULL, NULL, NULL, '2026-10-01 07:00:00', 2, NULL, '2026-10-04 14:00:00', 4, 2, NULL, NULL, NULL),
  (173, 'f007e80b-f9e1-4e78-aa91-eb9af1973727', 59, @ev_reception, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-04 14:00:00', 4, 4, NULL, NULL, NULL),
  (174, '4960c7d1-f35c-4305-a4a5-76fdd8fcbcab', 60, @ev_engagement, 'not_coming', NULL, NULL, NULL, '2026-10-04 06:00:00', 1, NULL, '2026-10-05 03:00:00', 5, 1, NULL, NULL, NULL),
  (175, 'a92f743e-44a3-44b3-a5f9-b4cd76bdd212', 60, @ev_haldi, 'coming', NULL, NULL, 'Arriving late, after 9 PM', '2026-10-07 07:00:00', 1, NULL, '2026-10-05 03:00:00', 5, 1, NULL, NULL, NULL),
  (176, '7f547b0d-8ed3-408e-9dfe-1e281f67da1d', 60, @ev_mehndi, 'coming', NULL, NULL, NULL, '2026-10-01 08:00:00', 2, NULL, '2026-10-05 03:00:00', 5, 2, NULL, NULL, NULL),
  (177, '516373a6-1e4f-4d70-b26d-42009e4e25f7', 60, @ev_mayra, 'coming', NULL, NULL, 'Arriving late, after 9 PM', '2026-10-06 07:00:00', 1, NULL, '2026-10-05 03:00:00', 5, 1, NULL, NULL, NULL),
  (178, '10081a8b-c275-45b1-b546-10c1ea59b534', 60, @ev_sangeet, 'waiting', NULL, NULL, NULL, '2026-10-03 13:00:00', 5, '2026-10-07 13:00:00', '2026-10-05 03:00:00', 5, 5, NULL, NULL, NULL),
  (179, 'def53ed2-dd72-4a51-8373-3e5223ba30a7', 60, @ev_wedding, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-05 03:00:00', 5, 5, NULL, NULL, NULL),
  (180, '114a4050-8021-4508-a78a-18aba2a9175c', 60, @ev_reception, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-05 03:00:00', 5, 5, NULL, NULL, NULL),
  (181, '19e96741-5e8d-44c8-9212-56427d7a5cf2', 61, @ev_wedding, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-01 09:00:00', 3, 3, '2026-10-02 12:10:00', 3, 2),
  (182, '7159142b-63e7-4e2f-834c-196bab625541', 61, @ev_reception, 'not_asked', NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-01 09:00:00', 3, 3, '2026-10-02 12:10:00', 3, 2);

-- 9. Payments and expenses (vendor NULL = Expense). Includes a pay-part pair and one deleted duplicate.
INSERT INTO payments (id, public_id, client_uuid, title, vendor_id, category_id, event_id, amount_paise, status, due_date, paid_on, method, paid_by, reference, notes, split_from_payment_id, created_at, created_by, updated_by, deleted_at, deleted_by, delete_batch_id) VALUES
  (1, '01M1DJ24D84CMHBGWMDSK5A1YR', '485c3c3a-8d9f-466f-957e-9805a80cb3b7', 'Tent advance', 1, @cat3, NULL, 5000000, 'paid', NULL, '2026-09-12', 'cash', 'Papa', NULL, 'Receipt pending from Rajesh ji', NULL, '2026-09-12 10:00:00', 4, 4, NULL, NULL, NULL),
  (2, '01M1DJ25CGGNCVS0Q3CVNZJPYY', '1f57a4de-928d-48b4-9656-d15227b2fe11', 'Tent – second instalment', 1, @cat3, NULL, 10000000, 'due', '2026-10-06', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-12 10:00:00', 4, 4, NULL, NULL, NULL),
  (3, '01M1DJ26BRP4A7ENA5VH66PSFR', 'd283aefd-53c8-4b11-8205-1bf16a7a56b9', 'Tent – final', 1, @cat3, NULL, 20000000, 'due', '2027-02-10', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-12 10:00:00', 4, 4, NULL, NULL, NULL),
  (4, '01M1DJ27B08T3PT9RY8J2WPBE3', 'd87203d2-a428-4191-9f0b-3d8daf1403a1', 'Halwai advance', 2, @cat2, NULL, 20000000, 'paid', NULL, '2026-09-18', 'bank', 'Ayush', 'NEFT N26091812345', NULL, NULL, '2026-09-18 10:00:00', 1, 1, NULL, NULL, NULL),
  (5, '01M1DJ28A84N59VNGSS6TQ1ZQF', '27427d4e-e459-4ced-87e7-4cf98f50b335', 'Halwai – booking confirm', 2, @cat2, NULL, 30000000, 'due', '2026-10-12', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-18 10:00:00', 1, 1, NULL, NULL, NULL),
  (6, '01M1DJ299G8KGES31B8M7Y89SJ', '350d7120-c8af-4a06-ae92-5ffdc3e4868f', 'Halwai – final', 2, @cat2, NULL, 60000000, 'due', '2027-02-12', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-18 10:00:00', 1, 1, NULL, NULL, NULL),
  (7, '01M1DJ2A8RQHQF9CWMBTC29NKV', '21802fae-4434-441e-8fe7-4470f9923321', 'Photographer advance', 3, @cat4, NULL, 7500000, 'paid', NULL, '2026-09-22', 'upi', 'Mahi', 'UPI 6281', NULL, NULL, '2026-09-22 10:00:00', 2, 2, NULL, NULL, NULL),
  (8, '01M1DJ2B80AAXJBFBMQ9GHTP0J', '40a89168-3042-4063-9b6d-02a04de7e962', 'Photographer – pre-wedding shoot', 3, @cat4, NULL, 7500000, 'due', '2026-10-15', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-22 10:00:00', 2, 2, NULL, NULL, NULL),
  (9, '01M1DJ2C781T4QVVQTAG719CJS', '17219c01-3197-4981-b8ec-d628a2990d08', 'Makeup booking', 4, @cat8, NULL, 2500000, 'paid', NULL, '2026-09-28', 'upi', 'Mahi', NULL, NULL, NULL, '2026-09-28 10:00:00', 2, 2, NULL, NULL, NULL),
  (10, '01M1DJ2D6GAVMYEGZCG4ASXTDR', 'b275c062-237b-4478-87d1-bf13d304eb35', 'Mehndi artist advance', 5, @cat8, @ev_mehndi, 500000, 'due', '2026-10-10', NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-01 10:00:00', 2, 2, NULL, NULL, NULL),
  (11, '01M1DJ2E5RZ916CDMP5W6A6965', '9950533a-d138-4781-befd-6b57524f8b6c', 'Venue booking', 8, @cat1, NULL, 35000000, 'due', '2026-11-30', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-05 10:00:00', 1, 1, NULL, NULL, NULL),
  (12, '01M1DJ2F50ZGV1HCD0KNYS7DBY', 'bac19594-1569-40e2-ba23-f2cf4dc72336', 'Venue booking (part)', 8, @cat1, NULL, 20000000, 'paid', NULL, '2026-10-01', 'cheque', 'Papa', 'Cheque 004512', NULL, 11, '2026-10-01 10:00:00', 1, 1, NULL, NULL, NULL),
  (13, '01M1DJ2G48864P47SQ3SJSME93', 'bde26f0b-95a4-41fa-9d88-d80cd565f868', 'Pandit ji dakshina (advance)', 7, @cat12, NULL, 1100000, 'paid', NULL, '2026-09-30', 'cash', 'Mummy', NULL, NULL, NULL, '2026-09-30 10:00:00', 3, 3, NULL, NULL, NULL),
  (14, '01M1DJ2H3GS21E2AA85F498945', '1bc39cf6-380e-444f-b898-eb72695a30fe', 'Invitation cards – advance', 9, @cat7, NULL, 3000000, 'paid', NULL, '2026-09-25', 'upi', 'Ayush', NULL, NULL, NULL, '2026-09-25 10:00:00', 1, 1, NULL, NULL, NULL),
  (15, '01M1DJ2J2RB86XJF9690NSNEP5', '20ee0c21-598d-4a86-abd6-a37cbb632282', 'Invitation cards – balance', 9, @cat7, NULL, 4000000, 'due', '2026-10-08', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-25 10:00:00', 1, 1, NULL, NULL, NULL),
  (16, '01M1DJ2K202AGP5ECNR7W150EP', 'd9b90c50-104d-43fa-b400-b7273c76d8b5', 'Band booking token', 6, @cat9, NULL, 1000000, 'due', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-03 10:00:00', 1, 1, NULL, NULL, NULL),
  (17, '01M1DJ2M18BTZ6SHEDP1EYM9GZ', 'bbfcaffd-6f9a-4e1f-bc13-329a8d7b0d54', 'Sherwani fabric', NULL, @cat5, NULL, 4250000, 'paid', NULL, '2026-10-04', 'card', 'Ayush', NULL, NULL, NULL, '2026-10-04 10:00:00', 1, 1, NULL, NULL, NULL),
  (18, '01M1DJ2N0G6EBEHAYGBZ6J5A4F', '389d08cb-b2fc-4ed1-8055-a991bb99a740', 'Mithai samples for tasting', NULL, @cat2, NULL, 185000, 'paid', NULL, '2026-10-05', 'cash', 'Mummy', NULL, NULL, NULL, '2026-10-05 10:00:00', 3, 3, NULL, NULL, NULL),
  (19, '01M1DJ2NZRJR7CGSQTMNQ44TQK', 'b9129251-9aaa-4a50-a2f0-6d3e943fd6f8', 'Bridal lehenga advance', NULL, @cat5, NULL, 6000000, 'paid', NULL, '2026-10-03', 'upi', 'Kavita ji', NULL, NULL, NULL, '2026-10-03 10:00:00', 2, 2, NULL, NULL, NULL),
  (20, '01M1DJ2PZ051P51EHH35Y413GH', 'ecdd8418-2ff5-44f9-af40-fc902c8aef06', 'Gold set – booking', NULL, @cat6, NULL, 10000000, 'paid', NULL, '2026-09-29', 'bank', 'Papa', NULL, NULL, NULL, '2026-09-29 10:00:00', 4, 4, NULL, NULL, NULL),
  (21, '01M1DJ2QY8EF5C9WMAMHP4PXWY', 'd150c261-5b51-4789-9728-f641e5040af6', 'Printer advance (duplicate)', 9, @cat7, NULL, 3000000, 'paid', NULL, '2026-09-25', 'upi', 'Ayush', NULL, NULL, NULL, '2026-09-25 10:00:00', 2, 2, '2026-10-06 08:15:00', 2, 4);

-- 10. Tasks, assignees, tags, checklist. Task 21 is deleted (batch 3) with its checklist.
INSERT INTO tasks (id, public_id, client_uuid, title, notes, status, priority, due_date, due_time, event_id, vendor_id, household_id, completed_at, completed_by, postpone_count, created_at, created_by, updated_by, deleted_at, deleted_by, delete_batch_id) VALUES
  (1, '01M1DJ2RXGJYP1H4B1W6HSSQNN', 'b7ce68e4-0934-4bb5-b6a1-a1c8d1052784', 'Pay tent second instalment', 'Rajesh ji will collect cash at home.', 'todo', 'urgent', '2026-10-06', NULL, NULL, 1, NULL, NULL, NULL, 1, '2026-09-25 10:00:00', 4, 4, NULL, NULL, NULL),
  (2, '01M1DJ2SWR08JDNNQSCZ1F42JV', '083a040b-96c2-4f96-aca1-24504b85c2f2', 'Finalise guest list – Groom side', NULL, 'doing', 'urgent', '2026-10-05', NULL, NULL, NULL, NULL, NULL, NULL, 2, '2026-09-25 10:00:00', 1, 1, NULL, NULL, NULL),
  (3, '01M1DJ2TW0VPJKR953YH2RWFE3', 'e7a016b6-5908-4020-8240-d36dd065db08', 'Confirm menu tasting date with halwai', NULL, 'waiting', 'normal', '2026-10-07', NULL, NULL, 2, NULL, NULL, NULL, 0, '2026-09-25 10:00:00', 1, 1, NULL, NULL, NULL),
  (4, '01M1DJ2VV8HB2VDTAMHRQ1CD6B', 'efef581a-867e-4de7-b148-578846baca1f', 'Send Engagement invites on WhatsApp', NULL, 'todo', 'urgent', '2026-10-08', NULL, @ev_engagement, NULL, NULL, NULL, NULL, 0, '2026-09-25 10:00:00', 2, 2, NULL, NULL, NULL),
  (5, '01M1DJ2WTGMJ080SRAF8SDWN60', '027a3d41-bfa1-44bf-9bde-54db954e981c', 'Call Mama ji about Mayra arrangements', NULL, 'todo', 'normal', '2026-10-08', '18:00', @ev_mayra, NULL, 6, NULL, NULL, 0, '2026-09-25 10:00:00', 3, 3, NULL, NULL, NULL),
  (6, '01M1DJ2XSR8M5C7H1RGHK78S3S', '512bc70a-dfe8-40d7-8b17-c1c22ff88962', 'Collect shagun envelopes from bank', NULL, 'todo', 'low', '2026-10-08', '11:00', NULL, NULL, NULL, NULL, NULL, 0, '2026-09-25 10:00:00', 1, 1, NULL, NULL, NULL),
  (7, '01M1DJ2YS0KGKJG6HQFZE8D33D', '36ff7d35-916c-41c2-8014-f16962b01011', 'Book Mehndi artist for 14 Feb', NULL, 'done', 'normal', '2026-10-03', NULL, @ev_mehndi, 5, NULL, '2026-10-06 11:00:00', 2, 0, '2026-09-25 10:00:00', 2, 2, NULL, NULL, NULL),
  (8, '01M1DJ2ZR8E31QRDG9FTYV4GCQ', 'a7064916-a40b-4267-9bfd-c87a8be61f23', 'Choose sangeet songs list', NULL, 'doing', 'normal', '2026-10-11', NULL, @ev_sangeet, NULL, NULL, NULL, NULL, 0, '2026-09-25 10:00:00', 2, 2, NULL, NULL, NULL),
  (9, '01M1DJ30QG0PZCDW795W4KV222', '805870a4-97c3-49e9-8020-0d45bb5b4701', 'Lehenga trial at boutique', NULL, 'todo', 'normal', '2026-10-10', NULL, NULL, NULL, NULL, NULL, NULL, 0, '2026-09-25 10:00:00', 2, 2, NULL, NULL, NULL),
  (10, '01M1DJ31PRK4NHR0F9W0RTFWDT', 'fb790374-025f-4157-ac78-60a6ca8871c1', 'Sherwani fitting', NULL, 'todo', 'normal', '2026-10-13', NULL, NULL, NULL, NULL, NULL, NULL, 0, '2026-09-25 10:00:00', 1, 1, NULL, NULL, NULL),
  (11, '01M1DJ32P009SGWP91AK3X678K', '9a36b114-78ae-452e-996e-5a3138797ae9', 'Buy return gifts for Mayra', NULL, 'todo', 'normal', '2026-10-20', NULL, @ev_mayra, NULL, NULL, NULL, NULL, 0, '2026-09-25 10:00:00', 3, 3, NULL, NULL, NULL),
  (12, '01M1DJ33N8CFSCHNMRTX07XMC7', '186df309-d740-461f-820a-57d2f790a5e7', 'Get quotes for flower decor', NULL, 'waiting', 'low', '2026-10-14', NULL, NULL, 11, NULL, NULL, NULL, 0, '2026-09-25 10:00:00', 1, 1, NULL, NULL, NULL),
  (13, '01M1DJ34MGHNYM63R3Y85JH8QD', '5fec0c66-e7c9-4f47-965d-e6f8df0ad8c7', 'Hotel rooms for Udaipur & Mumbai guests', NULL, 'todo', 'normal', '2026-11-01', NULL, NULL, NULL, NULL, NULL, NULL, 0, '2026-09-25 10:00:00', 1, 1, NULL, NULL, NULL),
  (14, '01M1DJ35KRYZN876476291Q04T', 'c975ecd7-0a1b-4fb3-9ff8-06db74c02a4f', 'Print guest list for caterer headcount', NULL, 'todo', 'low', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, '2026-09-25 10:00:00', 1, 1, NULL, NULL, NULL),
  (15, '01M1DJ36K0KVEPFDKFC822NADS', 'e3b504a2-ea7a-44cd-8523-db327b4048a5', 'Order kalash and puja samagri', NULL, 'todo', 'normal', '2027-02-05', NULL, 101, 7, NULL, NULL, NULL, 0, '2026-09-25 10:00:00', 3, 3, NULL, NULL, NULL),
  (16, '01M1DJ37J8ADF1JBJPDZXJ3RG9', '5f39000f-24f2-4f94-83eb-5c50ba43c5f6', 'Decide jewelry for reception', NULL, 'todo', 'normal', NULL, NULL, @ev_reception, NULL, NULL, NULL, NULL, 0, '2026-09-25 10:00:00', 2, 2, NULL, NULL, NULL),
  (17, '01M1DJ38HGH32N211FKDRDCXKE', '9cc67777-852f-42b7-8d8e-fd1e3a957791', 'Pre-wedding shoot location', NULL, 'done', 'normal', '2026-09-30', NULL, NULL, 3, NULL, '2026-10-07 11:00:00', 1, 0, '2026-09-25 10:00:00', 1, 1, NULL, NULL, NULL),
  (18, '01M1DJ39GR0KEDEGBKVPNC632H', 'df6c26eb-0982-4e69-8d9d-2a95f1ceb907', 'Ask band for sound check time', NULL, 'cancelled', 'low', '2026-10-02', NULL, NULL, 6, NULL, NULL, NULL, 0, '2026-09-25 10:00:00', 1, 1, NULL, NULL, NULL),
  (19, '01M1DJ3AG019D55X39PYB9PA6R', '1dbd9ee8-cf58-4eda-bd49-9178d1852a2c', 'Card distribution list by area', NULL, 'todo', 'normal', '2026-10-25', NULL, NULL, NULL, NULL, NULL, NULL, 0, '2026-09-25 10:00:00', 4, 4, NULL, NULL, NULL),
  (20, '01M1DJ3BF8F60JBMX6FV838MBD', '1bde6849-65d3-40fa-b675-0de45e2749d4', 'Arrange wheelchair for Nana ji', NULL, 'todo', 'urgent', '2027-02-13', NULL, NULL, NULL, 31, NULL, NULL, 0, '2026-09-25 10:00:00', 5, 5, NULL, NULL, NULL),
  (21, '01M1DJ3CEG8MN0Y7T1Z0XC50KF', 'e4dc8572-9c2f-4224-a6db-30e1910d3989', 'Book tent wala (old)', NULL, 'todo', 'normal', '2026-09-30', NULL, NULL, 1, NULL, NULL, NULL, 0, '2026-09-25 10:00:00', 4, 4, '2026-10-05 13:40:00', 4, 3);

INSERT INTO task_assignees (task_id, user_id, created_at, created_by, deleted_at, deleted_by, delete_batch_id) VALUES
  (1, 4, '2026-09-25 10:00:00', 4, NULL, NULL, NULL),
  (2, 1, '2026-09-25 10:00:00', 1, NULL, NULL, NULL),
  (2, 3, '2026-09-25 10:00:00', 1, NULL, NULL, NULL),
  (3, 3, '2026-09-25 10:00:00', 1, NULL, NULL, NULL),
  (4, 2, '2026-09-25 10:00:00', 2, NULL, NULL, NULL),
  (5, 3, '2026-09-25 10:00:00', 3, NULL, NULL, NULL),
  (6, 4, '2026-09-25 10:00:00', 1, NULL, NULL, NULL),
  (7, 2, '2026-09-25 10:00:00', 2, NULL, NULL, NULL),
  (8, 2, '2026-09-25 10:00:00', 2, NULL, NULL, NULL),
  (8, 8, '2026-09-25 10:00:00', 2, NULL, NULL, NULL),
  (9, 2, '2026-09-25 10:00:00', 2, NULL, NULL, NULL),
  (9, 5, '2026-09-25 10:00:00', 2, NULL, NULL, NULL),
  (10, 1, '2026-09-25 10:00:00', 1, NULL, NULL, NULL),
  (11, 3, '2026-09-25 10:00:00', 3, NULL, NULL, NULL),
  (11, 4, '2026-09-25 10:00:00', 3, NULL, NULL, NULL),
  (12, 7, '2026-09-25 10:00:00', 1, NULL, NULL, NULL),
  (13, 1, '2026-09-25 10:00:00', 1, NULL, NULL, NULL),
  (13, 7, '2026-09-25 10:00:00', 1, NULL, NULL, NULL),
  (14, 1, '2026-09-25 10:00:00', 1, NULL, NULL, NULL),
  (15, 3, '2026-09-25 10:00:00', 3, NULL, NULL, NULL),
  (16, 2, '2026-09-25 10:00:00', 2, NULL, NULL, NULL),
  (16, 5, '2026-09-25 10:00:00', 2, NULL, NULL, NULL),
  (17, 1, '2026-09-25 10:00:00', 1, NULL, NULL, NULL),
  (17, 2, '2026-09-25 10:00:00', 1, NULL, NULL, NULL),
  (18, 8, '2026-09-25 10:00:00', 1, NULL, NULL, NULL),
  (19, 4, '2026-09-25 10:00:00', 4, NULL, NULL, NULL),
  (19, 8, '2026-09-25 10:00:00', 4, NULL, NULL, NULL),
  (20, 5, '2026-09-25 10:00:00', 5, NULL, NULL, NULL),
  (21, 4, '2026-09-25 10:00:00', 4, '2026-10-05 13:40:00', 4, 3);

INSERT INTO task_tags (task_id, tag_id, created_at, created_by) VALUES
  (3, (SELECT id FROM tags WHERE name = 'Food' AND deleted_at IS NULL), '2026-09-25 10:00:00', 1),
  (6, (SELECT id FROM tags WHERE name = 'Gifts' AND deleted_at IS NULL), '2026-09-25 10:00:00', 1),
  (8, (SELECT id FROM tags WHERE name = 'Bride' AND deleted_at IS NULL), '2026-09-25 10:00:00', 2),
  (9, (SELECT id FROM tags WHERE name = 'Outfit' AND deleted_at IS NULL), '2026-09-25 10:00:00', 2),
  (9, (SELECT id FROM tags WHERE name = 'Bride' AND deleted_at IS NULL), '2026-09-25 10:00:00', 2),
  (10, (SELECT id FROM tags WHERE name = 'Outfit' AND deleted_at IS NULL), '2026-09-25 10:00:00', 1),
  (10, (SELECT id FROM tags WHERE name = 'Groom' AND deleted_at IS NULL), '2026-09-25 10:00:00', 1),
  (11, (SELECT id FROM tags WHERE name = 'Shopping' AND deleted_at IS NULL), '2026-09-25 10:00:00', 3),
  (11, (SELECT id FROM tags WHERE name = 'Gifts' AND deleted_at IS NULL), '2026-09-25 10:00:00', 3),
  (12, (SELECT id FROM tags WHERE name = 'Decor' AND deleted_at IS NULL), '2026-09-25 10:00:00', 1),
  (13, (SELECT id FROM tags WHERE name = 'Travel' AND deleted_at IS NULL), '2026-09-25 10:00:00', 1),
  (15, (SELECT id FROM tags WHERE name = 'Shopping' AND deleted_at IS NULL), '2026-09-25 10:00:00', 3),
  (16, (SELECT id FROM tags WHERE name = 'Jewelry' AND deleted_at IS NULL), '2026-09-25 10:00:00', 2),
  (16, (SELECT id FROM tags WHERE name = 'Bride' AND deleted_at IS NULL), '2026-09-25 10:00:00', 2);

INSERT INTO task_items (client_uuid, task_id, text, is_done, done_at, done_by, sort_order, created_at, created_by, updated_by, deleted_at, deleted_by, delete_batch_id) VALUES
  ('49aa4a18-73ce-4e35-9fb6-19e1530df3d5', 8, 'Couple dance song', 1, '2026-10-06 10:00:00', 2, 10, '2026-09-25 10:00:00', 2, 2, NULL, NULL, NULL),
  ('c8636cc1-2b74-48fb-98ef-e4966ff2e07b', 8, 'Family medley', 0, NULL, NULL, 20, '2026-09-25 10:00:00', 2, 2, NULL, NULL, NULL),
  ('646d0122-c18b-4eea-9ecb-0e21094b37fd', 8, 'Entry song', 0, NULL, NULL, 30, '2026-09-25 10:00:00', 2, 2, NULL, NULL, NULL),
  ('f9362434-a60a-42ad-8ff0-bbead4cdbb96', 11, 'Silver coins × 50', 0, NULL, NULL, 10, '2026-09-25 10:00:00', 3, 3, NULL, NULL, NULL),
  ('9701025e-174c-49e6-8032-44e848f4fe92', 11, 'Dry fruit boxes × 40', 0, NULL, NULL, 20, '2026-09-25 10:00:00', 3, 3, NULL, NULL, NULL),
  ('33bf84b1-5ceb-4ba3-b2e2-89d7ba294cff', 11, 'Saree for Mami ji', 1, '2026-10-06 10:00:00', 3, 30, '2026-09-25 10:00:00', 3, 3, NULL, NULL, NULL),
  ('db9f1c14-f9c9-4cba-971f-11cc1c668836', 21, 'Ask for 2 quotes', 0, NULL, NULL, 10, '2026-09-25 10:00:00', 4, 4, '2026-10-05 13:40:00', 4, 3),
  ('f29e88ed-41fc-4b41-b101-0a45f02c569a', 21, 'Visit godown', 0, NULL, NULL, 20, '2026-09-25 10:00:00', 4, 4, '2026-10-05 13:40:00', 4, 3);

-- 11. Files (metadata only — DEV: these paths do not exist on disk) and documents
INSERT INTO files (id, public_id, storage_path, original_name, mime_type, size_bytes, sha256, width_px, height_px, created_at, created_by) VALUES
  (1, '01M1DJ3DDRJ1K3A4GTYY6Z80HW', 'uploads/2026/09/15cf903f-b761-4c64-b17a-443034f88124.jpg', 'IMG_4821.jpg', 'image/jpeg', 412233, '0726f23a909dee247010688e248d077bc4028bc9888f93879df59b0d283a6e32', 1600, 1200, '2026-09-21 10:00:00', 4),
  (2, '01M1DJ3FC83XNCA5R5MRTF56WG', 'uploads/2026/09/11ddda9e-6f99-444b-a82e-b3e46e7b6c6d.pdf', 'Venue agreement signed.pdf', 'application/pdf', 1823344, '8eebaaf633f251b60663222452c708b2c525adcedde89c4488b9d518a9da50e7', NULL, NULL, '2026-09-22 10:00:00', 1),
  (3, '01M1DJ3HAR926Z5XJ869EC7REM', 'uploads/2026/09/f8649057-9115-4cf9-ba2f-2c805d1d4ef8.pdf', 'Annapurna menu & rates.pdf', 'application/pdf', 522118, 'a5ea68ec48913debb3f44378116bee1e5bfb9d9b4b28023602d34507e8403725', NULL, NULL, '2026-09-23 10:00:00', 1),
  (4, '01M1DJ3K98FK7D70H5GZJZ7JFK', 'uploads/2026/10/d9129a3e-690f-4965-a2fb-c4c722d9d018.png', 'Screenshot_20260918.png', 'image/png', 233410, '26a0527430e4dd3d909da9b56ffb44c7163f79bd5abaa1de77a80f2137bef1fa', 1080, 2340, '2026-09-24 10:00:00', 1),
  (5, '01M1DJ3N7RX85SYWNCTC38T0R9', 'uploads/2026/10/2d925a42-a5c8-4107-aff4-84c22001a4c0.jpg', 'aadhaar_front.jpg', 'image/jpeg', 301277, 'cd37c418737a588c55cd0ab842a2bff6a90eda40009bf54446b006d316af2ecf', 1600, 1010, '2026-09-25 10:00:00', 2),
  (6, '01M1DJ3Q68XBHYXGG7AZ47Q3Q2', 'uploads/2026/10/09edd915-f802-45a4-84a6-24c0a19e7f46.jpg', 'IMG_4900.jpg', 'image/jpeg', 190002, '68e5e63674b3ed57814a850bc052b02ec8fcc0dc85363bdd44c71b4315520249', 1200, 1600, '2026-09-26 10:00:00', 2);

INSERT INTO documents (id, public_id, client_uuid, title, type, file_id, payment_id, vendor_id, event_id, is_private, notes, created_at, created_by, updated_by, deleted_at, deleted_by, delete_batch_id) VALUES
  (1, '01M1DJ3ED0XMBP36521YRFEZ49', '1d3aaa17-2f64-4975-b365-51970dc8a5cd', 'Receipt – Shree Tent House – 12 Sep 2026', 'receipt', 1, 1, 1, NULL, 0, NULL, '2026-09-21 10:00:00', 4, 4, NULL, NULL, NULL),
  (2, '01M1DJ3GBGHP011CZMP3392ZH8', 'a8e31d2c-9a29-4679-985e-f6b0bf18108e', 'Contract – Shree Palace Garden', 'contract', 2, NULL, 8, @ev_wedding, 0, NULL, '2026-09-22 10:00:00', 1, 1, NULL, NULL, NULL),
  (3, '01M1DJ3JA05HD2T7N3N6ZYY3WX', 'ee1f268e-79b9-4bd9-89e7-501db5df423f', 'Quotation – Annapurna Caterers', 'quotation', 3, NULL, 2, NULL, 0, NULL, '2026-09-23 10:00:00', 1, 1, NULL, NULL, NULL),
  (4, '01M1DJ3M8GAJAQNYB4Q74H9DYZ', '1028837d-6418-4ad2-bc22-4a4dab7b8dbc', 'Receipt – Halwai advance NEFT', 'receipt', 4, 4, 2, NULL, 0, NULL, '2026-09-24 10:00:00', 1, 1, NULL, NULL, NULL),
  (5, '01M1DJ3P70FJV8WJSS920DKQ7V', 'fb2fa42a-b579-4a31-aa5c-90f7014ec78d', 'Aadhaar – Mahi (for marriage registration)', 'id', 5, NULL, NULL, NULL, 1, NULL, '2026-09-25 10:00:00', 2, 2, NULL, NULL, NULL),
  (6, '01M1DJ3R5GYTTHYH9F3ZGQZARG', 'de9b86f1-88c6-4482-985c-a0bbf20d3567', 'Receipt – Printer advance (duplicate)', 'receipt', 6, 21, 9, NULL, 0, NULL, '2026-09-26 10:00:00', 2, 2, '2026-10-06 08:15:00', 2, 4);

-- 12. A few audit rows so History and Activity screens have content
INSERT INTO audit_log (created_at, user_id, action, entity_type, entity_id, entity_version, batch_id, before_json, after_json, ip, device, note) VALUES
  ('2026-09-20 06:00:00', 1, 'import',  'import',    1, 1, 1, NULL, '{"created":40,"skipped":3,"errors":1}', '103.21.58.10', 'Android · installed', 'Imported 40 families'),
  ('2026-10-02 12:10:00', 3, 'delete',  'household', 61, 2, 2, '{"name":"Gupta family","deleted_at":null}', '{"name":"Gupta family","deleted_at":"2026-10-02 12:10:00"}', '103.21.58.11', 'iPhone · installed', NULL),
  ('2026-10-05 13:40:00', 4, 'delete',  'task',      21, 2, 3, '{"title":"Book tent wala (old)","deleted_at":null}', '{"title":"Book tent wala (old)","deleted_at":"2026-10-05 13:40:00"}', '103.21.58.12', 'Android · Chrome', NULL),
  ('2026-10-06 08:15:00', 2, 'delete',  'payment',   21, 2, 4, '{"title":"Printer advance (duplicate)","deleted_at":null}', '{"title":"Printer advance (duplicate)","deleted_at":"2026-10-06 08:15:00"}', '103.21.58.13', 'iPhone · installed', NULL),
  ('2026-10-07 04:30:00', 4, 'update',  'task',      1, 2, NULL, '{"due_date":"2026-10-01","postpone_count":0}', '{"due_date":"2026-10-06","postpone_count":1}', '103.21.58.12', 'Android · Chrome', 'Postponed from 1 Oct to 6 Oct'),
  ('2026-10-07 13:00:00', 3, 'whatsapp_opened', 'household', 6, NULL, NULL, NULL, NULL, '103.21.58.11', 'iPhone · installed', 'RSVP reminder for Mayra'),
  ('2026-10-08 03:15:00', 1, 'login',   'user',      1, NULL, NULL, NULL, NULL, '103.21.58.10', 'Android · installed', NULL);
UPDATE tasks SET version = 2 WHERE id = 1;
UPDATE households SET version = 2 WHERE id = 61;
UPDATE tasks SET version = 2 WHERE id = 21;
UPDATE payments SET version = 2 WHERE id = 21;

-- 13. Safety: 7 nightly backups (one failed), one restore drill, one expired export
INSERT INTO backup_runs (id, kind, status, started_at, finished_at, file_name, size_bytes, sha256, destination, row_counts_json, audit_row_count, audit_max_id, error) VALUES
  (1, 'nightly_db', 'ok', '2026-10-01 20:30:00', '2026-10-01 20:31:10', 'wedding_20261002_0200.sql.gz.enc', 1800000, 'db3ee3f5920b85b88e60fa211246bd8c8839e9f7d0be42f4350a7ecd0475be33', 'gdrive:AM-Wedding-Backups', NULL, 2, 2, NULL),
  (2, 'nightly_db', 'ok', '2026-10-02 20:30:00', '2026-10-02 20:31:11', 'wedding_20261003_0200.sql.gz.enc', 1835000, '4d22966c7283fba3969787b65ecdcd09e13413817c9f5c22b568180a00542c2f', 'gdrive:AM-Wedding-Backups', NULL, 3, 3, NULL),
  (3, 'nightly_db', 'ok', '2026-10-03 20:30:00', '2026-10-03 20:31:12', 'wedding_20261004_0200.sql.gz.enc', 1870000, '6e398591b1b2f2e005ec9ee1822b110f936970627785bcf125ff5ad3490ae430', 'gdrive:AM-Wedding-Backups', NULL, 4, 4, NULL),
  (4, 'nightly_db', 'failed', '2026-10-04 20:30:00', '2026-10-04 20:31:13', NULL, NULL, NULL, 'gdrive:AM-Wedding-Backups', NULL, NULL, NULL, 'Upload timed out after 60 s'),
  (5, 'nightly_db', 'ok', '2026-10-05 20:30:00', '2026-10-05 20:31:14', 'wedding_20261006_0200.sql.gz.enc', 1940000, 'e23e304af10efabaa4949b41841d82c0fa9ee0eaec21687d48d3e353906ce71d', 'gdrive:AM-Wedding-Backups', NULL, 6, 6, NULL),
  (6, 'nightly_db', 'ok', '2026-10-06 20:30:00', '2026-10-06 20:31:15', 'wedding_20261007_0200.sql.gz.enc', 1975000, 'a2cdfea84e55d7d6d3d10030e3c7b66afa9aa570447a98d83c029762ff9ebfb2', 'gdrive:AM-Wedding-Backups', NULL, 7, 7, NULL),
  (7, 'nightly_db', 'ok', '2026-10-07 20:30:00', '2026-10-07 20:31:16', 'wedding_20261008_0200.sql.gz.enc', 2010000, '8993742fb7ff43aba8f27ed120c512f2f138fa5dadf82e1f2769ec773ebf7cc6', 'gdrive:AM-Wedding-Backups', NULL, 8, 8, NULL);

INSERT INTO restore_drills (public_id, client_uuid, done_on, done_by, result, backup_run_id, backup_file, notes, created_at, created_by, updated_by) VALUES
  ('01M1DJ3S4RVCXG6CR9T15MB18F', '85710c3f-1769-4ddb-b430-7b7ed8e04d2e', '2026-10-04', 1, 'passed', 3, 'wedding_20261004_0200.sql.gz.enc', 'Restored into staging DB; all row counts matched.', '2026-10-04 15:00:00', 1, 1);

INSERT INTO exports (public_id, kind, status, requested_by, progress_pct, parts, file_name, size_bytes, sha256, created_at, started_at, finished_at, expires_at) VALUES
  ('01M1DJ3T40CDZJ73MS7A4AF6CW', 'full', 'expired', 1, 100, 1, 'wedding-export_2026-10-04.zip', 5242880, '5fadf7a127a07acf7e5074ad382834e5f47d801a1a3c7e52faa13ecf8855ad6a', '2026-10-04 14:00:00', '2026-10-04 14:00:00', '2026-10-04 14:01:30', '2026-10-05 14:01:30');

INSERT INTO login_attempts (phone, ip, user_id, succeeded, attempted_at) VALUES
  ('+919829000006', '103.21.58.14', 6, 0, '2026-10-07 14:00:00'),
  ('+919829000006', '103.21.58.14', 6, 1, '2026-10-07 14:01:00'),
  ('+919829000001', '103.21.58.10', 1, 1, '2026-10-08 03:15:00');

INSERT INTO sessions (token_hash, csrf_hash, user_id, device_label, ip, created_at, last_used_at, expires_at, revoked_at, revoked_reason) VALUES
  ('b146a112bfa3d472d629e146a0d75fc9eff03cfadc432e52315ca225d6f71bb6', '2708474cde3be596b78a1d0a038051230df8d156b1f9778f9e11a793c1a1a0ac', 1, 'Android · installed', '103.21.58.11', '2026-09-02 06:00:00', '2026-10-08 03:15:00', '2027-01-06 03:15:00', NULL, NULL),
  ('368bb02d727ad6c9a91402db05008bbd4c31dce6ffb822b528b831285e86cadd', 'b571f5ac80b7fcbe202e23435cd149249c9c66d770c1b47b9bcb9ed73ba4b0b5', 2, 'iPhone · installed', '103.21.58.12', '2026-09-02 06:00:00', '2026-10-08 02:40:00', '2027-01-06 02:40:00', NULL, NULL),
  ('ac0986db4e0616d2ce2e374334610eeb1e31e4d557b0d1fbb90efc76c88e3926', '1976efe01beb9265d6efbb9a69da2928daf1ff77e26bab95102a21256c1c2442', 3, 'iPhone · installed', '103.21.58.13', '2026-09-02 06:00:00', '2026-10-07 13:00:00', '2027-01-05 13:00:00', NULL, NULL),
  ('e083b0ffc581901692b9ea7359d598eba989b884b791687bb4ab52f8271963f9', '2851a998421c5c70f1e6b2cf044724e4420567d6da98f99d47aa2c8f93cfd8ff', 4, 'Android · Chrome', '103.21.58.14', '2026-09-02 06:00:00', '2026-10-07 04:30:00', '2027-01-05 04:30:00', NULL, NULL),
  ('c6b1091c7ea219774cebecec4c4e6d73bf0148d0ffbf7f4dfb21a67e3217c72b', '7684c583e0cd4dc344ffc80100d2432e3e865d539426794bd1f0a261a55362ed', 5, 'Android · installed', '103.21.58.15', '2026-09-02 06:00:00', '2026-10-06 15:20:00', '2027-01-04 15:20:00', NULL, NULL),
  ('2e4f674fe7618807fc4be7f340fd97ebfb4a0ed6b23f9ac0cd952015921dee14', 'e14cfaa46921e875292fa6c1b7e9091697fe0fb30dd3219c7f8a43af46aa80b8', 6, 'iPhone · Safari', '103.21.58.16', '2026-09-02 06:00:00', '2026-10-07 13:50:00', '2027-01-05 13:50:00', '2026-10-07 13:55:00', 'password_reset'),
  ('3e92b25cbe557f2db184076a7f6c10e0118c02f06fb2ae9fb109146d3de2be4a', 'ebd3906d6ebe9835fadc694287e7720f422ef43ef105e106c3a047fdce2352a1', 6, 'iPhone · installed', '103.21.58.16', '2026-09-02 06:00:00', '2026-10-07 14:01:00', '2027-01-05 14:01:00', NULL, NULL),
  ('8de0e282c6e69a95b37b2358e5e70fa7935a09befa82050eebf2bbde1dd7489f', '3808b852d374d30c6c25e2480cd111ae2917d9c1f1219848575e0369ad102d1e', 7, 'Android · installed', '103.21.58.17', '2026-09-02 06:00:00', '2026-10-05 09:00:00', '2027-01-03 09:00:00', NULL, NULL);

INSERT INTO password_resets (user_id, reset_by, method, sessions_revoked, ip, created_at) VALUES
  (6, 1, 'admin_generated', 1, '103.21.58.10', '2026-10-07 13:55:00');

-- End of DEV ONLY demo data.
