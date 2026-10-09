# CONTEXT.md — Ayush & Mahi Wedding Planner

Version 1.5 · 8 Oct 2026 · Owner: Ayush Porwal · v1.1 adds the owner's answers (§4 decisions 18–22) · v1.2 adds the database answers (decisions 23–27, §8 columns) · v1.3 adds the API answers (decisions 28–35, subdomain) · v1.4 adds the PWA answers (decision 7 rewritten, decisions 36–38; `PWA.md`) · v1.5 adds the PWA answers (decisions 6, 22, 37 updated; 39)
Single source of truth. Overrides `Wedding_Planner_App_Specification.docx` where they differ.

## 1. Summary

We are building a private, installable web app (PWA) to plan one wedding: Ayush Porwal and Mahi Jagetiya, Bhilwara, 14–16 Feb 2027. The couple and family use it on Android and iPhone to manage tasks, events, about 1,800 guests and their RSVPs, budget and payments, and documents. All of Release 1 goes live in one launch, target Sun 25 Oct 2026. Until then the guest list is collected in our Excel template. Nothing we enter may ever be lost.

## 2. Hard constraints

| Area | Constraint |
|---|---|
| Stack | PHP 8.2+ REST API (JSON), **MySQL 8.0.16+**, React + Vite + Tailwind, PWA |
| Hosting | Hostinger **Business** shared plan (50 GB disk, 3 GB per database), subdomain **`wedding.lumorrahouse.com`**, HTTPS only |
| Scope | One wedding. No multi-tenant, subscription or planner features |
| Devices | Android (Chrome) and iPhone (Safari, Home Screen) equally. No Android-only features |
| Data | Zero data loss: versioned writes, soft delete + undo, audit log, off-site backups, full export |
| Paid services | ≈ ₹0. Only what the Hostinger plan includes, plus free tiers |
| Accessibility | Tap targets ≥ 48 px, base text ≥ 17 px, plain words, English UI first |
| Native | Capacitor optional, only after the PWA is stable |

## 3. Users and devices

| User type | Who | Can do | Phone | Language | Comfort |
|---|---|---|---|---|---|
| Admin | Ayush, Mahi | Everything, incl. users, budget, trash, export | TBD | English | 5/5 (assumed) |
| Family editor | Parents, siblings, relatives doing work | Add and edit tasks, events, guests, documents | Android + iPhone mix (count TBD) | English + Hinglish | 3/5 |
| Family viewer | Elders who only check plans | Read only | TBD | Hinglish | ≤ 3/5 |
| Guests | ~1,800 invitees | No login. Get wa.me messages only | — | — | — |

Design for the 3/5 user: one main action per screen, words beside icons.

## 4. Key decisions

| # | Decision | Reason |
|---|---|---|
| 1 | Single-wedding app. No `weddings` or `wedding_members` tables; wedding facts live in one `settings` table. | Removes a whole class of code and access bugs. |
| 2 | MVP = tasks, calendar/events, guests + RSVP, budget + payments, documents, dashboard. Everything else is later or a note/tag. | Smallest set that runs the wedding. |
| 3 | Vendors are a light contact record (name, category, phone, notes), linked to payments. | Payments and wedding-day contacts need a payee. Full vendor module is later. |
| 4 | Guests are stored as households ("Families") with adult/child headcounts. Member names optional. | 1,800 people ≈ a few hundred invitations; invites go per family. |
| 5 | RSVP is per household per event, entered by family members. | Mayra or Haldi lists differ from Reception. No guest portal. |
| 6 | iOS is first-class: in-app Install Guide for iPhone and Android. **Android has our own install prompt** (banner + Install button that opens Chrome's install dialog). iPhone: one-time illustrated guide. Web Push only after install on iOS 16.4+; no Background Sync. | Safari has no install prompt or Background Sync. Owner's answer on Android. |
| 7 | **Limited outbox (v1.4).** Every small save goes through an outbox on the phone. Offline, only these can wait: tick a task, add/edit a task, checklist items, add/edit a family, set Coming?. Deletes, undo, bulk, import, money, events, settings, members and uploads need internet. An entry leaves the outbox only on a 2xx reply or when the user taps Discard. No Background Sync. | Owner's answer. A save that drops on a weak network is never lost; the risky actions stay online-only. |
| 8 | Data safety in v1: `version` column on every editable table, 409 on stale write; soft delete + Undo toast + Trash; audit log of every change; nightly off-site backup; monthly restore drill; one-tap full export (JSON + CSV + files ZIP). | Hard requirement. Must exist before real data goes in. |
| 9 | Every create carries a client UUID (idempotency key). Since v1.3: every write carries a key (decision 30). | Retries on weak networks never create duplicates. |
| 10 | Reminders: Hostinger cron every 15 min → Web Push, email fallback. Dashboard shows "Last reminder run"; red if older than 30 min. | Silent failure is worse than no reminders. |
| 11 | Wedding-day mode: timeline, vendor contacts, guest/room lists cached offline and printable via browser print-to-PDF. | Venue networks fail; paper does not. |
| 12 | WhatsApp via `wa.me` share links only. No API. | Free, no approval, works on both phones. |
| 13 | Photos compressed on device (max 1600 px, JPEG ~80%) before upload. Full galleries stay as external links. | Shared hosting storage and upload limits. |
| 14 | Login: phone number + password set by an admin, or by the member from a one-time invite link (decision 29); 90-day session cookie; no self sign-up. | Simple for elders; data stays private. |
| 15 | PDFs via print stylesheet, not a server PDF library. | Works on both phones, zero dependencies. |
| 16 | Task statuses cut to To do, Doing, Waiting, Done, Cancelled. "Postpone" = change due date, history kept. Priority: Urgent, Normal, Low. | Fewer choices for 3/5 users. |
| 17 | Capacitor only after the PWA is stable. | Not needed to run the wedding. |
| 18 | One launch: complete Release 1 (no Day-1 slice). | Owner's choice. |
| 19 | Guest import accepts Excel (.xlsx) and CSV; the app offers a downloadable template with dropdowns and per-event Yes/No columns. | Owners will prepare the list in Excel. |
| 20 | Backups in three layers: Hostinger daily (kept 7 days); our nightly encrypted DB dump sent off Hostinger; monthly full export kept by the couple. | Hostinger copies alone don't survive an account problem. |
| 21 | UI feels like WhatsApp: list rows, + bottom-right, long-press to select (plus a visible Select button), clock → tick for saving. Minimal and easy to read. | Every user already knows WhatsApp. |
| 22 | App name "A&M Wedding". Ivory look. Theme follows the phone (light/dark). Wedding-day overrides: admins only. **App icon: Apple style, no logo** — ivory "A&M" on a maroon gradient, marigold "&". | Owner's answers. |
| 23 | Events: Engagement, Haldi, Mehndi, Sangeet, Mayra, Wedding, Reception. No separate Roka (Engagement covers it). | Owner's answer. |
| 24 | Mayra is one event, groom side only. | Owner's answer. |
| 25 | Only veg food is served. Family food options: Veg, Jain, Mixed (veg family with some Jain members). No Non-veg. | Owner's answer. |
| 26 | Database: MySQL 8.0.16+. Schema changes only through numbered migration files (`001_init.sql`, `002_…`) run by the owner in phpMyAdmin; an applied file is never edited. No triggers or stored procedures. | Shared hosting; logic stays in PHP where it can be debugged. |
| 27 | Audit log is append-only by code. Each nightly backup records its row count and highest id; Home → Safety turns red if either drops. | Triggers aren't allowed, so deletions must at least be detected and recoverable. |
| 28 | Subdomain: `wedding.lumorrahouse.com`. | Plain, easy to say on the phone, no `&`. Owner left it to me. |
| 29 | Admin can invite a member with a one-time "set your password" link shared on WhatsApp (72 h). "Forgot password" by email is built but off at launch; admins reset passwords. | No password sent in chat; no mailbox needed yet. |
| 30 | Every write (create, edit, delete, undo, mark paid) sends an `Idempotency-Key`; replies are kept 48 h. | A retry after a network drop never duplicates, never shows a false conflict, never says "already deleted" wrongly. |
| 31 | Family members can't import guest lists or bulk-delete families, and delete only their own tasks (created by them or assigned to them). Bulk invite / RSVP / side stay open to them. | Owner's answer. Big deletes stay with the couple. |
| 32 | PDFs open through the phone's share sheet, never inside the app and never by a public link. | An installed iPhone app has no back button inside a PDF. |
| 33 | The full-export download link carries a 24-hour token for that export only. | Downloads from the installed iPhone app may lose the app's cookie. |
| 34 | Purge endpoint exists but refuses every call until 16 May 2027. | Contract stays stable; nothing is hard-deleted before then. |
| 35 | A free external uptime monitor calls `/api/v1/health` every 5 min; it sees only "ok" or "fail". | Silent outages or missed backups reach the couple by email. |
| 36 | App updates are never automatic: "New version available. Tap to refresh." Never while a form has unsaved typing. Settings → This phone → **Fix the app** clears app files but keeps waiting changes. | No surprise reloads; a stuck version is fixable by phone call. |
| 37 | Each member sets reminders on/off per phone and email fallback. **No quiet hours**; reminders are scheduled for daytime (9 AM IST, to confirm). Test button sends at once. | Owner's answer; failures are visible. |
| 38 | All phone testing on an HTTPS staging subdomain with its own database and demo data. | Install, offline and push need HTTPS; real guest data stays out of tests. |
| 39 | Supported phones: made 2020 or later. iPhone SE (2nd gen) / iPhone 12 and newer on iOS 17+ (all can run iOS 26); Android 10+ with current Chrome. Older phones: not supported. | Owner's answer. Every supported iPhone can get reminders once updated. |
| 40 | Screens say "Coming?" and "Remind on WhatsApp", never "RSVP" (plain words, DESIGN §8). WhatsApp Hinglish texts are Hindi in Roman letters until Open Question 7 is answered. | Session 8. Elders read Roman Hinglish on WhatsApp more often than English. |

## 5. Out of scope for v1

- Multi-wedding, subscriptions, planner accounts, permissions beyond the three roles
- Guest logins, self-service RSVP portal, QR check-in
- WhatsApp API, SMS, payment gateway, email invitations
- AI assistant and smart recommendations
- Full vendor module (quotes, comparison, contracts workflow), venue comparison, catering
- Shopping, outfits, jewelry (use tasks + tags)
- Accommodation and transport modules (hotel/room are fields on a household; transport is tasks/notes)
- Seating charts, photo albums, moodboards
- Drag-and-drop calendar, comment threads, global search, real-time updates
- Offline editing beyond the limited outbox (decision 7)
- Hindi/Hinglish UI, Capacitor/APK

## 6. Glossary

| Term | UI label | Meaning |
|---|---|---|
| Roka | Roka | Families formally accept the match |
| Engagement | Engagement (Sagai) | Ring ceremony |
| Haldi | Haldi | Turmeric ritual |
| Mehndi | Mehndi | Henna ceremony |
| Sangeet | Sangeet | Music and dance night |
| Mayra | Mayra (Bhaat) | Mother's brothers' family brings gifts and clothes; Rajasthani custom |
| Wedding | Wedding (Phere) | Main ceremony. Baraat is a timeline item inside it |
| Reception | Reception | Post-wedding party |
| Side | Side: Bride / Groom / Both | Which family invited the guest. Bride = Mahi, Groom = Ayush |
| Household | Family | One invitation unit with headcount |
| RSVP | Coming? | Not asked yet / Waiting / Coming / Not coming |
| Vendor | Vendor | Supplier contact |
| Payment | Payment | Money due or paid to a vendor |
| Expense | Expense | Money spent without a vendor schedule |
| Trash | Deleted items | Soft-deleted records; restorable |

## 7. Risks (ranked by impact)

| # | Risk | Mitigation |
|---|---|---|
| 1 | One big launch is later and riskier than slices. | All data safety ships in the launch. Excel template collects guests meanwhile. Keep the shared sheet until 2 clean weeks after launch. |
| 2 | Data loss: bad delete, overwrite, hosting failure. | Decision 8; export before every deploy; monthly restore drill logged in the app. |
| 3 | Elders can't install or use it, esp. on iPhone. | Install Guide with screenshots; in-person setup; works in the browser too. |
| 4 | Reminders fail silently (cron stops, iOS push not allowed, email in spam). | Health indicator; email fallback; "Send test reminder" button; send from a domain mailbox with SPF/DKIM. |
| 5 | Poor network at venues; iOS clears cache of uninstalled sites. | Wedding-day data refreshed on 13 Feb; use installed app; printed copies. |
| 6 | Privacy of ~1,800 guest phone numbers. | Login on every endpoint; viewer role; `noindex`; uploads outside `public_html`; no public links. |
| 7 | Shared hosting limits (storage, upload size, PHP timeouts). | On-device compression; external galleries; streamed export; confirm plan limits now. |
| 8 | Scope creep from a 30-module spec. | Section 5; new ideas go on a "Later" list. |
| 9 | Two people edit the same record. | 409 response; screen shows "Someone changed this" with their values and a Reload button. |

## 8. Conventions

| Item | Rule |
|---|---|
| DB names | `snake_case`; plural tables (`households`, `payments`); PK `id`; FK `<singular>_id` |
| JS names | `camelCase` variables/functions, `PascalCase` components |
| API JSON | `snake_case` keys (same as DB); converted to camelCase in one frontend API client |
| Standard columns | `id`, `client_uuid`, `version`, `created_at`, `created_by`, `updated_at`, `updated_by`, `deleted_at`, `deleted_by`, `delete_batch_id` on every editable table; plus `public_id` on anything shown in a URL. `settings` (one row, never deleted) has no `deleted_*`. |
| IDs | `BIGINT UNSIGNED AUTO_INCREMENT` internally (never in URLs); `public_id CHAR(26)` ULID in URLs and the API; `client_uuid CHAR(36) UNIQUE` for idempotent creates |
| Date-times | `DATETIME` in UTC; API uses ISO 8601 with `Z`; UI always shows Asia/Kolkata (IST), whatever the phone's timezone |
| Date-only | `DATE` with no timezone (e.g. due dates) |
| Money | `BIGINT` paise. Never floats. Display `₹1,25,000` (Indian grouping) |
| Phones | E.164 (`+919876543210`); `wa.me` uses digits only |
| Charset | `utf8mb4` / `utf8mb4_unicode_ci` everywhere (Hindi, emoji) |
| Database design | `DATABASE.md` (tables, rules for PHP, migrations) |
| API paths | `/api/v1/<resource>`; reply `{ok, data, meta}` or `{ok:false, error:{code, message, fields}, meta}`. Full contract: `API.md` |
| Uploads | Outside `public_html` (`STORAGE_ROOT/uploads/YYYY/MM/<uuid>.<ext>`, deny-all `.htaccess`); original name in DB; served only by `GET /api/v1/documents/{id}/file` (`private, no-store`). Photos shrunk on the phone (1,600 px JPEG, EXIF gone); max 10 MB; PHP `upload_max_filesize` 12M / `post_max_size` 16M set in hPanel. Staging ships demo files for the demo seed (`tools/make-demo-files.py`), live never |
| Backups | `wedding_YYYYMMDD_HHMM.sql.gz.enc` |
| Exports | `wedding-export_YYYY-MM-DD.zip` (parts 2…n: `_files-partN.zip` above 200 MB). Snapshot folder `STORAGE_ROOT/exports/<id>/`, ZIP built while it downloads by our own `ZipWriter` (no third-party PHP packages on the server). Link valid 24 h (session or `?t=` token). No passwords or login keys inside. Restore: `private/app/tools/restore-from-export.php` (DATA-SAFETY §2.1) |
| Secrets | `.env` outside web root; never in Git or frontend |

## 9. Open Questions

1. ~~Subdomain~~ — answered: `wedding.lumorrahouse.com` (decision 28). Please create it in hPanel and turn on its free SSL.
2. **Off-site backup:** which Gmail (or Google Drive) account receives the nightly encrypted copy?
3. ~~Logo~~ — answered: no logo; Apple-style icon (decision 22). Draft icons in `PWA.md` §2.2.
4. ~~Phones~~ — answered: made 2020 or later (decision 39).
10. **PWA.md Open Questions 1–3:** icon draft OK? minimum iOS 17 or latest only? reminders at 9 AM IST?
5. **Events:** date, time and venue of each. (Roka and Mayra answered: decisions 23–24.)
6. **Login:** password or 4–6 digit PIN for elders?
7. **Language:** "Hinglish" = Hindi in Roman letters, or Devanagari? (Until answered: Roman letters, decision 40.)
8. **Total budget:** a figure now, or blank?
9. **Rooms:** hotel list. (`planner@lumorrahouse.com` approved 8 Oct; member emails added by admins later.)
