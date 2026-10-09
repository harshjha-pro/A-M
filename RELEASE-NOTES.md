# Release notes — Session 08b · Guests: bulk changes, import, CSV · version 1.0.9

**Goes to:** STAGING first, then **LIVE** (release checklist below).
**Migrations:** none. Nothing to run in phpMyAdmin.
**.env:** no change.
**`.htaccess`:** updated (one line so the Excel template downloads as an Excel file). It is inside `3-shell.zip`, so there is nothing to do by hand.

## What's new
- **Change many families at once** (Guests → **Select**).
  - Tick families, or tap "Select all 260 filtered" to pick everyone the current filters show (up to 2,000).
  - Actions:
    - **Invite to** an event. Families already invited keep their answer.
    - **Remove from** an event.
    - **Set Coming?** for an event.
    - **Change side**.
    - **Delete** (Ayush and Mahi only).
  - One action = one **Undo** for 10 minutes. A deleted batch can also be restored later from Deleted items.
  - If someone changed a family after you opened the list, that family is left alone and the bar tells you ("2 left as they were: changed by someone after you opened the list").
- **Import a list** (Guests → More filters → Import a list, or the button on an empty list; Ayush and Mahi).
  - **Excel (.xlsx)**, **CSV**, **pasted text** (one family per line, e.g. "Ramesh Sharma 98290 12345") or a **contacts file (.vcf)** shared from the phone's Contacts.
  - For rows that leave them empty: side, "Invite everyone to" events, and city.
  - Columns are recognised automatically (Name/Naam, Phone/Mobile, Side, Group, Area, City/Shehar, Adults/Bade, Children/Bacche, Food, the event names…). You can change any column's meaning.
  - Words like ladkiwale, ladkewale, Mahi or Ayush are read as the bride's or groom's side.
  - **Preview first**: "480 new · 12 possible duplicates · 3 problems".
    - Each possible duplicate (same phone as a family already in the app or another row; same name in the same city) gets **Skip** (the default), **Add anyway**, or **Fill in** that family. Fill in only adds what is empty and never overwrites.
    - Rows with a problem (no name, wrong phone) are skipped. Fix them right there and tap "Check again" to include them.
  - Nothing is saved until you tap **Import**. Then you get an Undo bar.
  - **Settings → Imports** lists every import with **Undo this import** (any time later). Families someone changed since the import are kept.
  - Up to 3,000 rows per import.
- **The Excel template** (Import a list → Download the Excel template):
  - **Read me** sheet with plain steps.
  - **Guests** sheet with Side, Food, Important and Yes/No dropdowns for every function. The phone columns keep every digit.
  - **Summary** sheet that counts families and people as you type.
  - Row 2 is an EXAMPLE row, which the import skips.
- **Export this list (CSV)** on Guests (Ayush and Mahi). It exports exactly what the filters show.
  - Opens in Excel with Hindi and ₹ intact; dates are in India time.
  - Each event is a column showing Coming / Waiting / Not coming / Not invited.
  - Cells that could act as spreadsheet formulas are made safe.
  - Each download is noted in Activity.

## 1. Staging (≈ 10 minutes)
Standard upload from the **`staging/`** folder → `/api/v1/health` = `{"status":"ok"}` → phone checks below.

## 2. Live (after staging passes) — release checklist
1. Live Settings → Safety all green.
2. **Backup now** — SSH: `php ~/domains/wedding.lumorrahouse.com/private/backup/backup.php --kind=manual_db` → `Done in … s.`
3. Save `deploy-session8b.zip` to Drive `deploys/`; tell the family group (quiet hour).
4. Standard upload from the **`live/`** folder (`3-shell.zip` includes the updated `.htaccess`).
5. Within 10 minutes:
   - Health check says `ok`, and the app refreshes to 1.0.9.
   - Guests → Import a list → **Download the Excel template**: it opens in Excel or Google Sheets with working dropdowns.
   - Paste "Test Family 98290 12345" → Check → Import 1 → Settings → Imports → Undo this import.
6. **Your real list goes on live at launch (Sun 25 Oct), as planned.** Until then keep collecting it in the Excel template, and practise importing a copy on **staging**. Check the preview counts before tapping Import; Undo this import is always there.
7. If anything fails: upload `deploy-session08.zip` (`live/`) the same way.

## Phone checks (staging, then live) — Android and iPhone
Staging logins (password `demo-1234`): Ayush 98290 00001 · Papa 98290 00004.

| # | Do | Pass when |
|---|---|---|
| B1 | As Papa: Guests → Select → tick 3 families → Invite to → Mehndi → Apply | "Invited 3 families to Mehndi" with UNDO; Undo takes them off again |
| B2 | Guests → event Mehndi → Select → **Select all … filtered** → Set Coming? → Waiting | One Undo bar for all of them; the Mehndi headcount moves |
| B3 | As Papa in Select mode | No Delete button (Ayush and Mahi only); no Export or Import |
| B4 | As Ayush: Guests → More filters → Import a list → **Download the Excel template** (Android: Downloads; iPhone: the save sheet) | Opens in Excel / Google Sheets; Side and Food dropdowns work; phone 98290 12345 stays as typed |
| B5 | Fill 5 rows in the template (one with phone **98280 10085**, one with phone 12345) → Import a list → choose it | "3 new · 1 possible duplicates · 1 problems"; the EXAMPLE row is skipped |
| B6 | Import 3 → Settings → Imports → **Undo this import** | The 3 families are gone; the import shows "Undone …" |
| B7 | Import a **contacts file**: iPhone Contacts → select a contact → Share → Save to Files; Android Contacts → Share → save .vcf → choose it | Names and numbers show in the preview |
| B8 | Paste "Ramesh Sharma 98290 12345" → Use pasted text → Check | Name "Ramesh Sharma", phone +91 98290 12345 |
| B9 | As Ayush: Guests → Groom → **Export this list (CSV)** → open in Excel | Only groom-side and both-sides families; Hindi names readable; a column per event |

## Old files to delete later
After 14 days: files in `public_html/assets/` that are not in this ZIP's `2-assets.zip`.
