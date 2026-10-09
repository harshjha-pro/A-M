# Release notes — Session 05 · Tasks · version 1.0.5

**Goes to:** STAGING first, then **LIVE** (with the release checklist below).
**Migrations:** none. Nothing to run in phpMyAdmin.
**.env:** no change.

## What's new
- **Tasks** (bottom bar → Tasks):
  - Add in 3 taps: **+ → Task → type → Save**. It's assigned to you unless you choose others.
  - Due date chips (Today · Tomorrow · This week · Pick date · No date), optional time, priority (Urgent / Normal / Low), status (To do · Doing · Waiting · Done · Cancelled), tags (make a new one inline), notes.
  - **Checklist** inside a task (e.g. items to buy). Ticking the last item asks "Mark the task done too?"
  - **View chips with counts:** My tasks (Family start here), All (Ayush and Mahi start here), Today, This week, Overdue, No date, Done & cancelled. Search by title; filter by tag.
  - **Overdue** follows India time: a task due today at 6 PM is overdue from 6:01 PM; one with no time is overdue from the next day.
  - **Move date** → Tomorrow / Next Monday / Pick date. A later date counts as a move ("Moved 2×") and History says "Mummy postponed Book tent wala from 12 Oct to 19 Oct."
  - **Tick done** from the list or the task. Anyone who edits can tick any task; ticking twice just says "Already done by Papa." Undo for 8 seconds.
  - **Delete** with Undo. Family can delete only tasks they added or that are assigned to them; Ayush and Mahi any. Deleted tasks (with checklist) are in Settings → Deleted items.
  - **Send on WhatsApp** to each person the task is assigned to: "Book tent wala — due Sat, 10 Oct 2026. Please update it in the wedding app."
  - Two people editing the same task get the same merge / conflict screen as Wedding details.
- **Tags**: 9 ready-made (Shopping, Outfit, Jewelry, Gifts, Decor, Food, Travel, Bride, Groom). Anyone who edits can add one; only Ayush and Mahi rename or delete.
- The **+** button on Home opens "Add → Task" (more kinds arrive with their sessions).

## 1. Staging (≈ 10 minutes)
Standard upload from the **`staging/`** folder: `_incoming` → extract → `1-server.zip`, `2-assets.zip`, `3-shell.zip` into the site folder (overwrite Yes) → `version.json` into `public_html/` last → delete `_incoming` → `/api/v1/health` says `{"status":"ok"}`. Then do the phone checks below on staging.

## 2. Live (only after staging checks pass) — release checklist (TESTING §8.2)
1. Live Settings → **Safety** all green.
2. **Backup now** — SSH: `php ~/domains/wedding.lumorrahouse.com/private/backup/backup.php --kind=manual_db` → last line `Done in … s.`
3. Put `deploy-session05.zip` in Drive `deploys/`. Tell the family group "Updating the app at 10:30 PM" (quiet hour).
4. Standard upload from the **`live/`** folder (same steps as staging).
5. Within 10 minutes: live `/api/v1/health` → `{"status":"ok"}`; open the app → "New version available" → refresh; add a test task, tick it, delete it, Undo, delete again; Safety green; Mahi's phone does the same on the other platform; UptimeRobot "Up".
6. If anything fails: upload `deploy-session04.zip` (`live/` folder) the same way. No migration, so the old code runs as before.

From now on you may add **real tasks** on live.

## Phone checks (staging, then live) — Android and iPhone
| # | Do | Pass when |
|---|---|---|
| T1 | Add a task with due date **Tomorrow**, priority **Urgent**, then open it and add 3 checklist items | All saved; Urgent flag shows; the list row says "Tomorrow" |
| T2 | Tick all 3 items | "All items are ticked. Mark the task done too?" appears |
| T3 | Move date → **Next Monday**, then Move date → Pick a later date | "Moved 2×"; History shows both moves |
| T4 | As Mummy (staging: 98290 00003), try to delete a task Ayush made and assigned to Papa | "You can delete only tasks you added or that are yours." — nothing deleted |
| T5 | View chips: My tasks, Today, Overdue | The number on each chip matches the rows shown |
| T6 | Delete a task with a checklist → tap **UNDO** | The task comes back with its checklist |
| T7 | On a task assigned to someone with a phone: **Send to … on WhatsApp** | WhatsApp opens to that person with the task text |
| T8 | As Dadi (Viewer) | Tasks list shows; no + button and no tick circles |

## Old files to delete later
After 14 days: files in `public_html/assets/` that are not in this ZIP's `2-assets.zip`.
