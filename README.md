# A&M Wedding Planner

Private planner PWA for Ayush & Mahi's wedding (Bhilwara, 14–16 Feb 2027).
**Source of truth:** [`docs/CONTEXT.md`](docs/CONTEXT.md). Build plan: [`docs/IMPLEMENTATION.md`](docs/IMPLEMENTATION.md).

| Folder | What |
|---|---|
| `api/` | PHP 8.2+ REST API, no framework. Deployed to `private/app/` on Hostinger. Tests: `api/tests` (PHPUnit). |
| `web/` | React + Vite + Tailwind app. Tests: Vitest (`src/**/*.test.*`), Playwright smoke (`web/e2e`). |
| `public_html/` | Server files for the web root: `.htaccess`, `assets/.htaccess`, `api/index.php` (3 lines). |
| `db/migrations/` | `001`, `002`, `003` … run in order in phpMyAdmin. Never edit an applied file. |
| `db/dev/seed_demo.sql` | Demo data for **staging only**. |
| `db/test/fixtures.sql` | Small data for automated tests. |
| `scripts/` | Runs on Hostinger (backup, cron) — from Session 4. |
| `tools/` | Runs only in the build sandbox: setup, tests, packaging, `router.php`. |
| `docs/` | Project documents, `openapi.yaml`, `SESSION-LOG.md`. |

## In the build sandbox
```bash
tools/sandbox-setup.sh                 # MySQL 8, Apache, Composer + npm packages
tools/test-all.sh "Session NN — name"  # every suite → TEST-REPORT.md
tools/make-deploy.sh NN out/           # deploy-sessionNN.zip (see RELEASE-NOTES.md)
tools/make-source-zip.sh NN out/       # project-source-sessionNN.zip
```

Secrets never go in Git or a ZIP: copy `.env.example` to `private/.env` on the server.
