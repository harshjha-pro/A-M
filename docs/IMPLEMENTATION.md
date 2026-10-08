# IMPLEMENTATION.md — How we build A&M Wedding inside Claude chat

Version 1.1 · 8 Oct 2026 · Owner: Ayush Porwal · v1.1 applies your answers (see "Answers applied"): SSH as command cards, Session 15b, family test 20–22 Oct, separate websites, real data after Session 4, GitHub
Reads from: `CONTEXT.md` v1.5 (source of truth), `PRD.md` v1.1, `FEATURES.md` v1.2, `DATABASE.md` v1.2, `API.md` v1.1, `PWA.md` v1.1, `DATA-SAFETY.md` v1.2, `TESTING.md` v1.1, `DESIGN.md` v1.2 (being added), migrations `001`–`003`, `seed_demo.sql`.

**Workflow this is written for:** Claude writes and tests all code in Claude chat, one build session per chat. The project moves between chats as a ZIP. Nothing runs on your computer. You deploy by hand: files with hPanel **File Manager**, database with **phpMyAdmin**, and a few commands over **SSH**. Every SSH step is a **command card**: one command at a time, typed exactly, with what you should see (§6.7).

**Who this is for:** you, as the person who uploads, clicks and checks. You don't write code. Every step you do is spelled out. Steps Claude does are listed so you can see they happened.

---

## Conflicts flagged

| # | Topic | Sources say | This plan does |
|---|---|---|---|
| I1 | Your coding level | Your brief: "as stated in CONTEXT.md". CONTEXT gives only "comfort 5/5 (assumed)" for admins. PRD: you are the only developer. | **Answered: correct.** SSH is fine when every command is a card (§6.7). |
| I2 | Sessions 15 and 16 | Your list puts Notifications and Wedding-day mode in the build order. PRD/FEATURES: they are **R2a (15 Nov)** and **R2b (10 Jan)**, not the 25 Oct launch. | Sessions 1–14 = Release 1. Session 15 = R2a. Session 16 = R2b. Release 1 "done" (§8) needs 1–14 only. |
| I3 | R2a items not in your list | FEATURES Part C R2a also has **global search, card tracking, printable lists**. | **Answered: Session 15b, Mon 2 – Sat 7 Nov.** Nothing extra before launch. |
| I4 | Time to launch | 14 sessions between Thu 8 Oct and Sun 25 Oct (17 days), plus staging checks and family tests. | **Very tight: about one session a day.** Schedule in §5.0. TESTING §3.2 rule stays: a data-loss bug moves launch up to 1 week (Sun 1 Nov). |
| I5 | Usability test dates | TESTING §5: 13–16 Oct. Guests and money don't exist on staging until Sessions 8–9 (~15–16 Oct). | **Answered: Tue 20 – Thu 22 Oct** on the Session 11 build. TESTING §5 dates need this update. |
| I6 | ZIP names | DATA-SAFETY §5.4 / TESTING §8.1: `am-wedding_code_<date>_<topic>.zip`, `deploy_v<ver>/1-api.zip…` | **Your names:** `project-source-sessionNN.zip` and `deploy-sessionNN.zip` (§4). The 4-part upload order inside is kept. DATA-SAFETY §5.4 and TESTING §8.1 need this rename. |
| I7 | Folder on Hostinger | DATA-SAFETY §3.3 uses `domains/lumorrahouse.com/public_html` and `…/private`. Hostinger's **default** subdomain is a sub-folder **inside** the main site's folder ([Hostinger help](https://www.hostinger.com/support/?p=1497)), so the app would also open at `lumorrahouse.com/wedding/`, and live and staging would share one `private/`. | **Add each subdomain as its own website** in hPanel. Each gets `domains/<subdomain>/public_html` with its own `private/` beside it (§6.1). All paths in this plan use that. **Answered: yes.** DATA-SAFETY v1.2 now uses `domains/wedding.lumorrahouse.com/…`. SSH card S10 (DATA-SAFETY §3.4) checks the real folder names. |
| I8 | Folder names | Your brief: `/scripts` for backup and cron. TESTING §0.3: `tools/` (sandbox scripts), `e2e/`. | Both kept: `/scripts` runs **on Hostinger**; `/tools` runs **only in Claude's sandbox**. |
| I9 | PHP code location | API §10.3: `.env`, uploads, exports, backups outside `public_html`. Nothing says where PHP code goes. | **All PHP code also lives outside `public_html`** (`private/app/`). Only a 3-line `public_html/api/index.php` is reachable from the web. A web-server mistake can then never show source code. |
| I10 | Offline saving and Android install | PRD §6 and FEATURES A0: "Saving offline: blocked", "no custom prompt". | Superseded by CONTEXT v1.4/v1.5 decisions 6–7: **limited outbox** and **our own Android install banner**. FEATURES A0 still needs the edit PWA.md listed. |
| I11 | `DESIGN.md` | Your brief: shared components from DESIGN.md. **It is not in Project knowledge or the uploads.** | **Answered: DESIGN.md v1.2 is being added.** It was not yet in Project knowledge when I checked on 8 Oct. Session 1 reads it first; if it's still missing, Session 1 builds only the plumbing and asks before drawing any screen. |
| I12 | Email sending | PWA §7.9: PHPMailer over SMTP. DATA-SAFETY `backup.php`: PHP `mail()`. Hostinger caps server `mail()` at 10/min and 100/day ([Hostinger limits](https://www.hostinger.com/support/6976044-parameters-and-limits-of-hosting-plans-in-hostinger/)). `mail()` may not be DKIM-signed for our domain. | **One mailer for everything: SMTP as `planner@lumorrahouse.com`.** Session 4 switches `backup.php` alerts to it, keeping `mail()` only as a fallback. |
| I13 | Off-site backup target | CONTEXT decision 20 / Q2: Gmail or Drive. DATA-SAFETY S2: **Backblaze B2**. | Follows DATA-SAFETY (B2). CONTEXT v1.6 still has to record it. |
| I15 | Payments before launch | PRD pre-launch row: payments stay in the sheet until 25 Oct. | **Answered: real tasks and payments go on live once Session 4's backup is green** (tasks from Session 5, payments from Session 9, receipts from Session 10). Guests only at launch. Sheet kept until 8 Nov. PRD needs this update. |
| I16 | Session 15b week | 2–8 Nov is also Diwali week, the in-person install for elders, and the sheet-retirement check on 8 Nov. | 15b goes live by **Sat 7 Nov**; it may split into 15b + 15c. |
| I14 | Excel library | Not chosen anywhere. | **OpenSpout** to read `.xlsx` (light, streams). The template with dropdowns is a **static file** (`/templates/AM_Guest_List_Template.xlsx`) made once in the sandbox. No PhpSpreadsheet on the server (fewer files, fewer inodes). |

## Answers applied (8 Oct 2026)

| # | Question | Answer | Applied in |
|---|---|---|---|
| 1 | Coding level | Correct. SSH is fine if each command is given exactly, one at a time, with what I should see. | I1, §4.5, §6.7, §6.8, §8.1; DATA-SAFETY v1.2 §3.4 (cards S1–S17, B1–B3, D1–D3, K1) |
| 2 | DESIGN.md | v1.2 being uploaded | I11 |
| 3 | R2a extras | Session 15b, 2–8 Nov. Nothing extra before launch. | I3, I16, §5.0, Session 15b |
| 4 | Family test | Tue 20 – Thu 22 Oct | I5, §5.0 |
| 5 | Separate websites | Yes, and update DATA-SAFETY paths | I7, §6.1; DATA-SAFETY v1.2 |
| 6 | MX records | **Not answered yet** (the template text came back unchanged) | Open Question 1 |
| 7 | `ALERT_TO` | Your two Gmail addresses | You type them into `private/.env` and `config.php` yourself. They don't need to be in any doc, chat or ZIP. |
| 8 | Real data before launch | Tasks and payments after Session 4's backup is green; receipts after Session 10; guest Excel only at launch; sheet until 8 Nov | I15, §5.0, Sessions 4, 5, 9, 10, §9.1, §9.2 |
| 9 | GitHub | Yes | §1, §4.2, §4.4, §4.5, §4.6, §8.1 |
| 10 | Days off | **Not answered yet** (template text) | Open Question 2. The plan still assumes one session every day. |

---

## 1. Repository structure (monorepo)

```
am-wedding/
├── api/                 PHP 8.2+ REST API (no framework). Runs from private/app on Hostinger.
│   ├── bootstrap.php     Builds the app; public_html/api/index.php requires this file.
│   ├── src/              Kernel, middleware, base classes, one folder per module.
│   ├── tests/            PHPUnit: endpoints, security, data safety, coverage gate.
│   ├── composer.json     + composer.lock (exact versions).
│   └── vendor/           Composer packages. In deploy ZIPs, not in project ZIPs (§4.2).
├── web/                 React + Vite + Tailwind PWA.
│   ├── src/              Screens, components, API client, offline layer, service worker.
│   ├── public/           Manifest, icons, ios-class.js, reset page, install-guide images, templates.
│   ├── package.json      + package-lock.json (exact versions).
│   └── vite.config.js    Builds dist/ for "staging" and "live".
├── e2e/                 Playwright journeys (TESTING §1.8).
├── db/
│   ├── migrations/       001_init.sql, 002_open_answers.sql, 003_api_support.sql, … Run in phpMyAdmin.
│   ├── dev/              seed_demo.sql: staging only, never live.
│   └── test/             fixtures.sql: small data for automated tests.
├── scripts/             Runs on Hostinger: backup/backup.php, cron/daily.php, cron/reminders.php (R2a).
├── tools/               Runs only in Claude's sandbox: sandbox-setup.sh, test-all.sh, make-deploy.sh, router.php.
├── docs/                Copies of the project docs + SESSION-LOG.md, RELEASE-NOTES.md, openapi.yaml.
├── .env.example         Every setting the server needs, with safe fake values. The real .env never enters a ZIP.
├── .gitignore           Keeps .env, config.php, backup.key, vendor/, node_modules/, dist/ and exports out of Git.
├── TEST-REPORT.md       Written by tools/test-all.sh at the end of each session.
└── VERSION              App version, e.g. 1.0.5. Bumped every session that deploys.
```

### 1.1 `.env.example`

```ini
# A&M Wedding — copy to private/.env on Hostinger and fill in. Never upload a filled .env into a ZIP.
APP_ENV=live                       # live | staging | test
APP_URL=https://wedding.lumorrahouse.com
APP_NAME="A&M Wedding"

DB_HOST=localhost
DB_PORT=3306
DB_NAME=u000000000_amlive
DB_USER=u000000000_amlive
DB_PASS=change-me

STORAGE_ROOT=/home/u000000000/domains/wedding.lumorrahouse.com/private/storage   # holds uploads/ and exports/
LOG_DIR=/home/u000000000/domains/wedding.lumorrahouse.com/private/logs
STORAGE_QUOTA_BYTES=53687091200    # 50 GB plan (API §11)
DB_QUOTA_BYTES=3221225472          # 3 GB per database

SETUP_TOKEN=change-me-long-random  # one-time owner creation (API §3.2). Delete after use.
TRUSTED_PROXY=                     # leave empty unless Session 4 proves Hostinger sends a forwarding header
MIN_CLIENT_VERSION=1.0.0           # older phones get "Please close and reopen the app"

MAIL_ENABLED=false                 # password-reset emails (off at launch, CONTEXT 29)
ALERTS_ENABLED=true                # backup / error-digest emails to the couple
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=ssl
SMTP_USER=planner@lumorrahouse.com
SMTP_PASS=change-me
MAIL_FROM=planner@lumorrahouse.com
MAIL_FROM_NAME="A&M Wedding"
ALERT_TO=ayush@example.com,mahi@example.com
MAIL_DAILY_CAP=30

# R2a (Session 15)
VAPID_SUBJECT=mailto:planner@lumorrahouse.com
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```

Fixed rules live in code, not `.env`, so nobody can change them by editing a file: `EXPECTED_SCHEMA_VERSION`, purge date 16 May 2027 (CONTEXT 34), money limits, rate limits.

---

## 2. PHP backend architecture

### 2.1 Framework or not

| Option | For | Against | Verdict |
|---|---|---|---|
| **No framework** (our own ~600 lines of kernel) | Every hard part is ours anyway: idempotency inside the same transaction, version checks, audit rows, batches. In-process test requests are simple. Few files on shared hosting (600,000 inode cap). Nothing to upgrade before February. | We write a router and middleware chain. | **Chosen.** |
| Slim 4 | Good router and PSR-15 middleware. | Needs a PSR-7 library and a container. Our idempotency/audit/version logic still sits on top. More moving parts to explain in a bug report. | Not needed |
| Laravel / Symfony | Everything built in. | Heavy, many files, its own conventions; ORM hides the exact SQL we must control (DATABASE §5). | No |

**Libraries we do use** (all pinned in `composer.lock`):

| Package | Job | Session |
|---|---|---|
| `phpmailer/phpmailer` | SMTP email (alerts, later reminders and resets) | 4 |
| `maennchen/zipstream-php` | Full export streamed as a ZIP without filling memory | 11 |
| `openspout/openspout` | Read `.xlsx` guest imports, row by row | 8 |
| `minishlink/web-push` | Web Push (R2a) | 15 |
| `phpunit/phpunit` (dev only) | Tests. Never in deploy ZIPs. | 1 |

ULIDs, UUIDs, `.env` parsing and validation are small classes of our own. No ORM.

### 2.2 Folders inside `api/src`

```
api/src/
├── Kernel/        App.php, Router.php, Request.php, Response.php, HttpError.php,
│                  Env.php, Clock.php (SystemClock / FrozenClock), Ulid.php, Uuid.php, Logger.php, Strings.php
├── Middleware/    RequestId, SecurityHeaders, ErrorHandler, MethodGuard, JsonBody, MaintenanceGuard,
│                  ClientVersion, RateLimit, Session, Csrf, Idempotency
├── Db/            Db.php (PDO + connect rules), UnitOfWork.php (one transaction per write)
├── Validation/    Validator.php, Rules.php (phone, paise, ist_date, enum, text, https_url, ulid…)
├── Auth/          Permissions.php (role matrix, API §6.1), MoneyFilter.php, Passwords.php
├── Safety/        AuditLog.php, ChangeBatches.php, UndoService.php, TrashService.php, ConflictBuilder.php
├── Repo/          BaseRepository.php, Cursor.php, EntityDef.php
├── Http/          BaseController.php (list, get, create, update, delete, restore, history for free)
├── Modules/       Auth, Members, Settings, Health, ClientLog, Tasks, Events, Calendar, Dashboard,
│                  Guests (Households, Invitations, Bulk, Imports), Money (Categories, Vendors, Payments),
│                  Documents, History, Trash, Undo, Exports, Sync, (R2a) Push, Reminders, (R2b) WeddingDay
└── Mail/          Mailer.php (PHPMailer over SMTP, daily cap, mail() fallback for alerts only)
```

### 2.3 One request, start to finish

```
public_html/api/index.php ──► private/app/bootstrap.php ──► App::handle(Request)
   RequestId        X-Request-Id on every reply (meta.request_id)
   SecurityHeaders  API CSP "default-src 'none'", Cache-Control: no-store
   ErrorHandler     any exception → JSON envelope; 500 never shows paths, SQL or stack (SEC-29)
   MethodGuard      only GET/POST/PUT/PATCH/DELETE (SEC-31)
   JsonBody         size caps (1 MB; import 5 MB; upload 16 MB), JSON only for bodies (SEC-17)
   MaintenanceGuard schema below EXPECTED_SCHEMA_VERSION → writes get 503 app_updating (DATABASE rule 14)
   ClientVersion    X-Min-Client-Version header; old app writing → 426 update_required
   RateLimit        anonymous / read buckets (API §10.1)
   Session          cookie → sessions.token_hash; user, role, money flag read fresh (API §3.1)
   Csrf             X-CSRF-Token + Origin / Sec-Fetch-Site on every write (SEC-14…17)
   RateLimit        write / bulk / upload / export buckets
   Idempotency      claim the key (own autocommit) or replay / 409 in progress / 422 reused (API §5.3)
   Router           matches /api/v1/<resource>/… → Controller method; unknown query param → 400
   Controller       permission check → Validator → Service
   UnitOfWork       ONE transaction: change + audit_log + change_batches + idempotency "done" reply
   Response         {ok, data, meta} with ETag "<version>"
```

### 2.4 Shared base classes: what every module gets for free

A module declares **what** it is. The base classes do **how**. A new module is mostly an `EntityDef`.

```php
// api/src/Modules/Tasks/TaskDef.php — example of a module declaring itself
final class TaskDef extends EntityDef
{
    public const TABLE = 'tasks';
    public const TYPE  = 'task';                       // audit_log.entity_type, URLs, /sync
    public const PUBLIC_ID = true;                     // has public_id (ULID)
    public const FIELDS = [                            // writable fields + rules (server is the authority)
        'title'     => ['text', 'required', 'max' => 200],
        'status'    => ['enum', 'values' => ['todo','doing','waiting','done','cancelled']],
        'priority'  => ['enum', 'values' => ['urgent','normal','low']],
        'due_date'  => ['ist_date', 'nullable'],
        'due_time'  => ['hhmm', 'nullable', 'needs' => 'due_date'],
        'notes'     => ['text', 'nullable', 'max' => 5000],
        'event_id'  => ['link', 'to' => EventDef::class, 'nullable'],
    ];
    public const CHILDREN = [                          // soft-deleted and restored in the same batch
        TaskItemDef::class, TaskAssigneeDef::class, TaskTagDef::class,
    ];
    public const MONEY_FIELDS = [];                    // stripped for non-money users (MoneyFilter)
    public const NEVER_RETURN = ['client_uuid'];       // plus id, deleted_* (always)
}
```

| Shared piece | What it guarantees | Docs it enforces |
|---|---|---|
| `Db::connect()` | `SET NAMES utf8mb4`, `time_zone '+00:00'`, strict `sql_mode`, exceptions on, real prepared statements (`ATTR_EMULATE_PREPARES = false`) | DATABASE rule 1 |
| `BaseRepository::create()` | Insert with `client_uuid` = `Idempotency-Key`; duplicate `client_uuid` → returns the existing row with 200 | DATABASE rule 2, DS-04, DS-08 |
| `BaseRepository::update()` | Writes **only changed columns** + `version = version + 1` + `updated_by`, `WHERE id = ? AND version = ? AND deleted_at IS NULL`. 0 rows → re-read → `409 record_deleted` or `409 version_conflict` with `current`, `changed_fields`, `changed_by` | DATABASE rule 3, API §4, DS-01…03 |
| `BaseRepository::softDelete()` | New `change_batches` row; sets `deleted_*`, `delete_batch_id`, version + 1 on the row **and every `CHILDREN` row** in the same batch; locks the parent `FOR UPDATE` | DATABASE rules 5, 9; DS-11, DS-18 |
| `BaseRepository::restore()` | Only rows with that `delete_batch_id`; clash checks (live name, phone) | DATABASE rule 6; DS-14…17 |
| `UndoService` | Reverts each audit row of a batch only if `version` still equals `entity_version`; names skipped rows; `undone_at` once | DATABASE rule 7; DS-12, DS-13 |
| `AuditLog::record()` | Full `before_json` / `after_json` (minus secrets), `entity_version`, `batch_id`, `device`. **There is no update or delete method.** | DATABASE §3, DS-20 |
| `UnitOfWork::run()` | Change + audit + batch + stored idempotent reply commit together; any error → rollback + release the key | API §5.3, DS-24 |
| `Cursor` | Stable cursor paging, `bad_cursor` when filters change, `meta.total` | API §1.4 |
| `Validator` | Same rule names as `EntityDef`; `422` with `error.fields` (incl. `items.2.text`); `""` → `null`; trims; character lengths | API §1.1, S11 |
| `MoneyFilter` | Removes every `_paise` field and money records for non-money users, in replies **and** History | API §1.5, S10, SEC-01 |
| `BaseController` | `list`, `get`, `create`, `update`, `delete`, `restore`, `history` wired to the above, with permission checks from `Permissions` | API §6 |
| `Clock` | All "now" comes from here; tests freeze and move time (no `sleep()`) | TESTING §1.2 |
| Bulk helper | `as_of` skip rule; one batch; > 2,000 rows → 422 | DATABASE rule 10, DS-25 |

**Static checks run by the test suite** (TESTING DS-19, DS-20, DS-27): no `DELETE FROM` except the allowed tables; no `UPDATE audit_log`; no `float` near `_paise`; no string-built SQL (every query uses `?` placeholders).

### 2.5 Hard rules for every PHP file

1. Every SQL statement is a prepared statement. Sort fields come from a whitelist, never from the request.
2. No business logic in controllers: controller = permission → validate → service.
3. Every write goes through `UnitOfWork::run()`. No exceptions.
4. Every time is UTC in the database; "today" is computed in IST from `Clock` (DATABASE §3).
5. Money is `int` paise end to end.
6. User-visible text comes from `Strings.php` keys (for Hindi later).

---

## 3. Frontend architecture

### 3.1 Libraries

| Library | Job |
|---|---|
| React + Vite 7 + Tailwind CSS | App, build, styles |
| React Router (data router) | Screens and deep links |
| TanStack Query v5 | Server data, loading/error states, refetch on focus/reconnect |
| `idb` | IndexedDB wrapper (PWA §5.1) |
| React Hook Form + Zod (+ `@hookform/resolvers`) | Forms and friendly validation |
| `vite-plugin-pwa` **1.3.0 pinned** + Workbox | Service worker, `injectManifest` (PWA §0) |
| Vitest, Testing Library, `fake-indexeddb`, `msw`, `vitest-axe`; Playwright | Tests (TESTING §1.7–1.8) |

Exact versions are fixed in `package-lock.json` in Session 1 and not upgraded before 20 Feb 2027 unless a bug forces it.

### 3.2 Folders inside `web/src`

```
web/src/
├── main.jsx, App.jsx, routes.jsx
├── api/          client.js (the only place that calls fetch), errors.js, keys.js (query keys), session.js
├── offline/      db.js, cache.js (records + snapshots), sync.js (/sync), outbox.js, queueable.js
├── data/         one hook file per module: tasks.js, guests.js, money.js … (useTasks, useSaveTask…)
├── forms/        useEntityForm.js (RHF + Zod + draft + saved state + 422 mapping + conflict), drafts.js
├── conflict/     merge3.js, ConflictScreen.jsx
├── components/   shared UI (§3.7)
├── screens/      home/, tasks/, calendar/, guests/, money/, documents/, more/, settings/, auth/, install/
├── format/       inr.js (₹1,25,000), phone.js (E.164 ↔ +91 98290 12345), ist.js (Asia/Kolkata always)
├── i18n/         strings.en.js (every visible word; Hindi later)
├── pwa/          platform.js, AndroidInstallBanner.jsx, UpdatePrompt.jsx, dirtyForms.js, persist.js
└── sw.js         Service worker (PWA §4.3)
```

### 3.3 Routing

| Path | Screen | Who |
|---|---|---|
| `/login`, `/link/:token`, `/setup` | Log in, set password from link, first owner | Anyone |
| `/` | Home (dashboard) | All |
| `/tasks`, `/tasks/:id` | Tasks | All (edit: Ed) |
| `/calendar`, `/events/:id` | Agenda + month, event | All (edit: Adm) |
| `/guests`, `/guests/:id`, `/guests/import` | Families, family, import | All / Adm for import |
| `/money`, `/money/payments/:id`, `/money/vendors/:id` | Budget, payments, vendors | `$` |
| `/documents`, `/documents/:id` | Documents | All (private: Adm) |
| `/add/:type` | Quick Add (also Android shortcuts) | Ed |
| `/more`, `/settings/*` | Members, My account, Safety, Deleted items, Activity, Export, This phone | By role |
| `/install` | Install Guide | Anyone |
| `/wedding-day` | Wedding Day (R2b; "Opens on 13 Feb" before) | All |

- Each screen is lazy-loaded (small first download).
- A route guard reads `permissions` from `GET /session`. The server still checks everything.
- Every sheet and screen is one history step, so Android Back and the iPhone edge-swipe go back one step (PWA §1).
- URLs carry only `public_id` (26 characters). Never numbers.

### 3.4 API client (`api/client.js`)

One function, `api(method, path, {body, ifMatch, idemKey})`. Nothing else calls `fetch`.

| Job | How |
|---|---|
| Base | Same origin, `/api/v1`. `credentials: 'same-origin'`. |
| Case | Request body camelCase → snake_case; reply snake_case → camelCase (CONTEXT §8). |
| CSRF | Token held **in memory**; fetched by `GET /session` at start and after login; sent as `X-CSRF-Token` on writes. |
| Idempotency | Every write gets `Idempotency-Key`. Creates: the form's `client_uuid` (made when the form opens, saved in the draft). Other writes: a new key per user action, kept for its retries. |
| Version | `If-Match: "<version>"` on PATCH/PUT/single DELETE. |
| Other headers | `X-Client-Version` (`__APP_VERSION__`), `X-Device` ("iPhone · installed"). |
| Timeout | 15 s → "Couldn't save. Your changes are kept on this phone. [Try again]" (same key). |
| Errors | Typed: `OfflineError`, `ValidationError(fields)`, `ConflictError(current, changedFields, changedBy)`, `DeletedError`, `DuplicateError(matches)`, `AuthError` (401 → login sheet over the form, then one retry with the same key), `UpdateRequired` (426 → forced update prompt), `RateLimited(retryAfter)`. |
| Never | Never says "Saved" before a 2xx (AC-SAV-05). Never retries a write on its own except through the outbox. |

### 3.5 Server data: TanStack Query + IndexedDB

| Rule | Detail |
|---|---|
| Reads | `queryFn` tries the API; on success writes the rows into IndexedDB `records`. Offline (or network error), it reads `records` instead and marks the result `fromCache` with its age. `networkMode: 'always'` so our own function decides. |
| Freshness | `staleTime` 30 s; refetch on focus and reconnect; `/sync` every 5 min while open (PWA §5.1). |
| Shown age | Every list shows "Updated 10:42 AM" or "No internet · from Tue 13 Oct, 9:40 PM" (PWA §5.1). |
| Writes | **No optimistic updates.** After a 2xx: update the record in the cache and invalidate the list. |
| Retries | GET only, twice, on network errors. Mutations: never automatic. |
| Logout | Clear the Query cache and `wipeAll()` IndexedDB, after the outbox check (PWA §5.5). |

### 3.6 Outbox (Session 14)

Exactly as PWA §5.2. In short:

- **Queueable** (decision 7): tick task, add/edit task, checklist items, add/edit family, set Coming?.
- A queueable save is written to IndexedDB **before** sending. It leaves only on a 2xx or **Discard**.
- Sent oldest first, on app open, reconnect, return to the app, and **Send now**. No Background Sync.
- 409 → "Needs your choice" → conflict screen. 422 → form reopens. 401 → kept, sent after login.
- Non-queueable buttons show "Needs internet" offline.
- **Safe cut if Session 14 runs late** (PWA §12): outbox as the only save path for those actions, with offline *starting* behind a flag until 1 Nov.

### 3.7 Forms and shared components

**Forms:** `useEntityForm(def)` wraps React Hook Form + a Zod schema and adds, for every form at once:

| Built in | Rule |
|---|---|
| Labels above fields; errors under the field + "Please fix 2 things below." | FEATURES A3 |
| Local draft 1 s after typing, key `draft:{user}:{form}:{id}`, restored with "You have unsaved changes from 10:42" | AC-SAV-01 |
| Saved indicator: Saving… → Saved ✓ 10:42 / 🕒 Waiting to send / Couldn't save | AC-SAV-05 |
| Server 422 `fields` mapped onto the right inputs | S11 |
| 409 → Conflict screen (`merge3`), sending only chosen fields with a new key | FEATURES A4 |
| Registers as "dirty" so the update prompt waits (PWA §6.2) | CONTEXT 36 |
| Indian inputs: phone number pad, amounts in rupees/lakh → paise | FEATURES A9 |

Zod gives friendly messages on the phone. The PHP `Validator` is still the authority.

**Shared components** (names from FEATURES/PWA/TESTING; look and spacing from DESIGN.md once added):

| Component | Used for |
|---|---|
| `AppShell`, `TopBar` (with **← Back**), `BottomNav` | Layout, safe areas, one-handed use |
| `AddButton` (+ bottom-right) and `QuickAddSheet` | Max 3 taps to add (AC-QA-01) |
| `BottomSheet` | Every form |
| `ListRow`, `ChipFilter`, `SelectBar` (long-press **and** visible Select button) | WhatsApp-style lists (CONTEXT 21) |
| `Field`: `TextField`, `PhoneField`, `MoneyField`, `DateField`, `TimeField`, `Select`, `Toggle`, `NumberStepper` | Forms; ≥ 48 px targets, ≥ 17 px text |
| `SavedIndicator`, `UndoSnackbar` (8 s, pauses on touch), `Banner` (offline / waiting / needs your choice) | Save state, undo, offline |
| `ConflictScreen`, `DuplicateDialog`, `ConfirmDialog` (logout and export only) | Safety |
| `EmptyState`, `Skeleton`, `ErrorBoundary` (logs to `/client-log`) | States |
| `WhatsAppButton`, `CallButton` | `wa.me` and `tel:` links |

---

## 4. The ZIP handover

### 4.1 One build session

```
New chat in the "Wedding Planner" project
  └─ you attach project-source-session(N-1).zip and paste the session prompt (§4.5)
       └─ Claude: unzip → tools/sandbox-setup.sh → FULL test suite (must be green first)
            └─ build Session N + its tests → full suite again → TEST-REPORT.md
                 └─ Claude hands you: project-source-sessionNN.zip + deploy-sessionNN.zip
                      └─ you: save both to Drive → deploy to STAGING → phone checks
                           └─ when green: deploy the same ZIP to LIVE (from Session 4 on)
```

### 4.2 What goes in each ZIP

| | `project-source-sessionNN.zip` | `deploy-sessionNN.zip` |
|---|---|---|
| Purpose | Start the next chat | Upload to Hostinger |
| Contains | Everything in §1: `api/` (without `vendor/`), `web/` (without `node_modules/`, `dist/`), `e2e/`, `db/`, `scripts/`, `tools/`, `docs/`, `.env.example`, `.gitignore`, `VERSION`, `TEST-REPORT.md`, lock files, `.git/` (full history) | `staging/` and `live/` folders (same layout, different web build), `RELEASE-NOTES.md`, `migrations/` (only new ones), `TEST-REPORT.md` |
| Never contains | `.env`, `config.php`, `backup.key`, real guest data, `node_modules/` | `.env`, `config.php`, `backup.key`, tests, PHPUnit, `seed_demo.sql` in `live/` |
| Size | Small (a few MB) | ~10–20 MB (includes `vendor/`) |
| If the sandbox can't install Composer packages | `api/vendor/` is added to the project ZIP too (TESTING §1.1) | Same |

Inside `deploy-sessionNN.zip`:

```
deploy-session05/
├── RELEASE-NOTES.md        what changed, which checks to run, any migration, any .env change, old assets to delete later
├── TEST-REPORT.md
├── migrations/             e.g. 004_….sql (only if this session adds one)
├── staging/
│   ├── 1-server.zip        private/app/** (bootstrap, src, vendor) + public_html/api/index.php + private/cron/** + private/backup/backup.php
│   ├── 2-assets.zip        public_html/assets/**   (hashed files: only ever added)
│   ├── 3-shell.zip         public_html/{index.html, sw.js, manifest.webmanifest, .htaccess, icons/, install-guide/, templates/, reset.html, reset.js, ios-class.js, assets/.htaccess}
│   └── version.json        uploaded LAST, by itself
└── live/                   same four items; the live web build ("A&M Wedding", live icon)
```

Every inner ZIP holds paths **starting at the site folder** (`private/…`, `public_html/…`). So you always extract it in the site folder and every file lands in the right place.

### 4.3 Naming

| Item | Name | Example |
|---|---|---|
| Source | `project-source-sessionNN.zip` (two digits) | `project-source-session05.zip` |
| Deploy | `deploy-sessionNN.zip` | `deploy-session05.zip` |
| A session that needed a second chat | add `b`, `c` | `project-source-session08b.zip` |
| A bug-fix chat after launch | `fixNNN` with the date | `project-source-fix003_2026-11-02.zip`, `deploy-fix003_2026-11-02.zip` |
| App version | in `VERSION` and Settings → This phone | `1.0.5` = Session 5; fixes `1.0.5.1`… after launch `1.1.x` |

The app version is how you match a phone, a ZIP and a test report.

### 4.4 Where you store them (Google Drive)

```
A&M Wedding/                     (shared between Ayush and Mahi only; 2FA on both accounts)
├── code/          project-source-*.zip     ← every one, never deleted
├── deploys/       deploy-*.zip + log.txt   ← every one; keep at least the last 5; never delete what is live
├── exports/       wedding-export_YYYY-MM-DD.zip (monthly + _pre-deploy)
├── backups-manual/  only if SSH backup fails (DATA-SAFETY §5.1)
├── bugs/          one file per bug (TESTING §10)
└── archive/       after the wedding (DATA-SAFETY §9)
```

**End-of-session routine (2 minutes):** download both ZIPs from the chat → upload to `code/` and `deploys/` → check `TEST-REPORT.md` says "Pushed" (GitHub, §4.6) → write one line in `deploys/log.txt`: date, session, version, "staging OK / live OK". If you lose a ZIP, the previous one in `code/`, or GitHub, is enough to rebuild.

### 4.5 The prompt you paste at the start of each chat

```
Session NN — <name> (IMPLEMENTATION.md §5, Session NN).
Attached: project-source-session<NN-1>.zip.
GitHub token for this chat: <paste from password manager, or "none">
Follow IMPLEMENTATION.md and TESTING.md §0.2 rules.
1. Run tools/sandbox-setup.sh and the full suite. Stop and fix if red.
2. Build Session NN exactly as listed. Flag anything that conflicts with CONTEXT.md.
3. Run the full suite. Write TEST-REPORT.md. Commit, tag session-NN, push to GitHub.
4. Give me project-source-sessionNN.zip and deploy-sessionNN.zip, plus RELEASE-NOTES in chat.
   Every SSH step as a card: one command, typed exactly, what I should see, what to do if not.
Notes from my last staging check: <paste, or "none">
```

If Claude runs low on room mid-session, it stops at the last **green** point, hands over `…sessionNNb` ZIPs, and lists what is left. A half-built feature never ships: it stays behind a feature flag that is off.

### 4.6 GitHub (answered: yes)

GitHub keeps every commit with its message, so any version can be found and compared. The project ZIPs in Drive stay as well; GitHub is an extra copy, not a replacement.

**Once (about 15 minutes, on a computer):**

| # | Where | Do this |
|---|---|---|
| 1 | github.com | Sign up or sign in as Ayush. **Settings → Password and authentication → Enable two-factor authentication.** Save the recovery codes in the password manager. |
| 2 | **+ → New repository** | Name `am-wedding`. Visibility **Private**. Leave "Add a README" **unticked**. **Create repository.** |
| 3 | Repo → **Settings → Collaborators** | Optional: add Mahi. |
| 4 | Your picture → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token** | Name `claude-chat-push`. Expiration **Custom: 31 Mar 2027**. Repository access **Only select repositories → `am-wedding`**. Permissions → Repository permissions → **Contents: Read and write** (Metadata read-only is added by itself). Nothing else. **Generate token.** Copy it into the password manager as "GitHub token (Claude)". It is shown only once. |

**Each session:** paste the token into the session prompt (§4.5). Claude:

- commits after each green step (`Session 05: tasks API + tests`), tags the end `session-05`, and tags each live deploy `v1.0.5`;
- pushes to `am-wedding` only, using the token for that chat only; it never writes the token into a file, a ZIP or a report;
- writes "Pushed: `<commit>`" or "Not pushed: `<reason>`" at the top of `TEST-REPORT.md`.

**If the sandbox can't reach github.com** (Session 1 checks this): nothing is lost. Claude still commits, and the full history travels in `.git/` inside every `project-source-sessionNN.zip` in Drive. Optional: attach that ZIP to a GitHub Release by hand (repo → **Releases → Draft a new release** → tag `session-05` → drag the ZIP in → **Publish release**).

**Never in Git** (blocked by `.gitignore` and checked by the test suite): `.env`, `config.php`, `backup.key`, `vendor/`, `node_modules/`, `dist/`, any export, any real guest data. Only `seed_demo.sql` demo data is in the repo.

**Token safety:** the token can only change code in this one private repo. If you think it leaked, delete it (same Settings page) and make a new one. Delete it after the wedding.


---

## 5. Build sessions

### 5.0 Order and dates

**Rule:** Sessions 1–4 build login, data safety and backups. The live database gets its first real record only **after** Session 4 has a green backup. Then (answer 8): real **tasks** from Session 5, real **payments** from Session 9, **receipts** from Session 10. **Guests only at launch**, from the Excel. Family members join at launch. The sheet stays until Sun 8 Nov. From Session 5 every live upload touches real data, so the release checklist (backup card B1 first) is never skipped.

| # | Session | Release | Target day (one chat) | Goes to live? |
|---|---|---|---|---|
| 1 | Scaffold | R1 | Thu 8 – Fri 9 Oct | Staging only |
| 2 | Login and members | R1 | Fri 9 Oct | Staging only |
| 3 | Data-safety plumbing | R1 | Sat 10 Oct | Staging only |
| 4 | Backup script live on Hostinger | R1 | Sun 11 Oct | **Yes — live opens (couple only)** |
| 5 | Tasks | R1 | Mon 12 Oct | Yes |
| 6 | Events and calendar | R1 | Tue 13 Oct | Yes |
| 7 | Dashboard | R1 | Tue 13 – Wed 14 Oct | Yes |
| 8 | Guests and RSVP (+ import) | R1 | Wed 14 – Thu 15 Oct (likely 8 + 8b) | Yes |
| 9 | Budget and payments | R1 | Fri 16 Oct | Yes |
| 10 | Documents and uploads | R1 | Sat 17 Oct | Yes |
| 11 | Export | R1 | Sun 18 Oct | Yes |
| 12 | PWA install and updates | R1 | Mon 19 Oct | Yes |
| 13 | PWA offline reading | R1 | Tue 20 Oct | Yes |
| 14 | PWA offline saving (outbox) | R1 | Wed 21 – Thu 22 Oct | Yes |
| — | Blocker fixes, chaos tests (TESTING §3), go-live prep (§9.1) | R1 | Fri 23 – Sat 24 Oct | Yes |
| — | **Launch** | R1 | **Sun 25 Oct** | — |
| 15b | Search, card tracking, printable lists | R2a | Mon 2 – Sat 7 Nov (may split 15b + 15c) | Yes, by Sat 7 Nov |
| 15 | Notifications | R2a | Mon 9 – Sun 15 Nov | Yes |
| 16 | Wedding-day mode | R2b | by Sun 10 Jan | Yes |

Family usability test (TESTING §5): **Tue 20 – Thu 22 Oct** on the Session 11 build (I5).

If a session slips by more than a day, cut in this order, never data safety: the iPhone splash images (PWA §2.4) → Android shortcuts → offline *starting* of edits (keep the outbox as the save path, PWA §12). If a data-loss blocker is open on Fri 23 Oct, launch moves to Sun 1 Nov (TESTING §3.2).

### 5.1 Every session (the parts not repeated below)

| Item | Always |
|---|---|
| Start | `tools/sandbox-setup.sh`; full suite green **before** new work |
| Tests | New feature ships with its tests. Standard set S1–S11 on every new endpoint (TESTING §1.3). Endpoint coverage gate passes. Vitest + `vitest-axe` on every new screen. Playwright `android`, `small-iphone`, `small-android`, `http` projects. |
| End | Full suite green; `TEST-REPORT.md`; `docs/SESSION-LOG.md` line; `RELEASE-NOTES.md`; both ZIPs |
| Your upload | Standard upload to **staging** (§6.8); from Session 4, the same `deploy-sessionNN.zip` to **live** after staging is green, using the release checklist (TESTING §8.2) |
| Your check | TESTING §2.1 core checks C1–C5 on **one Android (Chrome)** and **one iPhone (Safari; Home Screen app from Session 12)**, plus the session's own checks below |
| Done | §8.1 |

---

### Session 1 — Scaffold

**Goal:** an empty app that builds, tests, deploys to staging over HTTPS and answers `/api/v1/health`. Everything later plugs into it.

| Files created | Notes |
|---|---|
| `api/bootstrap.php`, `api/src/Kernel/*`, `api/src/Middleware/{RequestId,SecurityHeaders,ErrorHandler,MethodGuard,JsonBody,MaintenanceGuard,ClientVersion}.php`, `api/src/Db/Db.php` | §2.3 chain (Session, Csrf, RateLimit, Idempotency are stubs that refuse writes until Sessions 2–3) |
| `api/src/Modules/Health/*`, `api/src/Modules/ClientLog/*` | Anonymous `GET /health` (`ok`/`fail`), `POST /client-log` (TESTING §9.3) |
| `api/tests/Support/{ApiTestCase,ApiClient,Fixtures,FrozenClock,Endpoint}.php`, `api/tests/Coverage/EndpointCoverageTest.php` | Test kit (TESTING §0.3) |
| `docs/openapi.yaml` | From API.md §12 + `/client-log` |
| `web/` Vite + React + Tailwind + Router + Query skeleton; `web/src/api/client.js` (headers, errors), `web/src/i18n/strings.en.js`, `web/src/format/*`, design tokens, `AppShell`, `TopBar`, `BottomNav`, `Button`, `ErrorBoundary` | Placeholder Home: "A&M Wedding — version 1.0.1" |
| `web/public/ios-class.js`, `manifest.webmanifest` (no service worker yet), icons from `icons.zip` | Staging build: "A&M Staging", different icon colour (PWA §11) |
| `public_html/.htaccess`, `public_html/assets/.htaccess`, `public_html/api/index.php` stub | §6.6 |
| `tools/sandbox-setup.sh`, `tools/test-all.sh`, `tools/router.php`, `tools/make-deploy.sh`, `db/test/fixtures.sql`, `.env.example`, `VERSION` | Build and package |

| Tests that must pass | |
|---|---|
| DB | Migrations `001`→`002`→`003` apply on MySQL 8 (or MariaDB fallback, said in bold); **second run stops at each guard** (DS-28); `seed_demo.sql` loads |
| PHP | `GET /health` anonymous returns only `{"status":"ok"}`; DB down → `503 fail`; SEC-29 (no leaks), SEC-31 (methods), `client-log` rules (TESTING §1.3 last row) |
| HTTP E2E | SEC-05 (`/.env`, `/private/…`, `/uploads/…` never served), SEC-30 headers via the router copy of `.htaccess` |
| Front end | Vitest: `inr`, `phone`, IST date formats with the test machine in `America/New_York` (TESTING §1.7 "Indian formats") |

**Migration:** none new. **You run** `001_init.sql`, `002_open_answers.sql`, `003_api_support.sql`, then `db/dev/seed_demo.sql` on the **staging** database (§6.9).

**Upload:** first time only, do §6.1–§6.7 for staging. Then standard upload (§6.8) to staging. Create `private/.env` on staging from `.env.example` (APP_ENV=staging, staging DB).

**Phone check (Android + iPhone):**

| # | Check | Pass when |
|---|---|---|
| 1.1 | Open `https://staging-wedding.lumorrahouse.com` | Padlock; placeholder Home with version 1.0.1; text large and readable |
| 1.2 | Open `…/api/v1/health` | `{"status":"ok"}` |
| 1.3 | Open `…/.env` and `…/private/` | "Not found" or "Forbidden", never file contents |
| 1.4 | Open `http://staging-wedding…` (no s) | Jumps to `https://` |
| 1.5 | On a computer: securityheaders.com → staging URL | HSTS, CSP, nosniff, X-Frame-Options, Referrer-Policy present |

---

### Session 2 — Login and members

**Goal:** phone + password login with 90-day cookie, CSRF, rate limits; members by admin, invite link, admin reset; My account. (FEATURES B1, API §3, §6.2.)

| Files | |
|---|---|
| API | `Middleware/{Session,Csrf,RateLimit}.php` real; `Auth/{Permissions,Passwords,MoneyFilter}.php`; `Modules/Auth/*` (login, logout, logout-all, session, password change, link inspect/complete, reset request — off), `Modules/Members/*` (list, add, edit, deactivate, access end date, reset: set / generate / link), `Modules/Setup/*` (`/setup/owner`), `Modules/Settings/*` (GET/PATCH settings, settings history) |
| Web | `screens/auth/{Login,SetPassword,FirstOwner}.jsx`, `screens/settings/{Members,MemberForm,MyAccount}.jsx`, `api/session.js`, route guards, `LoginSheet` (401 over a form), `PhoneField`, theme (follow phone / light / dark) |

| Tests that must pass | |
|---|---|
| Endpoints | All of TESTING §1.3 rows for `/auth/*`, `/session`, `/setup/owner`, `/members…`, `/settings…` |
| Security | SEC-11, SEC-13, SEC-14…19, SEC-22, SEC-23, SEC-24, SEC-34 |
| Front end | Login errors in plain words; session expiry opens the login sheet and keeps the form (TESTING §1.7 "Session expiry") |
| E2E | Log in → Home → log out; E2E-11 (session ends mid-form) |

**Migration:** none.

**Upload:** standard (§6.8) to staging.

**Phone check:** TESTING §2.2 **S1** (invite by link via WhatsApp, open on the other phone), **S2** (reset → other phone logged out at next action), **S3** (theme). Plus: wrong password 6 times → "Too many tries. Wait 15 minutes."; log in on the iPhone as Nani (viewer) → no edit buttons anywhere.

---

### Session 3 — Data-safety plumbing (versions, undo, trash, audit, idempotency)

**Goal:** every safety mechanism exists and is proven **before** any real module: version check + conflict screen, idempotency, audit, batches, Undo, Trash, History, Activity, Safety card. Exercised on Settings, Members and Restore drills (the only editable things so far).

| Files | |
|---|---|
| API | `Middleware/Idempotency.php`; `Db/UnitOfWork.php`; `Safety/*`; `Repo/{BaseRepository,Cursor,EntityDef}.php`; `Http/BaseController.php`; `Modules/{Undo,Trash,History,Activity}/*` (`/undo/{batch}`, `/trash…`, `/{resource}/{id}/restore`, `DELETE /trash/{batch}` refusing until 16 May 2027, `/{resource}/{id}/history`, `/activity`); `Modules/Safety/*` (`/backups`, `/restore-drills…`); admin detail in `/health` |
| Web | `forms/{useEntityForm,drafts}.js`, `conflict/{merge3.js,ConflictScreen.jsx}`, `components/{SavedIndicator,UndoSnackbar,DuplicateDialog,Banner}.jsx`, `screens/settings/{DeletedItems,Activity,Safety,HistorySheet}.jsx` |

| Tests that must pass | |
|---|---|
| Data safety | DS-01…DS-11, DS-13…DS-15, DS-18…DS-20, DS-24, DS-27 on settings, members and restore drills (later sessions extend the same data providers to their tables) |
| Security | SEC-06, SEC-08, SEC-09, SEC-20, SEC-21, SEC-32 |
| Front end | `merge3` cases; Saved indicator never "Saved" before 2xx; drafts; Undo snackbar (TESTING §1.7) |
| E2E | E2E-06 pattern (two contexts edit Settings), E2E-09 (lost reply → one record) |

**Migration:** none.

**Upload:** standard (§6.8) to staging.

**Phone check:**

| # | Check | Pass when |
|---|---|---|
| 3.1 | Android and iPhone both open Settings → wedding details. Android changes city → Save. iPhone changes start date → Save. | iPhone sees "Ayush changed this at …"; city merged; Save my choices works; History shows both |
| 3.2 | Safety → Log a restore drill → Delete → Undo | Drill back |
| 3.3 | Delete it again, wait 11 minutes, Deleted items → Restore | Back, same values |
| 3.4 | Activity | Plain sentences for 3.1–3.3 |
| 3.5 | Safety card | Backup **red** ("no backup yet") — correct until Session 4 on live |

---

### Session 4 — Backup script live on Hostinger

**Goal:** the **live** site exists with login and all safety plumbing, holds only the two of you, and has a proven nightly encrypted off-site backup, watchdog, uptime monitor and alert email. From the end of this session, real data may go in.

**Claude builds:**

| Files | |
|---|---|
| `scripts/backup/backup.php` | DATA-SAFETY §3.3 script, brought into the repo; alerts through `Mail/Mailer.php` (SMTP) with `mail()` fallback (I12); paths for the new site folder (I7) |
| `scripts/backup/config.example.php` | Template only |
| `scripts/cron/daily.php` | Deletes expired `sessions`, `login_attempts`, `idempotency_keys`, `rate_limits`; deletes export ZIPs > 24 h; rotates logs; error digest email (TESTING §9.3) |
| `api/src/Mail/Mailer.php` | PHPMailer SMTP, daily cap, plain text |
| `tools/fake-b2.php` | Fake Backblaze server for sandbox tests |

| Tests that must pass | |
|---|---|
| Backup | Against MySQL + fake B2: backup run → `backup_runs` ok with row counts and audit count/max id; second run uploads 0 files; decrypt → "-- Dump completed"; restore into a second DB with Hindi/emoji intact; watchdog at 37 h; failures (bad key, dump error, missing key, missing file) write `failed` and try to email |
| Health | backup > 26 h → anonymous `503 fail`; audit count down → red |
| daily.php | Deletes only the allowed tables (DS-19); keeps log rotation at 8 weeks |
| Mailer | Refuses after the daily cap; never sends when `ALERTS_ENABLED=false` |

**Migration:** none new. **You run** `001`, `002`, `003` on the **live** database. **Never `seed_demo.sql` on live.**

**You do, in this order (about 2 hours, on a computer):**

| Step | Where | Detail |
|---|---|---|
| 1 | hPanel | §6.1–§6.7 for the **live** site (`wedding.lumorrahouse.com`), live DB, live `.env` with a long `SETUP_TOKEN` and `ALERT_TO` = your two Gmail addresses |
| 2 | phpMyAdmin | Run `001`→`002`→`003` on the live DB (§6.9). Check `schema_migrations` shows 3 rows with `finished_at` |
| 3 | File Manager | Standard upload (§6.8) of `deploy-session04.zip` → `live/` |
| 4 | Phone | `https://wedding.lumorrahouse.com/setup` → create Owner (Ayush) with the setup token. Then **delete `SETUP_TOKEN` from live `.env`** |
| 5 | App | Members → Add Mahi as Partner → Invite by link → she sets her password |
| 6 | hPanel → Emails | Create `planner@lumorrahouse.com`; SPF, DKIM, DMARC (§7). Put its password in `.env` and `config.php` |
| 7 | Backblaze | DATA-SAFETY §3.2 (bucket with Object Lock, lifecycle, one-bucket key) |
| 8 | SSH + File Manager | DATA-SAFETY v1.2 §3.4 Steps 1–9, card by card (S1–S15): connect, tool checks, folder check, create `config.php`, make the key, **save the key in the password manager + on paper**, test email, first run, cron jobs (§6.10) |
| 9 | UptimeRobot | TESTING §9.1 monitors 1–3 |
| 10 | Drill #0 | DATA-SAFETY §4.2 on today's near-empty backup (cheap practice; the data is only two members) |

**Phone check:**

| # | Check | Pass when |
|---|---|---|
| 4.1 | Live Safety card (both phones) | Backup green, "a few minutes ago"; database green; storage green |
| 4.2 | Next morning | Card S16 shows `Done in … s.` from about 2:17 AM IST; Safety still green; B2 has 2 dumps |
| 4.3 | Email | Test alert arrived in Gmail **inbox** (not spam) for both; "Show original" says SPF, DKIM, DMARC PASS |
| 4.4 | Live `/api/v1/health` | `{"status":"ok"}`; UptimeRobot "Up" |

**From the next morning (4.2 green):** live is open for your real data, following the §5.0 rule.

---

### Session 5 — Tasks

**Goal:** tasks with checklist, assignees, tags, due date/time, priority, status, postpone history, "My tasks", views and chips (FEATURES B3). First module built on the base classes.

| Files | |
|---|---|
| API | `Modules/Tasks/*` (`TaskDef`, `TaskItemDef`, `TaskAssigneeDef`, `TaskTagDef`, `TagDef`; `/tasks`, `/tasks/{id}/done`, `/tasks/{id}/items…`, `/tags…`) |
| Web | `screens/tasks/{TaskList,TaskDetail,TaskForm,PostponeSheet}.jsx`, `data/tasks.js`, `AddButton`, `QuickAddSheet`, `ChipFilter`, `ListRow`, `SelectBar`, `DateField`, `TimeField` |

| Tests that must pass | |
|---|---|
| Endpoints | TESTING §1.3 `/tasks…` row (incl. Family deletes own task only, `done` twice → `already_done`, postpone count) |
| Data safety | DS-01, DS-04, DS-05, DS-11 (task with checklist, assignees, tags), DS-12, DS-15, DS-17 extended to tasks |
| Security | SEC-10 (Family deletes another's task → 403) |
| E2E | E2E-01 (3 taps), E2E-05 (delete → Undo) |

**Migration:** none.

**Upload:** standard to staging; after checks, to live. From now you may add real tasks on live (answer 8).

**Phone check:** TESTING §2.2 **T1–T5**.

---

### Session 6 — Events and calendar

**Goal:** the 7 events (dates, venue, map link, side, guests invited), agenda + month view with tasks and (later) payments, delete with counts, WhatsApp share (FEATURES B4, A7).

| Files | |
|---|---|
| API | `Modules/Events/*` (incl. `delete-preview`, `headcount` stub until guests), `Modules/Calendar/*` (`/calendar`, ≤ 93 days, `include_undated`) |
| Web | `screens/calendar/{Agenda,Month,EventDetail,EventForm}.jsx`, `WhatsAppButton`, `format/ist.js` extended |

| Tests that must pass | |
|---|---|
| Endpoints | TESTING §1.3 `/events…` and `/calendar` rows (admin-only writes, duplicate same type + date, `https://` map link) |
| Data safety | DS-01, DS-11 (event; invitations join in Session 8) |
| Front end | Times in IST with a non-IST test clock |

**Migration:** none. **You** fill in real event dates on live only if you have them (CONTEXT Q5).

**Upload:** standard to staging, then live.

**Phone check:** TESTING §2.2 **E1–E5**, and "Share on WhatsApp" opens WhatsApp with the venue text on both phones.

---

### Session 7 — Dashboard

**Goal:** Home with countdown, My tasks today, Overdue, Next events, Safety (admins); empty slots ready for RSVP and Payments cards (filled in Sessions 8–9). Role-based cards (FEATURES B2, DATABASE §7).

| Files | |
|---|---|
| API | `Modules/Dashboard/*` (`/dashboard`, `payments_window_days` 1–90, default 14) |
| Web | `screens/home/{Home,Countdown,MyTasksCard,OverdueCard,EventsCard,SafetyCard}.jsx` |

| Tests that must pass | |
|---|---|
| Endpoints | TESTING §1.3 `/dashboard` row; DATABASE §7.1, §7.2, §7.6 queries give the documented demo results |
| Security | SEC-07 (deleted records not counted) for tasks and events |
| Performance | Lighthouse mobile on Home ≥ the TESTING §7 budget |

**Migration:** none.

**Upload:** standard to staging, then live.

**Phone check:** C2 (Home cards per role: Papa sees tasks; Nani sees no Safety card); countdown says the right number of days in IST late at night (check after 11:30 PM once).

---

### Session 8 — Guests and RSVP

**Goal:** families, per-event invitations and Coming?, duplicates, headcount, bulk actions with one Undo, WhatsApp reminders, guest CSV export (admin), **Excel/CSV import with preview and "Undo this import"**, downloadable template (FEATURES B5, A8). Largest session: expect 8 + 8b.

| Files | |
|---|---|
| API | `Modules/Guests/*`: households, `duplicate-check`, `suggestions`, invitations (PUT/PATCH/DELETE, `whatsapp-opened`), `/households/bulk` (`as_of`), `/households/export` (CSV: BOM, IST, formula-safe), `/imports/preview`, `/imports`, `/imports/{id}`, `/imports/{id}/undo` (OpenSpout); event `headcount` real; dashboard RSVP card |
| Web | `screens/guests/{GuestList,FamilyDetail,FamilyForm,RsvpChips,BulkSheet,ImportWizard,ImportResult}.jsx`, `NumberStepper`, `web/public/templates/AM_Guest_List_Template.xlsx` (dropdowns; Veg/Jain/Mixed; one Yes/No column per event) |
| 8b split point | 8 = families, invitations, RSVP, duplicates, headcount, WhatsApp. 8b = bulk, import, template, CSV export |

| Tests that must pass | |
|---|---|
| Endpoints | TESTING §1.3 rows for `/households…`, invitations, bulk, imports |
| Data safety | DS-02, DS-11 (family + invitations), DS-12, DS-16, DS-25, DS-26 |
| Security | SEC-07, SEC-10 (Family import / bulk delete → 403), SEC-26, SEC-27, SEC-28 |
| E2E | E2E-02, E2E-03, E2E-04, E2E-16 (800 families scroll + search) |
| Data | Headcount equals DATABASE §7.4 sums on demo data; 2,000-family stress run |

**Migration:** none.

**Upload:** standard to staging, then live. **Do not import your real Excel on live yet** — that happens at launch (§9.2) so it's one clean batch you can undo.

**Phone check:** TESTING §2.2 **G1–G7** (G6 with a 5-row copy of the template on staging).

---

### Session 9 — Budget and payments

**Goal:** budget categories (planned), vendors (light), payments due/paid, mark paid, pay part, expenses (no vendor), totals, Payments card, money hidden from non-money users (FEATURES B6).

| Files | |
|---|---|
| API | `Modules/Money/*` (`/money/summary`, `/budget-categories…` incl. move-on-delete, `/vendors…`, `/payments…`, `mark-paid`, `pay-part`); dashboard Payments card; calendar payment items |
| Web | `screens/money/{Budget,PaymentList,PaymentDetail,PaymentForm,MarkPaidSheet,PayPartSheet,VendorList,VendorForm}.jsx`, `MoneyField` ("1.25 lakh" → paise) |

| Tests that must pass | |
|---|---|
| Endpoints | TESTING §1.3 rows for money, categories, vendors, payments |
| Data safety | DS-01, DS-05 (mark-paid replay), DS-11 (payment, vendor, category with moved payments), DS-27 (exact money) |
| Security | SEC-01, SEC-12, SEC-13, S10 (no `_paise` for non-money users) |
| Race | DATABASE R3: category delete vs new payment → "category deleted, pick another" |

**Migration:** none.

**Upload:** standard to staging, then live. From here you and Mahi may enter real advances and due payments on live (answer 8); receipts follow after Session 10.

**Phone check:** TESTING §2.2 **M1, M3, M4, M5** (M2's receipt photo waits for Session 10; mark paid itself is checked now).

---

### Session 10 — Documents and uploads

**Goal:** upload photos (compressed on the phone, ≤ 1600 px JPEG ~80 %) and PDFs, link to payment / vendor / event, private documents, duplicate detection by SHA-256, open via the share sheet (FEATURES B7, API §8, CONTEXT 13, 32).

| Files | |
|---|---|
| API | `Modules/Documents/*` (multipart upload, checksum, storage `uploads/YYYY/MM/<uuid>.<ext>` outside `public_html`, range download, `allow_duplicate`) |
| Web | `screens/documents/{DocumentList,DocumentDetail,UploadSheet}.jsx`, `lib/compressImage.js`, `lib/shareFile.js`; "Add receipt photo" on payments |
| Server | PHP limits set in hPanel: `upload_max_filesize` 12M, `post_max_size` 16M (§6.4) |

| Tests that must pass | |
|---|---|
| Endpoints | TESTING §1.3 `/documents…` row (checksum mismatch, same file twice, 206 range, private, payment-linked) |
| Security | SEC-02, SEC-03, SEC-05, SEC-25 |
| Data safety | DS-11 (payment with receipts; document) |
| E2E | E2E-14 (JPEG compressed, progress, thumbnail) |

**Migration:** none.

**Upload:** standard to staging, then live. Check `private/storage/uploads/` exists and is **not** under `public_html`. Then add receipt photos to the advances entered since Session 9.

**Phone check:** TESTING §2.2 **D1–D4** and **M2**; §4 **R7** (camera, HEIC from iPhone gallery) and **R8** (PDF share sheet, not stuck after).

---

### Session 11 — Export

**Goal:** one-tap full export (JSON + CSV + all files + `summary.html` + README + manifest), consistent snapshot, 24-hour token link, split above 200 MB, restore-from-export tool (FEATURES B8, API §9.1, CONTEXT 33).

| Files | |
|---|---|
| API | `Modules/Exports/*` (`POST /exports`, status, `GET /exports/{id}/download?token=`), ZipStream, consistent read (`START TRANSACTION WITH CONSISTENT SNAPSHOT`) |
| Tools | `tools/restore-from-export.php` (also shipped in `private/app/tools/` for emergencies) |
| Web | `screens/settings/Export.jsx` (confirm, progress, Download part 1/2, "Save to Files" tip on iPhone) |

| Tests that must pass | |
|---|---|
| Data safety | **DS-21** (every table's rows incl. deleted, every file with same SHA-256, Hindi, emoji, BOM, IST), **DS-22** (restores into an empty DB), **DS-23** (consistent) |
| Security | SEC-33; family/viewer → 403; 4th export in an hour → 429 |
| E2E | E2E-15 |
| Limits | 2,000 families + 500 files export finishes well inside 360 s execution time; memory flat |

**Migration:** none.

**Upload:** standard to staging, then live. Then do your first **real** monthly-style export on live and save it to Drive `exports/` (DATA-SAFETY §2.1).

**Phone check:** TESTING §2.2 **X1–X3** (X2: Android → Downloads; iPhone → Save to Files; open `summary.html` on a computer).

---

### Session 12 — PWA install and updates

**Goal:** installable on both phones, our Android install banner, iPhone illustrated guide, service worker for the app shell, "New version available. Tap to refresh." (never automatic, never over unsaved typing), **Fix the app** reset page, Settings → This phone, old-phone warning (PWA §2–§4, §6; CONTEXT 6, 36, 39).

| Files | |
|---|---|
| Web | `vite.config.js` (PWA §4.2, `vite-plugin-pwa@1.3.0`), `src/sw.js` (PWA §4.3, push handlers dormant), `pwa/{platform,AndroidInstallBanner,UpdatePrompt,dirtyForms,persist}.js(x)`, `screens/install/InstallGuide.jsx` + screenshots, `screens/settings/ThisPhone.jsx`, `public/{reset.html,reset.js}`, `index.html` head (PWA §2.3), splash images (drop if > 1 h) |
| Build | `version.json` writer; staging/live flavours |

| Tests that must pass | |
|---|---|
| E2E | E2E-12 (new build while a form is open), E2E-13 (Fix the app), E2E-19 (installability: manifest fields, icons, SW with fetch handler) |
| Front end | Update prompt never reloads by itself; forced mode on 426 (TESTING §1.7) |
| SW rules | `/api/*` never answered from cache; `reset.html` not precached |

**Migration:** none.

**Upload:** standard. **The order now matters** (PWA §4.4): assets → shell → `version.json` last. Keep old `assets/` files 14 days.

**Phone check:** TESTING §4 **R1–R5, R10–R12, R14–R18**; PWA §10 **T1–T10, T29–T31**. Install on both phones from a WhatsApp link. iPhone: log in once more inside the installed app (expected).

---

### Session 13 — PWA offline reading

**Goal:** the app opens and shows the last data with no internet, always with its age; `/sync` fills IndexedDB; logout wipes it; a different user on the same phone sees nothing of the previous one; ask the phone to keep our data (PWA §5.1, §5.6).

| Files | |
|---|---|
| API | `Modules/Sync/*` (`GET /sync`: full snapshot or `since`, `deleted` list, `next_since = server_time − 120 s`, `full_resync_required`, money and private documents filtered) |
| Web | `offline/{db,cache,sync}.js`, Query `queryFn` fallback (§3.5), offline banner, "from …" labels, "Open this once with internet" empty state, logout wipe |

| Tests that must pass | |
|---|---|
| Endpoints | TESTING §1.3 `/sync` row; SEC-07 for sync |
| Front end | Offline list renders from `fake-indexeddb` with age; different user → wipe |
| E2E | Offline open after a full load (`context.setOffline(true)`), search by name offline |
| Performance | 500 families + 3,500 invitations cache ≈ 2–3 MB; first sync on 3G profile < 20 s |

**Migration:** none.

**Upload:** standard to staging, then live.

**Phone check:** TESTING §4 **R9** (reading part), **R13** (Settings → This phone: "Offline data: protected ✓"); PWA §10 **T11, T19**. Airplane mode → open from icon → lists show "No internet · from …".

---

### Session 14 — PWA offline saving (outbox)

**Goal:** the limited outbox (CONTEXT 7, PWA §5.2–§5.5): queueable saves wait on the phone and are sent exactly once; everything else says "Needs internet"; conflicts and duplicates are resolved when sent; logout warns about waiting changes.

| Files | |
|---|---|
| Web | `offline/{outbox,queueable}.js`, `data/*` save hooks route queueable actions through the outbox, 🕒 state, "3 changes waiting to send" bar + **Send now**, "Needs your choice" list, logout dialog, Settings → This phone waiting count, placeholder-id fix-up (create then tick) |
| API | No new endpoints. Replay behaviour already proven in Session 3. |

| Tests that must pass | |
|---|---|
| Front end | The 12 outbox checks of PWA §5.2 + TESTING §1.7 "Outbox" list (entry written before fetch; removed only on 2xx or Discard; 401 kept; non-queueable throws; another user's entries never sent; old entry format still read) |
| E2E | **E2E-07** (offline → close page → reopen → 6 waiting → online → sent once), E2E-08, E2E-09, E2E-10, E2E-11 |
| Data safety | DS-04, DS-05, DS-10 again through the outbox path |

**Migration:** none.

**Upload:** standard to staging. **Live only after the chaos tests pass.**

**Phone check:** TESTING §3 **OC-01 … OC-22** (two phones, a helper, ~2 hours, by Thu 22 Oct), §4 **R9**, PWA §10 **T16–T22**. Pass rule TESTING §3.2: any duplicate or lost change blocks launch.

---

### Session 15b — Search, card tracking, printable lists (R2a, Mon 2 – Sat 7 Nov)

**Goal:** the three R2a items that were not in the session list (answered: Session 15b). One search box; "Card given" and "E-invite sent" per family with a distribution list by area; printable guest lists by side, area and event (FEATURES Part C R2a; PRD §4.1). Cards are printed in late November, so tracking is ready before they go out in December.

| Files | |
|---|---|
| API | `Modules/Search/*` (`GET /search?q=`: min 2 characters; families by name, phone digits, group, area; tasks; vendors; payments for money users only; documents by name; deleted rows never; 20 per type); card fields on households (`card_given_on`, `card_given_by`, `einvite_opened_at`); filter `card=given\|not_given`; bulk "Mark card given" (one batch, one Undo, `as_of`) |
| Web | `screens/search/Search.jsx` (Search button in the top bar), `screens/guests/{CardTracking,DistributionList,PrintList}.jsx`, print stylesheet with the how-to line per phone (PRD §6) |
| Docs | API.md v1.2 additions: `/search`, card fields, card filter |

| Tests that must pass | |
|---|---|
| Endpoints | Standard set S1–S11 on `/search` and the new filters |
| Security | SEC-01 and SEC-07 for search (no money for non-money users; deleted never found); SEC-26 on `q` |
| Data safety | DS-01 on card fields; DS-12 and DS-25 on bulk "Mark card given" |
| Front end | Print CSS snapshot; search results in plain words; `vitest-axe` |
| Performance | Search across 2,000 families answers in < 300 ms in the sandbox |

**Migration:** `004_r2a_card_tracking.sql`, already written and tested on both engines (DATABASE §6). This is the **first migration on a live database with real data**: DATA-SAFETY §5.2 in full (card **B2**, rehearse on staging with last night's backup, live at a quiet hour, **migration first, then code**).

**Upload:** standard to staging, then live by **Sat 7 Nov**. Not on Sun 8 Nov: that's the day you decide to retire the sheet, and it should follow two quiet weeks.

**Phone check:** search "sharma" and the last 4 digits of a phone on both phones; as Mummy (no money), search a vendor name — no payments shown; select 10 families → Mark card given → Undo; print the list for one area → Android: Print → Save as PDF; iPhone: Print → share → Save to Files.

**Diwali week:** this is also the week you install the app for elders in person. If time is short, split it: 15b = search (Mon 2 – Wed 4 Nov), 15c = cards + print (Thu 5 – Sat 7 Nov).

---

### Session 15 — Notifications (R2a, Mon 9 – Sun 15 Nov)

**Goal:** reminders by Web Push with email fallback; cron every 15 min; per-person settings; Send a test reminder; health "Last reminder run" red after 30 min (CONTEXT 10, 37; PWA §7).

| Files | |
|---|---|
| API | `Modules/Push/*`, `Modules/Notifications/*` (`/push/subscriptions`, `/me/notifications`, `/me/notifications/test`), reminder creation on task/payment due dates (`dedupe_key`), `scripts/cron/reminders.php` (claim with `UPDATE … WHERE status='pending'`, re-claim after 10 min), health `reminders` check live |
| Web | `screens/settings/Reminders.jsx`, permission request as the **first** await in the tap, iPhone "Add to Home Screen first" in Safari, badge count |
| Server | `minishlink/web-push`; VAPID keys per site (never change after launch); `gmp` extension on |

| Tests that must pass | |
|---|---|
| PHP | Two overlapping cron runs never send one reminder twice (DATABASE R8); stuck `sending` re-claimed; email only when no phone accepted; daily cap; ₹ formatting; no guest names or phones in payloads |
| Health | Reminders last run > 30 min → red and anonymous `fail` |
| Front end | Turn on / off; test button results per channel |

**Migration:** `005_notifications.sql` (`004` already ran in Session 15b):

```sql
-- 005_notifications.sql — final version written and tested in Session 15 (MySQL 8 + guard re-run)
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '+00:00';
INSERT INTO schema_migrations (version, name, applied_by) VALUES (5, '005_notifications', 'phpMyAdmin');

ALTER TABLE users
  ADD COLUMN notify_push     TINYINT UNSIGNED NOT NULL DEFAULT 1,
  ADD COLUMN notify_email    TINYINT UNSIGNED NOT NULL DEFAULT 1,
  ADD COLUMN notify_tasks    TINYINT UNSIGNED NOT NULL DEFAULT 1,
  ADD COLUMN notify_payments TINYINT UNSIGNED NOT NULL DEFAULT 1,
  ADD CONSTRAINT ck_users_notify CHECK (notify_push IN (0,1) AND notify_email IN (0,1)
                                        AND notify_tasks IN (0,1) AND notify_payments IN (0,1));

UPDATE schema_migrations SET finished_at = CURRENT_TIMESTAMP WHERE version = 5;
```

**Upload:** migrations follow DATA-SAFETY §5.2 (SSH card B2, rehearse on staging, live at a quiet hour, **migration first, then code**). Add the reminders cron on staging and live (§6.10). Add VAPID keys to each `.env`.

**Phone check:** TESTING §4 **R6** (the R2a gate); PWA §10 **T23–T28**; Safety card "Last reminder run" green for 7 days; Samsung/Xiaomi battery setting how-to tried on the family phones.

---

### Session 16 — Wedding-day mode (R2b, by Sun 10 Jan)

**Goal:** timeline per event (Now / Next), call list, guest and room lists for 13–16 Feb cached offline, "Get wedding-day data", "Ready for offline?" check, printable packet via print CSS, keep-screen-on where supported; admin-only overrides (CONTEXT 11, 22; PWA §8; FEATURES Part C R2b).

| Files | |
|---|---|
| API | `Modules/WeddingDay/*` (`timeline_items`, `contacts` CRUD; room fields on families), `/sync?types=…,timeline,rooms` with `expected` counts |
| Web | `screens/wedding-day/{Today,Timeline,CallList,Lists,RoomList,ReadyCheck,PrintPacket}.jsx`, `offline/weddingDayReady.js` (PWA §8.3), print stylesheet |

| Tests that must pass | |
|---|---|
| PHP | Standard set + DS-01/DS-11 on timeline items and contacts; sync `expected` matches |
| Front end | Ready check: each ⚠ case; print CSS snapshot of the packet |
| E2E | Offline after "Get wedding-day data": Now/Next, Call, Lists open; airplane-mode run in Playwright |

**Migration:** `006_wedding_day.sql` (sketch; final version written and tested in Session 16):

```sql
-- 006_wedding_day.sql — R2b. Additive only.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '+00:00';
INSERT INTO schema_migrations (version, name, applied_by) VALUES (6, '006_wedding_day', 'phpMyAdmin');

CREATE TABLE timeline_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(26) CHARACTER SET ascii NOT NULL UNIQUE,
  client_uuid CHAR(36) CHARACTER SET ascii NOT NULL UNIQUE,
  event_id BIGINT UNSIGNED NOT NULL,
  starts_at DATETIME NOT NULL COMMENT 'UTC',
  title VARCHAR(200) NOT NULL,
  lead_user_id BIGINT UNSIGNED NULL,
  lead_vendor_id BIGINT UNSIGNED NULL,
  status ENUM('upcoming','now','done') NOT NULL DEFAULT 'upcoming',
  manual_override TINYINT UNSIGNED NOT NULL DEFAULT 0,
  notes TEXT NULL,
  -- standard columns: version, created_*, updated_*, deleted_*, delete_batch_id, CHECKs and
  -- FKs (ON DELETE RESTRICT) exactly as on tasks in 001_init.sql
  KEY ix_timeline_live_event (deleted_at, event_id, starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- CREATE TABLE contacts: name, role, phone (ascii, E.164), event_id NULL, sort_order,
-- + the same standard columns, CHECKs and FKs. Written in full in Session 16.

ALTER TABLE households
  ADD COLUMN hotel_name    VARCHAR(120) NULL,
  ADD COLUMN room_no       VARCHAR(20)  NULL,
  ADD COLUMN check_in_date DATE NULL,
  ADD COLUMN arrival_note  VARCHAR(300) NULL;

UPDATE schema_migrations SET finished_at = CURRENT_TIMESTAMP WHERE version = 6;
```

**Upload:** as Session 15 (migration rules). Deploy freeze 10–19 Feb still applies (PRD §4).

**Phone check:** PWA §10 **T32–T34**; the airplane-mode dry run on **2 iPhones + 2 Androids by Sun 24 Jan** (PRD); printed packet reviewed by family.

---

## 6. Hostinger setup, click by click

Menu names in hPanel change from time to time. If a label below is slightly different, look for the same idea nearby. Do everything **twice**: once for staging (Session 1), once for live (Session 4). The table shows the differences.

| Item | Staging | Live |
|---|---|---|
| Address | `staging-wedding.lumorrahouse.com` | `wedding.lumorrahouse.com` |
| Site folder (I7) | `domains/staging-wedding.lumorrahouse.com/` | `domains/wedding.lumorrahouse.com/` |
| Database | `u…_amstaging` | `u…_amlive` |
| Data | `seed_demo.sql` (demo only) | Real. **Never** the seed. |
| Web build | `deploy-…/staging/` ("A&M Staging" icon) | `deploy-…/live/` |
| Cron | daily clean-up (+ reminders from R2a) | backup, watchdog, daily clean-up (+ reminders from R2a) |

### 6.1 Create the subdomain as its own website

1. hPanel → **Websites** → **Add website** (top right).
2. Choose an **empty PHP/HTML website** (not WordPress, not the AI builder).
3. When asked for the domain, choose **use an existing domain** and type `staging-wedding.lumorrahouse.com` (later: `wedding.lumorrahouse.com`).
4. Finish. Wait 5–10 minutes.
5. **Check the folder:** hPanel → **Files → File Manager**. You should see `domains/staging-wedding.lumorrahouse.com/public_html/`. Write the full path from the path bar into the password manager note "A&M paths" (it starts `/home/u…`). In Session 4, SSH card S10 confirms both names.
6. If hPanel only offers **Domains → Subdomains** (folder inside `lumorrahouse.com/public_html`): stop and tell Claude. The API stub path and `.htaccess` host check change for that layout.

DNS: if `lumorrahouse.com` uses Hostinger nameservers, DNS is automatic. If not, add an **A record** `wedding` (and `staging-wedding`) pointing to the IP shown in hPanel → Websites → Manage → **Dashboard / Plan details**.

### 6.2 Free SSL and HTTPS only

1. hPanel → Websites → **Manage** (on the new site) → **Security → SSL**.
2. If the status isn't **Active**, click **Install SSL** → choose the free (Let's Encrypt) certificate → Install. Can take up to 30 minutes.
3. Turn **Force HTTPS** on (same page).
4. Check on your phone: `http://…` jumps to `https://…` with a padlock.

### 6.3 PHP version

1. Websites → Manage → **Advanced → PHP Configuration** → **PHP version** tab.
2. Choose **8.3** (8.2 is the minimum; never below). **Save**.

### 6.4 PHP extensions and options

Same page, **PHP extensions** tab: tick `pdo_mysql`, `mbstring`, `intl`, `gd`, `zip`, `curl`, `openssl`, `fileinfo`, `sodium`, and (for R2a) `gmp`. **Save**.

**PHP options** tab:

| Option | Value | Why |
|---|---|---|
| `upload_max_filesize` | `12M` | 10 MB file cap + margin (API §8.1) |
| `post_max_size` | `16M` | API §10.3 |
| `memory_limit` | `256M` | Export and import stay well under it |
| `max_execution_time` | `300` | Export of all files streams in one request |
| `display_errors` | Off | Errors go to the log only (SEC-29) |
| `allow_url_fopen` | Off if offered | We use curl only |

### 6.5 Two databases

1. Websites → Manage (staging site) → **Databases → Management**.
2. **Create a new MySQL database and user:** database name `amstaging`, user `amstaging`, password from the password manager generator (20+ characters). **Create**.
3. hPanel adds your prefix: the real names are `u…_amstaging`. Copy both into the password manager.
4. Repeat on the live site in Session 4: `amlive`.
5. Optional, only after a MariaDB fallback (TESTING §1.2.1): a third one, `amtest`.

### 6.6 Folders, `.env` and `.htaccess`

**Create the private folders** (File Manager, inside the **site folder**, beside `public_html`, never inside it). `<site>` is `wedding.lumorrahouse.com` or `staging-wedding.lumorrahouse.com`:

```
domains/<site>/
├── public_html/              ← web root (filled by the deploy ZIPs)
└── private/                  ← New folder. Permission 700.
    ├── .env                  ← New file. Permission 600.
    ├── app/                  ← PHP code (filled by 1-server.zip)
    ├── storage/uploads/      ← uploaded files (CONTEXT §8)
    ├── storage/exports/      ← export ZIPs, deleted after 24 h
    ├── logs/                 ← php-error.log, client-error.log
    ├── cron/                 ← daily.php, reminders.php (from 1-server.zip)
    └── backup/               ← live only: backup.php, config.php, backup.key, work/ (Session 4)
```

**`.env`:** in `private/` → **New File** → name `.env` → paste `.env.example` → fill in the values for this site → **Save** → right-click → **Permissions** → `600`. If File Manager hides it after saving, turn on **Show hidden files** in its settings.

**`public_html/.htaccess`** (shipped in `3-shell.zip`; identical on staging and live):

```apache
# A&M Wedding — public_html/.htaccess
Options -Indexes
DirectoryIndex index.html
AddDefaultCharset utf-8
AddType application/manifest+json .webmanifest

RewriteEngine On

# 0. Only our two hostnames (protects against the app showing up under another address)
RewriteCond %{HTTP_HOST} !^(wedding|staging-wedding)\.lumorrahouse\.com$ [NC]
RewriteRule ^ - [R=404,L]

# 1. HTTPS only (hPanel "Force HTTPS" does the same; both is fine)
RewriteCond %{HTTPS} !=on
RewriteCond %{HTTP:X-Forwarded-Proto} !=https
RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [R=301,L]

# 2. Block dotfiles (.env, .git, .htaccess) except .well-known (SSL renewals)
RewriteRule (^|/)\.(?!well-known/) - [R=404,L]

# 3. Block file types that must never be served
RewriteRule \.(env|ini|log|sql|gz|enc|zip|bak|sh|lock|md|ya?ml|key|php~)$ - [R=404,L,NC]
RewriteRule (^|/)composer\.(json|lock)$ - [R=404,L,NC]

# 4. API: every /api/... request goes to the one PHP entry file
RewriteCond %{REQUEST_URI} !^/api/index\.php$
RewriteRule ^api/ api/index.php [L,QSA]

# 5. App: unknown paths load the app (deep links). Missing static files stay 404.
RewriteCond %{REQUEST_URI} !^/(api|assets|icons|install-guide|splash|templates)/
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^ index.html [L]

<IfModule mod_headers.c>
  Header always set Strict-Transport-Security "max-age=31536000"
  Header always set X-Content-Type-Options "nosniff"
  Header always set X-Frame-Options "DENY"
  Header always set Referrer-Policy "no-referrer"
  Header always set Cross-Origin-Resource-Policy "same-origin"
  Header always set X-Robots-Tag "noindex, nofollow"
  Header always unset X-Powered-By
  Header unset X-Powered-By

  # App pages and scripts only. The PHP API sends its own CSP ("default-src 'none'").
  <FilesMatch "\.(html|js)$">
    Header set Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
    Header set Permissions-Policy "camera=(self), microphone=(), geolocation=(), payment=(), usb=()"
    Header set Cross-Origin-Opener-Policy "same-origin"
  </FilesMatch>

  # These decide which version runs: always ask the server
  <FilesMatch "^(index\.html|sw\.js|manifest\.webmanifest|version\.json|reset\.html|reset\.js)$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
</IfModule>
```

**`public_html/assets/.htaccess`:** hashed files never change, so phones keep them a year.

```apache
<IfModule mod_headers.c>
  Header set Cache-Control "public, max-age=31536000, immutable"
</IfModule>
```

**`public_html/api/index.php`** (the only PHP file the web can reach):

```php
<?php
declare(strict_types=1);
require dirname(__DIR__, 2) . '/private/app/bootstrap.php';
```

Hostinger runs LiteSpeed, which reads `.htaccess`. Session 1's phone check 1.5 (securityheaders.com) proves the headers really arrive. The sandbox tests the same rules through `tools/router.php`.

### 6.7 SSH: command cards

SSH is switched on once (DATA-SAFETY §3.4 Step 1). After that, every SSH step in every document, release note and chat is a **card**:

| # | Type exactly | You should see | If not |
|---|---|---|---|
| (example) S13 | `php ~/domains/wedding.lumorrahouse.com/private/backup/backup.php --test-email` | A line containing `Alert email sent: Test email` | `Alert email FAILED`: check the SMTP password in `config.php` |

| Rule | Why |
|---|---|
| One command per row. Type or paste it, press **Enter**, then compare. | You always know which step you are on. |
| Full paths (`~/domains/wedding.lumorrahouse.com/…`), never `cd` first | It doesn't matter which folder you are in. |
| "You should see" quotes the exact words or the first/last line | Easy to compare. |
| Anything different → **stop** and paste what you see into the chat | No guessing on a live server. |
| Passwords never appear on screen while typed | Normal for SSH; the card says so. |
| Every session starts with S1 + S3 (connect) and ends with `exit` | Same start and end every time. |

All cards live in DATA-SAFETY v1.2: **S1–S17** (setup, §3.4), **B1–B3** (backup before a deploy, a migration, hand-typed SQL), **D1–D3** (restore drill), **K1** (break-glass), in §3.4.1. Any new card Claude writes goes into `RELEASE-NOTES.md` in the same format.

### 6.8 Uploading a deploy ZIP (standard upload)

Takes about 10 minutes. Do it at a quiet hour on live (after 10 PM IST) and tell the family group first (TESTING §8.2 step 11). Below, `<site>` means `wedding.lumorrahouse.com` (live) or `staging-wedding.lumorrahouse.com` (staging).

| # | Step |
|---|---|
| 0 | **Live only, before anything:** TESTING §8.2 steps 1–11 (tests green, staging checked, Safety green, SSH card **B1** → `Done in … s.`, app export to Drive, previous deploy ZIP in Drive) |
| 1 | File Manager → the **site folder** (`domains/<site>/`, beside `public_html`) → **New folder** `_incoming` |
| 2 | Open `_incoming` → **Upload** → `deploy-sessionNN.zip` → when done, right-click → **Extract** → into `_incoming` |
| 3 | Open `RELEASE-NOTES.md` (right-click → Edit/View). If it lists a **migration**, do §6.9 now, before any code. If it lists a **`.env` change**, note it. |
| 4 | Go into `_incoming/deploy-sessionNN/staging/` (or `live/`). Right-click `1-server.zip` → **Extract** → destination: the **site folder** `domains/<site>/` → overwrite **Yes** |
| 5 | Same for `2-assets.zip` → site folder → overwrite Yes. (Old asset files stay; that's wanted for 14 days.) |
| 6 | Same for `3-shell.zip` → site folder → overwrite Yes |
| 7 | **Copy** `version.json` → into `domains/<site>/public_html/` → overwrite Yes. **This is always last.** |
| 8 | If `RELEASE-NOTES.md` says so: edit `private/.env` |
| 9 | Delete the `_incoming` folder |
| 10 | Open `https://<site>/api/v1/health` → `{"status":"ok"}`. Open the app → "New version available" → refresh → Settings → This phone shows the new version |
| 11 | Live: TESTING §8.2 steps 20–27 (smoke test on both phones, log line in Drive `deploys/log.txt`) |

14 days later: delete files in `public_html/assets/` that `RELEASE-NOTES.md` lists as old.

### 6.9 Running a migration in phpMyAdmin

DATABASE §6 in full. Short version:

1. Live: backup first — SSH card **B2** → `Done in … s.` Rehearse on staging first (DATA-SAFETY §5.2).
2. hPanel → Websites → Manage → **Databases → Management** → next to the database, **Enter phpMyAdmin**.
3. **Check the database name at the top left.** Staging or live — the right one?
4. **Import** tab → **Choose file** → the `.sql` file → Character set **utf-8** → leave **Enable foreign key checks** ticked → **Import / Go**.
5. Green "Import has been successfully finished". Then **SQL** tab: `SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 3;` → the new row has `finished_at` filled.
6. Red error: **don't run the file again**. Copy the error into the next chat. DATABASE §6 step 6.

First-time order on a new database: `001_init.sql` → `002_open_answers.sql` → `003_api_support.sql` → (staging only) `seed_demo.sql`.

### 6.10 Cron jobs

hPanel → Websites → Manage → **Advanced → Cron Jobs** → **Custom** → paste the command, set the times, **Save**. First check the server clock (DATA-SAFETY §3.4 step 2): the times below assume the server runs on **UTC**. `<u>` = your `u…` username.

**Live**

| Job | Min | Hour | Day | Mon | Wk | Command |
|---|---|---|---|---|---|---|
| Nightly backup (2:17 AM IST) | `47` | `20` | `*` | `*` | `*` | `/usr/bin/php /home/<u>/domains/wedding.lumorrahouse.com/private/backup/backup.php >> /home/<u>/domains/wedding.lumorrahouse.com/private/backup/work/cron.log 2>&1` |
| Backup watchdog (every 6 h) | `23` | `*/6` | `*` | `*` | `*` | `/usr/bin/php /home/<u>/domains/wedding.lumorrahouse.com/private/backup/backup.php --check >> /home/<u>/domains/wedding.lumorrahouse.com/private/backup/work/cron.log 2>&1` |
| Daily clean-up (3:00 AM IST) | `30` | `21` | `*` | `*` | `*` | `/usr/bin/php /home/<u>/domains/wedding.lumorrahouse.com/private/cron/daily.php >> /home/<u>/domains/wedding.lumorrahouse.com/private/logs/cron.log 2>&1` |
| Reminders (R2a, Session 15) | `*/15` | `*` | `*` | `*` | `*` | `/usr/bin/php /home/<u>/domains/wedding.lumorrahouse.com/private/cron/reminders.php >> /home/<u>/domains/wedding.lumorrahouse.com/private/logs/cron.log 2>&1` |

**Staging** (hPanel → Websites → Manage `staging-wedding.lumorrahouse.com` → Cron Jobs). No backup: it holds demo data. Pause these during a restore drill (DATA-SAFETY §4.1).

| Job | Min | Hour | Day | Mon | Wk | Command |
|---|---|---|---|---|---|---|
| Daily clean-up | `30` | `21` | `*` | `*` | `*` | `/usr/bin/php /home/<u>/domains/staging-wedding.lumorrahouse.com/private/cron/daily.php >> /home/<u>/domains/staging-wedding.lumorrahouse.com/private/logs/cron.log 2>&1` |
| Reminders (R2a, Session 15) | `*/15` | `*` | `*` | `*` | `*` | `/usr/bin/php /home/<u>/domains/staging-wedding.lumorrahouse.com/private/cron/reminders.php >> /home/<u>/domains/staging-wedding.lumorrahouse.com/private/logs/cron.log 2>&1` |

If card S9 shows the server runs on **IST**, the nightly backup is minute `17`, hour `2`, and the daily clean-up is minute `0`, hour `3`. If card S4 showed another PHP path, use it instead of `/usr/bin/php`.

### 6.11 Rolling back with the previous deploy ZIP

| What broke | Do this |
|---|---|
| New code is wrong (no migration, or the migration was fine) | Take the **previous** `deploy-session(N-1).zip` from Drive `deploys/` and do §6.8 steps 1–11 with it. Migrations are additive, so old code runs on the new schema. Phones get "New version available" (the older version); a stuck phone uses Settings → This phone → **Fix the app**. |
| Migration stopped half-way | Don't re-run it. DATABASE §6 step 6; DATA-SAFETY §5.3. |
| Wrong values were saved | Roll back the code first, then DATA-SAFETY §6 (restore fields from `audit_log`). |
| Everything is broken | DATA-SAFETY §10 one-page plan. Tell Claude in a new chat with the bug template (TESTING §10.2). |

Files added by the newer build stay on the server after a rollback. They are harmless because nothing calls them.

### 6.12 Shared-hosting limits to watch

Hostinger's help page now lists the Business plan under "Unlimited"; existing Business accounts keep their own limits, shown in hPanel ([Hostinger limits](https://www.hostinger.com/support/6976044-parameters-and-limits-of-hosting-plans-in-hostinger/)). **Check yours once:** hPanel → Websites → Manage → **Dashboard / Plan details**.

| Limit | Value to expect | How we stay safe | Where you see it |
|---|---|---|---|
| Disk | 50 GB | Photos compressed on the phone; 10 MB cap; exports deleted after 24 h; 2 local backups only | Safety card (amber 70 %, red 85 %) |
| Inodes (number of files) | 600,000 | Few PHP packages; delete old `assets/` after 14 days; one file per upload | hPanel → Plan details |
| Database size | 3 GB each | Expected < 100 MB; `audit_log` growth watched | Safety card (red at 80 %) |
| PHP execution time | up to 360 s; we set 300 | Export streams; import in one request ≤ 3,000 rows; backups run from cron (CLI) | Error digest email |
| Upload size | Plan allows far more; we set 12 MB / 16 MB | Phone compression | — |
| PHP memory | We set 256 MB | Streaming export and import | Error digest |
| PHP workers / processes | ~60 on current plans | 30 users is far below it | Slow replies, 503 |
| Email | Server `mail()`: 10 per minute, 100 per day. Mailbox: about 100 per day on the free business-email tier (check yours) | App cap 30/day; reset emails off at launch; alerts only when something fails | Mailer log |
| Cron | Every minute is expected to be allowed (PWA V11) | Our most frequent job is every 15 min | Safety "Last reminder run" (R2a) |
| Hostinger's own backups | Daily, kept 7 days (CONTEXT 20) | Our B2 nightly copy is the real one | hPanel → Files → Backups |
| phpMyAdmin import size | Enough for a few MB (DATA-SAFETY H6) | SSH `mysql` fallback for big restores | Drill step 4 |

---

## 7. Email: SMTP, SPF, DKIM, DMARC

Goal: backup alerts (Session 4), error digests, and later reset and reminder emails land in the **inbox**.

### 7.1 Before you start: does `lumorrahouse.com` already have email?

hPanel → **Domains → lumorrahouse.com → DNS / Nameservers** → look at the **MX** records.

| You see | Do this |
|---|---|
| No MX, or Hostinger MX (`mx1.hostinger.com`…) | Follow §7.2–§7.5 as written |
| MX for Google Workspace, Zoho or another provider | **Stop.** Don't change MX. Tell Claude: the SPF record must list both senders in **one** record, and DKIM is set up per sender. |

### 7.2 Create the mailbox

1. hPanel → **Emails** → choose `lumorrahouse.com` → **Create email account**.
2. Name `planner`, password from the password manager. **Create**.
3. Check it works: open **Webmail**, send a mail to your Gmail.
4. SMTP settings for the app (confirm them in hPanel → Emails → **Connect apps & devices**): host `smtp.hostinger.com`, port `465`, SSL; user `planner@lumorrahouse.com`; the mailbox password. These go in `private/.env` (`SMTP_*`) and in `private/backup/config.php`.

The app always sends **from** `planner@lumorrahouse.com`, the same address it logs in with. That keeps SPF and DKIM aligned for DMARC.

### 7.3 SPF (one TXT record)

hPanel → **Domains → lumorrahouse.com → DNS / Nameservers → DNS records**:

| Type | Name | Value | TTL |
|---|---|---|---|
| TXT | `@` | `v=spf1 include:_spf.mail.hostinger.com ~all` | default |

A domain may have **only one** SPF record. If one already exists, edit it to add `include:_spf.mail.hostinger.com` rather than adding a second ([EasyDMARC guide](https://easydmarc.com/blog/hostinger-email-spf-and-dkim-configuration-step-by-step-guideline/)).

### 7.4 DKIM

1. hPanel → **Emails** → `lumorrahouse.com` → look for **DNS settings / Increase email deliverability / Connect domain**.
2. It lists DKIM records (usually CNAMEs whose name contains `_domainkey`). If the domain uses Hostinger nameservers there is often a **Set up automatically** button: use it.
3. Otherwise copy each record exactly into **DNS records** (Type, Name, Target).
4. Wait up to a few hours. The same screen turns green when DKIM is found.

### 7.5 DMARC (one TXT record)

Start in "watch only" mode, then tighten.

| When | Type | Name | Value |
|---|---|---|---|
| Session 4 | TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:planner@lumorrahouse.com; adkim=r; aspf=r` |
| After 2 weeks of clean reports and inbox delivery | TXT (edit) | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:planner@lumorrahouse.com; adkim=r; aspf=r` |

Reports arrive in the `planner@` mailbox as small ZIP files. You don't need to read them closely; their arrival means DMARC works.

### 7.6 Prove it

| # | Check | Pass when |
|---|---|---|
| E1 | SSH card **S13** (DATA-SAFETY §3.4, Session 4) | Arrives in both Gmails |
| E2 | In Gmail: open it → ⋮ → **Show original** | `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS` |
| E3 | Send one test from the app to the address shown at mail-tester.com | Score 9/10 or better |
| E4 | If it landed in spam once | Mark **Not spam**; add `planner@` to contacts (both of you) |
| E5 | Later (R2a): reminder email fallback to a family member's Gmail | Inbox |

Reset-by-email stays off until members have emails (`MAIL_ENABLED=false`, CONTEXT 29). Turning it on later is a `.env` change only.

---

## 8. Definition of done

### 8.1 Every session

| ☐ | Done when |
|---|---|
| ☐ | Full suite green at start **and** end: PHPUnit, endpoint coverage (every operation in `openapi.yaml` tested), Vitest, Playwright projects. 0 failed. Skips named with a manual check that replaces them. |
| ☐ | New tests for everything built; every bug fixed this session has a test that failed before the fix |
| ☐ | Static checks: no hard `DELETE` outside allowed tables, no `UPDATE audit_log`, no float money, no string-built SQL, every UI string from `strings.en.js` |
| ☐ | `vitest-axe` clean on new screens; tap targets ≥ 48 px; base text ≥ 17 px |
| ☐ | Bundle and Lighthouse within TESTING §7 budgets |
| ☐ | `TEST-REPORT.md`, `RELEASE-NOTES.md`, `docs/SESSION-LOG.md` updated; doc changes listed for Project knowledge |
| ☐ | Both ZIPs delivered and saved to Drive; `TEST-REPORT.md` says "Pushed" to GitHub (or why not) |
| ☐ | Every SSH step in `RELEASE-NOTES.md` is a card (§6.7) |
| ☐ | Staging: core checks C1–C5 and the session's phone checks pass on **Android and iPhone** |
| ☐ | From Session 4: live updated with the release checklist; Safety card green after |
| ☐ | No known data-loss bug open |

### 8.2 Release 1 (Sessions 1–14)

| ☐ | Done when | Source |
|---|---|---|
| ☐ | Every AC in FEATURES.md Parts A and B passes (automated where possible; the rest by hand on staging) | PRD R1 |
| ☐ | TESTING §3 offline/chaos tests pass on both release phones; no blocker | TESTING §3.2 |
| ☐ | TESTING §4 R1–R5, R7–R18 pass (R6 is the R2a gate) | TESTING §4 |
| ☐ | Usability: 2 parents each add a family in < 30 s unaided | PRD R1 |
| ☐ | Nightly backup green ≥ 7 nights in a row on live; watchdog and uptime monitor tested | DATA-SAFETY §3 |
| ☐ | Restore drill passed (drill #0 at Session 4 counts as practice; drill #1 on Tue 27 Oct is the real one) | PRD R1 |
| ☐ | Email SPF/DKIM/DMARC PASS | §7.6 |
| ☐ | Live and staging `.htaccess` headers verified; `/.env`, `/private`, uploads unreachable | SEC-05, SEC-30 |
| ☐ | Guest Excel imported on live with duplicates resolved; every advance paid so far entered with a receipt | PRD R1 |
| ☐ | Full export downloaded and opened on a computer; saved to Drive | DATA-SAFETY §2.1 |
| ☐ | Password manager entries complete; backup key on paper at home | DATA-SAFETY §7 |

### 8.3 R2a and R2b

| Release | Done when |
|---|---|
| R2a (Session 15) | Test reminder arrives on an installed iPhone, an Android, and by email; Safety "Last reminder run" green 7 days (PRD) |
| R2b (Session 16) | Airplane-mode dry run passes on 2 iPhones + 2 Androids by Sun 24 Jan; printed packet reviewed (PRD) |

---

## 9. Go-live

### 9.1 Go-live checklist (Sat 24 Oct prep, Sun 25 Oct launch)

| ☐ | Step | Who |
|---|---|---|
| ☐ | §8.2 all ticked except the import and advances (done on launch day) | Ayush |
| ☐ | Live runs the final Session 14 (or fix) build; Settings → This phone shows it on both your phones | Ayush |
| ☐ | Safety card green; last backup this morning; uptime monitor "Up" | Ayush |
| ☐ | `SETUP_TOKEN` removed from live `.env` | Ayush |
| ☐ | Live has only real data: no "Test …" tasks or payments left from smoke tests (check Activity; delete them) | Ayush |
| ☐ | Settings → wedding details correct; event dates/venues filled where known | Mahi |
| ☐ | Budget categories and planned amounts set (or left at ₹0 deliberately) | Mahi |
| ☐ | Excel guest list: one final cleaned copy per side, on the **template** columns; phone numbers 10 digits | Both |
| ☐ | Every advance paid so far is in the app with its receipt (entered since Sessions 9–10); Budget **Spent** equals the sheet's total | Mahi |
| ☐ | Member list written down: name, phone, role, money yes/no, access end date | Both |
| ☐ | Install Guide link tested from a WhatsApp message on one Android and one iPhone | Ayush |
| ☐ | Family WhatsApp group message drafted (§9.3) and the short bug template pinned (TESTING §10.1) | Ayush |
| ☐ | Manual backup + app export just before the import | Ayush |

### 9.2 Moving data in (launch day, Sun 25 Oct)

| Order | What | How | Safety net |
|---|---|---|---|
| 1 | Guests | Guests → **Import** → upload the bride side Excel → read the preview (new / duplicates / errors) → fix errors in Excel or mark Skip → **Import**. Then the groom side. | Each import is one batch: **Imports → Undo this import** |
| 2 | Duplicates across sides | Use the duplicate list from the preview; merge by editing one family and deleting the other | Undo / Deleted items |
| 3 | Payments | Already in since Session 9 (answer 8). Today: only any new ones, each with its receipt | History; Undo |
| 4 | Open tasks | Already in since Session 5. Today: assign them to the family members who join this week | — |
| 5 | Check | Headcount per event looks right; families per side match the Excel row counts | Export after, saved to Drive |

Keep the Excel sheet **read-only** in parallel until Sun 8 Nov (answer 8; CONTEXT risk 1).

### 9.3 First week of use (Sun 25 Oct – Sun 1 Nov)

Invite one person at a time. Each person gets a working app, one real task, and a quick call before the next person joins.

| Day | Who joins / what | Steps |
|---|---|---|
| Sun 25 Oct | **You two** | Data moved in (§9.2). Both phones installed. Export to Drive. |
| Mon 26 Oct | **Papa** (Family, money on) | Members → Add → **Invite by link** → WhatsApp. On a call: install (Install Guide), set password, assign him 2 real tasks, ask him to tick one. |
| Tue 27 Oct | **Restore drill #1** (DATA-SAFETY §4) + monthly export | Log it in Safety. Drill the morning, invite nobody new that day. |
| Wed 28 Oct | **Mummy** (Family, money off) | Invite by link. Ask her to add one family she knows and set Coming? for one event. Time it (< 30 s goal). |
| Thu 29 Oct | **Mahi's parents** (Family; money as you decide) | Same as Papa/Mummy, by Mahi |
| Fri 30 Oct | **Siblings / cousins** who do work | Invite in one go if days 26–29 went smoothly; each gets one real task |
| Sat 31 Oct | Fix day | Read the error digest and the family group; send bug reports to a fix chat (TESTING §10.3) |
| Sun 1 Nov | Weekly 5-minute look (TESTING §9.4) | Safety green? Any changes stuck "waiting" on anyone's phone? Anything confusing? |
| Diwali week (2–8 Nov) | **Elders as Viewers** | Install **in person** on their phones (PRD W4). Show: Calendar, a family, Call button. |
| Sun 8 Nov | Retire the sheet | Only if 2 clean weeks: no data-loss report, backups every night, uptime ≥ 99 % |

Message for the family group (edit names as you like):

> We're moving the wedding planning into our own app, "A&M Wedding". Ayush will send each of you a link on WhatsApp, one by one. Tap it, choose a password, and add the app to your Home Screen (the link shows how). Please don't share the link. If anything looks wrong, take a screenshot and send it to Ayush. Nothing you do can be lost — there's always Undo.

**Every day in launch week:** look at the Safety card and the error digest email (TESTING §9.5).

---

## Changes needed in other docs

| Doc | Change |
|---|---|
| DATA-SAFETY.md | **Done: v1.2** (separate site folders, SSH cards, GitHub, ZIP names, SMTP alerts). |
| TESTING.md | §5: family test Tue 20 – Thu 22 Oct. §8.1: ZIP names. §8.2 step 7 and §1.2.1: SSH cards B1/B2 and the new paths. |
| PRD.md | §4 pre-launch row: tasks and payments go on live after Session 4's backup is green; guests at launch. R2a: Session 15b (2–7 Nov). |
| PWA.md | §7.6 cron paths: `domains/wedding.lumorrahouse.com/private/…` and the staging equivalent. |
| API.md v1.2 | `/search`, card-tracking fields and filter (Session 15b), plus the items PWA.md and TESTING.md already listed. |
| CONTEXT.md → v1.6 | Separate website folders for live and staging; code history in a private GitHub repo; Session 15b in R2a; real tasks and payments on live from Session 4. |

---

## Open Questions

1. **MX records (§7.1):** your answer came back as the template "[Hostinger / Google / Zoho / none]". Which one is it? hPanel → Domains → `lumorrahouse.com` → DNS records → the **MX** rows. Needed before Session 4.
2. **Days off:** also came back as the template "[list dates, or "none"]". Which days between 8 and 24 Oct can't you do a session? If none, the plan stands; if any, I'll move the cut list now.
3. **Session 15b live date:** OK to finish by **Sat 7 Nov**, so Sun 8 Nov (sheet retirement) has no deploy?
4. **DESIGN.md:** it wasn't in Project knowledge yet when I checked. Please confirm it finished uploading; Session 1 will stop before any screen if it's missing.
5. **Staging cron during drills** (DATA-SAFETY Open Question 1): OK to pause staging's cron jobs for about an hour each month?
