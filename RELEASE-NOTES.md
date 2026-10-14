# Release notes — Fix: Workspace error + Workspace for everyone · version 1.0.21

**Goes to:** STAGING (and the Vercel test copy) first.
**Migrations:** none new. **But the Workspace needs migrations `004` → `008` imported** (see below) — that is what the error was.
**.env / hPanel / `.htaccess`:** no change.

## The bug you saw ("Something went wrong on our side" on Workspace)
The database the app uses had not had the newer migration files imported yet (`005_workspaces_vault.sql` … `008_contacts_timeline.sql`), so the Workspace tables did not exist. The app should have told you that, but it hid it: its "expected database version" was still 3, so the health check said everything was fine.

Fixed:
- A screen that needs a table that is not there now says exactly what to do, e.g. **"The database needs an update before this works: import migrations 005 to 008 in phpMyAdmin, in order."**
- Health and **Settings › Safety** now show red ("database behind") until all migrations are in.
- Everything else (login, guests, tasks, money…) keeps working meanwhile.
- A test proves the old behaviour (the general error) and the new message.

**To make Workspace work:** phpMyAdmin → Export (backup) → Import, in this order, only the ones not done yet: `004_home_photos.sql`, `005_workspaces_vault.sql`, `006_outfits.sql`, `007_decor_menu.sql`, `008_contacts_timeline.sql`. Check: `SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;` → **8**. (If one says "Duplicate entry", it was already imported — go on with the next.)

## Workspace for everyone (your request)
- **Everyone** who logs in now has **Workspace** in the bottom bar (Guests and the Attachment Vault are in More).
- **Owner, partner and family** members can add and change things; **view-only** people can look.
- **Private documents** (and payment receipts for people without money access) stay hidden in the Vault, as in Documents.
- Adding new tasks is still Ayush and Mahi only (your earlier rule).
- It is one switch in the code, so it can go back to "Ayush and Mahi only" any time.

## Upload order (same as before)
`1-server.zip` → `2-assets.zip` → `3-shell.zip` → **`version.json` last**.

## Phone checks
| # | Do | Pass when |
|---|---|---|
| F1 | Before importing 005–008: Mahi → Workspace | The message says which migrations to import (not "Something went wrong") |
| F2 | Import 004–008 → Workspace | The 7 workspaces show |
| F3 | Papa (98290 00004) → Workspace → Mehndi | Opens; he can add a timeline step |
| F4 | A view-only login → Workspace | Opens; saving shows "You don't have permission to do this." |
| F5 | Papa → More → Attachment Vault | A document marked Private in Documents is not listed |
| F6 | Settings › Safety (Ayush) after the imports | Database green |
