# Test report — Session 06 — Events and calendar

Date: 2026-10-09T05:59Z · App version: 1.0.6 · DB: **MySQL 8.0.46-0ubuntu0.24.04.4** (sandbox, same major as Hostinger) · PHP 8.3.6 · Node v22.22.0 · Web server for .htaccess tests: Apache/2.4.58 (Ubuntu)

Overall: **GREEN — all suites passed**

| Suite | Result |
|---|---|
| PHPUnit (unit, db, endpoints, security, static, coverage) | OK (434 tests, 4386 assertions) |
| Endpoint coverage | 57/104 operations built and tested (the rest arrive session by session) |
| Vitest (formats, API client, shell, routes, axe) | Tests 127 passed (127) |
| Build (staging + live) | JS 100.32 kB gz · CSS 5.49 kB gz |
| HTTP rules (real requests) | Apache 2.4.58 + real .htaccess: PASS · php -S + tools/router.php: PASS — OK (11 tests, 223 assertions) OK (11 tests, 220 assertions)  |
| Playwright smoke (android, small-iphone, small-android; Chromium, not Safari) | 51 passed (59.2s) |

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
Backup Script (Tests\Backup\BackupScript)
 ✔ Nightly backup end to end then restore with hindi intact
 ✔ Retention hides old dailies but keeps the first of each month
 ✔ Watchdog emails at 37 hours once per 12 hours
 ✔ Watchdog with no backup at all
 ✔ Failure wrong b2 key writes failed and emails
 ✔ Failure missing key file
 ✔ Failure dump error leaves no half file
 ✔ Missing upload file is a warning not a failure
 ✔ Test email over smtp and a wrong password
 ✔ Make key once and never again
 ✔ Only runs from the command line
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
Daily Job (Tests\Db\DailyJob)
 ✔ Deletes only expired ephemeral rows
 ✔ Export files older than 24 hours go and rows stay
 ✔ Logs rotate weekly and keep 8 weeks
 ✔ Error digest only when there were errors
 ✔ Run does every step and daily php runs from the command line
Endpoint Coverage (Tests\Coverage\EndpointCoverage)
 ✔ Openapi file is readable
 ✔ Every built route is documented and tested
 ✔ Every endpoint attribute points at a real operation
Error Leak (Tests\Security\ErrorLeak)
 ✔ Exception becomes plain 500
 ✔ Details go to the server log with request id
Events Calendar (Tests\Endpoints\EventsCalendar)
 ✔ Ac evt 01 seven events with date not set
 ✔ Admin sets date and venue in ist family cannot
 ✔ All day starts at ist midnight and ds01 stale version
 ✔ Custom event duplicate same type same ist day
 ✔ Event page counts and headcount
 ✔ Headcount matches database 7 4
 ✔ Delete preview counts admin only
 ✔ Ac evt 06 ds11 delete takes invitations undo brings them back
 ✔ Restore after 11 minutes
 ✔ Ac evt 03 agenda items by ist day money only for money users
 ✔ Range rules
 ✔ A task can link to an event and not to a deleted one
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
 ✔ Backup runs show as plain sentences
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
Mailer (Tests\Backup\Mailer)
 ✔ Sends plain text utf8 over smtp
 ✔ Never sends when alerts are off
 ✔ Refuses after the daily cap
 ✔ Falls back to mail when smtp fails
 ✔ From env reads the env names
 ✔ Rejects header injection in addresses
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
```
