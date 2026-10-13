# Release notes — Workspace (step A) + Attachment Vault · version 1.0.17

**Goes to:** STAGING (and the Vercel test copy) first. Live after the phone checks below pass.
**Migrations:** **`005_workspaces_vault.sql` — run it in phpMyAdmin BEFORE uploading the server files.** (If 004 was never run, run `004_home_photos.sql` first.)
**.env / hPanel / `.htaccess`:** no change.

## Run the migration first (≈ 2 minutes)
1. phpMyAdmin → your database → **Export** → Quick → SQL → Go (keep the file).
2. **Import** → `migrations/005_workspaces_vault.sql` → Character set **utf-8** → **Go**.
3. Check: `SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;` → **5**.
   Running it twice stops at the first line and changes nothing.

The Vercel test copy uses the same database: this one import covers it. **Until it is run, uploading a document fails** (it now also goes into the Vault) and Workspace / Vault show an error.

## Upload order (same as before)
`1-server.zip` → `2-assets.zip` → `3-shell.zip` → **`version.json` last**. Keep old `assets/` 14 days.

## What's new (Ayush and Mahi)
- **Workspace** replaces Guests in the bottom bar. **Guests** and the **Attachment Vault** are in **More**. Family and viewers see no change.
- **7 workspaces ready:** Engagement, Mehndi, Carnival, DJ Night, Mayra, Reception, Varmala & Phere — linked to their calendar event where there is one. **+ Add workspace**, rename, link to an event, delete (Undo; its tasks stay).
- **Inside a workspace:**
  - **Tasks** strip at the top (scroll sideways; tap to open). **+ Add task** makes a task that belongs to this workspace — it also shows in Tasks, Calendar and Home.
  - **Files:** add a photo, video, document, link or text — used here at once.
  - The other sections (Bride outfit, Groom outfit, Family outfits, Theme & decoration, Menu, Contacts, Guest details, Event timeline) are marked "Coming in the next update".
- **Calendar:** an event with a workspace shows a **Workspace** badge; the event page has **Open workspace**.
- **Attachment Vault:** every attachment in the app, including your Documents.
  - Each shows its **ID**, title, ⭐, and **where it is used** (tap to jump there).
  - Search by ID, title or note; filter by type, ⭐ Favourites, Not linked yet, workspace.
  - **The ID is editable and unique across the app** (letters, numbers, - and _; capitals ignored). It is checked while you type: "ID … is already used by '…' (Mehndi › Files)".
  - **Use in a workspace** adds it to another place (same ID). **✕** removes it from one place only (Undo). **Delete everywhere** removes it from all places (Undo). Documents are changed and deleted in Documents.
  - Shows how full the database is; warns past 2.5 GB of the 3 GB.
- **No size limit set by the app:** big files (videos) go up in 2 MB pieces; a weak signal resends only the missing pieces; the same file twice is not sent again.

## Phone checks on staging — Android and iPhone, from the Home Screen icon
Logins (password `demo-1234`): Ayush 98290 00001 · Mahi 98290 00002 · Papa 98290 00004.

| # | Do | Pass when |
|---|---|---|
| W1 | Ayush → bottom bar | Home · Calendar · Tasks · **Workspace** · More. More has Guests and Attachment Vault |
| W2 | Workspace | The 7 cards; Mehndi shows its date |
| W3 | Mehndi → + Add task → type → Save | Back on Mehndi; the task is in the strip; also in Tasks |
| W4 | Mehndi → Add attachment → Photo → Take photo | Photo appears in Files with an ATT number |
| W5 | Add attachment → Video → choose a 1–2 minute video | "Uploading… n%", then it appears; open it in the Vault → it plays (iPhone too) |
| W6 | Vault → open the photo → change ID to `BRIDE-TEST-01` → Save; on another attachment type `bride-test-01` | Second one says "already used by …" |
| W7 | Vault → photo → Use in a workspace → Reception · Theme & decoration → Add here | "Where it is used" lists both; ✕ on one → Undo brings it back |
| W8 | Calendar → Mehndi event | Workspace badge; event page → Open workspace |
| W9 | Papa → bottom bar | Guests is still there; no Workspace; More has no Vault |

## Live — release checklist
1. Settings → Safety all green. 2. **Backup now** (SSH `backup.php --kind=manual_db`). 3. Save `deploy-session14b.zip` to Drive.
4. **Run `005_workspaces_vault.sql` on live** (steps above). 5. Upload `live/` in order, `version.json` last.
6. Health `ok`; "New version available" → This phone says 1.0.17.
7. If anything fails: upload `deploy-session14a.zip` (`live/`). The new tables can stay; 1.0.16 doesn't read them (document upload in 1.0.16 doesn't use them either).
