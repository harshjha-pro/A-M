# Release notes — Session 14 · Saving without internet · version 1.0.15

**Goes to:** **STAGING only.** Live waits until the offline tests OC-01 … OC-22 pass on two real phones (plan: by Thu 22 Oct). One duplicate or lost change blocks live.
**Migrations:** none. Nothing to run in phpMyAdmin.
**.env / hPanel / `.htaccess`:** no change.

## Upload order (same as Session 12 and 13)
1. `1-server.zip` → extract in the site folder
2. `2-assets.zip` → extract into `public_html`
3. `3-shell.zip` → extract into `public_html`
4. **`version.json`** → upload into `public_html`, **always last**

Keep old files in `public_html/assets/` for 14 days.

## What's new
- **Small changes can now be made with no internet.** They wait on the phone and are sent by themselves when the internet is back:
  - tick a task;
  - add or edit a task;
  - add, tick or rename a checklist item;
  - add or edit a family;
  - set Coming? for a family that is already invited.
- **Each change is sent exactly once.** Closing the app, a weak signal or a lost reply never makes a second copy, and nothing is lost.
- **You always see what's waiting:**
  - 🕒 **Waiting to send** on the task or family;
  - a yellow bar "3 changes waiting to send." with **Send now**;
  - it goes away once everything has landed.
- **When someone else changed the same thing:** the bar turns red, "1 change needs your choice." → **Open**. Each field shows **Yours** and **Theirs** (e.g. "Mummy's"); pick, then **Save my choices** — or **Keep theirs**. If they changed other fields only, it's sent by itself with no question.
- **A family that looks like one already on the list** (found when it's sent): **Add anyway** or **Discard**.
- **Discard** always asks first, because Undo can't bring it back.
- **Still need internet** (greyed out, with "Needs internet" under them):
  - deletes, Undo and restore;
  - bulk actions and import;
  - everything about money;
  - events, settings and members;
  - uploads;
  - Coming? on a family added offline ("Send the new family first").
- **Log out with changes waiting:** "3 changes haven't been sent. If you log out now, they are lost." — **Send now**, **Show changes**, or **Log out and lose them** (asks twice).
- **Settings → This phone:** shows how many changes are waiting. If someone else's unsent changes are on the phone: "2 changes from Papa's login are on this phone. Papa must log in here to send them."
- **Bug fixed:** if airplane mode was switched on while the app was open, new screens could stay on "…". They now open from the copy saved on the phone.

## Staging (≈ 10 minutes)
Upload in the order above from **`staging/`** → `/api/v1/health` = `{"status":"ok"}` → the phone checks below.

## Phone checks on staging — Android and iPhone, from the Home Screen icon
Staging logins (password `demo-1234`): Ayush 98290 00001 · Papa 98290 00004 · Mummy/Kavita 98290 00005.

| # | Do | Pass when |
|---|---|---|
| S1 | Airplane mode → Tasks → tick a task | 🕒 "Waiting to send" on it; yellow bar "1 change waiting to send." |
| S2 | Still offline: add a task, edit a family, set Coming? on two events | The bar says "5 changes waiting to send." |
| S3 | Close the app fully, open it again (still offline) | Still 5 waiting; the changes still show |
| S4 | Airplane mode off | Within a minute (or tap **Send now**) the bar goes. On another phone each change is there **once** |
| S5 | Two phones: both open the same task. Phone A offline edits the title; phone B (online) edits the title differently. Phone A back online | Red bar "1 change needs your choice." → Open → Yours / Theirs → Save my choices → both phones show your pick |
| S6 | Offline: add a family with a phone number already on the list; go online | "Looks like a family already on the list" → Add anyway or Discard |
| S7 | Offline: open a task | Delete is greyed out with "Needs internet" under it |
| S8 | Offline with 1 change waiting → Settings → My account → Log out | "1 change hasn't been sent." Cancel. Go online, tap Send now, then log out normally |
| R9 / T16–T22 | PWA §10 device checklist rows for offline saving | As written there |

## Before live — the offline tests (TESTING §3, OC-01 … OC-22)
Two phones and a helper, about 2 hours, by **Thu 22 Oct**. Write down each result. **Any duplicate or lost change blocks live** (TESTING §3.2).

## Live (only after the offline tests pass) — release checklist
1. Live Settings → Safety all green.
2. **Backup now** — SSH: `php ~/domains/wedding.lumorrahouse.com/private/backup/backup.php --kind=manual_db` → `Done in … s.`
3. Save `deploy-session14.zip` to Drive `deploys/`.
4. Upload in the order above from **`live/`**, `version.json` last.
5. Within 10 minutes: health `ok`; the open app shows "New version available" → tap → Settings → This phone says 1.0.15.
6. If anything fails: upload `deploy-session13.zip` (`live/`) the same way, `version.json` last.
   Changes waiting on phones are kept on the phone: 1.0.14 can't read them (or the offline copy), and 1.0.15 sends them once it is back.

## Old files to delete later
After 14 days: files in `public_html/assets/` that are not in this ZIP's `2-assets.zip`.
