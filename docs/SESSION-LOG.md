# Session log

| Session | Date | Version | Result | Notes |
|---|---|---|---|---|
| 01 Scaffold | 2026-10-08 | 1.0.1 | Green (see TEST-REPORT.md) | MySQL 8.0.46 in sandbox; .htaccess tested on real Apache 2.4.58 + router copy; staging only |
| 02 Login and members | 2026-10-08 | 1.0.2 | Green (see TEST-REPORT.md) | Option A: UnitOfWork, audit log, idempotency and version checks built now (planned for S3); login, members, invite links, settings; staging only |
| 03 Data safety | 2026-10-09 | 1.0.3 | Green (see TEST-REPORT.md) | Shared base code: EntityDef/BaseRepository/BaseController, change batches, 10-min undo, Deleted items, plain-sentence history + activity, admin health, backups; web drafts, 3-way merge + conflict screen, Undo snackbar, Safety/Activity/Deleted items screens; staging only |
| 04 Live + backup | 2026-10-09 | 1.0.4 | Green (see TEST-REPORT.md) | backup.php in repo (SMTP alerts via Mailer, mail() fallback), fake B2 + fake SMTP, daily.php (DailyJob: purge, exports, rotation, digest); own SMTP client instead of PHPMailer (no runtime packages); live + staging deploy |
| 05 Tasks | 2026-10-09 | 1.0.5 | Green (see TEST-REPORT.md) | Tasks + checklist + tags on the shared base code (link rows without version/public id supported); views/chips/counts, postpone, done+undo, Family deletes own; screens TaskList/TaskDetail/TaskForm/PostponeSheet, Quick Add; first live upload with release checklist |
