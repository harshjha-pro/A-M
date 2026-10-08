# Release notes — Session 02 · Login and members · version 1.0.2

**Goes to:** STAGING only (`staging-wedding.lumorrahouse.com`). Live opens in Session 4.
**Migrations:** none. Nothing to run in phpMyAdmin (the tables were created in Session 1).
**.env:** no change needed on staging. (`SETUP_TOKEN` is only used on live in Session 4: staging already has demo people.)

## What's new
- **Log in** with phone + password. 90-day login that renews itself. 5 wrong passwords lock that phone for 15 minutes.
- **Members** (Settings → Members): add someone as Partner, Family or Viewer; "Can see money" switch; optional end date; three ways to give a password — **send a link** on WhatsApp (they choose their own, valid 72 hours), **make one** (like `rose-4821`), or type one. Turn access off; reset a password (they're logged out on every phone).
- **My account**: change your name and password, choose colours (same as phone / light / dark), see your phones, log out, log out everywhere.
- **Wedding details**: names, dates, city, total budget (budget only for money people). Only Ayush and Mahi can edit.
- **Safety under every save** (built early, option A): one database transaction per save, a full before/after record in the audit log, protection against double saves on weak networks, and "someone else changed this" checks.
- Every page now needs a login. Viewers see no edit buttons; Money hides for people without money access.

## Upload (standard, ≈ 10 minutes)
Same as Session 1, without the first-time steps:
1. File Manager → `domains/staging-wedding.lumorrahouse.com/` → New folder `_incoming` → upload `deploy-session02.zip` → Extract.
2. From `_incoming/deploy-session02/staging/` extract, **into the site folder** (`domains/staging-wedding.lumorrahouse.com/`), overwrite Yes:
   1. `1-server.zip`  2. `2-assets.zip`  3. `3-shell.zip`
3. Copy `staging/version.json` into `public_html/` (overwrite) — **last**.
4. Delete `_incoming`.
5. Open `https://staging-wedding.lumorrahouse.com/api/v1/health` → `{"status":"ok"}`.

## Demo logins on staging (from the demo data; password `demo-1234` for all)
| Who | Phone | Role |
|---|---|---|
| Ayush Porwal | 98290 00001 | Owner |
| Mahi Jagetiya | 98290 00002 | Partner |
| Sunita Porwal (Mummy) | 98290 00003 | Family, sees money |
| Rajendra Porwal (Papa) | 98290 00004 | Family, sees money |
| Kavita Jagetiya | 98290 00005 | Family, no money |
| कमला देवी पोरवाल (Dadi) | 98290 00006 | Viewer |

## Checks — Android (Chrome) **and** iPhone (Safari)
| # | Do | Pass when |
|---|---|---|
| 2.1 | Open the staging address | The **Log in** page (not Home) |
| 2.2 | Log in as Ayush (98290 00001 / demo-1234) | Home says "Namaste, Ayush Porwal" |
| 2.3 | Close the browser completely, open the address again | Still logged in |
| 2.4 | More → Settings → Members → **Add member**: your own second number (or a family member's), Family, **Send a link** → **Share on WhatsApp** | WhatsApp opens with "Namaste … open this link …" |
| 2.5 | On the **other phone**, tap that link in WhatsApp (if it opens inside WhatsApp, tap ⋯ → Open in Chrome / Safari) | "Welcome, … Choose a password." → set one → Home opens, logged in |
| 2.6 | Tap the same link again | "This link has expired or was already used…" |
| 2.7 | On phone A (Ayush): Members → that person → **Reset password** → Make a password for me → confirm | A new password shows once, with Share on WhatsApp |
| 2.8 | On phone B: open any page that loads (e.g. Members) | A "Please log in again" box appears over the page. **Cancel** → Log in page says "Your password was changed. Please log in again." Logging in with the new password works |
| 2.9 | Log out on phone B. Type a wrong password 6 times | 6th try: "Too many tries. Wait 15 minutes or ask Ayush or Mahi." |
| 2.10 | Log in as Dadi (98290 00006) on the iPhone | No "Add member", no "Edit" on Wedding details, no Money under More |
| 2.11 | As Kavita (98290 00005): More | No Money row |
| 2.12 | My account → Colours → Dark, then Light, then Same as my phone | The app changes at once; stays after closing and reopening |
| 2.13 | As Ayush: Settings → Wedding details → Edit → City → Save | "Saved ✓ HH:MM" in Indian time |
| 2.14 | Repeat checks 1.2–1.5 from Session 1 (health, `/.env`, http→https, securityheaders.com) | Same as before |

**Can't log in at all?** Check `/api/v1/health` first. If that says `ok`, send me the time you tried and the last 3 lines of `private/logs/php-error.log`.
**iPhone:** if you added the app to the Home Screen earlier, it has its own login — log in there once more (normal for iPhone).

## Old files to delete later
After 14 days (about 22 Oct): files in `public_html/assets/` that are **not** in this ZIP's `2-assets.zip` (they belong to Session 1).
