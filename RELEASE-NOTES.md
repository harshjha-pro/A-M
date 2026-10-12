# Release notes — Home & Calendar redesign · version 1.0.16

**Goes to:** STAGING (and the Vercel test copy) first. Live after the phone checks below pass.
**Migrations:** **`004_home_photos.sql` — run it in phpMyAdmin before uploading the server files** (it adds two tables; nothing existing changes).
**.env / hPanel / `.htaccess`:** no change.

## Run the migration first (≈ 2 minutes)
1. phpMyAdmin → your database → **Export** → Quick → SQL → Go (keep the file).
2. **Import** → choose `migrations/004_home_photos.sql` from the deploy ZIP → Character set **utf-8** → **Go**.
3. Check: `SELECT version, finished_at FROM schema_migrations ORDER BY version DESC LIMIT 1;` → `4` with a time.
   Running it twice stops at the first line ("Duplicate entry '4'") and changes nothing.

The Vercel test copy uses the same Hostinger database, so this one import covers it too.

## Upload order (same as before)
1. `1-server.zip` → extract in the site folder
2. `2-assets.zip` → extract into `public_html`
3. `3-shell.zip` → extract into `public_html`
4. **`version.json`** → upload into `public_html`, **always last**

Keep old files in `public_html/assets/` for 14 days.

## What's new
- **Home, new order:**
  1. **Cover photos** sliding by themselves (up to 8), with the **A&M monogram** in the top-right corner;
  2. **Couple photos** (up to 4);
  3. **Countdown in Months : Days : Hours** (to midnight IST on 14 Feb), ticking live;
  4. **Upcoming events** (next 5, tap to open);
  5. **My tasks** and **Everyone's overdue** (as before);
  6. **Recent activity** — Ayush and Mahi only: 3 lines, **Show more** opens a scrolling list with older changes.
- **Removed from Home:** Budget, Payments due, Headcount and Safety. They are still on Money, the event pages and Settings › Safety.
- **Settings › Home photos** (Ayush and Mahi): add, reorder (◀ ▶) and remove (with Undo) cover photos, couple photos and the monogram. Until photos are added, soft placeholders show "Ayush & Mahi" and "A&M". Photos are made small on the phone; a monogram PNG keeps its see-through background. **Photos are stored in the database**, so they are in every backup and export.
- **Calendar:** opens in **Month** view (Agenda one tap away); **Events and Tasks** on; the Payments chip is gone; **Only mine** is on — tap it to see everyone's. The **+** (Ayush and Mahi) offers **Add event** or **Add task**.
- **Only Ayush and Mahi add tasks and events.** Family still edits and ticks tasks, and still adds families, payments ($) and documents. The + on Home no longer offers "Task" to Family; the Tasks screen has no + for them; the server refuses a new task from anyone else.
- **Fixed:** the Month grid now reads correctly with screen readers (found by the accessibility test once Month became the default).

## Phone checks on staging — Android and iPhone, from the Home Screen icon
Logins (password `demo-1234`): Ayush 98290 00001 · Mahi 98290 00002 · Papa 98290 00004 · Dadi 98290 00006.

| # | Do | Pass when |
|---|---|---|
| H1 | Ayush → Home | Placeholder cover "Ayush & Mahi", "A&M" circle top-right, 3 grey couple squares, a Months : Days : Hours box, Upcoming events, My tasks, Everyone's overdue, Recent activity. No Budget / Payments / Headcount / Safety |
| H2 | Settings → Home photos → Cover photos → Add photo → pick 3 photos | "Photo added."; 3 of 8; back on Home they slide every 5 s; dots under them switch photos |
| H3 | Add a monogram PNG; add 2 couple photos | Monogram shows in the circle; 2 couple photos side by side |
| H4 | Home photos → ▶ on cover 1; ✕ on cover 2 → Undo | Order changes on Home; Undo brings the photo back |
| H5 | Airplane mode → open Home | The photos still show (kept on the phone) |
| H6 | Recent activity → Show more | A box with older lines that scrolls by itself; Show less folds it |
| H7 | Papa → Home → + | Family, Payment — no Task. Tasks screen has no + |
| H8 | Papa → Calendar | Month view; Events and Tasks ticked; no Payments; Only mine ticked; no + |
| H9 | Ayush → Calendar → + | Add event / Add task |
| H10 | Dadi → Home | Countdown and Upcoming events; no tasks |

## Live — release checklist
1. Live Settings → Safety all green.
2. **Backup now** — SSH: `php ~/domains/wedding.lumorrahouse.com/private/backup/backup.php --kind=manual_db` → `Done in … s.`
3. Save `deploy-session14a.zip` to Drive `deploys/`.
4. **Run `004_home_photos.sql` on the live database** (steps above).
5. Upload in the order above from **`live/`**, `version.json` last.
6. Within 10 minutes: health `ok`; the open app shows "New version available" → tap → Settings → This phone says 1.0.16.
7. If anything fails: upload `deploy-session14.zip` (`live/`) the same way. The two new tables can stay; 1.0.15 doesn't read them.

## Old files to delete later
After 14 days: files in `public_html/assets/` that are not in this ZIP's `2-assets.zip`.
