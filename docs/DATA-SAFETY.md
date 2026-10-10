# DATA-SAFETY.md — Keeping our wedding data safe

Version 1.2 · 8 Oct 2026 · Owner: Ayush Porwal · v1.1 applies the owner's answers · v1.2: separate website folders for live and staging, every SSH step as a command card, GitHub, new ZIP names, SMTP alerts (see "Answers applied")
Reads from: `CONTEXT.md` v1.5 (source of truth), `DATABASE.md` v1.2, `API.md` v1.1, `PWA.md` v1.1, `IMPLEMENTATION.md` v1.1, migrations `001`–`003`.
Who this is for: Ayush and Mahi. Every step is written so you can follow it without being a server expert. Every SSH step is a **command card**: one command at a time, typed exactly, with what you should see (§3.4). Only the parts in `<angle brackets>` change.

**The one rule:** nothing we enter may ever be lost (CONTEXT §1). This runbook is how we keep that promise, and what to do on the day something goes wrong.

---

## Conflicts flagged

| # | Topic | Sources say | This runbook does |
|---|---|---|---|
| S1 | Backup "too old" alarm | DATABASE §7.6 and API §11: Safety card and `/health` go red when the last good backup is **> 26 h** old. The uptime monitor then emails on `503`. Your brief: email if older than **36 h**. | **Answered: both, as two layers.** 26 h stays the red light and uptime-monitor email (catches one missed night fast). The backup script's own watchdog emails at **36 h** (catches it even if the uptime monitor is broken). |
| S2 | Where nightly backups go | CONTEXT Q2 asks "which Gmail / Google Drive"; API §11 example says `gdrive:A&M backups`. | **Backblaze B2 for the nightly backup, Google Drive for the monthly export and code ZIPs.** Reason: an unattended script writing to a personal Google Drive needs a Google Cloud project and OAuth. While that project is in "Testing" mode its login token stops working after 7 days ([rclone forum](https://forum.rclone.org/t/google-drive-requires-manual-refresh-every-7-days/29023), [Unipile](https://www.unipile.com/google-oauth-refresh-token/)), which is a silent-failure trap. B2 uses one fixed key, has 10 GB free, and can refuse deletes. **You skipped this question, so B2 stays the default.** Say so any time if you want Drive instead. |
| S3 | Restore drill target | Your brief: restore into the **staging database**. CONTEXT 38 and PWA §11: staging uses demo data only; **real guest data stays out of tests**. DATABASE §6 step 2 also imports the live export into "a second database". | **Answered: no separate drill database. Restore into the staging database**, as in your brief. Staging holds real data only for the length of a drill or migration rehearsal (about an hour). Afterwards it is emptied and the demo data loaded again (§4.2 steps 10–11). CONTEXT 38 needs this exception. |
| S4 | "Two owner accounts" | DATABASE §3: exactly one `owner` (unique key); Mahi is `partner` (same powers, except she can't reset or demote the owner). | No schema change. "Two owners" here means **two people with full access to every outside account** (Hostinger, B2, Google, domain, password manager). §7 has a break-glass step if Ayush is locked out of the app. |
| S5 | Uploads in the nightly backup | CONTEXT 20: the nightly job sends "our encrypted DB dump". | **Adds the uploaded files** (receipts, contracts, IDs), encrypted, incremental. Without them a server loss would lose every document. Small cost: under 10 GB. |
| S6 | Where file counts go | `backup_runs` has no columns for files. | Stored inside `row_counts_json` under the key `_files`. **No migration needed.** |
| S7 | Anonymising guests | DATABASE: `audit_log` is never updated; nothing is hard-deleted before 16 May 2027 (CONTEXT 34). | **Answered: keep everything. Nothing is anonymised or removed** after the wedding (§8.1). No extra migration. |
| S9 | Folder on Hostinger | v1.1 used `domains/lumorrahouse.com/public_html` and `…/private`. Hostinger's default subdomain folder sits **inside** the main site, and live and staging would share one `private/`. | **Answered: each subdomain is its own website.** Live: `domains/wedding.lumorrahouse.com/`. Staging: `domains/staging-wedding.lumorrahouse.com/`. Each has its own `public_html/` and `private/` (IMPLEMENTATION §6.1). All paths below use them. |
| S10 | Alert email | v1.1 `backup.php` sent alerts with PHP `mail()`. Hostinger limits server `mail()` and may not DKIM-sign it. | Session 4 ships `backup.php` with alerts over **SMTP as `planner@lumorrahouse.com`** when `smtp_*` is set in `config.php`; `mail()` stays as the fallback (IMPLEMENTATION I12). |
| S8 | Guest phone numbers on every phone | PWA §5.1 (answered 8 Oct): guest phones cached offline for all roles. Your brief: keep access minimal. | **Answered: no change.** Viewers keep seeing phone numbers. |

## Answers applied (8 Oct 2026)

| # | Question | Answer | Applied in |
|---|---|---|---|
| 1 | 26 h red light + 36 h script email | Yes | S1, §3.6 |
| 2 | Backblaze B2 for nightly backups | Skipped → B2 stays the default | S2, §3 |
| 3 | Separate drill database | **No** → restore into the **staging database** | S3, §4, §5.2, §6 |
| 4 | Shared backup Gmail for recovery | **No** → each account's recovery email is the other person's own email | §7.1, §7.2 |
| 5 | Domain and hosting renewal | **Paid until 2028** | §7.1, §7.2, T11, T12 |
| 6 | Uploads folder = `private/storage/uploads` | Yes | §3.3 |
| 7 | Anonymise or delete after the wedding | **No. Keep everything, remove nothing** | S7, §8.1, §9 |
| 8 | Hide guest phones from Viewers | No | S8, §8 |
| 9 | Turn the server off by 31 May 2027 | Skipped → stays a proposal only | §9 |
| 10 | Private GitHub repo | **Yes** | T15, §2 layer 10, §5.4, §7 |
| 11 | Separate website folders for live and staging (IMPLEMENTATION Q5) | **Yes** | S9, §3.3, §3.4, §4.2, §9 |
| 12 | SSH | **OK if every command is given exactly, one at a time, with what I should see** | §3.4 cards S1–S17, §3.4.1 cards B1–B3, D1–D3, K1 |
| 13 | `alert_to` addresses | Ayush's and Mahi's Gmail | §3.3. You type them into `config.php` yourself; they never go into a chat or ZIP. |
| 14 | ZIP names | `project-source-sessionNN.zip`, `deploy-sessionNN.zip` (IMPLEMENTATION §4) | §5.1, §5.4 |

---

## 1. Threat list

### 1.1 Summary

Likelihood: how often this could happen to us before the wedding. Impact: how bad it is if nothing protects us.

| # | Threat | Likelihood | Impact | Main protection |
|---|---|---|---|---|
| T1 | Someone deletes the wrong thing | **High** | Medium | Undo, Trash |
| T2 | Bulk edit or import mistake | Medium | High | One-batch Undo, `as_of` skip rule |
| T3 | Two people edit the same record | **High** | Low | Version check → conflict screen |
| T4 | A save made offline never reaches the server | Medium | Medium | Outbox: kept until a 2xx reply |
| T5 | A phone is lost or stolen | Medium | Medium (privacy) | Server is the copy; log out that phone |
| T6 | iPhone storage cleared or app icon deleted | Medium | Low–Medium | Outbox warning; server copy |
| T7 | A migration breaks or half-runs | Low | **High** | Backup first, staging first, guard rows |
| T8 | A bad deploy (broken code) | Medium | Medium | Previous ZIP, additive schema, update prompt |
| T9 | Hostinger outage | Low | Medium | Wait; off-site copy; printed wedding-day pack |
| T10 | Locked out of Hostinger account | Low | **High** | 2FA backup codes, second person, off-site copy |
| T11 | Hosting expires / payment missed | Low | **Critical** | Auto-renew, two cards, calendar reminder |
| T12 | Domain expires | Low | High | Auto-renew, long renewal |
| T13 | A password is stolen | Low | **High** | 2FA, unique passwords, B2 refuses deletes |
| T14 | Disk or database full | Low | High | Health storage check, retention |
| T15 | Latest project ZIP lost | Medium | Medium | Every ZIP in Google Drive + private GitHub repo |
| T16 | Backup key lost | Low | **Critical** | Key in password manager + paper copy |
| T17 | Backups silently stop | Medium | **Critical** (only shows when needed) | Health, uptime monitor, 36 h watchdog, monthly drill |
| T18 | Mistake typed in phpMyAdmin | Low | High | `ON DELETE RESTRICT`, backup first, practise on staging |

### 1.2 Each threat

**T1 · Accidental delete** — Likelihood High · Impact Medium

- **Prevent:** every delete is soft (`deleted_at`, `delete_batch_id`). Family members can't bulk-delete families and delete only their own tasks (CONTEXT 31). Event delete shows counts first.
- **Detect:** the Undo snackbar; Settings → Activity; Trash shows who deleted what.
- **Recover:** tap **Undo** within 10 minutes. After that, an admin opens **Deleted items**, picks the batch, taps **Restore**. Children deleted in the same batch come back together (API §7).

**T2 · Bulk edit or import mistake** — Medium · High

- **Prevent:** bulk actions and imports are one `change_batches` row each. Bulk requests carry `as_of`; rows someone changed after the list loaded are skipped and named (DATABASE rule 10). Import is admin-only.
- **Detect:** the result screen lists "affected" and "skipped"; Activity feed.
- **Recover:** **Undo** (10 min) reverts the whole batch, skipping rows changed since and naming them. After 10 min: Imports → "Undo this import", or §6 for single rows, or §4-style restore for a large mess.

**T3 · Two people editing** — High · Low

- **Prevent:** every write sends `If-Match: <version>`; a stale write gets `409` (API §4). Only changed fields are sent.
- **Detect:** the conflict screen: "Mummy changed this at 10:42 AM while you were editing."
- **Recover:** pick per field (Yours / Theirs). The losing value is still in History (`audit_log`).

**T4 · Offline save never sent** — Medium · Medium

- **Prevent:** every small save goes into the outbox in IndexedDB **before** sending. An entry leaves only on a 2xx reply or on **Discard** (CONTEXT 7, PWA §5.2). Retries reuse the same `Idempotency-Key`, so no duplicates.
- **Detect:** bar "3 changes waiting to send"; 🕒 on the row; Settings → This phone; logout warns "3 changes haven't been sent."
- **Recover:** connect to the internet and tap **Send now**. Conflicts open the conflict screen. Never log out, delete the icon or use "Clear & reset" while changes are waiting.

**T5 · Phone lost or stolen** — Medium · Medium (privacy: guest phones are cached on it)

- **Prevent:** the phone's own screen lock; session cookie is `HttpOnly`; no secrets in browser storage.
- **Detect:** the person tells you.
- **Recover:** admin → Members → that person → **Reset password** (revokes all their sessions at once, API §3.2). If it was your own phone: from another device, Settings → My account → **Log out all phones**. Unsent outbox entries on the lost phone are gone; ask the person what they changed offline that day.

**T6 · iPhone storage cleared or icon deleted** — Medium · Low–Medium

- **Prevent:** use the Home Screen icon, not Safari (Safari clears after 7 days unused). The app asks `navigator.storage.persist()` (PWA §5.6). Warnings before logout and in Settings.
- **Detect:** Settings → This phone shows "Offline data: protected ✓ / not protected" and waiting changes.
- **Recover:** server data is never affected. Re-add the icon, log in, data downloads again. Only unsent changes on that phone are lost.

**T7 · Bad migration** — Low · High

- **Prevent:** §5. Backup first; rehearse on the staging database with a copy of real data; only additive changes (DATABASE §6 rule 5); guard row in `schema_migrations`.
- **Detect:** phpMyAdmin error; `schema_migrations.finished_at` is NULL; Safety → database red; API answers `503 app_updating`.
- **Recover:** DATABASE §6 step 6 (finish by hand, or restore the pre-migration backup). Never re-run the whole file.

**T8 · Bad deploy** — Medium · Medium

- **Prevent:** §5. Staging first; upload in the PWA §4.4 order (`version.json` last).
- **Detect:** smoke test after deploy; family reports; error log.
- **Recover:** upload the previous deploy ZIP. Schema changes are additive, so old code runs on the new schema. Phones get the "New version" prompt; stuck ones use **Fix the app** (PWA §6.4).

**T9 · Hostinger outage** — Low · Medium

- **Prevent:** nothing we control. The installed app keeps reading from its cache; small saves wait in the outbox.
- **Detect:** uptime monitor email ("fail"); the app shows "No internet".
- **Recover:** wait. Tell family: "Keep using it; changes wait on your phone." If it lasts > 24 h near the wedding, use the printed wedding-day pack (CONTEXT 11). If Hostinger is gone for good: §10 "Server gone" (new host + restore from B2).

**T10 · Locked out of Hostinger** — Low · High

- **Prevent:** 2FA with backup codes saved in two places; Mahi has her own access; each account's recovery email is the other person's own email (§7).
- **Detect:** login fails.
- **Recover:** backup codes → Hostinger "Forgot password" to the recovery email (Mahi's) → Hostinger support chat with ID. Meanwhile the app keeps running; B2 holds last night's data.

**T11 · Hosting expiry / payment missed** — Low · Critical (site and files deleted after a grace period)

- **Prevent:** hosting is **paid until 2028** (answered), well past the wedding and the archive date. Keep auto-renew on and the card details current anyway.
- **Detect:** Hostinger renewal emails; failed-payment email.
- **Recover:** pay at once in hPanel → Billing. If the account was already removed: §10 "Server gone".

**T12 · Domain expiry** — Low · High (app and email stop)

- **Prevent:** domain **paid until 2028** (answered). Keep auto-renew and domain lock on.
- **Detect:** registrar emails; uptime monitor.
- **Recover:** renew in the grace period; DNS comes back within hours.

**T13 · Hacked password** — Low · High

- **Prevent:** unique passwords from the password manager; 2FA on Hostinger, Google, B2; app login rate limits (API §10); B2 bucket with Object Lock, so even a stolen B2 key can't delete backups (§3.2).
- **Detect:** login alerts from Hostinger/Google; unknown sessions in Settings → My account; strange Activity; audit tamper check turns Safety red (DATABASE R11).
- **Recover:** §10 "Hacked". Change passwords, revoke sessions, rotate keys, compare data with last night's backup.

**T14 · Disk or database full** — Low · High

- **Prevent:** photos compressed on the phone; 10 MB file cap; exports deleted after 24 h; only 2 local backup copies; plan has 50 GB disk and 3 GB per database.
- **Detect:** Safety → storage amber at 70 %, red at 85 % (API §11).
- **Recover:** delete old exports and `work/local` copies; check the error log size; if the DB nears 3 GB, it is almost surely `audit_log` growth — tell me before deleting anything.

**T15 · Latest project ZIP lost** — Medium · Medium

- **Prevent:** at the end of every working session, `project-source-sessionNN.zip` goes to Google Drive (`A&M Wedding / code /`), and Claude pushes the code to the private GitHub repo `am-wedding` (answered: yes; IMPLEMENTATION §4.6). Every project ZIP also carries the full Git history in `.git/`.
- **Detect:** "where is the newest code?" — the newest `session-NN` tag on GitHub, or the newest file in Drive `code/`.
- **Recover:** the live server holds the built app; the project docs live in this Claude project. Rebuild from the newest ZIP.

**T16 · Backup key lost** — Low · Critical (every encrypted backup becomes useless)

- **Prevent:** `backup.key` is saved in the shared password manager entry "A&M backup key" **and** printed on paper at home (§3.4 step 6).
- **Detect:** the monthly drill decrypts a backup with the saved copy, not the server copy.
- **Recover:** the server still has the file; copy it again into the password manager. Never change the key (old backups need it).

**T17 · Backups silently stop** — Medium · Critical

- **Prevent / Detect:** four independent alarms: Safety card red > 26 h; uptime monitor email on `503`; the script's own failure email; the 36 h watchdog email. Plus the monthly drill proves a backup really restores.
- **Recover:** §10 "Backup failed".

**T18 · Mistake in phpMyAdmin** — Low · High

- **Prevent:** all foreign keys are `ON DELETE RESTRICT` (a `DELETE` of a family with invitations fails loudly). Take a manual backup before any hand-typed SQL. Practise on the staging database.
- **Detect:** row counts on the Safety card; audit tamper check.
- **Recover:** §6 for single rows; restore the backup into the staging DB and copy rows back for larger losses.

---

## 2. Layered protection

Each layer covers what the layer above can't. If one fails, the next one still holds the data.

| Layer | What it is | Protects against | How far back | Who acts | Where |
|---|---|---|---|---|---|
| 1. In-app: version checks | `If-Match` on every write; `409` on stale writes | T3 two people editing | — | Automatic | API §4 |
| 2. In-app: Undo | One tap reverts a delete, bulk action, import, done, mark paid | T1, T2 | 10 minutes | The person who acted | API §7 |
| 3. In-app: Trash | Soft-deleted batches, restorable with their children | T1, T2 after 10 min | Until 16 May 2027 (nothing purged before) | Admins | Settings → Deleted items |
| 4. In-app: audit log | Full row before and after every change | T2, T3, T18, "what was it before?" | For ever | Admins (§6) | `audit_log` |
| 5. On device: drafts | Unsaved typing kept per form | Back gesture, app killed | Until saved | Automatic | PWA §5 |
| 6. On device: outbox | Small saves wait until the server says 2xx | T4, weak venue network | Until sent or discarded | Automatic + **Send now** | PWA §5.2 |
| 7. On server: Hostinger backups | Hostinger's daily copies of files and DB | Server-side mistakes | 7 days (CONTEXT 20) | Admins via hPanel | hPanel → Files → Backups |
| 8. Off-site: our nightly backup | Encrypted DB dump + new uploads → Backblaze B2 | T7, T9 long, T10, T11, T13, T18 | 30 daily, 12 weekly, every monthly | Automatic (cron) | §3 |
| 9. Personal: monthly export | One-tap full export (JSON + CSV + files) saved to our Google Drive | Everything above failing at once; readable without the app | Every month, kept | Ayush or Mahi, 1st Sunday | §2.1 |
| 10. Code: ZIPs + GitHub | Every session's project ZIP + every deploy ZIP in Google Drive; every commit in the private GitHub repo | T8, T15 | Every version | Claude pushes; Ayush saves ZIPs, end of each session | §5.4 |

### 2.1 Monthly personal export (layer 9)

Do it right after the restore drill (§4), same day.

1. Open the app as Ayush or Mahi → **Settings → Export everything → Export everything → Export**.
2. Wait for "Export ready". Tap **Download** (part 1, then part 2 if shown). On iPhone: Share → Save to Files. The link works for 24 hours (API §9.1).
3. Upload the ZIP(s) to Google Drive → `A&M Wedding / exports /`. Keep the name `wedding-export_YYYY-MM-DD.zip`.
4. Open the ZIP once on a computer and open `summary.html`. You should see the families and payments.
5. Delete the ZIP from the phone's Downloads (it holds every guest's phone number).

The export is **not encrypted**. Keep that Drive folder unshared, and keep 2FA on both Google accounts (§7).

**If everything else is gone (hosting lost, backups lost):** the export alone rebuilds the app on any PHP + MySQL host.
1. New database → import `db/migrations/*.sql` in order (phpMyAdmin → Import).
2. Unzip every part of the export into one folder on the server.
3. SSH: `php private/app/tools/restore-from-export.php --export=<that folder> --env=private/.env --files`
   → it refuses a database that already has people in it; otherwise loads every row in one go and copies the photos and PDFs back (checked by SHA-256).
4. Passwords are never in an export: each person gets a new one (the owner first, via the break-glass steps in §7.3).
Tested every session by DS-22 (TESTING §1.4).

---

## 3. Off-site backup on Hostinger

### 3.1 How it works

```
Hostinger cron, 2:17 AM IST every night
        │
        ▼
backup.php (outside public_html)
  1. backup_runs row "running"
  2. counts every table + audit_log count / max id
  3. mysqldump --single-transaction | gzip | openssl AES-256  →  wedding_YYYYMMDD_HHMM.sql.gz.enc
  4. decrypts it again and checks it ends with "-- Dump completed"
  5. uploads dump + manifest to Backblaze B2   db/…
  6. uploads any new file from uploads/ (encrypted)   files/uploads/YYYY/MM/<uuid>.<ext>.enc
  7. retention: 30 daily, 12 weekly, all monthly  (older ones are hidden in B2)
  8. backup_runs row "ok"  → /health and the Safety card read it
     or "failed" + email to both of us
Hostinger cron, every 6 h:  backup.php --check  → email if no good backup for 36 h
```

| Choice | Why |
|---|---|
| PHP script, run by cron | Hostinger shared hosting has no other scheduler. The cron runs PHP from the command line, so web time limits don't apply. |
| `mysqldump --single-transaction` | A consistent copy of every InnoDB table without locking the app. Users can keep saving at 2 AM. |
| `--no-tablespaces` | Shared-hosting database users don't have the `PROCESS` privilege; without this flag MySQL 8 refuses. |
| No `CREATE DATABASE` in the dump | So the same file loads into the staging database (or any other name). |
| Encrypted with `openssl` AES-256 + PBKDF2 (200,000 rounds) | Guest phones and ID scans leave Hostinger only encrypted. `openssl` is standard on Linux, macOS (Homebrew) and Windows (Git for Windows), so a backup opens even if Hostinger is gone. |
| Verify step | A backup you can't open is not a backup. Each night the new file is decrypted and checked before it counts as "ok". |
| Files are incremental | Uploaded files never change (DATABASE: `files` is immutable). So each file is sent once and never again. |
| Plain manifest next to each dump | Row counts only, no personal data. The drill compares against it. |
| Backblaze B2 | 10 GB free; a fixed key that doesn't expire; Object Lock refuses deletes ([Backblaze FAQ](https://www.backblaze.com/blog/?p=43151)). |
| Password in a temporary `0600` file, not on the command line | Other users on a shared server can't see it in the process list. |
| All secrets in `private/backup/`, outside `public_html` | Nothing secret is reachable from the web (CONTEXT §8). |

**Expected size:** today's database compresses to well under 5 MB. 30 daily + 12 weekly + ~8 monthly ≈ 50 dumps ≈ 250 MB. Uploaded files: ~0.3–0.6 MB each after phone compression; 2,000 files ≈ 1 GB. **Total under 2 GB**, inside the free 10 GB.

### 3.2 Backblaze B2 setup (once, ~20 minutes)

Do this on a computer. Menu names may differ slightly; the idea stays the same.

1. Go to **backblaze.com → Sign up → B2 Cloud Storage**. Use Ayush's email, with Mahi's as recovery (§7). Turn on 2FA in **My Settings**. Save the login in the password manager as "Backblaze B2".
2. **Buckets → Create a Bucket.**
   - Name: `am-wedding-backups-<4 random letters>` (must be unique worldwide).
   - Files in bucket: **Private**.
   - Default encryption: **Enable**.
   - **Object Lock: Enable**. Default retention: **30 days**, mode **Governance**. (Locked file versions can't be deleted by our server key, even if the server is hacked.)
   - Create.
3. On the new bucket, click **Lifecycle Settings → Use custom lifecycle rules**: file name prefix *(empty)*, "Days till hide" *(empty)*, "Days till delete" **30**. Save. (Our script only *hides* old backups; B2 really deletes them 30 days later. A mistake can be undone for 30 days.)
4. Copy the **Bucket ID** shown under the bucket name. Paste it into the password manager entry.
5. **Application Keys → Add a New Application Key.**
   - Name: `hostinger-backup`.
   - Allow access to bucket: **only `am-wedding-backups-…`**.
   - Type of access: **Read and Write**.
   - Create. Copy **keyID** and **applicationKey** at once (the second is shown only once) into the password manager.
6. Check: **Browse Files** shows the empty bucket.

### 3.3 Files on Hostinger

```
/home/<u123456789>/domains/wedding.lumorrahouse.com/      ← the LIVE site folder (staging has its own, no backup/)
├── public_html/                 ← the web root (app + api stub). NOTHING from this section goes here.
└── private/                     ← not reachable from the web
    ├── .env                     ← the app's settings (IMPLEMENTATION §1.1)
    ├── app/                     ← PHP code
    ├── storage/uploads/…        ← the app's uploaded files
    └── backup/                  ← Folder permission 700. backup.php arrives with the Session 4 upload
        ├── backup.php           ← the script below (permission 600)
        ├── config.php           ← secrets (permission 600)
        ├── backup.key           ← encryption key, made by the script (permission 600)
        └── work/                ← made by the script: lock, temp files, last 2 local copies, cron.log
```

`<u123456789>` is your Hostinger username. You see it in hPanel → **Advanced → SSH Access**, and in File Manager's path bar. Card S10 (§3.4) confirms the folder names.

#### `private/backup/config.php`

```php
<?php
// config.php — settings and secrets for backup.php.
// Lives next to backup.php, OUTSIDE public_html. Permission 600. Never in Git, never emailed.
return [
    // Database: hPanel → Databases → Management. Same database and user the app uses.
    'db_host' => 'localhost',
    'db_port' => 3306,
    'db_name' => 'u123456789_amlive',
    'db_user' => 'u123456789_amlive',
    'db_pass' => 'PASTE-FROM-PASSWORD-MANAGER',

    // The folder that CONTAINS uploads/ (same as the app's storage setting in .env)
    'storage_root' => '/home/u123456789/domains/wedding.lumorrahouse.com/private/storage',

    // Backblaze B2 (§3.2)
    'b2_key_id'      => 'PASTE-keyID',
    'b2_app_key'     => 'PASTE-applicationKey',
    'b2_bucket_id'   => 'PASTE-Bucket-ID',
    'b2_bucket_name' => 'am-wedding-backups-xxxx',

    // Who gets alerts, and from which mailbox (must exist in hPanel → Emails)
    'alert_to'   => ['<ayush-gmail>', '<mahi-gmail>'],   // answered: your two Gmail addresses
    'alert_from' => 'planner@lumorrahouse.com',

    // SMTP for alerts (S10). Same mailbox and password as SMTP_* in private/.env.
    'smtp_host' => 'smtp.hostinger.com',
    'smtp_port' => 465,
    'smtp_user' => 'planner@lumorrahouse.com',
    'smtp_pass' => 'PASTE-FROM-PASSWORD-MANAGER',
    'health_url' => 'https://wedding.lumorrahouse.com/api/v1/health',

    // Optional — defaults shown:
    // 'max_age_hours' => 36,          // watchdog email threshold
    // 'keep_local' => 2,              // local copies kept on Hostinger
    // 'max_upload_mb_per_run' => 2000 // first runs spread big upload folders over several nights
    // 'mysqldump' => 'mysqldump', 'openssl' => 'openssl', 'gzip' => 'gzip',
];
```

#### `private/backup/backup.php`

**You don't paste this by hand any more.** From Session 4 it is part of the code: it arrives in `private/backup/` with the deploy upload, with one change from the listing below: alerts go over SMTP when `smtp_*` is set (S10), falling back to `mail()`. The listing stays here as the tested reference.

Tested 8 Oct 2026 in a sandbox (PHP 8.3, MariaDB 10.11 `mysqldump`, a fake B2 server): backup, second run uploads 0 files, decrypt, restore into a second database with Hindi and emoji intact, file decrypt byte-identical, plain `openssl` decrypt (laptop path), retention over 232 nights, watchdog at 40 h, and four failure cases (wrong B2 key, `mysqldump` error, missing key file, missing upload file). Each failure wrote `failed` (or a warning) and tried to email. **Not yet run on Hostinger** — §3.4 step 4 checks that.

```php
<?php
/*
 * backup.php — A&M Wedding: nightly off-site backup (DATA-SAFETY.md §3)
 *
 * Lives OUTSIDE public_html, next to config.php and backup.key. CLI only.
 *
 *   php backup.php                     nightly run (cron): DB dump + new uploads → Backblaze B2
 *   php backup.php --kind=manual_db    same, labelled manual (before a deploy)
 *   php backup.php --kind=pre_migration  same, labelled pre-migration
 *   php backup.php --check             watchdog (cron): email if no good backup for 36 h
 *   php backup.php --test-email        send a test alert email
 *   php backup.php --make-key          create backup.key once (prints it: save it in the password manager)
 *   php backup.php --decrypt FILE.enc  decrypt a backup file next to itself (restore drill)
 *
 * What a nightly run does, in order:
 *   1. backup_runs row 'running'
 *   2. row counts of every table + audit_log count / max id (tamper check)
 *   3. mysqldump --single-transaction | gzip | openssl (AES-256, key in backup.key)
 *   4. decrypt the new file again and check it ends with "-- Dump completed"
 *   5. upload dump + manifest to B2  db/…
 *   6. upload any upload-file not yet in B2 (files never change, so this is incremental)
 *   7. retention: 30 daily, 12 weekly, every monthly (hides the rest in B2)
 *   8. backup_runs row 'ok' (health endpoint reads it) — or 'failed' + email
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

const DUMP_DONE_MARK = '-- Dump completed';
const CIPHER_ARGS    = '-aes-256-cbc -pbkdf2 -iter 200000 -md sha256';

$cfg = require __DIR__ . '/config.php';
$cfg += [
    'b2_api_base'    => 'https://api.backblazeb2.com',
    'work_dir'       => __DIR__ . '/work',
    'key_file'       => __DIR__ . '/backup.key',
    'keep_local'     => 2,
    'max_age_hours'  => 36,
    'max_upload_mb_per_run' => 2000,
    'mysqldump'      => 'mysqldump',
    'openssl'        => 'openssl',
    'gzip'           => 'gzip',
    'label'          => 'A&M Wedding',
];
date_default_timezone_set('Asia/Kolkata');   // file names and emails use IST

$args = array_slice($argv, 1);
$mode = 'backup';
$kind = 'nightly_db';
$decryptFile = null;
foreach ($args as $i => $a) {
    if ($a === '--check')       { $mode = 'check'; }
    elseif ($a === '--test-email') { $mode = 'test_email'; }
    elseif ($a === '--make-key')   { $mode = 'make_key'; }
    elseif ($a === '--decrypt')    { $mode = 'decrypt'; $decryptFile = $args[$i + 1] ?? null; }
    elseif (str_starts_with($a, '--kind=')) {
        $kind = substr($a, 7);
        if (!in_array($kind, ['nightly_db', 'manual_db', 'pre_migration'], true)) {
            fwrite(STDERR, "Unknown --kind. Use nightly_db, manual_db or pre_migration.\n"); exit(2);
        }
    }
}

@mkdir($cfg['work_dir'], 0700, true);
@mkdir($cfg['work_dir'] . '/local', 0700, true);
@mkdir($cfg['work_dir'] . '/tmp', 0700, true);

try {
    switch ($mode) {
        case 'make_key':   exit(makeKey($cfg));
        case 'decrypt':    exit(decryptCli($cfg, $decryptFile));
        case 'test_email':
            $ok = alert($cfg, 'Test email', "This is a test from backup.php.\nIf you can read this, failure alerts will reach you.");
            say($ok ? 'Test email handed to the mail server.' : 'mail() refused the email. Check alert_from and alert_to.');
            exit($ok ? 0 : 1);
        case 'check':      exit(watchdog($cfg));
        default:           exit(runBackup($cfg, $kind));
    }
} catch (Throwable $e) {
    say('ERROR: ' . $e->getMessage());
    exit(1);
}

/* ======================================================================== */

function runBackup(array $cfg, string $kind): int
{
    $lock = fopen($cfg['work_dir'] . '/backup.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) {
        say('Another backup is still running. Stopping.');
        return 1;
    }
    $pdo = null; $runId = null; $tmpFiles = []; $encPath = null; $verified = false;
    $started = time();
    try {
        $pdo   = db($cfg);
        $pdo->exec("INSERT INTO backup_runs (kind, status) VALUES (" . $pdo->quote($kind) . ", 'running')");
        $runId = (int)$pdo->lastInsertId();
        say("Run #$runId ($kind) started.");
        if (!is_readable($cfg['key_file']) || filesize($cfg['key_file']) < 32) {
            throw new RuntimeException('backup.key is missing or unreadable (see DATA-SAFETY.md §3.4).');
        }

        // 2. Counts (taken just before the dump; 2 AM IST, so nothing should change in between)
        [$counts, $auditCount, $auditMax] = rowCounts($pdo);

        // 3. Dump → gzip → encrypt
        // IST, e.g. wedding_20261009_0217. Manual / pre-migration copies get a suffix: they are
        // never touched by retention, and can't overwrite a nightly file from the same minute.
        $base    = 'wedding_' . date('Ymd_Hi', $started)
                 . ['nightly_db' => '', 'manual_db' => '_manual', 'pre_migration' => '_premigration'][$kind];
        $encName = $base . '.sql.gz.enc';
        $encPath = $cfg['work_dir'] . '/local/' . $encName;
        $tmpFiles[] = $defaults = writeDefaultsFile($cfg);
        $dumpVer = trim(shell("{$cfg['mysqldump']} --version"));
        $isMaria = stripos($dumpVer, 'mariadb') !== false;
        $dumpCmd = sprintf(
            '%s --defaults-extra-file=%s --single-transaction --quick --no-tablespaces --hex-blob'
            . ' --default-character-set=utf8mb4 %s %s',
            $cfg['mysqldump'], escapeshellarg($defaults),
            $isMaria ? '' : '--set-gtid-purged=OFF',              // MySQL only; MariaDB's mysqldump rejects it
            escapeshellarg($cfg['db_name'])
        );
        $errFile = $cfg['work_dir'] . '/tmp/dump.err';
        $tmpFiles[] = $errFile;
        shell(sprintf(
            'set -o pipefail; %s 2>%s | %s -c -6 | %s enc %s -salt -pass file:%s -out %s',
            $dumpCmd, escapeshellarg($errFile), $cfg['gzip'], $cfg['openssl'], CIPHER_ARGS,
            escapeshellarg($cfg['key_file']), escapeshellarg($encPath)
        ), 'mysqldump/gzip/openssl', $errFile);
        @unlink($defaults);

        // 4. Verify: decrypt, unzip, last line must say the dump completed
        $tail = shell(sprintf(
            'set -o pipefail; %s enc -d %s -pass file:%s -in %s | %s -dc | tail -n 1',
            $cfg['openssl'], CIPHER_ARGS, escapeshellarg($cfg['key_file']), escapeshellarg($encPath), $cfg['gzip']
        ), 'verify');
        if (!str_starts_with(trim($tail), DUMP_DONE_MARK)) {
            throw new RuntimeException('Verify failed: the dump does not end with "' . DUMP_DONE_MARK . '"');
        }
        $verified = true;   // a good dump: kept locally even if the upload below fails
        $size = filesize($encPath);
        $sha  = hash_file('sha256', $encPath);
        say("Dump OK: $encName, " . round($size / 1048576, 2) . ' MB');

        // Manifest: plain JSON (no personal data, only counts), used by the restore drill
        $manifest = [
            'file' => $encName, 'sha256' => $sha, 'size_bytes' => $size,
            'created_at_utc' => gmdate('Y-m-d\TH:i:s\Z', $started), 'kind' => $kind,
            'database' => $cfg['db_name'], 'mysqldump' => $dumpVer,
            'cipher' => 'openssl enc -d ' . CIPHER_ARGS,
            'row_counts' => $counts, 'audit_row_count' => $auditCount, 'audit_max_id' => $auditMax,
        ];
        $manPath = $cfg['work_dir'] . '/local/' . $base . '.manifest.json';
        file_put_contents($manPath, json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");

        // 5. Off-site
        $b2 = new B2($cfg);
        $b2->upload($encPath, 'db/' . $encName);
        $b2->upload($manPath, 'db/' . $base . '.manifest.json', 'application/json');
        say('Uploaded dump and manifest to B2.');

        // 6. Upload files (incremental)
        $filesInfo = syncUploads($cfg, $b2, $pdo);
        $warnings  = $filesInfo['warnings'];

        // 7. Retention (never fails the run; problems become warnings)
        try {
            $hidden = applyRetention($b2, time());
            if ($hidden) say('Retention: hid ' . count($hidden) . ' old backup(s): ' . implode(', ', $hidden));
        } catch (Throwable $e) {
            $warnings[] = 'Retention step failed: ' . $e->getMessage();
        }

        // Keep only the newest N local copies
        pruneLocal($cfg);

        // 8. Done
        $counts['_files'] = $filesInfo['summary'];
        $stmt = $pdo->prepare("UPDATE backup_runs SET status = 'ok', finished_at = UTC_TIMESTAMP(),
              file_name = ?, size_bytes = ?, sha256 = ?, destination = ?, row_counts_json = ?,
              audit_row_count = ?, audit_max_id = ?, error = ? WHERE id = ?");
        $stmt->execute([$encName, $size, $sha, 'b2:' . $cfg['b2_bucket_name'],
            json_encode($counts, JSON_UNESCAPED_UNICODE), $auditCount, $auditMax,
            $warnings ? mb_substr('Warnings: ' . implode(' | ', $warnings), 0, 1000) : null, $runId]);
        $pdo->prepare("INSERT INTO audit_log (user_id, action, entity_type, entity_id, note)
                       VALUES (NULL, 'backup', 'backup_run', ?, ?)")
            ->execute([$runId, mb_substr("Backup $encName ($kind)", 0, 200)]);

        if ($warnings) {
            alert($cfg, 'Backup finished with warnings', "Backup $encName was saved, but:\n- " . implode("\n- ", $warnings));
        }
        say('Done in ' . (time() - $started) . ' s.');
        return 0;
    } catch (Throwable $e) {
        $msg = $e->getMessage();
        say('FAILED: ' . $msg);
        if (!$verified && $encPath && is_file($encPath)) @unlink($encPath);   // never keep a half-made file
        if ($pdo && $runId) {
            try {
                $pdo->prepare("UPDATE backup_runs SET status = 'failed', finished_at = UTC_TIMESTAMP(), error = ? WHERE id = ?")
                    ->execute([mb_substr($msg, 0, 1000), $runId]);
            } catch (Throwable $ignored) { /* DB may be the problem */ }
        }
        alert($cfg, 'BACKUP FAILED', "Tonight's backup failed.\n\nReason: $msg\n\n"
            . "What to do: DATA-SAFETY.md §10, row \"Backup failed\". Yesterday's backup is still safe in B2.");
        return 1;
    } finally {
        foreach ($tmpFiles as $f) { if (is_file($f)) @unlink($f); }
        flock($lock, LOCK_UN);
    }
}

/** Watchdog: run every 6 h. Emails if the newest good backup is older than max_age_hours. */
function watchdog(array $cfg): int
{
    $state = $cfg['work_dir'] . '/watchdog.last_alert';
    try {
        $pdo = db($cfg);
        $row = $pdo->query("SELECT MAX(finished_at) AS last_ok FROM backup_runs WHERE status = 'ok'")->fetch();
        $stuck = $pdo->query("SELECT COUNT(*) FROM backup_runs WHERE status = 'running'
                              AND started_at < UTC_TIMESTAMP() - INTERVAL 3 HOUR")->fetchColumn();
        $lastOk = $row['last_ok'] ? strtotime($row['last_ok'] . ' UTC') : null;
        $hours  = $lastOk ? (time() - $lastOk) / 3600 : null;
        $problem = null;
        if ($hours === null)                       $problem = 'There is no successful backup at all.';
        elseif ($hours > $cfg['max_age_hours'])    $problem = sprintf('The last good backup is %.0f hours old.', $hours);
        if ((int)$stuck > 0) $problem = trim(($problem ?? '') . " $stuck backup run(s) are stuck as 'running'.");
    } catch (Throwable $e) {
        $problem = 'The watchdog could not read the database: ' . $e->getMessage();
    }
    if ($problem === null) { say(sprintf('Watchdog: OK (last good backup %.1f h ago).', $hours)); return 0; }

    // At most one email per 12 hours
    $last = is_file($state) ? (int)file_get_contents($state) : 0;
    if (time() - $last < 12 * 3600) { say("Watchdog: problem, alert already sent recently. $problem"); return 1; }
    $sent = alert($cfg, 'Backup is OVERDUE', "$problem\n\nWhat to do: DATA-SAFETY.md §10, row \"Backup overdue\".");
    if ($sent) file_put_contents($state, (string)time());
    say('Watchdog: PROBLEM. ' . $problem);
    return 1;
}

/* ---------------------------------------------------------------- uploads */

function syncUploads(array $cfg, B2 $b2, PDO $pdo): array
{
    $root = rtrim($cfg['storage_root'], '/');
    $warnings = [];
    $remote = array_flip($b2->listNames('files/'));               // names already off-site
    $onDisk = 0; $new = 0; $newBytes = 0; $skippedForCap = 0;
    $cap = $cfg['max_upload_mb_per_run'] * 1048576;

    $dir = $root . '/uploads';
    if (is_dir($dir)) {
        $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS));
        foreach ($it as $f) {
            if (!$f->isFile() || $f->getFilename() === '.htaccess') continue;
            $onDisk++;
            $rel  = substr($f->getPathname(), strlen($root) + 1);   // uploads/2026/10/<uuid>.jpg
            $name = 'files/' . $rel . '.enc';
            if (isset($remote[$name])) continue;
            if ($newBytes + $f->getSize() > $cap) { $skippedForCap++; continue; }
            $tmp = $cfg['work_dir'] . '/tmp/' . bin2hex(random_bytes(8)) . '.enc';
            try {
                shell(sprintf('%s enc %s -salt -pass file:%s -in %s -out %s', $cfg['openssl'], CIPHER_ARGS,
                    escapeshellarg($cfg['key_file']), escapeshellarg($f->getPathname()), escapeshellarg($tmp)), 'encrypt file');
                $b2->upload($tmp, $name);
                $new++; $newBytes += $f->getSize();
            } finally { @unlink($tmp); }
        }
    } else {
        $warnings[] = "Uploads folder not found: $dir";
    }

    // Every files row should have its bytes on disk (DATABASE rule 13)
    $missing = [];
    foreach ($pdo->query('SELECT storage_path FROM files') as $r) {
        if (!is_file($root . '/' . $r['storage_path'])) $missing[] = $r['storage_path'];
    }
    if ($missing) $warnings[] = count($missing) . ' file(s) listed in the database are missing on disk, e.g. ' . $missing[0];
    if ($skippedForCap) $warnings[] = "$skippedForCap file(s) wait for the next night (upload cap per run).";

    say("Files: $onDisk on disk, $new new uploaded (" . round($newBytes / 1048576, 1) . ' MB).');
    return ['summary' => ['on_disk' => $onDisk, 'offsite_before' => count($remote), 'new' => $new,
                          'new_bytes' => $newBytes, 'missing_on_disk' => count($missing), 'waiting' => $skippedForCap],
            'warnings' => $warnings];
}

/* -------------------------------------------------------------- retention */

/**
 * Decide which DB backups to keep. Pure function (tested).
 * Keep: newest 30 days (daily) · newest backup of each of the last 12 weeks (weekly)
 *       · first backup of every month, for ever (monthly; removed by hand after the wedding, §9).
 * Always keeps at least the newest 7 backups, whatever their dates.
 * @param string[] $names e.g. wedding_20261009_0217.sql.gz.enc
 * @return string[] names to remove
 */
function retentionPlan(array $names, int $now): array
{
    $items = [];
    foreach ($names as $n) {
        if (preg_match('/^wedding_(\d{8})_(\d{4})\.sql\.gz\.enc$/', $n, $m)) {
            $items[$n] = DateTimeImmutable::createFromFormat('Ymd Hi', "$m[1] $m[2]", new DateTimeZone('Asia/Kolkata'));
        }
    }
    if (!$items) return [];
    arsort($items);                                   // newest first
    $keep = array_fill_keys(array_slice(array_keys($items), 0, 7), true);
    $today = (new DateTimeImmutable('@' . $now))->setTimezone(new DateTimeZone('Asia/Kolkata'))->setTime(0, 0);
    $weeksSeen = []; $monthFirst = [];
    foreach ($items as $n => $d) {
        $ageDays = (int)$today->diff($d->setTime(0, 0))->format('%a');
        if ($ageDays < 30) $keep[$n] = true;
        $week = $d->format('o-W');
        if ($ageDays < 84 && !isset($weeksSeen[$week])) { $weeksSeen[$week] = true; $keep[$n] = true; }
        $monthFirst[$d->format('Y-m')] = $n;          // items are newest first, so the last write wins = earliest
    }
    foreach ($monthFirst as $n) $keep[$n] = true;
    return array_values(array_diff(array_keys($items), array_keys($keep)));
}

function applyRetention(B2 $b2, int $now): array
{
    $names  = array_map(fn($n) => substr($n, 3), $b2->listNames('db/'));   // strip "db/"
    $remove = retentionPlan(array_filter($names, fn($n) => str_ends_with($n, '.sql.gz.enc')), $now);
    foreach ($remove as $n) {
        $b2->hide('db/' . $n);
        $man = 'db/' . str_replace('.sql.gz.enc', '.manifest.json', $n);
        try { $b2->hide($man); } catch (Throwable $e) { /* manifest may not exist */ }
    }
    return $remove;
}

function pruneLocal(array $cfg): void
{
    $files = glob($cfg['work_dir'] . '/local/wedding_*.sql.gz.enc') ?: [];
    rsort($files);
    foreach (array_slice($files, (int)$cfg['keep_local']) as $old) {
        @unlink($old);
        @unlink(str_replace('.sql.gz.enc', '.manifest.json', $old));
    }
}

/* ---------------------------------------------------------------- database */

function db(array $cfg): PDO
{
    $pdo = new PDO(
        sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $cfg['db_host'], $cfg['db_port'] ?? 3306, $cfg['db_name']),
        $cfg['db_user'], $cfg['db_pass'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
    $pdo->exec("SET time_zone = '+00:00'");
    $pdo->exec("SET SESSION sql_mode = 'STRICT_ALL_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO'");
    return $pdo;
}

function rowCounts(PDO $pdo): array
{
    $tables = $pdo->query("SELECT table_name FROM information_schema.tables
                           WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' ORDER BY table_name")
                  ->fetchAll(PDO::FETCH_COLUMN);
    $counts = [];
    foreach ($tables as $t) {
        $counts[$t] = (int)$pdo->query('SELECT COUNT(*) FROM `' . str_replace('`', '', $t) . '`')->fetchColumn();
    }
    $a = $pdo->query('SELECT COUNT(*) AS n, COALESCE(MAX(id), 0) AS m FROM audit_log')->fetch();
    return [$counts, (int)$a['n'], (int)$a['m']];
}

/** mysqldump reads the password from this 0600 file, so it never shows in the process list. */
function writeDefaultsFile(array $cfg): string
{
    $path = $cfg['work_dir'] . '/tmp/my.cnf';
    $q = fn($v) => '"' . addcslashes((string)$v, "\\\"") . '"';
    $body = "[client]\nuser=" . $q($cfg['db_user']) . "\npassword=" . $q($cfg['db_pass'])
          . "\nhost=" . $q($cfg['db_host']) . "\nport=" . (int)($cfg['db_port'] ?? 3306) . "\n";
    $old = umask(0077);
    file_put_contents($path, $body);
    umask($old);
    chmod($path, 0600);
    return $path;
}

/* ------------------------------------------------------------- key, decrypt */

function makeKey(array $cfg): int
{
    if (file_exists($cfg['key_file'])) {
        say('backup.key already exists. Not changing it (old backups need it).');
        return 1;
    }
    $key = rtrim(strtr(base64_encode(random_bytes(48)), '+/', '-_'), '=');
    $old = umask(0077);
    file_put_contents($cfg['key_file'], $key . "\n");
    umask($old);
    chmod($cfg['key_file'], 0600);
    say("Created backup.key. Save this line in the password manager NOW, as \"A&M backup key\":\n\n$key\n");
    say('Without it, no backup can ever be opened.');
    return 0;
}

function decryptCli(array $cfg, ?string $file): int
{
    if (!$file || !is_file($file)) { say('Usage: php backup.php --decrypt /path/to/wedding_….sql.gz.enc'); return 2; }
    $out = preg_replace('/\.enc$/', '', $file);
    if ($out === $file) $out .= '.dec';
    shell(sprintf('%s enc -d %s -pass file:%s -in %s -out %s', $cfg['openssl'], CIPHER_ARGS,
        escapeshellarg($cfg['key_file']), escapeshellarg($file), escapeshellarg($out)), 'decrypt');
    say('Decrypted to: ' . $out);
    if (str_ends_with($out, '.sql.gz')) {
        $tail = shell(sprintf('%s -dc %s | tail -n 1', $cfg['gzip'], escapeshellarg($out)), 'check');
        say(str_starts_with(trim($tail), DUMP_DONE_MARK) ? 'Check: complete dump ✓' : 'Check: WARNING — dump looks incomplete');
    }
    return 0;
}

/* -------------------------------------------------------------- helpers */

function shell(string $cmd, string $what = 'command', ?string $errFile = null): string
{
    $out = []; $code = 0;
    exec('/bin/bash -c ' . escapeshellarg($cmd) . ' 2>&1', $out, $code);
    if ($code !== 0) {
        $err = $errFile && is_file($errFile) ? trim((string)file_get_contents($errFile)) : '';
        throw new RuntimeException("$what failed (exit $code): " . mb_substr(trim($err . ' ' . implode(' ', $out)), 0, 600));
    }
    return implode("\n", $out);
}

function alert(array $cfg, string $subject, string $body): bool
{
    $to = implode(', ', (array)$cfg['alert_to']);
    $headers = 'From: ' . $cfg['label'] . ' <' . $cfg['alert_from'] . ">\r\n"
             . "Content-Type: text/plain; charset=UTF-8\r\n";
    $full = $body . "\n\nServer time: " . date('D j M Y, g:i A') . " IST\nHealth: "
          . ($cfg['health_url'] ?? 'https://wedding.lumorrahouse.com/api/v1/health') . "\n";
    $ok = @mail($to, '=?UTF-8?B?' . base64_encode('[' . $cfg['label'] . '] ' . $subject) . '?=', $full, $headers);
    say(($ok ? 'Alert email sent: ' : 'Alert email FAILED: ') . $subject);
    return $ok;
}

function say(string $line): void
{
    echo '[' . date('Y-m-d H:i:s') . ' IST] ' . $line . "\n";
}

/* ------------------------------------------------------- Backblaze B2 (native API v2) */

final class B2
{
    private array $cfg;
    private ?array $auth = null;
    private ?array $uploadTarget = null;

    public function __construct(array $cfg) { $this->cfg = $cfg; }

    private function authorize(): array
    {
        if ($this->auth) return $this->auth;
        $r = $this->http('GET', $this->cfg['b2_api_base'] . '/b2api/v2/b2_authorize_account',
            ['Authorization: Basic ' . base64_encode($this->cfg['b2_key_id'] . ':' . $this->cfg['b2_app_key'])]);
        return $this->auth = $r;
    }

    private function api(string $op, array $body): array
    {
        $a = $this->authorize();
        return $this->http('POST', $a['apiUrl'] . '/b2api/v2/' . $op,
            ['Authorization: ' . $a['authorizationToken'], 'Content-Type: application/json'], json_encode($body));
    }

    /** All file names under a prefix (current versions only). */
    public function listNames(string $prefix): array
    {
        $names = []; $start = null;
        do {
            $body = ['bucketId' => $this->cfg['b2_bucket_id'], 'prefix' => $prefix, 'maxFileCount' => 10000];
            if ($start !== null) $body['startFileName'] = $start;
            $r = $this->api('b2_list_file_names', $body);
            foreach ($r['files'] as $f) if (($f['action'] ?? 'upload') === 'upload') $names[] = $f['fileName'];
            $start = $r['nextFileName'] ?? null;
        } while ($start !== null);
        return $names;
    }

    public function hide(string $name): void
    {
        $this->api('b2_hide_file', ['bucketId' => $this->cfg['b2_bucket_id'], 'fileName' => $name]);
    }

    /** Upload with up to 3 tries; a fresh upload URL after each failure (as B2 asks). */
    public function upload(string $path, string $name, string $type = 'application/octet-stream'): void
    {
        $sha1 = sha1_file($path);
        $size = filesize($path);
        $last = null;
        for ($try = 1; $try <= 3; $try++) {
            try {
                if (!$this->uploadTarget) {
                    $this->uploadTarget = $this->api('b2_get_upload_url', ['bucketId' => $this->cfg['b2_bucket_id']]);
                }
                $fh = fopen($path, 'rb');
                $this->http('POST', $this->uploadTarget['uploadUrl'], [
                    'Authorization: ' . $this->uploadTarget['authorizationToken'],
                    'X-Bz-File-Name: ' . implode('/', array_map('rawurlencode', explode('/', $name))),
                    'Content-Type: ' . $type,
                    'Content-Length: ' . $size,
                    'X-Bz-Content-Sha1: ' . $sha1,
                ], null, $fh, $size);
                fclose($fh);
                return;
            } catch (Throwable $e) {
                $last = $e;
                $this->uploadTarget = null;
                sleep(2 * $try);
            }
        }
        throw new RuntimeException("Upload of $name failed after 3 tries: " . $last->getMessage());
    }

    private function http(string $method, string $url, array $headers, ?string $body = null, $fh = null, int $size = 0): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => $headers,
            CURLOPT_CONNECTTIMEOUT => 20, CURLOPT_TIMEOUT => 600, CURLOPT_CUSTOMREQUEST => $method,
        ]);
        if ($fh) {
            curl_setopt_array($ch, [CURLOPT_UPLOAD => true, CURLOPT_INFILE => $fh, CURLOPT_INFILESIZE => $size,
                                    CURLOPT_CUSTOMREQUEST => 'POST']);
        } elseif ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        }
        $res  = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $err  = curl_error($ch);
        curl_close($ch);
        if ($res === false) throw new RuntimeException("B2 network error: $err");
        $json = json_decode((string)$res, true);
        if ($code < 200 || $code >= 300 || !is_array($json)) {
            throw new RuntimeException("B2 HTTP $code: " . mb_substr((string)$res, 0, 300));
        }
        return $json;
    }
}
```

### 3.4 Step by step on Hostinger (once, in Session 4, ~45 minutes)

**How SSH steps are written (answered 8 Oct).** Every command is a **card**: one command per row, typed exactly, then **Enter**. Compare what appears with "You should see". If it's different, **stop** and paste what you see into the chat. Only the parts in `<angle brackets>` change. Every command uses the full path, so it doesn't matter which folder you are in.

**Step 1 — Turn on SSH.** hPanel → **Websites → Manage** (`wedding.lumorrahouse.com`) → **Advanced → SSH Access** → **Enable**. Note the **IP**, **port** (often `65002`) and **username** (`u…`). Set an SSH password. Save all four in the password manager entry "Hostinger SSH".

**Step 2 — Connect.** On a computer: Mac → **Applications → Utilities → Terminal**. Windows → **Start** → type `PowerShell` → open it.

| # | Type exactly | You should see | If not |
|---|---|---|---|
| S1 | `ssh -p <port> <u123456789>@<ip>` | First time only: `Are you sure you want to continue connecting (yes/no/[fingerprint])?` Later times: `…password:` | `Connection refused` or `timed out`: SSH isn't on, or the port is wrong. Recheck Step 1. |
| S2 | `yes` (first time only) | `<u123456789>@<ip>'s password:` | — |
| S3 | your SSH password. **Nothing appears while you type; that's normal.** | A prompt ending in `$`, for example `[u123456789@server ~]$` | `Permission denied`: wrong password. Try once more, then reset it in hPanel. |

**Step 3 — Check the tools** (still connected).

| # | Type exactly | You should see | If not |
|---|---|---|---|
| S4 | `which php` | A path such as `/usr/bin/php`. Write it down: the cron jobs use it. | `no php in …`: stop, tell Claude. |
| S5 | `php -v` | First line starts `PHP 8.2.` or `PHP 8.3.` | Any other version: stop, tell Claude (there is usually a separate path per PHP version). |
| S6 | `mysqldump --version` | One line containing `Ver 8.` (MySQL) or `MariaDB` | `command not found`: stop, tell Claude (we switch to a PHP-only dump). |
| S7 | `openssl version` | `OpenSSL 1.1.1…` or `OpenSSL 3.…` | Anything else: stop, tell Claude. |
| S8 | `date` | Today's date and the server's time | — |
| S9 | `date -u` | Today's date and the UTC time. **Same hour as S8 → server is on UTC** (use the cron lines in Step 9 as written). **S8 is 5 h 30 min ahead → server is on IST** (use the IST lines). | — |
| S10 | `ls ~/domains/` | A list that includes `wedding.lumorrahouse.com` and `staging-wedding.lumorrahouse.com` | Different names: **stop**, tell Claude. Every path in this document uses these two. |

**Step 4 — The two files.** `backup.php` arrives with the Session 4 upload (inside `1-server.zip`, at `private/backup/backup.php`); you don't paste it. You create only `config.php`:

1. hPanel → **Files → File Manager** → `domains/wedding.lumorrahouse.com/private/backup/`. (You are **beside** `public_html`, not inside it.)
2. **New File** `config.php` → paste the template from §3.3 → fill in the values from the password manager → **Save**.
3. Right-click `config.php` → **Permissions** → `600`. Same for `backup.php`. Right-click the `backup` folder → **Permissions** → `700`.

| # | Type exactly | You should see | If not |
|---|---|---|---|
| S11 | `ls -l ~/domains/wedding.lumorrahouse.com/private/backup/` | Two lines starting `-rw-------`, one ending `backup.php`, one ending `config.php` | Other letters at the start: set Permissions to `600` in File Manager, then repeat S11. `No such file`: the Session 4 upload didn't finish; redo IMPLEMENTATION §6.8. |

**Step 5 — Make the encryption key.**

| # | Type exactly | You should see | If not |
|---|---|---|---|
| S12 | `php ~/domains/wedding.lumorrahouse.com/private/backup/backup.php --make-key` | `Created backup.key. Save this line in the password manager NOW…`, then **one long line** of letters, numbers, `-` and `_`, then `Without it, no backup can ever be opened.` | `backup.key already exists`: a key was made before. **Never make another.** Check the password manager has it, then go to Step 7. |

**Step 6 — Save the key in two places, now.** Copy the long line into the password manager as **"A&M backup key"** (shared with Mahi). Also write or print it on paper, put it in an envelope marked "A&M Wedding backup key", and keep it at home. Without this key, no backup can ever be opened.

**Step 7 — Test email.**

| # | Type exactly | You should see | If not |
|---|---|---|---|
| S13 | `php ~/domains/wedding.lumorrahouse.com/private/backup/backup.php --test-email` | A line containing `Alert email sent: Test email` | `Alert email FAILED`: check `smtp_pass`, `alert_from` and `alert_to` in `config.php`, then repeat S13. |

Within a few minutes both of you get "[A&M Wedding] Test email". If it's in spam: **Not spam**. In Gmail, ⋮ → **Show original** should say SPF, DKIM and DMARC **PASS** (IMPLEMENTATION §7).

**Step 8 — First real run.**

| # | Type exactly | You should see | If not |
|---|---|---|---|
| S14 | `php ~/domains/wedding.lumorrahouse.com/private/backup/backup.php` | Over up to a few minutes: `Run #… (nightly_db) started.` → `Dump OK: wedding_….sql.gz.enc, … MB` → `Uploaded dump and manifest to B2.` → `Files: …` → last line **`Done in … s.`** | A line starting `FAILED:` — read the reason, then §10 "Backup failed". |
| S15 | `exit` | `Connection to … closed.` | — |

Then check:

- B2 → **Browse Files** → `db/` has `wedding_…sql.gz.enc` and `.manifest.json`.
- App → **Settings → Safety**: Backup is **green**, "last good backup a few minutes ago".

**Step 9 — Cron jobs.** hPanel → Websites → Manage (`wedding.lumorrahouse.com`) → **Advanced → Cron Jobs** → **Custom**. Add two jobs. Replace `<u123456789>` with your username; if S4 showed a different PHP path, use that instead of `/usr/bin/php`.

If the server runs on **UTC** (S9):

| Job | Minute | Hour | Day | Month | Weekday |
|---|---|---|---|---|---|
| Nightly backup, 2:17 AM IST | `47` | `20` | `*` | `*` | `*` |
| Watchdog, every 6 h | `23` | `*/6` | `*` | `*` | `*` |

If the server runs on **IST**: nightly backup is minute `17`, hour `2`. The watchdog stays the same.

Nightly backup command:

```
/usr/bin/php /home/<u123456789>/domains/wedding.lumorrahouse.com/private/backup/backup.php >> /home/<u123456789>/domains/wedding.lumorrahouse.com/private/backup/work/cron.log 2>&1
```

Watchdog command:

```
/usr/bin/php /home/<u123456789>/domains/wedding.lumorrahouse.com/private/backup/backup.php --check >> /home/<u123456789>/domains/wedding.lumorrahouse.com/private/backup/work/cron.log 2>&1
```

2:17 AM IST runs before the daily clean-up at 3:00 AM IST and avoids the busy :00 minute.

**Step 10 — Next morning.** Connect (S1, S3), then:

| # | Type exactly | You should see | If not |
|---|---|---|---|
| S16 | `tail -n 3 ~/domains/wedding.lumorrahouse.com/private/backup/work/cron.log` | The last line is `Done in … s.` with tonight's time (about 2:17 AM IST) | `No such file`: the cron job didn't run; recheck Step 9. `FAILED:`: §10 "Backup failed". |
| S17 | `exit` | `Connection to … closed.` | — |

And the Safety card is still green.

**Step 11 — Uptime monitor** (already decided, API §11). Free UptimeRobot account → New monitor → HTTP(s) → URL `https://wedding.lumorrahouse.com/api/v1/health` → every 5 minutes → alert contacts: both emails. It sees only "ok" or "fail".

### 3.4.1 SSH cards used elsewhere

Connect first with S1 and S3 each time, and end with `exit`.

| # | When | Type exactly | You should see | If not |
|---|---|---|---|---|
| B1 | Before every live deploy (§5.1) | `php ~/domains/wedding.lumorrahouse.com/private/backup/backup.php --kind=manual_db` | Last line `Done in … s.` | `FAILED:` → don't deploy; §10 "Backup failed" |
| B2 | Before every migration (§5.2), instead of B1 | `php ~/domains/wedding.lumorrahouse.com/private/backup/backup.php --kind=pre_migration` | Last line `Done in … s.` | Same as B1 |
| B3 | Before hand-typed SQL (§6) | Same as B1 | Same as B1 | Same as B1 |
| D1 | Drill §4.2 step 2 | `php ~/domains/wedding.lumorrahouse.com/private/backup/backup.php --decrypt ~/domains/wedding.lumorrahouse.com/private/backup/restore/<file name>.sql.gz.enc` | `Decrypted to: …sql.gz`, then `Check: complete dump ✓` | `bad decrypt`: wrong key file — stop, tell Claude. `Check: WARNING`: log the drill as Failed. |
| D2 | Drill §4.2 step 4, only if phpMyAdmin says the file is too big | `gunzip -c ~/domains/wedding.lumorrahouse.com/private/backup/restore/<file name>.sql.gz \| mysql -u <u123456789>_amstaging -p <u123456789>_amstaging` | `Enter password:` → type the **staging** DB password (nothing shows) → after a while the `$` prompt returns **with no message**. Silence means success. | `ERROR 1045`: wrong password. `ERROR 1049`: wrong database name. Any other `ERROR`: stop, paste it to Claude. |
| D3 | Drill §4.2 step 8 | `php ~/domains/wedding.lumorrahouse.com/private/backup/backup.php --decrypt ~/domains/wedding.lumorrahouse.com/private/backup/restore/<file name>.jpg.enc` | `Decrypted to: …` | `bad decrypt`: stop, tell Claude |
| K1 | Break-glass (§7.3) | `php -r 'echo password_hash("<New-Temp-Password-123>", PASSWORD_DEFAULT), "\n";'` | One line of about 60 characters starting `$2y$` | `command not found`: use the path from S4 instead of `php` |

In D2, the character between `.sql.gz` and `mysql` is one vertical bar `|`.

### 3.5 Retention

| Kept | Rule | About |
|---|---|---|
| Daily | Every backup from the last 30 days | 30 files |
| Weekly | The newest backup of each of the last 12 weeks | +8 files (the newest 4 weeks are already daily) |
| Monthly | The first backup of every month — **never removed by the script** | +1 per month |
| Safety floor | Always the newest 7, whatever their dates | — |
| Manual / pre-migration | `…_manual…` and `…_premigration…` files — never removed by the script | — |
| Uploaded files | Never removed (they never change) | — |

The "all monthly until 3 months after the wedding" rule is met by never deleting monthlies. On 16 May 2027 you decide what to keep (§9). Removed backups are only **hidden** in B2 and really deleted 30 days later (lifecycle rule), so a wrong removal can be undone.

Tested on 232 nights (1 Oct 2026 → 20 May 2027): 45 kept = 30 daily + 8 weekly + 7 monthly (May's monthly falls inside the 30 days).

### 3.6 What the health endpoint and Safety card show

`backup.php` writes `backup_runs` (kind, status, file name, size, SHA-256, `b2:<bucket>`, row counts, audit count and max id, warnings in `error`). The API already reads that table (API §11, DATABASE §7.6). No API change is required.

| Signal | Turns red / emails when | Who sees it |
|---|---|---|
| Safety card → Backup | no `ok` run in 26 h, or audit count / max id went down | Admins in the app |
| `GET /api/v1/health` (anonymous) | same → `503 fail` | Uptime monitor → email to both |
| Script failure email | any failed step tonight | Both, at ~2:20 AM IST |
| Script warning email | run ok, but e.g. a file is missing on disk, or files wait for next night | Both |
| Watchdog email | no `ok` run in 36 h, or a run stuck "running" > 3 h | Both, at most every 12 h |

Suggested small addition for API.md v1.2 (optional): show `_files.missing_on_disk > 0` or a non-empty warning as **amber** on the Safety card.

---

## 4. Restore drill (monthly, ~1 hour)

Goal: prove that last night's off-site backup really opens and contains our data. Done **from B2**, as if Hostinger were gone. It is restored into the **staging database** (answered), checked, and then staging gets its demo data back.

### 4.1 While real data is on staging

For about an hour, staging (`staging-wedding.lumorrahouse.com`) holds real guests, real members and real password hashes. So:

| Rule | Why |
|---|---|
| Pause staging's cron jobs first (reminders, from R2a) | Staging must never send reminders or emails to real people |
| Don't share the staging link or test on it with family during the drill | Real members' real passwords work there while the data is loaded |
| Finish with step 10–11 the **same day** | CONTEXT 38: staging is for demo data |
| Staging has no real uploaded files | Documents won't open on staging; that's expected. Files are checked in step 8 instead. |

### 4.2 Steps

1. **Download from B2.** B2 → Browse Files → `db/` → tick last night's `wedding_YYYYMMDD_HHMM.sql.gz.enc` and its `.manifest.json` → **Download**. Also download one file from `files/uploads/…` (any `.enc`).
2. **Decrypt — on the server (easiest).** File Manager → `domains/wedding.lumorrahouse.com/private/backup/` → create folder `restore` → upload the `.enc` files there. SSH in (S1, S3) and use card **D1** (§3.4.1). It must print `Check: complete dump ✓`.

   **Or on your laptop** (proves the paper/password-manager key works without Hostinger). Save the key line from the password manager in a file `backup.key`, then:

   ```
   openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -md sha256 -pass file:backup.key -in wedding_YYYYMMDD_HHMM.sql.gz.enc -out wedding_YYYYMMDD_HHMM.sql.gz
   ```

   (Mac: if it says "unknown option -pbkdf2", install OpenSSL with Homebrew. Windows: use "Git Bash" from Git for Windows.) Do the laptop way at least every other month.
3. **Pause staging and empty its database.** hPanel → Websites → Manage (`staging-wedding.lumorrahouse.com`) → **Advanced → Cron Jobs**: delete or comment out staging's jobs (note them down to add back). Then hPanel → **Databases → Management** → the staging database (`u123456789_amstaging`, under the staging website) → **Enter phpMyAdmin**. **Double-check the name in the top-left is the staging DB, not live.** **Structure** → tick **Check all** → "With selected" **Drop** → untick "Enable foreign key checks" → **Yes**.
4. **Import.** Still in the staging DB: **Import** → Choose file → the `.sql.gz` → Character set **utf-8** → **Go**. Wait for "Import has been successfully finished". (If phpMyAdmin says the file is too big, use card **D2**, §3.4.1.)
5. **Count rows.** phpMyAdmin → **SQL** tab → paste and **Go**:

   ```sql
   SELECT 'users' AS t, COUNT(*) AS n FROM users
   UNION ALL SELECT 'events', COUNT(*) FROM events
   UNION ALL SELECT 'households', COUNT(*) FROM households
   UNION ALL SELECT 'household_events', COUNT(*) FROM household_events
   UNION ALL SELECT 'tasks', COUNT(*) FROM tasks
   UNION ALL SELECT 'task_items', COUNT(*) FROM task_items
   UNION ALL SELECT 'vendors', COUNT(*) FROM vendors
   UNION ALL SELECT 'payments', COUNT(*) FROM payments
   UNION ALL SELECT 'budget_categories', COUNT(*) FROM budget_categories
   UNION ALL SELECT 'documents', COUNT(*) FROM documents
   UNION ALL SELECT 'files', COUNT(*) FROM files
   UNION ALL SELECT 'change_batches', COUNT(*) FROM change_batches
   UNION ALL SELECT 'audit_log', COUNT(*) FROM audit_log
   UNION ALL SELECT 'audit_log max id', MAX(id) FROM audit_log
   UNION ALL SELECT 'schema version', MAX(version) FROM schema_migrations WHERE finished_at IS NOT NULL;
   ```

   Open the `.manifest.json` (any text editor). Every number must equal `row_counts` (and `audit_max_id`). `sessions`, `rate_limits`, `idempotency_keys` and `login_attempts` may differ; ignore them.
6. **Spot-check 5 records.** In the live app pick 5 things **not changed since last night** (look at "Updated …"): a family with a Hindi name, a family's Coming? for Wedding, a paid payment, a task with a checklist, a document. For each, copy its id from the app's address (the 26-character code) and run in the staging DB, for example:

   ```sql
   SELECT name, phone, side, adults, children, food, version FROM households WHERE public_id = '<26-char id>';
   SELECT title, amount_paise / 100 AS rupees, status, paid_on FROM payments WHERE public_id = '<26-char id>';
   ```

   Values must match the app exactly, including Hindi letters and emoji. Bonus check: log in to the **staging app** with your real phone and password and look at the same records on screen.
7. **Money total.** If no payment was saved since last night, `SELECT SUM(amount_paise)/100 FROM payments WHERE deleted_at IS NULL AND status = 'paid';` equals the Budget card's **Spent**.
8. **One file.** Decrypt the file you downloaded (card **D3**, §3.4.1), download it from File Manager, open it. It must be the same photo/PDF as in the app.
9. **Log it.** App → **Settings → Safety → Log a restore drill**: date, Passed / Failed, the backup file name, a note.
10. **Clean up (privacy).** In phpMyAdmin, drop all tables in the staging DB again (step 3). Delete the `restore/` folder on the server. Delete the downloaded and decrypted files from your laptop, including the Downloads folder and Trash, and the `backup.key` file you made in step 2.
11. **Put the demo data back on staging.** Staging DB → **Import**, one file at a time, in this order, character set utf-8: `001_init.sql` → `002_open_answers.sql` → `003_api_support.sql` → (any later migrations) → `seed_demo.sql`. Log in to staging as a demo user (password `demo-1234`) to check. Add staging's cron jobs back.

### 4.3 Drill checklist

| ☐ | Check | Pass when |
|---|---|---|
| ☐ | Last night's dump and manifest are in B2 | Both files present, today's date |
| ☐ | Decrypt works | `Check: complete dump ✓` (or openssl gives no error) |
| ☐ | Key from the password manager (or paper) works | Laptop decrypt succeeded (every other month) |
| ☐ | Import finished | phpMyAdmin success message |
| ☐ | Row counts | All equal to the manifest |
| ☐ | Audit max id | Equals `audit_max_id` |
| ☐ | 5 spot-checks | All values identical, Hindi/emoji intact |
| ☐ | One uploaded file | Opens, same as in the app |
| ☐ | Drill logged in the app | Safety → restore drill green |
| ☐ | Staging cron paused before, restored after | Jobs back in hPanel |
| ☐ | Cleaned up | Real data gone from staging, `restore/` deleted, laptop copies deleted |
| ☐ | Demo data back on staging | Demo login works |
| ☐ | Monthly export done (§2.1) | ZIP in Google Drive |

If anything fails: log the drill as **Failed** with the reason, and tell me the same day.

### 4.4 Monthly calendar reminder

First Sunday of each month, 11:00 AM IST, 1 hour, for both of you. Dates: **Tue 27 Oct 2026** (first drill, after launch), then Sun 1 Nov, 6 Dec, 3 Jan, **7 Feb** (one week before the wedding), 7 Mar, 4 Apr, 2 May 2027.

Google Calendar: **Create → Event** → "A&M Wedding – restore drill + export" → Sunday 1 Nov 2026, 11:00–12:00 → **Does not repeat ▾ → Custom → Repeat every 1 month → "Monthly on the first Sunday"** → Ends **31 May 2027** → add Mahi as guest → notification 1 day before → Save. Add a one-off event for Tue 27 Oct.

Or save this as `drill.ics` and import it (Google Calendar → Settings → Import & export):

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//A&M Wedding//Restore drill//EN
BEGIN:VEVENT
UID:am-wedding-restore-drill@lumorrahouse.com
DTSTAMP:20261008T000000Z
DTSTART;TZID=Asia/Kolkata:20261101T110000
DURATION:PT1H
RRULE:FREQ=MONTHLY;BYDAY=1SU;UNTIL=20270531T000000Z
SUMMARY:A&M Wedding – restore drill + monthly export (DATA-SAFETY.md §4)
BEGIN:VALARM
TRIGGER:-P1D
ACTION:DISPLAY
DESCRIPTION:Restore drill tomorrow
END:VALARM
END:VEVENT
END:VCALENDAR
```

---

## 5. Before every deploy and every migration

### 5.1 Every deploy (code only)

| # | Step | Done |
|---|---|---|
| 1 | Safety card all green. If not, fix that first. | ☐ |
| 2 | **Backup now:** SSH card **B1** (§3.4.1) → last line `Done in … s.` | ☐ |
| 3 | **App export** (CONTEXT risk 2): Settings → Export → save the ZIP to Drive `exports/` with `_pre-deploy` in the name. | ☐ |
| 4 | **Keep the current live build:** the `deploy-sessionNN.zip` that is live now must already be in Drive `deploys/`. If it isn't, download `public_html` and `private/app` (File Manager → select → Compress → Download) and save them there first. | ☐ |
| 5 | Claude builds `deploy-sessionNN.zip` (version in `VERSION` and `RELEASE-NOTES.md`; never `.env`, `config.php` or `backup.key`). Save it to Drive `deploys/`. | ☐ |
| 6 | Deploy to **staging** (`staging-wedding.lumorrahouse.com`, demo data). Test on one Android and one iPhone: log in, add a task offline then send, edit a family, open a PDF, Safety card. | ☐ |
| 7 | Tell the family WhatsApp group: "Updating the app 10:00–10:15 PM. Your changes will wait on your phone." Pick a quiet hour. | ☐ |
| 8 | Upload to live with IMPLEMENTATION §6.8: `1-server.zip` → `2-assets.zip` → `3-shell.zip` → `version.json` **last** (PWA §4.4). Keep old `/assets/` files for 14 days. | ☐ |
| 9 | Smoke test on your phone: "New version available" appears → refresh → Home loads → save one task → Safety green. | ☐ |
| 10 | Note in Drive `deploys/log.txt`: date, version, what changed, "OK". | ☐ |

### 5.2 Every migration (database change)

Do §5.1 steps 1–3 first, but use card **B2** (`--kind=pre_migration`) in step 2.

| # | Step | Done |
|---|---|---|
| 1 | Read the migration file's header (what it changes, "if it stops"). | ☐ |
| 2 | **Rehearse on staging with real data:** restore last night's backup into the staging DB (§4.2 steps 1–4, including pausing staging cron), run the migration there (phpMyAdmin → Import, character set utf-8, foreign key checks ticked). It must finish with no error, and `SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 1;` shows `finished_at` set. | ☐ |
| 3 | Put demo data back on staging (§4.2 steps 10–11, now including the new migration), then test the new code there with demo data (§5.1 step 6). | ☐ |
| 4 | Check staging cron jobs are back on. | ☐ |
| 5 | Live, at the quiet hour: run the migration in phpMyAdmin on the live DB. Check `schema_migrations`. | ☐ |
| 6 | Deploy the code that needs it (§5.1 steps 8–10). Order matters: **migration first, then code** (DATABASE rule 14). | ☐ |

### 5.3 Rollback plan

| What went wrong | Do this | Data lost? |
|---|---|---|
| New code is broken; migration was fine or none | Upload the **previous deploy ZIP** from Drive, same order as §5.1 step 8. Because every migration is additive (DATABASE §6 rule 5), old code works on the new schema. Phones get the update prompt; stuck ones: Settings → **Fix the app**. | No |
| Migration stopped part-way | DATABASE §6 step 6: read the error; finish the remaining statements by hand and set `finished_at`, **or** restore the pre-migration backup. Never re-run the whole file unless its header says so. | No |
| New code saved wrong values | Stop: roll back the code (row 1). Then fix the bad rows from `audit_log` (§6). | No |
| Database badly damaged (last resort) | Restore the `_premigration` / `_manual` backup into the **live** DB (same steps as §4.2, live DB instead of drill). Everything saved after that backup is lost: list it first from `audit_log` in the damaged DB (`SELECT … WHERE created_at > '<backup time UTC>'`), save that list as CSV, and re-enter it. Phones' outboxes resend their waiting changes by themselves. Ask me before doing this. | Changes since the backup, re-entered by hand |

### 5.4 Code ZIPs (layer 10)

| ZIP | When | Drive folder | Name |
|---|---|---|---|
| Project ZIP from each working session | End of every session | `A&M Wedding / code /` | `project-source-sessionNN.zip` (fix chats: `project-source-fixNNN_<YYYY-MM-DD>.zip`) |
| Deploy ZIP (exactly what went live) | Every deploy | `A&M Wedding / deploys /` | `deploy-sessionNN.zip` (fix chats: `deploy-fixNNN_<YYYY-MM-DD>.zip`) |
| Git commits | Every green step in a session | Private GitHub repo `am-wedding` | Tag `session-NN` at the end of each session (IMPLEMENTATION §4.6) |

Never put `.env`, `config.php` or `backup.key` in any ZIP or in Git (`.gitignore` blocks them; the test suite checks). Keep at least the last 5 deploy ZIPs; never delete the one that is live.

---

## 6. Restore one record from `audit_log` (point in time)

Use this when one record was changed wrongly and **Undo** is no longer possible (more than 10 minutes, or someone else changed it). For a deleted record, use **Deleted items → Restore** instead.

`audit_log` keeps the **full row before and after** every change (`before_json`, `after_json`). So we can see what a record looked like at any moment, and copy the good values back.

**First:** take a backup (SSH card **B3**, §3.4.1). Then open phpMyAdmin on the **live** database → **SQL** tab. Run one block at a time.

**Step 1 — Find the record.** Open it in the app and copy the 26-character id from the address bar. Then (example for a family; for a task use `tasks` and `'task'`, for a payment `payments` and `'payment'`):

```sql
SET @id := (SELECT id FROM households WHERE public_id = '01JA7Q3M2K8V5R1T9W4X6Y0Z2B');
SELECT @id, version FROM households WHERE id = @id;
```

**Step 2 — Read its history.** Newest last.

```sql
SELECT a.id, a.created_at AS utc_time, u.name AS who, a.action, a.entity_version,
       a.before_json, a.after_json, a.note
FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
WHERE a.entity_type = 'household' AND a.entity_id = @id
ORDER BY a.id;
```

Find the row of the **bad change**. Its `before_json` holds the good values. Note its `a.id` (e.g. `2`). Times are UTC: add 5 h 30 min for IST.

**Step 3 — Copy back only the fields that were wrong.** Edit the `SET` lines: one line per wrong field, using `JSON_VALUE(@good, '$.<column>')`. Leave other fields alone, so later good edits are kept.

```sql
SET @bad_audit_id := 2;      -- the audit row of the bad change (step 2)
SET @me := 1;                -- your user id: 1 = Ayush. Check: SELECT id, name FROM users;
SET @good    := (SELECT before_json FROM audit_log WHERE id = @bad_audit_id);
SET @cur_ver := (SELECT version FROM households WHERE id = @id);
SET @cur     := (SELECT after_json FROM audit_log
                 WHERE entity_type = 'household' AND entity_id = @id ORDER BY id DESC LIMIT 1);

START TRANSACTION;

UPDATE households
   SET adults = JSON_VALUE(@good, '$.adults'),      -- ← one line per wrong field
       city   = JSON_VALUE(@good, '$.city'),
       version = version + 1, updated_by = @me
 WHERE id = @id AND version = @cur_ver AND deleted_at IS NULL;

SELECT ROW_COUNT() AS rows_changed;   -- must be 1. If 0: someone just edited it → run ROLLBACK; and start again.

INSERT INTO audit_log (user_id, action, entity_type, entity_id, entity_version, before_json, after_json, note)
SELECT @me, 'update', 'household', @id, version, @cur,
       JSON_SET(@cur, '$.adults', adults, '$.city', city, '$.version', version),   -- ← same fields as above
       CONCAT('Manual restore from audit_log #', @bad_audit_id, ' (DATA-SAFETY §6)')
FROM households WHERE id = @id;

COMMIT;
```

**Step 4 — Check.** Reopen the record in the app (pull to refresh). History shows "Manual restore from audit_log #2". Phones pick up the new version on their next refresh.

Rules:

| Rule | Why |
|---|---|
| Always bump `version` and write the audit row in the same transaction | Phones holding the old version get a normal conflict screen, and History stays honest (DATABASE rules 3–4). |
| Change only the wrong fields | Later correct edits by others survive. |
| Money fields: copy `amount_paise`, `status`, `paid_on`, `method` **together** | The `ck_payments_state` rule needs them to agree. |
| Checklist, assignees, tags | Restore through the app (edit the task); they are child lists saved via the parent (DATABASE rule 8). |
| A row hard-deleted in phpMyAdmin (no `deleted_at`, just gone) | Restore last night's backup into the staging DB (§4.2), find the row there, **Export** that one row as SQL (phpMyAdmin → table → Search → tick the row → Export), and import it into live. Then put demo data back on staging (§4.2 steps 10–11). Ask me first if it has children. |

Tested 8 Oct 2026 on a copy: the wrong `adults = 40, city = NULL` went back to `4, Udaipur`, version 2 → 3, and a matching audit row was written. `JSON_VALUE` needs MySQL 8.0.21+ (we have 8.0.46) or MariaDB 10.2.3+.

---

## 7. Account safety

### 7.1 Who has what

| Account | Ayush | Mahi | 2FA | Recovery | Auto-renew |
|---|---|---|---|---|---|
| Password manager (e.g. Bitwarden; free plan lets 2 people share) | Own login | Own login | **Yes** | Each other's email | — |
| Hostinger (hPanel) | Owner | Own login via hPanel account sharing (verify the menu), or shared entry | **Yes, authenticator app** | Mahi's email | Paid until 2028; auto-renew ON |
| Domain `lumorrahouse.com` | Owner | Shared entry | Yes | Mahi's email | Paid until 2028; auto-renew ON |
| Backblaze B2 | Shared entry | Shared entry | Yes | Mahi's email | Free tier (no renewal) |
| Google accounts (Drive: exports, ZIPs) | Own | Own; shared folder `A&M Wedding` | **Yes** | Phone + other's email | — |
| UptimeRobot | Shared entry | Alerts to her email | Optional | — | Free |
| `planner@lumorrahouse.com` mailbox | Shared entry | Shared entry | — | — | Part of the plan |
| GitHub (private repo `am-wedding`) | Owner | Collaborator (optional) | **Yes** | Mahi's email | Free |
| App: Owner (Ayush) / Partner (Mahi) | Owner | Partner | — | Admin reset by the other; break-glass §7.3 | — |

**Recovery emails (answered: no shared backup Gmail):** accounts in Ayush's name use Mahi's own email as recovery, and the other way round. So neither of you is a single point of failure.

### 7.2 One-time setup checklist

| ☐ | Task | Where |
|---|---|---|
| ☐ | Password manager set up, shared "A&M Wedding" folder, both have access | Bitwarden → Organization (or your choice) |
| ☐ | Every password below is unique and generated (20+ characters) | Password manager |
| ☐ | Hostinger 2FA on; **backup codes** saved in the manager **and** printed with the backup key | hPanel → profile icon → Account settings → Security → Two-factor authentication |
| ☐ | Hosting and domain: paid until 2028 (answered). Auto-renew ON, domain lock ON, card details current | hPanel → Billing → Subscriptions; registrar |
| ☐ | Recovery email on each account = the other person's email | Each account's security settings |
| ☐ | B2: 2FA on; key restricted to the one bucket; Object Lock + lifecycle (§3.2) | Backblaze |
| ☐ | Google: 2FA on both accounts; recovery phone and email set | myaccount.google.com → Security |
| ☐ | `planner@` mailbox exists; SPF/DKIM/DMARC on (CONTEXT risk 4) | hPanel → Emails; IMPLEMENTATION §7 |
| ☐ | GitHub 2FA on; repo `am-wedding` is **Private**; Claude's token limited to that one repo, Contents only, expires 31 Mar 2027 | github.com → Settings (IMPLEMENTATION §4.6) |
| ☐ | Paper envelope at home: backup key, Hostinger backup codes, password-manager emergency kit | Home |

### 7.3 Break-glass: owner locked out of the app

Mahi (Partner) can do everything except reset the Owner's password (API §6.2). If Ayush can't log in and can't reset his own password:

1. SSH in (S1, S3) and make a password hash with card **K1** (§3.4.1). Replace `<New-Temp-Password-123>` with a temporary password; keep the quotes.
2. phpMyAdmin → live DB → SQL (paste the hash from step 1):

   ```sql
   UPDATE users
      SET password_hash = '<paste hash>', must_change_password = 1,
          password_changed_at = UTC_TIMESTAMP(), version = version + 1
    WHERE role = 'owner';
   INSERT INTO password_resets (user_id, reset_by, method, sessions_revoked)
   SELECT id, NULL, 'admin_set', 0 FROM users WHERE role = 'owner';
   ```

3. Log in with the temporary password; the app asks for a new one.

---

## 8. Privacy

Guest phone numbers, addresses, notes and ID scans are personal data of about 1,800 people who never signed up for our app. Treat them like bank details.

Note: India's DPDP Act 2023 excludes data processed by an individual for a personal or domestic purpose, which likely covers a family wedding. We follow good practice anyway. This is not legal advice.

| Rule | How we do it | Status |
|---|---|---|
| Login on everything | Every API endpoint needs a session; no public links; `noindex` everywhere (API §10.3) | Built in |
| Files never public | Uploads outside `public_html`, served only through the authenticated endpoint; PDFs via the share sheet (CONTEXT 32) | Built in |
| Minimal access | Viewers read only; money hidden from non-money users; family members can't import or export guests; only admins export | Built in |
| No third-party analytics or trackers | CSP `connect-src 'self'` blocks them; no analytics script, no fonts or scripts from other sites (API §10.3, PWA §4) | Built in; keep it |
| Uptime monitor sees nothing | It gets only "ok"/"fail" from `/health` | Built in |
| Off-site copies encrypted | B2 holds only `.enc` files; key not on B2 | §3 |
| Our own copies | Monthly export ZIP is **not** encrypted: unshared Drive folder, 2FA; delete phone/laptop copies after upload | §2.1 |
| Drill leaves nothing behind | Real data removed from staging the same day, demo data back, decrypted files deleted | §4.2 steps 10–11 |
| Lost phone | Reset that member's password → all sessions revoked; cached guest data unusable without login | §1 T5 |
| Member leaves the planning | Settings → Members → set **access end date** or deactivate; their phone's cache is wiped at next open (session ended) | Built in |
| WhatsApp | `wa.me` links built on the phone; the server never sends numbers anywhere (CONTEXT 12) | Built in |

### 8.1 After the wedding: keep everything (answered)

Nothing is anonymised or removed after the wedding. Names, phone numbers, addresses, notes and documents all stay.

| Date | Action |
|---|---|
| Mon 1 Mar 2027 | Set **access end date** for all family members and viewers. They lose access, and their phones' cached guest data is cleared on next open. Only Ayush and Mahi keep access. |
| Always | Because personal data is kept, every kept copy stays protected: B2 copies encrypted; the archive ZIPs in an unshared Drive folder with 2FA; the USB drive kept at home. |

---

## 9. After the wedding

| When | Step |
|---|---|
| Sat 13 Feb 2027 | Wedding-day data refreshed on every phone (CONTEXT risk 5). Extra manual backup: SSH card **B1**. Monthly export done the week before. |
| 14–16 Feb | No deploys, no migrations. Backups run as normal. |
| Sun 28 Feb 2027 | **Final full export #1** (after payments settle): Settings → Export, all parts. Save to Drive `A&M Wedding / archive /` **and** to a USB drive kept at home. Open `summary.html` to check. |
| Mon 1 Mar 2027 | Family access ends (§8.1). App stays live for the two of us (thank-you notes, last payments). |
| Sun 16 May 2027 | Purge allowed from today (CONTEXT 34), but we purge nothing (answered). **Final full export #2** → Drive + USB. Also keep: the last monthly encrypted DB dump + its manifest, the last deploy ZIP, the last code ZIP, the printed backup key. |
| By Mon 31 May 2027 (proposal, not decided) | **Turn off:** remove both cron jobs; delete the UptimeRobot monitor; download `private/storage/uploads/` once more (File Manager → Compress → Download) into the archive; delete the databases and both subdomain websites. In B2: after checking the archive opens, delete the bucket. |
| Hosting plan | Paid until 2028, so there's no rush. If you turn the app off, just remove the subdomain after the archive is checked. |
| Archive check | Once a year: open the archive ZIP from Drive and from the USB drive. |

**Archive contents** (two copies: Google Drive + USB drive):

| Item | Why |
|---|---|
| `wedding-export_2027-05-16.zip` (all parts) | Everything readable without the app: CSV, JSON, `summary.html`, all documents |
| Last monthly `wedding_…sql.gz.enc` + manifest + paper key | Lets us bring the app back to life if ever wanted |
| Last deploy ZIP + last code ZIP + these docs | Same |

How long to keep the server running: **proposal: until 31 May 2027**, about 3½ months after the wedding. You skipped this question, so nothing is decided. Since hosting is paid until 2028, keeping the app running longer costs nothing extra; just keep the nightly backup and the monthly drill going while it runs.

---

## 10. If something goes wrong — one page

Print this page. Stay calm: **nothing is ever hard-deleted**, and last night's copy is safe in B2.

| You notice… | Do this first | Then | Section |
|---|---|---|---|
| "I deleted something" | Tap **Undo** (10 min) | Admin: Settings → **Deleted items → Restore** | T1 |
| "A bulk change / import went wrong" | Tap **Undo** | Imports → **Undo this import**; or §6 per record | T2 |
| "Someone changed my edit" | Read the conflict screen; pick per field | History shows both values | T3 |
| "3 changes waiting to send" won't clear | Get on Wi-Fi; tap **Send now** | Open "needs your choice" items. **Don't log out or delete the icon.** | T4 |
| A phone is lost | Admin: Members → that person → **Reset password** | Ask what they changed offline that day | T5 |
| App stuck on an old version | Close and reopen | Settings → This phone → **Fix the app** | PWA §6.4 |
| **Backup failed** email | Read the reason in the email | SSH card **S14** (§3.4) by hand. B2 401 → check key in `config.php`. `mysqldump` error → check DB password. Disk full → T14. Still failing → tell me. | §3 |
| **Backup overdue** (36 h) or Safety red | hPanel → Cron Jobs: are both jobs there? | Card **S16** (cron log); then card **S14** by hand | §3.4 |
| Safety: audit count went down | **Don't change anything.** Tell Ayush. | Possible tampering or a phpMyAdmin mistake: compare with last night's backup restored on staging (§4.2) | DATABASE R11 |
| Uptime monitor: site down | Open the site on mobile data | Hostinger status / support chat. Tell family "changes wait on your phone." | T9 |
| A wrong value saved, Undo too late | Take a backup | §6 restore from `audit_log` | §6 |
| A deploy broke the app | Upload the **previous deploy ZIP** | Fix on staging, redeploy | §5.3 |
| A migration stopped half-way | Don't re-run the file | DATABASE §6 step 6 | §5.3 |
| Can't log in to Hostinger | Use 2FA backup codes | "Forgot password" → recovery email (Mahi's) → support chat | §7 |
| Hosting/domain payment failed | Pay now in hPanel / registrar | Check auto-renew and card | §7 |
| **Hacked** (unknown login, strange changes) | Change Hostinger password + 2FA; app: **Log out all phones**; reset admin passwords | Rotate: DB password (hPanel → Databases; update `.env` and `config.php`), B2 key (new key, delete old), `SETUP_TOKEN`. Check Activity and compare with last night's backup. Backup key stays (old backups need it). | T13 |
| **Server gone** (account closed, Hostinger dead) | Don't panic: B2 has last night's DB and every file | New hosting → create DB → restore the newest dump (§4.2, into the new live DB) → download `files/` from B2 and decrypt into `uploads/` → deploy the latest deploy ZIP → new `.env` → point DNS. Tell me; I'll guide it. | §3, §4 |
| Lost the backup key | Check password manager, then the paper envelope | The server still has `backup.key`: copy it again. **Never make a new one.** | T16 |

**Phone numbers to keep on paper:** Hostinger support (chat in hPanel), registrar support, Ayush, Mahi.

---

## Changes needed in other docs

| Doc | Change |
|---|---|
| CONTEXT.md → v1.6 | Decision 20: nightly backup goes to **Backblaze B2** and includes uploaded files (S2, S5). Q2 answered by S2 (default kept). Decision 38: exception — staging holds real data during a restore drill or migration rehearsal, then demo data is reloaded the same day (S3). Note: guest data kept after the wedding, nothing anonymised (S7). |
| DATABASE.md | §6 step 2: the "second database" is the staging DB; reload demo data afterwards (S3). Note `row_counts_json._files` (S6). |
| API.md v1.2 (optional) | §11: backup check amber when `_files.missing_on_disk > 0` or the run has warnings. |
| PWA.md | §7.6 cron table: nightly backup `47 20 * * *` UTC (2:17 AM IST) and watchdog `23 */6 * * *`; every cron path becomes `domains/wedding.lumorrahouse.com/private/…` (staging: `domains/staging-wedding.lumorrahouse.com/private/…`). §11: staging may hold real data during a drill; staging cron paused then. |
| TESTING.md | §1.2.1 and §8.2 step 7: paths `domains/wedding.lumorrahouse.com/private/…`, commands as cards B1/B2. §8.1: ZIP names `project-source-sessionNN.zip`, `deploy-sessionNN.zip`. |
| CONTEXT.md → v1.6 (also) | §8 Conventions: separate website folders for live and staging; code history in a private GitHub repo. |

---

## To verify on Hostinger (I couldn't check these from here)

| # | Item | Expected | How |
|---|---|---|---|
| H1 | `exec()` allowed for PHP from cron | Yes on Business plans | Card S14 runs at all |
| H2 | `mysqldump`, `openssl`, `gzip`, `bash` present | Yes | Cards S6, S7 |
| H3 | PHP CLI path | `/usr/bin/php` | Card S4 |
| H4 | Server timezone | UTC | Cards S8, S9 |
| H5 | Alert from `planner@` (SMTP) reaches Gmail inbox | Yes, maybe spam at first | Card S13 |
| H9 | Live and staging site folders | `domains/wedding.lumorrahouse.com/`, `domains/staging-wedding.lumorrahouse.com/` | Card S10 |
| H6 | phpMyAdmin import size limit | Enough for a few MB `.sql.gz` | Drill step 4; SSH fallback given |
| H7 | B2 screens: Object Lock + Governance, lifecycle "days till delete", key restricted to one bucket | As in §3.2 | While creating the bucket |
| H8 | hPanel account sharing for Mahi | Exists | hPanel menu |

---

## Open Questions

**Answered 8 Oct (v1.2):** alert addresses (your two Gmails, typed into `config.php` by you) · GitHub (yes) · separate website folders (yes) · SSH as command cards (yes).

**Still open:**

1. **Staging cron:** confirm it's fine to pause staging's cron jobs for about an hour during each drill (§4.1).
2. **Server clock:** after card S9 on Hostinger, tell me "UTC" or "IST" so I can fix one set of cron times in this document and PWA.md.
