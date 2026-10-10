# Release notes — Session 13 · Reading without internet · version 1.0.14

**Goes to:** STAGING first, then **LIVE** (release checklist below).
**Migrations:** none. Nothing to run in phpMyAdmin.
**.env / hPanel / `.htaccess`:** no change.

## Upload order (as since Session 12)
1. `1-server.zip` → extract in the site folder
2. `2-assets.zip` → extract into `public_html`
3. `3-shell.zip` → extract into `public_html`
4. **`version.json`** → upload into `public_html`, **always last**

Keep old files in `public_html/assets/` for 14 days.

## What's new
- **The app works with no internet for reading.** After it has been opened once with internet, it keeps a copy on the phone and refreshes it:
  - when the app opens;
  - when you come back to it;
  - when the internet returns;
  - every 5 minutes while it's open.
- **With no internet, these screens show that copy:**
  - Home, Tasks, Calendar and event pages, Guests and family pages, Vendors, Money and payments (people with money access, read only), Documents (details; photos and PDFs need internet), Members and Wedding details.
  - **Search by name and the main chips work offline** (Guests: side, event, Coming?; Tasks: Mine, Today, This week, Overdue, No date).
  - Advanced filters say "Needs internet."
  - A screen never opened on this phone says "Open this once with internet to see it offline."
- **Always with its age:** a yellow bar says **"No internet · from Sat 10 Oct 2026, 9:40 PM"**. A saved value never shows without it.
- **Opening the app from the icon with no internet works:** it opens as the person who last used it on this phone. The login is checked for real once the internet is back.
- **Saving still needs internet** for now: it says so instead of pretending. Saving offline comes in the next update.
- **Privacy:**
  - **Log out** removes everything the app saved on the phone.
  - If someone else logs in on the same phone, the previous person's copy is wiped first, so they never see any of it.
  - Amounts, payments and private documents are only ever saved for the people allowed to see them.
- **Settings → This phone:** "Saved on this phone: 812 families · 64 tasks · …" and "Last updated".
- **Size:** about 1 MB for 500 families. The first download on a slow 3G connection took 6 seconds in testing.

## 1. Staging (≈ 10 minutes)
Upload in the order above from **`staging/`** → `/api/v1/health` = `{"status":"ok"}` → phone checks below.

## 2. Live (after staging passes) — release checklist
1. Live Settings → Safety all green.
2. **Backup now** — SSH: `php ~/domains/wedding.lumorrahouse.com/private/backup/backup.php --kind=manual_db` → `Done in … s.`
3. Save `deploy-session13.zip` to Drive `deploys/`; tell the family group (quiet hour).
4. Upload in the order above from **`live/`**, `version.json` last.
5. Within 10 minutes:
   - Health check says `ok`.
   - The open app shows "New version available" → tap → Settings → This phone says 1.0.14 and "Saved on this phone: …".
6. If anything fails: upload `deploy-session12.zip` (`live/`) the same way, `version.json` last.

## Phone checks (staging, then live) — Android and iPhone
Staging logins (password `demo-1234`): Papa 98290 00004 · Kavita 98290 00005 (no money).
Do these **from the installed app** (Home Screen icon).

| # | Do | Pass when |
|---|---|---|
| T11 / R9 (reading) | Open the app with internet, wait 10 seconds, then turn on **airplane mode**, close the app fully and open it from the icon | The app opens on Home; the yellow bar "No internet · from …" shows. Guests, Tasks and Calendar show their lists |
| O1 | Airplane mode → Guests → type part of a family name | The list narrows to matching families |
| O2 | Airplane mode → open a family, a task, an event | Each opens with its details |
| O3 | Airplane mode → try to save anything | "No internet connection." — nothing pretends to be saved |
| O4 | Airplane mode → Activity | "Open this once with internet to see it offline." |
| O5 | Airplane mode off | The yellow bar goes away within a few seconds of the next screen |
| R13 / T19 | Settings → This phone | "Offline data: Protected ✓" (write down what it says on each phone), "Saved on this phone: … families …", "Last updated …" |
| O6 | Log out, then airplane mode, open the app | The login page, no guest list |
| O7 | Log in as Papa, then log out and log in as **Kavita** on the same phone; airplane mode → Money / Vendors | Kavita sees no amounts and no payments from Papa's login |

## Old files to delete later
After 14 days: files in `public_html/assets/` that are not in this ZIP's `2-assets.zip`.
