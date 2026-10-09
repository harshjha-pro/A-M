# Release notes — Session 04 · Live site + nightly backup · version 1.0.4

**Goes to:** STAGING first (standard upload), then the new **LIVE** site `wedding.lumorrahouse.com` (first time).
**Migrations:** none new. On the **live** database you run `001` → `002` → `003` once — they are in this ZIP's `migrations/` folder (the same files staging got in Session 1). **Staging: run nothing.** **Never run `seed_demo.sql` on live.**
**.env:** staging — no change. Live — a new `.env` (step A5 below).
**Time:** about 2 hours, on a computer. Do it in one sitting, in this order.

## What's new
- **Nightly encrypted backup** (`private/backup/backup.php`, live only): at 2:17 AM IST the database is dumped, compressed, locked with your backup key (AES-256) and sent to Backblaze B2, together with any new uploaded photo/PDF. Each night's file is opened again and checked before it counts. Old copies are thinned out (30 daily, 12 weekly, every monthly) but never deleted by our server.
- **Watchdog** every 6 hours: emails you both if there has been no good backup for 36 hours.
- **Alert emails over SMTP** from `planner@lumorrahouse.com` (inbox, not spam), with a daily cap of 30 so nothing can ever flood you.
- **Daily clean-up** (`private/cron/daily.php`, both sites, 3:00 AM IST): clears old logins and temporary rows, deletes 24-hour export files, keeps 8 weeks of logs, and emails you a short **error digest only if** something went wrong that day.
- Activity now says "Nightly backup saved off-site."

## A. The live site (hPanel) — once
| # | Do | Detail |
|---|---|---|
| A1 | New website | hPanel → **Websites → Add website** → empty PHP/HTML site → existing domain `wedding.lumorrahouse.com`. Wait 10 min. File Manager must show `domains/wedding.lumorrahouse.com/public_html/`. |
| A2 | SSL | Websites → Manage (live) → **Security → SSL** → install the free certificate → **Force HTTPS** on. |
| A3 | PHP | **Advanced → PHP Configuration**: version **8.3**; extensions and options exactly as you did for staging (IMPLEMENTATION §6.3–6.4). |
| A4 | Database | **Databases → Management** → database `amlive`, user `amlive`, a 20+ character password from the password manager. Save the full names (`u…_amlive`). |
| A5 | Folders + `.env` | In `domains/wedding.lumorrahouse.com/` (beside `public_html`): folder `private` (permission 700) → inside it a new file `.env` → paste `.env.example` and fill it in for **live**: `APP_ENV=live`, `APP_URL=https://wedding.lumorrahouse.com`, the `u…_amlive` DB name/user/password, the live `STORAGE_ROOT` and `LOG_DIR` paths, a **long random `SETUP_TOKEN`**, `BACKUP_EXPECTED=false` (**for now** — step D4 turns it on), `ALERTS_ENABLED=true`, `ALERT_TO=` your two Gmail addresses (comma between), `SMTP_PASS=` the planner mailbox password (step B1). Permission **600**. |
| A6 | Migrations | **Databases → Enter phpMyAdmin** → check the name top-left is `u…_amlive` → **Import** `001_init.sql`, then `002_open_answers.sql`, then `003_api_support.sql`. Then SQL tab: `SELECT * FROM schema_migrations;` → 3 rows, all with `finished_at`. |
| A7 | Upload | Standard upload, but from the **`live/`** folder of `deploy-session04.zip`: `_incoming` → extract → `live/1-server.zip`, `2-assets.zip`, `3-shell.zip` into the site folder (overwrite Yes) → `live/version.json` into `public_html/` last → delete `_incoming`. |
| A8 | Check | `https://wedding.lumorrahouse.com/api/v1/health` → `{"status":"ok"}`. |
| A9 | You (Owner) | On your phone: `https://wedding.lumorrahouse.com/setup` → your name, phone, password + the `SETUP_TOKEN` → you are in. **Then delete the `SETUP_TOKEN` line from the live `.env`.** |
| A10 | Mahi | Settings → Members → Add member → Mahi, **Partner**, **Send a link** → Share on WhatsApp → she sets her password. |

## B. Email — once (IMPLEMENTATION §7)
| # | Do |
|---|---|
| B1 | hPanel → **Emails** → `lumorrahouse.com` → create `planner@lumorrahouse.com` (password from the password manager). If the domain already has Google/Zoho email (MX records), **stop and tell me** first. |
| B2 | DNS: one SPF TXT `@` = `v=spf1 include:_spf.mail.hostinger.com ~all` (edit the existing one if there is one); DKIM via Emails → "Set up automatically"; DMARC TXT `_dmarc` = `v=DMARC1; p=none; rua=mailto:planner@lumorrahouse.com; adkim=r; aspf=r`. |

## C. Backblaze B2 — once (DATA-SAFETY §3.2)
Account with 2FA → bucket `am-wedding-backups-<4 letters>`, **Private**, encryption on, **Object Lock on, 30 days Governance** → lifecycle "days till delete" 30 → application key **only for that bucket**, Read and Write. Save Bucket ID, keyID and applicationKey in the password manager.

## D. The backup on the server — once (DATA-SAFETY §3.4, cards S1–S16)
| # | Do |
|---|---|
| D1 | File Manager → `domains/wedding.lumorrahouse.com/private/backup/` → right-click `config.example.php` → **Copy** → name `config.php` → **Edit**: fill every `PASTE-…` value and the paths (`u…` username) from the password manager → Save → Permissions **600**. Folder `backup` → **700**. |
| D2 | SSH cards **S1–S10** (connect, `which php`, `php -v`, `mysqldump --version`, `openssl version`, `date`, `date -u`, `ls ~/domains/`). **S11** now shows **three** `-rw-------` lines: `backup.php`, `config.example.php`, `config.php` — that's correct. |
| D3 | **S12** `--make-key` → **save the long line in the password manager as "A&M backup key" AND on paper at home. Without it no backup can ever be opened.** Then **S13** `--test-email` (both inboxes; mark Not spam if needed; "Show original" → SPF/DKIM/DMARC PASS) → **S14** first run → last line `Done in … s.` → **S15** `exit`. |
| D4 | Now edit the live `.env`: `BACKUP_EXPECTED=true`. (Before the first good backup this would make health say "fail".) |
| D5 | **Cron jobs** (hPanel → live site → Advanced → Cron Jobs). If S9 said the server is on UTC: backup `47 20 * * *`, watchdog `23 */6 * * *`, daily clean-up `30 21 * * *`. On IST: backup `17 2 * * *`, watchdog `23 */6 * * *`, daily `0 3 * * *`. Commands: IMPLEMENTATION §6.10 (copy them exactly, replace `<u>` with your username). |
| D6 | **Staging** gets the daily clean-up cron only (no backup — demo data): §6.10 staging row. |
| D7 | **UptimeRobot** (free): HTTP(s) monitor on `https://wedding.lumorrahouse.com/api/v1/health`, every 5 min, alerts to both emails. Optional second monitor for staging. |
| D8 | **Restore drill #0** (practice, DATA-SAFETY §4.2) on tonight's tiny backup. Log it in the app: Settings → Safety → Log a restore drill. |

## Staging upload (first, ≈ 10 minutes)
Standard upload from the **`staging/`** folder, as in Session 3. Nothing else changes on staging.

## Phone checks
| # | Check | Pass when |
|---|---|---|
| 4.1 | Live → Settings → **Safety** (both phones) | Backup **green**, last good backup a few minutes ago; Database and Storage green |
| 4.2 | **Next morning**: SSH card **S16** | Last line `Done in … s.` at about 2:17 AM IST; Safety still green; Backblaze `db/` shows 2 dumps |
| 4.3 | Email | The test alert is in the **inbox** for both of you; "Show original" says SPF, DKIM, DMARC **PASS** |
| 4.4 | Live `/api/v1/health` | `{"status":"ok"}`; UptimeRobot shows **Up** |
| 4.5 | Live Settings → Members | Only Ayush (Owner) and Mahi (Partner) |

**From the next morning (4.2 green), live is open for your real data:** tasks from Session 5, payments from Session 9 (IMPLEMENTATION §5.0). Before every later live upload: SSH card **B1** (a manual backup) first.

## If something goes wrong
- `FAILED:` in S14 or a **BACKUP FAILED** email → read the reason; DATA-SAFETY §10 "Backup failed". B2 401 = key in `config.php`; `mysqldump` error = DB password.
- Health says `fail` right after D4 → the first backup didn't finish; set `BACKUP_EXPECTED=false` again and redo S14.
- Anything else: send me the exact lines you see.
