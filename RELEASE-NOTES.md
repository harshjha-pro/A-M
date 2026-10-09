# Release notes — Session 12 · Install and updates · version 1.0.13

**Goes to:** STAGING first, then **LIVE** (release checklist below).
**Migrations:** none. Nothing to run in phpMyAdmin.
**.env / hPanel:** no change.
**`.htaccess`:** changed (in `3-shell.zip`): `reset.css` joins the "always ask the server" files.

## ⚠ The upload order matters from now on
The app now keeps a copy of itself on each phone (so it opens fast and without internet). Phones check `version.json` to learn that a new version exists, so **`version.json` must go up last**:

1. `1-server.zip` → extract in the site folder (as before)
2. `2-assets.zip` → extract into `public_html` (as before)
3. `3-shell.zip` → extract into `public_html` (as before; it now holds `sw.js`, `reset.html`, the guide pictures)
4. **`version.json`** (a single file in the `staging/` or `live/` folder) → upload into `public_html`, replacing the old one. **Always last.**

A phone that checks halfway through simply sees the old version, never half of the new one.
**Keep old files in `public_html/assets/` for 14 days** (a phone still on the old version may need them), then delete the ones not in this ZIP.

## What's new
- **Install on the Home Screen.**
  - **Android (Chrome):** after login a banner says "Install A&M Wedding on this phone" with **Install** and **Not now** (Not now hides it for 7 days).
    - Long-press the icon for shortcuts: Add task, Add family, My tasks.
    - A link opened inside WhatsApp first asks you to open it in Chrome.
  - **iPhone (Safari):** after the first login a 4-step illustrated guide opens once (Share → Add to Home Screen → keep "Open as Web App" on → Add).
    - In Chrome on iPhone it says "Please open this in Safari".
    - **On iPhone, log in once more inside the Home Screen app.** It keeps its own login; that's normal.
  - **More → Install Guide** always has the steps, for both phones.
- **Opens fast, and opens without internet.** The app's screens are kept on the phone.
  - Your data still always comes fresh from the server: a save that fails says so, never pretends.
  - Reading your data without internet comes in Session 13.
- **"New version available. Tap to refresh."**
  - Appears within a minute of a new upload, at the bottom of the screen.
  - It **never reloads by itself**, and never while you are typing in a form: "Save or close the open form first. Then tap Refresh."
  - While it shows, the screen makes room under it, so Save and Cancel are never covered.
  - If the server ever refuses old versions, it says "Please refresh to keep saving. Your typing is kept."
- **Settings → This phone** (everyone): the phone type, app version, installed or not, whether the app opens without internet, whether the phone keeps the app's data (with a button to ask it to), and space used.
  - **Fix the app:** clears the app's files on this phone and opens the newest version.
  - It keeps your login and anything not yet sent.
  - The same button is in the Install Guide, and at `https://<site>/reset.html`.
- **Old phones:** iPhone below iOS 17 → "Please update this iPhone: Settings › General › Software Update." Chrome below 120 → "Please update Chrome from the Play Store."

## 1. Staging (≈ 15 minutes)
Upload in the order above from the **`staging/`** folder → `/api/v1/health` = `{"status":"ok"}` → phone checks below.

## 2. Live (after staging passes) — release checklist
1. Live Settings → Safety all green.
2. **Backup now** — SSH: `php ~/domains/wedding.lumorrahouse.com/private/backup/backup.php --kind=manual_db` → `Done in … s.`
3. Save `deploy-session12.zip` to Drive `deploys/`; tell the family group (quiet hour): "The app can now be put on your Home Screen. Open the link, then follow the Install banner (Android) or the steps (iPhone)."
4. Upload in the order above from the **`live/`** folder, `version.json` last.
5. Within 10 minutes:
   - Health check says `ok`.
   - An open app shows "New version available" → tap → Settings → This phone says 1.0.13.
6. If anything fails: upload `deploy-session11.zip` (`live/`) the same way, `version.json` last.
   - If a phone then seems stuck: Settings → This phone → **Fix the app**.

## Phone checks (staging, then live) — Android and iPhone
Staging logins (password `demo-1234`): Ayush 98290 00001 · Papa 98290 00004.
Staging installs as **"A&M Staging"** with its own icon colour, separate from the live app.

| # | Do | Pass when |
|---|---|---|
| R1 / T1 / T3 | Send yourself the staging link on WhatsApp, open it, log in | Android: "Open in Chrome" hint if inside WhatsApp; then the **Install** banner → Chrome's dialog → icon on the Home screen. iPhone: open in Safari; the 4-step guide; icon "A&M Staging" |
| R2 / T5 | Look at the icon | Android: launcher shape, no white square. iPhone: no black corners; "&" readable |
| R3 / T4 | Open from the icon | No address bar. iPhone asks to log in once more (expected, once); Android doesn't |
| R4 | Log in, swipe the app away, wait 10 min, reopen | Still logged in (repeat after a phone restart) |
| R5 | Don't open it for 14 days | Still logged in |
| R10 / T29 | Ask me for a new staging build (or re-upload `version.json` after any change). Open **Add task**, type something, wait ≤ 1 min | "New version available." → **Tap to refresh** → "Save or close the open form first."; your typing is still there; Cancel → Tap to refresh → reloads; This phone shows the new version |
| T30 | Close the app, upload a new build, open it | Prompt within a minute |
| R11 / T9 | Notch / home bar / landscape | Top bar below the notch, bottom nav and + above the home bar; the update prompt never covers Save |
| R12 | Back | Android Back = one step; iPhone ← Back on inner screens |
| R14 / T6 | Phone in dark mode | App follows; status bar readable |
| R15 / T10 | Largest text size | Rows wrap, nothing cut |
| R16 | Pinch-zoom | Works everywhere |
| R17 / T8 | Android: long-press the icon | 3 shortcuts (Add task, Add family, My tasks) open the right screens. (Wedding Day comes in Release 2b) |
| R18 | A phone with iOS < 17 or old Chrome (if you can borrow one) | "Please update…" note |
| T31 | Settings → This phone → **Fix the app** | "Fixing the app…" → opens Home, still logged in |
| X | Airplane mode → open the app from the icon | The app opens (screens show "can't load" until Session 13 adds offline reading) |

## Old files to delete later
After 14 days: files in `public_html/assets/` that are not in this ZIP's `2-assets.zip`.
