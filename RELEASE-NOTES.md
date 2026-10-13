# Release notes — Workspace step D: contacts, guest details, event timeline · version 1.0.20

**Goes to:** STAGING (and the Vercel test copy) first. Live after the phone checks below pass.
**Migrations:** **`008_contacts_timeline.sql` — run it in phpMyAdmin BEFORE uploading the server files.** (If you skipped earlier ones, run them first in order: `004_home_photos.sql`, `005_workspaces_vault.sql`, `006_outfits.sql`, `007_decor_menu.sql`.)
**.env / hPanel / `.htaccess`:** no change.

## Run the migration first (≈ 2 minutes)
1. phpMyAdmin → your database → **Export** → Quick → SQL → Go (keep the file).
2. **Import** → `migrations/008_contacts_timeline.sql` → Character set **utf-8** → **Go**.
3. Check: `SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;` → **8**.

The Vercel test copy uses the same database: this one import covers it. Until it is run, opening a workspace shows an error.

## Upload order (same as before)
`1-server.zip` → `2-assets.zip` → `3-shell.zip` → **`version.json` last**.

## What's new (Ayush and Mahi) — every workspace section is now built
- **Contacts:** **+ Add contact** picks one of your vendors, with a role here (e.g. "Stage lights"). Each shows category, role and phone with **Call** and **WhatsApp**. One vendor can be a contact in many workspaces; the vendor's page shows **Contact in: Mehndi, Reception…**. Tap › to change the role or **Remove from this workspace** (the vendor stays; Undo).
  **Also used here** lists vendors already connected to the workspace (caterer, decor item, outfit tailor, attachments, tasks) with **+** to add them as contacts.
- **Guest details:** for the linked calendar event — families invited, coming, not coming, waiting; people coming (adults, children, Jain) and "up to" with those still waiting. **Open in Guests** opens that event's guest list. **Guest notes** for seating, VIPs, pickups.
- **Event timeline:** each workspace starts with **suggested steps** (e.g. Varmala & Phere: Baraat arrival → Varmala → Dinner → Phere → Vidaai). Each step has a **purpose**, a **duration** and an optional **time**; give the first step a time and the rest show **≈ times** automatically, with the total length on top. Tap a step to edit it, add a note, attachments and tasks, **Move up / Move down** or **Delete** (Undo). **+ Add step**; a new workspace gets **Add suggested steps**.

## Phone checks on staging — Android and iPhone, from the Home Screen icon
Logins (password `demo-1234`): Mahi 98290 00002 · Ayush 98290 00001 · Papa 98290 00004.

| # | Do | Pass when |
|---|---|---|
| D1 | Workspace → Mehndi → Contacts | Rekha Mehndi Art · Bride's mehndi; Call opens the dialer, WhatsApp opens the chat |
| D2 | Add contact → Fresh Flowers Co. → role "Flowers" → Save | It shows; Money › Vendors › Fresh Flowers Co. says "Contact in: Mehndi · Flowers" |
| D3 | Tap › on it → Remove from this workspace → Undo | It comes back |
| D4 | Reception → Also used here shows Annapurna Caterers (Caterer) → + | It moves up into Contacts |
| D5 | Mehndi → Guest details | Counts show; the demo guest notes show; Open in Guests opens the Mehndi list |
| D6 | Reception → Event timeline | Couple entry 7:30 PM, next steps ≈ 7:45 PM …; Total 4 h |
| D7 | Tap Dinner → Time 22:00 → Save | Dinner 10:00 PM; Send-off ≈ 11:30 PM |
| D8 | Add step "Cake cutting", 10 min → open it → Add task → Save task | Back on Reception; the step shows ✓ 1 |
| D9 | Cake cutting → Move up, then Delete step → Undo | Moves; comes back |
| D10 | Workspace list → Add workspace "Haldi" → Event timeline → Add suggested steps | Guests arrive, Main ceremony, Food |
| D11 | Papa → Workspace | Not visible (as before) |

## Live — release checklist
1. Settings → Safety all green. 2. **Backup now**. 3. Save `deploy-session14e.zip` to Drive.
4. **Run `008_contacts_timeline.sql` on live**. 5. Upload `live/` in order, `version.json` last.
6. Health `ok`; "New version available" → This phone says 1.0.20.
7. If anything fails: upload `deploy-session14d.zip` (`live/`). The new tables and column can stay.
