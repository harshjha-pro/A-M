# Release notes — Session 11 · Export everything · version 1.0.12

**Goes to:** STAGING first, then **LIVE** (release checklist below).
**Migrations:** none. Nothing to run in phpMyAdmin.
**.env:** no change (`STORAGE_ROOT` already points at `…/private/storage`; exports go in `private/storage/exports/`).
**`.htaccess`:** no change.
**hPanel:** nothing new (the upload limits from Session 10 stay).

## What's new
- **Settings → Export everything** (Ayush and Mahi only).
  - Tap **Export everything → Export**. "Preparing export…" takes a few seconds, then **Download**.
  - One ZIP, `wedding-export_YYYY-MM-DD.zip`, with:
    - `summary.html`: open it on a computer to see the wedding facts, events with headcount, guests by side, tasks by status, budget, payments and vendor phone numbers. It is ready to print.
    - `csv/…`: every list as a spreadsheet for Excel or Google Sheets (Hindi and ₹ show correctly).
      - Deleted rows are included.
      - Times are India time and money is in rupees.
      - Cells that look like formulas are made safe.
    - `documents/`: every photo and PDF, including those in Deleted items.
    - `json/all.json` and `manifest.json`: for a full restore if everything else is ever lost (DATA-SAFETY §2.1).
    - `README.txt`: what each file is, with row counts.
  - Passwords and login keys are never in an export.
  - **Print summary** opens the summary in the browser. Use Print → Save as PDF for a paper copy.
  - More than 200 MB of photos → **Download part 1 of 2**, **part 2 of 2**.
  - The link works for **24 hours**. Then the server deletes the files, and the link says it has expired.
  - **Recent exports** and "Last export: …" show on the same page.
  - Up to 3 exports an hour. Every export and every download shows in Activity.
  - No internet → the button is off.
- **Fixed — Hindi names in the duplicate check:**
  - Before, Hindi family names lost their vowel signs when checked for duplicates. राम शर्मा and रमा शर्मी looked the same, so the "possible duplicate" hint could show for different families.
  - Now the full name is compared, and "जी" / "परिवार" are ignored like "ji" / "parivar".
  - Only the hint was affected, never the data. Real guests aren't on live yet, so nothing to clean up there.
- **Emergency restore tool** `private/app/tools/restore-from-export.php` comes with the server files (SSH only, never reachable from the web).

## 1. Staging (≈ 10 minutes)
Standard upload from the **`staging/`** folder → `/api/v1/health` = `{"status":"ok"}` → phone checks below.

## 2. Live (after staging passes) — release checklist
1. Live Settings → Safety all green.
2. **Backup now** — SSH: `php ~/domains/wedding.lumorrahouse.com/private/backup/backup.php --kind=manual_db` → `Done in … s.`
3. Save `deploy-session11.zip` to Drive `deploys/`; tell the family group (quiet hour).
4. Standard upload from the **`live/`** folder.
5. Within 10 minutes:
   - Health check says `ok`, and the app refreshes to 1.0.12.
   - Settings shows **Export everything**.
6. **Your first real export (DATA-SAFETY §2.1):**
   - As Ayush: Settings → Export everything → Export → **Download**.
   - Upload the ZIP to Google Drive → `A&M Wedding / exports /` (keep its name).
   - Open it once on a computer → `summary.html` shows your tasks and payments.
   - Then delete it from the phone's Downloads.
7. If anything fails: upload `deploy-session10.zip` (`live/`) the same way.

## Phone checks (staging, then live) — Android and iPhone
Staging logins (password `demo-1234`): Ayush 98290 00001 · Papa 98290 00004 (Family).
On iPhone, do X2 **from the installed app** (Home Screen icon) as well as in Safari.

| # | Do | Pass when |
|---|---|---|
| X1 | Settings → Deleted items: restore an event that was deleted more than 11 minutes ago | Restored with its invitations |
| X2 | As Ayush: Settings → **Export everything** → Export → **Download** | Android: the ZIP is in Downloads. iPhone: Share → **Save to Files** works. On a computer the ZIP opens; `summary.html` shows the families |
| X3 | Settings → Activity | Today's test actions in plain sentences, including "Ayush downloaded a full export" |
| X4 | Export screen → **Print summary** | The summary opens; Print → Save as PDF works |
| X5 | Log in as **Papa** → Settings | No "Export everything" row |
| X6 | Open `csv/households.csv` from the ZIP in Excel or Google Sheets | Hindi names readable; a 25-hour-old export link says it has expired |

## Old files to delete later
After 14 days: files in `public_html/assets/` that are not in this ZIP's `2-assets.zip`.
