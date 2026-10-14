# Release notes — IDs for tasks and attachments · version 1.0.22

**Goes to:** STAGING (and the Vercel test copy) first.
**Migrations:** **`009_task_codes.sql` — run it in phpMyAdmin BEFORE uploading the server files** (after `004`–`008` if you have not imported those yet).
**.env / hPanel / `.htaccess`:** no change.

## Run the migration first (≈ 1 minute)
1. phpMyAdmin → **Export** (backup).
2. **Import** in order whatever is not done yet: `004_home_photos.sql` … `008_contacts_timeline.sql`, then **`009_task_codes.sql`**. ("Duplicate entry" = already imported, go on.)
3. Check: `SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;` → **9**.

## What's new
- **Every task has its own ID**, made at random when the task is added (e.g. **TSK-4M8Q2D**). It shows on the task page and under each task in the list.
  - **Change it** on the task's Edit page (e.g. "TENT-01"): letters, numbers, - and _, unique across tasks (capitals ignored), checked while you type ("This ID is free.").
  - **Search** in Tasks finds a task by its ID.
  - Existing tasks got their IDs when you imported 009.
- **Attachments get a random ID** too (e.g. **ATT-7K3F9Q**) instead of the next number. Still editable as before. The old numbered IDs (ATT-000001…) were replaced with random ones, oldest first; IDs you typed yourself are kept.
- Letters and digits that look alike (0/O, 1/I/L) are never used, so IDs are easy to read out.

## Phone checks
| # | Do | Pass when |
|---|---|---|
| T1 | Tasks → any task | Its ID (TSK-…) shows at the top and under it in the list |
| T2 | Ayush → + → Task → save → open it | A new random TSK- ID |
| T3 | Edit → Task ID → "TENT-01" | "This ID is free." → Save → the page shows TENT-01 |
| T4 | Another task → Edit → Task ID "tent-01" | Says it is already used by the first task |
| T5 | Tasks → search "tent-01" | Finds the task |
| T6 | Workspace → Files → Add attachment | The new attachment's ID is ATT- + 6 letters/digits |

## Live — release checklist
1. **Backup now**. 2. **Run `009_task_codes.sql` on live**. 3. Upload `live/` in order, `version.json` last. 4. If anything fails: upload `deploy-session14f.zip`; the new column can stay.
