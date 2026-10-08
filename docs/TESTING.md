# TESTING.md — How we prove the app works, is easy to use, and loses no data

Version 1.1 · 8 Oct 2026 · Owner: Ayush Porwal · v1.1 applies the owner's answers (see "Answers applied")
Reads from: `CONTEXT.md` v1.5 (source of truth), `FEATURES.md` v1.2, `DESIGN.md` v1.1, `API.md` v1.1, `PWA.md` v1.1, `DATA-SAFETY.md` v1.1, `DATABASE.md`, migrations `001`–`003`, `seed_demo.sql`.
Workflow this is written for: **all code is built by Claude in Claude chat, one session per chat. The project moves between chats as a ZIP. Nothing runs on your computer. Deploys are manual: hPanel File Manager for files, phpMyAdmin for the database.**

**The one rule for testing:** a feature is "done" only when an automated test proves it in the sandbox **and** the matching manual check passes on staging. A bug is "fixed" only when a test that failed before the fix passes after it.

---

## Conflicts flagged

| # | Topic | Sources say | This doc does |
|---|---|---|---|
| T1 | "Accessing another wedding's record" | Your brief asks for it. CONTEXT decision 1: one wedding, no `weddings` table. | **There is no other wedding to reach.** The same attack is tested as: reaching records your **role** can't see (money, private documents, other people's undo, admin endpoints), **deleted** records, and **numeric IDs** in URLs. §1.5. |
| T2 | Offline saving | FEATURES A0 and DESIGN §5/§8: "No queued writes", "You can look, but not save." CONTEXT decision 7 (v1.4) and PWA §5.2: limited outbox. | Tests follow **CONTEXT v1.4: the limited outbox.** FEATURES A0 and DESIGN offline text still need the update PWA.md listed. |
| T3 | Notifications in the device checklist | Your brief lists "notifications arrive when app closed". FEATURES Part C and PWA §7: notifications are **R2a (15 Nov)**, not the 25 Oct launch. | Kept in §4, marked **R2a gate**. Not a blocker for 25 Oct. |
| T4 | "Lighthouse PWA target" | Your brief. | **Lighthouse removed its PWA category in version 12 (2024).** We use Lighthouse for Performance, Accessibility and Best Practices, and our own installability checks (§7.3) instead. |
| T5 | "Record identical" after Undo | Your brief: delete → undo → identical. AC-UND-01 / AC-TRS-01: "version +1", audit "restored". | **Every business field and child row must be identical.** `version`, `updated_at` and `updated_by` change by design, and the audit log gains rows. §1.6 lists exactly which columns are compared. |
| T6 | SSH | Your workflow: File Manager + phpMyAdmin. DATA-SAFETY §4.2 and §5.1 use SSH for `php backup.php` (manual backup, decrypt). | **Answered: SSH is OK.** The release checklist (§8) uses the SSH commands. A phpMyAdmin export is only the fallback if SSH itself is down. |
| T7 | Front-end error logging | Your brief: error logging. API.md has no endpoint for phone-side errors. | **Answered: add it.** `POST /api/v1/client-log` sends phone-side errors to a server log file (spec in §9.3). Needs API.md v1.2. |
| T8 | Guest list size | Your brief: 800 guests. CONTEXT: ~1,800 people ≈ 500 families. | Rows in the app are **families**. We test **800 families** for smoothness (above the real count) and **2,000 families** as a stress test in the sandbox. |
| T9 | Staging holds real data during drills | DATA-SAFETY S3: real data on staging for ~1 hour during a restore drill. | **No manual or usability tests on staging during a drill.** The release checklist checks staging has demo data. |


## Answers applied (8 Oct 2026)

| # | Question | Answer | Applied in |
|---|---|---|---|
| 1 | SSH for backup and decrypt | OK | T6, §8.2 step 7 |
| 2 | Usability testers | "Assume yourself" → 4 named roles, 2 parents, 2 Android + 2 iPhone, 13–16 Oct | §5 |
| 3 | `POST /client-log` endpoint | OK | T7, §1.3, §9.3, Changes needed in other docs |
| 4 | Test phones | Popular phones → Samsung Galaxy A-series, Xiaomi Redmi Note, iPhone 13-class, iPhone SE | §1.8.1, §4, §7 |
| 5 | Uptime alert addresses | Ignore → alerts go to the monitor account's email (Ayush). Adding Mahi is optional. | §9.1 |
| 6 | Launch gate | "Assume yourself" → data-loss bugs block launch; launch may move up to 1 week | §3.2 |
| 7 | Daily error digest in `daily.php` | OK | §9.3 |
| 8 | MariaDB fallback in the sandbox | OK, but **prefer MySQL wherever possible** → MySQL tried 3 ways first; after a fallback, the DB tests also run on real MySQL on Hostinger before release | §1.1, §1.2.1, §8.2 step 1 |

---

## 0. How testing fits our chat-based workflow

### 0.1 One build session

```
New chat ─► upload project ZIP ─► Claude runs tools/sandbox-setup.sh
        ─► Claude runs the FULL suite first (proves the ZIP is healthy)
        ─► build the feature + its tests (test first for every bug fix)
        ─► full suite again ─► TEST-REPORT.md written into the project
        ─► new project ZIP + deploy ZIPs ─► you: staging checks (§2) ─► live (§8)
```

| Step | Who | Output |
|---|---|---|
| Start: setup + full suite | Claude | "Suite green at start: 412 PHP, 96 Vitest, 18 Playwright." If red, fix that **before** new work. |
| Build | Claude | Code + tests in the same commit-sized change |
| End: full suite | Claude | `TEST-REPORT.md` (§1.9) at the ZIP root, and a summary in chat |
| Staging | You | §2 checklist for the modules touched, plus the 5 core checks |
| Live | You | §8 release checklist |

### 0.2 Rules Claude follows every session

1. Never hand over a ZIP with a red test. If a test must be skipped, the report says which, why, and the manual check that replaces it.
2. Never weaken a test to make it pass. Changing an expected value needs a reason in the report.
3. Every bug report (§10) becomes a failing test first, then the fix.
4. Every endpoint in `openapi.yaml` must have at least one test (coverage gate, §1.3). New endpoint without a test = red build.
5. Tests never need the internet, except installing packages at setup.
6. Real guest data never enters the sandbox. Tests use fixtures and generated data only.

### 0.3 Folder layout

```
api/                       PHP API
api/tests/
  bootstrap.php            loads .env.test, builds the test DB
  Support/ApiClient.php    in-process requests with a cookie jar
  Support/Fixtures.php     makes users, families, tasks… in one line
  Support/FrozenClock.php  moves time (undo 10 min, link 72 h, export 24 h, purge date)
  Endpoints/               one test file per module (§1.3)
  Security/                §1.5
  DataSafety/              §1.6
  Coverage/EndpointCoverageTest.php
web/src/**/*.test.jsx      Vitest + Testing Library (§1.7)
e2e/                       Playwright (§1.8)
tools/sandbox-setup.sh     installs and starts everything (§1.1)
tools/test-all.sh          runs every suite, writes TEST-REPORT.md
tools/gen-families.php     makes N realistic families for perf tests
db/test/fixtures.sql       small base data for tests (not seed_demo)
```

---

## 1. Automated tests (Claude, every build session)

### 1.1 Sandbox setup

Claude's code-execution sandbox is a fresh Linux machine each chat. Its exact packages and network access can change, so **session 1 runs a check and records the result in `TEST-REPORT.md`**. Expected:

| Need | How | If not available |
|---|---|---|
| PHP 8.2+ with pdo_mysql, mbstring, intl, gd, zip, curl, openssl | `apt-get install php-cli php-mysql …` | Hard stop: report it. PHP tests can't be faked. |
| Database: **MySQL 8.0** (matches live; always tried first) | 1) `apt-get install mysql-server` 2) MySQL's own APT repository 3) the official MySQL 8.0 generic Linux tarball (`tools/install-mysql-tarball.sh`) | **MariaDB 10.11 only if all three fail** (migration `003` was tested on it). The report then says **"DB: MariaDB fallback"** in bold, and before that build goes live the database tests also run on real MySQL on Hostinger (§1.2.1). |
| Composer packages (PHPUnit 11, ZipStream, web-push later) | `composer install` from `composer.lock` | Ship `api/vendor/` inside the project ZIP (small, ~15 MB) |
| Node 20+ and npm packages | `npm ci` from `package-lock.json` | No fallback: `node_modules` is too big for the ZIP. Report it. |
| Playwright Chromium | `npx playwright install chromium` | Skip §1.8; report says "E2E not run"; you do the §2 core checks more carefully |
| Playwright WebKit | `npx playwright install --with-deps webkit` | Skip WebKit project. It is a bonus only (§1.8.3). |

`tools/sandbox-setup.sh` (outline):

```bash
#!/usr/bin/env bash
# Run once per chat. Safe to run twice.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== Versions ==" ; php -v | head -1 || true ; node -v || true

# 1. PHP + database
if ! command -v php >/dev/null; then
  apt-get update -qq && apt-get install -y -qq php-cli php-mysql php-mbstring php-intl php-gd php-zip php-curl php-xml unzip
fi
if ! command -v mysqld >/dev/null && ! command -v mariadbd >/dev/null; then
  # MySQL 8 first (matches live). MariaDB only as a last resort, and the report says so.
  apt-get install -y -qq mysql-server \
    || tools/install-mysql-tarball.sh \
    || { echo "WARN: MySQL 8 unavailable - MariaDB fallback"; apt-get install -y -qq mariadb-server; }
fi
(service mysql start || service mariadb start) >/dev/null

# 2. Test database and user (utf8mb4, strict mode as live)
mysql -uroot <<'SQL'
CREATE DATABASE IF NOT EXISTS am_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'am_test'@'localhost' IDENTIFIED BY 'am_test';
GRANT ALL ON am_test.* TO 'am_test'@'localhost';
SET GLOBAL sql_mode = 'STRICT_ALL_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO,ONLY_FULL_GROUP_BY';
SET GLOBAL time_zone = '+00:00';
SQL

# 3. Packages
(cd api && composer install -q --no-interaction)
(cd web && npm ci --silent)
(cd web && npx playwright install chromium) || echo "WARN: Playwright Chromium not installed"
(cd web && npx playwright install --with-deps webkit) || echo "INFO: WebKit not available"
echo "Setup done."
```

### 1.2 The test database

| Rule | Detail |
|---|---|
| Built from migrations | Every run drops `am_test` and applies `001` → `002` → `003` → … in order, exactly the files you run in phpMyAdmin. So a broken migration fails the build. |
| Second migration test | Each run also applies all migrations a **second** time and expects each to stop at its guard row (DATABASE §6). |
| Base data | `db/test/fixtures.sql`: 1 Owner (Ayush), 1 Partner (Mahi), Family with money (Papa), Family without money (Mummy), Viewer (Nani), 7 events, 3 categories, 2 vendors. Not `seed_demo.sql` (that one is for people on staging). |
| Isolation | The API commits for real (idempotency claims commit on their own, API §5.3), so tests can't wrap everything in a rollback. Each test class starts from a fresh copy: `fixtures.sql` is loaded once into a template, and tables are truncated and reloaded per class (< 0.3 s). |
| Time | All PHP code reads time from a `Clock` service. Tests use `FrozenClock` to jump 11 minutes (undo), 49 hours (idempotency expiry), 73 hours (invite link), 25 hours (export), or to 15 May / 16 May 2027 (purge). **No `sleep()` in tests.** |
| Requests | `ApiClient` sends requests to the front controller **in-process** (fast, no web server), with a real cookie jar, CSRF token, `Origin`, `Idempotency-Key` and `If-Match` helpers. One E2E project (§1.8) also runs over real HTTP to catch `.htaccess`/header problems. |
| Files | Uploads and exports go to a temp private root, deleted after each class. |

### 1.2.1 MySQL check on Hostinger (only after a MariaDB fallback)

If the sandbox had to use MariaDB, the database-sensitive tests run once on **real MySQL** before the build goes live. SSH is allowed (answer 1).

| Step | Detail |
|---|---|
| Once | hPanel → Databases → create `u…_amtest` with its own user. It is **never** the live or staging app database. |
| Upload | Claude hands over `mysql-check.zip`: `api/` + `vendor/` (with PHPUnit) + `tests/` + `.env.test` pointing at `u…_amtest`. Extract it to `private/mysql-check/` (outside `public_html`). |
| Run | SSH: `cd ~/domains/lumorrahouse.com/private/mysql-check && php vendor/bin/phpunit --testsuite=mysql-check` |
| Suite | Migrations (twice, guard), all of §1.6 (data safety), SEC-06/07/26, money totals, export. ~3 minutes. The suite empties `u…_amtest` itself. |
| Pass | 0 failed. Paste the last 20 lines into the next chat. |
| After | Delete `private/mysql-check/`. |

### 1.3 PHPUnit: every endpoint in API.md

**Coverage gate.** `EndpointCoverageTest` reads `openapi.yaml` (108 operations once `/client-log` is added) and every test method's `#[Endpoint('PATCH /households/{id}')]` attribute. Any operation with no test fails the build, and so does any test pointing at an operation that no longer exists.

**Every endpoint gets the standard set** (one data-provider test per endpoint, so new endpoints get them for free):

| # | Standard test | Expect |
|---|---|---|
| S1 | No session | `401 not_logged_in` (except the anonymous auth/setup/health/link/export-token endpoints) |
| S2 | Each role that must be refused | `403` with the right `code` (`forbidden`, `no_money_access`) |
| S3 | Happy path for the lowest role allowed | Right status (`200`/`201`), envelope `{ok, data, meta.request_id, meta.server_time}`, `X-Request-Id` header equal to `meta.request_id` |
| S4 | Write without `X-CSRF-Token` | `403 csrf_failed`, nothing written |
| S5 | Write without `Idempotency-Key` | `428 idempotency_key_required` |
| S6 | PATCH / PUT / single DELETE / action without `If-Match` | `428 version_required` |
| S7 | Unknown query parameter | `400 bad_request` |
| S8 | Unknown or numeric `{id}` | `404 not_found` |
| S9 | Every write | Exactly one new `audit_log` row per changed record, right `action`, right `user_id` |
| S10 | Every reply | No key ends in `_paise` for a non-money user; no `password_hash`, `token_hash`, `csrf_hash`, numeric `id` |
| S11 | Validation | One bad value per required field gives `422` with that field in `error.fields` |

**Module-specific tests** (on top of the standard set):

| Endpoint(s) | Must also prove |
|---|---|
| `POST /auth/login` | Phone normalised (`098290-12345` works); wrong phone and wrong password give the same `login_failed`; deactivated / past `access_ends_on` → `403 access_ended` **only with the right password**; cookie is `__Host-`, `HttpOnly`, `Secure`, `SameSite=Lax`, 90 days; `login_attempts` + `audit_log` rows |
| `POST /auth/logout`, `/auth/logout-all` | Cookie cleared; next request 401; logout-all revokes every session of that user only |
| `GET /session` | Slides expiry; returns `permissions` matching role; CSRF token rotates only on login/password change |
| `POST /auth/password/change` | Wrong current → 422; weak (phone, < 6, top-100 list) → 422; success revokes other sessions, issues new cookie |
| `POST /auth/password-reset/request` | Always `202`; sends nothing while `MAIL_ENABLED=false`; same reply for unknown phone |
| `POST /auth/password-link/inspect`, `/complete` | Valid → name + masked phone; used, expired (73 h) or cancelled → `410 link_invalid`; complete logs in and revokes others; a newer link cancels older |
| `POST /setup/owner` | Wrong token 403; works once; second call `410` |
| `GET/POST/PATCH /members…`, `/members/{id}/password-reset`, `/me/sessions` | Family/Viewer see only `id, name, phone, role, left`; nobody can add an owner; owner can't be demoted or deactivated; last active admin protected; Partner can't reset Owner; duplicate active phone → 409; deactivation revokes sessions; `password_once` / `setup_link` returned once and **not** stored in `idempotency_keys.response_body` |
| `GET/PATCH /settings`, `/settings/history` | `total_budget_paise` only for money users; `timezone`, `currency` read-only; end date ≥ start date |
| `/backups`, `/restore-drills…` | Admin only; drill delete is soft with undo |
| `GET /health` | Anonymous sees only `{"status":"ok"}` / `503 {"status":"fail"}`; admin sees all checks; backup > 26 h → fail; audit count dropped → fail; reminders `not_in_use` in R1 |
| `GET /dashboard` | Only allowed cards present per role; `payments_window_days` 1–90; deleted records not counted |
| `GET /calendar` | Range > 93 days → 422; payments only for money users; `include_undated` |
| `/events…` incl. `delete-preview`, `headcount`, `restore` | Admin-only writes; same type + same IST date → `409 duplicate_found`, `allow_duplicate` works; `map_url` must be `https://`; delete takes invitations in the same batch; headcount matches DATABASE §7.4 sums |
| `/tasks…`, `/tasks/{id}/done`, `/tasks/{id}/items…`, `/tags…` | Default view per role; chip counts; later `due_date` bumps `postpone_count` and writes a History line; `done` twice → `200 already_done`; Family deletes own task (created **or** assigned), not others → 403; checklist tick uses the item's version; `meta.last_item_done`; tag restore blocked if name now taken |
| `/households…`, `duplicate-check`, `suggestions`, `export` | Duplicate phone/alt phone → 409 with `matches`; `allow_duplicate`; `side=groom` includes `both`; `rsvp` without `event` → 422; deleted family not in search or totals (AC-TRS-07); food only `veg`, `jain`, `mixed`; CSV export: BOM, IST, formula-safe (AC-EXP-07), admin only, audited |
| `/households/{id}/invitations/{event_id}` (PUT, PATCH, DELETE, `whatsapp-opened`) | PUT revives a removed invitation; PUT twice → 200 unchanged; event without guests → 422; RSVP uses the **invitation's** version, so a family edit and an RSVP edit at the same time both succeed; `whatsapp-opened` doesn't bump version |
| `POST /households/bulk` | `invite` never changes an existing RSVP (AC-GST-05); rows changed after `as_of` skipped and named; > 2,000 → 422; `delete` by Family → 403; one batch, one undo |
| `/imports/preview`, `/imports`, `/imports/{id}`, `/imports/{id}/undo` | Preview writes nothing (row counts unchanged); > 3,000 rows → 422; any unresolved error row → 422 and **nothing** imported; `update_existing` fills empty fields only (AC-IMP-04); import undo keeps rows edited since and lists them; Family → 403 |
| `/money/summary`, `/budget-categories…` | Totals equal hand-computed sums in paise; delete with payments needs `move_payments_to`; Miscellaneous can't be deleted |
| `/vendors…` | Non-money user sending `agreed_amount_paise` → 403; balance only for money users; deleted vendor still shows on payments as "(deleted vendor)" |
| `/payments…`, `mark-paid`, `pay-part` | Amount 1 … 1,000,000,000 paise; paid needs `paid_on` + `method`; `paid_on` not in the future (IST); same vendor + amount within 2 days → 409; mark-paid twice → 422; pay-part: amount < due, one batch, two rows, undo restores the original due row exactly |
| `/documents…`, `/documents/{id}/file` | §1.5 file tests; SHA-256 mismatch → `422 checksum_mismatch` and no file left on disk; same file twice → 409, `allow_duplicate` makes a second document on the same `files` row; range request → `206`; private → admin only; payment-linked → money only |
| `/{resource}/{id}/history`, `/activity` | Plain sentence built; money fields removed for non-money; activity admin only (AC-ACT-04) |
| `/undo/{batch_id}`, `/trash…`, `/{resource}/{id}/restore`, `DELETE /trash/{batch_id}` | §1.6 |
| `/exports…`, `/exports/{id}/download` | §1.6 export test; token works without cookie; wrong token → 401/403; after 24 h → `410 export_expired`; 4th export in an hour → 429 |
| `GET /sync` | Full snapshot vs `since`; `deleted` list; `next_since = server_time − 120 s`; `full_resync_required` after role or money change; money and private documents filtered |
| `POST /client-log` | Works logged in and on the login screen (no session); text fields capped; phone numbers and names in `message` masked; written to the log file only, never the DB or `audit_log`; 31st report in an hour → `429`; bad JSON → `400`, never `500` |

### 1.4 How a test looks

```php
<?php
// api/tests/DataSafety/StaleVersionTest.php
declare(strict_types=1);

namespace Tests\DataSafety;

use Tests\Support\{ApiTestCase, Endpoint};

final class StaleVersionTest extends ApiTestCase
{
    #[Endpoint('PATCH /households/{id}')]
    public function test_stale_version_returns_409_and_changes_nothing(): void
    {
        $fam   = $this->fixtures->household(['name' => 'Sharma family', 'adults' => 3]); // version 1
        $mummy = $this->loginAs('mummy');
        $me    = $this->loginAs('papa');

        $mummy->patch("/households/{$fam['id']}", ['adults' => 4], ifMatch: 1)->assertStatus(200); // now v2
        $rowBefore   = $this->db->row('households', $fam['id']);
        $auditBefore = $this->db->count('audit_log');

        $res = $me->patch("/households/{$fam['id']}", ['adults' => 5, 'city' => 'Udaipur'], ifMatch: 1);

        $res->assertStatus(409)->assertErrorCode('version_conflict');
        $this->assertSame(2, $res->json('error.current_version'));
        $this->assertSame(['adults'], $res->json('error.changed_fields'));
        $this->assertSame('Mummy', $res->json('error.changed_by.name'));
        $this->assertSame($rowBefore, $this->db->row('households', $fam['id']));   // nothing changed
        $this->assertSame($auditBefore, $this->db->count('audit_log'));            // nothing logged
        $this->assertSame(0, $this->db->count('idempotency_keys', ['idem_key' => $res->idemKey()])); // key released
    }
}
```

### 1.5 Must-have security tests

| ID | Attack | Steps | Expect |
|---|---|---|---|
| SEC-01 | Change the ID to a record your role can't see | Mummy (no money) calls `GET /payments/{id}`, `/payments`, `/budget-categories`, `/money/summary` | `403 no_money_access` |
| SEC-02 | Private document by ID | Family calls `GET /documents/{privateId}` and `/file` | `403`; file bytes never sent |
| SEC-03 | Payment-linked document by ID | Non-money user calls `GET /documents/{id}/file` for a receipt | `403` (AC-DOC-03) |
| SEC-04 | Numeric ID instead of `public_id` | `GET /households/1`, `/tasks/2` | `404`; no hint the row exists |
| SEC-05 | Guess the upload path | HTTP E2E: `GET /uploads/2026/10/<uuid>.jpg`, `/private/…`, `/.env` | `404` or `403`, never the file |
| SEC-06 | Deleted record by ID | `GET /households/{deletedId}`, `PATCH` it, `DELETE` it again | `404`; `409 record_deleted` on PATCH; nothing changed |
| SEC-07 | Deleted record via lists, search, sync, dashboard, calendar, headcount, CSV | Delete a family, then call each | Not present, not counted (AC-TRS-07); in `/sync` only under `deleted` |
| SEC-08 | Undo someone else's action | Papa deletes a task; Mummy calls `POST /undo/{batch}` | `403` |
| SEC-09 | Edit without permission | Viewer: every write endpoint (data provider over `openapi.yaml`) | `403` for all, nothing written |
| SEC-10 | Family beyond its powers | Family: import, bulk delete, delete another's task, events write, tags rename/delete, trash, export, activity, members write | `403` each |
| SEC-11 | Privilege moves | Partner edits Owner's role; anyone deactivates Owner; Family PATCHes own `role` | `403` |
| SEC-12 | Money field smuggling | Family without money: `POST /vendors` with `agreed_amount_paise`; `PATCH /settings` with budget | `403`, nothing written |
| SEC-13 | Role change applies at once | Admin turns Papa's money off; Papa's very next `GET /payments` | `403 no_money_access` |
| SEC-14 | CSRF token missing | Every write endpoint without `X-CSRF-Token` | `403 csrf_failed`, nothing written |
| SEC-15 | CSRF token from another session | Use Mummy's token with Papa's cookie | `403 csrf_failed` |
| SEC-16 | Wrong `Origin` / cross-site | `Origin: https://evil.example`, or `Sec-Fetch-Site: cross-site` | `403 csrf_failed` |
| SEC-17 | Form-encoded body (classic CSRF) | `Content-Type: text/plain` or `application/x-www-form-urlencoded` | `403 csrf_failed` |
| SEC-18 | Login brute force (phone) | 5 wrong passwords for one phone | 6th → `429 login_locked`, `Retry-After`; right password still refused until 15 min pass (frozen clock) |
| SEC-19 | Login brute force (IP) | 20 failures across phones from one IP | 21st → `429` |
| SEC-20 | Write flood | 121 writes in 5 min by one user | 121st → `429 rate_limited` with `retry_after_seconds`; after the window → allowed |
| SEC-21 | Other limits | Link inspect (11/15 min), setup/owner (6/h), export create (4/h), uploads (61/h), health anonymous (31/min), sync (31/5 min), bulk (11/10 min) | `429` at the first request over each limit (API §10.1) |
| SEC-22 | Proxy header spoofing | `X-Forwarded-For` with `TRUSTED_PROXY` unset | Limit keyed on `REMOTE_ADDR`; spoofing doesn't reset it |
| SEC-23 | Revoked session | Password reset by admin, deactivate, `access_ends_on` passed, logout-all | Old cookie → `401 session_ended` with the right `reason` |
| SEC-24 | Stolen session table | Read `sessions.token_hash` and send it as the cookie | `401` (only the hash is stored) |
| SEC-25 | Dangerous uploads | SVG, HTML, a `.php` renamed `.jpg`, HEIC, 11 MB JPEG, empty file | `415` / `413` / `422`; nothing in `files`; no file on disk |
| SEC-26 | SQL injection | `q=' OR 1=1 --`, sort `name;DROP TABLE`, filter values with quotes | Normal empty result or `400`; tables intact |
| SEC-27 | Stored script | Family name `<img src=x onerror=alert(1)>` | API stores text as is; front-end shows it as text (Vitest §1.7 and E2E) |
| SEC-28 | CSV formula injection | Notes `=HYPERLINK(...)`, `@SUM`, `-2+3`; phone `+919829012345` | CSV cell prefixed `'` ; phone unchanged (AC-EXP-07) |
| SEC-29 | Error leaks | Force an exception in test mode | `500 server_error` with plain message; body has no path, SQL, stack trace or PHP version |
| SEC-30 | Security headers (HTTP E2E) | `GET /`, `GET /api/v1/session` | HSTS, CSP (app and API variants), `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`, no `Access-Control-Allow-*`, no `X-Powered-By` |
| SEC-31 | Methods | `OPTIONS`, `TRACE` on the API | `405` |
| SEC-32 | Purge | Owner calls `DELETE /trash/{batch}` with a valid confirm on 15 May 2027 | `403 purge_not_allowed_yet`; on any date, row still exists (R1 has no hard delete) |
| SEC-33 | Export token reuse | Token from export A on export B; token after 24 h | `403`/`401`; `410 export_expired` |
| SEC-34 | Setup token after launch | `POST /setup/owner` once an owner exists | `410` |

### 1.6 Must-have data-safety tests

| ID | Test | Steps | Expect |
|---|---|---|---|
| DS-01 | Stale version → 409, nothing changes | §1.4, repeated for **every** versioned write: households, invitations, tasks, task items, events, vendors, payments (+ `mark-paid`, `pay-part`), categories, tags, documents, settings, members, restore-drills, and every `restore` | `409 version_conflict`; row byte-for-byte unchanged; no audit row; key released |
| DS-02 | 3-way merge server side | AC-CON-01: Mummy changes phone, I change city from the same version, then resend with `current_version` | Result has her phone and my city; History shows both |
| DS-03 | Edit a deleted record | Papa deletes; Mummy PATCHes | `409 record_deleted`, `can_restore: false` for Family, `true` for admin |
| DS-04 | Same `Idempotency-Key` twice → one record | `POST /tasks`, `/households`, `/payments`, `/vendors`, `/events`, `/documents`, `/tags`, `/members`, `/imports` sent twice with the same key and body | One row; second reply identical status and body, `Idempotent-Replayed: true` |
| DS-05 | Same key, edits and actions | `PATCH`, `done`, `mark-paid`, `DELETE`, `undo` sent twice | Second is a replay: no false 409, no "already deleted", version bumped once |
| DS-06 | Same key, different body | Second request changes one field | `422 idempotency_key_reused`; nothing changed |
| DS-07 | Same key while first still running | Insert a `processing` claim row, then send | `409 request_in_progress`, `Retry-After: 2`; a claim older than 120 s is taken over |
| DS-08 | Key after 48 h | Frozen clock +49 h, resend a create | `200` with the existing record (found by `client_uuid`); still one row |
| DS-09 | Failed request releases the key | Send with a 422 error, fix, resend same key | Second succeeds; one row |
| DS-10 | Lost reply | Server saves, test drops the reply, client retries | One row (AC-SAV-03) |
| DS-11 | Delete → undo → identical | For each deletable type (task with checklist, assignees and tags; family with invitations; event with invitations; payment with receipts; tag; vendor; category with moved payments; document) | **Compared:** every column except `version`, `updated_at`, `updated_by`, and the `deleted_*` columns (back to NULL). **Plus:** same child rows with the same values; `version` = before + 2; audit has `delete` + `undo` |
| DS-12 | Undo skips rows changed since | Bulk RSVP 30 families, Mummy edits 1, undo (AC-UND-02) | 29 reverted, 1 skipped and named |
| DS-13 | Undo twice / too late | Second undo; undo at +11 min | `already_undone: true`; `403 undo_expired` |
| DS-14 | Restore from Trash | Delete at T, clock +11 min, admin `POST /trash/{batch}/restore` | Same comparison as DS-11; Family → 403; second restore → `already_restored: true` |
| DS-15 | Restore only that batch | Delete one checklist item (batch A), then the task (batch B); restore B | Task and its batch-B children back; item from batch A still deleted |
| DS-16 | Restore with clashes | Restore a family whose phone is now used; a tag whose name is now used | Family restored with a warning; tag blocked with a reason |
| DS-17 | Restore child brings parent | Restore a checklist item whose task is deleted | Task restored too (FEATURES B9) |
| DS-18 | Every DELETE is soft | Data provider over every `DELETE` in `openapi.yaml` | Row still exists with `deleted_at`, `deleted_by`, `delete_batch_id` (AC-TRS-06) |
| DS-19 | No hard delete anywhere | Static check: grep the API code for `DELETE FROM` | Allowed only for `sessions`, `rate_limits`, `idempotency_keys`, `login_attempts` and the idempotency release (DATABASE rule 12) |
| DS-20 | Audit log is append-only | Static check: no `UPDATE audit_log` / `DELETE FROM audit_log` in code; health turns red if count or max id drops | Pass |
| DS-21 | **Export contains every row** | Fill every table (incl. deleted rows, Hindi names `राम शर्मा`, emoji, ₹1,25,000, a receipt, a deleted document). `POST /exports`, download, unzip in the test | For **every** table: `csv/<table>.csv` row count = `SELECT COUNT(*)` (deleted rows included, AC-EXP-03); `json/all.json` the same; every `files` row present in `documents/` with the same SHA-256; no `password_hash`, `token_hash`, sessions; README, `summary.html`, `manifest.json` present (AC-EXP-01); BOM; IST dates |
| DS-22 | Export restores | Load `json/all.json` into an empty DB with `tools/restore-from-export.php` | Every table count and every row matches (AC-EXP-05) |
| DS-23 | Export is consistent | Write a row in a second connection while the snapshot runs | Export holds either the old or the new state of that row, never half |
| DS-24 | Transactions | Force a failure after the main `UPDATE` but before the audit row | Nothing saved; no audit row; key released |
| DS-25 | Bulk `as_of` | Load list, Mummy edits 2 rows, bulk set side | 2 skipped with `changed_since_loaded` |
| DS-26 | Import is all or nothing | 500 rows, one row error not set to `skip` | `422`; 0 rows added |
| DS-27 | Money is exact | Add ₹0.01 … ₹10 crore; pay part; sum | Integer paise everywhere; no float in code (static check for `float`/`(float)` near `_paise`) |
| DS-28 | Migrations guard | Apply all migrations twice | Second run stops at the guard; data unchanged |

### 1.7 Front-end tests (Vitest + Testing Library)

Setup: `vitest` with `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `fake-indexeddb`, `msw` (fake API), `vitest-axe`. Time is faked with `vi.useFakeTimers()`.

| Area | Tests |
|---|---|
| **Forms** (Task, Family, Payment, Event, Vendor, Member, Mark paid, Postpone) | Labels visible above every field; required errors appear under the field and in "Please fix 2 things below."; 422 `fields` from the server map to the right inputs (incl. `items.2.text`); Save disabled with spinner while saving; **Save & add another** keeps sticky defaults (AC-QA-03); viewer sees no form |
| Indian formats | Phone `098290-12345` → `+919829012345`, shown `+91 98290 12345`; money `1.25 lakh` → 12500000 paise, shown `₹1,25,000`; dates `Sat, 14 Feb 2027` and `6:00 PM` in IST even with the test machine set to `America/New_York` |
| Drafts | Draft written 1 s after typing; key `draft:{user}:{form}:{id}`; banner "You have unsaved changes from 10:42" restores every field (AC-SAV-01); cleared on save; never stores passwords; max 50, 7 days |
| **Saved indicator** | States in order: "Saving…" → "Saved ✓ 10:42"; "Saved" **never** before a 2xx (AC-SAV-05); network error → "Couldn't save. Your changes are kept on this phone. [Try again]"; 5xx text; outbox → 🕒 "Waiting to send"; announced in the `aria-live` region |
| **Conflict dialog** | Pure `merge3(base, mine, theirs)` function: only-mine, only-theirs, both-same, both-different, notes **Keep both**, amount and status never auto-merged; screen header names who and when; **Save my choices** disabled until every clash is chosen; sends only chosen fields with `If-Match: current_version` and a **new** key; a second 409 shows the screen again; record deleted → admin vs Family text; inline Yes/No dialog for chips |
| **Outbox** | The 12 checks already written in PWA §5.2, kept as tests: offline merge of two edits, create then tick (placeholder id fixed up), lost reply then retry (one save), conflict then resolve (new key), chained edits, discard (with later entries); plus: entry written **before** fetch; removed only on 2xx or Discard; 401 keeps it and asks for login; 426 keeps it; non-queueable actions (delete, money, upload) throw; another user's entries never sent; old entry format `v: 1` still read after an app update |
| Undo snackbar | Shows 8 s; pauses while touched (AC-UND-03); one at a time; not shown offline; calls `/undo/{batch}` |
| Update prompt | Never reloads by itself; with a dirty form shows "Save or close the open form first"; forced mode on 426 |
| Session expiry | 401 mid-save opens the login sheet over the form; after login, one retry with the same key; form text unchanged |
| Safety | Every string comes from the strings file (no concatenated sentences); stored-script name renders as text (SEC-27) |
| Accessibility (unit level) | `vitest-axe` on every screen component; icon-only buttons have `aria-label`; colour tokens test (§6.1) |

Example:

```jsx
// web/src/components/SavedIndicator.test.jsx
import { render, screen } from '@testing-library/react';
import { http, HttpResponse, delay } from 'msw';
import { server } from '../test/server';
import TaskForm from '../screens/tasks/TaskForm';
import userEvent from '@testing-library/user-event';

test('never says Saved before the server confirms', async () => {
  server.use(http.post('/api/v1/tasks', async () => { await delay(2000);
    return HttpResponse.json({ ok: true, data: { id: '01J', version: 1, title: 'Call tent wala' } }, { status: 201 }); }));
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<TaskForm />);
  await user.type(screen.getByLabelText('Title'), 'Call tent wala');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByRole('status')).toHaveTextContent('Saving…');
  expect(screen.queryByText(/Saved ✓/)).toBeNull();
  await vi.advanceTimersByTimeAsync(2100);
  expect(await screen.findByText(/Saved ✓/)).toBeInTheDocument();
});
```

### 1.8 End-to-end tests (Playwright)

**Where it runs:** in the sandbox. `php -S 127.0.0.1:8080 tools/router.php` serves the built `dist/` and the API on one origin, against the test DB with `seed_demo.sql`-like data. `localhost` counts as secure, so the service worker, IndexedDB and the outbox all run for real.

#### 1.8.1 Projects

| Project | Browser | Viewport | Notes |
|---|---|---|---|
| `android` | Chromium | 412 × 915, touch, Android user agent (same CSS size class as Galaxy A5x and Redmi Note) | Main project |
| `small-iphone` | Chromium | iPhone SE (375 × 667), iOS user agent | Smallest supported screen. **Not Safari.** |
| `small-android` | Chromium | 360 × 740, text zoom 200 % | Layout at large text |
| `iphone-size` | Chromium | iPhone 13 (390 × 844), iOS user agent | **Not Safari.** Only proves layout and our iOS code paths (`ios` class, Install Guide). |
| `webkit` (bonus) | Playwright WebKit | iPhone 13 | Only if it installs. Closer to Safari, still **not** iPhone Safari. |
| `http` | Chromium | 412 × 915 | Real HTTP through `.htaccess` rules copied into the router: headers, SPA fallback, `/uploads` blocked |

#### 1.8.2 Journeys

| ID | Journey | Proves |
|---|---|---|
| E2E-01 | Log in → Home → + → Task → "Call tent wala" → Save | 3 taps (AC-QA-01); "Saved ✓" only after 201 |
| E2E-02 | Add family with duplicate phone → dialog → Open that family / Add anyway | Duplicate flow |
| E2E-03 | Family page: set Coming for Mehndi, How many 3 | Inline save, headcount updates |
| E2E-04 | Select mode → select 30 → Set RSVP → Undo | One batch, one Undo |
| E2E-05 | Delete task → snackbar → Undo | Task back with checklist |
| E2E-06 | Two browser contexts edit the same family | Conflict screen, merge, History line |
| E2E-07 | Go offline (`context.setOffline(true)`) → tick 2 tasks, edit a family, 3 RSVPs → close page → new page offline → still 6 waiting → online | Outbox survives a page close; all sent once; other context sees them |
| E2E-08 | Offline: delete, mark paid, upload | Disabled with "Needs internet" |
| E2E-09 | Drop the reply: route `/api/v1/tasks` to abort **after** the server handled it, then Try again | One task (AC-SAV-03) |
| E2E-10 | Slow network: 3G profile via CDP (400 kbit/s, 400 ms) | Saving… shows; no double tap creates two rows; 15 s timeout message |
| E2E-11 | Session ends mid-form (admin resets password in another context) | Login sheet; form kept; saved once |
| E2E-12 | Deploy a new build while a form is open (swap `dist/` and `version.json`) | Prompt; refresh blocked until form saved; outbox kept |
| E2E-13 | Settings → This phone → Fix the app with 2 changes waiting | Reload; still 2 waiting |
| E2E-14 | Upload a JPEG receipt from a file chooser | Compressed ≤ 1600 px; progress; thumbnail |
| E2E-15 | Export everything → download | ZIP saved; opens; `summary.html` present |
| E2E-16 | 800-family list scroll and search | §7.4 |
| E2E-17 | axe scan on every screen, light and dark | §6 |
| E2E-18 | Tap-target scan | §6.1 |
| E2E-19 | Installability check | §7.3 |
| E2E-20 | Lighthouse (mobile) on Login, Home, Guests | §7.2 |

#### 1.8.3 What the sandbox can't prove — you must check on real phones

| Check | Why the sandbox can't | Where |
|---|---|---|
| iPhone Safari behaviour of any kind | Linux has no Safari; WebKit on Linux is a different engine build | §3, §4 |
| Add to Home Screen; Android install banner → Chrome dialog | Needs the real browser UI | §4 R1–R3 |
| Separate login for the iPhone Home Screen app | Real iOS cookie jars | §4 R4 |
| Push notifications with the app closed | Needs Apple/Google push servers and a real phone | §4 R6 (R2a) |
| Camera, HEIC photos, share sheet, Save to Files | Real hardware and OS sheets | §4 R7, R8 |
| Airplane mode, killing the app, rebooting, weak signal | Real radio and OS | §3 |
| Storage kept (`persist()`), 7-day clean-up | OS rules | §4 R13 |
| Safe areas, notch, home bar, keyboard covering Save | Real screens | §4 R11 |
| Dynamic Type / Android font size, Bold Text, dark mode status bar | OS settings | §4 R14, R15 |
| Speed on a mid-range Android over 4G | Lab throttling is an estimate | §7.1 |
| Edge-swipe Back, system Back | OS gestures | §4 R12 |
| TalkBack and VoiceOver | Real screen readers | §6.3 |
| What real people find easy | People | §5 |

### 1.9 Session report: `TEST-REPORT.md`

Written by `tools/test-all.sh` at the end of every session and put in the ZIP root.

```markdown
# Test report — session 2026-10-12 "Guests bulk + import"
App version: 1.0.8 · DB: MySQL 8.0.39 (sandbox) · PHP 8.3.6 · Node 20.18
| Suite | Passed | Failed | Skipped | Time |
| PHPUnit | 418 | 0 | 0 | 2m 41s |
| Endpoint coverage | 108/108 operations | | | |
| Vitest | 101 | 0 | 0 | 38s |
| Playwright android / small-android / iphone-size / http | 20/20 · 6/6 · 8/8 · 5/5 | 0 | webkit: not installed | 4m 05s |
| Lighthouse mobile (Home) | Perf 94 · A11y 100 · BP 100 | | | |
| Bundle | JS 148 KB gz · CSS 21 KB gz · fonts 96 KB | budget OK | | |
New tests this session: DS-12 for bulk side, SEC-10 import by Family.
Skipped and why: none.
Your manual checks for this session: §2 Guests (G1–G7) + core C1–C5.
```

---
## 2. Manual tests on staging (you, after each session)

**Where:** `staging-wedding.lumorrahouse.com` ("A&M Staging" icon), demo data, demo password `demo-1234`. **When:** after uploading that session's build to staging, before live. **Time:** 10–20 minutes.

**Before you start:** staging shows demo families (not real ones). If you see real guests, a drill is in progress or wasn't cleaned up (DATA-SAFETY §4.2 steps 10–11). Stop and fix that first.

Use one Android and one iPhone (Home Screen app). Tick both columns. Do the **core** checks every time, plus the module sections that the session report names.

### 2.1 Core (every session, ~5 min)

| # | Check | And | iP | Pass when |
|---|---|---|---|---|
| C1 | Open the app from the icon | ☐ | ☐ | "New version available" appears or the app is already on the new version (Settings → This phone shows it) |
| C2 | Log in as Papa (Family + money) | ☐ | ☐ | Home loads; countdown, My tasks, Payments cards visible |
| C3 | + → Task → "Test C3 <date>" → Save | ☐ | ☐ | "Saved ✓ HH:MM" in IST; the other phone sees it after pull-to-refresh |
| C4 | Delete that task → Undo | ☐ | ☐ | Back, same title |
| C5 | More → Settings → Safety (as Ayush) | ☐ | ☐ | All green (backup, database, storage) |

### 2.2 Per module

**Tasks (T)**

| # | Check | Pass when |
|---|---|---|
| T1 | Add a task with due date Tomorrow, priority Urgent, 3 checklist items | All saved; Urgent flag shows; due chip shows "Tomorrow" |
| T2 | Tick all 3 items | "Mark the task done too?" appears |
| T3 | Move date → Next Monday, twice | "Moved 2×" tag; History shows both moves |
| T4 | As Mummy, try to delete a task Ayush made and assigned to Papa | No Delete option (or "You can delete only tasks you added or that are yours.") |
| T5 | View chips: Mine, Today, Overdue | Counts match the rows shown |

**Calendar and events (E)**

| # | Check | Pass when |
|---|---|---|
| E1 | Agenda shows events by day; "Date not set" at top | Right days, IST times |
| E2 | Month view: tap a busy day | That day's list opens |
| E3 | As Ayush, edit Mehndi's venue | Saved; Share on WhatsApp shows the new venue |
| E4 | As Mummy, open an event | No Edit button |
| E5 | Delete an event → counts shown → Undo | Event and its invitations back |

**Guests and RSVP (G)**

| # | Check | Pass when |
|---|---|---|
| G1 | Add a family: Hindi name "राम शर्मा", phone with spaces, Groom, 3 adults 1 child, invite to Wedding + Reception | Saved; phone shown as +91 …; Hindi shows correctly |
| G2 | Add another family with the same phone | Duplicate dialog with the first family's name and who added it |
| G3 | Family page: Coming for Wedding, How many 4 | "Saved ✓"; Wedding headcount goes up by 4 |
| G4 | Search "sharma" and search by the last 4 phone digits | Both find it |
| G5 | Select 10 → Set RSVP Waiting for Mehndi → Undo | "Updated 10 families" then all back |
| G6 | Import the Excel template with 5 rows (1 duplicate, 1 bad phone) as Ayush | Preview: 3 new, 1 duplicate, 1 error; import adds 3; Imports → Undo this import removes them |
| G7 | WhatsApp reminder for one family | WhatsApp opens with the right number and text |

**Money (M)** — as Papa or Ayush

| # | Check | Pass when |
|---|---|---|
| M1 | + → Payment → new vendor "Test Tent", ₹1.25 lakh, due in 3 days | Shows ₹1,25,000; Payments card lists it |
| M2 | Mark as paid → UPI → Add receipt photo (camera) | Paid; receipt thumbnail; upload progress |
| M3 | Pay part of another payment: ₹40,000 of ₹1,00,000 | "Paid ₹40,000. ₹60,000 still due." Undo restores one ₹1,00,000 due row |
| M4 | Log in as Mummy (no money) | No Money in More; no Payments card |
| M5 | Budget overview totals | Planned / Spent / Still to pay add up by hand |

**Documents (D)**

| # | Check | Pass when |
|---|---|---|
| D1 | Take a photo of a paper (camera) → type Contract → Upload | Under 1 MB; thumbnail; opens full size |
| D2 | Upload a PDF → Open → Open / Share | Share sheet opens; "Save to Files" / PDF viewer works; back in the app nothing is stuck |
| D3 | Mark a document Private (Ayush), then view as Mummy | Not in her list |
| D4 | Upload the same photo again | "This file is already saved as …" |

**Members and settings (S)**

| # | Check | Pass when |
|---|---|---|
| S1 | Add member by link → Share on WhatsApp → open link on the other phone | "Welcome, <name>. Choose a password." → logged in |
| S2 | Reset that member's password | Their phone is logged out at the next action |
| S3 | My account → theme Dark, then Follow phone | Changes at once; survives closing the app |
| S4 | Settings → This phone | Version, "Offline data: protected ✓/not protected", waiting changes = 0 |

**Trash, export, safety (X)** — as Ayush

| # | Check | Pass when |
|---|---|---|
| X1 | Deleted items: restore the event from E5 deleted again 11+ min ago | Restored with its invitations |
| X2 | Export everything → Download | Android: in Downloads. iPhone: Save to Files works. ZIP opens on a computer; `summary.html` shows families |
| X3 | Activity feed | Today's test actions listed in plain sentences |

---

## 3. Offline and chaos tests (real phones)

**When:** before launch (by Thu 22 Oct), after any change to saving, the outbox, the service worker or login, and again before wedding day (by 24 Jan, with R2b).
**Who:** you plus one helper (two phones are needed for some). **Where:** staging, demo data.

For each test, note the result in the table at the end (§3.3). "Exactly one" means: check on the **other** phone's list and in Activity that there is one record, not two.

### 3.1 Tests

| ID | Test | Steps | Pass when |
|---|---|---|---|
| OC-01 | Airplane mode mid-save | Open a new task. Type a title. Tap **Save** and turn on Airplane mode within 1 second. Wait 10 s. Turn it off. | Either "Saved ✓" or 🕒 "Waiting to send", never an error that loses the text. After reconnect: **exactly one** task. Repeat 5 times on each phone. |
| OC-02 | Airplane mode mid-save (online-only form) | Same with a payment | "Couldn't save. Your changes are kept on this phone. [Try again]". Text kept. Try again online → **exactly one** payment. |
| OC-03 | Close the app with items in the outbox | Airplane on. Tick 2 tasks, edit a family, set 3 RSVPs (6 waiting). Swipe the app away. Wait 5 min. Open from icon. | Still "6 changes waiting to send"; rows show 🕒 |
| OC-04 | Reboot with items in the outbox | Same, then restart the phone. Open the app still offline. | Still 6 waiting |
| OC-05 | Outbox sends on reconnect | Airplane off. Open the app (don't tap anything). | All 6 sent within ~1 min; ✓ on each; other phone sees them; no duplicates |
| OC-06 | Two phones edit the same family (online) | Both open "Sharma family". Phone A: adults 4 → Save. Phone B: adults 5 and city → Save. | B sees the conflict screen "Papa changed this family at …"; city merged automatically; choosing 5 saves; History shows both |
| OC-07 | Two phones, one offline | Phone B offline edits adults; Phone A online edits adults and saves; B comes online | B's banner "1 change needs your choice"; conflict screen; nothing lost |
| OC-08 | Two phones set Coming? on the same family/event | A: Coming. B (loaded before): Not coming | B: "Mummy already set Coming. Change to Not coming?" Yes and No both behave |
| OC-09 | Edit a family someone just deleted | A deletes; B (Family) saves an edit | "Papa deleted this… Your changes are kept as a draft." Admin on B: Restore and save mine works |
| OC-10 | Session expiry during a long form | B opens a new family, types everything (2 min). On A, Ayush resets B's password. B taps Save. | Login sheet over the form; text still there; after login, saved **once** |
| OC-11 | Session expiry with outbox items | B offline with 3 waiting; Ayush resets B's password; B online | Login asked; after login the 3 are sent; nothing lost |
| OC-12 | Slow network | Android: Settings → Network → Preferred type **3G/2G** (where offered), or stand where signal is 1 bar. iPhone: switch off Wi-Fi in a weak spot (lift, basement, far room). Do C3, G3, M2 and D1. | "Saving…" shows; button can't be double-tapped into two records; long uploads show progress; failures keep text |
| OC-13 | Flaky network | Walk in and out of Wi-Fi range while ticking 5 tasks | All 5 end ✓; no duplicates; no "already done" errors |
| OC-14 | Server down | Ayush renames staging's `api` folder to `api_off` in File Manager for 2 minutes while a helper ticks tasks and saves a family | Ticks wait (🕒); the family form keeps its text; after renaming back, all sent once |
| OC-15 | Logout with changes waiting | 2 waiting, tap Log out | "2 changes haven't been sent." Send now / Show changes / Log out and lose them (second confirm) |
| OC-16 | Different person on the same phone | Papa has 1 waiting, logs out choosing **Send now** first; Mummy logs in | Mummy sees none of Papa's data or changes |
| OC-17 | iPhone: Safari tab vs icon | 1 change waiting in Safari tab; open the Install Guide | "1 change is still on this phone. Connect… so it is sent first." |
| OC-18 | Update while changes wait | 2 waiting offline; deploy a new staging build; go online; tap Refresh | Both sent; app on new version |
| OC-19 | Fix the app with changes waiting | Settings → This phone → Fix the app | Reloads; still 2 waiting, then sent |
| OC-20 | Back gesture mid-form | Type a family, swipe Back (iPhone edge, Android system Back) | Draft kept; reopening shows "You have unsaved changes from …" |
| OC-21 | Phone call or WhatsApp in the middle | Type a task, switch to WhatsApp for 5 min, come back | Text still there; saves |
| OC-22 | Long offline | Airplane mode 24 hours with 3 waiting (put the phone aside) | Next day: still waiting; sends on reconnect |

### 3.2 Pass rule

Decided (answer 6):

| Result | Rule |
|---|---|
| **Blocker** — launch waits | Any duplicate record, lost typing, lost outbox change, wrong value saved, or data shown to a role that shouldn't see it. Fix, then repeat that test 5 times on both release phones. |
| Fix within a week of launch | Any other §3 failure that has a workaround (slow to send, unclear wording, an extra tap). Listed in the release log. |
| Date | If a blocker isn't fixed by **Fri 23 Oct**, launch moves by up to one week (to **Sun 1 Nov**). The family keeps using the Excel sheet meanwhile. We never launch with a known data-loss bug. |

### 3.3 Record

| ID | Android (model, Android ver.) | iPhone (model, iOS ver.) | Date | Notes |
|---|---|---|---|---|
| OC-01 | ☐ pass ☐ fail | ☐ pass ☐ fail | | |
| … | | | | |

---

## 4. Real-device checklist (one Android, one iPhone)

**Phones (CONTEXT decision 39, answer 4: popular phones).** Use whichever of these the family already owns; borrow the rest.

| Set | Phone (any model in the family) | Why |
|---|---|---|
| **Release pair** (every release) | **Samsung Galaxy A-series** (A52–A55 or A14–A16), Android 13+, **Chrome** | Most common family Android. Samsung Internet is the default browser: the guide must send people to Chrome. |
| | **iPhone 13** (or 12, 14, 15), latest iOS | Most common iPhone size |
| **Launch set** (adds, before 25 Oct; PWA §10 T1–T34) | **Xiaomi Redmi Note** 10 / 11 (2021), Chrome | 2020–21 mid-range: the **speed test phone** (§7.5). Strict battery saver (matters for R2a reminders). |
| | **iPhone SE** (2nd or 3rd gen), iOS 17+ | Smallest screen, Home button, no notch |

Known quirks to watch: Samsung and Xiaomi battery savers can delay or block notifications when the app is closed (R6: if late, check Settings → Apps → Chrome → Battery → Unrestricted, and on Xiaomi "Autostart"). Xiaomi may show "Display pop-up windows" prompts; ignore them.

**When:** before launch, after any change to the service worker, manifest, install, login or upload code, and on each iOS major update.

| # | Check | Android | iPhone | Pass when |
|---|---|---|---|---|
| R1 | **Install** from the WhatsApp link | ☐ | ☐ | Android: "Open in Chrome" hint if needed, our banner → **Install** → Chrome's dialog → icon. iPhone: Safari hint, 4-step guide, "Open as Web App" on → icon "A&M Wedding" |
| R2 | Icon looks right | ☐ | ☐ | Maskable shape on Android, no black corners on iPhone, "&" readable |
| R3 | Opens full screen | ☐ | ☐ | No address bar; splash ivory, no long white flash |
| R4 | **Login persists after closing** | ☐ | ☐ | Log in, swipe the app away, wait 10 min, reopen → still logged in. Repeat after a phone restart, and after 3 days. iPhone: logging in once more after install is expected (once only). |
| R5 | Login persists 2 weeks | ☐ | ☐ | Don't open it for 14 days → still logged in (90-day cookie) |
| R6 | **Notifications arrive when the app is closed** — **R2a gate (15 Nov)** | ☐ | ☐ | Settings → Reminders → Turn on → Allow. Swipe the app away, lock the phone. **Send a test reminder** from the other phone (as yourself) → arrives within 1 min; tap opens the right screen. Also a real task due today at 9:00 AM IST (± 15 min). iPhone: only from the Home Screen app, iOS 16.4+. |
| R7 | **Camera upload** | ☐ | ☐ | Receipt → Add receipt photo → Take photo → photo appears compressed (< 1 MB), uploads; iPhone HEIC from gallery also works |
| R8 | PDF and share sheet | ☐ | ☐ | Open a PDF → Share → Save to Files / open in viewer → back in the app, not stuck |
| R9 | **Offline mode** | ☐ | ☐ | Airplane on, open from icon → app opens, banner "No internet. Some changes can wait on this phone.", lists show "from …"; tick a task → 🕒; online → ✓ |
| R10 | **Update prompt** | ☐ | ☐ | Deploy a new staging build. Open the app → within 1 min "New version available. Tap to refresh." → tap → new version in Settings → This phone. With a form open: refresh blocked until saved |
| R11 | **Safe areas** | ☐ | ☐ | Top bar under the notch/status bar, bottom nav above the home bar, + button not covered, sheets and snackbar above the home bar; landscape: nothing under the notch; keyboard open: Save bar visible above it |
| R12 | Back | ☐ | ☐ | Android system Back = one step, closes sheets first, at Home closes the app. iPhone: our **← Back** on every inner screen; edge-swipe never loses typing |
| R13 | Data kept | ☐ | ☐ | Settings → This phone → "Offline data: protected ✓" (record result, PWA V1) |
| R14 | **Dark mode** | ☐ | ☐ | Switch the phone to dark → app follows; status bar readable; every screen in §2 readable (no dark-on-dark); My account → Light override works |
| R15 | **Large system font** | ☐ | ☐ | iPhone: Settings → Accessibility → Display & Text Size → Larger Text → largest standard size, plus Bold Text. Android: Settings → Display → Font size → largest (and Chrome → Settings → Accessibility → Text scaling 200 %). Rows wrap, nothing cut off, buttons still tappable, no sideways scroll |
| R16 | Zoom | ☐ | ☐ | Pinch-zoom works on every screen |
| R17 | Shortcuts (Android only) | ☐ | — | Long-press icon → 4 shortcuts open the right screens |
| R18 | Old phone warning | ☐ | ☐ | Chrome < 120 / iOS < 17 shows the update message (test with a borrowed old phone if available) |

---

## 5. Usability test script

**Goal:** prove a 3/5-comfort family member can do the 5 most common jobs alone. **When:** on staging between Tue 13 and Sun 18 Oct (with the near-final build), and again after any big screen change. **Who (answer 2: assumed):** 4 people, each on **their own phone**. Swap in whoever is free, but keep 2 parents and 2 + 2 phones.

| # | Participant | Role in app | Phone | When |
|---|---|---|---|---|
| P1 | Ayush's mother | Family, no money (does U5b) | Android | Tue 13 Oct, evening |
| P2 | Mahi's father | Family with money (does U5a) | iPhone | Wed 14 Oct |
| P3 | A sibling or cousin under 30 | Family, no money | iPhone | Thu 15 Oct |
| P4 | An aunt or uncle 50+ | Family, no money | Android | Fri 16 Oct |

Fixes go into builds by Tue 20 Oct. Re-test only the failed tasks with P1 or P4 on Wed 21 – Thu 22 Oct. **Each session:** 30 minutes, one person at a time, on **their own phone**, app already installed and logged in (installing is tested separately in §4).

### 5.1 Roles

| Role | Who | Job |
|---|---|---|
| Facilitator | Ayush or Mahi | Reads the script. Says as little as possible. |
| Note-taker | The other one (or a sibling) | Times each task, writes what happens, fills §5.6 |
| Participant | Family member | Thinks aloud |

Staging must have demo data plus these exact records: tasks due this week, a family "Verma family" invited to Mehndi (Not asked yet), a vendor "Shree Halwai", and a due payment to "Shree Tent House".

### 5.2 Script (read aloud)

> "Thank you for helping. We are testing the app, not you. If something is hard, that is the app's fault, and it helps us fix it. Please say out loud what you're thinking: what you look at, what you expect, what confuses you. I can't help during a task, but you can say 'I give up' any time. That's useful too. Ready?"

Read each task card aloud and also show it written on paper. Start the timer when you finish reading. Stop it when they say "done" or give up.

If they are stuck for 60 seconds, ask only: **"What are you looking for?"** If stuck for 3 minutes, mark **failed**, then show them how and move on.

### 5.3 The 5 tasks

| # | Task card (read aloud) | Success means | Target time | Max |
|---|---|---|---|---|
| U1 | "Papa asked you to remember to call the tent wala tomorrow. Put it in the app." | Task saved with due date tomorrow (assigned to self is fine) | ≤ 60 s | 3 min |
| U2 | "Your cousin Sharma ji's family is coming: 4 adults, 1 child, groom side, phone 98290 12345. Add them and invite them to the Wedding and the Reception." | Family saved with right numbers, side and both events | ≤ 2 min | 4 min |
| U3 | "The Verma family just told you they're coming to Mehndi, 3 people. Note that." | Verma: Coming for Mehndi, 3 | ≤ 45 s | 3 min |
| U4 | "You deleted a task by mistake." *(Facilitator deletes "Order sweets" on their phone and the Undo bar disappears.)* "Oh no! Ask the app to get it back if you can, or tell me who could." | Taps Undo if still visible, **or** finds "Ask Ayush or Mahi to restore it" | ≤ 45 s | 2 min |
| U5a (money users) | "You just paid Shree Tent House ₹50,000 by UPI. Record it and add a photo of the receipt." *(Give a printed receipt.)* | Payment marked paid ₹50,000, UPI, receipt photo uploaded | ≤ 2 min | 4 min |
| U5b (others) | "You need to call the halwai about the sweets. Find his number and start a WhatsApp to him." | WhatsApp opens to Shree Halwai | ≤ 45 s | 2 min |

### 5.4 What to observe

| Watch for | Write down |
|---|---|
| Where they tap first | Every wrong first tap (a sign of a bad label or position) |
| Hesitation > 5 s | Where and what they said |
| Words they don't understand | The exact word ("RSVP", "Side", "Undo") |
| Misses the + button / Save / More details | Yes/No |
| Tries a gesture (swipe, long-press) | Did the visible button also get found? |
| Text too small, squints, zooms | Screen |
| Taps something too small or the wrong neighbour | Element |
| Thinks it saved when it didn't (or the reverse) | Exact moment; the Saved indicator state |
| Keyboard covers what they need | Screen |
| Says something positive | Quote it (keep it) |

After all tasks, ask 3 questions:

1. "What was the hardest part?"
2. "Was anything confusing in the words?"
3. "On a scale of 1–5, how easy was it?" (1 = very hard, 5 = very easy)

### 5.5 Pass criteria

| Measure | Pass |
|---|---|
| Completion without help | Each task: **≥ 3 of 4** participants complete it without help. **Both parents** complete U1 and U3 without help. |
| Time | Median at or under the target time. Parents may take 1.5× the target. |
| Wrong first taps | ≤ 1 per task, median |
| Saved confidence | Nobody believes something saved when it didn't |
| Ease score | Median ≥ 4 |
| Severity | No open **Critical** or **Major** finding (§5.6) at launch |

**Severity:** **Critical** = can't finish, or data wrong/lost. **Major** = finished only after a long struggle or a wrong turn. **Minor** = slowed down or a confusing word. **Idea** = nice to have (goes to the Later list unless it's tiny — watch scope).

### 5.6 Findings template

Copy once per participant:

```markdown
## Participant P1
Who: Mummy · Age band: 50–60 · Phone: Samsung A52, Android 13 · Comfort 3/5 · Date: 15 Oct 2026 · Facilitator: Ayush · Notes: Mahi

| Task | Done without help? | Time | Wrong first taps | Notes / quotes |
|---|---|---|---|---|
| U1 | Yes / With hint / No | 0:48 | 1 (tapped Calendar) | "Where is add?" |
| U2 | | | | |
| U3 | | | | |
| U4 | | | | |
| U5a/b | | | | |

Hardest part: …
Confusing words: …
Ease score (1–5): …
```

Then one combined list for all participants:

```markdown
| # | Finding | Task | Seen in (P1–P4) | Severity | Fix idea | Decision (fix now / later / no) | Fixed in version |
|---|---|---|---|---|---|---|---|
| F1 | Didn't see "More details", looked for Children under it | U2 | P1, P3 | Major | Show Children on the main form (it is) — make stepper label bigger | Fix now | 1.0.9 |
```

Findings marked "fix now" go into the next build session as bug reports (§10).

---
## 6. Accessibility checks

Target: **WCAG 2.1 AA**, plus our own rules for older users (DESIGN §3).

### 6.1 Automated (Claude, every session)

| Check | Tool | Pass |
|---|---|---|
| Colour contrast of every token pair in DESIGN §2.2, light and dark | Vitest test that reads `app.css` and computes WCAG ratios | Text ≥ 4.5:1; large text, borders, focus ring ≥ 3:1. Build fails if a token change breaks it. |
| Contrast and structure on real screens | `@axe-core/playwright` on every screen in DESIGN §5 (S01–S44 that exist), light and dark, at 412 px | 0 serious or critical violations |
| Labels | axe + Vitest: every input has a visible `<label>`; every icon-only button has `aria-label` | 0 missing |
| Tap targets | Playwright: every `button`, `a`, `input`, `[role=button]` on each screen measured | ≥ 48 × 48 px and ≥ 8 px apart (inline text links excepted) |
| Text size | Playwright: computed font size of all visible text | Nothing under 15 px; body 17 px at default |
| 200 % text | `small-android` project at 200 % zoom | No horizontal scroll; no clipped text (`scrollWidth ≤ clientWidth` on rows and buttons) |
| Focus | Playwright keyboard: Tab through Login, Task form, Family form, a sheet, Conflict screen | Visible ring on every stop; focus moves into sheets and back to the trigger on close |
| Live regions | Vitest | Saved indicator, form errors, snackbar announce via `aria-live` |
| Reduced motion | Playwright with `reducedMotion: 'reduce'` | No animation over 0.01 ms |
| Lighthouse Accessibility | §7.2 | ≥ 95 (aim 100) |
| `lang` | Playwright | `<html lang="en">`; Devanagari names in `lang="hi"` |

### 6.2 Manual visual checks (you, before launch)

| # | Check | Pass |
|---|---|---|
| A1 | Grey phone screen: phone Settings → Accessibility → colour filters → Greyscale. Look at Tasks, Guests, Payments. | Every status still clear from icon + word (Overdue, Coming, Paid) |
| A2 | Bright sunlight, brightness at 50 % | Home, Guests and a form are readable |
| A3 | Ask a parent to read 5 screens aloud | No word they stumble on or ask about (note any for §8 microcopy) |

### 6.3 Screen reader smoke test (~15 min per phone)

Turn on **TalkBack** (Android: Settings → Accessibility → TalkBack) or **VoiceOver** (iPhone: Settings → Accessibility → VoiceOver; or ask Siri "turn on VoiceOver"). Swipe right to move, double-tap to activate. Practise turning it off first.

| # | Step | Pass |
|---|---|---|
| SR1 | Open the app, log in | Fields read as "Phone, text field", "Password, secure text field"; Log in read as a button |
| SR2 | Home | Countdown read as "<n> days to the wedding"; cards have headings |
| SR3 | Bottom nav | Each item read with its label; current one read as selected/current page |
| SR4 | + → Task → type → Save | "+" read as "Add"; after Save, "Saved" is announced |
| SR5 | Guests → open a family → set Coming | Chips read with their state ("Coming, selected") |
| SR6 | Delete a task → Undo | Snackbar text announced; Undo reachable before it disappears |
| SR7 | Trigger a form error (empty title) | Error announced and read next to the field |
| SR8 | Close a sheet | Focus returns to the button that opened it |

Pass: all 8 on both phones. Anything that can't be done with the screen reader is a **Major** finding.

---

## 7. Performance budget

### 7.1 Budgets

| Measure | Budget | How measured | Who |
|---|---|---|---|
| **First load, Redmi Note 10/11-class Android, 4G** (empty cache) | Login screen usable **< 3 s**; after login, Home cards **< 3 s** | Real phone, stopwatch (§7.5) | You |
| Repeat open of installed app | Home with cached data **< 1.5 s** | Real phone, stopwatch | You |
| Lighthouse mobile (simulated slow 4G, 4× CPU) on Login, Home, Guests | LCP ≤ 2.5 s, TBT ≤ 200 ms, CLS ≤ 0.1, **Performance ≥ 90**, Accessibility ≥ 95, Best Practices ≥ 95 | `lighthouse` CLI in the sandbox (Chromium); and PageSpeed Insights on the staging login page | Claude / you |
| Initial JavaScript (gzip) | ≤ 170 KB | `vite build` + size check in `test-all.sh` | Claude |
| Initial CSS (gzip) | ≤ 30 KB | Same | Claude |
| Fonts (both Atkinson weights, Latin) | ≤ 100 KB; Devanagari loads only when used | Same | Claude |
| Precache total | ≤ 2 MB | Workbox manifest size | Claude |
| Each lazy screen chunk | ≤ 60 KB gzip | Same | Claude |
| API: list of 50 families with 2,000 in DB | ≤ 300 ms server time | PHPUnit timing test | Claude |
| API: full `/sync` with 2,000 families, 7,000 invitations | ≤ 2 s total, all pages | PHPUnit | Claude |
| Export with 2,000 families | `POST /exports` ≤ 30 s | PHPUnit | Claude |
| Photo upload | Compressed photo ≤ 600 KB typical, ≤ 1 MB max | Vitest + §4 R7 | Both |

A build over budget is red unless the report explains why and you accept it.

### 7.2 Lighthouse in the sandbox

`npx lighthouse http://127.0.0.1:8080/login --preset=perf --form-factor=mobile --throttling-method=simulate --output=json` (and the same for `/`, `/guests` with a logged-in cookie through a Puppeteer script). Scores go into `TEST-REPORT.md`. Lab numbers are an estimate: the real-phone stopwatch (§7.5) decides.

### 7.3 Installability (replaces the old Lighthouse PWA score)

Playwright test E2E-19 checks:

| Check | Pass |
|---|---|
| Manifest served as `application/manifest+json`, has `id`, `name`, `short_name`, `start_url`, `scope`, `display: standalone`, colours, 192 and 512 icons (`any` + `maskable`) | All present, icons load |
| Service worker registered, controls the page, has a fetch handler | Yes |
| Offline reload of `/` and a deep link `/tasks/<id>` | App shell loads |
| `/api/*` never answered from cache | Offline API call fails (not stale data) |
| `/reset.html` not controlled by the service worker | Yes |
| `apple-touch-icon`, `theme-color` (light + dark), `viewport-fit=cover`, no `maximum-scale` | Present |
| Chrome DevTools "Installability" has no errors | Checked by you once in Chrome on a computer (Application → Manifest), if you have one at hand |

### 7.4 800 families scroll smoothly

| Step | Pass |
|---|---|
| Sandbox: `tools/gen-families.php --count=800` (Hindi and English names, 1–8 people, 3–5 events each). Open Guests in the `android` project with **4× CPU slowdown**. Load all 800 (Load more, and the offline list from IndexedDB). | All 800 rows reachable |
| Scroll top to bottom over 10 s while recording frames (CDP tracing) | ≤ 5 % of frames over 50 ms; no single task over 200 ms; no blank rows |
| Type "sha" in search | List updates ≤ 300 ms after the 300 ms pause |
| Stress: repeat with 2,000 families | Still usable (budget: ≤ 10 % frames over 50 ms) |
| Real phone (the Redmi Note): load all 800 on staging, fling up and down | Looks smooth; no blank flashes; search doesn't lag behind typing |

If it fails: first add `content-visibility: auto` to rows (one CSS line). Only if that isn't enough, add list windowing (a small library); tell you first because it adds a dependency.

### 7.5 Real-phone speed test (you, before launch and after big changes)

1. The Redmi Note 10/11 (or another 2020–21 mid-range Android), on **4G mobile data** (Wi-Fi off), Chrome.
2. Chrome → ⋮ → Settings → Privacy → **Clear browsing data** → "Cached images and files" (all time). (This doesn't touch the installed app if you test in a Chrome tab.)
3. Type the staging address, start a stopwatch as you tap Go. Stop when the login form shows and you can type. **< 3 s.**
4. Log in. Stopwatch from tapping Log in to Home cards with numbers. **< 3 s.**
5. Close the installed app fully, open from icon, stopwatch until Home shows. **< 1.5 s.**
6. Do each 3 times; write the middle value in the release log.

---

## 8. Release checklist (before every upload to the live subdomain)

Live: `wedding.lumorrahouse.com`. Combines DATA-SAFETY §5.1/§5.2 and this doc. **Copy this list into Drive `deploys/log.txt` and tick it each time.**

### 8.1 What Claude hands over

| Item | Content |
|---|---|
| `TEST-REPORT.md` | All suites green; budgets met; skips explained |
| `am-wedding_code_<date>_<topic>.zip` | The whole project for the next chat |
| `deploy_v<1.0.8>/1-api.zip` | `api/` (no `.env`, no `config.php`, no `backup.key`) |
| `deploy_v<1.0.8>/2-assets.zip` | `dist/assets/` only |
| `deploy_v<1.0.8>/3-root/` | `sw.js`, `index.html`, `manifest.webmanifest`, `icons/`, `install-guide/`, `reset.html`, `reset.js`, `ios-class.js`, `.htaccess` — **not** `version.json` |
| `deploy_v<1.0.8>/4-version.json` | Uploaded **last** |
| `db/migrations/00N_*.sql` | Only if this release changes the database |
| `RELEASE-NOTES.md` | What changed in plain words, which §2 checks to run, any migration, any `.env` change |

### 8.2 Checklist

| # | Step | ☐ |
|---|---|---|
| **Before** | | |
| 1 | `TEST-REPORT.md`: 0 failed; endpoint coverage 108/108 (or the new total); skips accepted by you; if the report says "MariaDB fallback", the §1.2.1 MySQL check passed | ☐ |
| 2 | Staging: this build is there; §2 core C1–C5 + the module checks in `RELEASE-NOTES.md` pass on Android and iPhone | ☐ |
| 3 | Staging has **demo** data (no drill in progress) | ☐ |
| 4 | If saving, outbox, service worker, login or uploads changed: §3 OC-01, OC-03, OC-05, OC-06, OC-10 and §4 R4, R9, R10 pass | ☐ |
| 5 | No open Critical bug; open Major bugs listed in the log | ☐ |
| 6 | Live Safety card all green (Settings → Safety) | ☐ |
| 7 | **Backup now** (SSH, answer 1): `cd ~/domains/lumorrahouse.com/private/backup && php backup.php --kind=manual_db` (or `--kind=pre_migration`) → ends with `Done` (DATA-SAFETY §5.1 step 2). Only if SSH itself is down: phpMyAdmin → live DB → Export → gzip → Drive `backups-manual/`, then delete it from the laptop. | ☐ |
| 8 | **App export:** Settings → Export → download → Drive `exports/` with `_pre-deploy` in the name | ☐ |
| 9 | The ZIP of what is live now is in Drive `deploys/` (if not: File Manager → `public_html` → Compress → Download) | ☐ |
| 10 | Save the new deploy folder to Drive `deploys/` | ☐ |
| 11 | WhatsApp family group: "Updating the app <time>. Your changes will wait on your phone." Quiet hour (after 10 PM IST) | ☐ |
| **Database (only if a migration is included)** | | |
| 12 | Migration rehearsed on staging with last night's real backup (DATA-SAFETY §5.2 steps 1–4), staging reset to demo after | ☐ |
| 13 | phpMyAdmin → **check top-left says the LIVE database** → Import → the migration file → utf-8 → Go → success | ☐ |
| 14 | `SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 1;` → new version, `finished_at` set | ☐ |
| **Upload (File Manager, in this order)** | | |
| 15 | `1-api.zip` → upload into the API folder → Extract (overwrite) → delete the ZIP | ☐ |
| 16 | `2-assets.zip` → upload into `public_html/` → Extract (adds new hashed files; **keep old ones for 14 days**) → delete the ZIP | ☐ |
| 17 | `3-root/` files → upload into `public_html/` (overwrite) | ☐ |
| 18 | `4-version.json` → upload as `public_html/version.json` **last** | ☐ |
| 19 | `.env` changed? Edit it in File Manager (outside `public_html`) as `RELEASE-NOTES.md` says | ☐ |
| **After (within 10 minutes)** | | |
| 20 | Open `https://wedding.lumorrahouse.com/api/v1/health` in a browser → `{"status":"ok"}` | ☐ |
| 21 | Your phone: open app → "New version available" → refresh → Settings → This phone shows the new version | ☐ |
| 22 | Save one test task, tick it, delete it, Undo, delete again | ☐ |
| 23 | Open a family, a payment, a document (PDF share sheet) | ☐ |
| 24 | Safety card green; Activity shows your test actions | ☐ |
| 25 | Mahi's phone (the other platform): steps 21–22 | ☐ |
| 26 | Uptime monitor shows "Up" | ☐ |
| 27 | Log: date, version, what changed, speed (§7.5 if done), "OK" | ☐ |
| **If anything fails** | Upload the previous deploy ZIP in the same order (DATA-SAFETY §5.3). Migrations are additive, so old code runs on the new schema. Tell Claude in the next chat with the bug template (§10). | |

Old `assets/` clean-up: 14 days after a deploy, delete hashed files in `public_html/assets/` that are not in the newest `2-assets.zip` (`RELEASE-NOTES.md` lists them).

---

## 9. Monitoring after launch

Everything here is free (CONTEXT: ≈ ₹0). Checked 8 Oct 2026: UptimeRobot's free plan gives 50 monitors at 5-minute checks with email alerts, for **non-commercial** use, which fits a family app ([pricing guide](https://notifier.so/guides/uptimerobot-pricing-2026/), [commercial-use note](https://velprove.com/blog/uptimerobot-commercial-alternative)).

### 9.1 Uptime monitor (set up once, ~10 min)

| # | Monitor | Type | Interval | Alert when |
|---|---|---|---|---|
| 1 | `https://wedding.lumorrahouse.com/api/v1/health` | HTTP(s), keyword **`"ok"`** must exist | 5 min | Down (503, timeout) or keyword missing → email alert. This also fires when the database is down or the nightly backup is > 26 h old (API §11). |
| 2 | `https://wedding.lumorrahouse.com/` | HTTP(s) | 5 min | Down → email. Catches a broken `.htaccess` or missing `index.html` while the API is fine. |
| 3 | SSL certificate on the live domain | SSL expiry (if offered on the free plan) | daily | < 14 days left |

Steps: sign up at uptimerobot.com with Ayush's email → **Add New Monitor** → as above → alerts go to the account's email. Adding Mahi's email is optional. Don't monitor staging (avoids noise). Pause monitors during a planned deploy only if it takes over 5 minutes.

### 9.2 Alarms we already have (DATA-SAFETY §3.6)

| Signal | Who gets it |
|---|---|
| Safety card red: backup > 26 h, audit count dropped, storage > 85 %, DB error | Admins in the app |
| Backup script failure / warning email | Both |
| 36 h watchdog email | Both |
| Reminders "last run" > 30 min (from R2a) | Safety card, and `/health` fails |

### 9.3 Error logging (R1)

| Where | What | How we see it |
|---|---|---|
| Server | PHP `error_log` to `private/logs/php-error.log`, one line per error with `request_id`, user id (not name), endpoint, code. Never passwords, tokens or guest phone numbers. | The daily cron (`daily.php`, exists) emails both of you **only if** there were new errors in the last 24 h: count + the 10 most common. Added to `daily.php` (answer 7). Includes phone-side errors from `client-error.log`. |
| Server | Every 5xx reply | Same log; `request_id` is shown to the user in Settings → This phone → Last problem |
| Phone | Last 5 problems on this phone (failed saves, crashes caught by an error boundary): time, screen, error code, `request_id` | Settings → This phone → **Last problems** (with **Copy** for bug reports), **and** sent to `POST /api/v1/client-log` (answer 3) → `private/logs/client-error.log` → daily digest |
| Log size | Rotated weekly by `daily.php`, kept 8 weeks | Safety storage check |

**`POST /api/v1/client-log`** (for API.md v1.2)

| Item | Rule |
|---|---|
| Who | Anyone, with or without a session (login-screen errors count too) |
| Body | `{at, app_version, device, screen, code, message, request_id, stack}`; `message` ≤ 500 chars, `stack` ≤ 2,000 |
| Headers | CSRF and `Origin` checked when logged in. **No `Idempotency-Key`** (a duplicate log line is harmless). Same exemption list as login (API §5.3). |
| Privacy | The phone strips form values; the server masks anything that looks like a phone number. No guest names on purpose. |
| Storage | One line in `private/logs/client-error.log` (user id, not name). Not in the database, not in `audit_log`. Rotated weekly, kept 8 weeks. |
| Limit | 30 per hour per session (or IP without a session) → `429`. The phone keeps the last 5 and drops the rest quietly. |
| Reply | `200 {}` always for valid input. A failed log call is never shown to the user. |

### 9.4 Weekly 5-minute look (Sunday, with the drill calendar)

| # | Check |
|---|---|
| W1 | Safety card all green; last backup today |
| W2 | UptimeRobot: any downtime this week? Why? |
| W3 | Error digest emails this week: anything repeating? → bug report |
| W4 | Ask in the family group: "Anything stuck or annoying in the app?" |
| W5 | Your own phone: Settings → This phone → 0 changes waiting |

### 9.5 Launch week (25 Oct – 1 Nov)

Look at the Safety card and error log **daily**. Keep the shared Excel sheet until 2 clean weeks after launch (CONTEXT risk 1). "Clean week" = no Critical bug, no data-loss report, uptime ≥ 99 %, backups every night.

---

## 10. Bug report template (family use)

### 10.1 Short version — for family on WhatsApp

Pin this message in the family group. Anyone can copy, fill and send it to Ayush.

```
🐞 App problem
1. Who: 
2. Phone: Android / iPhone (model if you know)
3. Opened from: app icon / browser
4. When: (date and time)
5. What I was doing: 
6. What I expected: 
7. What happened instead: 
8. Did I lose anything? Yes / No / Not sure
9. Screenshot attached: Yes / No
10. (Optional) Settings → This phone → Copy, and paste here
```

Tip to share with family: "A screenshot helps a lot. Android: Power + Volume down. iPhone: Side button + Volume up."

### 10.2 Full version — Ayush fills it, then pastes it into the Bug fix prompt

```markdown
# Bug: <one line, e.g. "RSVP chip shows Coming but headcount doesn't change">

ID: BUG-<YYYYMMDD>-<n>        Reported by: <name>        Date/time (IST): <…>
Severity: Critical (data lost/wrong, can't work) / Major (hard workaround) / Minor / Cosmetic
Module: Tasks / Calendar / Guests / Money / Documents / Settings / Login / Offline / Install / Other

## Where
- App version (Settings → This phone): 1.0.8
- Phone + OS: Samsung A52, Android 13 / iPhone 12, iOS 26.0
- Browser or installed: installed (icon) / Chrome tab / Safari tab
- Role of the user: Owner / Partner / Family (money yes/no) / Viewer
- Live or staging: live
- Online, offline, weak signal: …
- Changes waiting (Settings → This phone): 0

## Steps to repeat
1. …
2. …
3. …
Happens every time? Yes / Sometimes (x of y tries) / Once

## Expected
…

## Actual
…  (exact words on screen, in quotes)

## Evidence
- Screenshot(s) / screen recording: attached
- Last problems (Settings → This phone → Copy): code `version_conflict`, request_id `r_8f2c41d07a`
- Record involved: <type + 26-character id from the address bar>, e.g. household 01JA7Q3M2K8V5R1T9W4X6Y0Z2B
- Activity / History lines around that time: …

## Data check (Ayush)
- Anything lost or wrong in the data? Yes / No
- If yes: recovered how? (Undo / Deleted items / audit_log §6 / not yet)

## For the fix (Claude)
- Reproduced on staging: Yes / No / Not tried
- Failing test to add first: <test name, e.g. Guests/InvitationTest::test_headcount_updates_after_rsvp>
- Release checks to rerun: §2 <module>, §3 <OC-xx>, §4 <R-xx>
```

### 10.3 Bug flow

| Step | Who | Rule |
|---|---|---|
| 1 | Family | Send the short version. If something may be **lost**, also phone Ayush. |
| 2 | Ayush | Check data first (Activity, Deleted items). Recover now if needed (DATA-SAFETY §10). Then fill the full version. |
| 3 | Ayush | Critical: next build session, today if possible. Major: next session. Minor: batch weekly. |
| 4 | Claude | Write a failing test that shows the bug, fix, run the full suite, list the bug ID in `TEST-REPORT.md`. |
| 5 | Ayush | Staging check with the steps from the report, release (§8), reply in the family group "Fixed in 1.0.9 — thank you, Mummy". |

Keep all bug reports in Drive `A&M Wedding / bugs /`, one file per bug.

---

## Changes needed in other docs

| Doc | Change |
|---|---|
| API.md v1.2 | Add `POST /client-log` (§9.3); exempt it from `Idempotency-Key` like login; `openapi.yaml` → 108 operations |
| CONTEXT.md v1.6 | Testing decisions: launch gate (§3.2); release phones (§4); data-loss bugs block launch |
| DATA-SAFETY.md | §5.1 step 2: SSH confirmed |
| `daily.php` | Error digest email (§9.3) |

---

## Open Questions

None left from v1.0. If any assumption in "Answers applied" is wrong (testers, phones, launch gate), tell me and I'll update this doc.
