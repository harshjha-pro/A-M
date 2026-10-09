# Session log

| Session | Date | Version | Result | Notes |
|---|---|---|---|---|
| 01 Scaffold | 2026-10-08 | 1.0.1 | Green (see TEST-REPORT.md) | MySQL 8.0.46 in sandbox; .htaccess tested on real Apache 2.4.58 + router copy; staging only |
| 02 Login and members | 2026-10-08 | 1.0.2 | Green (see TEST-REPORT.md) | Option A: UnitOfWork, audit log, idempotency and version checks built now (planned for S3); login, members, invite links, settings; staging only |
| 03 Data safety | 2026-10-09 | 1.0.3 | Green (see TEST-REPORT.md) | Shared base code: EntityDef/BaseRepository/BaseController, change batches, 10-min undo, Deleted items, plain-sentence history + activity, admin health, backups; web drafts, 3-way merge + conflict screen, Undo snackbar, Safety/Activity/Deleted items screens; staging only |
