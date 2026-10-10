#!/usr/bin/env bash
# Builds AM-Wedding-master-v<version>.zip: the whole project (every tracked file + .git
# history) in source/, the ready-to-upload deploy package in deploy/, and README-MASTER.txt.
# Never .env, keys, node_modules, vendor or build folders.
# Usage: tools/make-master-zip.sh <session NN> <out-dir>     (run make-deploy.sh NN first)
set -euo pipefail
cd "$(dirname "$0")/.."
NN="${1:?session number}"
OUT="${2:?output folder}"
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"
VER="$(cat VERSION)"
DEPLOY="$OUT/deploy-session$NN.zip"
[ -f "$DEPLOY" ] || { echo "Missing $DEPLOY — run tools/make-deploy.sh $NN $OUT first"; exit 1; }
NAME="AM-Wedding-master-v$VER"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
M="$STAGE/$NAME"
mkdir -p "$M/source" "$M/deploy"
git ls-files -z -- . ":(exclude)releases/*" | xargs -0 -I{} cp --parents {} "$M/source/"   # not the old release ZIPs
cp -r .git "$M/source/.git"
(cd "$M/deploy" && unzip -q "$DEPLOY" && mv "deploy-session$NN"/* . && rmdir "deploy-session$NN")
cat > "$M/README-MASTER.txt" <<TXT
A&M Wedding Planner — master ZIP (version $VER, after Session $NN)
==================================================================

source/   The whole project: api/ (PHP), web/ (React), db/ (migrations, demo data, demo
          files), docs/ (CONTEXT, FEATURES, API, DATABASE, TESTING, DATA-SAFETY,
          IMPLEMENTATION, PWA, DESIGN, SESSION-LOG, openapi.yaml), tools/, scripts/,
          public_html/, tests, RELEASE-NOTES.md, TEST-REPORT.md, and .git (full history).
          Use it to continue in a new chat or to rebuild everything.

deploy/   Ready to upload to Hostinger (same as deploy-session$NN.zip):
            staging/  1-server.zip → 2-assets.zip → 3-shell.zip → version.json LAST
            live/     the same for the live site
            migrations/          SQL to run first, if any (NONE.txt = nothing)
            RELEASE-NOTES.md     upload steps and phone checks
            TEST-REPORT.md       test results

Not inside, on purpose:
  - .env files and any passwords or keys (make .env from source/.env.example on the server)
  - web/node_modules and api/vendor (rebuild: cd web && npm ci ; cd api && composer install)
  - web/dist* build folders (rebuild: cd web && npm run build:staging / build:live)
TXT
ZIP="$OUT/$NAME.zip"
rm -f "$ZIP"
(cd "$STAGE" && zip -qrX "$ZIP" "$NAME")
unzip -tq "$ZIP" >/dev/null
if unzip -Z1 "$ZIP" | grep -E '(^|/)\.env$|node_modules/|/vendor/|backup\.key|(^|/)dist(-live|-staging)?/'; then
  echo "REFUSED: forbidden file inside $NAME.zip"; rm -f "$ZIP"; exit 1
fi
echo "Built $ZIP"
