#!/usr/bin/env bash
# Run once per chat (TESTING §1.1). Safe to run twice.
# Installs MySQL 8 (never MariaDB unless MySQL is impossible), Apache for the
# real .htaccess tests, PHP and Node packages, and creates the test database user.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== Versions"; php -v | head -1; node -v; npm -v

need_apt=0
command -v mysqld >/dev/null || need_apt=1
command -v apache2 >/dev/null || need_apt=1
if [ $need_apt = 1 ]; then
  apt-get update -qq
  command -v mysqld >/dev/null || DEBIAN_FRONTEND=noninteractive apt-get install -y -qq mysql-server \
    || { echo "WARN: MySQL 8 unavailable - MariaDB fallback (say so in TEST-REPORT in bold)"; DEBIAN_FRONTEND=noninteractive apt-get install -y -qq mariadb-server; }
  command -v apache2 >/dev/null || DEBIAN_FRONTEND=noninteractive apt-get install -y -qq apache2 libapache2-mod-php8.3 \
    || echo "WARN: Apache not installed; only the router copy of .htaccess will be tested"
fi
(service mysql start || service mariadb start) >/dev/null 2>&1 || true

mysql -uroot <<'SQL'
CREATE USER IF NOT EXISTS 'am_test'@'localhost' IDENTIFIED BY 'am_test';
GRANT ALL ON `am\_test%`.* TO 'am_test'@'localhost';
SET GLOBAL sql_mode = 'STRICT_ALL_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO,ONLY_FULL_GROUP_BY';
SET GLOBAL time_zone = '+00:00';
SQL

(cd api && COMPOSER_ALLOW_SUPERUSER=1 composer install -q --no-interaction)
(cd web && npm ci --no-audit --no-fund --silent)
echo "Setup done."
