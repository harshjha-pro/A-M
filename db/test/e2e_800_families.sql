-- 800 extra families for E2E-16 (guest list scroll and search, TESTING §7.4).
-- Test data only: loaded by tools/test-e2e.sh after seed_demo.sql. Not invited to any
-- event, so the demo headcounts stay as documented.
SET SESSION cte_max_recursion_depth = 1000;
INSERT INTO households (public_id, name, name_norm, phone, side, area, city, adults, children, created_by, updated_by, created_at, updated_at)
WITH RECURSIVE n (i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 800)
SELECT CONCAT('01M9E2E', LPAD(i, 19, '0')),
       CONCAT('Test Family ', LPAD(i, 4, '0')),
       CONCAT('test ', LPAD(i, 4, '0')),
       CONCAT('+9170000', LPAD(i, 5, '0')),
       ELT(1 + i MOD 3, 'bride', 'groom', 'both'),
       ELT(1 + i MOD 4, 'Shastri Nagar', 'Azad Nagar', 'Bapu Nagar', 'Kashipuri'),
       'Bhilwara', 1 + i MOD 4, i MOD 3, 1, 1, '2026-10-01 05:00:00', '2026-10-01 05:00:00'
FROM n;
