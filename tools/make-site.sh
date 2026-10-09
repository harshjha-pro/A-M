#!/usr/bin/env bash
# Lays out a site folder exactly like Hostinger (IMPLEMENTATION §6.6):
#   <out>/public_html/  ← web build + .htaccess + api/index.php
#   <out>/private/app/  ← PHP code (bootstrap, autoload, src, VERSION). No tests, no dev packages.
# Usage: tools/make-site.sh <staging|live> <out-dir>     (web must be built first)
set -euo pipefail
cd "$(dirname "$0")/.."
FLAVOUR="${1:?staging or live}"
OUT="${2:?output folder}"
DIST="web/dist-$FLAVOUR"
[ -f "$DIST/index.html" ] || { echo "Missing $DIST — run: (cd web && npm run build:$FLAVOUR)"; exit 1; }

rm -rf "$OUT"
mkdir -p "$OUT/public_html" "$OUT/private/app" "$OUT/private/logs" "$OUT/private/storage/uploads" "$OUT/private/storage/exports"

# public_html: the built app, then our server files on top
cp -R "$DIST/." "$OUT/public_html/"
cp public_html/.htaccess "$OUT/public_html/.htaccess"
mkdir -p "$OUT/public_html/assets" "$OUT/public_html/api"
cp public_html/assets/.htaccess "$OUT/public_html/assets/.htaccess"
cp public_html/api/index.php "$OUT/public_html/api/index.php"

# private/storage: never reachable from the web (outside public_html); deny-all as well.
printf 'Require all denied\n' > "$OUT/private/storage/uploads/.htaccess"
if [ "$FLAVOUR" = staging ]; then
  # Demo files for the demo seed's documents (tools/make-demo-files.py). Never on live.
  cp -R db/dev/demo-files/uploads/. "$OUT/private/storage/uploads/"
fi

# private/app: only what runs on the server
cp api/bootstrap.php api/autoload.php "$OUT/private/app/"
cp -R api/src "$OUT/private/app/src"
cp VERSION "$OUT/private/app/VERSION"
# Composer packages: none needed at runtime (our own autoloader; our own SMTP client).

# Cron scripts (both sites) and the backup script (live only: staging holds demo data).
mkdir -p "$OUT/private/cron"
cp scripts/cron/daily.php "$OUT/private/cron/daily.php"
# Emergency restore from an export (Session 11): CLI only, outside public_html.
mkdir -p "$OUT/private/app/tools"
cp tools/restore-from-export.php "$OUT/private/app/tools/restore-from-export.php"
if [ "$FLAVOUR" = live ]; then
  mkdir -p "$OUT/private/backup"
  cp scripts/backup/backup.php scripts/backup/config.example.php "$OUT/private/backup/"
  chmod 700 "$OUT/private/backup"
  chmod 600 "$OUT/private/backup/"*.php
fi
echo "Site folder ready: $OUT ($FLAVOUR, version $(cat VERSION))"
