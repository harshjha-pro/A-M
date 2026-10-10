# Vercel — test hosting only

Owner's choice (10 Oct 2026): try the app on Vercel for testing first; the real home stays
**Hostinger** (backups, file storage, cron jobs — CONTEXT, DATA-SAFETY). Nothing here changes the
Hostinger deploy ZIPs.

## What runs where
| Part | On Vercel |
|---|---|
| Screens (React build) | `web/dist-staging`, built by Vercel from Git (`vercel.json`) |
| PHP API | One function `api/vercel.php` on the community runtime `vercel-php@0.7.4` (PHP 8.3), region `bom1` (Mumbai). `/api/v1/*` is routed to it, so the app and its API share one address (cookies and CSRF work as on Hostinger). |
| Database | **Your MySQL on Hostinger**, reached over the internet (Remote MySQL) |

## Limits — why this is for testing only
- **Uploaded photos and PDFs are not kept** (no permanent disk on Vercel; `STORAGE_ROOT=/tmp/...`). Exports likewise.
- **No nightly backup, watchdog, reminders or clean-up jobs** (they are Hostinger cron jobs).
- Every request opens a new database connection over the internet: a little slower than Hostinger.
- The database must accept outside connections (Remote MySQL). Use the **staging** database and a long password; remove the remote access when testing ends.

## Environment variables (Vercel → Project → Settings → Environment Variables)
Set by Claude (no secrets): `APP_ENV=staging`, `APP_URL=https://<project>.vercel.app`, `STORAGE_ROOT=/tmp/am-storage`,
`LOG_DIR=/tmp/am-logs`, `TRUSTED_PROXY=X-Forwarded-For`, `MIN_CLIENT_VERSION=1.0.0`, `BACKUP_EXPECTED=false`,
`MAIL_ENABLED=false`, `ALERTS_ENABLED=false`.

**You add yourself** (never in chat, Git or a ZIP): `DB_HOST` (the Remote MySQL host name from hPanel), `DB_PORT=3306`,
`DB_NAME`, `DB_USER`, `DB_PASS`, and — only if the database has no owner yet — `SETUP_TOKEN`.

## Hostinger side
hPanel → Databases → **Remote MySQL** → add host `%` (any) for the staging database. Vercel's addresses change, so a fixed IP can't be used.
The database needs migrations 001–003 (DATABASE §6) — already there if staging was set up in Session 4.

## Moving to Hostinger later
Upload `deploy-session14.zip` → `staging/` (or `live/`) as in RELEASE-NOTES. Then remove the Remote MySQL `%` entry.
