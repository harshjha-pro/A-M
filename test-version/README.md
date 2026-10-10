# A&M Wedding Planner — test version (Vercel)

**Open:** https://am-wedding-rust.vercel.app
**Password for every demo login:** `demo-1234`

## Who can log in

| Phone | Person | Role | What they can do |
|---|---|---|---|
| 98290 00001 | Ayush Porwal | Owner | Everything: guests, tasks, events, money, documents, members, settings, export |
| 98290 00002 | Mahi Jagetiya | Partner | Everything, same as Ayush |
| 98290 00003 | Sunita Porwal (Mummy) | Family + money | Guests, tasks, events, money; no settings |
| 98290 00004 | Rajendra Porwal (Papa) | Family + money | Guests, tasks, events, money; no settings |
| 98290 00005 | Kavita Jagetiya | Family, no money | Guests, tasks, events; **no amounts or payments** |
| 98290 00006 | कमला देवी पोरवाल (Dadi) | Viewer | Reads only: countdown, headcount, events |
| 98290 00007 | Neha Sharma (Planner) | Family, no money | Like Kavita; access ends 20 Feb 2027 |
| 98290 00008 | Rohit Porwal | Switched off | Can't log in (shows how a removed member looks) |

## Good to know

- **Demo data only:** 61 families, tasks, events, payments. Nothing real.
- **Test version:** uploaded photos and PDFs aren't kept, and there are no backups. Don't enter real guest lists or receipts here.
- **Install on the phone:** Android shows "Add to Home screen". On iPhone, open in Safari → Share → Add to Home Screen.
- **Only use this exact address.** Other `….vercel.app` addresses Vercel shows won't let you log in.

## Setting up the test database (only once)

1. hPanel → MySQL Databases → create a test database and user.
2. phpMyAdmin → Import [`sql/master_with_demo.sql`](../sql/master_with_demo.sql) (these demo logins come from it).
3. hPanel → Remote MySQL → **Any Host** for that database.
4. Vercel → am-wedding → Settings → Environment Variables → `DB_HOST` (website IP), `DB_NAME`, `DB_USER`, `DB_PASS`.

More detail: [`docs/VERCEL.md`](../docs/VERCEL.md) · empty database instead: [`sql/master.sql`](../sql/master.sql)

*Database and Vercel passwords are not in this folder and never should be.*
