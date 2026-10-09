# Release notes — Session 06 · Events and calendar · version 1.0.6

**Goes to:** STAGING first, then **LIVE** (release checklist below).
**Migrations:** none. Nothing to run in phpMyAdmin.
**.env:** no change.

## What's new
- **Calendar** (bottom bar → Calendar):
  - **Agenda** (opens first): from today, grouped by day ("Sun, 22 Nov 2026"). Events with no date yet are at the top under **Date not set**. 60 days at a time: **Show later** / **Show past**.
  - **Month** view: up to 3 dots per day and "+2" when there are more; tap a day to see its list.
  - Shows events, open tasks with a due date, and (for money people, once Money is built) due payments. Each line says what it is — **Event** / **Task** / **Payment** — with its own icon.
  - Toggles: Events / Tasks / Payments, and **Only mine** (your tasks).
- **Event page** (tap an event): date and time, venue and address, **Open map**, side, dress code, notes, its tasks (+ **Add a task for this event**), headcount (fills in with Guests), **Share on WhatsApp** — "Mehndi · Sun, 14 Feb 2027, 4:00 PM IST · Porwal Niwas, Shastri Nagar · map link".
- **Ayush and Mahi** can edit events (date, start/end time or **All day**, venue, map link, dress code, "Guests are invited"), add custom events (Ganesh puja, makeup trial…) with the + on Calendar, and delete one: a box first shows "12 tasks, 340 invited families, 3 payments…", then Undo for 8 seconds. Tasks keep the link and show "(deleted event)". Family and Dadi only read.
- Same event type on the same day (e.g. Mayra on both sides) shows "Haldi is already on Sat, 13 Feb 2027. Add anyway?"
- All times are India time. A phone set to another time zone shows "IST" next to times.
- **Tasks:** the task form now has an **Event** picker.

## 1. Staging (≈ 10 minutes)
Standard upload from the **`staging/`** folder → `/api/v1/health` = `{"status":"ok"}` → phone checks below.

## 2. Live (after staging passes) — release checklist
1. Live Settings → Safety all green.
2. **Backup now** — SSH: `php ~/domains/wedding.lumorrahouse.com/private/backup/backup.php --kind=manual_db` → `Done in … s.`
3. Save `deploy-session06.zip` to Drive `deploys/`; tell the family group (quiet hour).
4. Standard upload from the **`live/`** folder.
5. Within 10 minutes: health `ok`; app refreshes to 1.0.6; open Calendar; add a test task, tick, delete, Undo; Mahi's phone the same; UptimeRobot "Up".
6. If anything fails: upload `deploy-session05.zip` (`live/`) the same way.
7. Real event dates on live: fill them in only if you have them (Calendar → event → Edit). Otherwise they stay under "Date not set".

## Phone checks (staging, then live) — Android and iPhone
| # | Do | Pass when |
|---|---|---|
| E1 | Calendar → Agenda | "Date not set" at the top (on staging: only events without dates); events on the right days; staging Engagement on **Sun, 22 Nov 2026** at **6:00 PM** |
| E2 | Month → Next month → tap 22 | That day's list opens under the grid |
| E3 | As Ayush: open Mehndi → Edit → change Venue → Save → **Share on WhatsApp** | Saved; WhatsApp opens with the new venue in the text |
| E4 | As Mummy (staging 98290 00003): open an event | No Edit or Delete; "Only Ayush and Mahi can change events." |
| E5 | As Ayush: open "Bridal makeup trial" → Delete | A box shows the counts → Delete → bar "Deleted Bridal makeup trial · UNDO" → UNDO → it's back |
| E6 | Mehndi → **Add a task for this event** → Save | The task shows on the Mehndi page and in Tasks |

## Old files to delete later
After 14 days: files in `public_html/assets/` that are not in this ZIP's `2-assets.zip`.
