#!/usr/bin/env bash
# Builds deploy-sessionNN.zip (IMPLEMENTATION §4.2):
#   deploy-sessionNN/
#     RELEASE-NOTES.md, TEST-REPORT.md
#     migrations/               SQL to run in phpMyAdmin (see RELEASE-NOTES)
#     staging/ live/            each: 1-server.zip, 2-assets.zip, 3-shell.zip, version.json
# Every inner ZIP holds paths starting at the site folder (private/…, public_html/…),
# so you always extract it in the site folder.
# Usage: tools/make-deploy.sh 02 <out-dir> [migration files to ship, e.g. db/migrations/004_x.sql]
# (Session 01 shipped 001–003 + the staging seed; later sessions ship only new files.)
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
NN="${1:?session number, e.g. 01}"
OUT="${2:?output folder}"
NAME="deploy-session$NN"
WORK="$(mktemp -d)"
STAGE="$WORK/$NAME"
mkdir -p "$STAGE/migrations" "$OUT"

(cd web && npm run build:staging >/dev/null && npm run build:live >/dev/null)

for FLAVOUR in staging live; do
  SITE="$WORK/site-$FLAVOUR"
  tools/make-site.sh "$FLAVOUR" "$SITE" >/dev/null
  DEST="$STAGE/$FLAVOUR"
  mkdir -p "$DEST"
  (
    cd "$SITE"
    # Never ship a .env, keys or test files, whatever happens upstream.
    find . \( -name '.env' -o -name '*.key' -o -name 'config.php' \) -delete
    zip -qrX "$DEST/1-server.zip" private/app private/logs private/storage public_html/api/index.php
    zip -qrX "$DEST/2-assets.zip" public_html/assets -x 'public_html/assets/.htaccess'
    zip -qrX "$DEST/3-shell.zip" public_html/index.html public_html/manifest.webmanifest public_html/.htaccess \
      public_html/ios-class.js public_html/icons public_html/assets/.htaccess
    cp public_html/version.json "$DEST/version.json"
  )
done

# SQL for this session: only the files named on the command line.
shift 2
if [ "$#" -eq 0 ]; then
  printf 'No database changes in this session. Nothing to run in phpMyAdmin.\n' > "$STAGE/migrations/NONE.txt"
fi
for f in "$@"; do
  case "$f" in
    db/dev/*) cp "$f" "$STAGE/migrations/STAGING-ONLY_$(basename "$f")" ;;
    *) cp "$f" "$STAGE/migrations/" ;;
  esac
done

cp RELEASE-NOTES.md "$STAGE/RELEASE-NOTES.md"
[ -f TEST-REPORT.md ] && cp TEST-REPORT.md "$STAGE/TEST-REPORT.md"

(cd "$WORK" && zip -qrX "$ROOT/$NAME.zip.tmp" "$NAME")
mv "$ROOT/$NAME.zip.tmp" "$OUT/$NAME.zip"
rm -rf "$WORK"

# Safety check on the result: no secrets, no tests, no dev packages.
if unzip -l "$OUT/$NAME.zip" | grep -E '\.env$|backup\.key|config\.php|/tests/|phpunit|node_modules' ; then
  echo "REFUSED: forbidden file inside $NAME.zip"; rm -f "$OUT/$NAME.zip"; exit 1
fi
echo "Built $OUT/$NAME.zip"
