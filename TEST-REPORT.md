# Test report — Session 03 — Data safety

Date: 2026-10-09T04:31Z · App version: 1.0.3 · DB: **MySQL 8.0.46-0ubuntu0.24.04.4** (sandbox, same major as Hostinger) · PHP 8.3.6 · Node v22.22.0 · Web server for .htaccess tests: Apache/2.4.58 (Ubuntu)

Overall: **GREEN — all suites passed**

| Suite | Result |
|---|---|
| PHPUnit (unit, db, endpoints, security, static, coverage) | OK (276 tests, 2951 assertions) |
| Endpoint coverage | 33/101 operations built and tested (the rest arrive session by session) |
| Vitest (formats, API client, shell, routes, axe) | Tests 110 passed (110) |
| Build (staging + live) | JS 98.63 kB gz · CSS 5.06 kB gz |
| HTTP rules (real requests) | Apache 2.4.58 + real .htaccess: PASS · php -S + tools/router.php: PASS — OK (11 tests, 223 assertions) OK (11 tests, 220 assertions)  |
| Playwright smoke (android, small-iphone, small-android; Chromium, not Safari) | 30 passed (40.6s) |

Database checks: 001 → 002 → 003 apply with finished_at set; second run of each stops at its guard with data unchanged (DS-28); seed_demo.sql loads (61 families, Devanagari intact) and its second run stops at user id 1.

Skipped and why: WebKit project not installed (bonus only, TESTING §1.8.1). Everything Safari-specific is a real-iPhone check.

## PHPUnit detail
```
Auth (Tests\Endpoints\Auth)
 ✔ Login normalises phone sets a safe cookie and logs it
 ✔ Wrong phone and wrong password look the same
 ✔ Deactivated or ended access is told only with the right password
 ✔ Sec18 five failures lock the phone for 15 minutes
 ✔ Sec19 twenty failures from one ip lock that ip
 ✔ Sec22 forwarded for is ignored without trusted proxy
 ✔ Login needs our origin and json
 ✔ Session returns user permissions and a stable csrf token
 ✔ Ac auth 03 session slides 90 days
 ✔ Slide is bookkeeping at most hourly
 ✔ Logout clears the cookie and ends the session
 ✔ Logout needs csrf
 ✔ Logout all revokes only my sessions
 ✔ Change password rules
 ✔ Ac set 05 change password logs out other phones and keeps this one
 ✔ Reset request always 202 and sends nothing
Client Log (Tests\Endpoints\ClientLog)
 ✔ Works without a session and writes one log line
 ✔ Never writes to the database or audit log
 ✔ Phone numbers are masked and text is capped
 ✔ One line per report even with newlines
 ✔ Bad json is 400 never 500
 ✔ 31st report in an hour is 429
 ✔ Old app and schema update do not block reports
 ✔ Body over 16 kb is 413
 ✔ Get on client log is 405
Csrf And Idempotency (Tests\Security\CsrfAndIdempotency)
 ✔ Sec14 missing csrf token is refused and nothing written
 ✔ Sec15 another sessions token is refused
 ✔ Sec16 wrong origin or cross site is refused
 ✔ Sec17 form encoded bodies are refused
 ✔ Sec24 the stored hash is not a cookie
 ✔ S5 logged in writes need an idempotency key
 ✔ Ds07 same key while the first is still running
 ✔ Keys belong to one person
 ✔ Ds24 a failure after the change saves nothing and frees the key
 ✔ Sec20 write flood is limited
Endpoint Coverage (Tests\Coverage\EndpointCoverage)
 ✔ Openapi file is readable
 ✔ Every built route is documented and tested
 ✔ Every endpoint attribute points at a real operation
Error Leak (Tests\Security\ErrorLeak)
 ✔ Exception becomes plain 500
 ✔ Details go to the server log with request id
Headers (Tests\Security\Headers)
 ✔ Api security headers on success and error
 ✔ Cross origin preflight gets no cors
Health (Tests\Endpoints\Health)
 ✔ Anonymous gets only status ok
 ✔ Database down gives 503 fail and nothing else
 ✔ Unfinished migration gives fail
 ✔ Backup not checked until backups are expected
 ✔ Backup age rule when expected
 ✔ Audit count drop gives fail
 ✔ Head request works for uptime monitors
 ✔ Unknown query parameter is 400
 ✔ Anonymous limit 30 per minute
History Activity (Tests\Endpoints\HistoryActivity)
 ✔ Record history in plain sentences
 ✔ Member history hides admin fields from family
 ✔ Activity feed for admins with filters
 ✔ Activity hides money from admins without money
 ✔ Backups list for the safety card
 ✔ Logged in admin sees every check
Kernel (Tests\Unit\Kernel)
 ✔ Env parser
 ✔ Env example parses and has no real secrets
 ✔ Ulid and uuid
 ✔ Clock ist date
 ✔ Logger masks phones only
 ✔ Router matches params and methods
 ✔ Every error code has a plain message
 ✔ Versions match everywhere
Members (Tests\Endpoints\Members)
 ✔ Admins see everything family and viewers see names and phones
 ✔ Inactive members only with include inactive
 ✔ Add with a made up password shown once
 ✔ Add with a typed password and partner always sees money
 ✔ Add rules
 ✔ A deactivated members phone can be reused
 ✔ Ds04 retry with the same key never makes two and gives a fresh link
 ✔ Ds08 after 48 hours the client uuid still prevents a duplicate
 ✔ Ds09 a refused request frees its key
 ✔ Get one member
 ✔ Anyone may rename themselves but nothing else
 ✔ Sec11 the owner cannot be demoted or deactivated
 ✔ Sec23 deactivating logs the member out at once
 ✔ Sec13 money off applies on the very next request
 ✔ Access end date logs out after that day
 ✔ Partner role forces money and admins keep money
 ✔ Phone change is normalised and checked for duplicates
 ✔ Ds01 stale version gives 409 and changes nothing
 ✔ S6 missing if match is 428
 ✔ Ds05 a retried edit is a replay not a false conflict
 ✔ Admin reset logs out the member and shows the password once
 ✔ Reset rules
 ✔ My phones
Methods And Routing (Tests\Security\MethodsAndRouting)
 ✔ Options trace connect are 405
 ✔ Unknown paths are 404 with envelope
 ✔ Routes need a session unless anonymous
 ✔ Writes get 503 while the schema is behind
 ✔ Write with database down is 503 not 500
 ✔ Old app version cannot write
 ✔ Body over 1 mb is 413
 ✔ Invalid json body is 400
Migrations (Tests\Db\Migrations)
 ✔ All migrations applied and finished
 ✔ Reference data after 002
 ✔ Second run of every migration stops at its guard
 ✔ Seed demo loads and keeps hindi and emoji
 ✔ Emoji round trip
Password Link (Tests\Endpoints\PasswordLink)
 ✔ Inspect shows who without revealing the number
 ✔ Complete sets the password logs in and burns the link
 ✔ Expired cancelled and garbage links are 410
 ✔ A link works on a phone where someone is already logged in
 ✔ Link of a deactivated member is dead
 ✔ Sec21 ten tries per 15 minutes
 ✔ Complete from a reset link logs out old phones
Restore Drills (Tests\Endpoints\RestoreDrills)
 ✔ Admin logs a drill with one audit row
 ✔ Validation and permissions
 ✔ Ds04 same key twice makes one drill
 ✔ List is admin only and hides deleted
 ✔ Update bumps version and ds01 stale version changes nothing
 ✔ Ds18 delete is soft and offers undo for 10 minutes
 ✔ Sec06 deleted record by id
 ✔ Ds05 a retried delete is a replay
 ✔ Restore one record admin only twice is fine
Settings (Tests\Endpoints\Settings)
 ✔ Everyone reads facts only money users see the budget
 ✔ Ac set 01 admin sets the budget and facts
 ✔ Ac set 02 family and viewers cannot edit
 ✔ Ac set 07 and other rules
 ✔ No change is not a new version
 ✔ Ds02 two admins edit different fields
 ✔ History in plain sentences with cursor paging
Setup (Tests\Endpoints\Setup)
 ✔ Creates the owner once and logs them in
 ✔ Wrong missing or placeholder token is refused
 ✔ Validation and limits
 ✔ Needs our origin
Standard Set (Tests\Security\StandardSet)
 ✔ S1 no session is 401 with data set "GET /health"
 ✔ S1 no session is 401 with data set "POST /client-log"
 ✔ S1 no session is 401 with data set "POST /auth/login"
 ✔ S1 no session is 401 with data set "POST /auth/logout"
 ✔ S1 no session is 401 with data set "POST /auth/logout-all"
```
