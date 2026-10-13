# Releases

`AM-Wedding-master-v1.0.14.zip` — everything for version 1.0.14 (Session 13) in one file:

- `source/` — the full project source (no secrets; `.env.example` has placeholders only)
- `deploy/` — the upload packages for Hostinger (`staging/` and `live/`: `1-server.zip`, `2-assets.zip`, `3-shell.zip`, then `version.json` last)
- `README-MASTER.txt` — what is inside and how to use it

Built with `tools/make-master-zip.sh 13 <out>`. All tests green (see `TEST-REPORT.md`).

Also here for Session 13:

- `project-source-session13.zip` — the source code only
- `deploy-session13.zip` — the upload packages only (`staging/`, `live/`, `RELEASE-NOTES.md`, `TEST-REPORT.md`)

Session 14 (version 1.0.15, offline saving):

- `AM-Wedding-master-v1.0.15.zip` — everything in one file (source + deploy)
- `deploy-session14.zip` — the Hostinger upload packages (staging/ and live/)
- The source-only ZIP is not stored here: it is this repository.

Version 1.0.16 (Home & Calendar redesign, "Session 14a"):

- `deploy-session14a.zip` — the Hostinger upload packages (staging/ and live/) **plus `migrations/004_home_photos.sql`** (run it first)
- The master ZIP (77 MB, because it carries the whole git history) is not stored here, to keep the repository small (too big for chat too). Build it any time with `tools/make-deploy.sh 14a out && tools/make-master-zip.sh 14a out`. The source is this repository.

Version 1.0.17 (Workspace step A + Attachment Vault, "Session 14b"):

- `deploy-session14b.zip` — Hostinger upload packages **plus `migrations/005_workspaces_vault.sql`** (run it first; run 004 first if you never did)

Version 1.0.18 (Workspace step B: bride and groom outfits, "Session 14c"):

- `deploy-session14c.zip` — Hostinger upload packages **plus `migrations/006_outfits.sql`** (run it first; run 004 and 005 first if you never did)
