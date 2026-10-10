#!/usr/bin/env bash
# Builds sql/master.sql (all migrations) and sql/master_with_demo.sql (+ demo data): ONE file to
# import into a NEW, EMPTY database with phpMyAdmin. The real sources stay db/migrations/*.sql.
# Usage: tools/make-master-sql.sh
set -euo pipefail
cd "$(dirname "$0")/../db"
build() {
  local out=$1; shift
  {
    cat <<HDR
-- =============================================================================
-- A&M Wedding Planner — $out  (version $(cat ../VERSION))
-- ONE file for a NEW, EMPTY database:
--   phpMyAdmin → select the database → Import → this file → Character set utf-8 → Go.
-- Contains, in order: $*
-- On a database that already has the tables it stops at the first line
-- ("Table 'schema_migrations' already exists") and changes nothing.
-- Made by tools/make-master-sql.sh — do not edit; edit the files listed above.
-- =============================================================================

HDR
    for f in "$@"; do printf -- '\n-- ##### %s #####\n\n' "$f"; cat "$f"; printf '\n'; done
  } > "../sql/$out"
  echo "Built sql/$out"
}
MIG=(migrations/001_init.sql migrations/002_open_answers.sql migrations/003_api_support.sql)
build master.sql "${MIG[@]}"
build master_with_demo.sql "${MIG[@]}" dev/seed_demo.sql
