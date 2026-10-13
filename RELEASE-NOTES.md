# Release notes — Workspace step C: family outfits, decoration, menu · version 1.0.19

**Goes to:** STAGING (and the Vercel test copy) first. Live after the phone checks below pass.
**Migrations:** **`007_decor_menu.sql` — run it in phpMyAdmin BEFORE uploading the server files.** (If you skipped earlier ones, run them first in order: `004_home_photos.sql`, `005_workspaces_vault.sql`, `006_outfits.sql`.)
**.env / hPanel / `.htaccess`:** no change.

## Run the migration first (≈ 2 minutes)
1. phpMyAdmin → your database → **Export** → Quick → SQL → Go (keep the file).
2. **Import** → `migrations/007_decor_menu.sql` → Character set **utf-8** → **Go**.
3. Check: `SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;` → **7**.

The Vercel test copy uses the same database: this one import covers it. Until it is run, opening a workspace shows an error.

## Upload order (same as before)
`1-server.zip` → `2-assets.zip` → `3-shell.zip` → **`version.json` last**.

## What's new (Ayush and Mahi)
- **Family outfits** in every workspace, in four groups: Close family · Female, Close family · Male, Extended family · Female, Extended family · Male. **+ Add outfit** in a group (e.g. "Mama ji – Safa"); it opens the same page as the bride's outfit (timeline, moodboard, accessories, notes, tasks).
- **Theme & decoration:**
  - **Theme** name and colours (✏️ to edit) and a **Theme board** of photos, links and files from the Vault.
  - **Decor items** (Stage, Entry gate, Mandap…): each has its own **timeline** Booked → Sample seen → Final approved → Set up (add / rename / delete steps, a date on each), moodboard, **props** (Marigold strings, Umbrellas…), notes, tasks and the **decorator** (vendor).
- **Vendor on outfits too** — pick the tailor on any outfit page.
- **Menu:**
  - **Caterer** (from your vendors).
  - **Categories** (Starters, Main course, Desserts…) and **dishes**: **Normal or Jain**, ⭐ must-have, a short note. Tap a dish for its attachments (dish photo) and tasks (Add task comes back to the menu); edit or delete it (Undo).
  - **Menu files** (the caterer's PDF, photos) from the Vault.
  - **Copy menu from…** another workspace: categories with the same name get the dishes they don't have; the rest come as new categories. One **Undo** takes the whole copy back.
- In the Vault, files show where they are used, e.g. "Reception › Menu › Paneer tikka" and "Mehndi › Theme & decoration › Stage".

## Phone checks on staging — Android and iPhone, from the Home Screen icon
Logins (password `demo-1234`): Mahi 98290 00002 · Ayush 98290 00001 · Papa 98290 00004.

| # | Do | Pass when |
|---|---|---|
| C1 | Workspace → Mehndi → Family outfits → Close family · Male → Add outfit "Mama ji – Safa" | Opens with 4 steps; back on Mehndi it is under Close family · Male |
| C2 | Theme & decoration shows "Garden mehndi" (demo) → ✏️ → change colours → Save theme | New colours show |
| C3 | Tap "Stage" (demo) | Timeline Booked (done) → Sample seen → Final approved → Set up; vendor Shree Tent House; prop Marigold strings |
| C4 | Add decor item "Entry gate" → Add prop "Umbrellas" → Vendor (contact) → Fresh Flowers Co. | Card on Mehndi shows Entry gate · Fresh Flowers Co. |
| C5 | Theme board → Add attachment → Photo | Photo in the board; Vault says "Mehndi › Theme & decoration" |
| C6 | Workspace → Reception → Menu | Caterer Annapurna Caterers; Starters (Paneer tikka ⭐, Hara bhara kabab Jain), Desserts |
| C7 | Add dish to Starters "Dahi kabab", Jain, ⭐ → Save; tap it → Add task "Taste" → Save task | Back on Reception; the task is in the strip; the dish shows ✓ 1 |
| C8 | Mehndi → Menu → Copy menu from… → Reception → Copy menu | Starters and Desserts appear; tap **Undo** → gone again |
| C9 | Delete a menu category → Undo | It comes back with its dishes |
| C10 | Papa → Workspace | Not visible (as before) |

## Live — release checklist
1. Settings → Safety all green. 2. **Backup now**. 3. Save `deploy-session14d.zip` to Drive.
4. **Run `007_decor_menu.sql` on live**. 5. Upload `live/` in order, `version.json` last.
6. Health `ok`; "New version available" → This phone says 1.0.19.
7. If anything fails: upload `deploy-session14c.zip` (`live/`). The new tables and columns can stay.
