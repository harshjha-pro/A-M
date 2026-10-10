#!/usr/bin/env bash
# Lighthouse mobile (TESTING §7.1–7.2) on Login and Home of a staging site with demo data.
# Home needs a login: the session cookie from a real login is passed as a header.
# Prints one line per page; exits 1 if a budget is missed. Usage: tools/lighthouse.sh
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
SITE=/srv/am-site-lh
OUT="${LH_OUT:-$(mktemp -d)}"
tools/make-site.sh staging "$SITE" >/dev/null
DB=am_test_lh
mysql -uroot -e "DROP DATABASE IF EXISTS $DB; CREATE DATABASE $DB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
for f in db/migrations/*.sql; do mysql -uroot $DB < "$f"; done
mysql -uroot $DB < db/dev/seed_demo.sql
cat > "$SITE/private/.env" <<ENV
APP_ENV=staging
APP_URL=http://localhost:8084
DB_HOST=127.0.0.1
DB_NAME=$DB
DB_USER=am_test
DB_PASS=am_test
LOG_DIR=$SITE/private/logs
MIN_CLIENT_VERSION=1.0.0
BACKUP_EXPECTED=false
ENV
SITE_ROOT="$SITE" ROUTER_EXTRA_HOSTS="localhost:8084" php -S 127.0.0.1:8084 "$ROOT/tools/router.php" >/dev/null 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT
sleep 1
COOKIE=$(curl -s -i -X POST http://localhost:8084/api/v1/auth/login -H 'Content-Type: application/json' -H 'Origin: http://localhost:8084' \
  -H 'X-Client-Version: 9.9.9' -d '{"phone":"9829000001","password":"demo-1234"}' | grep -i '^set-cookie: __Host-am_session' | sed -E 's/^[Ss]et-[Cc]ookie: ([^;]+);.*/\1/')
[ -n "$COOKIE" ] || { echo "login failed"; exit 1; }
export CHROME_PATH="${CHROME_PATH:-/opt/pw-browsers/chromium-1194/chrome-linux/chrome}"
STATUS=0
for page in login home guests; do
  case $page in login) url=http://localhost:8084/login ;; home) url=http://localhost:8084/ ;; guests) url=http://localhost:8084/guests ;; esac
  headers=$([ $page = login ] && echo '{}' || echo "{\"Cookie\":\"$COOKIE\"}")
  npx --yes lighthouse@12.8.2 "$url" --quiet --form-factor=mobile --throttling-method=simulate \
    --only-categories=performance,accessibility,best-practices --extra-headers="$headers" \
    --chrome-flags="--headless=new --no-sandbox" --output=json --output-path="$OUT/$page.json" >"$OUT/$page.log" 2>&1 || { echo "$page: lighthouse failed"; tail -5 "$OUT/$page.log"; STATUS=1; continue; }
  node -e '
    const r = require(process.argv[1]); const c = r.categories, a = r.audits;
    const s = (k) => Math.round(c[k].score * 100);
    const line = `${process.argv[2]}: Performance ${s("performance")} · Accessibility ${s("accessibility")} · Best Practices ${s("best-practices")} · LCP ${(a["largest-contentful-paint"].numericValue/1000).toFixed(2)} s · TBT ${Math.round(a["total-blocking-time"].numericValue)} ms · CLS ${a["cumulative-layout-shift"].numericValue.toFixed(3)}`;
    console.log(line);
    const ok = s("performance") >= 90 && s("accessibility") >= 95 && s("best-practices") >= 95;
    process.exit(ok ? 0 : 3);
  ' "$OUT/$page.json" "$page" || STATUS=1
done
exit $STATUS
