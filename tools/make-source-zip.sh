#!/usr/bin/env bash
# Builds project-source-sessionNN.zip (IMPLEMENTATION §4.2): everything needed to
# start the next chat, including .git/ history. Never .env, vendor/, node_modules/, dist/.
# Usage: tools/make-source-zip.sh 01 <out-dir>
set -euo pipefail
cd "$(dirname "$0")/.."
NN="${1:?session number}"
OUT="${2:?output folder}"
NAME="project-source-session$NN"
mkdir -p "$OUT"
rm -f "$OUT/$NAME.zip"
# Tracked files + the git history. Untracked junk and ignored files stay out.
git ls-files -z -- . ":(exclude)releases/*" | xargs -0 zip -qX "$OUT/$NAME.zip"   # not the old release ZIPs
zip -qrX "$OUT/$NAME.zip" .git
if unzip -l "$OUT/$NAME.zip" | awk '{print $4}' | grep -E '(^|/)\.env$|backup\.key|(^|/)vendor/|node_modules/|(^|/)dist(-live|-staging)?/' ; then
  echo "REFUSED: forbidden file inside $NAME.zip"; rm -f "$OUT/$NAME.zip"; exit 1
fi
echo "Built $OUT/$NAME.zip"
