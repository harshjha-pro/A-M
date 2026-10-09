# Release notes — Session 07 · Home (dashboard) · version 1.0.7

**Goes to:** STAGING first, then **LIVE** (release checklist below).
**Migrations:** none. Nothing to run in phpMyAdmin.
**.env:** no change.
**`.htaccess`:** updated (compresses the app's files) — it is inside `3-shell.zip`, nothing to do by hand.

## What's new
- **Home is now the "what needs attention today" screen.** Everything comes from one call; each person only gets the cards their role allows (people without money access never even receive the money numbers).
  - **Countdown**: "129 days to the wedding" (India date — it changes at midnight IST), "Day 1 of 3" during the wedding, and the **next event** with date, time and venue (tap to open).
  - **My tasks** (Ayush, Mahi, Family): your overdue tasks first (red), then today's; if none, the next 3 coming up. Tick from Home, with Undo.
  - **Everyone's overdue**: "7 overdue tasks" → opens Tasks · Overdue.
  - **Payments due** (next 14 days, overdue included) and **Budget** (Planned · Spent · Still to pay · Free, with a bar) — money people only. They fill in once Money is built (Session 9); on staging they already show the demo payments.
  - **Headcount** per guest event (Coming · Waiting · Not asked · Jain) — fills in with Guests (Session 8).
  - **Safety** (Ayush and Mahi): last backup (red if more than 26 hours old), last restore drill, items in Deleted items, server.
  - **Recent activity** (Ayush and Mahi): the last changes in plain sentences.
  - **Start here** checklist (Ayush and Mahi) until event dates, family members, guests and a first payment exist.
  - "Connected · Updated 10:42" at the bottom; Home refreshes when you come back to the app.
- **Faster loading:** the app's files are now sent compressed (≈ 300 KB → ≈ 100 KB). Lighthouse on a simulated slow 4G phone: **97** for speed (target 90), 100 for accessibility.

## 1. Staging (≈ 10 minutes)
Standard upload from the **`staging/`** folder → `/api/v1/health` = `{"status":"ok"}` → phone checks below.

## 2. Live (after staging passes) — release checklist
1. Live Settings → Safety all green.
2. **Backup now** — SSH: `php ~/domains/wedding.lumorrahouse.com/private/backup/backup.php --kind=manual_db` → `Done in … s.`
3. Save `deploy-session07.zip` to Drive `deploys/`; tell the family group (quiet hour).
4. Standard upload from the **`live/`** folder (`3-shell.zip` includes the new `.htaccess`).
5. Within 10 minutes: health `ok`; the app refreshes to 1.0.7; Home shows your cards; add a test task due today, tick it from Home, Undo; Mahi's phone the same; UptimeRobot "Up".
6. Optional: on a computer, PageSpeed Insights (pagespeed.web.dev) on `https://wedding.lumorrahouse.com/login` → Performance should be 90+.
7. If anything fails: upload `deploy-session06.zip` (`live/`) the same way.

## Phone checks (staging, then live) — Android and iPhone
| # | Do | Pass when |
|---|---|---|
| C2a | Log in as **Ayush** → Home | Countdown, Next event, My tasks, Everyone's overdue, Payments due, Budget, Headcount, Safety, Recent activity |
| C2b | Log in as **Papa** (staging 98290 00004) | Countdown, his tasks, overdue, Payments and Budget; **no Safety** |
| C2c | Log in as **Kavita** (98290 00005, no money) | Countdown, tasks, overdue, Headcount; **no Payments or Budget** |
| C2d | Log in as **Dadi** (98290 00006, Viewer) | Countdown and Headcount only; no + button |
| C2e | As Papa: tick a task in **My tasks** | Bar "Done: … UNDO"; the task leaves the card |
| C2f | **Once, after 11:30 PM IST**: look at the countdown, then again after 12:00 midnight | The number of days goes down by 1 at midnight India time |

## Old files to delete later
After 14 days: files in `public_html/assets/` that are not in this ZIP's `2-assets.zip`.
