# SQL — one file to set up a new database

Import **one** of these into a **new, empty** MySQL/MariaDB database
(phpMyAdmin → select the database → **Import** → choose the file → Character set `utf-8` → **Go**).

| File | Inside | Use when |
|---|---|---|
| `master_with_demo.sql` | All 32 tables + demo data (61 families, tasks, events, payments, 8 demo logins, password `demo-1234`) | Trying the app (e.g. on Vercel) |
| `master.sql` | All 32 tables, empty | Real use — then create the owner with `SETUP_TOKEN` |

Demo logins: Ayush 98290 00001 · Mahi 98290 00002 · Papa 98290 00004 · Kavita 98290 00005.

Imported twice by mistake? It stops at the first line ("Table 'schema_migrations' already exists") and changes nothing.

These files are generated — don't edit them. The sources are `db/migrations/*.sql` and `db/dev/seed_demo.sql`;
rebuild with `tools/make-master-sql.sh` after adding a migration.

**Already imported an older master file (version 1.0.15 or before)?** Don't import the master again —
import only `db/migrations/004_home_photos.sql` (adds the two Home photo tables).
