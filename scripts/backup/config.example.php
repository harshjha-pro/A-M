<?php
// config.php — settings and secrets for backup.php (DATA-SAFETY.md §3.3).
// TEMPLATE ONLY. Copy to private/backup/config.php on the LIVE site, fill in, permission 600.
// Never in Git, never emailed. Every value below is a placeholder.
return [
    // Database: hPanel → Databases → Management. Same database and user the app uses.
    'db_host' => 'localhost',
    'db_port' => 3306,
    'db_name' => 'u000000000_amlive',
    'db_user' => 'u000000000_amlive',
    'db_pass' => 'PASTE-FROM-PASSWORD-MANAGER',

    // The folder that CONTAINS uploads/ (same as STORAGE_ROOT in private/.env)
    'storage_root' => '/home/u000000000/domains/wedding.lumorrahouse.com/private/storage',

    // Backblaze B2 (DATA-SAFETY.md §3.2)
    'b2_key_id'      => 'PASTE-keyID',
    'b2_app_key'     => 'PASTE-applicationKey',
    'b2_bucket_id'   => 'PASTE-Bucket-ID',
    'b2_bucket_name' => 'am-wedding-backups-xxxx',

    // Who gets alerts (your two Gmail addresses), and the mailbox they come from
    'alert_to'   => ['ayush@example.com', 'mahi@example.com'],
    'alert_from' => 'planner@lumorrahouse.com',

    // SMTP for alerts. Same mailbox and password as SMTP_* in private/.env.
    'smtp_host'   => 'smtp.hostinger.com',
    'smtp_port'   => 465,
    'smtp_secure' => 'ssl',
    'smtp_user'   => 'planner@lumorrahouse.com',
    'smtp_pass'   => 'PASTE-FROM-PASSWORD-MANAGER',
    'health_url'  => 'https://wedding.lumorrahouse.com/api/v1/health',

    // Optional — defaults shown:
    // 'max_age_hours' => 36,          // watchdog email threshold
    // 'keep_local' => 2,              // local copies kept on Hostinger
    // 'max_upload_mb_per_run' => 2000 // first runs spread big upload folders over several nights
    // 'mysqldump' => 'mysqldump', 'openssl' => 'openssl', 'gzip' => 'gzip',
];
