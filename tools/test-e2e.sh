#!/usr/bin/env bash
# Playwright smoke journeys against a staging site folder served by php -S + tools/router.php.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
SITE=/srv/am-site-e2e
tools/make-site.sh staging "$SITE" >/dev/null
DB=am_test_e2e
mysql -uroot -e "DROP DATABASE IF EXISTS $DB; CREATE DATABASE $DB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
for f in db/migrations/*.sql; do mysql -uroot $DB < "$f"; done
mysql -uroot $DB < db/dev/seed_demo.sql
cat > "$SITE/private/.env" <<ENV
APP_ENV=staging
APP_URL=http://localhost:8083
DB_HOST=127.0.0.1
DB_NAME=$DB
DB_USER=am_test
DB_PASS=am_test
LOG_DIR=$SITE/private/logs
MIN_CLIENT_VERSION=1.0.0
BACKUP_EXPECTED=false
ENV
SITE_ROOT="$SITE" ROUTER_EXTRA_HOSTS="localhost:8083" php -S 127.0.0.1:8083 "$ROOT/tools/router.php" >/tmp/am-e2e-router.log 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT
sleep 1
cd web
PLAYWRIGHT_CHROMIUM_PATH="${PLAYWRIGHT_CHROMIUM_PATH:-}" npx playwright test "$@"
