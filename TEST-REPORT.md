# Test report — Session 01 — Scaffold

Date: 2026-10-08T17:42Z · App version: 1.0.1 · DB: **MySQL 8.0.46-0ubuntu0.24.04.4** (sandbox, same major as Hostinger) · PHP 8.3.6 · Node v22.22.0 · Web server for .htaccess tests: Apache/2.4.58 (Ubuntu)

Overall: **GREEN — all suites passed**

| Suite | Result |
|---|---|
| PHPUnit (unit, db, endpoints, security, static, coverage) | OK (52 tests, 844 assertions) |
| Endpoint coverage | 2/100 operations built and tested (the rest arrive session by session) |
| Vitest (formats, API client, shell, routes, axe) | Tests 60 passed (60) |
| Build (staging + live) | JS 91.24 kB gz · CSS 4.38 kB gz |
| HTTP rules (real requests) | Apache 2.4.58 + real .htaccess: PASS · php -S + tools/router.php: PASS — OK (9 tests, 196 assertions) OK (9 tests, 193 assertions)  |
| Playwright smoke (android, small-iphone, small-android; Chromium, not Safari) | 12 passed (8.1s) |

Database checks: 001 → 002 → 003 apply with finished_at set; second run of each stops at its guard with data unchanged (DS-28); seed_demo.sql loads (61 families, Devanagari intact) and its second run stops at user id 1.

Skipped and why: WebKit project not installed (bonus only, TESTING §1.8.1). Everything Safari-specific is a real-iPhone check.

## PHPUnit detail
```
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
Kernel (Tests\Unit\Kernel)
 ✔ Env parser
 ✔ Env example parses and has no real secrets
 ✔ Ulid and uuid
 ✔ Clock ist date
 ✔ Logger masks phones only
 ✔ Router matches params and methods
 ✔ Every error code has a plain message
 ✔ Versions match everywhere
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
Static Rules (Tests\Static\StaticRules)
 ✔ Ds19 no hard delete except ephemeral tables
 ✔ Ds20 audit log is append only
 ✔ Ds27 no floats near money
 ✔ Sql uses placeholders not string building
 ✔ No secrets in the repository
 ✔ No debug output
```
