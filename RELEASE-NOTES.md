# Release notes — Workspace step B: outfits · version 1.0.18

**Goes to:** STAGING (and the Vercel test copy) first. Live after the phone checks below pass.
**Migrations:** **`006_outfits.sql` — run it in phpMyAdmin BEFORE uploading the server files.** (If you skipped earlier ones, run them first in order: `004_home_photos.sql`, `005_workspaces_vault.sql`.)
**.env / hPanel / `.htaccess`:** no change.

## Run the migration first (≈ 2 minutes)
1. phpMyAdmin → your database → **Export** → Quick → SQL → Go (keep the file).
2. **Import** → `migrations/006_outfits.sql` → Character set **utf-8** → **Go**.
3. Check: `SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;` → **6**.

The Vercel test copy uses the same database: this one import covers it. Until it is run, opening a workspace shows an error.

## Upload order (same as before)
`1-server.zip` → `2-assets.zip` → `3-shell.zip` → **`version.json` last**.

## What's new (Ayush and Mahi)
- **Bride outfit** and **Groom outfit** sections in every workspace. **+ Add outfit** (several per person, e.g. an outfit change). Each card shows the moodboard's first photo and a progress bar of the timeline.
- **The outfit page:**
  - **Timeline:** Selected → Stitched → Trial done → Final approved to start. Tap a step: **Done** (today's date, change it if needed), its own **notes**, **attachments** and **tasks**; rename or delete it (Undo). **+ Add step** for your own (e.g. "Dupatta dyed").
  - **Moodboard:** photos, videos, links, documents and text — **+ Add attachment** or **From Vault** to reuse one. Each keeps its unique ID, ⭐, vendor and task. In the Vault it shows as "Mehndi › Bride outfit › Mehndi lehenga".
  - **Accessories:** Maang tikka, Kaleere, Juttis… — each with its own attachments, notes and tasks.
  - **Notes** (who wrote it, when) and **Tasks** (they also show in the workspace strip, Tasks, Calendar and Home).
  - **Rename** (✏️) and **Delete outfit** — the timeline, accessories, notes and moodboard links go with it, one **Undo** brings everything back. Its tasks stay.
- **Fixed:** the timeline step's Done switch now moves at once (it waited for the server before).

## Phone checks on staging — Android and iPhone, from the Home Screen icon
Logins (password `demo-1234`): Mahi 98290 00002 · Ayush 98290 00001 · Papa 98290 00004.

| # | Do | Pass when |
|---|---|---|
| B1 | Workspace → Mehndi | Bride outfit shows "Mehndi lehenga" (demo) with "1 of 4 steps done" |
| B2 | Groom outfit → Add outfit → "Sherwani" | Opens the new outfit with 4 steps |
| B3 | Tap Stitched → Done | Today's date; card on Mehndi shows 2 of 4 |
| B4 | Add step "Safa bandhai" → it is 5th; tap it → Delete step → Undo | Comes back |
| B5 | Moodboard → Add attachment → Photo → Take photo | Photo in the grid with an ATT number; Vault shows "Mehndi › Groom outfit › Sherwani" |
| B6 | Moodboard → From Vault → pick the Mehndi decor link | It appears on the moodboard (same ID) |
| B7 | Add accessory "Safa" → open → note + attachment + Add task | All three show in the sheet; the task is in Tasks and the Mehndi strip |
| B8 | Delete outfit → Undo | The outfit comes back with steps, accessory, notes and moodboard |
| B9 | Papa → Workspace | Not visible (as before) |

## Live — release checklist
1. Settings → Safety all green. 2. **Backup now**. 3. Save `deploy-session14c.zip` to Drive.
4. **Run `006_outfits.sql` on live**. 5. Upload `live/` in order, `version.json` last.
6. Health `ok`; "New version available" → This phone says 1.0.18.
7. If anything fails: upload `deploy-session14b.zip` (`live/`). The new tables can stay.
