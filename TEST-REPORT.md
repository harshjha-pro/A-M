# Test report — Session 10 — Documents and uploads

Date: 2026-10-09T19:53Z · App version: 1.0.11 · DB: **MySQL 8.0.46-0ubuntu0.24.04.4** (sandbox, same major as Hostinger) · PHP 8.3.6 · Node v22.22.0 · Web server for .htaccess tests: Apache/2.4.58 (Ubuntu)

Overall: **GREEN — all suites passed**

| Suite | Result |
|---|---|
| PHPUnit (unit, db, endpoints, security, static, coverage) | OK (694 tests, 6786 assertions) |
| Endpoint coverage | 104/109 operations built and tested (the rest arrive session by session) |
| Vitest (formats, API client, shell, routes, axe) | Tests 179 passed (179) |
| Build (staging + live) | JS 106.62 kB gz · CSS 5.93 kB gz |
| HTTP rules (real requests) | Apache 2.4.58 + real .htaccess: PASS · php -S + tools/router.php: PASS — OK (13 tests, 241 assertions) OK (13 tests, 237 assertions)  |
| Playwright smoke (android, small-iphone, small-android; Chromium, not Safari) | 96 passed (3.3m) |
| Lighthouse mobile, simulated slow 4G (budget: Perf ≥ 90, A11y ≥ 95, BP ≥ 95) | login: Performance 98 · Accessibility 100 · Best Practices 96 · LCP 1.95 s · TBT 3 ms · CLS 0.000 home: Performance 93 · Accessibility 100 · Best Practices 100 · LCP 2.95 s · TBT 46 ms · CLS 0.057 guests: Performance 96 · Accessibility 100 · Best Practices 100 · LCP 2.66 s · TBT 47 ms · CLS 0.018  |

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
Dashboard (Tests\Endpoints\Dashboard)
 ✔ Cards per role
 ✔ Ac dash 01 countdown in ist late at night
 ✔ Next event is the next dated one
 ✔ Ac dash 02 my overdue first then today and sec07
 ✔ Ac dash 04 headcount per guest event
 ✔ Ac dash 05 safety backup 27 hours old is red
 ✔ Start here and recent activity for admins
 ✔ Documented demo results
Documents (Tests\Endpoints\Documents)
 ✔ Upload photo stored outside web auto title ds04
 ✔ Ac doc 04 same file twice then save again on the same file
 ✔ Sec25 dangerous uploads refused nothing kept
 ✔ List visibility private and payment linked ac doc 03
 ✔ Sec02 private document by id
 ✔ File download headers range and sec02 sec03 ac doc 02
 ✔ Edit details family own uploads only
 ✔ Ds11 delete undo and payment with receipts
 ✔ Restore admin only
 ✔ Receipt link needs money
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
Guests (Tests\Endpoints\Guests)
 ✔ Add family with invitations defaults and rules
 ✔ Duplicate phone 409 with matches and allow duplicate
 ✔ Duplicate check hints phone and name city
 ✔ Suggestions most used first
 ✔ List filters totals and paging
 ✔ Family page and numeric id 404
 ✔ Edit history and ds01 stale version
 ✔ Ds11 delete family with invitations undo identical and sec07
 ✔ Ds16 restore with phone clash warns family 403
 ✔ Invite twice revive undo and no guest event
 ✔ Rsvp uses invitation version so family edit and rsvp both succeed
 ✔ Remove from event with undo
 ✔ Whatsapp tap is bookkeeping no version bump
 ✔ Sec10 powers
Guests Bulk (Tests\Endpoints\GuestsBulk)
 ✔ Ac gst 05 invite all filtered skips invited and undo removes exactly the new
 ✔ Ds12 bulk answer 30 one edited since undo skips and names it
 ✔ Ds25 as of skips rows changed after loading set side
 ✔ Change in the same second as loading is not skipped
 ✔ Uninvite and delete with undo and trash
 ✔ Limits and validation
 ✔ Sec21 bulk rate limit
Guests Export (Tests\Endpoints\GuestsExport)
 ✔ Csv bom ist formula safe filtered audited
Guests Import (Tests\Endpoints\GuestsImport)
 ✔ Preview counts statuses and writes nothing
 ✔ Ac imp 01 04 08 run with decisions one batch and activity line
 ✔ Ac imp 01 duplicates default to skip and ds04 same key one import
 ✔ List imports admin only
 ✔ Get one import
 ✔ Ac imp 05 undo this import keeps edited families and reverts updates
 ✔ Three thousand rows
Guests Scale (Tests\Endpoints\GuestsScale)
 ✔ Headcount matches database 7 4 on demo data
 ✔ List of 50 with 2000 families under 300ms
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
```
