# API.md — REST contract (React PWA ↔ PHP API)

Version 1.1 · 8 Oct 2026 · Owner: Ayush Porwal · v1.1 applies the owner's answers (§13) and migration `003\_api\_support.sql`
Reads from: `CONTEXT.md` v1.2 (source of truth), `FEATURES.md` v1.1, `DATABASE.md` v1.1, `001\_init.sql`, `002\_open\_answers.sql`.
Release: everything here is Release 1 unless it says **Later** or **R2a**.

## Conflicts flagged

All were answered on 8 Oct 2026 (§13). The right-hand column is now the decision.

|#|Topic|Sources say|This contract does|
|-|-|-|-|
|API1|Password reset by email|CONTEXT 14 + FEATURES B1: admin resets the password and shares it on WhatsApp. No email in R1. `users.email` is "later". Sending mailbox not chosen (CONTEXT Q9).|**Answered: off at launch.** Admin reset is the only path. Email reset is built but switched off (`MAIL\_ENABLED=false`); it turns on later with no code change.|
|API2|Invite by link|FEATURES B1: admin types a password and shares it.|**Answered: yes.** Admin can share a one-time "set your password" link on WhatsApp, valid 72 hours. Uses `password\_resets` (`method = 'link'`). Typing a password still works.|
|API3|"Refresh" endpoint|CONTEXT 14: one 90-day session cookie.|No access/refresh token pair. `GET /api/v1/session` **is** the refresh: it slides the 90 days and returns the CSRF token. Reason in §3.6.|
|API4|Idempotency scope|Brief: every create. CONTEXT 9: every create. DATABASE: `idempotency\_keys` covers all writes.|**Answered: only where needed — and it is needed on every write.** Create: a retry would make a duplicate. Edit: a retry would show the conflict screen against the user's own change. Delete, undo, mark paid: a retry would wrongly say "already deleted / already paid". So every POST, PUT, PATCH and DELETE sends `Idempotency-Key`.|
|API5|Rate-limit storage|DATABASE has only `login\_attempts`.|**Answered: yes.** Migration `003\_api\_support.sql` adds `rate\_limits` (§10.2). Written and tested on MySQL 8.0.46 and MariaDB 10.11.|
|API6|Export shape|Brief: endpoint streams a ZIP. FEATURES B8: built on request, 24 h link, split > 200 MB.|**Both, with a download token (answered: yes).** `POST /exports` takes a consistent snapshot. `GET /exports/{id}/download` streams the ZIP. The link carries a 24-hour token so it works from the installed iPhone app.|
|API7|Purge|Brief: purge endpoint. FEATURES B9: no permanent delete in R1; purge only after 16 May 2027.|**Answered: keep the endpoint as defined.** It refuses every call before 16 May 2027 (`purge\_not\_allowed\_yet`).|
|API8|Disk space in health|Brief: disk space.|PHP's `disk\_free\_space()` reports the server's disk, not our plan. Health reports **our usage against the plan: 50 GB disk, 3 GB database** (confirmed same as the public plan page).|
|API9|Upload size|FEATURES B7 / DB CHECK: 10 MB. Hostinger allows far more (§8.1, confirmed).|Keep **10 MB per file**. PHP set to 12 MB upload / 16 MB post.|
|API10|Food values|FEATURES A8/A9/B5 listed Non-veg.|API accepts `veg`, `jain`, `mixed` only. **FEATURES v1.2 now matches** (answered: yes).|
|API11|Checklist items in URLs|DATABASE: `task\_items` has no `public\_id`. Numeric IDs are never in URLs.|Items are addressed by their `client\_uuid` (called `key`). PHP always fills it; `003` gives any old row one.|
|API12|Version location|Brief: If-Match header **or** body.|**Header only** (`If-Match: "7"`). One place, one rule. A `version` in the body is ignored. Bulk actions use `as\_of` (DATABASE rule 10).|
|API13|Family powers|FEATURES Q10, Q11 were open.|**Answered: no.** Only admins import guest lists and bulk-delete families. Family deletes only their own tasks (created by them or assigned to them).|
|API14|Subdomain|CONTEXT Q1: owners set it, any name works.|**Answered: my choice.** `wedding.lumorrahouse.com`: plain, easy to say on the phone, no `\&`.|

\---

## 1\. Conventions

### 1.1 Basics

|Item|Rule|
|-|-|
|Base path|`https://wedding.lumorrahouse.com/api/v1` (from `APP\_URL` in `.env`). Same origin as the PWA. No CORS.|
|Format|JSON only, UTF-8. Requests with a body send `Content-Type: application/json`. Exceptions: file upload (`multipart/form-data`), file and ZIP downloads, guest CSV.|
|Keys|`snake\_case`, same as the DB. The frontend API client converts to camelCase in one place (CONTEXT §8).|
|IDs|`id` in JSON and `{id}` in URLs is always the record's `public\_id` (26-char ULID). Numeric IDs never leave the server. Invitations are addressed by family + event. Checklist items by `key`.|
|Links to other records|An object, not a bare ID: `{"id": "01J…", "name": "Mehndi", "deleted": false}`. A deleted link keeps its name and has `"deleted": true` (FEATURES A0). A member who left has `"left": true`.|
|Date-time|ISO 8601 UTC with `Z`, seconds precision: `2027-02-14T12:30:00Z`. The server refuses other offsets (422). The UI converts to IST.|
|Date only|`YYYY-MM-DD`, an IST calendar date, no zone (`due\_date`, `paid\_on`, `access\_ends\_on`).|
|Time only|`HH:MM`, IST wall clock (`due\_time`).|
|Money|Integer **paise** in fields ending `\_paise`. `125000` rupees = `12500000`. Never floats, never strings. Max per payment 10 crore = `1000000000`.|
|Phones|E.164 string (`+919829012345`). The client normalises (FEATURES A9). The server normalises again and validates.|
|Booleans|`true` / `false` (DB stores 0/1).|
|Empty values|`null`, never `""`. The server turns `""` into `null` for optional text.|
|Enums|Exactly the DB values: `todo`, `not\_coming`, `tent\_decor`… The UI maps them to labels.|
|Text|Trimmed by the server. Lengths count characters, not bytes. Devanagari and emoji are fine.|
|Standard fields on every record|`id`, `version`, `created\_at`, `created\_by`, `updated\_at`, `updated\_by`. `client\_uuid` and `deleted\_\*` are not returned, except in Trash and Sync.|

### 1.2 Request headers

|Header|When|Example|
|-|-|-|
|`X-CSRF-Token`|Every write while logged in|`Rk9P…` (from `GET /session`)|
|`Idempotency-Key`|Every write while logged in (§5)|`3b2f7c1e-8f8a-4d55-9a2e-1c0b6f1d9a77`|
|`If-Match`|Every PATCH, PUT on an existing record, and DELETE of a single record (§4)|`"3"`|
|`X-Client-Version`|Every request|`1.0.7` (build number baked into the PWA)|
|`X-Device`|Every request|`iPhone · installed` / `Android · browser`. Shown in History and sessions. Max 60 chars.|

### 1.3 Response headers

|Header|When|
|-|-|
|`ETag: "4"`|Every single-record GET and every successful write of one record. Value = new `version`.|
|`X-Request-Id`|Every response. Same as `request\_id` in the body. Quote it when reporting a problem.|
|`X-Min-Client-Version`|Every response. If the PWA is older, it shows "Please close and reopen the app". Writes from older clients get `426 update\_required`.|
|`Idempotent-Replayed: true`|A stored reply was returned for a retried write (§5).|
|`Retry-After`|With 429, 503 and `409 request\_in\_progress`.|

### 1.4 Lists: pagination, filtering, sorting

**Cursor pagination** on every long list. Reason: families are added while someone scrolls. With page numbers, "Load more" would then show a family twice or skip one. A cursor continues from the last row seen.

|Param|Rule|
|-|-|
|`limit`|Default 50 (FEATURES A0). Documents default 30. Max 200.|
|`cursor`|Opaque string from the previous `meta.next\_cursor`. It encodes the sort values and `id` of the last row, and a hash of the filters. Changing a filter with an old cursor gives `400 bad\_cursor` ("This list changed. Pull down to refresh.").|
|`meta.total`|Count of all rows matching the filter (for "512 families").|
|`meta.totals`|Module sums for the filter: `people` for guests, `amount\_paise` for payments, etc.|
|Short lists|Members, events, tags, categories, backups: not paged. Whole list in one reply.|

**Filters** are plain query params, listed per endpoint in §6.

|Rule|Example|
|-|-|
|One value|`side=groom`|
|Several values (OR)|`rsvp=coming,waiting`|
|Booleans|`vip=true`|
|Dates|`from=2026-10-01\&to=2026-10-31` (IST dates, inclusive)|
|Search|`q=sharma`. Min 2 characters. Case-insensitive "contains". For families also matches phone digits, group and area.|
|Unknown param|`400 bad\_request`. Catches typos that would silently show the wrong list.|

**Sorting:** `sort=<field>`; prefix `-` for descending: `sort=-created\_at`. Only the fields listed per endpoint. `id` is always the final tie-breaker, so the order is stable. Each list has a default sort from FEATURES (for tasks: overdue first, then due date, no date last, then priority, then newest).

### 1.5 Roles in this document

|Short|Who|
|-|-|
|**All**|Owner, Partner, Family, Viewer|
|**Ed**|Editors: Owner, Partner, Family|
|**Adm**|Admins: Owner, Partner|
|**Own**|Owner only|
|**$**|Any user with *Can see money* on (always Owner and Partner)|
|**Self**|The logged-in user, about their own account|

The server decides every permission and strips fields a user may not see. The UI only hides (FEATURES A0).

**Money fields** removed for non-money users: `vendors.agreed\_amount\_paise` and vendor balances, all of `payments` and `budget\_categories`, `settings.total\_budget\_paise`, the Payments and Budget dashboard cards, payment items in the calendar, payment-linked documents, and money fields inside History.

\---

## 2\. Response envelope and errors

### 2.1 Success

```json
{
  "ok": true,
  "data": { "id": "01JA7Q3M2K8V5R1T9W4X6Y0Z2B", "version": 4, "name": "Ramesh Sharma \& family" },
  "meta": {
    "request\_id": "r\_8f2c41d07a",
    "server\_time": "2026-10-08T09:12:31Z"
  }
}
```

A list puts an array in `data` and adds paging to `meta`:

```json
{
  "ok": true,
  "data": \[ { "id": "01JA…", "name": "…" } ],
  "meta": {
    "request\_id": "r\_0b19aa3e55",
    "server\_time": "2026-10-08T09:12:31Z",
    "total": 512,
    "totals": { "people": 1804 },
    "next\_cursor": "eyJuIjoiU2hhcm1hIiwiaSI6Ij…",
    "has\_more": true
  }
}
```

A write that can be undone adds `meta.undo`:

```json
"undo": { "batch\_id": "01JA7R0C4N2Q8M5T1V3W9X7Y6Z", "until": "2026-10-08T09:22:31Z", "summary": "Deleted 'Book tent wala'" }
```

`until` is when the server stops accepting `POST /undo/{batch\_id}` (10 min, FEATURES A2). The snackbar itself shows for 8 s.

Status codes for success: `200` read or update, `201` created, `202` accepted (email reset request). There is no `204`; every reply has the envelope.

### 2.2 Error

```json
{
  "ok": false,
  "error": {
    "code": "validation\_failed",
    "message": "Please fix 2 things below.",
    "fields": {
      "phone": "Enter a 10-digit mobile number.",
      "adults": "Adults and children together must be at least 1."
    }
  },
  "meta": { "request\_id": "r\_51d9e0c2aa", "server\_time": "2026-10-08T09:12:31Z" }
}
```

Rules for every error:

* `message` is plain English, safe to show as is. It never contains SQL, file paths, stack traces, numeric IDs or another person's password.
* `code` is stable. The UI may choose its own text by `code` (and will, for Hindi later).
* `fields` keys use dotted paths for nested input: `items.2.text`, `rows.14.phone`.
* Details go to the PHP error log with the `request\_id`, never to the client.
* Some codes add extra keys inside `error` (shown below).

### 2.3 Status codes and examples

|HTTP|`code`|`message` (shown to user)|Extra keys|
|-|-|-|-|
|400|`bad\_request`|Something in the request was wrong. Please close and reopen the app.|—|
|400|`bad\_cursor`|This list changed. Pull down to refresh.|—|
|401|`not\_logged\_in`|Please log in again.|—|
|401|`session\_ended`|You were logged out. Please log in again.|`reason`: `password\_reset`, `deactivated`, `access\_ended`, `logout\_all`|
|401|`login\_failed`|Phone or password is wrong.|—|
|403|`forbidden`|You don't have permission to do this.|—|
|403|`csrf\_failed`|Please refresh the app and try again.|—|
|403|`no\_money\_access`|You no longer have access to Money.|—|
|403|`access\_ended`|Your access has ended. Ask Ayush or Mahi.|—|
|403|`undo\_expired`|Too late to undo here. Ask Ayush or Mahi to restore it from Deleted items.|—|
|403|`purge\_not\_allowed\_yet`|Deleted items can't be removed for good before 16 May 2027.|—|
|404|`not\_found`|This item doesn't exist or was removed.|—|
|409|`version\_conflict`|{Name} changed this at {time} while you were editing.|`current`, `changed\_by`, `changed\_at`, `changed\_fields` (§4)|
|409|`record\_deleted`|{Name} deleted this at {time}.|`deleted\_by`, `deleted\_at`, `can\_restore`|
|409|`duplicate\_found`|Already on the list: Ramesh Sharma \& family.|`matches` (§6)|
|409|`request\_in\_progress`|Still saving your last change. Please wait a moment.|—|
|410|`link\_invalid`|This link has expired or was already used. Ask Ayush or Mahi for a new one.|—|
|410|`export\_expired`|This export has expired. Please make a new one.|—|
|413|`file\_too\_big`|This file is too big (14 MB). Max 10 MB.|`max\_bytes`|
|415|`file\_type\_not\_allowed`|Only photos (JPEG, PNG, WebP) and PDFs can be saved.|—|
|422|`validation\_failed`|Please fix {n} things below.|`fields`|
|422|`rule\_blocked`|Plain sentence, e.g. "Move 4 payments to another category first."|`rule`, plus rule data (e.g. `payment\_count`)|
|422|`checksum\_mismatch`|The file didn't arrive complete. Please try again.|—|
|422|`idempotency\_key\_reused`|This save doesn't match the first try. Please try again.|—|
|426|`update\_required`|Please close and reopen the app to get the latest version.|—|
|428|`version\_required`|Please refresh and try again.|—|
|428|`idempotency\_key\_required`|Please refresh and try again.|—|
|429|`rate\_limited`|Too many tries. Please wait {n} minutes.|`retry\_after\_seconds`|
|429|`login\_locked`|Too many tries. Wait 15 minutes or ask Ayush or Mahi to reset your password.|`retry\_after\_seconds`|
|500|`server\_error`|Something went wrong on our side. Nothing was saved. Please try again.|—|
|503|`app\_updating`|The app is being updated. Please try again in a few minutes.|— (DATABASE rule 14)|
|503|`service\_unavailable`|The server is busy. Please try again in a minute.|—|

"Nothing was saved" on 500 is true because every write is one DB transaction (DATABASE rule 4). The client adds "Your changes are kept on this phone" because it keeps the draft (FEATURES A3).

**401 example**

```json
{ "ok": false,
  "error": { "code": "session\_ended", "message": "You were logged out. Please log in again.", "reason": "password\_reset" },
  "meta": { "request\_id": "r\_a1", "server\_time": "2026-10-08T09:12:31Z" } }
```

**403 example** (Mummy, money off, calls `GET /payments`)

```json
{ "ok": false,
  "error": { "code": "no\_money\_access", "message": "You no longer have access to Money." },
  "meta": { "request\_id": "r\_a2", "server\_time": "2026-10-08T09:12:31Z" } }
```

**404 example**

```json
{ "ok": false,
  "error": { "code": "not\_found", "message": "This item doesn't exist or was removed." },
  "meta": { "request\_id": "r\_a3", "server\_time": "2026-10-08T09:12:31Z" } }
```

**409 example**: see §4.3.

**422 business rule example** (delete a category that still has payments)

```json
{ "ok": false,
  "error": { "code": "rule\_blocked", "rule": "category\_has\_payments",
             "message": "Move 4 payments to another category first.", "payment\_count": 4 },
  "meta": { "request\_id": "r\_a4", "server\_time": "2026-10-08T09:12:31Z" } }
```

**429 example**

```json
{ "ok": false,
  "error": { "code": "login\_locked", "retry\_after\_seconds": 840,
             "message": "Too many tries. Wait 15 minutes or ask Ayush or Mahi to reset your password." },
  "meta": { "request\_id": "r\_a5", "server\_time": "2026-10-08T09:12:31Z" } }
```

**500 example**

```json
{ "ok": false,
  "error": { "code": "server\_error", "message": "Something went wrong on our side. Nothing was saved. Please try again." },
  "meta": { "request\_id": "r\_a6", "server\_time": "2026-10-08T09:12:31Z" } }
```

### 2.4 How the client reacts (FEATURES A3)

|Response|Form|Shown|
|-|-|-|
|Network error / 15 s timeout|Stays, draft kept|"Couldn't save. Your changes are kept on this phone. \[Try again]" — retry with the **same** `Idempotency-Key`|
|2xx|Closes, draft cleared|"Saved ✓ 10:42" (IST)|
|401|Stays|Login sheet over the form, then one automatic retry with the same key|
|409 `version\_conflict` / `record\_deleted`|Stays|Conflict screen (FEATURES A4)|
|409 `duplicate\_found`|Stays|Duplicate modal; "Add anyway" resends with `allow\_duplicate: true`|
|422|Stays|"Please fix 2 things below." + inline field errors|
|426|Stays|Reload prompt; draft kept|
|5xx|Stays|"Something went wrong on our side. Your changes are kept. \[Try again]"|

\---

## 3\. Authentication and sessions

### 3.1 Session strategy

|Item|Rule|
|-|-|
|Cookie|`\_\_Host-am\_session=<32 random bytes, base64url>`|
|Attributes|`HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=7776000` (90 days). No `Domain` (the `\_\_Host-` prefix forbids it, so the cookie is locked to this exact subdomain).|
|Stored|Only the SHA-256 of the cookie value, in `sessions.token\_hash`. A DB leak can't be replayed.|
|Sliding|Each request moves `expires\_at` to now + 90 days. `last\_used\_at` and the re-sent `Set-Cookie` are updated at most once per hour (bookkeeping write, DATABASE rule 11).|
|CSRF token|32 random bytes per session. Hash in `sessions.csrf\_hash`. Returned in the body of login and `GET /session`. The client keeps it **in memory only** and re-fetches it with `GET /session` after a reload.|
|CSRF check|Every write while logged in must send `X-CSRF-Token`. The server also checks `Origin` (or `Sec-Fetch-Site: same-origin`) equals `APP\_URL`, and that the body is `application/json` or `multipart/form-data`. Any failure → `403 csrf\_failed` (AC-AUTH-09).|
|Revocation|Server-side: set `sessions.revoked\_at`. Takes effect on the next request (AC-AUTH-04).|
|Per-request checks|Session valid and not expired → user active → `access\_ends\_on` not passed (IST) → role and money flag read fresh from `users` (so changes apply on the next request).|
|New ID on privilege change|Login, password change and password reset always issue a **new** cookie and CSRF token.|

### 3.2 Endpoints

All paths are under `/api/v1`. Login, setup and password-link endpoints don't need CSRF or `Idempotency-Key` (no session yet); they rely on the `Origin` check and rate limits.

|Method|Path|Purpose|Who|Request|Response|Errors|
|-|-|-|-|-|-|-|
|POST|`/auth/login`|Log in|Anyone|`{phone, password}`|`200 {user, csrf\_token}` + `Set-Cookie`|401 `login\_failed`, 403 `access\_ended`, 429 `login\_locked`|
|POST|`/auth/logout`|Log out this phone|Self|—|`200 {}` + cookie cleared|—|
|POST|`/auth/logout-all`|Log out all my phones|Self|—|`200 {sessions\_revoked}` + cookie cleared|—|
|GET|`/session`|Who am I. **This is the refresh.** Slides the 90 days.|Self|—|`200 {user, permissions, csrf\_token, settings\_brief}`|401|
|POST|`/auth/password/change`|Change my password|Self|`{current\_password, new\_password}`|`200 {user, csrf\_token}` + new cookie. Other sessions revoked (AC-SET-05).|422 (wrong current, weak new)|
|POST|`/auth/password-reset/request`|Email me a reset link (**off until `MAIL\_ENABLED`**)|Anyone|`{phone}` or `{email}`|`202 {}` always, same text whether or not the account exists|429|
|POST|`/auth/password-link/inspect`|Check an invite or reset link before showing the form|Anyone|`{token}`|`200 {purpose: "invite" or "reset", name, phone\_masked, expires\_at}`|410 `link\_invalid`|
|POST|`/auth/password-link/complete`|Set a password from a link, and log in|Anyone|`{token, new\_password}`|`200 {user, csrf\_token}` + cookie. Link marked used. Other sessions revoked.|410, 422, 429|
|POST|`/setup/owner`|First run only: create the Owner|Anyone with `SETUP\_TOKEN` from `.env`|`{setup\_token, name, phone, password}`|`201 {user, csrf\_token}` + cookie|410 once an owner exists, 403 wrong token, 422|
|POST|`/members`|Add a member (invite)|Adm|see §6.2|`201 {member, password\_once?, setup\_link?}`|409 `duplicate\_found` (active phone), 422|
|POST|`/members/{id}/password-reset`|Admin reset (FEATURES B1)|Adm (Partner not on Owner)|`{mode: "set", "generate" or "link", password?}`|`200 {password\_once?}` or `{setup\_link}`. All that member's sessions revoked.|403, 404|

`user` in auth replies:

```json
{ "id": "01JA6ZK3D8M1T4V7W2X5Y9Q0R3", "name": "Sunita Porwal", "phone": "+919829012345",
  "role": "family", "can\_see\_money": false, "access\_ends\_on": null, "must\_change\_password": false }
```

`permissions` in `GET /session` (the UI shows/hides from this; the server still checks):

```json
{ "money": false, "edit": true, "admin": false, "owner": false,
  "events\_write": false, "trash": false, "export": false, "activity": false }
```

### 3.3 Login

```http
POST /api/v1/auth/login
Content-Type: application/json
Origin: https://wedding.lumorrahouse.com
X-Device: iPhone · installed

{ "phone": "098290-12345", "password": "rose-4821" }
```

```http
HTTP/1.1 200 OK
Set-Cookie: \_\_Host-am\_session=Vb3…; Max-Age=7776000; Path=/; Secure; HttpOnly; SameSite=Lax
Cache-Control: no-store

{ "ok": true,
  "data": { "user": { "id": "01JA6ZK3D8M1T4V7W2X5Y9Q0R3", "name": "Sunita Porwal", "role": "family", "can\_see\_money": false },
            "csrf\_token": "Rk9PbWx2…" },
  "meta": { "request\_id": "r\_77", "server\_time": "2026-10-08T09:12:31Z" } }
```

Rules (FEATURES B1, DATABASE `login\_attempts`):

* Phone is normalised first (A9). Wrong phone and wrong password give the same `login\_failed`, with the same timing (verify against a dummy hash when the phone is unknown).
* 5 failures for one phone in 15 min → that phone locked 15 min. 20 failures from one IP in 15 min → that IP locked. Both return `429 login\_locked`.
* Every attempt is written to `login\_attempts`; success and failure also to `audit\_log` (`login`, `login\_failed`).
* A deactivated member, or one past `access\_ends\_on`, gets `403 access\_ended` only **after** the correct password, so the message doesn't reveal which phones exist.

### 3.4 Password reset

|Path|How|Status in R1|
|-|-|-|
|**Admin reset** (main)|Admin opens the member → Reset password → types one, or **Make one** (`rose-4821`), or **Send a link**. Typed/generated password is returned once as `password\_once` for **Share on WhatsApp**.|On|
|**Self change**|Settings → My account. Needs the current password.|On|
|**Email link**|Login screen → "Forgot password?" → phone or email → link by email.|**Off at launch (answered).** `POST /auth/password-reset/request` returns `202` but sends nothing while `MAIL\_ENABLED=false`, and the UI hides the button.|

Email link rules (when switched on):

* Only for an active member with an `email`. Always the same `202` reply, so it can't be used to test which phones exist.
* Token: 32 random bytes. Only its SHA-256 is stored (`password\_resets.token\_hash`, `method = 'link'`, `reset\_by = NULL`). Valid **30 minutes**, one use. A new link cancels older unused ones.
* Link format: `https://<app>/set-password#t=<token>`. The token is in the `#fragment`, so it never reaches server logs or a `Referer` header. The page posts it to `/auth/password-link/inspect`, then `/complete`.
* Mail from the domain mailbox with SPF/DKIM (CONTEXT risk 4). App cap 30 emails/day, below Hostinger's server mail limit (100/day on current plans).

Password rules (FEATURES B1): min 6 characters, not the phone number, not in a top-100 common list. Wording: "Choose at least 6 letters or numbers. Not your phone number."

### 3.5 Invite a family member by link

Flow:

1. Admin: Settings → Members → **Add** → name, phone, role, money access → **Invite by link**.
2. `POST /members` with `"password\_mode": "link"`. The server creates the user with a random unusable password hash and `must\_change\_password = true`, and a `password\_resets` row (`method = 'link'`, `reset\_by = admin`, valid **72 hours**).
3. Reply contains `setup\_link` **once**: `https://<app>/set-password#t=…`. The UI shows **Share on WhatsApp** with: "Namaste Sunita ji, open this link to join A\&M Wedding and set your password: …".
4. Member taps it, sees "Welcome, Sunita. Choose a password." (`inspect`), sets it (`complete`) and is logged in.
5. Lost or expired link: admin taps **Send a new link** (`POST /members/{id}/password-reset` with `mode: "link"`). Older links stop working.

```http
POST /api/v1/members
X-CSRF-Token: Rk9P…
Idempotency-Key: 9d1f6a40-2c3b-4f7e-8a51-0b6c9e2d7f13

{ "name": "Sunita Porwal", "phone": "+919829012345", "role": "family",
  "can\_see\_money": false, "access\_ends\_on": null, "password\_mode": "link" }
```

```json
{ "ok": true,
  "data": { "member": { "id": "01JA6ZK3D8M1T4V7W2X5Y9Q0R3", "version": 1, "name": "Sunita Porwal", "role": "family" },
            "setup\_link": "https://wedding.lumorrahouse.com/set-password#t=q8N3…",
            "setup\_link\_expires\_at": "2026-10-11T09:12:31Z" },
  "meta": { "request\_id": "r\_90", "server\_time": "2026-10-08T09:12:31Z" } }
```

The link is a credential for 72 hours. It is stored only as a hash and can't be shown again. Secrets (`setup\_link`, `password\_once`) are **never** kept in the stored idempotent reply (§5). If the request is retried, the server makes a fresh link or password and cancels the first one, which never reached the phone.

### 3.6 Why this works on an installed iPhone PWA and on Android

|Concern|iPhone (Safari, Home Screen)|Android (Chrome, browser or installed)|
|-|-|-|
|Cookie sent with API calls?|Yes. PWA and API share one origin, so it is a first-party cookie. No cross-site rules apply.|Yes, same reason.|
|Cookie lifetime|Server-set `HttpOnly` cookie from the same host. Safari's 7-day caps apply to cookies set by JavaScript and to script storage, not to this one. Home Screen apps are also exempt from Safari's 7-day storage clean-up.|90 days; Chrome has no such caps.|
|After installing|The Home Screen app has **its own** cookie jar, separate from Safari. The user logs in once more. The Install Guide says so (FEATURES B1).|The installed app shares Chrome's cookies. Usually stays logged in.|
|Token theft by a bad script|Cookie is `HttpOnly`: scripts can't read it. Nothing secret sits in `localStorage`.|Same.|
|CSRF|`SameSite=Lax` stops other sites' POSTs carrying the cookie. The `X-CSRF-Token` header and `Origin` check stop the rest.|Same.|
|Opening from a WhatsApp link|The WhatsApp in-app browser has its own cookie jar: the user must log in there, or open in Safari / the installed app. Install Guide covers it (AC-SET-04).|Same (Chrome Custom Tab usually shares Chrome's cookies).|
|Session expires mid-form|`401` → login sheet over the form → retry with the same `Idempotency-Key` (FEATURES A0). No lost typing.|Same.|
|Platform features needed|None: no Background Sync, Credential Management, Contact Picker or push for login.|Same.|
|Why no JWT + refresh token|Tokens in JS storage can be read by any injected script and get wiped by Safari after 7 days of no use in a tab. A refresh flow adds rotation races on flaky networks. One server-side cookie is simpler and can be revoked at once (password reset, deactivation).|Same.|

\---

## 4\. Concurrency: version-checked writes

### 4.1 Rules

|Rule|Detail|
|-|-|
|Read|Every single-record GET returns `version` in the body and `ETag: "<version>"`.|
|Write|Every `PATCH`, every `PUT` on an existing record, and every single-record `DELETE` sends `If-Match: "<version I loaded>"`. Missing → `428 version\_required`.|
|Only changed fields|PATCH bodies hold only the fields the user changed. The server writes only those columns (DATABASE rule 3). Unchanged fields are never overwritten.|
|Check|`UPDATE … SET …, version = version + 1 WHERE id = ? AND version = ? AND deleted\_at IS NULL`. 0 rows → re-read → `409 record\_deleted` or `409 version\_conflict`.|
|Success|`200` with the full record at its new version and `ETag: "<new>"`.|
|Child lists|Assignees, tags and the full checklist are saved through the parent task and bump the **task** version (DATABASE rule 8). A single checklist tick uses the **item's** own version.|
|Invitations|An RSVP change uses the **invitation's** version, not the family's. Two people can edit a family's address and its Mehndi RSVP at the same time without a conflict.|
|Action endpoints|`/done`, `/mark-paid`, `/pay-part`, `/restore` also send `If-Match`.|
|Bulk|No per-row versions. The request sends `as\_of` (when the list loaded). Rows changed since are skipped and named (DATABASE rule 10).|

### 4.2 Conflict reply

`409 version\_conflict` carries what the client needs for the 3-way merge in FEATURES A4:

|Key|Content|
|-|-|
|`current`|The full record as it is now, filtered for this user (no money fields for non-money users)|
|`current\_version`|Its version|
|`your\_version`|The version the client sent|
|`changed\_by`|`{id, name}` of the last person who changed it|
|`changed\_at`|When (UTC)|
|`changed\_fields`|Fields that differ between `your\_version` and now, from `audit\_log`. Lets the client skip a re-read.|

The client then merges base (what it loaded), mine (the draft) and theirs (`current`). Fields only I changed keep mine; only they changed keep theirs; both changed → the user picks. It re-sends **only my chosen fields** with `If-Match: "<current\_version>"` and a **new** `Idempotency-Key` (it is a new decision). Amount and status are never auto-merged if both sides changed them (FEATURES B6).

### 4.3 Example

Mummy and I both opened the Sharma family at version 3. Mummy saved adults = 4 (now version 4). I change adults to 5 and city:

```http
PATCH /api/v1/households/01JA7Q3M2K8V5R1T9W4X6Y0Z2B
Content-Type: application/json
If-Match: "3"
X-CSRF-Token: Rk9P…
Idempotency-Key: 6c0e2b8a-41d7-4c59-9f3a-2e8b7d1c5a90

{ "adults": 5, "city": "Udaipur" }
```

```http
HTTP/1.1 409 Conflict
Content-Type: application/json
Cache-Control: no-store

{ "ok": false,
  "error": {
    "code": "version\_conflict",
    "message": "Mummy changed this family at 10:42 AM while you were editing.",
    "your\_version": 3,
    "current\_version": 4,
    "changed\_by": { "id": "01JA6ZQ2B4C6D8E0F2G4H6J8K0", "name": "Mummy" },
    "changed\_at": "2026-10-08T05:12:04Z",
    "changed\_fields": \["adults"],
    "current": {
      "id": "01JA7Q3M2K8V5R1T9W4X6Y0Z2B", "version": 4,
      "name": "Ramesh Sharma \& family", "phone": "+919829012345", "side": "groom",
      "city": "Bhilwara", "adults": 4, "children": 1, "food": "mixed", "jain\_count": 2,
      "updated\_at": "2026-10-08T05:12:04Z", "updated\_by": { "id": "01JA6ZQ2B4C6D8E0F2G4H6J8K0", "name": "Mummy" }
    }
  },
  "meta": { "request\_id": "r\_c1", "server\_time": "2026-10-08T05:13:10Z" } }
```

The client sees: city changed only by me → keeps Udaipur. Adults changed by both → conflict screen "Adults: Yours 5 / Mummy's 4". I pick 5:

```http
PATCH /api/v1/households/01JA7Q3M2K8V5R1T9W4X6Y0Z2B
If-Match: "4"
Idempotency-Key: 0f4d9e21-7b3a-4a6c-b8e5-93c1d2f70a64

{ "adults": 5, "city": "Udaipur" }
```

```http
HTTP/1.1 200 OK
ETag: "5"

{ "ok": true, "data": { "id": "01JA7Q3M2K8V5R1T9W4X6Y0Z2B", "version": 5, "adults": 5, "city": "Udaipur", "…": "…" },
  "meta": { "request\_id": "r\_c2", "server\_time": "2026-10-08T05:14:02Z" } }
```

If the record was deleted meanwhile:

```json
{ "ok": false,
  "error": { "code": "record\_deleted", "message": "Papa deleted this family at 10:42 AM.",
             "deleted\_by": { "id": "01JA6ZR…", "name": "Papa" }, "deleted\_at": "2026-10-08T05:12:04Z",
             "can\_restore": true },
  "meta": { "request\_id": "r\_c3", "server\_time": "2026-10-08T05:13:10Z" } }
```

`can\_restore` is true for admins only. They see "\[Restore and save mine]": `POST /households/{id}/restore`, then the PATCH again. Family users see "Ask Ayush or Mahi to restore it. Your changes are kept as a draft."

Inline controls (RSVP chip, task tick, mark paid) get the same 409. The UI shows the small dialog "Mummy already set **Coming**. Change to **Not coming**?" and on Yes re-sends with the new version.

\---

## 5\. Idempotency

### 5.1 Rules

|Rule|Detail|
|-|-|
|Who sends it|The client, on **every** POST, PUT, PATCH and DELETE while logged in. Missing → `428 idempotency\_key\_required`.|
|Value|A UUID v4 from `crypto.randomUUID()` (iPhone Safari 15.4+ and Chrome both have it).|
|Creates|The key **is** the new record's `client\_uuid`. It is made when the form opens and kept in the local draft, so a retry days later still matches.|
|Other writes|A new key per user action (one Save tap, one tick). Kept for all retries of that action.|
|Same key, same request, already done|Server returns the **stored reply** with the original status code and `Idempotent-Replayed: true`. Nothing runs twice.|
|Same key, still running|`409 request\_in\_progress` with `Retry-After: 2`.|
|Same key, different method, path or body|`422 idempotency\_key\_reused`.|
|Failed request (4xx or 5xx)|Nothing was written, so the key is **released**. The user can fix the fields and retry with the same key. (Needed for "Add anyway" after a duplicate warning and for 422 corrections.)|
|Scope|Per user: the unique key is `(user\_id, idem\_key)`.|
|Expiry|48 hours (`expires\_at`). After that, creates are still protected by `client\_uuid` being UNIQUE on the record table (DATABASE rule 2): the server returns the existing record with `200`.|

### 5.2 Storage: `idempotency\_keys` (already in `001\_init`)

|Column|Use|
|-|-|
|`idem\_key`|The header value|
|`user\_id`|Owner of the key. Unique with `idem\_key`.|
|`method`, `path`|Must match on retry|
|`request\_hash`|SHA-256 of the canonical JSON body (keys sorted). For uploads: SHA-256 of the file + metadata.|
|`status`|`processing` → `done`|
|`response\_code`, `response\_body`|The stored reply (JSON), replayed on retry|
|`created\_at`, `expires\_at`|`expires\_at = created\_at + 48 h`|

### 5.3 Server steps

1. **Claim** (own autocommit statement): `INSERT INTO idempotency\_keys (…, status='processing')`.

   * Duplicate key → read the row. `done` + same hash → replay. `done` + other hash → 422. `processing` and younger than 120 s → `409 request\_in\_progress`. `processing` and older (the PHP process died) → take it over.
2. **Do the work** in one transaction: the change, its `audit\_log` row, its `change\_batches` row, **and** `UPDATE idempotency\_keys SET status='done', response\_code, response\_body`. They commit together, so a reply is stored if and only if the change happened.
3. **On any error**: roll back, then `DELETE` the claim row (a released key).
4. **Clean-up**: the daily cron deletes rows past `expires\_at` (allowed by DATABASE rule 12).

Not covered (no session yet, or naturally safe): login, logout, `/setup/owner`, `/auth/password-link/\*`, `/auth/password-reset/request`. They are rate-limited instead.

### 5.4 Example: network drops after the server saved

```http
POST /api/v1/tasks
Idempotency-Key: 5a8c0f3e-1d2b-4e6f-9a7c-0b3d5e7f9a1c
X-CSRF-Token: Rk9P…

{ "title": "Call tent wala", "assignee\_ids": \["01JA6ZK3D8M1T4V7W2X5Y9Q0R3"] }
```

The phone never receives the `201`. The user taps **Try again**; the same request is sent:

```http
HTTP/1.1 201 Created
Idempotent-Replayed: true
ETag: "1"

{ "ok": true, "data": { "id": "01JA7S9F…", "version": 1, "title": "Call tent wala", "…": "…" }, "meta": { "…": "…" } }
```

One task exists (AC-SAV-03).

\---

## 6\. Endpoints by module

All paths are under `/api/v1`. To keep the tables short:

* **Every endpoint** can also return `401`, `429`, `500`, `503`.
* **Every write** can also return `400 bad\_request`, `403 csrf\_failed`, `426`, `428`.
* **Every write to one record** can also return `409 version\_conflict` / `409 record\_deleted`.
* The **Errors** column lists the rest.
* `{id}` is always a `public\_id`. Bodies are JSON unless stated.
* Schema names (e.g. `TaskCreate`) are defined in the OpenAPI appendix (§12).

### 6.1 Permission summary

|Module|All|Ed (Family)|$|Adm|Own|
|-|-|-|-|-|-|
|Members|List names + phones|Edit own name, own password|—|Add, edit, deactivate, reset|Can't be demoted or deactivated|
|Settings|Read facts|—|See total budget|Edit facts, Safety, Activity, Imports, Trash, Export|—|
|Dashboard / Calendar|Countdown, headcount, events, tasks|My tasks, overdue|Payments, budget, payment items|Safety, recent activity|—|
|Events|Read|—|—|Create, edit, delete|—|
|Tasks|Read|Create, edit, tick any task; delete own tasks (created by or assigned to them)|—|Delete any task; rename / delete tags|—|
|Guests|Read (incl. phones)|Create, edit, RSVP, delete one family; bulk invite / uninvite / RSVP / side|—|Import, bulk delete, export CSV|—|
|Vendors|Read contacts|Create, edit (no amount unless $)|Agreed amount, balances|Delete|—|
|Payments, categories|—|—|Full (Family+$ can't delete categories)|Delete categories|—|
|Documents|Non-private, not payment-linked|Upload; edit/delete own|Payment-linked|Everything, set private|—|
|History|Records they can see, money hidden|—|Money fields shown|Activity feed|—|
|Undo|Own actions, 10 min|—|—|Trash, restore|Purge (after 16 May 2027)|

### 6.2 Members

|Method|Path|Purpose|Who|Request|Response|Errors|
|-|-|-|-|-|-|-|
|GET|`/members`|List all members (≤ 30, not paged)|All (Family/Viewer get `id`, `name`, `phone`, `role`, `left` only)|`?include\_inactive=true` (Adm)|`200 \[Member]`|—|
|POST|`/members`|Add / invite a member|Adm|`MemberCreate`: `name\*`, `phone\*`, `role\*` (`partner`, `family`, `viewer`), `can\_see\_money`, `access\_ends\_on`, `email`, `password\_mode\*` (`set`, `generate`, `link`), `password` (if `set`)|`201 {member, password\_once?, setup\_link?, setup\_link\_expires\_at?}`|403 (Partner adding a partner is allowed; nobody can add an owner), 409 `duplicate\_found` "Already a member: Sunita Porwal.", 422|
|GET|`/members/{id}`|One member, incl. last seen and device list|Adm, Self|—|`200 Member`|403, 404|
|PATCH|`/members/{id}`|Edit name, phone, role, money, end date, email, active|Adm; Self (`name` only)|`MemberUpdate`|`200 Member`. Role, money or active changes revoke nothing but apply on the member's next request; deactivation revokes sessions.|403 (Owner's role/active; Partner editing Owner's role; last active admin), 409 `duplicate\_found`, 422|
|POST|`/members/{id}/password-reset`|Admin reset|Adm (not Owner by Partner, not self — use change)|`{mode, password?}`|`200 {password\_once?, setup\_link?, sessions\_revoked}`|403, 404|
|GET|`/me/sessions`|My logged-in phones|Self|—|`200 \[{device\_label, last\_used\_at, current}]`|—|

Members are never deleted (FEATURES B1). There is no `DELETE /members/{id}`; deactivate with `PATCH {is\_active: false}`.

### 6.3 Settings, safety and admin

|Method|Path|Purpose|Who|Request|Response|Errors|
|-|-|-|-|-|-|-|
|GET|`/settings`|Wedding facts|All (`total\_budget\_paise` only for $)|—|`200 Settings` + ETag|—|
|PATCH|`/settings`|Edit facts|Adm|`SettingsUpdate`: names, side labels, dates, city, `total\_budget\_paise` (`timezone`, `currency` read-only)|`200 Settings`|403, 422 "End date must be on or after the start date."|
|GET|`/settings/history`|History of settings|Adm|cursor|`200 \[HistoryLine]`|403|
|GET|`/backups`|Last backup runs (Safety)|Adm|`?limit=7` (max 60)|`200 \[BackupRun]`|403|
|GET|`/restore-drills`|Drill log|Adm|—|`200 \[RestoreDrill]`|403|
|POST|`/restore-drills`|Log a drill|Adm|`done\_on\*`, `result\*` (`passed`, `failed`), `backup\_file`, `notes`|`201 RestoreDrill`|403, 422|
|PATCH|`/restore-drills/{id}`|Fix a drill entry|Adm|any of the above|`200 RestoreDrill`|403, 404, 422|
|DELETE|`/restore-drills/{id}`|Soft delete|Adm|If-Match|`200 {}` + `meta.undo`|403, 404|
|GET|`/health`|Health (§11)|Anyone: summary. Adm: details.|—|`200`/`503 Health`|—|

### 6.4 Dashboard and calendar

|Method|Path|Purpose|Who|Request|Response|Errors|
|-|-|-|-|-|-|-|
|GET|`/dashboard`|All Home cards in one call (FEATURES B2). Only the cards this user may see are present.|All|`?payments\_window\_days=14` (1–90; DATABASE DB7)|`200 Dashboard`: `countdown`, `my\_tasks`, `overdue`, `payments\_due`, `headcount`, `budget`, `safety`, `recent\_activity`, `start\_here`|—|
|GET|`/calendar`|Items for a date range: events, open tasks with a due date, due payments|All (payments only $)|`from\*`, `to\*` (IST dates, max 93 days apart), `types=event,task,payment`, `mine=true`, `include\_undated=true` (adds "Date not set" events)|`200 {days: \[{date, items: \[CalendarItem]}], undated: \[Event]}`|422 range too long|

`CalendarItem`: `{type: "event"|"task"|"payment", id, title, date, time, start\_at, end\_at, status, overdue, side, linked\_event}`. Agenda loads 60 days per call; month view one month.

### 6.5 Events

|Method|Path|Purpose|Who|Request|Response|Errors|
|-|-|-|-|-|-|-|
|GET|`/events`|All events (not paged; ≈ 7–30)|All|`?guests\_invited=true`|`200 \[Event]` incl. `headcount` per guest event|—|
|POST|`/events`|Add custom event|Adm|`EventCreate`: `name\*`, `type\*`, `side`, `guests\_invited`, `start\_at`, `end\_at`, `all\_day`, `venue\_name`, `venue\_address`, `map\_url` (`https://` only), `dress\_code`, `notes`, `allow\_duplicate`|`201 Event`|403, 409 `duplicate\_found` (same type, same IST date: warning, "Add anyway"), 422 "End time must be after the start time."|
|GET|`/events/{id}`|Event page: details + counts of tasks, invited families, payments ($), documents|All|—|`200 Event`|404|
|GET|`/events/{id}/headcount`|Coming / Waiting / Not asked / Not coming people, Jain, "up to" (DATABASE §7.4)|All|—|`200 Headcount`|404|
|PATCH|`/events/{id}`|Edit|Adm|`EventUpdate`|`200 Event`|403, 404, 422|
|GET|`/events/{id}/delete-preview`|Counts for the delete dialog: "12 tasks, 340 invited families, 3 payments"|Adm|—|`200 {tasks, invitations, payments, documents}`|403, 404|
|DELETE|`/events/{id}`|Soft delete; invitations go in the same batch|Adm|If-Match|`200 {}` + `meta.undo`|403, 404|
|POST|`/events/{id}/restore`|Restore with its batch's invitations|Adm|If-Match (deleted version)|`200 Event`|403, 404|

Families invited to an event: `GET /households?event={id}` (§6.7). WhatsApp text is built on the phone (FEATURES A7); no endpoint.

### 6.6 Tasks, checklist and tags

|Method|Path|Purpose|Who|Request|Response|Errors|
|-|-|-|-|-|-|-|
|GET|`/tasks`|List with view chips and filters|All|`view` (`mine` default for Family, `all` default for admins, `today`, `week`, `overdue`, `no\_date`, `closed`), `status`, `event`, `tag`, `assignee`, `priority`, `vendor`, `household`, `q`, `sort` (`default`, `due\_date`, `-created\_at`, `title`), `limit`, `cursor`|`200 \[TaskSummary]`, `meta.total`, `meta.chip\_counts {mine, today, week, overdue, no\_date}`|—|
|POST|`/tasks`|Create|Ed|`TaskCreate`: `title\*`, `notes`, `status`, `priority`, `due\_date`, `due\_time`, `event\_id`, `vendor\_id`, `household\_id`, `assignee\_ids` (default `\[me]`, max 10, active members), `tag\_ids` (max 10), `new\_tags` (names to create inline), `items` (`\[{key, text}]`), `allow\_duplicate`|`201 Task`|403, 409 `duplicate\_found` "A similar task exists: Book tent wala" (open task, same title ignoring case), 422|
|GET|`/tasks/{id}`|One task with assignees, tags, checklist|All|—|`200 Task`|404|
|PATCH|`/tasks/{id}`|Edit. A later `due\_date` counts as a postpone (`postpone\_count + 1`, History line). `assignee\_ids`, `tag\_ids`, `items` replace the whole list.|Ed|`TaskUpdate`|`200 Task`|403, 404, 422|
|POST|`/tasks/{id}/done`|Tick done. Idempotent: if already done, `200` with `already\_done: true` and who did it.|Ed|If-Match|`200 Task` + `meta.undo` (or `already\_done`)|403, 404|
|DELETE|`/tasks/{id}`|Soft delete with checklist, assignees, tags|Adm: any task. Family: own tasks only (created by them or assigned to them)|If-Match|`200 {}` + `meta.undo`|403 ("You can delete only tasks you added or that are yours."), 404|
|POST|`/tasks/{id}/restore`|Restore with same-batch children|Adm|If-Match|`200 Task`|403, 404|
|POST|`/tasks/{id}/items`|Add a checklist item|Ed|`{key\*, text\*, sort\_order}` (`key` = the item's UUID = `Idempotency-Key`)|`201 TaskItem`|404, 422|
|PATCH|`/tasks/{id}/items/{key}`|Tick / rename / reorder one item. Uses the item's version.|Ed|If-Match (item) + `{text?, is\_done?, sort\_order?}`|`200 TaskItem` + `meta.last\_item\_done: true` when all are now ticked (UI asks "Mark the task done too?")|404, 422|
|DELETE|`/tasks/{id}/items/{key}`|Remove an item|Ed|If-Match (item)|`200 {}` + `meta.undo`|404|
|GET|`/tags`|All tags|All|—|`200 \[Tag]` with `task\_count`|—|
|POST|`/tags`|Create tag|Ed|`{name\*}` (1–30, unique among live tags)|`201 Tag`|409 `duplicate\_found`, 422|
|PATCH|`/tags/{id}`|Rename|Adm|`{name}`|`200 Tag`|403, 409, 422|
|DELETE|`/tags/{id}`|Soft delete; removes it from tasks in the same batch|Adm|If-Match|`200 {}` + `meta.undo`|403, 404|
|POST|`/tags/{id}/restore`|Restore|Adm|If-Match|`200 Tag`|403, 404, 422 `rule\_blocked` (a live tag has that name now)|

`Task` shape:

```json
{ "id": "01JA7S9F2C…", "version": 3, "title": "Book tent wala for Mehndi", "notes": "Ask for 2 quotes",
  "status": "waiting", "priority": "urgent", "due\_date": "2026-10-20", "due\_time": "18:00",
  "overdue": false, "postpone\_count": 1,
  "event": { "id": "01M4DK5T3E6QZBMNQ0V7KQWW23", "name": "Mehndi", "deleted": false },
  "vendor": { "id": "01JA…", "name": "Shree Tent House", "deleted": false }, "household": null,
  "assignees": \[ { "id": "01JA6ZR…", "name": "Papa", "left": false } ],
  "tags": \[ { "id": "01M4DK5T454454B5E65JQ6PTSY", "name": "Decor" } ],
  "items": \[ { "key": "c1d2…", "version": 2, "text": "Shamiana 40x60", "is\_done": true, "sort\_order": 1,
               "done\_by": { "id": "01JA6ZR…", "name": "Papa" }, "done\_at": "2026-10-08T06:00:00Z" } ],
  "completed\_at": null, "completed\_by": null,
  "created\_at": "2026-10-05T04:00:00Z", "created\_by": { "id": "01JA…", "name": "Mahi" },
  "updated\_at": "2026-10-08T06:00:00Z", "updated\_by": { "id": "01JA6ZR…", "name": "Papa" } }
```

### 6.7 Guests: families, invitations, bulk, import

**Families**

|Method|Path|Purpose|Who|Request|Response|Errors|
|-|-|-|-|-|-|-|
|GET|`/households`|Guest list|All|`q`, `side` (`both` families appear under bride and groom too), `event`, `rsvp` (needs `event`), `group`, `area`, `food`, `vip`, `no\_phone`, `possible\_duplicates`, `sort` (`name` default, `-created\_at`, `area`, `group`), `limit`, `cursor`|`200 \[HouseholdSummary]`, `meta.total` (families), `meta.totals.people`|422 `rsvp` without `event`|
|POST|`/households`|Add a family (+ invitations)|Ed|`HouseholdCreate`: `name\*`, `phone`, `alt\_phone`, `side\*`, `group\_name`, `relation`, `area`, `city`, `address`, `adults` (2), `children` (0), `food` (`veg`, `jain`, `mixed`), `jain\_count`, `is\_vip`, `notes`, `invite\_event\_ids`, `allow\_duplicate`|`201 Household`|409 `duplicate\_found` (same phone or alt phone as a live family), 422|
|GET|`/households/duplicate-check`|Hints while typing, before Save|Ed|`phone`, `alt\_phone`, `name`, `city`, `exclude` (id)|`200 {phone\_matches: \[Match], name\_matches: \[Match]}`|—|
|GET|`/households/suggestions`|Autocomplete|Ed|`field\*` (`group\_name`, `area`, `relation`, `city`), `q`|`200 \[string]` (max 20)|422|
|GET|`/households/{id}`|Family page with invitations|All|—|`200 Household`|404|
|PATCH|`/households/{id}`|Edit|Ed|`HouseholdUpdate` (+ `allow\_duplicate` when changing phone)|`200 Household`|409 `duplicate\_found`, 422|
|DELETE|`/households/{id}`|Soft delete with its invitations|Ed|If-Match|`200 {}` + `meta.undo`|404|
|POST|`/households/{id}/restore`|Restore. A phone clash restores anyway and warns (FEATURES B9).|Adm|If-Match|`200 Household` + `meta.warnings`|403, 404|
|GET|`/households/export`|Filtered list as CSV (UTF-8 BOM, IST, formula-safe, FEATURES B8). Audited.|Adm|same filters as list|`200 text/csv` attachment `guests\_YYYY-MM-DD.csv`|403|

`Match`: `{id, name, side, phone, added\_by: {id, name}, match\_on: "phone"|"alt\_phone"|"name\_city"}`.

**Invitations** (`household\_events`; addressed by family + event)

|Method|Path|Purpose|Who|Request|Response|Errors|
|-|-|-|-|-|-|-|
|PUT|`/households/{id}/invitations/{event\_id}`|Invite. Revives a removed invitation (DATABASE). Already invited → `200` unchanged.|Ed|`{expected\_adults?, expected\_children?}`. No If-Match needed (create or revive).|`201` or `200 Invitation` + `meta.undo`|404, 422 "This event doesn't take guest invitations."|
|PATCH|`/households/{id}/invitations/{event\_id}`|RSVP and expected counts|Ed|If-Match (invitation) + `{rsvp?, expected\_adults?, expected\_children?, rsvp\_note?}`|`200 Invitation`|404, 422|
|DELETE|`/households/{id}/invitations/{event\_id}`|Remove from event (Undo, no confirm)|Ed|If-Match (invitation)|`200 {}` + `meta.undo`|404|
|POST|`/households/{id}/invitations/{event\_id}/whatsapp-opened`|Record a WhatsApp reminder tap. Bookkeeping: no version bump (DATABASE rule 11). Never means "sent".|Ed|—|`200 {last\_reminder\_opened\_at}`|404|

`Invitation`: `{event: {id, name}, version, rsvp, expected\_adults, expected\_children, people, rsvp\_note, rsvp\_updated\_at, rsvp\_updated\_by, last\_reminder\_opened\_at}`. `people` = `expected\_\* ?? family's`.

**Bulk** (FEATURES B5)

|Method|Path|Purpose|Who|Request|Response|Errors|
|-|-|-|-|-|-|-|
|POST|`/households/bulk`|One action on many families, one batch, one Undo|Ed; `delete` action Adm only|`action\*` (`invite`, `uninvite`, `set\_rsvp`, `set\_side`, `delete`), `event\_id`, `rsvp`, `side`, `as\_of\*`, and **either** `ids` (≤ 2,000) **or** `filter` (same keys as the list; applied on the server)|`200 {affected, skipped: \[{id, name, reason, changed\_by}], batch\_id}` + `meta.undo`|403 (`delete` by Family), 422 > 2,000 rows ("Please choose 2,000 families or fewer."), 422 missing `event\_id`|

`invite` skips families already invited and never changes their RSVP (AC-GST-05). Skipped reasons: `changed\_since\_loaded`, `already\_invited`, `not\_invited`, `deleted`.

**Import** (FEATURES A8). The phone parses the file (`read-excel-file`, CSV, paste, `.vcf`) and sends JSON rows. Max 3,000 rows. Request body max 5 MB.

|Method|Path|Purpose|Who|Request|Response|Errors|
|-|-|-|-|-|-|-|
|POST|`/imports/preview`|Check rows; writes nothing|Adm|`source\*` (`xlsx`, `csv`, `paste`, `vcf`), `file\_name`, `defaults {side, event\_ids, city}`, `rows\* \[ImportRow]`|`200 {counts: {new, duplicates, errors, skipped\_examples}, rows: \[{row\_no, status, errors, matches, normalised}]}`|403, 413, 422 > 3,000 rows|
|POST|`/imports`|Run the import: one transaction, one batch|Adm|same + each row's `decision` (`add`, `skip`, `add\_anyway`, `update\_existing`) and `update\_target\_id`|`201 Import` + `meta.undo`|403, 409 `request\_in\_progress`, 422 (any row still has an error and isn't `skip`)|
|GET|`/imports`|Past imports (Settings → Imports)|Adm|cursor|`200 \[Import]`|403|
|GET|`/imports/{id}`|One import, with counts|Adm|—|`200 Import`|403, 404|
|POST|`/imports/{id}/undo`|"Undo this import" (no 10-min limit). Rows edited since are kept and listed.|Adm|—|`200 UndoResult`|403, 404|

`ImportRow`: `{row\_no, name, phone, alt\_phone, side, group\_name, relation, area, city, address, adults, children, food, jain\_count, is\_vip, notes, event\_ids: \[]}`. `update\_existing` fills empty fields only (AC-IMP-04). The Excel template is a static file (`/templates/AM\_Guest\_List\_Template.xlsx`), not an API call.

### 6.8 Money: summary, categories, vendors, payments

All of this module is `$` except vendor contacts. A non-money user gets `403 no\_money\_access`.

|Method|Path|Purpose|Who|Request|Response|Errors|
|-|-|-|-|-|-|-|
|GET|`/money/summary`|Totals card and per-category table (DATABASE §7.5)|$|—|`200 {planned\_paise, spent\_paise, still\_to\_pay\_paise, left\_paise, free\_paise, not\_yet\_split\_paise, categories: \[CategoryTotals]}`|403|
|GET|`/budget-categories`|Categories with planned/spent/due|$|—|`200 \[BudgetCategory]`|403|
|POST|`/budget-categories`|Add|$|`{name\*, planned\_paise, sort\_order}`|`201 BudgetCategory`|403, 409 `duplicate\_found`, 422|
|PATCH|`/budget-categories/{id}`|Rename, plan, reorder|$|same fields|`200 BudgetCategory`|403, 404, 409, 422|
|DELETE|`/budget-categories/{id}`|Delete. With payments: needs `move\_payments\_to`; moves and deletes in one batch. The fallback (Miscellaneous) can't be deleted.|Adm|If-Match + `{move\_payments\_to?}`|`200 {moved}` + `meta.undo`|403, 404, 422 `rule\_blocked` (`category\_has\_payments`, `fallback\_category`)|
|POST|`/budget-categories/{id}/restore`|Restore|Adm|If-Match|`200 BudgetCategory`|422 `rule\_blocked` (name now used)|
|GET|`/vendors`|Vendor contacts|All (amounts and balances only $)|`q`, `category`, `booked`, `sort` (`name`), cursor|`200 \[Vendor]`|—|
|POST|`/vendors`|Add|Ed|`VendorCreate`: `name\*`, `category\*`, `contact\_person`, `phone`, `alt\_phone`, `agreed\_amount\_paise` ($ only), `is\_booked`, `notes`, `allow\_duplicate`|`201 Vendor`|403 (`agreed\_amount\_paise` from non-$), 409 `duplicate\_found` (same phone), 422|
|GET|`/vendors/{id}`|Vendor page. $ also get `balance {agreed, paid, due, not\_scheduled}`|All|—|`200 Vendor`|404|
|PATCH|`/vendors/{id}`|Edit|Ed (amount $)|`VendorUpdate`|`200 Vendor`|403, 404, 409, 422|
|DELETE|`/vendors/{id}`|Soft delete. Payments keep the link, "(deleted vendor)".|Adm|If-Match|`200 {}` + `meta.undo`|403, 404|
|POST|`/vendors/{id}/restore`|Restore|Adm|If-Match|`200 Vendor`|403, 404|
|GET|`/payments`|Payments and expenses|$|`status` (`due`, `overdue`, `paid`, `no\_date`), `kind` (`payment`, `expense`), `category`, `vendor`, `event`, `month` (`YYYY-MM`, by due or paid date), `q`, `sort` (`due\_date` default, `-paid\_on`, `-amount\_paise`), cursor|`200 \[Payment]`, `meta.totals {amount\_paise, due\_paise, paid\_paise}`|403|
|POST|`/payments`|Add payment or expense|$|`PaymentCreate`: `title\*`, `amount\_paise\*` (1–1000000000), `category\_id` (default: vendor's last used, else Miscellaneous), `vendor\_id` **or** `new\_vendor {name, category, phone}` (created in the same transaction), `event\_id`, `status` (`due`, `paid`), `due\_date`, `paid\_on`, `method`, `paid\_by`, `reference`, `notes`, `allow\_duplicate`|`201 Payment`|403, 409 `duplicate\_found` (same vendor + amount within 2 days), 422 (paid needs `paid\_on` + `method`; `paid\_on` not in the future)|
|GET|`/payments/{id}`|One payment with receipts|$|—|`200 Payment`|403, 404|
|PATCH|`/payments/{id}`|Edit|$|`PaymentUpdate`|`200 Payment`|403, 404, 422|
|POST|`/payments/{id}/mark-paid`|Mark a due payment paid|$|If-Match + `{paid\_on\*, method\*, paid\_by, reference}`|`200 Payment` + `meta.undo`|403, 404, 422 already paid|
|POST|`/payments/{id}/pay-part`|Pay part: new Paid row + Due reduced, one batch (AC-MON-04)|$|If-Match + `{amount\_paise\*` (< due amount)`, paid\_on\*, method\*, paid\_by, reference}`|`200 {paid: Payment, due: Payment}` + `meta.undo`|403, 404, 422 "Part payment must be less than ₹1,00,000."|
|DELETE|`/payments/{id}`|Soft delete with its receipts|$|If-Match|`200 {}` + `meta.undo`|403, 404|
|POST|`/payments/{id}/restore`|Restore with receipts|Adm|If-Match|`200 Payment`|403, 404|

`Payment` includes `kind` (`payment` if it has a vendor, else `expense`), `overdue`, `no\_date`, `receipt\_count`, `split\_from` (`{id}` for a pay-part row).

### 6.9 Documents

Details of upload and download are in §8.

|Method|Path|Purpose|Who|Request|Response|Errors|
|-|-|-|-|-|-|-|
|GET|`/documents`|List (only visible ones)|All|`type`, `vendor`, `event`, `payment`, `q`, `sort` (`-created\_at` default), `limit` (30), cursor|`200 \[Document]`|—|
|POST|`/documents`|Upload one file + details|Ed (payment link needs $; `is\_private` Adm)|`multipart/form-data` (§8.2)|`201 Document`|403, 409 `duplicate\_found` (same SHA-256), 413, 415, 422 `checksum\_mismatch`|
|GET|`/documents/{id}`|Details|Visible to user|—|`200 Document`|403, 404|
|PATCH|`/documents/{id}`|Edit title, type, links, private, notes. The file never changes.|Adm; Family own uploads|`DocumentUpdate`|`200 Document`|403, 404, 422|
|GET|`/documents/{id}/file`|The bytes|Visible to user|`?download=1`|`200` file stream|403, 404|
|DELETE|`/documents/{id}`|Soft delete (file stays on disk)|Adm; Family own uploads|If-Match|`200 {}` + `meta.undo`|403, 404|
|POST|`/documents/{id}/restore`|Restore|Adm|If-Match|`200 Document`|403, 404|

Visibility (FEATURES B7): private → Adm only; linked to a payment → $ only; else everyone. A document a user may not see returns `403` (AC-DOC-02/03).

### 6.10 History and activity

|Method|Path|Purpose|Who|Request|Response|Errors|
|-|-|-|-|-|-|-|
|GET|`/{resource}/{id}/history`|Plain-sentence History for one record. `{resource}` = `households`, `tasks`, `events`, `vendors`, `payments`, `documents`, `budget-categories`, `tags`, `members`. Includes child changes (invitations, checklist).|Anyone who can see the record. Money fields removed for non-$.|cursor|`200 \[HistoryLine]`|403, 404|
|GET|`/activity`|Activity feed (Settings → Activity)|Adm|`user`, `type`, `action`, `from`, `to`, cursor (50)|`200 \[HistoryLine]`|403 (AC-ACT-04)|

`HistoryLine`:

```json
{ "at": "2026-10-12T13:10:00Z", "action": "update",
  "user": { "id": "01JA6ZQ2…", "name": "Mummy" }, "device": "Android · installed",
  "entity": { "type": "household", "id": "01JA7Q3M…", "name": "Ramesh Sharma \& family" },
  "sentence": "Mummy changed RSVP for Mehndi from Waiting to Coming",
  "changes": \[ { "field": "rsvp", "label": "Coming?", "from": "waiting", "to": "coming" } ],
  "batch\_id": null }
```

The server builds `sentence` and `changes` from `before\_json` / `after\_json` (DATABASE DB4). It never returns the raw JSON or password hashes.

\---

## 7\. Undo, Trash, restore and purge

### 7.1 How deletes work

* Every `DELETE` is soft. The row stays with `deleted\_at`, `deleted\_by`, `delete\_batch\_id` (AC-TRS-06).
* Children go into the **same batch**: task → checklist, assignees, tags; family → invitations; event → invitations; payment → receipts; tag → its task links (DATABASE rule 5).
* The reply carries `meta.undo.batch\_id` (a `change\_batches.public\_id`).
* Deleted rows disappear from lists, search, counts, dashboard, calendar (AC-TRS-07).
* No confirm dialog. Undo follows (FEATURES A2). Event delete shows counts first (`/delete-preview`).

### 7.2 Endpoints

|Method|Path|Purpose|Who|Request|Response|Errors|
|-|-|-|-|-|-|-|
|POST|`/undo/{batch\_id}`|Undo a delete, bulk action, import, task done, mark paid, pay part|The person who acted, within 10 min|—|`200 UndoResult`|403 `undo\_expired` or not yours, 404|
|GET|`/trash`|Deleted items, newest first, one row per batch|Adm|`type`, `user`, `from`, `to`, cursor (50)|`200 \[TrashBatch]`|403 (AC-TRS-05)|
|GET|`/trash/{batch\_id}`|Items inside one batch|Adm|—|`200 {batch: TrashBatch, items: \[TrashItem]}`|403, 404|
|POST|`/trash/{batch\_id}/restore`|Restore the whole batch, or chosen items|Adm|`{items?: \[{type, id}]}` (omit = all)|`200 RestoreResult`|403, 404|
|POST|`/{resource}/{id}/restore`|Restore one record and its same-batch children|Adm|If-Match (deleted version)|`200 <Record>`|403, 404|
|DELETE|`/trash/{batch\_id}`|**Purge** for good. **Later.**|Own|If-Match not used; body `{confirm: "DELETE FOREVER", export\_id}` (an export made in the last 24 h)|Always `403 purge\_not\_allowed\_yet` before 16 May 2027|403|

### 7.3 Shapes

```json
// UndoResult
{ "batch\_id": "01JA7R0C…", "undone": 29,
  "skipped": \[ { "type": "household", "id": "01JA7Q3M…", "name": "Ramesh Sharma \& family",
                 "reason": "changed\_since", "changed\_by": { "id": "01JA6ZQ2…", "name": "Mummy" } } ],
  "message": "Undone. 1 family was changed by someone else and was left as it is.",
  "already\_undone": false }
```

```json
// TrashBatch
{ "batch\_id": "01JA7R0C…", "action": "delete", "entity\_type": "household",
  "summary": "Sharma family · 3 invitations", "item\_count": 4,
  "user": { "id": "01JA6ZR…", "name": "Papa" }, "deleted\_at": "2026-10-08T05:12:04Z",
  "restorable": true }
```

```json
// RestoreResult
{ "restored": 4,
  "blocked": \[ { "type": "member", "id": "01JA…", "name": "Raju", "reason": "Phone +919829000000 is used by an active member." } ],
  "warnings": \[ "Ramesh Sharma \& family has the same phone as Ramesh S. (Groom side). Both are kept." ],
  "already\_restored": false }
```

### 7.4 Rules

|Rule|Source|
|-|-|
|Undo reverts a row only if its version still equals the version it reached in that batch. Others are skipped and named.|DATABASE rule 7, AC-UND-02|
|A second Undo of the same batch does nothing and returns `already\_undone: true`|DATABASE rule 7|
|Undo after 10 min → `403 undo\_expired`. Admins restore from Trash.|AC-UND-04|
|Restore touches only rows with that `delete\_batch\_id`|DATABASE rule 6, R9|
|Restoring a child also restores its deleted parent (checklist item → task)|FEATURES B9|
|Restoring a task linked to a deleted event leaves the event deleted, labelled|AC-TRS-04|
|Unique clash (member phone, tag or category name) → that item is blocked with a reason. Family phone clash → restored with a warning.|FEATURES B9|
|Restoring twice → `200`, `already\_restored: true` ("Already restored.")|FEATURES B9|
|Every undo and restore bumps the version and is audited (`undo`, `restore`)|AC-UND-01|
|Purge: no app code path deletes rows before 16 May 2027. The endpoint exists only so the client contract won't change.|FEATURES B9, DATABASE §4|

\---

## 8\. Files: upload and download

### 8.1 Limits

Confirmed (8 Oct 2026): our plan has the same limits as Hostinger's public Business-level plan page: 50 GB disk, 3 GB per database, PHP uploads and POST bodies up to 2,048 MB, 360 s run time. Our own limits are much lower on purpose:

|Setting|Value|Why|
|-|-|-|
|Max file size|**10 MB** (10,485,760 bytes)|FEATURES B7; enforced in DB (`ck\_files\_size`)|
|PHP `upload\_max\_filesize`|12M|Room for multipart overhead|
|PHP `post\_max\_size`|16M|Above upload size, so PHP doesn't silently drop the body|
|PHP `max\_execution\_time`|60 s for the API; the export download raises its own limit to 300 s|Below the plan's 360 s cap|
|PHP `memory\_limit`|256M|Files are streamed, never loaded whole|
|Files per request|1|Several files = several requests, one document each (FEATURES B7)|
|Allowed types|`image/jpeg`, `image/png`, `image/webp`, `application/pdf`|DB `ck\_files\_mime`. Checked by **content** (`finfo`), never by name or browser type.|
|Not allowed|HEIC, SVG, HTML, Office files, ZIP, anything else|SVG/HTML can carry scripts. HEIC: phone shows "Please share it as a JPEG photo."|
|Import body|5 MB, 3,000 rows|FEATURES A8|
|Uploads per user|60 per hour, 200 MB per hour|§10|

Images are compressed on the phone first: longest side 1,600 px, JPEG \~80 %, EXIF (GPS) removed (CONTEXT 13). A typical photo arrives at 200–600 KB.

### 8.2 Upload: `POST /api/v1/documents`

```http
POST /api/v1/documents
Content-Type: multipart/form-data; boundary=----am
X-CSRF-Token: Rk9P…
Idempotency-Key: 2e7b4c19-6d0a-4f83-b5e1-9c2a7d4f0b36

------am
Content-Disposition: form-data; name="file"; filename="IMG\_4021.jpg"
Content-Type: image/jpeg

<bytes>
------am
Content-Disposition: form-data; name="sha256"

9f2c…64 hex chars…
------am
Content-Disposition: form-data; name="type"

receipt
------am
Content-Disposition: form-data; name="payment\_id"

01JA7T2B…
------am--
```

Form fields: `file\*`, `sha256\*` (hex SHA-256 of the exact bytes sent, from `crypto.subtle.digest`), `type\*`, `title`, `payment\_id`, `vendor\_id`, `event\_id`, `is\_private` (`true`/`false`), `notes`, `allow\_duplicate`.

Server steps:

1. Body larger than `post\_max\_size` → PHP gives an empty `$\_FILES`; the server sees the `Content-Length` and returns `413 file\_too\_big`.
2. Check permission (payment link needs $, `is\_private` needs Adm).
3. Size > 10 MB → `413`. `finfo` type not allowed → `415`. For images, `getimagesize()` must succeed.
4. Compute SHA-256 of the temp file. Not equal to `sha256` → `422 checksum\_mismatch`; temp file dropped.
5. Same SHA-256 already in `files`:

   * check the stored file still exists with the same size; if not, write these bytes to its path (DATABASE rule 13);
   * without `allow\_duplicate` → `409 duplicate\_found` "This file is already saved as 'Receipt – Shree Tent House – 12 Oct 2026'." with `matches`;
   * with `allow\_duplicate` → a new `documents` row pointing at the same `files` row ("Save again").
6. New file: move to `<private root>/uploads/YYYY/MM/<uuid>.<ext>`, extension from the detected type. The private root is **outside `public\_html`**.
7. One transaction: `files` + `documents` + `audit\_log` + idempotency reply. If the transaction fails, the new file is deleted. A weekly check lists any file on disk with no `files` row.

Reply `201 Document`:

```json
{ "id": "01JA7V4K…", "version": 1, "title": "Receipt – Shree Tent House – 12 Oct 2026", "type": "receipt",
  "is\_private": false, "notes": null,
  "file": { "id": "01JA7V4J…", "original\_name": "IMG\_4021.jpg", "mime\_type": "image/jpeg",
            "size\_bytes": 412883, "sha256": "9f2c…", "width\_px": 1600, "height\_px": 1200 },
  "payment": { "id": "01JA7T2B…", "name": "Tent advance", "deleted": false }, "vendor": null, "event": null,
  "file\_url": "/api/v1/documents/01JA7V4K…/file",
  "created\_at": "2026-10-08T09:20:00Z", "created\_by": { "id": "01JA…", "name": "Mahi" } }
```

Mark-paid with a receipt (FEATURES B6): the payment is saved first, then the receipt uploads. If the upload fails, the payment stays paid and shows "Receipt not uploaded — try again".

### 8.3 Download: `GET /api/v1/documents/{id}/file`

|Item|Rule|
|-|-|
|Access|Session cookie + the same visibility check as the document (FEATURES B7). No session → 401. Not allowed → 403. Unknown or deleted → 404.|
|No public URL|Files are only reachable through this endpoint. The uploads folder is outside `public\_html` and also has a deny-all `.htaccess`. Guessing a path gives 404 (AC-DOC-02).|
|Streaming|`readfile()` in 1 MB chunks; never loaded into memory whole.|
|Headers|`Content-Type` from the DB; `Content-Disposition: inline; filename\*=UTF-8''<original name>` (`attachment` with `?download=1`); `Content-Length`; `Cache-Control: private, no-store`; `X-Content-Type-Options: nosniff`; `ETag: "<sha256>"`; `Accept-Ranges: bytes`.|
|Range|Single byte ranges are supported (`206`). iPhone's PDF viewer and video players ask for them.|
|In the app|Images: `<img src="/api/v1/documents/{id}/file">` works on both phones because the cookie is same-origin. PDFs: opened through the phone's share sheet (§8.4).|
|Integrity|`ETag` is the SHA-256, so the phone (or a restore script) can verify the bytes.|

Deleted documents' files are kept on disk (R1 never hard-deletes), and admins can still download them from Trash.

### 8.4 Opening a PDF: the share sheet (answered)

Opening a PDF inside the installed iPhone app shows it with no back button. So PDFs (and "Share" on any document) go through the phone's own share sheet. The file never gets a public URL.

|Step|What happens|
|-|-|
|1. Tap **Open** on a PDF|The app fetches `GET /documents/{id}/file` with the session cookie and shows a progress bar. The bytes stay in memory as a `File`.|
|2. Tap **Open / Share** (appears when ready)|`navigator.share({ files: \[file], title })`. iPhone: "Open in Files / Books", Save to Files, WhatsApp, Print. Android: the app chooser (PDF viewer, Drive, WhatsApp).|
|Why two taps|iPhone only allows the share sheet straight after a tap. A slow download between the tap and the sheet would be refused. The second tap is instant.|
|Share sheet not available (`navigator.canShare({files})` false, e.g. a desktop browser)|Open the in-memory file in a new tab with an object URL; Android and desktop show their PDF viewer.|
|Images|Shown inline as usual. The same **Share** button sends the photo to WhatsApp or Files.|
|Offline|Button disabled: "No internet — PDFs open only when online."|

Works on iPhone Safari 15+ (installed and in the browser) and Android Chrome. No API change: it is the same authorised download endpoint.

\---

## 9\. Export and sync

### 9.1 Full export

|Method|Path|Purpose|Who|Request|Response|Errors|
|-|-|-|-|-|-|-|
|POST|`/exports`|Take a snapshot and prepare the ZIP|Adm|`{kind: "full"}`|`201 Export` (status `ready`)|403 (AC-EXP-04), 429 (3 per hour)|
|GET|`/exports`|Recent exports (last 10) and last successful one|Adm|—|`200 \[Export]`|403|
|GET|`/exports/{id}`|One export|Adm|—|`200 Export`|403, 404|
|GET|`/exports/{id}/download`|**Streams the ZIP**|Adm session, **or** the export's `t` token|`?part=1` (default 1), `?t=<token>`|`200 application/zip` stream|401, 403, 404, 410 `export\_expired`|

**Step 1 — snapshot (`POST /exports`).**

* One read transaction: `START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY` (FEATURES B8 "consistent snapshot").
* Writes to `<private root>/exports/<export id>/`: `README.txt`, `csv/<table>.csv` (every table incl. deleted rows, no password hashes, no sessions), `csv/audit\_log.csv`, `json/all.json` (paise and UTC, for machine restore), `summary.html` (print-ready), and `manifest.json` listing the `files` rows to include.
* CSV: UTF-8 with BOM, RFC 4180, IST dates, rupees with 2 decimals, formula-safe (`'` before `=`, `@`, and `+`/`-` that aren't phones or numbers) (FEATURES B8).
* Size: a few MB; takes a few seconds for 2,000 families. The UI shows "Preparing export…" until the `201`.
* Parts: if files total > 200 MB, `parts` > 1. Part 1 = data + summary + files up to 200 MB; parts 2…n = more files.
* Audited (`export`). Recorded in `exports`.

**Step 2 — download (`GET /exports/{id}/download`).**

* The ZIP is **built while streaming** (ZipStream-PHP, MIT): data files compressed, photos and PDFs stored as is (already compressed). No second copy of every file on disk, so storage use doesn't double.
* `Content-Type: application/zip`, `Content-Disposition: attachment; filename="wedding-export\_2026-10-08.zip"` (part 2: `wedding-export\_2026-10-08\_files-part2.zip`), `Cache-Control: private, no-store`, chunked transfer.
* Documents inside: `documents/<id>\_<safe-title>.<ext>`, mapped in `csv/documents.csv`, including files of deleted documents (FEATURES B8).
* Valid **24 hours** after creation. Then `410 export\_expired` and the snapshot folder is deleted by cron; the `exports` row stays (status `expired`).
* Each download is audited.

**Why a download token as well as the cookie (answered: yes).** On iPhone, a file download from the installed app can open in a system browser sheet that doesn't share the app's cookies. So `Export.download\_url` carries `?t=<token>`: 32 random bytes, only its hash stored (`exports.download\_token\_hash`), valid for this export only and only until it expires. Pages send `Referrer-Policy: no-referrer`, so the token doesn't leak. A logged-in admin can also download with the cookie alone.

`Export` shape:

```json
{ "id": "01JA7W…", "kind": "full", "status": "ready", "parts": 2,
  "size\_bytes": 3145728, "files\_bytes": 318767104,
  "created\_at": "2026-10-08T09:30:00Z", "expires\_at": "2026-10-09T09:30:00Z",
  "download\_urls": \[ "/api/v1/exports/01JA7W…/download?part=1\&t=Zx…",
                     "/api/v1/exports/01JA7W…/download?part=2\&t=Zx…" ],
  "requested\_by": { "id": "01JA…", "name": "Ayush" } }
```

`download\_urls` with the token are only in the `201` reply. `GET /exports` returns plain URLs (cookie needed).

### 9.2 Changes since: `GET /api/v1/sync`

For refreshing the read-only offline cache (CONTEXT 7, 11). Nothing is uploaded through sync.

|Param|Rule|
|-|-|
|`since`|UTC timestamp from the previous `next\_since`. Omit for a full snapshot (first load, or "Refresh for wedding day").|
|`cursor`|Continue the same sync when `has\_more` was true|
|`limit`|Rows per page, default 500, max 1,000|
|`types`|Optional, e.g. `types=events,households,invitations`|

Who: All. Every row is filtered exactly like the normal endpoints (money, private documents). Rate limit 30 per 5 min.

```http
GET /api/v1/sync?since=2026-10-08T08:58:00Z
```

```json
{ "ok": true,
  "data": {
    "server\_time": "2026-10-08T09:00:00Z",
    "next\_since": "2026-10-08T08:58:00Z",
    "has\_more": false,
    "cursor": null,
    "full\_resync\_required": false,
    "changes": {
      "households": \[ { "id": "01JA7Q3M…", "version": 5, "name": "Ramesh Sharma \& family", "…": "…" } ],
      "invitations": \[ { "household\_id": "01JA7Q3M…", "event\_id": "01M4DK5T3E6QZBMNQ0V7KQWW23",
                         "version": 3, "rsvp": "coming", "…": "…" } ],
      "tasks": \[], "events": \[], "vendors": \[], "tags": \[], "documents": \[], "members": \[], "settings": null
    },
    "deleted": \[
      { "type": "task", "id": "01JA7S9F…", "deleted\_at": "2026-10-08T08:59:10Z" },
      { "type": "invitation", "household\_id": "01JA7Z…", "event\_id": "01M4DK5T3JCJAF3HDCPWRTYSHQ", "deleted\_at": "2026-10-08T08:59:40Z" }
    ]
  },
  "meta": { "request\_id": "r\_s1", "server\_time": "2026-10-08T09:00:00Z" } }
```

Rules:

|Rule|Why|
|-|-|
|A row is "changed" if `updated\_at >= since`. A child change (checklist tick, invitation) sends the parent or the invitation. Restored rows come back as changed.|Simple, uses existing columns|
|`deleted` lists rows whose `deleted\_at >= since`|Lets the cache drop them|
|`next\_since` = `server\_time − 120 s`|DATETIME has 1 s precision, and a save that started just before `since` may commit after. The overlap catches it.|
|The client keeps the higher `version` when a row arrives twice|Overlap makes duplicates harmless|
|`full\_resync\_required: true` when `since` is older than 30 days, or this user's role, money access or active state changed after `since`, or the schema version changed|Rows the user can no longer see can't be listed as "deleted" safely; a full reload is simpler|
|Payments and categories only for $. Documents: details only, never file bytes.|Same rules as the normal endpoints|
|Bookkeeping fields (`last\_reminder\_opened\_at`, `sessions.last\_used\_at`) don't move `updated\_at` (DATABASE rule 11), so they may be stale in the cache|Acceptable: not needed offline|
|No new index is needed: a full scan of 2,000 families takes milliseconds. Add `(updated\_at)` indexes only if sync gets slow.|Simplest|

\---

## 10\. Rate limits and security headers

### 10.1 Rate limits

All replies over a limit: `429` with `Retry-After` and `retry\_after\_seconds`.

|Bucket|Limit|Key|
|-|-|-|
|Login failures|5 per 15 min → 15 min lock|phone (FEATURES B1)|
|Login failures|20 per 15 min → 15 min lock|IP|
|Password-reset request (when on)|3 per hour; app total 30 emails per day|phone/email; IP 10 per hour|
|Password link inspect + complete|10 per 15 min|IP|
|`/setup/owner`|5 per hour|IP|
|Any request without a session|60 per min|IP|
|Reads with a session|600 per 5 min|session|
|Writes|120 per 5 min|user|
|Bulk actions, import preview, import|10 per 10 min|user|
|Uploads|60 per hour and 200 MB per hour|user|
|Export create|3 per hour|user|
|Export download|20 per hour|export|
|Sync|30 per 5 min|session|
|`/health` (no session)|30 per min|IP|

The limits are generous for 30 family members and tight enough to stop a script guessing passwords or links. Behind Hostinger's proxy, the client IP comes from the platform's forwarding header only if `TRUSTED\_PROXY` in `.env` is set; otherwise `REMOTE\_ADDR`.

### 10.2 Storage

Login limits use `login\_attempts` (exists). Everything else uses `rate\_limits`, added by migration **`003\_api\_support.sql`** (delivered with this document; run it after `002`, steps as in DATABASE §6):

|Column|Use|
|-|-|
|`bucket`|Which limit and for whom, e.g. `write:user:12`, `anon:ip:103.21.58.10`|
|`window\_start`|UTC start of the fixed window (e.g. the 5-minute slot)|
|`hits`|Requests counted in that window|

`003` also gives any checklist item without a `client\_uuid` one (API11), without touching `updated\_at` or `version`. Tested on MySQL 8.0.46 and MariaDB 10.11.14: runs clean, a second run stops at the guard, the upsert below counts correctly.

One statement per request: `INSERT … ON DUPLICATE KEY UPDATE hits = hits + 1`, then compare. The daily cron deletes old windows (same rule as `sessions`). The card-tracking example in DATABASE §6 is now numbered `004`.

### 10.3 Security headers

|Header|Value|Where|
|-|-|-|
|`Strict-Transport-Security`|`max-age=31536000`|All responses (HTTPS only; HTTP redirects to HTTPS)|
|`Content-Security-Policy`|`default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`|App pages (`.htaccess`)|
|`Content-Security-Policy`|`default-src 'none'; frame-ancestors 'none'`|API JSON responses|
|`X-Content-Type-Options`|`nosniff`|All|
|`X-Frame-Options`|`DENY`|All (older browsers)|
|`Referrer-Policy`|`no-referrer`|All (keeps link tokens private)|
|`Permissions-Policy`|`camera=(self), microphone=(), geolocation=(), payment=(), usb=()`|App pages|
|`Cross-Origin-Opener-Policy`|`same-origin`|App pages|
|`Cross-Origin-Resource-Policy`|`same-origin`|All|
|`X-Robots-Tag`|`noindex, nofollow`|All (CONTEXT risk 6)|
|`Cache-Control`|`no-store`|All API responses (JSON and files). App shell files: long cache with hashed names; `index.html` and `sw.js`: `no-cache`.|
|CORS|**None.** No `Access-Control-Allow-\*` headers. Cross-origin calls fail.|API|

Other server rules:

* Only `GET`, `POST`, `PUT`, `PATCH`, `DELETE` reach the API; others get `405`.
* JSON body max 1 MB, except import (5 MB) and upload (16 MB).
* `.env`, uploads, exports and backups live outside `public\_html`.
* PHP `expose\_php=Off`; no PHP version in headers or errors; `display\_errors=Off`.
* All SQL through PDO prepared statements; strict `sql\_mode` (DATABASE rule 1).
* `wa.me` links are built on the phone; the API never calls WhatsApp.

\---

## 11\. Health

`GET /api/v1/health`

|Caller|Reply|
|-|-|
|No session (free uptime monitor)|`200 {"status": "ok"}` or `503 {"status": "fail"}`. `fail` when the `database` or `backup` check is red. Only that one word is revealed.|
|Logged-in admin|Full detail below. Powers Home → Safety and Settings → Safety.|
|Other members|Same as no session.|

Overall `status` = the worst check. Each check is `green`, `amber`, `red`, or `not\_in\_use`.

|Check|Green|Amber|Red|How|
|-|-|-|-|-|
|`database`|`SELECT 1` < 500 ms and schema at the expected version|slow (≥ 500 ms)|error, or a migration has `finished\_at` NULL, or version below `EXPECTED\_SCHEMA\_VERSION`|DATABASE §7.6, rule 14|
|`storage`|files + exports + DB < 70 % of `STORAGE\_QUOTA\_BYTES`|70–85 %|> 85 %, or DB > 80 % of `DB\_QUOTA\_BYTES` (3 GB plan cap), or free space on the private folder < 1 GB|`SUM(files.size\_bytes)`, folder sizes, `information\_schema` table sizes|
|`backup`|last `ok` run < 26 h ago|last run failed but an `ok` one is < 26 h|no `ok` run in 26 h, or audit tamper check failed|DATABASE §7.6|
|`audit\_log`|count and max id never went down|—|either went down since the previous good backup|`002` step C|
|`restore\_drill`|last passed drill ≤ 35 days|> 35 days or none|—|FEATURES B10|
|`reminders`|**R1: `not\_in\_use`.** From R2a: last run < 30 min|—|last run > 30 min ago (R2a)|CONTEXT 10|
|`last\_export`|info only|—|—|`exports`|

Example (admin):

```json
{ "ok": true,
  "data": {
    "status": "amber",
    "checked\_at": "2026-10-08T09:40:00Z",
    "app\_version": "1.0.7",
    "checks": {
      "database": { "status": "green", "latency\_ms": 4, "schema\_version": 3, "expected\_schema\_version": 3 },
      "storage":  { "status": "green", "used\_bytes": 1288490188, "quota\_bytes": 53687091200, "used\_pct": 2.4,
                    "db\_bytes": 41943040, "db\_quota\_bytes": 3221225472, "files\_bytes": 1210000000,
                    "exports\_bytes": 36547148, "private\_folder\_free\_bytes": 912680550400 },
      "backup":   { "status": "green", "last\_ok\_at": "2026-10-07T21:32:10Z", "hours\_ago": 12.1,
                    "last\_run\_status": "ok", "destination": "gdrive:A\&M backups" },
      "audit\_log": { "status": "green", "row\_count": 18234, "max\_id": 18240 },
      "restore\_drill": { "status": "amber", "last\_passed\_on": "2026-08-30", "days\_ago": 39 },
      "reminders": { "status": "not\_in\_use", "last\_run\_at": null },
      "last\_export": { "at": "2026-10-01T10:00:00Z", "by": "Ayush" }
    },
    "trash\_batches": 6,
    "server\_time": "2026-10-08T09:40:00Z",
    "php\_version": "8.2"
  },
  "meta": { "request\_id": "r\_h1", "server\_time": "2026-10-08T09:40:00Z" } }
```

Uptime monitor (answered: use this endpoint): a free external monitor (e.g. UptimeRobot's free plan) calls the anonymous `GET /api/v1/health` every 5 minutes and emails the couple on `503`, i.e. when the database is down or the nightly backup is missed. It sees only "ok" or "fail".

\---

## 12\. OpenAPI 3.1

The same contract in machine-readable form. Copy it into `openapi.yaml` to generate a typed API client or view it in Swagger UI / Redocly. It passes `openapi-spec-validator` (OpenAPI 3.1): 74 paths, 107 operations. Error codes and messages are in §2.3; the YAML points to them through the shared `Error` responses.

```yaml
openapi: 3.1.0
info:
  title: A\&M Wedding API
  version: 1.1.0
  summary: REST contract between the A\&M Wedding PWA and its PHP backend.
  description: |
    Single-wedding planner. Same origin as the PWA, JSON only, no CORS.
    - IDs in URLs and JSON are ULID public\_ids. Numeric IDs never leave the server.
    - Date-times are ISO 8601 UTC with Z. Dates are IST calendar dates. Money is integer paise.
    - Every reply uses the envelope {ok, data, meta} or {ok:false, error, meta}.
    - Every write while logged in sends X-CSRF-Token and Idempotency-Key.
    - Every PATCH, PUT on an existing record, and single-record DELETE sends If-Match with the version.
    - All requests should send X-Client-Version and X-Device.
    - x-permission on each operation: All, Ed (Owner, Partner, Family), Adm (Owner, Partner), Own, $ (money users), Self.
servers:
  - url: https://{subdomain}.lumorrahouse.com/api/v1
    variables:
      subdomain:
        default: wedding
        description: wedding.lumorrahouse.com (API14). Read from APP\_URL in .env.
security:
  - sessionCookie: \[]
tags:
  - name: Auth
  - name: Members
  - name: Settings
  - name: Dashboard
  - name: Events
  - name: Tasks
  - name: Guests
  - name: Imports
  - name: Money
  - name: Documents
  - name: History
  - name: Trash
  - name: Export
  - name: Sync
  - name: Health

paths:
  # ---------------------------------------------------------------- Auth
  /auth/login:
    post:
      tags: \[Auth]
      operationId: login
      summary: Log in with phone and password
      x-permission: Anyone
      security: \[]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/LoginRequest' }
      responses:
        '200':
          description: Logged in. Sets the \_\_Host-am\_session cookie.
          headers:
            Set-Cookie: { schema: { type: string }, description: '\_\_Host-am\_session=...; Max-Age=7776000; Path=/; Secure; HttpOnly; SameSite=Lax' }
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Ok'
                  - properties: { data: { $ref: '#/components/schemas/AuthResult' } }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '403': { $ref: '#/components/responses/Forbidden' }
        '429': { $ref: '#/components/responses/TooManyRequests' }
        default: { $ref: '#/components/responses/Error' }
  /auth/logout:
    post:
      tags: \[Auth]
      operationId: logout
      summary: Log out this phone
      x-permission: Self
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      responses:
        '200': { $ref: '#/components/responses/Empty' }
        default: { $ref: '#/components/responses/Error' }
  /auth/logout-all:
    post:
      tags: \[Auth]
      operationId: logoutAll
      summary: Log out all my phones
      x-permission: Self
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      responses:
        '200':
          description: All my sessions revoked
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Ok'
                  - properties: { data: { type: object, properties: { sessions\_revoked: { type: integer } } } }
        default: { $ref: '#/components/responses/Error' }
  /session:
    get:
      tags: \[Auth]
      operationId: getSession
      summary: Current user, permissions and CSRF token. This is the refresh (slides the 90 days).
      x-permission: Self
      responses:
        '200':
          description: Session info
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Ok'
                  - properties: { data: { $ref: '#/components/schemas/SessionInfo' } }
        '401': { $ref: '#/components/responses/Unauthorized' }
        default: { $ref: '#/components/responses/Error' }
  /auth/password/change:
    post:
      tags: \[Auth]
      operationId: changePassword
      summary: Change my password. Other sessions are revoked; this one gets a new cookie.
      x-permission: Self
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IdempotencyKey' } ]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: \[current\_password, new\_password]
              properties:
                current\_password: { type: string }
                new\_password: { $ref: '#/components/schemas/NewPassword' }
      responses:
        '200':
          description: Changed
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Ok'
                  - properties: { data: { $ref: '#/components/schemas/AuthResult' } }
        '422': { $ref: '#/components/responses/Unprocessable' }
        default: { $ref: '#/components/responses/Error' }
  /auth/password-reset/request:
    post:
      tags: \[Auth]
      operationId: requestPasswordReset
      summary: Email a reset link. Off until MAIL\_ENABLED. Always 202.
      x-permission: Anyone
      x-release: Off in R1 (API1)
      security: \[]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                phone: { type: string }
                email: { type: string, format: email }
      responses:
        '202': { $ref: '#/components/responses/Empty' }
        '429': { $ref: '#/components/responses/TooManyRequests' }
        default: { $ref: '#/components/responses/Error' }
  /auth/password-link/inspect:
    post:
      tags: \[Auth]
      operationId: inspectPasswordLink
      summary: Check an invite or reset link before showing the form
      x-permission: Anyone
      security: \[]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/LinkToken' }
      responses:
        '200':
          description: Link is valid
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Ok'
                  - properties:
                      data:
                        type: object
                        properties:
                          purpose: { type: string, enum: \[invite, reset] }
                          name: { type: string }
                          phone\_masked: { type: string, examples: \['+91 98••• ••345'] }
                          expires\_at: { $ref: '#/components/schemas/DateTime' }
        '410': { $ref: '#/components/responses/Gone' }
        default: { $ref: '#/components/responses/Error' }
  /auth/password-link/complete:
    post:
      tags: \[Auth]
      operationId: completePasswordLink
      summary: Set a password from a link and log in
      x-permission: Anyone
      security: \[]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              allOf:
                - $ref: '#/components/schemas/LinkToken'
                - type: object
                  required: \[new\_password]
                  properties:
                    new\_password: { $ref: '#/components/schemas/NewPassword' }
      responses:
        '200':
          description: Password set, logged in (cookie set)
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Ok'
                  - properties: { data: { $ref: '#/components/schemas/AuthResult' } }
        '410': { $ref: '#/components/responses/Gone' }
        '422': { $ref: '#/components/responses/Unprocessable' }
        default: { $ref: '#/components/responses/Error' }
  /setup/owner:
    post:
      tags: \[Auth]
      operationId: setupOwner
      summary: First run only. Creates the Owner. Disabled once an owner exists.
      x-permission: Holder of SETUP\_TOKEN
      security: \[]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: \[setup\_token, name, phone, password]
              properties:
                setup\_token: { type: string }
                name: { type: string, minLength: 1, maxLength: 80 }
                phone: { $ref: '#/components/schemas/Phone' }
                password: { $ref: '#/components/schemas/NewPassword' }
      responses:
        '201':
          description: Owner created and logged in
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Ok'
                  - properties: { data: { $ref: '#/components/schemas/AuthResult' } }
        '403': { $ref: '#/components/responses/Forbidden' }
        '410': { $ref: '#/components/responses/Gone' }
        default: { $ref: '#/components/responses/Error' }

  # ---------------------------------------------------------------- Members
  /members:
    get:
      tags: \[Members]
      operationId: listMembers
      summary: All members (not paged). Family and Viewer get id, name, phone, role, left only.
      x-permission: All
      parameters:
        - { name: include\_inactive, in: query, schema: { type: boolean }, description: Adm only }
      responses:
        '200': { $ref: '#/components/responses/MemberList' }
        default: { $ref: '#/components/responses/Error' }
    post:
      tags: \[Members]
      operationId: createMember
      summary: Add a member and set a password or make an invite link
      x-permission: Adm
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IdempotencyKey' } ]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/MemberCreate' }
      responses:
        '201':
          description: Created. Secrets appear once and are never stored in the idempotent reply.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Ok'
                  - properties: { data: { $ref: '#/components/schemas/MemberCreated' } }
        '403': { $ref: '#/components/responses/Forbidden' }
        '409': { $ref: '#/components/responses/Conflict' }
        '422': { $ref: '#/components/responses/Unprocessable' }
        default: { $ref: '#/components/responses/Error' }
  /members/{id}:
    parameters: \[ { $ref: '#/components/parameters/Id' } ]
    get:
      tags: \[Members]
      operationId: getMember
      summary: One member with last seen and devices
      x-permission: Adm, Self
      responses:
        '200': { $ref: '#/components/responses/MemberOne' }
        '403': { $ref: '#/components/responses/Forbidden' }
        '404': { $ref: '#/components/responses/NotFound' }
        default: { $ref: '#/components/responses/Error' }
    patch:
      tags: \[Members]
      operationId: updateMember
      summary: Edit a member. Deactivate with is\_active false. Members are never deleted.
      x-permission: Adm; Self (name only)
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IfMatch' }, { $ref: '#/components/parameters/IdempotencyKey' } ]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/MemberUpdate' }
      responses:
        '200': { $ref: '#/components/responses/MemberOne' }
        '403': { $ref: '#/components/responses/Forbidden' }
        '409': { $ref: '#/components/responses/Conflict' }
        '422': { $ref: '#/components/responses/Unprocessable' }
        default: { $ref: '#/components/responses/Error' }
  /members/{id}/password-reset:
    parameters: \[ { $ref: '#/components/parameters/Id' } ]
    post:
      tags: \[Members]
      operationId: resetMemberPassword
      summary: Admin reset. Revokes all of that member's sessions.
      x-permission: Adm (Partner cannot reset the Owner)
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IdempotencyKey' } ]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: \[mode]
              properties:
                mode: { type: string, enum: \[set, generate, link] }
                password: { $ref: '#/components/schemas/NewPassword' }
      responses:
        '200':
          description: Reset done
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Ok'
                  - properties:
                      data:
                        type: object
                        properties:
                          password\_once: { type: \[string, 'null'] }
                          setup\_link: { type: \[string, 'null'] }
                          setup\_link\_expires\_at: { oneOf: \[ { $ref: '#/components/schemas/DateTime' }, { type: 'null' } ] }
                          sessions\_revoked: { type: integer }
        '403': { $ref: '#/components/responses/Forbidden' }
        '404': { $ref: '#/components/responses/NotFound' }
        default: { $ref: '#/components/responses/Error' }
  /me/sessions:
    get:
      tags: \[Members]
      operationId: mySessions
      summary: My logged-in phones
      x-permission: Self
      responses:
        '200':
          description: Sessions
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Ok'
                  - properties:
                      data:
                        type: array
                        items:
                          type: object
                          properties:
                            device\_label: { type: \[string, 'null'] }
                            last\_used\_at: { $ref: '#/components/schemas/DateTime' }
                            current: { type: boolean }
        default: { $ref: '#/components/responses/Error' }

  # ---------------------------------------------------------------- Settings \& safety
  /settings:
    get:
      tags: \[Settings]
      operationId: getSettings
      summary: Wedding facts (total budget only for money users)
      x-permission: All
      responses:
        '200': { $ref: '#/components/responses/SettingsOne' }
        default: { $ref: '#/components/responses/Error' }
    patch:
      tags: \[Settings]
      operationId: updateSettings
      summary: Edit wedding facts
      x-permission: Adm
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IfMatch' }, { $ref: '#/components/parameters/IdempotencyKey' } ]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/SettingsUpdate' }
      responses:
        '200': { $ref: '#/components/responses/SettingsOne' }
        '403': { $ref: '#/components/responses/Forbidden' }
        '409': { $ref: '#/components/responses/Conflict' }
        '422': { $ref: '#/components/responses/Unprocessable' }
        default: { $ref: '#/components/responses/Error' }
  /settings/history:
    get:
      tags: \[Settings, History]
      operationId: settingsHistory
      summary: History of settings changes
      x-permission: Adm
      parameters: \[ { $ref: '#/components/parameters/Cursor' }, { $ref: '#/components/parameters/Limit' } ]
      responses:
        '200': { $ref: '#/components/responses/HistoryList' }
        default: { $ref: '#/components/responses/Error' }
  /backups:
    get:
      tags: \[Settings]
      operationId: listBackups
      summary: Last backup runs
      x-permission: Adm
      parameters:
        - { name: limit, in: query, schema: { type: integer, minimum: 1, maximum: 60, default: 7 } }
      responses:
        '200':
          description: Backup runs, newest first
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Ok'
                  - properties: { data: { type: array, items: { $ref: '#/components/schemas/BackupRun' } } }
        '403': { $ref: '#/components/responses/Forbidden' }
        default: { $ref: '#/components/responses/Error' }
  /restore-drills:
    get:
      tags: \[Settings]
      operationId: listRestoreDrills
      summary: Restore drill log
      x-permission: Adm
      responses:
        '200':
          description: Drills
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Ok'
                  - properties: { data: { type: array, items: { $ref: '#/components/schemas/RestoreDrill' } } }
        default: { $ref: '#/components/responses/Error' }
    post:
      tags: \[Settings]
      operationId: createRestoreDrill
      summary: Log a restore drill
      x-permission: Adm
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IdempotencyKey' } ]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/RestoreDrillInput' }
      responses:
        '201': { $ref: '#/components/responses/RestoreDrillOne' }
        '422': { $ref: '#/components/responses/Unprocessable' }
        default: { $ref: '#/components/responses/Error' }
  /restore-drills/{id}:
    parameters: \[ { $ref: '#/components/parameters/Id' } ]
    patch:
      tags: \[Settings]
      operationId: updateRestoreDrill
      summary: Fix a drill entry
      x-permission: Adm
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IfMatch' }, { $ref: '#/components/parameters/IdempotencyKey' } ]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/RestoreDrillInput' }
      responses:
        '200': { $ref: '#/components/responses/RestoreDrillOne' }
        '409': { $ref: '#/components/responses/Conflict' }
        default: { $ref: '#/components/responses/Error' }
    delete:
      tags: \[Settings]
      operationId: deleteRestoreDrill
      summary: Soft delete a drill entry
      x-permission: Adm
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IfMatch' }, { $ref: '#/components/parameters/IdempotencyKey' } ]
      responses:
        '200': { $ref: '#/components/responses/Deleted' }
        '409': { $ref: '#/components/responses/Conflict' }
        default: { $ref: '#/components/responses/Error' }

  # ---------------------------------------------------------------- Dashboard \& calendar
  /dashboard:
    get:
      tags: \[Dashboard]
      operationId: getDashboard
      summary: All Home cards this user may see, in one call
      x-permission: All (cards filtered by role and money)
      parameters:
        - { name: payments\_window\_days, in: query, schema: { type: integer, minimum: 1, maximum: 90, default: 14 } }
      responses:
        '200':
          description: Cards
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Ok'
                  - properties: { data: { $ref: '#/components/schemas/Dashboard' } }
        default: { $ref: '#/components/responses/Error' }
  /calendar:
    get:
      tags: \[Dashboard]
      operationId: getCalendar
      summary: Events, open tasks with a due date, and due payments ($) in a date range
      x-permission: All (payments only $)
      parameters:
        - { name: from, in: query, required: true, schema: { $ref: '#/components/schemas/Date' } }
        - { name: to, in: query, required: true, schema: { $ref: '#/components/schemas/Date' }, description: Max 93 days after from }
        - { name: types, in: query, schema: { type: string, examples: \['event,task,payment'] } }
        - { name: mine, in: query, schema: { type: boolean } }
        - { name: include\_undated, in: query, schema: { type: boolean } }
      responses:
        '200':
          description: Days with items
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Ok'
                  - properties:
                      data:
                        type: object
                        properties:
                          days:
                            type: array
                            items:
                              type: object
                              properties:
                                date: { $ref: '#/components/schemas/Date' }
                                items: { type: array, items: { $ref: '#/components/schemas/CalendarItem' } }
                          undated: { type: array, items: { $ref: '#/components/schemas/Event' } }
        '422': { $ref: '#/components/responses/Unprocessable' }
        default: { $ref: '#/components/responses/Error' }

  # ---------------------------------------------------------------- Events
  /events:
    get:
      tags: \[Events]
      operationId: listEvents
      summary: All events (not paged)
      x-permission: All
      parameters:
        - { name: guests\_invited, in: query, schema: { type: boolean } }
      responses:
        '200':
          description: Events
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Ok'
                  - properties: { data: { type: array, items: { $ref: '#/components/schemas/Event' } } }
        default: { $ref: '#/components/responses/Error' }
    post:
      tags: \[Events]
      operationId: createEvent
      summary: Add a custom event
      x-permission: Adm
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IdempotencyKey' } ]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/EventCreate' }
      responses:
        '201': { $ref: '#/components/responses/EventOne' }
        '403': { $ref: '#/components/responses/Forbidden' }
        '409': { $ref: '#/components/responses/Conflict' }
        '422': { $ref: '#/components/responses/Unprocessable' }
        default: { $ref: '#/components/responses/Error' }
  /events/{id}:
    parameters: \[ { $ref: '#/components/parameters/Id' } ]
    get:
      tags: \[Events]
      operationId: getEvent
      summary: Event page with counts
      x-permission: All
      responses:
        '200': { $ref: '#/components/responses/EventOne' }
        '404': { $ref: '#/components/responses/NotFound' }
        default: { $ref: '#/components/responses/Error' }
    patch:
      tags: \[Events]
      operationId: updateEvent
      summary: Edit an event
      x-permission: Adm
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IfMatch' }, { $ref: '#/components/parameters/IdempotencyKey' } ]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/EventUpdate' }
      responses:
        '200': { $ref: '#/components/responses/EventOne' }
        '403': { $ref: '#/components/responses/Forbidden' }
        '409': { $ref: '#/components/responses/Conflict' }
        '422': { $ref: '#/components/responses/Unprocessable' }
        default: { $ref: '#/components/responses/Error' }
    delete:
      tags: \[Events]
      operationId: deleteEvent
      summary: Soft delete; invitations go in the same batch
      x-permission: Adm
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IfMatch' }, { $ref: '#/components/parameters/IdempotencyKey' } ]
      responses:
        '200': { $ref: '#/components/responses/Deleted' }
        '403': { $ref: '#/components/responses/Forbidden' }
        '409': { $ref: '#/components/responses/Conflict' }
        default: { $ref: '#/components/responses/Error' }
  /events/{id}/headcount:
    parameters: \[ { $ref: '#/components/parameters/Id' } ]
    get:
      tags: \[Events]
      operationId: getEventHeadcount
      summary: People coming, waiting, not asked, not coming, Jain
      x-permission: All
      responses:
        '200':
          description: Headcount
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Ok'
                  - properties: { data: { $ref: '#/components/schemas/Headcount' } }
        '404': { $ref: '#/components/responses/NotFound' }
        default: { $ref: '#/components/responses/Error' }
  /events/{id}/delete-preview:
    parameters: \[ { $ref: '#/components/parameters/Id' } ]
    get:
      tags: \[Events]
      operationId: eventDeletePreview
      summary: Counts shown in the delete dialog
      x-permission: Adm
      responses:
        '200':
          description: Counts
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Ok'
                  - properties:
                      data:
                        type: object
                        properties:
                          tasks: { type: integer }
                          invitations: { type: integer }
                          payments: { type: integer }
                          documents: { type: integer }
        default: { $ref: '#/components/responses/Error' }
  /events/{id}/restore: { $ref: '#/components/pathItems/Restore' }

  # ---------------------------------------------------------------- Tasks
  /tasks:
    get:
      tags: \[Tasks]
      operationId: listTasks
      summary: Tasks with view chips, filters and search
      x-permission: All
      parameters:
        - { name: view, in: query, schema: { type: string, enum: \[mine, all, today, week, overdue, no\_date, closed] } }
        - { name: status, in: query, schema: { type: string }, description: 'Comma list of todo, doing, waiting, done, cancelled' }
        - { name: event, in: query, schema: { $ref: '#/components/schemas/Ulid' } }
        - { name: tag, in: query, schema: { $ref: '#/components/schemas/Ulid' } }
        - { name: assignee, in: query, schema: { $ref: '#/components/schemas/Ulid' } }
        - { name: priority, in: query, schema: { type: string, enum: \[urgent, normal, low] } }
        - { name: vendor, in: query, schema: { $ref: '#/components/schemas/Ulid' } }
        - { name: household, in: query, schema: { $ref: '#/components/schemas/Ulid' } }
        - { $ref: '#/components/parameters/Q' }
        - { name: sort, in: query, schema: { type: string, enum: \[default, due\_date, -created\_at, title] } }
        - { $ref: '#/components/parameters/Limit' }
        - { $ref: '#/components/parameters/Cursor' }
      responses:
        '200':
          description: Page of tasks. meta.chip\_counts has mine, today, week, overdue, no\_date.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/OkPage'
                  - properties: { data: { type: array, items: { $ref: '#/components/schemas/Task' } } }
        default: { $ref: '#/components/responses/Error' }
    post:
      tags: \[Tasks]
      operationId: createTask
      summary: Create a task
      x-permission: Ed
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IdempotencyKey' } ]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/TaskCreate' }
      responses:
        '201': { $ref: '#/components/responses/TaskOne' }
        '403': { $ref: '#/components/responses/Forbidden' }
        '409': { $ref: '#/components/responses/Conflict' }
        '422': { $ref: '#/components/responses/Unprocessable' }
        default: { $ref: '#/components/responses/Error' }
  /tasks/{id}:
    parameters: \[ { $ref: '#/components/parameters/Id' } ]
    get:
      tags: \[Tasks]
      operationId: getTask
      summary: One task with assignees, tags and checklist
      x-permission: All
      responses:
        '200': { $ref: '#/components/responses/TaskOne' }
        '404': { $ref: '#/components/responses/NotFound' }
        default: { $ref: '#/components/responses/Error' }
    patch:
      tags: \[Tasks]
      operationId: updateTask
      summary: Edit a task. Lists given here replace the whole list and bump the task version.
      x-permission: Ed
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IfMatch' }, { $ref: '#/components/parameters/IdempotencyKey' } ]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/TaskUpdate' }
      responses:
        '200': { $ref: '#/components/responses/TaskOne' }
        '409': { $ref: '#/components/responses/Conflict' }
        '422': { $ref: '#/components/responses/Unprocessable' }
        default: { $ref: '#/components/responses/Error' }
    delete:
      tags: \[Tasks]
      operationId: deleteTask
      summary: Soft delete with checklist, assignees and tags
      x-permission: Adm any task; Family own tasks only (created by or assigned to them)
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IfMatch' }, { $ref: '#/components/parameters/IdempotencyKey' } ]
      responses:
        '200': { $ref: '#/components/responses/Deleted' }
        '409': { $ref: '#/components/responses/Conflict' }
        '403': { $ref: '#/components/responses/Forbidden' }
        default: { $ref: '#/components/responses/Error' }
  /tasks/{id}/done:
    parameters: \[ { $ref: '#/components/parameters/Id' } ]
    post:
      tags: \[Tasks]
      operationId: markTaskDone
      summary: Tick done. If already done, 200 with meta.already\_done.
      x-permission: Ed
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IfMatch' }, { $ref: '#/components/parameters/IdempotencyKey' } ]
      responses:
        '200': { $ref: '#/components/responses/TaskOne' }
        '409': { $ref: '#/components/responses/Conflict' }
        default: { $ref: '#/components/responses/Error' }
  /tasks/{id}/restore: { $ref: '#/components/pathItems/Restore' }
  /tasks/{id}/items:
    parameters: \[ { $ref: '#/components/parameters/Id' } ]
    post:
      tags: \[Tasks]
      operationId: addTaskItem
      summary: Add a checklist item. key = the item's UUID = Idempotency-Key.
      x-permission: Ed
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IdempotencyKey' } ]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: \[key, text]
              properties:
                key: { $ref: '#/components/schemas/Uuid' }
                text: { type: string, minLength: 1, maxLength: 200 }
                sort\_order: { type: integer }
      responses:
        '201': { $ref: '#/components/responses/TaskItemOne' }
        '404': { $ref: '#/components/responses/NotFound' }
        '422': { $ref: '#/components/responses/Unprocessable' }
        default: { $ref: '#/components/responses/Error' }
  /tasks/{id}/items/{key}:
    parameters:
      - { $ref: '#/components/parameters/Id' }
      - { name: key, in: path, required: true, schema: { $ref: '#/components/schemas/Uuid' } }
    patch:
      tags: \[Tasks]
      operationId: updateTaskItem
      summary: Tick, rename or reorder one item. If-Match is the item's version.
      x-permission: Ed
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IfMatch' }, { $ref: '#/components/parameters/IdempotencyKey' } ]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                text: { type: string, minLength: 1, maxLength: 200 }
                is\_done: { type: boolean }
                sort\_order: { type: integer }
      responses:
        '200': { $ref: '#/components/responses/TaskItemOne' }
        '409': { $ref: '#/components/responses/Conflict' }
        default: { $ref: '#/components/responses/Error' }
    delete:
      tags: \[Tasks]
      operationId: deleteTaskItem
      summary: Remove an item (soft)
      x-permission: Ed
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IfMatch' }, { $ref: '#/components/parameters/IdempotencyKey' } ]
      responses:
        '200': { $ref: '#/components/responses/Deleted' }
        '409': { $ref: '#/components/responses/Conflict' }
        default: { $ref: '#/components/responses/Error' }
  /tags:
    get:
      tags: \[Tasks]
      operationId: listTags
      summary: All tags with task counts
      x-permission: All
      responses:
        '200':
          description: Tags
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Ok'
                  - properties: { data: { type: array, items: { $ref: '#/components/schemas/Tag' } } }
        default: { $ref: '#/components/responses/Error' }
    post:
      tags: \[Tasks]
      operationId: createTag
      summary: Create a tag
      x-permission: Ed
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IdempotencyKey' } ]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/TagInput' }
      responses:
        '201': { $ref: '#/components/responses/TagOne' }
        '409': { $ref: '#/components/responses/Conflict' }
        '422': { $ref: '#/components/responses/Unprocessable' }
        default: { $ref: '#/components/responses/Error' }
  /tags/{id}:
    parameters: \[ { $ref: '#/components/parameters/Id' } ]
    patch:
      tags: \[Tasks]
      operationId: renameTag
      summary: Rename a tag
      x-permission: Adm
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IfMatch' }, { $ref: '#/components/parameters/IdempotencyKey' } ]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/TagInput' }
      responses:
        '200': { $ref: '#/components/responses/TagOne' }
        '409': { $ref: '#/components/responses/Conflict' }
        default: { $ref: '#/components/responses/Error' }
    delete:
      tags: \[Tasks]
      operationId: deleteTag
      summary: Soft delete; removes it from tasks in the same batch
      x-permission: Adm
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IfMatch' }, { $ref: '#/components/parameters/IdempotencyKey' } ]
      responses:
        '200': { $ref: '#/components/responses/Deleted' }
        default: { $ref: '#/components/responses/Error' }
  /tags/{id}/restore: { $ref: '#/components/pathItems/Restore' }

  # ---------------------------------------------------------------- Guests
  /households:
    get:
      tags: \[Guests]
      operationId: listHouseholds
      summary: Guest list (families). meta.totals.people for the filter.
      x-permission: All
      parameters:
        - { $ref: '#/components/parameters/Q' }
        - { name: side, in: query, schema: { type: string, enum: \[bride, groom, both] } }
        - { name: event, in: query, schema: { $ref: '#/components/schemas/Ulid' } }
        - { name: rsvp, in: query, schema: { type: string }, description: 'Comma list of not\_asked, waiting, coming, not\_coming. Needs event.' }
        - { name: group, in: query, schema: { type: string } }
        - { name: area, in: query, schema: { type: string } }
        - { name: food, in: query, schema: { $ref: '#/components/schemas/Food' } }
        - { name: vip, in: query, schema: { type: boolean } }
        - { name: no\_phone, in: query, schema: { type: boolean } }
        - { name: possible\_duplicates, in: query, schema: { type: boolean } }
        - { name: sort, in: query, schema: { type: string, enum: \[name, -created\_at, area, group] } }
        - { $ref: '#/components/parameters/Limit' }
        - { $ref: '#/components/parameters/Cursor' }
      responses:
        '200':
          description: Page of families
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/OkPage'
                  - properties: { data: { type: array, items: { $ref: '#/components/schemas/Household' } } }
        '422': { $ref: '#/components/responses/Unprocessable' }
        default: { $ref: '#/components/responses/Error' }
    post:
      tags: \[Guests]
      operationId: createHousehold
      summary: Add a family, optionally with invitations
      x-permission: Ed
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IdempotencyKey' } ]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/HouseholdCreate' }
      responses:
        '201': { $ref: '#/components/responses/HouseholdOne' }
        '409': { $ref: '#/components/responses/Conflict' }
        '422': { $ref: '#/components/responses/Unprocessable' }
        default: { $ref: '#/components/responses/Error' }
  /households/duplicate-check:
    get:
      tags: \[Guests]
      operationId: householdDuplicateCheck
      summary: Duplicate hints while typing
      x-permission: Ed
      parameters:
        - { name: phone, in: query, schema: { type: string } }
        - { name: alt\_phone, in: query, schema: { type: string } }
        - { name: name, in: query, schema: { type: string } }
        - { name: city, in: query, schema: { type: string } }
        - { name: exclude, in: query, schema: { $ref: '#/components/schemas/Ulid' } }
      responses:
        '200':
          description: Matches
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Ok'
                  - properties:
                      data:
                        type: object
                        properties:
                          phone\_matches: { type: array, items: { $ref: '#/components/schemas/Match' } }
                          name\_matches: { type: array, items: { $ref: '#/components/schemas/Match' } }
        default: { $ref: '#/components/responses/Error' }
  /households/suggestions:
    get:
      tags: \[Guests]
      operationId: householdSuggestions
      summary: Autocomplete values
      x-permission: Ed
      parameters:
        - { name: field, in: query, required: true, schema: { type: string, enum: \[group\_name, area, relation, city] } }
        - { $ref: '#/components/parameters/Q' }
      responses:
        '200':
          description: Up to 20 values
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Ok'
                  - properties: { data: { type: array, items: { type: string }, maxItems: 20 } }
        default: { $ref: '#/components/responses/Error' }
  /households/export:
    get:
      tags: \[Guests, Export]
      operationId: exportHouseholdsCsv
      summary: Filtered guest list as CSV (UTF-8 BOM, IST, formula-safe). Audited.
      x-permission: Adm
      parameters:
        - { $ref: '#/components/parameters/Q' }
        - { name: side, in: query, schema: { type: string, enum: \[bride, groom, both] } }
        - { name: event, in: query, schema: { $ref: '#/components/schemas/Ulid' } }
        - { name: rsvp, in: query, schema: { type: string } }
      responses:
        '200':
          description: CSV file
          content:
            text/csv:
              schema: { type: string }
        '403': { $ref: '#/components/responses/Forbidden' }
        default: { $ref: '#/components/responses/Error' }
  /households/bulk:
    post:
      tags: \[Guests]
      operationId: bulkHouseholds
      summary: One action on up to 2,000 families, one batch, one Undo
      x-permission: Ed; the delete action is Adm only
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IdempotencyKey' } ]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/BulkRequest' }
      responses:
        '200':
          description: Done
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Ok'
                  - properties: { data: { $ref: '#/components/schemas/BulkResult' } }
        '422': { $ref: '#/components/responses/Unprocessable' }
        '403': { $ref: '#/components/responses/Forbidden' }
        default: { $ref: '#/components/responses/Error' }
  /households/{id}:
    parameters: \[ { $ref: '#/components/parameters/Id' } ]
    get:
      tags: \[Guests]
      operationId: getHousehold
      summary: Family page with invitations
      x-permission: All
      responses:
        '200': { $ref: '#/components/responses/HouseholdOne' }
        '404': { $ref: '#/components/responses/NotFound' }
        default: { $ref: '#/components/responses/Error' }
    patch:
      tags: \[Guests]
      operationId: updateHousehold
      summary: Edit a family (only changed fields)
      x-permission: Ed
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IfMatch' }, { $ref: '#/components/parameters/IdempotencyKey' } ]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/HouseholdUpdate' }
      responses:
        '200': { $ref: '#/components/responses/HouseholdOne' }
        '409': { $ref: '#/components/responses/Conflict' }
        '422': { $ref: '#/components/responses/Unprocessable' }
        default: { $ref: '#/components/responses/Error' }
    delete:
      tags: \[Guests]
      operationId: deleteHousehold
      summary: Soft delete with invitations
      x-permission: Ed
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IfMatch' }, { $ref: '#/components/parameters/IdempotencyKey' } ]
      responses:
        '200': { $ref: '#/components/responses/Deleted' }
        '409': { $ref: '#/components/responses/Conflict' }
        default: { $ref: '#/components/responses/Error' }
  /households/{id}/restore: { $ref: '#/components/pathItems/Restore' }
  /households/{id}/invitations/{event\_id}:
    parameters:
      - { $ref: '#/components/parameters/Id' }
      - { name: event\_id, in: path, required: true, schema: { $ref: '#/components/schemas/Ulid' } }
    put:
      tags: \[Guests]
      operationId: inviteHousehold
      summary: Invite (create or revive). Already invited returns 200 unchanged.
      x-permission: Ed
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IdempotencyKey' } ]
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                expected\_adults: { type: \[integer, 'null'], minimum: 0, maximum: 50 }
                expected\_children: { type: \[integer, 'null'], minimum: 0, maximum: 50 }
      responses:
        '200': { $ref: '#/components/responses/InvitationOne' }
        '201': { $ref: '#/components/responses/InvitationOne' }
        '404': { $ref: '#/components/responses/NotFound' }
        '422': { $ref: '#/components/responses/Unprocessable' }
        default: { $ref: '#/components/responses/Error' }
    patch:
      tags: \[Guests]
      operationId: updateInvitation
      summary: RSVP and expected counts. If-Match is the invitation's version.
      x-permission: Ed
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IfMatch' }, { $ref: '#/components/parameters/IdempotencyKey' } ]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/InvitationUpdate' }
      responses:
        '200': { $ref: '#/components/responses/InvitationOne' }
        '409': { $ref: '#/components/responses/Conflict' }
        '422': { $ref: '#/components/responses/Unprocessable' }
        default: { $ref: '#/components/responses/Error' }
    delete:
      tags: \[Guests]
      operationId: uninviteHousehold
      summary: Remove from event (soft, with Undo)
      x-permission: Ed
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IfMatch' }, { $ref: '#/components/parameters/IdempotencyKey' } ]
      responses:
        '200': { $ref: '#/components/responses/Deleted' }
        '409': { $ref: '#/components/responses/Conflict' }
        default: { $ref: '#/components/responses/Error' }
  /households/{id}/invitations/{event\_id}/whatsapp-opened:
    parameters:
      - { $ref: '#/components/parameters/Id' }
      - { name: event\_id, in: path, required: true, schema: { $ref: '#/components/schemas/Ulid' } }
    post:
      tags: \[Guests]
      operationId: recordWhatsappOpened
      summary: Record a WhatsApp reminder tap. No version bump. Never means sent.
      x-permission: Ed
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IdempotencyKey' } ]
      responses:
        '200':
          description: Recorded
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Ok'
                  - properties: { data: { type: object, properties: { last\_reminder\_opened\_at: { $ref: '#/components/schemas/DateTime' } } } }
        '404': { $ref: '#/components/responses/NotFound' }
        default: { $ref: '#/components/responses/Error' }

  # ---------------------------------------------------------------- Imports
  /imports/preview:
    post:
      tags: \[Imports]
      operationId: previewImport
      summary: Check rows. Writes nothing.
      x-permission: Adm
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IdempotencyKey' } ]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/ImportRequest' }
      responses:
        '200':
          description: Preview
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Ok'
                  - properties: { data: { $ref: '#/components/schemas/ImportPreview' } }
        '413': { $ref: '#/components/responses/PayloadTooLarge' }
        '422': { $ref: '#/components/responses/Unprocessable' }
        '403': { $ref: '#/components/responses/Forbidden' }
        default: { $ref: '#/components/responses/Error' }
  /imports:
    get:
      tags: \[Imports]
      operationId: listImports
      summary: Past imports
      x-permission: Adm
      parameters: \[ { $ref: '#/components/parameters/Cursor' }, { $ref: '#/components/parameters/Limit' } ]
      responses:
        '200':
          description: Imports
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/OkPage'
                  - properties: { data: { type: array, items: { $ref: '#/components/schemas/Import' } } }
        default: { $ref: '#/components/responses/Error' }
    post:
      tags: \[Imports]
      operationId: runImport
      summary: Run the import in one transaction and one batch
      x-permission: Adm
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IdempotencyKey' } ]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/ImportRequest' }
      responses:
        '201':
          description: Imported
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Ok'
                  - properties: { data: { $ref: '#/components/schemas/Import' } }
        '409': { $ref: '#/components/responses/Conflict' }
        '422': { $ref: '#/components/responses/Unprocessable' }
        '403': { $ref: '#/components/responses/Forbidden' }
        default: { $ref: '#/components/responses/Error' }
  /imports/{id}:
    parameters: \[ { $ref: '#/components/parameters/Id' } ]
    get:
      tags: \[Imports]
      operationId: getImport
      summary: One import
      x-permission: Adm
      responses:
        '200':
          description: Import
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Ok'
                  - properties: { data: { $ref: '#/components/schemas/Import' } }
        '404': { $ref: '#/components/responses/NotFound' }
        default: { $ref: '#/components/responses/Error' }
  /imports/{id}/undo:
    parameters: \[ { $ref: '#/components/parameters/Id' } ]
    post:
      tags: \[Imports]
      operationId: undoImport
      summary: Undo this import (no 10-minute limit). Rows edited since are kept and listed.
      x-permission: Adm
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IdempotencyKey' } ]
      responses:
        '200': { $ref: '#/components/responses/UndoDone' }
        default: { $ref: '#/components/responses/Error' }

  # ---------------------------------------------------------------- Money
  /money/summary:
    get:
      tags: \[Money]
      operationId: moneySummary
      summary: Totals card and per-category table
      x-permission: $
      responses:
        '200':
          description: Summary
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Ok'
                  - properties: { data: { $ref: '#/components/schemas/MoneySummary' } }
        '403': { $ref: '#/components/responses/Forbidden' }
        default: { $ref: '#/components/responses/Error' }
  /budget-categories:
    get:
      tags: \[Money]
      operationId: listCategories
      summary: Budget categories
      x-permission: $
      responses:
        '200':
          description: Categories
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Ok'
                  - properties: { data: { type: array, items: { $ref: '#/components/schemas/BudgetCategory' } } }
        '403': { $ref: '#/components/responses/Forbidden' }
        default: { $ref: '#/components/responses/Error' }
    post:
      tags: \[Money]
      operationId: createCategory
      summary: Add a category
      x-permission: $
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IdempotencyKey' } ]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/CategoryInput' }
      responses:
        '201': { $ref: '#/components/responses/CategoryOne' }
        '403': { $ref: '#/components/responses/Forbidden' }
        '409': { $ref: '#/components/responses/Conflict' }
        '422': { $ref: '#/components/responses/Unprocessable' }
        default: { $ref: '#/components/responses/Error' }
  /budget-categories/{id}:
    parameters: \[ { $ref: '#/components/parameters/Id' } ]
    patch:
      tags: \[Money]
      operationId: updateCategory
      summary: Rename, plan or reorder
      x-permission: $
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IfMatch' }, { $ref: '#/components/parameters/IdempotencyKey' } ]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/CategoryInput' }
      responses:
        '200': { $ref: '#/components/responses/CategoryOne' }
        '409': { $ref: '#/components/responses/Conflict' }
        '422': { $ref: '#/components/responses/Unprocessable' }
        default: { $ref: '#/components/responses/Error' }
    delete:
      tags: \[Money]
      operationId: deleteCategory
      summary: Delete. With payments, move\_payments\_to is required. Fallback can't be deleted.
      x-permission: Adm
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IfMatch' }, { $ref: '#/components/parameters/IdempotencyKey' } ]
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                move\_payments\_to: { $ref: '#/components/schemas/Ulid' }
      responses:
        '200': { $ref: '#/components/responses/Deleted' }
        '403': { $ref: '#/components/responses/Forbidden' }
        '422': { $ref: '#/components/responses/Unprocessable' }
        default: { $ref: '#/components/responses/Error' }
  /budget-categories/{id}/restore: { $ref: '#/components/pathItems/Restore' }
  /vendors:
    get:
      tags: \[Money]
      operationId: listVendors
      summary: Vendor contacts (amounts only for $)
      x-permission: All
      parameters:
        - { $ref: '#/components/parameters/Q' }
        - { name: category, in: query, schema: { $ref: '#/components/schemas/VendorCategory' } }
        - { name: booked, in: query, schema: { type: boolean } }
        - { name: sort, in: query, schema: { type: string, enum: \[name, -created\_at] } }
        - { $ref: '#/components/parameters/Limit' }
        - { $ref: '#/components/parameters/Cursor' }
      responses:
        '200':
          description: Vendors
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/OkPage'
                  - properties: { data: { type: array, items: { $ref: '#/components/schemas/Vendor' } } }
        default: { $ref: '#/components/responses/Error' }
    post:
      tags: \[Money]
      operationId: createVendor
      summary: Add a vendor
      x-permission: Ed (agreed amount only $)
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IdempotencyKey' } ]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/VendorCreate' }
      responses:
        '201': { $ref: '#/components/responses/VendorOne' }
        '403': { $ref: '#/components/responses/Forbidden' }
        '409': { $ref: '#/components/responses/Conflict' }
        '422': { $ref: '#/components/responses/Unprocessable' }
        default: { $ref: '#/components/responses/Error' }
  /vendors/{id}:
    parameters: \[ { $ref: '#/components/parameters/Id' } ]
    get:
      tags: \[Money]
      operationId: getVendor
      summary: Vendor page. Money users also get balance.
      x-permission: All
      responses:
        '200': { $ref: '#/components/responses/VendorOne' }
        '404': { $ref: '#/components/responses/NotFound' }
        default: { $ref: '#/components/responses/Error' }
    patch:
      tags: \[Money]
      operationId: updateVendor
      summary: Edit a vendor
      x-permission: Ed (agreed amount only $)
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IfMatch' }, { $ref: '#/components/parameters/IdempotencyKey' } ]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/VendorUpdate' }
      responses:
        '200': { $ref: '#/components/responses/VendorOne' }
        '403': { $ref: '#/components/responses/Forbidden' }
        '409': { $ref: '#/components/responses/Conflict' }
        '422': { $ref: '#/components/responses/Unprocessable' }
        default: { $ref: '#/components/responses/Error' }
    delete:
      tags: \[Money]
      operationId: deleteVendor
      summary: Soft delete. Payments keep the link.
      x-permission: Adm
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IfMatch' }, { $ref: '#/components/parameters/IdempotencyKey' } ]
      responses:
        '200': { $ref: '#/components/responses/Deleted' }
        '403': { $ref: '#/components/responses/Forbidden' }
        default: { $ref: '#/components/responses/Error' }
  /vendors/{id}/restore: { $ref: '#/components/pathItems/Restore' }
  /payments:
    get:
      tags: \[Money]
      operationId: listPayments
      summary: Payments and expenses. meta.totals has amount\_paise, due\_paise, paid\_paise.
      x-permission: $
      parameters:
        - { name: status, in: query, schema: { type: string, enum: \[due, overdue, paid, no\_date] } }
        - { name: kind, in: query, schema: { type: string, enum: \[payment, expense] } }
        - { name: category, in: query, schema: { $ref: '#/components/schemas/Ulid' } }
        - { name: vendor, in: query, schema: { $ref: '#/components/schemas/Ulid' } }
        - { name: event, in: query, schema: { $ref: '#/components/schemas/Ulid' } }
        - { name: month, in: query, schema: { type: string, pattern: '^\\d{4}-(0\[1-9]|1\[0-2])$' } }
        - { $ref: '#/components/parameters/Q' }
        - { name: sort, in: query, schema: { type: string, enum: \[due\_date, -paid\_on, -amount\_paise] } }
        - { $ref: '#/components/parameters/Limit' }
        - { $ref: '#/components/parameters/Cursor' }
      responses:
        '200':
          description: Payments
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/OkPage'
                  - properties: { data: { type: array, items: { $ref: '#/components/schemas/Payment' } } }
        '403': { $ref: '#/components/responses/Forbidden' }
        default: { $ref: '#/components/responses/Error' }
    post:
      tags: \[Money]
      operationId: createPayment
      summary: Add a payment or expense (optionally creating the vendor)
      x-permission: $
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IdempotencyKey' } ]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/PaymentCreate' }
      responses:
        '201': { $ref: '#/components/responses/PaymentOne' }
        '403': { $ref: '#/components/responses/Forbidden' }
        '409': { $ref: '#/components/responses/Conflict' }
        '422': { $ref: '#/components/responses/Unprocessable' }
        default: { $ref: '#/components/responses/Error' }
  /payments/{id}:
    parameters: \[ { $ref: '#/components/parameters/Id' } ]
    get:
      tags: \[Money]
      operationId: getPayment
      summary: One payment with receipts
      x-permission: $
      responses:
        '200': { $ref: '#/components/responses/PaymentOne' }
        '403': { $ref: '#/components/responses/Forbidden' }
        '404': { $ref: '#/components/responses/NotFound' }
        default: { $ref: '#/components/responses/Error' }
    patch:
      tags: \[Money]
      operationId: updatePayment
      summary: Edit a payment
      x-permission: $
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IfMatch' }, { $ref: '#/components/parameters/IdempotencyKey' } ]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/PaymentUpdate' }
      responses:
        '200': { $ref: '#/components/responses/PaymentOne' }
        '409': { $ref: '#/components/responses/Conflict' }
        '422': { $ref: '#/components/responses/Unprocessable' }
        default: { $ref: '#/components/responses/Error' }
    delete:
      tags: \[Money]
      operationId: deletePayment
      summary: Soft delete with receipts
      x-permission: $
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IfMatch' }, { $ref: '#/components/parameters/IdempotencyKey' } ]
      responses:
        '200': { $ref: '#/components/responses/Deleted' }
        '409': { $ref: '#/components/responses/Conflict' }
        default: { $ref: '#/components/responses/Error' }
  /payments/{id}/mark-paid:
    parameters: \[ { $ref: '#/components/parameters/Id' } ]
    post:
      tags: \[Money]
      operationId: markPaymentPaid
      summary: Mark a due payment paid
      x-permission: $
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IfMatch' }, { $ref: '#/components/parameters/IdempotencyKey' } ]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/PaidDetails' }
      responses:
        '200': { $ref: '#/components/responses/PaymentOne' }
        '409': { $ref: '#/components/responses/Conflict' }
        '422': { $ref: '#/components/responses/Unprocessable' }
        default: { $ref: '#/components/responses/Error' }
  /payments/{id}/pay-part:
    parameters: \[ { $ref: '#/components/parameters/Id' } ]
    post:
      tags: \[Money]
      operationId: payPart
      summary: New Paid row + Due row reduced, in one batch
      x-permission: $
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IfMatch' }, { $ref: '#/components/parameters/IdempotencyKey' } ]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              allOf:
                - $ref: '#/components/schemas/PaidDetails'
                - type: object
                  required: \[amount\_paise]
                  properties:
                    amount\_paise: { $ref: '#/components/schemas/AmountPaise' }
      responses:
        '200':
          description: Both rows
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Ok'
                  - properties:
                      data:
                        type: object
                        properties:
                          paid: { $ref: '#/components/schemas/Payment' }
                          due: { $ref: '#/components/schemas/Payment' }
        '409': { $ref: '#/components/responses/Conflict' }
        '422': { $ref: '#/components/responses/Unprocessable' }
        default: { $ref: '#/components/responses/Error' }
  /payments/{id}/restore: { $ref: '#/components/pathItems/Restore' }

  # ---------------------------------------------------------------- Documents
  /documents:
    get:
      tags: \[Documents]
      operationId: listDocuments
      summary: Documents this user may see
      x-permission: All (filtered by visibility)
      parameters:
        - { name: type, in: query, schema: { $ref: '#/components/schemas/DocumentType' } }
        - { name: vendor, in: query, schema: { $ref: '#/components/schemas/Ulid' } }
        - { name: event, in: query, schema: { $ref: '#/components/schemas/Ulid' } }
        - { name: payment, in: query, schema: { $ref: '#/components/schemas/Ulid' } }
        - { $ref: '#/components/parameters/Q' }
        - { name: limit, in: query, schema: { type: integer, minimum: 1, maximum: 200, default: 30 } }
        - { $ref: '#/components/parameters/Cursor' }
      responses:
        '200':
          description: Documents
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/OkPage'
                  - properties: { data: { type: array, items: { $ref: '#/components/schemas/Document' } } }
        default: { $ref: '#/components/responses/Error' }
    post:
      tags: \[Documents]
      operationId: uploadDocument
      summary: Upload one file (max 10 MB; JPEG, PNG, WebP, PDF) with details
      x-permission: Ed (payment link needs $; is\_private Adm)
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IdempotencyKey' } ]
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema: { $ref: '#/components/schemas/DocumentUpload' }
            encoding:
              file: { contentType: 'image/jpeg, image/png, image/webp, application/pdf' }
      responses:
        '201': { $ref: '#/components/responses/DocumentOne' }
        '403': { $ref: '#/components/responses/Forbidden' }
        '409': { $ref: '#/components/responses/Conflict' }
        '413': { $ref: '#/components/responses/PayloadTooLarge' }
        '415': { $ref: '#/components/responses/UnsupportedMediaType' }
        '422': { $ref: '#/components/responses/Unprocessable' }
        default: { $ref: '#/components/responses/Error' }
  /documents/{id}:
    parameters: \[ { $ref: '#/components/parameters/Id' } ]
    get:
      tags: \[Documents]
      operationId: getDocument
      summary: Document details
      x-permission: Visible to user
      responses:
        '200': { $ref: '#/components/responses/DocumentOne' }
        '403': { $ref: '#/components/responses/Forbidden' }
        '404': { $ref: '#/components/responses/NotFound' }
        default: { $ref: '#/components/responses/Error' }
    patch:
      tags: \[Documents]
      operationId: updateDocument
      summary: Edit details. The file never changes.
      x-permission: Adm; Family own uploads
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IfMatch' }, { $ref: '#/components/parameters/IdempotencyKey' } ]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/DocumentUpdate' }
      responses:
        '200': { $ref: '#/components/responses/DocumentOne' }
        '403': { $ref: '#/components/responses/Forbidden' }
        '409': { $ref: '#/components/responses/Conflict' }
        default: { $ref: '#/components/responses/Error' }
    delete:
      tags: \[Documents]
      operationId: deleteDocument
      summary: Soft delete (file stays on disk)
      x-permission: Adm; Family own uploads
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IfMatch' }, { $ref: '#/components/parameters/IdempotencyKey' } ]
      responses:
        '200': { $ref: '#/components/responses/Deleted' }
        '403': { $ref: '#/components/responses/Forbidden' }
        default: { $ref: '#/components/responses/Error' }
  /documents/{id}/file:
    parameters: \[ { $ref: '#/components/parameters/Id' } ]
    get:
      tags: \[Documents]
      operationId: downloadDocumentFile
      summary: Stream the file after an auth and visibility check. Never a public URL.
      x-permission: Visible to user
      parameters:
        - { name: download, in: query, schema: { type: boolean }, description: 'true = Content-Disposition attachment' }
        - { name: Range, in: header, schema: { type: string }, description: Single byte range }
      responses:
        '200':
          description: File bytes
          headers:
            ETag: { schema: { type: string }, description: SHA-256 of the file }
            Cache-Control: { schema: { type: string, const: 'private, no-store' } }
          content:
            image/jpeg: { schema: { type: string, contentMediaType: image/jpeg } }
            image/png: { schema: { type: string, contentMediaType: image/png } }
            image/webp: { schema: { type: string, contentMediaType: image/webp } }
            application/pdf: { schema: { type: string, contentMediaType: application/pdf } }
        '206': { description: Partial content }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '403': { $ref: '#/components/responses/Forbidden' }
        '404': { $ref: '#/components/responses/NotFound' }
        default: { $ref: '#/components/responses/Error' }
  /documents/{id}/restore: { $ref: '#/components/pathItems/Restore' }

  # ---------------------------------------------------------------- History
  /{resource}/{id}/history:
    parameters:
      - name: resource
        in: path
        required: true
        schema: { type: string, enum: \[households, tasks, events, vendors, payments, documents, budget-categories, tags, members] }
      - { $ref: '#/components/parameters/Id' }
    get:
      tags: \[History]
      operationId: recordHistory
      summary: Plain-sentence history of one record. Money fields hidden for non-money users.
      x-permission: Anyone who can see the record
      parameters: \[ { $ref: '#/components/parameters/Cursor' }, { $ref: '#/components/parameters/Limit' } ]
      responses:
        '200': { $ref: '#/components/responses/HistoryList' }
        '403': { $ref: '#/components/responses/Forbidden' }
        '404': { $ref: '#/components/responses/NotFound' }
        default: { $ref: '#/components/responses/Error' }
  /activity:
    get:
      tags: \[History]
      operationId: activityFeed
      summary: Activity feed
      x-permission: Adm
      parameters:
        - { name: user, in: query, schema: { $ref: '#/components/schemas/Ulid' } }
        - { name: type, in: query, schema: { type: string } }
        - { name: action, in: query, schema: { type: string } }
        - { name: from, in: query, schema: { $ref: '#/components/schemas/Date' } }
        - { name: to, in: query, schema: { $ref: '#/components/schemas/Date' } }
        - { $ref: '#/components/parameters/Cursor' }
        - { $ref: '#/components/parameters/Limit' }
      responses:
        '200': { $ref: '#/components/responses/HistoryList' }
        '403': { $ref: '#/components/responses/Forbidden' }
        default: { $ref: '#/components/responses/Error' }

  # ---------------------------------------------------------------- Undo \& Trash
  /undo/{batch\_id}:
    parameters: \[ { $ref: '#/components/parameters/BatchId' } ]
    post:
      tags: \[Trash]
      operationId: undoBatch
      summary: Undo own action within 10 minutes
      x-permission: The person who acted
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IdempotencyKey' } ]
      responses:
        '200': { $ref: '#/components/responses/UndoDone' }
        '403': { $ref: '#/components/responses/Forbidden' }
        '404': { $ref: '#/components/responses/NotFound' }
        default: { $ref: '#/components/responses/Error' }
  /trash:
    get:
      tags: \[Trash]
      operationId: listTrash
      summary: Deleted items, one row per batch, newest first
      x-permission: Adm
      parameters:
        - { name: type, in: query, schema: { type: string } }
        - { name: user, in: query, schema: { $ref: '#/components/schemas/Ulid' } }
        - { name: from, in: query, schema: { $ref: '#/components/schemas/Date' } }
        - { name: to, in: query, schema: { $ref: '#/components/schemas/Date' } }
        - { $ref: '#/components/parameters/Cursor' }
        - { $ref: '#/components/parameters/Limit' }
      responses:
        '200':
          description: Batches
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/OkPage'
                  - properties: { data: { type: array, items: { $ref: '#/components/schemas/TrashBatch' } } }
        '403': { $ref: '#/components/responses/Forbidden' }
        default: { $ref: '#/components/responses/Error' }
  /trash/{batch\_id}:
    parameters: \[ { $ref: '#/components/parameters/BatchId' } ]
    get:
      tags: \[Trash]
      operationId: getTrashBatch
      summary: Items inside one batch
      x-permission: Adm
      responses:
        '200':
          description: Batch and items
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Ok'
                  - properties:
                      data:
                        type: object
                        properties:
                          batch: { $ref: '#/components/schemas/TrashBatch' }
                          items: { type: array, items: { $ref: '#/components/schemas/TrashItem' } }
        '403': { $ref: '#/components/responses/Forbidden' }
        '404': { $ref: '#/components/responses/NotFound' }
        default: { $ref: '#/components/responses/Error' }
    delete:
      tags: \[Trash]
      operationId: purgeBatch
      summary: Purge for good. Later. Always 403 before 16 May 2027.
      x-permission: Own
      x-release: Later
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IdempotencyKey' } ]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: \[confirm, export\_id]
              properties:
                confirm: { type: string, const: DELETE FOREVER }
                export\_id: { $ref: '#/components/schemas/Ulid' }
      responses:
        '403': { $ref: '#/components/responses/Forbidden' }
        default: { $ref: '#/components/responses/Error' }
  /trash/{batch\_id}/restore:
    parameters: \[ { $ref: '#/components/parameters/BatchId' } ]
    post:
      tags: \[Trash]
      operationId: restoreBatch
      summary: Restore a whole batch or chosen items
      x-permission: Adm
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IdempotencyKey' } ]
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                items:
                  type: array
                  items:
                    type: object
                    required: \[type, id]
                    properties:
                      type: { type: string }
                      id: { $ref: '#/components/schemas/Ulid' }
      responses:
        '200':
          description: Restore result
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Ok'
                  - properties: { data: { $ref: '#/components/schemas/RestoreResult' } }
        '403': { $ref: '#/components/responses/Forbidden' }
        '404': { $ref: '#/components/responses/NotFound' }
        default: { $ref: '#/components/responses/Error' }

  # ---------------------------------------------------------------- Export
  /exports:
    get:
      tags: \[Export]
      operationId: listExports
      summary: Recent exports
      x-permission: Adm
      responses:
        '200':
          description: Exports
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Ok'
                  - properties: { data: { type: array, items: { $ref: '#/components/schemas/Export' } } }
        '403': { $ref: '#/components/responses/Forbidden' }
        default: { $ref: '#/components/responses/Error' }
    post:
      tags: \[Export]
      operationId: createExport
      summary: Take a consistent snapshot and prepare the ZIP
      x-permission: Adm
      security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
      parameters: \[ { $ref: '#/components/parameters/IdempotencyKey' } ]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: \[kind]
              properties:
                kind: { type: string, const: full }
      responses:
        '201':
          description: Ready. download\_urls carry a 24 h token (only in this reply).
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Ok'
                  - properties: { data: { $ref: '#/components/schemas/Export' } }
        '403': { $ref: '#/components/responses/Forbidden' }
        '429': { $ref: '#/components/responses/TooManyRequests' }
        default: { $ref: '#/components/responses/Error' }
  /exports/{id}:
    parameters: \[ { $ref: '#/components/parameters/Id' } ]
    get:
      tags: \[Export]
      operationId: getExport
      summary: One export
      x-permission: Adm
      responses:
        '200':
          description: Export
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Ok'
                  - properties: { data: { $ref: '#/components/schemas/Export' } }
        '404': { $ref: '#/components/responses/NotFound' }
        default: { $ref: '#/components/responses/Error' }
  /exports/{id}/download:
    parameters: \[ { $ref: '#/components/parameters/Id' } ]
    get:
      tags: \[Export]
      operationId: downloadExport
      summary: Stream the ZIP (built while streaming). Admin session or the export token.
      x-permission: Adm, or holder of the export token
      security:
        - sessionCookie: \[]
        - exportToken: \[]
      parameters:
        - { name: part, in: query, schema: { type: integer, minimum: 1, default: 1 } }
      responses:
        '200':
          description: ZIP stream
          headers:
            Content-Disposition: { schema: { type: string }, description: 'attachment; filename="wedding-export\_2026-10-08.zip"' }
          content:
            application/zip: { schema: { type: string, contentMediaType: application/zip } }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '403': { $ref: '#/components/responses/Forbidden' }
        '404': { $ref: '#/components/responses/NotFound' }
        '410': { $ref: '#/components/responses/Gone' }
        default: { $ref: '#/components/responses/Error' }

  # ---------------------------------------------------------------- Sync \& health
  /sync:
    get:
      tags: \[Sync]
      operationId: sync
      summary: Changes since a timestamp, for the read-only offline cache
      x-permission: All (rows filtered as in normal endpoints)
      parameters:
        - { name: since, in: query, schema: { $ref: '#/components/schemas/DateTime' }, description: Omit for a full snapshot }
        - { $ref: '#/components/parameters/Cursor' }
        - { name: limit, in: query, schema: { type: integer, minimum: 1, maximum: 1000, default: 500 } }
        - { name: types, in: query, schema: { type: string }, description: 'Comma list, e.g. events,households,invitations' }
      responses:
        '200':
          description: Changes
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Ok'
                  - properties: { data: { $ref: '#/components/schemas/SyncResult' } }
        default: { $ref: '#/components/responses/Error' }
  /health:
    get:
      tags: \[Health]
      operationId: health
      summary: Health. Anonymous gets ok/fail only; admins get details.
      x-permission: Anyone (details Adm)
      security: \[ {}, { sessionCookie: \[] } ]
      responses:
        '200':
          description: Healthy (or amber)
          content:
            application/json:
              schema:
                oneOf:
                  - $ref: '#/components/schemas/HealthPublic'
                  - allOf:
                      - $ref: '#/components/schemas/Ok'
                      - properties: { data: { $ref: '#/components/schemas/Health' } }
        '503':
          description: Database or backup check is red
          content:
            application/json:
              schema: { $ref: '#/components/schemas/HealthPublic' }

components:
  securitySchemes:
    sessionCookie:
      type: apiKey
      in: cookie
      name: \_\_Host-am\_session
      description: HttpOnly; Secure; SameSite=Lax; Path=/; 90 days sliding.
    csrfHeader:
      type: apiKey
      in: header
      name: X-CSRF-Token
      description: From POST /auth/login or GET /session. Required on every write while logged in.
    exportToken:
      type: apiKey
      in: query
      name: t
      description: 24-hour token for one export's download only.

  parameters:
    Id:
      name: id
      in: path
      required: true
      schema: { $ref: '#/components/schemas/Ulid' }
    BatchId:
      name: batch\_id
      in: path
      required: true
      schema: { $ref: '#/components/schemas/Ulid' }
    IfMatch:
      name: If-Match
      in: header
      required: true
      description: The record version you loaded, quoted. Missing gives 428 version\_required.
      schema: { type: string, pattern: '^"\[1-9]\[0-9]\*"$', examples: \['"3"'] }
    IdempotencyKey:
      name: Idempotency-Key
      in: header
      required: true
      description: UUID v4. For creates it is the new record's client\_uuid. Kept across retries. Stored 48 h.
      schema: { $ref: '#/components/schemas/Uuid' }
    Cursor:
      name: cursor
      in: query
      schema: { type: string }
    Limit:
      name: limit
      in: query
      schema: { type: integer, minimum: 1, maximum: 200, default: 50 }
    Q:
      name: q
      in: query
      schema: { type: string, minLength: 2, maxLength: 80 }

  responses:
    Error:
      description: Any error (see API.md §2.3 for codes)
      content:
        application/json:
          schema: { $ref: '#/components/schemas/ErrorEnvelope' }
    Unauthorized:
      description: not\_logged\_in, session\_ended or login\_failed
      content: { application/json: { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } }
    Forbidden:
      description: forbidden, csrf\_failed, no\_money\_access, access\_ended, undo\_expired, purge\_not\_allowed\_yet
      content: { application/json: { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } }
    NotFound:
      description: not\_found
      content: { application/json: { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } }
    Conflict:
      description: version\_conflict, record\_deleted, duplicate\_found or request\_in\_progress
      content: { application/json: { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } }
    Gone:
      description: link\_invalid or export\_expired
      content: { application/json: { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } }
    PayloadTooLarge:
      description: file\_too\_big
      content: { application/json: { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } }
    UnsupportedMediaType:
      description: file\_type\_not\_allowed
      content: { application/json: { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } }
    Unprocessable:
      description: validation\_failed (with fields), rule\_blocked, checksum\_mismatch, idempotency\_key\_reused
      content: { application/json: { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } }
    TooManyRequests:
      description: rate\_limited or login\_locked
      headers:
        Retry-After: { schema: { type: integer } }
      content: { application/json: { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } }
    Empty:
      description: OK, no data
      content:
        application/json:
          schema:
            allOf:
              - $ref: '#/components/schemas/Ok'
              - properties: { data: { type: object, maxProperties: 0 } }
    Deleted:
      description: Soft-deleted. meta.undo holds the batch for Undo.
      content:
        application/json:
          schema:
            allOf:
              - $ref: '#/components/schemas/Ok'
              - properties: { data: { type: object } }
    UndoDone:
      description: Undo result
      content:
        application/json:
          schema:
            allOf:
              - $ref: '#/components/schemas/Ok'
              - properties: { data: { $ref: '#/components/schemas/UndoResult' } }
    HistoryList:
      description: History lines
      content:
        application/json:
          schema:
            allOf:
              - $ref: '#/components/schemas/OkPage'
              - properties: { data: { type: array, items: { $ref: '#/components/schemas/HistoryLine' } } }
    MemberList:
      description: Members
      content:
        application/json:
          schema:
            allOf:
              - $ref: '#/components/schemas/Ok'
              - properties: { data: { type: array, items: { $ref: '#/components/schemas/Member' } } }
    MemberOne:
      description: Member
      headers: { ETag: { $ref: '#/components/headers/ETag' } }
      content:
        application/json:
          schema:
            allOf:
              - $ref: '#/components/schemas/Ok'
              - properties: { data: { $ref: '#/components/schemas/Member' } }
    SettingsOne:
      description: Settings
      headers: { ETag: { $ref: '#/components/headers/ETag' } }
      content:
        application/json:
          schema:
            allOf:
              - $ref: '#/components/schemas/Ok'
              - properties: { data: { $ref: '#/components/schemas/Settings' } }
    RestoreDrillOne:
      description: Restore drill
      headers: { ETag: { $ref: '#/components/headers/ETag' } }
      content:
        application/json:
          schema:
            allOf:
              - $ref: '#/components/schemas/Ok'
              - properties: { data: { $ref: '#/components/schemas/RestoreDrill' } }
    EventOne:
      description: Event
      headers: { ETag: { $ref: '#/components/headers/ETag' } }
      content:
        application/json:
          schema:
            allOf:
              - $ref: '#/components/schemas/Ok'
              - properties: { data: { $ref: '#/components/schemas/Event' } }
    TaskOne:
      description: Task
      headers: { ETag: { $ref: '#/components/headers/ETag' } }
      content:
        application/json:
          schema:
            allOf:
              - $ref: '#/components/schemas/Ok'
              - properties: { data: { $ref: '#/components/schemas/Task' } }
    TaskItemOne:
      description: Checklist item
      headers: { ETag: { $ref: '#/components/headers/ETag' } }
      content:
        application/json:
          schema:
            allOf:
              - $ref: '#/components/schemas/Ok'
              - properties: { data: { $ref: '#/components/schemas/TaskItem' } }
    TagOne:
      description: Tag
      headers: { ETag: { $ref: '#/components/headers/ETag' } }
      content:
        application/json:
          schema:
            allOf:
              - $ref: '#/components/schemas/Ok'
              - properties: { data: { $ref: '#/components/schemas/Tag' } }
    HouseholdOne:
      description: Family
      headers: { ETag: { $ref: '#/components/headers/ETag' } }
      content:
        application/json:
          schema:
            allOf:
              - $ref: '#/components/schemas/Ok'
              - properties: { data: { $ref: '#/components/schemas/Household' } }
    InvitationOne:
      description: Invitation
      headers: { ETag: { $ref: '#/components/headers/ETag' } }
      content:
        application/json:
          schema:
            allOf:
              - $ref: '#/components/schemas/Ok'
              - properties: { data: { $ref: '#/components/schemas/Invitation' } }
    CategoryOne:
      description: Budget category
      headers: { ETag: { $ref: '#/components/headers/ETag' } }
      content:
        application/json:
          schema:
            allOf:
              - $ref: '#/components/schemas/Ok'
              - properties: { data: { $ref: '#/components/schemas/BudgetCategory' } }
    VendorOne:
      description: Vendor
      headers: { ETag: { $ref: '#/components/headers/ETag' } }
      content:
        application/json:
          schema:
            allOf:
              - $ref: '#/components/schemas/Ok'
              - properties: { data: { $ref: '#/components/schemas/Vendor' } }
    PaymentOne:
      description: Payment
      headers: { ETag: { $ref: '#/components/headers/ETag' } }
      content:
        application/json:
          schema:
            allOf:
              - $ref: '#/components/schemas/Ok'
              - properties: { data: { $ref: '#/components/schemas/Payment' } }
    DocumentOne:
      description: Document
      headers: { ETag: { $ref: '#/components/headers/ETag' } }
      content:
        application/json:
          schema:
            allOf:
              - $ref: '#/components/schemas/Ok'
              - properties: { data: { $ref: '#/components/schemas/Document' } }

  headers:
    ETag:
      description: Record version, quoted
      schema: { type: string, examples: \['"4"'] }

  # Shared path item, referenced by every /{resource}/{id}/restore path.
  pathItems:
    Restore:
      parameters: \[ { $ref: '#/components/parameters/Id' } ]
      post:
        tags: \[Trash]
        summary: Restore one record and its same-batch children
        x-permission: Adm
        security: \[ { sessionCookie: \[], csrfHeader: \[] } ]
        parameters: \[ { $ref: '#/components/parameters/IfMatch' }, { $ref: '#/components/parameters/IdempotencyKey' } ]
        responses:
          '200':
            description: Restored record (warnings in meta.warnings)
            content:
              application/json:
                schema: { $ref: '#/components/schemas/Ok' }
          '403': { $ref: '#/components/responses/Forbidden' }
          '404': { $ref: '#/components/responses/NotFound' }
          '422': { $ref: '#/components/responses/Unprocessable' }
          default: { $ref: '#/components/responses/Error' }

  schemas:
    # ---- primitives
    Ulid: { type: string, pattern: '^\[0-9A-HJKMNP-TV-Z]{26}$', examples: \['01JA7Q3M2K8V5R1T9W4X6Y0Z2B'] }
    Uuid: { type: string, format: uuid }
    DateTime: { type: string, format: date-time, pattern: 'Z$', examples: \['2027-02-14T12:30:00Z'] }
    Date: { type: string, format: date, examples: \['2026-10-20'] }
    Time: { type: string, pattern: '^(\[01]\[0-9]|2\[0-3]):\[0-5]\[0-9]$', examples: \['18:00'] }
    Phone: { type: string, pattern: '^\\+\[1-9]\[0-9]{7,14}$', examples: \['+919829012345'] }
    Paise: { type: integer, minimum: 0, examples: \[12500000] }
    AmountPaise: { type: integer, minimum: 1, maximum: 1000000000 }
    NewPassword: { type: string, minLength: 6, maxLength: 128, description: 'Not the phone number, not in the top-100 list' }
    Notes: { type: \[string, 'null'], maxLength: 5000 }
    Side: { type: string, enum: \[bride, groom, both] }
    Food: { type: string, enum: \[veg, jain, mixed] }
    Rsvp: { type: string, enum: \[not\_asked, waiting, coming, not\_coming] }
    Role: { type: string, enum: \[owner, partner, family, viewer] }
    EventType: { type: string, enum: \[engagement, roka, haldi, mehndi, sangeet, mayra, wedding, reception, other] }
    TaskStatus: { type: string, enum: \[todo, doing, waiting, done, cancelled] }
    Priority: { type: string, enum: \[urgent, normal, low] }
    VendorCategory: { type: string, enum: \[venue, caterer, tent\_decor, photo\_video, makeup, mehndi\_artist, band\_dj, florist, transport, printer, pandit, jeweller, tailor, other] }
    PaymentStatus: { type: string, enum: \[due, paid] }
    PaymentMethod: { type: string, enum: \[cash, upi, bank, cheque, card, other] }
    DocumentType: { type: string, enum: \[contract, quotation, receipt, booking, id, photo, other] }
    Ref:
      type: \[object, 'null']
      required: \[id, name]
      properties:
        id: { $ref: '#/components/schemas/Ulid' }
        name: { type: string }
        deleted: { type: boolean }
        left: { type: boolean, description: Members only - deactivated or access ended }
    Standard:
      type: object
      properties:
        id: { $ref: '#/components/schemas/Ulid' }
        version: { type: integer, minimum: 1 }
        created\_at: { $ref: '#/components/schemas/DateTime' }
        created\_by: { $ref: '#/components/schemas/Ref' }
        updated\_at: { $ref: '#/components/schemas/DateTime' }
        updated\_by: { $ref: '#/components/schemas/Ref' }

    # ---- envelope
    Meta:
      type: object
      required: \[request\_id, server\_time]
      properties:
        request\_id: { type: string }
        server\_time: { $ref: '#/components/schemas/DateTime' }
        undo:
          type: object
          properties:
            batch\_id: { $ref: '#/components/schemas/Ulid' }
            until: { $ref: '#/components/schemas/DateTime' }
            summary: { type: string }
        warnings: { type: array, items: { type: string } }
      additionalProperties: true
    PageMeta:
      allOf:
        - $ref: '#/components/schemas/Meta'
        - type: object
          properties:
            total: { type: integer }
            totals: { type: object, additionalProperties: { type: integer } }
            next\_cursor: { type: \[string, 'null'] }
            has\_more: { type: boolean }
    Ok:
      type: object
      required: \[ok, data, meta]
      properties:
        ok: { const: true }
        data: {}
        meta: { $ref: '#/components/schemas/Meta' }
    OkPage:
      type: object
      required: \[ok, data, meta]
      properties:
        ok: { const: true }
        data: { type: array }
        meta: { $ref: '#/components/schemas/PageMeta' }
    Error:
      type: object
      required: \[code, message]
      properties:
        code: { type: string, examples: \[validation\_failed] }
        message: { type: string, description: Plain English, safe to show }
        fields: { type: object, additionalProperties: { type: string } }
        reason: { type: string }
        rule: { type: string }
        retry\_after\_seconds: { type: integer }
        max\_bytes: { type: integer }
        current: { type: object, description: 'version\_conflict: the record now' }
        current\_version: { type: integer }
        your\_version: { type: integer }
        changed\_by: { $ref: '#/components/schemas/Ref' }
        changed\_at: { $ref: '#/components/schemas/DateTime' }
        changed\_fields: { type: array, items: { type: string } }
        deleted\_by: { $ref: '#/components/schemas/Ref' }
        deleted\_at: { $ref: '#/components/schemas/DateTime' }
        can\_restore: { type: boolean }
        matches: { type: array, items: { $ref: '#/components/schemas/Match' } }
      additionalProperties: true
    ErrorEnvelope:
      type: object
      required: \[ok, error, meta]
      properties:
        ok: { const: false }
        error: { $ref: '#/components/schemas/Error' }
        meta: { $ref: '#/components/schemas/Meta' }

    # ---- auth \& members
    LoginRequest:
      type: object
      required: \[phone, password]
      properties:
        phone: { type: string, maxLength: 20 }
        password: { type: string, maxLength: 128 }
    LinkToken:
      type: object
      required: \[token]
      properties:
        token: { type: string, minLength: 40, maxLength: 64 }
    AuthUser:
      type: object
      properties:
        id: { $ref: '#/components/schemas/Ulid' }
        name: { type: string }
        phone: { $ref: '#/components/schemas/Phone' }
        role: { $ref: '#/components/schemas/Role' }
        can\_see\_money: { type: boolean }
        access\_ends\_on: { oneOf: \[ { $ref: '#/components/schemas/Date' }, { type: 'null' } ] }
        must\_change\_password: { type: boolean }
    AuthResult:
      type: object
      required: \[user, csrf\_token]
      properties:
        user: { $ref: '#/components/schemas/AuthUser' }
        csrf\_token: { type: string }
    Permissions:
      type: object
      properties:
        money: { type: boolean }
        edit: { type: boolean }
        admin: { type: boolean }
        owner: { type: boolean }
        events\_write: { type: boolean }
        trash: { type: boolean }
        export: { type: boolean }
        activity: { type: boolean }
    SessionInfo:
      type: object
      properties:
        user: { $ref: '#/components/schemas/AuthUser' }
        permissions: { $ref: '#/components/schemas/Permissions' }
        csrf\_token: { type: string }
        settings\_brief:
          type: object
          properties:
            bride\_side\_label: { type: string }
            groom\_side\_label: { type: string }
            wedding\_start\_date: { $ref: '#/components/schemas/Date' }
            wedding\_end\_date: { $ref: '#/components/schemas/Date' }
    Member:
      allOf:
        - $ref: '#/components/schemas/Standard'
        - type: object
          properties:
            name: { type: string, maxLength: 80 }
            phone: { $ref: '#/components/schemas/Phone' }
            email: { type: \[string, 'null'] }
            role: { $ref: '#/components/schemas/Role' }
            can\_see\_money: { type: boolean }
            is\_active: { type: boolean }
            access\_ends\_on: { oneOf: \[ { $ref: '#/components/schemas/Date' }, { type: 'null' } ] }
            left: { type: boolean }
            last\_seen\_at: { oneOf: \[ { $ref: '#/components/schemas/DateTime' }, { type: 'null' } ] }
            has\_logged\_in: { type: boolean }
    MemberCreate:
      type: object
      required: \[name, phone, role, password\_mode]
      properties:
        name: { type: string, minLength: 1, maxLength: 80 }
        phone: { type: string }
        role: { type: string, enum: \[partner, family, viewer] }
        can\_see\_money: { type: boolean, default: false }
        access\_ends\_on: { oneOf: \[ { $ref: '#/components/schemas/Date' }, { type: 'null' } ] }
        email: { type: \[string, 'null'], format: email }
        password\_mode: { type: string, enum: \[set, generate, link] }
        password: { $ref: '#/components/schemas/NewPassword' }
    MemberCreated:
      type: object
      properties:
        member: { $ref: '#/components/schemas/Member' }
        password\_once: { type: \[string, 'null'] }
        setup\_link: { type: \[string, 'null'] }
        setup\_link\_expires\_at: { oneOf: \[ { $ref: '#/components/schemas/DateTime' }, { type: 'null' } ] }
    MemberUpdate:
      type: object
      minProperties: 1
      properties:
        name: { type: string, minLength: 1, maxLength: 80 }
        phone: { type: string }
        role: { type: string, enum: \[partner, family, viewer] }
        can\_see\_money: { type: boolean }
        is\_active: { type: boolean }
        access\_ends\_on: { oneOf: \[ { $ref: '#/components/schemas/Date' }, { type: 'null' } ] }
        email: { type: \[string, 'null'], format: email }

    # ---- settings \& safety
    Settings:
      type: object
      properties:
        version: { type: integer }
        bride\_name: { type: string }
        groom\_name: { type: string }
        bride\_side\_label: { type: string }
        groom\_side\_label: { type: string }
        wedding\_start\_date: { $ref: '#/components/schemas/Date' }
        wedding\_end\_date: { $ref: '#/components/schemas/Date' }
        city: { type: string }
        total\_budget\_paise: { type: \[integer, 'null'], minimum: 0, description: Money users only }
        timezone: { type: string, const: Asia/Kolkata }
        currency: { type: string, const: INR }
        updated\_at: { $ref: '#/components/schemas/DateTime' }
        updated\_by: { $ref: '#/components/schemas/Ref' }
    SettingsUpdate:
      type: object
      minProperties: 1
      properties:
        bride\_name: { type: string, minLength: 1, maxLength: 80 }
        groom\_name: { type: string, minLength: 1, maxLength: 80 }
        bride\_side\_label: { type: string, minLength: 1, maxLength: 40 }
        groom\_side\_label: { type: string, minLength: 1, maxLength: 40 }
        wedding\_start\_date: { $ref: '#/components/schemas/Date' }
        wedding\_end\_date: { $ref: '#/components/schemas/Date' }
        city: { type: string, minLength: 1, maxLength: 60 }
        total\_budget\_paise: { type: \[integer, 'null'], minimum: 0 }
    BackupRun:
      type: object
      properties:
        kind: { type: string, enum: \[nightly\_db, manual\_db, pre\_migration] }
        status: { type: string, enum: \[running, ok, failed] }
        started\_at: { $ref: '#/components/schemas/DateTime' }
        finished\_at: { oneOf: \[ { $ref: '#/components/schemas/DateTime' }, { type: 'null' } ] }
        file\_name: { type: \[string, 'null'] }
        size\_bytes: { type: \[integer, 'null'] }
        destination: { type: \[string, 'null'] }
        audit\_row\_count: { type: \[integer, 'null'] }
        audit\_max\_id: { type: \[integer, 'null'] }
        error: { type: \[string, 'null'] }
    RestoreDrillInput:
      type: object
      properties:
        done\_on: { $ref: '#/components/schemas/Date' }
        result: { type: string, enum: \[passed, failed] }
        backup\_file: { type: \[string, 'null'], maxLength: 120 }
        notes: { $ref: '#/components/schemas/Notes' }
    RestoreDrill:
      allOf:
        - $ref: '#/components/schemas/Standard'
        - $ref: '#/components/schemas/RestoreDrillInput'
        - type: object
          properties:
            done\_by: { $ref: '#/components/schemas/Ref' }

    # ---- dashboard \& calendar
    Dashboard:
      type: object
      description: Only cards the user may see are present.
      properties:
        countdown:
          type: object
          properties:
            days\_to\_wedding: { type: \[integer, 'null'] }
            wedding\_day: { type: \[integer, 'null'], description: '1..3 during the wedding' }
            next\_event: { oneOf: \[ { $ref: '#/components/schemas/Event' }, { type: 'null' } ] }
        my\_tasks: { type: object, properties: { items: { type: array, items: { $ref: '#/components/schemas/Task' } }, total: { type: integer } } }
        overdue: { type: object, properties: { total: { type: integer } } }
        payments\_due:
          type: object
          properties:
            items: { type: array, items: { $ref: '#/components/schemas/Payment' } }
            total: { type: integer }
            total\_paise: { $ref: '#/components/schemas/Paise' }
            window\_days: { type: integer }
        headcount: { type: array, items: { $ref: '#/components/schemas/Headcount' } }
        budget: { $ref: '#/components/schemas/MoneySummary' }
        safety: { $ref: '#/components/schemas/Health' }
        recent\_activity: { type: array, items: { $ref: '#/components/schemas/HistoryLine' } }
        start\_here: { type: array, items: { type: object, properties: { key: { type: string }, done: { type: boolean } } } }
    CalendarItem:
      type: object
      properties:
        type: { type: string, enum: \[event, task, payment] }
        id: { $ref: '#/components/schemas/Ulid' }
        title: { type: string }
        date: { $ref: '#/components/schemas/Date' }
        time: { oneOf: \[ { $ref: '#/components/schemas/Time' }, { type: 'null' } ] }
        start\_at: { oneOf: \[ { $ref: '#/components/schemas/DateTime' }, { type: 'null' } ] }
        end\_at: { oneOf: \[ { $ref: '#/components/schemas/DateTime' }, { type: 'null' } ] }
        status: { type: \[string, 'null'] }
        overdue: { type: boolean }
        side: { oneOf: \[ { $ref: '#/components/schemas/Side' }, { type: 'null' } ] }
        linked\_event: { $ref: '#/components/schemas/Ref' }

    # ---- events
    EventFields:
      type: object
      properties:
        name: { type: string, minLength: 1, maxLength: 80 }
        type: { $ref: '#/components/schemas/EventType' }
        side: { $ref: '#/components/schemas/Side' }
        guests\_invited: { type: boolean }
        start\_at: { oneOf: \[ { $ref: '#/components/schemas/DateTime' }, { type: 'null' } ] }
        end\_at: { oneOf: \[ { $ref: '#/components/schemas/DateTime' }, { type: 'null' } ] }
        all\_day: { type: boolean }
        venue\_name: { type: \[string, 'null'], maxLength: 120 }
        venue\_address: { type: \[string, 'null'], maxLength: 300 }
        map\_url: { type: \[string, 'null'], maxLength: 500, pattern: '^https://' }
        dress\_code: { type: \[string, 'null'], maxLength: 120 }
        notes: { $ref: '#/components/schemas/Notes' }
    EventCreate:
      allOf:
        - $ref: '#/components/schemas/EventFields'
        - type: object
          required: \[name, type]
          properties:
            allow\_duplicate: { type: boolean }
    EventUpdate:
      allOf:
        - $ref: '#/components/schemas/EventFields'
        - type: object
          minProperties: 1
    Event:
      allOf:
        - $ref: '#/components/schemas/Standard'
        - $ref: '#/components/schemas/EventFields'
        - type: object
          properties:
            sort\_order: { type: integer }
            counts:
              type: object
              properties:
                tasks: { type: integer }
                invitations: { type: integer }
                payments: { type: integer, description: Money users only }
                documents: { type: integer }
            headcount: { $ref: '#/components/schemas/Headcount' }
    Headcount:
      type: object
      properties:
        event: { $ref: '#/components/schemas/Ref' }
        families\_invited: { type: integer }
        families\_coming: { type: integer }
        families\_not\_coming: { type: integer }
        people\_coming: { type: integer }
        people\_waiting: { type: integer }
        people\_not\_asked: { type: integer }
        people\_up\_to: { type: integer }
        jain\_coming: { type: integer }

    # ---- tasks
    TaskItem:
      type: object
      properties:
        key: { $ref: '#/components/schemas/Uuid' }
        version: { type: integer }
        text: { type: string, maxLength: 200 }
        is\_done: { type: boolean }
        sort\_order: { type: integer }
        done\_by: { $ref: '#/components/schemas/Ref' }
        done\_at: { oneOf: \[ { $ref: '#/components/schemas/DateTime' }, { type: 'null' } ] }
    TaskFields:
      type: object
      properties:
        title: { type: string, minLength: 1, maxLength: 200 }
        notes: { $ref: '#/components/schemas/Notes' }
        status: { $ref: '#/components/schemas/TaskStatus' }
        priority: { $ref: '#/components/schemas/Priority' }
        due\_date: { oneOf: \[ { $ref: '#/components/schemas/Date' }, { type: 'null' } ] }
        due\_time: { oneOf: \[ { $ref: '#/components/schemas/Time' }, { type: 'null' } ], description: Needs due\_date }
        event\_id: { oneOf: \[ { $ref: '#/components/schemas/Ulid' }, { type: 'null' } ] }
        vendor\_id: { oneOf: \[ { $ref: '#/components/schemas/Ulid' }, { type: 'null' } ] }
        household\_id: { oneOf: \[ { $ref: '#/components/schemas/Ulid' }, { type: 'null' } ] }
        assignee\_ids: { type: array, maxItems: 10, items: { $ref: '#/components/schemas/Ulid' } }
        tag\_ids: { type: array, maxItems: 10, items: { $ref: '#/components/schemas/Ulid' } }
        new\_tags: { type: array, maxItems: 10, items: { type: string, minLength: 1, maxLength: 30 } }
        items:
          type: array
          maxItems: 100
          items:
            type: object
            required: \[key, text]
            properties:
              key: { $ref: '#/components/schemas/Uuid' }
              text: { type: string, minLength: 1, maxLength: 200 }
              is\_done: { type: boolean }
              sort\_order: { type: integer }
    TaskCreate:
      allOf:
        - $ref: '#/components/schemas/TaskFields'
        - type: object
          required: \[title]
          properties:
            allow\_duplicate: { type: boolean }
    TaskUpdate:
      allOf:
        - $ref: '#/components/schemas/TaskFields'
        - type: object
          minProperties: 1
    Task:
      allOf:
        - $ref: '#/components/schemas/Standard'
        - type: object
          properties:
            title: { type: string }
            notes: { $ref: '#/components/schemas/Notes' }
            status: { $ref: '#/components/schemas/TaskStatus' }
            priority: { $ref: '#/components/schemas/Priority' }
            due\_date: { oneOf: \[ { $ref: '#/components/schemas/Date' }, { type: 'null' } ] }
            due\_time: { oneOf: \[ { $ref: '#/components/schemas/Time' }, { type: 'null' } ] }
            overdue: { type: boolean }
            postpone\_count: { type: integer }
            event: { $ref: '#/components/schemas/Ref' }
            vendor: { $ref: '#/components/schemas/Ref' }
            household: { $ref: '#/components/schemas/Ref' }
            assignees: { type: array, items: { $ref: '#/components/schemas/Ref' } }
            tags: { type: array, items: { $ref: '#/components/schemas/Ref' } }
            items: { type: array, items: { $ref: '#/components/schemas/TaskItem' } }
            completed\_at: { oneOf: \[ { $ref: '#/components/schemas/DateTime' }, { type: 'null' } ] }
            completed\_by: { $ref: '#/components/schemas/Ref' }
    TagInput:
      type: object
      required: \[name]
      properties:
        name: { type: string, minLength: 1, maxLength: 30 }
    Tag:
      allOf:
        - $ref: '#/components/schemas/Standard'
        - type: object
          properties:
            name: { type: string }
            task\_count: { type: integer }

    # ---- guests
    HouseholdFields:
      type: object
      properties:
        name: { type: string, minLength: 1, maxLength: 120 }
        phone: { type: \[string, 'null'] }
        alt\_phone: { type: \[string, 'null'] }
        side: { $ref: '#/components/schemas/Side' }
        group\_name: { type: \[string, 'null'], maxLength: 80 }
        relation: { type: \[string, 'null'], maxLength: 40 }
        area: { type: \[string, 'null'], maxLength: 80 }
        city: { type: \[string, 'null'], maxLength: 60 }
        address: { type: \[string, 'null'], maxLength: 300 }
        adults: { type: integer, minimum: 0, maximum: 50 }
        children: { type: integer, minimum: 0, maximum: 50 }
        food: { $ref: '#/components/schemas/Food' }
        jain\_count: { type: integer, minimum: 0, maximum: 100 }
        is\_vip: { type: boolean }
        notes: { $ref: '#/components/schemas/Notes' }
    HouseholdCreate:
      allOf:
        - $ref: '#/components/schemas/HouseholdFields'
        - type: object
          required: \[name, side]
          properties:
            invite\_event\_ids: { type: array, items: { $ref: '#/components/schemas/Ulid' } }
            allow\_duplicate: { type: boolean }
    HouseholdUpdate:
      allOf:
        - $ref: '#/components/schemas/HouseholdFields'
        - type: object
          minProperties: 1
          properties:
            allow\_duplicate: { type: boolean }
    Household:
      allOf:
        - $ref: '#/components/schemas/Standard'
        - $ref: '#/components/schemas/HouseholdFields'
        - type: object
          properties:
            people: { type: integer }
            possible\_duplicate: { type: boolean }
            invitations: { type: array, items: { $ref: '#/components/schemas/Invitation' } }
    Invitation:
      type: object
      properties:
        household\_id: { $ref: '#/components/schemas/Ulid' }
        event: { $ref: '#/components/schemas/Ref' }
        version: { type: integer }
        rsvp: { $ref: '#/components/schemas/Rsvp' }
        expected\_adults: { type: \[integer, 'null'] }
        expected\_children: { type: \[integer, 'null'] }
        people: { type: integer }
        rsvp\_note: { type: \[string, 'null'] }
        rsvp\_updated\_at: { oneOf: \[ { $ref: '#/components/schemas/DateTime' }, { type: 'null' } ] }
        rsvp\_updated\_by: { $ref: '#/components/schemas/Ref' }
        last\_reminder\_opened\_at: { oneOf: \[ { $ref: '#/components/schemas/DateTime' }, { type: 'null' } ] }
    InvitationUpdate:
      type: object
      minProperties: 1
      properties:
        rsvp: { $ref: '#/components/schemas/Rsvp' }
        expected\_adults: { type: \[integer, 'null'], minimum: 0, maximum: 50 }
        expected\_children: { type: \[integer, 'null'], minimum: 0, maximum: 50 }
        rsvp\_note: { type: \[string, 'null'], maxLength: 200 }
    Match:
      type: object
      properties:
        id: { $ref: '#/components/schemas/Ulid' }
        name: { type: string }
        side: { type: \[string, 'null'] }
        phone: { type: \[string, 'null'] }
        added\_by: { $ref: '#/components/schemas/Ref' }
        match\_on: { type: string, enum: \[phone, alt\_phone, name\_city, title, same\_vendor\_amount, sha256] }
    BulkRequest:
      type: object
      required: \[action, as\_of]
      properties:
        action: { type: string, enum: \[invite, uninvite, set\_rsvp, set\_side, delete] }
        event\_id: { $ref: '#/components/schemas/Ulid' }
        rsvp: { $ref: '#/components/schemas/Rsvp' }
        side: { $ref: '#/components/schemas/Side' }
        as\_of: { $ref: '#/components/schemas/DateTime' }
        ids: { type: array, maxItems: 2000, items: { $ref: '#/components/schemas/Ulid' } }
        filter: { type: object, description: Same keys as GET /households, applied on the server }
      oneOf:
        - required: \[ids]
        - required: \[filter]
    BulkResult:
      type: object
      properties:
        affected: { type: integer }
        skipped:
          type: array
          items:
            type: object
            properties:
              id: { $ref: '#/components/schemas/Ulid' }
              name: { type: string }
              reason: { type: string, enum: \[changed\_since\_loaded, already\_invited, not\_invited, deleted] }
              changed\_by: { $ref: '#/components/schemas/Ref' }
        batch\_id: { $ref: '#/components/schemas/Ulid' }

    # ---- imports
    ImportRow:
      type: object
      required: \[row\_no]
      properties:
        row\_no: { type: integer, minimum: 1 }
        name: { type: \[string, 'null'] }
        phone: { type: \[string, 'null'] }
        alt\_phone: { type: \[string, 'null'] }
        side: { type: \[string, 'null'] }
        group\_name: { type: \[string, 'null'] }
        relation: { type: \[string, 'null'] }
        area: { type: \[string, 'null'] }
        city: { type: \[string, 'null'] }
        address: { type: \[string, 'null'] }
        adults: { type: \[integer, 'null'] }
        children: { type: \[integer, 'null'] }
        food: { type: \[string, 'null'] }
        jain\_count: { type: \[integer, 'null'] }
        is\_vip: { type: \[boolean, 'null'] }
        notes: { type: \[string, 'null'] }
        event\_ids: { type: array, items: { $ref: '#/components/schemas/Ulid' } }
        decision: { type: string, enum: \[add, skip, add\_anyway, update\_existing], description: Only for POST /imports }
        update\_target\_id: { $ref: '#/components/schemas/Ulid' }
    ImportRequest:
      type: object
      required: \[source, rows]
      properties:
        source: { type: string, enum: \[xlsx, csv, paste, vcf] }
        file\_name: { type: \[string, 'null'], maxLength: 255 }
        defaults:
          type: object
          properties:
            side: { $ref: '#/components/schemas/Side' }
            event\_ids: { type: array, items: { $ref: '#/components/schemas/Ulid' } }
            city: { type: \[string, 'null'] }
        rows: { type: array, maxItems: 3000, items: { $ref: '#/components/schemas/ImportRow' } }
    ImportPreview:
      type: object
      properties:
        counts:
          type: object
          properties:
            new: { type: integer }
            duplicates: { type: integer }
            errors: { type: integer }
            skipped\_examples: { type: integer }
        rows:
          type: array
          items:
            type: object
            properties:
              row\_no: { type: integer }
              status: { type: string, enum: \[new, duplicate, error, skipped\_example] }
              errors: { type: object, additionalProperties: { type: string } }
              matches: { type: array, items: { $ref: '#/components/schemas/Match' } }
              normalised: { $ref: '#/components/schemas/ImportRow' }
    Import:
      allOf:
        - $ref: '#/components/schemas/Standard'
        - type: object
          properties:
            source: { type: string }
            file\_name: { type: \[string, 'null'] }
            rows\_read: { type: integer }
            created\_count: { type: integer }
            updated\_count: { type: integer }
            skipped\_count: { type: integer }
            error\_count: { type: integer }
            invitations\_count: { type: integer }
            batch\_id: { $ref: '#/components/schemas/Ulid' }
            undone\_at: { oneOf: \[ { $ref: '#/components/schemas/DateTime' }, { type: 'null' } ] }

    # ---- money
    CategoryInput:
      type: object
      properties:
        name: { type: string, minLength: 1, maxLength: 60 }
        planned\_paise: { $ref: '#/components/schemas/Paise' }
        sort\_order: { type: integer }
    BudgetCategory:
      allOf:
        - $ref: '#/components/schemas/Standard'
        - type: object
          properties:
            name: { type: string }
            planned\_paise: { $ref: '#/components/schemas/Paise' }
            spent\_paise: { $ref: '#/components/schemas/Paise' }
            due\_paise: { $ref: '#/components/schemas/Paise' }
            left\_paise: { type: integer, description: Can be negative }
            is\_over: { type: boolean }
            is\_fallback: { type: boolean }
            sort\_order: { type: integer }
            deleted: { type: boolean, description: True only when shown because it still holds live money }
    MoneySummary:
      type: object
      properties:
        planned\_paise: { $ref: '#/components/schemas/Paise' }
        spent\_paise: { $ref: '#/components/schemas/Paise' }
        still\_to\_pay\_paise: { $ref: '#/components/schemas/Paise' }
        left\_paise: { type: integer }
        free\_paise: { type: integer, description: 'Negative = Over by' }
        not\_yet\_split\_paise: { type: integer }
        categories: { type: array, items: { $ref: '#/components/schemas/BudgetCategory' } }
    VendorFields:
      type: object
      properties:
        name: { type: string, minLength: 1, maxLength: 120 }
        category: { $ref: '#/components/schemas/VendorCategory' }
        contact\_person: { type: \[string, 'null'], maxLength: 80 }
        phone: { type: \[string, 'null'] }
        alt\_phone: { type: \[string, 'null'] }
        agreed\_amount\_paise: { type: \[integer, 'null'], minimum: 0, description: Money users only }
        is\_booked: { type: boolean }
        notes: { $ref: '#/components/schemas/Notes' }
    VendorCreate:
      allOf:
        - $ref: '#/components/schemas/VendorFields'
        - type: object
          required: \[name, category]
          properties:
            allow\_duplicate: { type: boolean }
    VendorUpdate:
      allOf:
        - $ref: '#/components/schemas/VendorFields'
        - type: object
          minProperties: 1
    Vendor:
      allOf:
        - $ref: '#/components/schemas/Standard'
        - $ref: '#/components/schemas/VendorFields'
        - type: object
          properties:
            balance:
              type: object
              description: Money users only
              properties:
                agreed\_paise: { type: \[integer, 'null'] }
                paid\_paise: { $ref: '#/components/schemas/Paise' }
                due\_paise: { $ref: '#/components/schemas/Paise' }
                not\_scheduled\_paise: { type: integer, description: 'Negative = more than agreed' }
    PaidDetails:
      type: object
      required: \[paid\_on, method]
      properties:
        paid\_on: { $ref: '#/components/schemas/Date' }
        method: { $ref: '#/components/schemas/PaymentMethod' }
        paid\_by: { type: \[string, 'null'], maxLength: 60 }
        reference: { type: \[string, 'null'], maxLength: 60 }
    PaymentFields:
      type: object
      properties:
        title: { type: string, minLength: 1, maxLength: 120 }
        amount\_paise: { $ref: '#/components/schemas/AmountPaise' }
        category\_id: { $ref: '#/components/schemas/Ulid' }
        vendor\_id: { oneOf: \[ { $ref: '#/components/schemas/Ulid' }, { type: 'null' } ] }
        event\_id: { oneOf: \[ { $ref: '#/components/schemas/Ulid' }, { type: 'null' } ] }
        status: { $ref: '#/components/schemas/PaymentStatus' }
        due\_date: { oneOf: \[ { $ref: '#/components/schemas/Date' }, { type: 'null' } ] }
        paid\_on: { oneOf: \[ { $ref: '#/components/schemas/Date' }, { type: 'null' } ] }
        method: { oneOf: \[ { $ref: '#/components/schemas/PaymentMethod' }, { type: 'null' } ] }
        paid\_by: { type: \[string, 'null'], maxLength: 60 }
        reference: { type: \[string, 'null'], maxLength: 60 }
        notes: { $ref: '#/components/schemas/Notes' }
    PaymentCreate:
      allOf:
        - $ref: '#/components/schemas/PaymentFields'
        - type: object
          required: \[title, amount\_paise]
          properties:
            new\_vendor:
              type: object
              required: \[name]
              properties:
                name: { type: string, minLength: 1, maxLength: 120 }
                category: { $ref: '#/components/schemas/VendorCategory' }
                phone: { type: \[string, 'null'] }
            allow\_duplicate: { type: boolean }
    PaymentUpdate:
      allOf:
        - $ref: '#/components/schemas/PaymentFields'
        - type: object
          minProperties: 1
    Payment:
      allOf:
        - $ref: '#/components/schemas/Standard'
        - type: object
          properties:
            title: { type: string }
            kind: { type: string, enum: \[payment, expense] }
            amount\_paise: { $ref: '#/components/schemas/AmountPaise' }
            status: { $ref: '#/components/schemas/PaymentStatus' }
            overdue: { type: boolean }
            no\_date: { type: boolean }
            due\_date: { oneOf: \[ { $ref: '#/components/schemas/Date' }, { type: 'null' } ] }
            paid\_on: { oneOf: \[ { $ref: '#/components/schemas/Date' }, { type: 'null' } ] }
            method: { oneOf: \[ { $ref: '#/components/schemas/PaymentMethod' }, { type: 'null' } ] }
            paid\_by: { type: \[string, 'null'] }
            reference: { type: \[string, 'null'] }
            notes: { $ref: '#/components/schemas/Notes' }
            category: { $ref: '#/components/schemas/Ref' }
            vendor: { $ref: '#/components/schemas/Ref' }
            event: { $ref: '#/components/schemas/Ref' }
            split\_from: { $ref: '#/components/schemas/Ref' }
            receipt\_count: { type: integer }

    # ---- documents
    DocumentUpload:
      type: object
      required: \[file, sha256, type]
      properties:
        file: { type: string, contentMediaType: application/octet-stream, description: Max 10 MB }
        sha256: { type: string, pattern: '^\[0-9a-f]{64}$' }
        type: { $ref: '#/components/schemas/DocumentType' }
        title: { type: string, maxLength: 120 }
        payment\_id: { $ref: '#/components/schemas/Ulid' }
        vendor\_id: { $ref: '#/components/schemas/Ulid' }
        event\_id: { $ref: '#/components/schemas/Ulid' }
        is\_private: { type: boolean }
        notes: { type: string, maxLength: 5000 }
        allow\_duplicate: { type: boolean }
    DocumentUpdate:
      type: object
      minProperties: 1
      properties:
        title: { type: string, minLength: 1, maxLength: 120 }
        type: { $ref: '#/components/schemas/DocumentType' }
        payment\_id: { oneOf: \[ { $ref: '#/components/schemas/Ulid' }, { type: 'null' } ] }
        vendor\_id: { oneOf: \[ { $ref: '#/components/schemas/Ulid' }, { type: 'null' } ] }
        event\_id: { oneOf: \[ { $ref: '#/components/schemas/Ulid' }, { type: 'null' } ] }
        is\_private: { type: boolean }
        notes: { $ref: '#/components/schemas/Notes' }
    Document:
      allOf:
        - $ref: '#/components/schemas/Standard'
        - type: object
          properties:
            title: { type: string }
            type: { $ref: '#/components/schemas/DocumentType' }
            is\_private: { type: boolean }
            notes: { $ref: '#/components/schemas/Notes' }
            file:
              type: object
              properties:
                id: { $ref: '#/components/schemas/Ulid' }
                original\_name: { type: string }
                mime\_type: { type: string, enum: \[image/jpeg, image/png, image/webp, application/pdf] }
                size\_bytes: { type: integer, maximum: 10485760 }
                sha256: { type: string }
                width\_px: { type: \[integer, 'null'] }
                height\_px: { type: \[integer, 'null'] }
            payment: { $ref: '#/components/schemas/Ref' }
            vendor: { $ref: '#/components/schemas/Ref' }
            event: { $ref: '#/components/schemas/Ref' }
            file\_url: { type: string, examples: \['/api/v1/documents/01JA7V4K2C8M0Q4S6T8V0W2X4Y/file'] }

    # ---- history, undo, trash
    HistoryLine:
      type: object
      properties:
        at: { $ref: '#/components/schemas/DateTime' }
        action: { type: string }
        user: { $ref: '#/components/schemas/Ref' }
        device: { type: \[string, 'null'] }
        entity:
          type: object
          properties:
            type: { type: string }
            id: { $ref: '#/components/schemas/Ulid' }
            name: { type: string }
        sentence: { type: string }
        changes:
          type: array
          items:
            type: object
            properties:
              field: { type: string }
              label: { type: string }
              from: {}
              to: {}
        batch\_id: { oneOf: \[ { $ref: '#/components/schemas/Ulid' }, { type: 'null' } ] }
    UndoResult:
      type: object
      properties:
        batch\_id: { $ref: '#/components/schemas/Ulid' }
        undone: { type: integer }
        skipped:
          type: array
          items:
            type: object
            properties:
              type: { type: string }
              id: { $ref: '#/components/schemas/Ulid' }
              name: { type: string }
              reason: { type: string }
              changed\_by: { $ref: '#/components/schemas/Ref' }
        message: { type: string }
        already\_undone: { type: boolean }
    TrashBatch:
      type: object
      properties:
        batch\_id: { $ref: '#/components/schemas/Ulid' }
        action: { type: string }
        entity\_type: { type: string }
        summary: { type: string }
        item\_count: { type: integer }
        user: { $ref: '#/components/schemas/Ref' }
        deleted\_at: { $ref: '#/components/schemas/DateTime' }
        restorable: { type: boolean }
    TrashItem:
      type: object
      properties:
        type: { type: string }
        id: { type: \[string, 'null'], description: 'public\_id; null for children without one (invitations)' }
        name: { type: string }
        child\_count: { type: integer }
    RestoreResult:
      type: object
      properties:
        restored: { type: integer }
        blocked:
          type: array
          items:
            type: object
            properties:
              type: { type: string }
              id: { type: \[string, 'null'] }
              name: { type: string }
              reason: { type: string }
        warnings: { type: array, items: { type: string } }
        already\_restored: { type: boolean }

    # ---- export, sync, health
    Export:
      type: object
      properties:
        id: { $ref: '#/components/schemas/Ulid' }
        kind: { type: string, enum: \[full, guest\_csv] }
        status: { type: string, enum: \[queued, running, ready, failed, expired] }
        parts: { type: integer }
        size\_bytes: { type: \[integer, 'null'] }
        files\_bytes: { type: \[integer, 'null'] }
        created\_at: { $ref: '#/components/schemas/DateTime' }
        expires\_at: { oneOf: \[ { $ref: '#/components/schemas/DateTime' }, { type: 'null' } ] }
        download\_urls: { type: array, items: { type: string } }
        requested\_by: { $ref: '#/components/schemas/Ref' }
        error: { type: \[string, 'null'] }
    SyncResult:
      type: object
      properties:
        server\_time: { $ref: '#/components/schemas/DateTime' }
        next\_since: { $ref: '#/components/schemas/DateTime' }
        has\_more: { type: boolean }
        cursor: { type: \[string, 'null'] }
        full\_resync\_required: { type: boolean }
        changes:
          type: object
          properties:
            settings: { oneOf: \[ { $ref: '#/components/schemas/Settings' }, { type: 'null' } ] }
            members: { type: array, items: { $ref: '#/components/schemas/Member' } }
            events: { type: array, items: { $ref: '#/components/schemas/Event' } }
            households: { type: array, items: { $ref: '#/components/schemas/Household' } }
            invitations: { type: array, items: { $ref: '#/components/schemas/Invitation' } }
            tasks: { type: array, items: { $ref: '#/components/schemas/Task' } }
            tags: { type: array, items: { $ref: '#/components/schemas/Tag' } }
            vendors: { type: array, items: { $ref: '#/components/schemas/Vendor' } }
            documents: { type: array, items: { $ref: '#/components/schemas/Document' } }
            payments: { type: array, items: { $ref: '#/components/schemas/Payment' } }
            budget\_categories: { type: array, items: { $ref: '#/components/schemas/BudgetCategory' } }
        deleted:
          type: array
          items:
            type: object
            required: \[type, deleted\_at]
            properties:
              type: { type: string }
              id: { $ref: '#/components/schemas/Ulid' }
              household\_id: { $ref: '#/components/schemas/Ulid' }
              event\_id: { $ref: '#/components/schemas/Ulid' }
              deleted\_at: { $ref: '#/components/schemas/DateTime' }
    HealthPublic:
      type: object
      required: \[status]
      properties:
        status: { type: string, enum: \[ok, fail] }
    HealthCheck:
      type: object
      required: \[status]
      properties:
        status: { type: string, enum: \[green, amber, red, not\_in\_use] }
      additionalProperties: true
    Health:
      type: object
      properties:
        status: { type: string, enum: \[green, amber, red] }
        checked\_at: { $ref: '#/components/schemas/DateTime' }
        app\_version: { type: string }
        checks:
          type: object
          properties:
            database: { $ref: '#/components/schemas/HealthCheck' }
            storage: { $ref: '#/components/schemas/HealthCheck' }
            backup: { $ref: '#/components/schemas/HealthCheck' }
            audit\_log: { $ref: '#/components/schemas/HealthCheck' }
            restore\_drill: { $ref: '#/components/schemas/HealthCheck' }
            reminders: { $ref: '#/components/schemas/HealthCheck' }
            last\_export: { type: object }
        trash\_batches: { type: integer }
        server\_time: { $ref: '#/components/schemas/DateTime' }
        php\_version: { type: string }
```

\---

## 13\. Answers and Open Questions

**Answered 8 Oct 2026:**

|#|Question|Answer|Applied|
|-|-|-|-|
|1|Email password reset|Yes, off at launch|API1, §3.4|
|2|Invite by link|Yes, 72 hours|API2, §3.5|
|3|Idempotency on every write|Only if needed. It is needed on every write (reasons in API4).|API4, §5|
|4|Migration `003`|Yes, write it|`003\_api\_support.sql`, tested on MySQL 8.0.46 + MariaDB 10.11.14; §10.2. DATABASE v1.2 renumbers card tracking to `004`.|
|5|Export download token|Yes|§9.1|
|6|Hostinger limits|Same as the public plan page|§8.1, health quota 50 GB / DB 3 GB|
|7|PDFs on iPhone|Share sheet|§8.4|
|8|Family import / bulk delete; Family delete any task|No / no|API13, §6.1, §6.6, §6.7, FEATURES v1.2|
|9|Purge endpoint|"Use the available API" → kept as defined: it exists and refuses until 16 May 2027|API7, §7|
|10|Uptime monitor|Same as 9 → it uses the existing `/health` endpoint|§11|
|11|Remove Non-veg from FEATURES and the template spec|Yes|FEATURES v1.2|
|12|Subdomain|My choice: `wedding.lumorrahouse.com`|API14, CONTEXT v1.3|

**Still open:**

1. **"Own tasks" for Family.** I read "only their own" as tasks they **created or are assigned to**. Should it be only tasks they created?
2. **Family bulk actions.** Family can still bulk-invite, bulk-remove from an event, bulk-set RSVP and bulk-change side (all undoable). Only bulk delete and import are admin-only. Is that right?
3. **Uptime alerts.** Which email should the free uptime monitor alert? (Setting up the free account takes 5 minutes; I'll write the steps.)
4. **Subdomain setup.** Please create `wedding.lumorrahouse.com` in hPanel and turn on its free SSL. Tell me if you'd prefer a different name before we deploy.

