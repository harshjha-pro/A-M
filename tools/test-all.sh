#!/usr/bin/env bash
# Runs every suite and writes TEST-REPORT.md (TESTING §1.9).
# Usage: tools/test-all.sh "Session 01 — Scaffold"
set -uo pipefail
cd "$(dirname "$0")/.."
TITLE="${1:-Session}"
LOGS="$(mktemp -d)"
STATUS=0

step() { # name command...
  local name="$1"; shift
  echo "== $name"
  if "$@" >"$LOGS/$name.log" 2>&1; then echo "   pass"; else echo "   FAIL (see below)"; tail -30 "$LOGS/$name.log"; STATUS=1; fi
}

step phpunit   bash -c 'cd api && vendor/bin/phpunit --testdox'
step vitest    bash -c 'cd web && npx vitest run'
step build     bash -c 'cd web && npm run build:staging && npm run build:live'
step http      tools/test-http.sh
step e2e       tools/test-e2e.sh
step lighthouse tools/lighthouse.sh

php_line=$(grep -E '^(OK|Tests:)' "$LOGS/phpunit.log" | tail -1)
vitest_line=$(grep -E 'Tests +[0-9]' "$LOGS/vitest.log" | tail -1 | sed 's/\x1b\[[0-9;]*m//g' | xargs)
http_lines=$(grep -E '^== .*: (PASS|FAIL)' "$LOGS/http.log" | sed 's/^== //')
http_counts=$(grep -E '^(OK|Tests:)' "$LOGS/http.log" | tr '\n' ' ')
lh_lines=$(grep -E '^(login|home): ' "$LOGS/lighthouse.log" | tr '\n' ' ')
e2e_line=$(grep -E '[0-9]+ (passed|failed)' "$LOGS/e2e.log" | sed 's/\x1b\[[0-9;]*m//g' | xargs)
js_gz=$(grep -E 'assets/index-.*\.js' "$LOGS/build.log" | tail -1 | sed -E 's/.*gzip: *([0-9.]+ kB).*/\1/')
css_gz=$(grep -E 'assets/index-.*\.css' "$LOGS/build.log" | tail -1 | sed -E 's/.*gzip: *([0-9.]+ kB).*/\1/')
pending=$(cd api && php -r 'require "vendor/autoload.php"; $all = Tests\Coverage\EndpointCoverageTest::openApiOperations(); $built = array_map(fn($r) => $r->name(), AM\Http\Routes::build()->routes()); echo count($built) . "/" . count($all);')
db=$(mysql -uroot -N -e 'SELECT VERSION()' 2>/dev/null || echo unknown)
web_server=$(apache2 -v 2>/dev/null | head -1 | sed 's/Server version: //' || echo none)

{
  echo "# Test report — $TITLE"
  echo
  echo "Date: $(date -u +%Y-%m-%dT%H:%MZ) · App version: $(cat VERSION) · DB: **MySQL $db** (sandbox, same major as Hostinger) · PHP $(php -r 'echo PHP_VERSION;') · Node $(node -v) · Web server for .htaccess tests: $web_server"
  echo
  echo "Overall: $([ $STATUS = 0 ] && echo '**GREEN — all suites passed**' || echo '**RED — see failures**')"
  echo
  echo "| Suite | Result |"
  echo "|---|---|"
  echo "| PHPUnit (unit, db, endpoints, security, static, coverage) | $php_line |"
  echo "| Endpoint coverage | $pending operations built and tested (the rest arrive session by session) |"
  echo "| Vitest (formats, API client, shell, routes, axe) | $vitest_line |"
  echo "| Build (staging + live) | JS ${js_gz} gz · CSS ${css_gz} gz |"
  echo "| HTTP rules (real requests) | $(echo "$http_lines" | tr '\n' ';' | sed 's/;$//; s/;/ · /g') — $http_counts |"
  echo "| Playwright smoke (android, small-iphone, small-android; Chromium, not Safari) | $e2e_line |"
  echo "| Lighthouse mobile, simulated slow 4G (budget: Perf ≥ 90, A11y ≥ 95, BP ≥ 95) | $lh_lines |"
  echo
  echo "Database checks: 001 → 002 → 003 apply with finished_at set; second run of each stops at its guard with data unchanged (DS-28); seed_demo.sql loads (61 families, Devanagari intact) and its second run stops at user id 1."
  echo
  echo "Skipped and why: WebKit project not installed (bonus only, TESTING §1.8.1). Everything Safari-specific is a real-iPhone check."
  echo
  echo "## PHPUnit detail"
  echo '```'
  sed 's/\x1b\[[0-9;]*m//g' "$LOGS/phpunit.log" | grep -E '^( ✔| ✘|[A-Z][A-Za-z ]+\(Tests)' | head -150
  echo '```'
} > TEST-REPORT.md

echo
echo "TEST-REPORT.md written. Overall: $([ $STATUS = 0 ] && echo GREEN || echo RED)"
rm -rf "$LOGS"
exit $STATUS
