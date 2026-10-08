#!/usr/bin/env bash
# Real-HTTP tests of the server rules (SEC-05, SEC-30, SPA fallback, HTTPS, hosts):
#   1. Apache 2.4 + mod_php reading the REAL public_html/.htaccess (closest to Hostinger LiteSpeed)
#   2. php -S + tools/router.php (the sandbox copy of the rules)
# Uses a staging build and its own database (am_test_http, migrations only).
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
SITE=/srv/am-site-http
CONF=/srv/am-apache
DB=am_test_http
RESULT=0

tools/make-site.sh staging "$SITE" >/dev/null

# Database for the site: migrations 001 → 003 (no seed needed for these checks)
mysql -uroot -e "DROP DATABASE IF EXISTS $DB; CREATE DATABASE $DB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL ON $DB.* TO 'am_test'@'localhost'; GRANT ALL ON $DB.* TO 'am_test'@'127.0.0.1';" 2>/dev/null || \
  mysql -uroot -e "DROP DATABASE IF EXISTS $DB; CREATE DATABASE $DB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
for f in db/migrations/*.sql; do mysql -uroot $DB < "$f"; done

cat > "$SITE/private/.env" <<ENV
APP_ENV=staging
APP_URL=https://staging-wedding.lumorrahouse.com
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=$DB
DB_USER=am_test
DB_PASS=am_test
LOG_DIR=$SITE/private/logs
STORAGE_ROOT=$SITE/private/storage
MIN_CLIENT_VERSION=1.0.0
BACKUP_EXPECTED=false
SETUP_TOKEN=http-test-setup-token-0123456789
ENV
# A decoy secret inside public_html too: it must never be served.
printf 'DB_PASS=decoy-should-never-be-served\n' > "$SITE/public_html/.env"
chmod 700 "$SITE/private"; chmod 600 "$SITE/private/.env"
chown -R www-data:www-data "$SITE"

run_suite() { # name base
  mysql -uroot $DB -e "SET FOREIGN_KEY_CHECKS=0; DELETE FROM audit_log; DELETE FROM sessions; DELETE FROM login_attempts; DELETE FROM rate_limits; DELETE FROM users; SET FOREIGN_KEY_CHECKS=1;"
  echo "== HTTP tests via $1 ($2)"
  if AM_HTTP_BASE="$2" AM_HTTP_SITE="$SITE" AM_HTTP_SETUP_TOKEN=http-test-setup-token-0123456789 api/vendor/bin/phpunit -c api/phpunit.xml --group http --testsuite http --testdox; then
    echo "== $1: PASS"
  else
    echo "== $1: FAIL"; RESULT=1
  fi
}

# --- 1. Apache with the real .htaccess --------------------------------------
if command -v apache2 >/dev/null; then
  mkdir -p "$CONF/logs"
  M=/usr/lib/apache2/modules
  cat > "$CONF/httpd.conf" <<APACHE
ServerRoot "$CONF"
Listen 127.0.0.1:8081
PidFile $CONF/logs/httpd.pid
Mutex file:$CONF/logs default
User www-data
Group www-data
ServerName staging-wedding.lumorrahouse.com
ServerTokens Prod
ServerSignature Off
TraceEnable Off
LoadModule mpm_prefork_module $M/mod_mpm_prefork.so
LoadModule authz_core_module $M/mod_authz_core.so
LoadModule dir_module $M/mod_dir.so
LoadModule mime_module $M/mod_mime.so
LoadModule rewrite_module $M/mod_rewrite.so
LoadModule headers_module $M/mod_headers.so
LoadModule php_module $M/libphp8.3.so
TypesConfig /etc/mime.types
ErrorLog $CONF/logs/error.log
LogLevel warn
DocumentRoot "$SITE/public_html"
<Directory />
  AllowOverride None
  Require all denied
</Directory>
<Directory "$SITE/public_html">
  AllowOverride All
  Require all granted
</Directory>
<FilesMatch "\.php$">
  SetHandler application/x-httpd-php
</FilesMatch>
php_admin_flag display_errors off
php_admin_flag expose_php off
APACHE
  apache2 -f "$CONF/httpd.conf" -k stop >/dev/null 2>&1 || true
  sleep 0.5
  apache2 -f "$CONF/httpd.conf" -k start
  sleep 1
  run_suite "Apache $(apache2 -v | head -1 | sed 's/.*Apache\///; s/ .*//') + real .htaccess" "http://127.0.0.1:8081"
  apache2 -f "$CONF/httpd.conf" -k stop || true
  if grep -qiE "error|alert" "$CONF/logs/error.log" 2>/dev/null; then
    echo "-- Apache error log:"; grep -iE "error|alert" "$CONF/logs/error.log" | tail -5
  fi
else
  echo "== Apache not installed: skipped (router copy still tested)"
fi

# --- 2. php -S with tools/router.php ----------------------------------------
SITE_ROOT="$SITE" php -S 127.0.0.1:8082 "$ROOT/tools/router.php" >/tmp/am-router.log 2>&1 &
PID=$!
sleep 1
run_suite "php -S + tools/router.php" "http://127.0.0.1:8082"
kill $PID 2>/dev/null || true

exit $RESULT
