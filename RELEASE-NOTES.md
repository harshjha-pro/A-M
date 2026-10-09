# Release notes — Session 03 · Data safety · version 1.0.3

**Goes to:** STAGING only (`staging-wedding.lumorrahouse.com`). Live opens in Session 4.
**Migrations:** none. Nothing to run in phpMyAdmin (every table this needs was created in Session 1).
**.env:** no change. Keep `BACKUP_EXPECTED=false` on staging (staging has no backup job, so the backup line on the Safety screen is expected to say "Not in use" or show a problem — that is correct).

## What's new
- **Undo** — after deleting something, a bar at the bottom says "Deleted … UNDO" for 8 seconds (it stays while your finger is on it). Only the person who deleted can undo, within 10 minutes.
- **Deleted items** (Settings → Deleted items, Ayush and Mahi only) — everything deleted stays here and can be **restored** at any time. Nothing is removed for good before 16 May 2027.
- **Two people editing at once** — if you and someone else change *different* things, both changes are kept automatically. If you both changed the *same* thing, a full screen shows **Your version / their version**, you pick, then **Save my choices** (or keep theirs).
- **Drafts on the phone** — what you type in Wedding details or a member's page is kept on that phone for 7 days. Reopening shows "You have unsaved changes from 10:42. [Use them] [Discard]". Logging out with drafts asks first.
- **History and Activity** — Wedding details → **See history**; Settings → **Activity** shows every change as a plain sentence, e.g. "Mahi changed City from Bhilwara to Udaipur." Money changes are hidden from people without money access.
- **Safety** (Settings → Safety, Ayush and Mahi only) — health of the app (database, backups, storage, change log, restore drill), the last nightly backups, and the monthly **restore drill** log (add, delete with Undo, see its history).
- Under the hood: one shared piece of code now does soft delete, undo, restore, history and double-save protection for every kind of record, so Guests, Tasks and Money (next sessions) get all of this for free.

## Upload (standard, ≈ 10 minutes)
1. File Manager → `domains/staging-wedding.lumorrahouse.com/` → New folder `_incoming` → upload `deploy-session03.zip` → Extract.
2. From `_incoming/deploy-session03/staging/` extract, **into the site folder** (`domains/staging-wedding.lumorrahouse.com/`), overwrite Yes:
   1. `1-server.zip`  2. `2-assets.zip`  3. `3-shell.zip`
3. Copy `staging/version.json` into `public_html/` (overwrite) — **last**.
4. Delete `_incoming`.
5. Open `https://staging-wedding.lumorrahouse.com/api/v1/health` → `{"status":"ok"}`.

## Checks — Android (Chrome) **and** iPhone (Safari)
Demo logins as before (password `demo-1234`): Ayush 98290 00001, Mahi 98290 00002, Papa 98290 00004, Dadi 98290 00006.

| # | Do | Pass when |
|---|---|---|
| 3.1 | Phone A = Ayush, phone B = Mahi. Both open Settings → Wedding details → **Edit**. Mahi changes *Groom's side name* → Save. Then Ayush changes *City* → Save | Ayush sees **both** changes, no extra screen |
| 3.2 | Both tap Edit again. Mahi changes City to "Udaipur" → Save. Ayush changes City to "Jaipur" → Save | Ayush sees "Mahi Jagetiya changed this at … while you were editing." with **Your version** / **Mahi Jagetiya's version**. Pick yours → **Save my choices** → City shows Jaipur |
| 3.3 | Ayush: Settings → **Safety** → Log a restore drill → Save. Then tap the 🗑 on that drill | Bar at the bottom: "Deleted Restore drill · … UNDO". Tap **UNDO** → "Undone." and the drill is back |
| 3.4 | Delete the drill again and wait **11 minutes**. Then Settings → **Deleted items** → **Restore** | "Restored." The drill is back on the Safety screen |
| 3.5 | Settings → **Activity** | Plain sentences like "Ayush Porwal changed City from Udaipur to Jaipur." and "Ayush Porwal deleted Restore drill · …". Pick a person in the list → only their lines |
| 3.6 | Safety screen, Backup line | On staging: **"Backup: Not in use"** (normal — staging has no backup job). Database: Good |
| 3.7 | Wedding details → Edit → change City, then close the app **without saving**. Reopen → Wedding details | "You have unsaved changes from HH:MM. [Use them] [Discard]". Use them → your text is back |
| 3.8 | Log in as Papa or Dadi → Settings | No Safety, Activity or Deleted items rows |
| 3.9 | Repeat 1.2–1.5 from Session 1 (health, `/.env` blocked, http→https, securityheaders.com) | Same as before |

## Old files to delete later
After 14 days (about 23 Oct): files in `public_html/assets/` that are **not** in this ZIP's `2-assets.zip`.
