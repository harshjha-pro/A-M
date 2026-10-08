# Release notes — Session 01 · Scaffold · version 1.0.1

**Goes to:** STAGING only (`staging-wedding.lumorrahouse.com`). Live opens in Session 4.
**Migrations:** first time — run `001`, `002`, `003`, then `STAGING-ONLY_seed_demo.sql` on the **staging** database.
**.env:** new file `private/.env` (first time). See step 4.

## What's in this build
- PHP API skeleton: router, JSON errors, safety headers, `GET /api/v1/health`, `POST /api/v1/client-log`.
- App shell: bottom nav (Home · Calendar · Tasks · Guests · More), empty Release 1 pages, ivory theme, light/dark from the phone.
- `.htaccess`: HTTPS only, only our two addresses, secrets never served, `/api` routing, deep links.
- Nothing can be saved yet (log in arrives in Session 2). No offline / install features yet (Sessions 12–14).

## Upload, first time (≈ 45 minutes, on a computer)
`<site>` below = `staging-wedding.lumorrahouse.com`. `u000000000` = your Hostinger user (shown in File Manager's path bar).

1. **Create the website** — hPanel → **Websites → Add website** → empty PHP/HTML site → *use an existing domain* → `staging-wedding.lumorrahouse.com`. Wait 5–10 min. File Manager must show `domains/staging-wedding.lumorrahouse.com/public_html/`. If hPanel only offers *Domains → Subdomains*, stop and tell Claude.
2. **SSL + HTTPS** — Websites → Manage (staging) → **Security → SSL** → Install the free certificate if not Active → turn **Force HTTPS** on.
3. **PHP** — Manage → **Advanced → PHP Configuration**: version **8.3**; Extensions: tick `pdo_mysql, mbstring, intl, gd, zip, curl, openssl, fileinfo, sodium`; Options: `display_errors` **Off**, `upload_max_filesize 12M`, `post_max_size 16M`, `memory_limit 256M`, `max_execution_time 300`. Save each tab.
4. **Database + .env**
   - Manage → **Databases → Management** → new database `amstaging`, user `amstaging`, a generated 20+ character password (save it in your password manager). Real names get your prefix: `u000000000_amstaging`.
   - File Manager → open `domains/<site>/` (the folder that **contains** `public_html`) → **New folder** `private`.
   - Inside `private` → **New file** `.env` → paste the contents of `.env.example` (in the project ZIP) → change these lines → Save:
     ```
     APP_ENV=staging
     APP_URL=https://staging-wedding.lumorrahouse.com
     DB_NAME=u000000000_amstaging
     DB_USER=u000000000_amstaging
     DB_PASS=<the database password>
     STORAGE_ROOT=/home/u000000000/domains/staging-wedding.lumorrahouse.com/private/storage
     LOG_DIR=/home/u000000000/domains/staging-wedding.lumorrahouse.com/private/logs
     BACKUP_EXPECTED=false
     ```
     Leave `SETUP_TOKEN`, SMTP and VAPID lines as they are for now.
   - Right-click `.env` → **Permissions** → `600`. Right-click `private` → Permissions → `700`. (Turn on *Show hidden files* if `.env` disappears from view.)
5. **phpMyAdmin** (Databases → phpMyAdmin → Enter, on `u000000000_amstaging`) → **Import** each file from `migrations/` in this order, Character set **utf-8**, *Enable foreign key checks* ticked, **Go**:
   1. `001_init.sql` 2. `002_open_answers.sql` 3. `003_api_support.sql` 4. `STAGING-ONLY_seed_demo.sql`
   Then **SQL** tab → `SELECT version, name, finished_at FROM schema_migrations;` → 3 rows, each with a date in `finished_at`.
   **Never run `STAGING-ONLY_seed_demo.sql` on the live database.**
6. **Upload the files** — File Manager → `domains/<site>/` → New folder `_incoming` → open it → **Upload** `deploy-session01.zip` → right-click → **Extract** (here).
   1. Open `_incoming/deploy-session01/staging/`.
   2. Right-click `1-server.zip` → Extract → destination `domains/<site>/` (the site folder, **not** public_html) → overwrite Yes.
   3. Same for `2-assets.zip`, then `3-shell.zip`.
   4. **Copy** `version.json` → into `domains/<site>/public_html/` → overwrite Yes. *(Always last.)*
   5. In `public_html/`, delete Hostinger's placeholder file if there is one (`default.php`, or an `index.php` directly in `public_html` — **not** `public_html/api/index.php`).
   6. Delete the `_incoming` folder.
   7. Check `private/` now has `app/`, `logs/`, `storage/` and your `.env`; set `private/logs` and `private/storage` permission `700`.

## Checks (Android Chrome **and** iPhone Safari)
| # | Do | Pass when |
|---|---|---|
| 1.1 | Open `https://staging-wedding.lumorrahouse.com` | Padlock; Home says **A&M Wedding — version 1.0.1**; *Server: ✓ Connected*; text big and easy to read |
| 1.2 | Open `https://staging-wedding.lumorrahouse.com/api/v1/health` | Shows `{"status":"ok"}` |
| 1.3 | Open `…/.env`, `…/private/`, `…/private/.env`, `…/api/.env` | "Not Found" (or Forbidden). Never any text like `DB_PASS` |
| 1.4 | Type `http://staging-wedding.lumorrahouse.com` (no s) | Jumps to `https://` |
| 1.5 | On a computer: securityheaders.com → the staging address | HSTS, Content-Security-Policy, X-Content-Type-Options, X-Frame-Options, Referrer-Policy present (grade A expected) |
| 1.6 | Tap each bottom tab | Each opens its page; the active tab has a pink pill **and** a bold word |
| 1.7 | More → Money → **← Back** | Back on More |
| 1.8 | Open `…/tasks` directly (paste the link) | Tasks page opens (no error page) |
| 1.9 | Phone dark mode on, reopen | App turns dark, text still clear |
| 1.10 | iPhone: Settings → Display → Text Size bigger. Android: Settings → Font size bigger. Reopen | App text grows; nothing cut off |

**If 1.1 shows "Not reachable" or 1.2 shows `{"status":"fail"}`:** the database values in `private/.env` are wrong, or step 5 wasn't finished. File Manager → `private/logs/php-error.log` → copy the last 3 lines into the next chat.
**If you see a Hostinger page instead of the app:** `3-shell.zip` was extracted into the wrong folder, or `public_html/default.php` is still there.
**If you see "500" or a blank page on `/api/v1/health`:** PHP version is below 8.2 (step 3), or `1-server.zip` was extracted inside `public_html` instead of the site folder.

## Old files to delete later
None (first deploy).
