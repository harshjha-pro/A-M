# PWA.md — Install, offline, updates and notifications

Version 1.1 · 8 Oct 2026 · Owner: Ayush Porwal · v1.1 applies the owner's answers (see "Answers applied")
Reads from: `CONTEXT.md` v1.5 (source of truth), `DESIGN.md` v1.1, `API.md` v1.1, `DATABASE.md`, `001_init.sql`.
Release: install, service worker, offline reading, the outbox and updates are **Release 1** (25 Oct). Notifications are **R2a** (15 Nov). The wedding-day pack is **R2b** (10 Jan).

## Conflicts flagged

| # | Topic | Earlier docs | This doc does |
|---|---|---|---|
| P1 | Saving offline | CONTEXT 7: "No offline writes in v1. Offline is read-only." DESIGN and API follow it. | **Answered 8 Oct: limited outbox.** Every small save goes through an outbox on the phone. Offline, only ticks, Coming? chips, checklist items, and adding or editing a task or family can wait. Everything else still needs internet. CONTEXT decision 7 is updated to v1.4. |
| P2 | Android install prompt | CONTEXT 6: "no custom install prompt". Your brief: "Android uses beforeinstallprompt". | **Answered: our own.** Android shows our own banner "Install A&M Wedding on this phone" [Install] [Not now], plus an Install button in the guide. Both open Chrome's install dialog. CONTEXT 6 updated. |
| P3 | Word "sync" | Your brief: "X changes waiting to sync", "Sync now". DESIGN §8: no "sync" in the UI. | The screen says **"3 changes waiting to send"** and **Send now**. Code keeps the word "outbox". |
| P4 | Offline wording | DESIGN §8 offline banner: "You can look, but not save." | New banner: "No internet. Some changes can wait on this phone." New Saved-indicator state: 🕒 **Waiting to send**. DESIGN §7–8 need this update. |
| P5 | Push endpoints | API.md has no push or notification-settings endpoints. `/sync` has no wedding-day timeline. | Proposed in §7.3 (R2a) and §8 (R2b). To be added to API.md v1.2. |
| P6 | Notification settings | `users` has no columns for push on/off or email on/off. | Migration `005_notifications.sql` sketched in §7.5 (`004` is card tracking). DATABASE.md to follow. No quiet hours (answered). |
| P7 | Inline scripts | DESIGN §2.7: "a 3-line script" adds the `ios` class. API §10.3 CSP: `script-src 'self'`. | The CSP blocks inline scripts. The `ios` class script is a file (`/ios-class.js`). vite-plugin-pwa's inline register is switched off. |
| P8 | App icon | DESIGN §2.6: "Your logo", placeholder "A&M" maroon on ivory. | **Answered: Apple style, no logo.** Ivory "A&M" on a maroon gradient, marigold "&". Files made (§2.2). DESIGN §2.6 to follow. |

## Built in Session 12 (9 Oct 2026) — what differs from the text below

| Topic | As built | Why |
|---|---|---|
| Install Guide pictures | Drawn SVG illustrations (`public/install-guide/*.svg`), not screenshots | Real iOS screenshots need a real iPhone; the drawings show the same buttons, circled. Replace with screenshots any time (same file names, `.png`). |
| Splash images (§2.4) | Dropped | Allowed by §2.4 ("if this takes more than an hour, drop it"); the shell opens from cache in well under a second. |
| Shortcuts | 3: Add task (`/tasks/new`), Add family (`/guests/new`), My tasks (`/tasks?view=mine`) | `/add/*` routes don't exist; Wedding Day arrives with R2b. |
| Registration | Our own `src/pwa/swClient.js` on `workbox-window` (not `virtual:pwa-register`) | Testable without the Vite virtual module; same behaviour (`registerType: 'prompt'`). |
| Update prompt | Also makes room at the bottom of the page while shown (`--am-update-h`) | E2E-12 found the prompt covered a form's Save/Cancel — the very buttons it asks you to use. |
| Outbox wait before refresh (§6.3) | Not yet | The outbox arrives in Session 14; the prompt will wait for it then. |
| `reset.css` | Added (plain styles for `reset.html`); never precached, `no-cache` | CSP forbids inline styles. |

## Built in Session 13 (10 Oct 2026) — offline reading, what differs from §5.1

| Topic | As built | Why |
|---|---|---|
| Stores | `records` keyed `[kind, id]` holding `{ kind, id, row }`; `snapshots` (every GET reply seen online, keyed by path + sorted query); `meta`. Outbox store comes in Session 14 (DB version 2 creates missing stores). | Rows have their own `type` fields (documents). |
| Offline answers | Main lists/details answered from `records` with the server's filter rules (`offline/local.js`); any other screen from its saved reply; whichever is newer. | Search works for words never searched online. |
| Invitations | Come inside their family (a changed invitation resends the family) | One shape for the list and the family page. |
| Full sync | Never empties the copy first: rows are written as pages arrive, unseen ones removed only when the last page is in. Access change (`full_resync_required`) clears at once. | Found by E2E: an interrupted first sync left a half copy. |
| Wipes | A generation counter: writes from a sync or reply that began before a wipe are dropped at transaction time. | Found by E2E: a sync finishing after logout wrote rows back. |
| Offline start | Last `GET /session` reply (no CSRF token) kept in `meta`; used only when the server can't be reached. | So the icon opens offline. |
| "Updated 10:42 AM" when online | Not shown; online screens are live | Only the offline age is required to never hide. |

## Answers applied (8 Oct 2026)

| # | Question | Answer | Applied in |
|---|---|---|---|
| 1 | Android install button | Our own install prompt | P2, §1, §3.2 (`AndroidInstallBanner.jsx`), CONTEXT 6 |
| 2 | Phones | Phones made 2020 or later | §0.1, §3.3, §9, §10 |
| 3 | Quiet hours | None | §7 (columns, cron, settings removed), T27 |
| 4 | Emails / `planner@` | OK | §7.9 |
| 5 | Logo | Apple style | P8, §2.2, icon files |
| 6 | Staging name | `staging-wedding.lumorrahouse.com` | §11 |
| 7 | Guest phones offline on every phone | OK, all roles | §5.1 |
| 8 | Duplicate check for offline families runs when sent | OK | §5.2 |
| 9 | Capacitor review | 30 Nov | §9 |

---

## 0. Browser facts: checked, and what to verify on real phones

Checked on 8 Oct 2026. "Verify" items are ones I'm not sure of. Each has a test in §10.

**Checked**

| Fact | Source |
|---|---|
| iPhone Web Push works only in a Home Screen web app, iOS/iPadOS **16.4+**. Permission must come from a tap. | [WebKit: Web Push for Web Apps on iOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) |
| iPhone Home Screen apps can show a number badge (iOS 16.4+), once notifications are allowed. | [WebKit: Badging for Home Screen Web Apps](https://webkit.org/blog/14112/badging-for-home-screen-web-apps/) |
| **Declarative Web Push** on iOS/iPadOS **18.4+**: the phone can show a push from JSON alone, even if our service worker fails. If a service worker is installed it still gets the push event. | [WebKit: Meet Declarative Web Push](https://webkit.org/blog/16535/meet-declarative-web-push/) |
| **iOS 26:** any site added from the Share menu opens as a web app by default. A switch **Open as Web App** appears; off = plain bookmark. No manifest needed (we have one anyway). | [heise: iOS 26 web app behaviour](https://heise.de/-10749652) |
| Safari 17+ has `navigator.storage.persist()`. Safari decides by its own rules, e.g. whether the site is a Home Screen web app. Eviction is whole-site, least recently used first; persistent sites are skipped. Quota up to ~60% of disk in Safari. | [WebKit: Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/) |
| No Background Sync, Periodic Background Sync or Background Fetch on iPhone. | [WebKit bug 182565](https://bugs.webkit.org/show_bug.cgi?id=182565), [MagicBell iOS PWA guide (Mar 2026)](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) |
| Chrome Android: "Install app" in the menu needs no service worker (Chrome 108+). The automatic install prompt (`beforeinstallprompt`) still wants a service worker with a fetch handler. Ours has one. | [Chrome: Revisiting installability criteria](https://developer.chrome.com/blog/update-install-criteria) |
| iPhone has a system edge-swipe Back that page code can't fully block. Android PWAs use the system Back. | [W3C manifest discussion, May 2025](https://lists.w3.org/Archives/Public/public-webapps-github/2025May/0270.html) |
| Home Screen app on iPhone has its own cookies and storage, separate from Safari. | API.md §3.6 (already designed for) |
| `minishlink/web-push` (PHP) needs PHP 8.2+, ext-openssl, ext-curl, ext-mbstring; gmp or bcmath optional but faster. | [web-push-php README](https://github.com/web-push-libs/web-push-php) |
| `vite-plugin-pwa` **2.0.0 came out on 3 Oct 2026**. 1.3.0 (May 2026) is the last 1.x. Workbox 7.4.1. | npm registry, checked 8 Oct |

**Not sure — please verify on real phones**

| # | Item | What I expect | Test |
|---|---|---|---|
| V1 | Does `persist()` return **true** in our iPhone Home Screen app? | Likely yes; not promised | T19 |
| V2 | iOS 26 edge-swipe Back in the Home Screen app: goes back in our history, or does nothing? | Goes back one page | T15 |
| V3 | Badging API on Android Chrome | Not supported. Android shows a dot from the notification instead. | T25 |
| V4 | iOS 18.4+: our `push` handler runs for declarative pushes | Yes, per WebKit | T23 |
| V5 | Safari 26 and `theme-color` | May be ignored in Safari's tab bar; still used by Android | T6 |
| V6 | Screen Wake Lock inside the iPhone Home Screen app | Works on recent iOS; was broken in some older ones | T33 |
| V7 | WhatsApp link on iPhone opens inside WhatsApp (no "Add to Home Screen") | Yes; user must tap the Safari icon | T2 |
| V8 | Safari's 7-day storage clean-up skips Home Screen apps | Yes (WebKit said so in 2020) | Leave a test phone 8 days |
| V9 | iPhone camera photo (HEIC) in `<input type=file>` arrives as JPEG or decodes in canvas | Yes; our compressor makes JPEG anyway | T12 |
| V10 | Chrome Android menu wording: "Add to Home screen" or "Install app" | Varies by version; guide shows both | T3 |
| V11 | Hostinger: PHP CLI path, cron minimum interval, ext-gmp switch | `/usr/bin/php`, every minute allowed, gmp in hPanel | §7.6 |
| V12 | iOS push subscription survives an app update and 2 weeks of no use | Yes | T26 |
| V13 | What iPhone shows at launch without splash images | A plain screen for a moment | T7 |

### 0.1 Supported phones (answer 2)

| Phone | Supported when | What it means |
|---|---|---|
| iPhone made 2020 or later: iPhone SE (2nd gen, Apr 2020), iPhone 12 and every newer model | Running **iOS 17 or newer**. All of them can run iOS 26 (it supports iPhone 11 and later, and SE 2nd gen). Please keep them on the latest iOS. | Install, offline, storage protection (Safari 17+), reminders (16.4+) and the new push format (18.4+) all work. |
| Android made 2020 or later | Android 10 or newer, **Chrome** kept updated from the Play Store | Everything works. Samsung Internet and others: "Please open this in Chrome." |
| Anything older | Not supported | May work in the browser; no help promised |

The app checks at login and in Settings → This phone: iPhone below iOS 17 → "Please update this iPhone: Settings › General › Software Update." Chrome older than version 120 → "Please update Chrome from the Play Store." Source for iOS 26 models: [Median: iOS 26 compatibility list](https://median.co/blog/how-to-check-iphone-compatibility-with-ios-26).

**Pin `vite-plugin-pwa@1.3.0`.** 2.0.0 is five days old. All code below is written and build-tested against 1.3.0 with Vite 7. Move to 2.x after the wedding.

---

## 1. Platform matrix

✓ = works · ✗ = not available · (?) = verify (§0)

| Feature | Android Chrome (tab or installed) | iPhone Safari tab | iPhone Home Screen app | What we do |
|---|---|---|---|---|
| **Install prompt** | ✓ `beforeinstallprompt`; also menu ⋮ → Install app / Add to Home screen | ✗ No prompt. Share → Add to Home Screen only. | — (already installed) | Android: **our own banner** with an Install button that opens Chrome's dialog (§3.2). iPhone: one-time illustrated guide (§3.3). |
| **Web Push** | ✓ In tab and installed | ✗ | ✓ iOS 16.4+, after a tap. Declarative JSON on 18.4+. | Offer "Turn on reminders" only where it can work. Email fallback (§7). |
| **Background Sync** | ✓ (we don't use it) | ✗ | ✗ | Never relied on. The outbox sends on app open, reconnect, return to app, and **Send now** (§5.2). |
| **Storage kept** | Chrome grants `persist()` silently, usually to installed apps. Cleared only under heavy disk pressure or by the user. | Best-effort. Script storage cleared after **7 days without use**. | Own storage. Not under the 7-day rule (V8). `persist()` likely granted (V1). **Deleting the icon deletes all its data.** | Ask `persist()` after login and before wedding day. Show status in Settings → This phone. Tell users to use the icon, not Safari. |
| **Camera / file upload** | ✓ `<input type=file accept="image/*">` offers Camera or Files | ✓ Take Photo / Photo Library / Choose File | ✓ Same | One input; photo compressed on the phone to JPEG (CONTEXT 13). No `getUserMedia`. |
| **Share sheet** | ✓ `navigator.share` with files | ✓ (15+, needs a tap) | ✓ Same | PDFs and photos via share sheet, two taps (API §8.4). |
| **Badge on icon** | ✗ (?) No Badging API; a dot appears with notifications (V3) | ✗ | ✓ iOS 16.4+, needs notification permission | Badge = my overdue tasks, set when the app opens and in each push. Nothing depends on it. |
| **Standalone display** | ✓ Own window, no address bar | ✗ Browser bars | ✓ Full screen, status bar at top, home bar at bottom | Safe-area padding (DESIGN §4.5). Our own **← Back** on every non-root screen. |
| **Back gesture** | System Back / swipe → our history. At Home it closes the app. | Browser Back works | Edge-swipe Back exists but can't be fully controlled (V2). No Back button. | Every sheet and screen is one history step. Swipe actions start ≥ 24 px from edges. Unsaved forms keep a draft, so an accidental Back loses nothing. |
| **Login / cookies** | Tab and installed app share Chrome's | Own jar | **Own jar**: log in again after installing | Install Guide says so. Outbox is per jar too (§3.4). |
| **Home-icon shortcuts** | ✓ Long-press icon shows our shortcuts | ✗ | ✗ | Nice to have. Same actions are on the + button. |
| **Keep screen on** | ✓ Wake Lock | ✓ | ✓ (?) (V6) | Toggle shown only if it works (DESIGN §9.3). |

---

## 2. Manifest, icons and Apple tags

### 2.1 `public/manifest.webmanifest`

```json
{
  "id": "/",
  "name": "A&M Wedding Planner",
  "short_name": "A&M Wedding",
  "description": "Ayush & Mahi's wedding planner for the family.",
  "lang": "en-IN",
  "dir": "ltr",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#FBF7F0",
  "theme_color": "#FBF7F0",
  "categories": ["lifestyle", "productivity"],
  "prefer_related_applications": false,
  "icons": [
    { "src": "/icons/icon-192.png",          "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png",          "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "shortcuts": [
    { "name": "Add a task",   "short_name": "Add task",   "url": "/add/task",
      "icons": [{ "src": "/icons/shortcut-task-96.png",   "sizes": "96x96", "type": "image/png" }] },
    { "name": "Add a family", "short_name": "Add family", "url": "/add/family",
      "icons": [{ "src": "/icons/shortcut-family-96.png", "sizes": "96x96", "type": "image/png" }] },
    { "name": "My tasks",     "short_name": "My tasks",   "url": "/tasks?view=mine",
      "icons": [{ "src": "/icons/shortcut-mytasks-96.png", "sizes": "96x96", "type": "image/png" }] },
    { "name": "Wedding Day",  "short_name": "Wedding Day", "url": "/wedding-day",
      "icons": [{ "src": "/icons/shortcut-day-96.png",    "sizes": "96x96", "type": "image/png" }] }
  ]
}
```

| Choice | Why |
|---|---|
| `id` and `start_url` both `/` | Stable identity. Opens Home. No query string, so the cached shell always matches. |
| No `orientation` | Older users with big text sometimes turn the phone sideways. |
| One `theme_color` | The manifest can't do light/dark. The two `<meta name="theme-color">` tags below do. |
| Shortcuts | Android only. "Add a family" for a Viewer opens the normal "You don't have access" screen. "Wedding Day" shows "Opens on 13 Feb" before R2b. |

### 2.2 Icon (Apple style, no logo)

Owner's answer: Apple style. One simple mark, full colour background, no fine detail, no transparency on iPhone.

| Item | Value |
|---|---|
| Mark | "A&M" in Atkinson Hyperlegible Bold (the app font) |
| Letters | Ivory `#FBF7F0`; the "&" in marigold `#F2B84B` (the one wedding touch) |
| Background | Maroon gradient, top `#A32A3C` → bottom `#7A1626` (soft top light, like Apple's own icons) |
| iPhone | Full-bleed square. iOS rounds the corners itself. |
| Android `any` | Same art inside an Apple-style rounded square (22% radius), transparent corners |
| Android `maskable` | Full bleed; the mark sits well inside the centre 80% circle, so any launcher shape works |

Draft files are attached (`icons.zip`), made by `render-icons.mjs` (Playwright + `@fontsource`; Lucide icons for shortcuts). Re-run it to change colours.

| File | Size | Purpose |
|---|---|---|
| `icons/icon-192.png`, `icon-512.png` | 192, 512 | Normal icon (`any`) |
| `icons/icon-maskable-192.png`, `-512.png` | 192, 512 | Android adaptive icon |
| `icons/apple-touch-icon-180.png` | 180 | iPhone Home Screen |
| `icons/badge-96.png` | 96 | Android status-bar icon: white mark on transparent |
| `icons/shortcut-task-96.png`, `-family-`, `-mytasks-`, `-day-` | 96 | Shortcuts: Lucide `plus`, `users`, `list-checks`, `calendar-heart` on a maroon circle |
| `icons/favicon-48.png` | 48 | Browser tab |

### 2.3 `index.html` head

```html
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>A&amp;M Wedding</title>
<meta name="robots" content="noindex, nofollow">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icons/favicon-48.png" type="image/png">

<!-- Colours of the status bar / Android task switcher (DESIGN §2.6) -->
<meta name="theme-color" content="#FBF7F0" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#17120F" media="(prefers-color-scheme: dark)">

<!-- iPhone -->
<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png">
<meta name="apple-mobile-web-app-title" content="A&amp;M Wedding">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<!-- Stop iOS turning amounts like 1250000 into phone links; we make tel: links ourselves -->
<meta name="format-detection" content="telephone=no">

<!-- Adds class="ios" for Dynamic Type (DESIGN §2.7). A file, not inline: the CSP blocks inline scripts. -->
<script src="/ios-class.js"></script>
```

`public/ios-class.js`:

```js
if (/iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
  document.documentElement.classList.add('ios');
}
```

### 2.4 Splash screens

| Phone | What happens | What we do |
|---|---|---|
| Android | Chrome builds the splash from `name`, the 512 icon and `background_color`. | Nothing more. |
| iPhone | No automatic splash. Without startup images, a plain screen shows for a moment (V13). | Generate `apple-touch-startup-image` files for current iPhone sizes (portrait, light and dark) with `@vite-pwa/assets-generator`, into `/splash/`. Paste the `<link>` tags it prints into `index.html`. Not precached. Skip iPads. |

If this takes more than an hour, drop it. The app shell loads in well under a second from cache, so the flash is short.

### 2.5 Server headers (`public_html/.htaccess`, adds to API.md §10.3)

```apache
AddType application/manifest+json .webmanifest

<IfModule mod_headers.c>
  # Always ask the server: these decide which version runs
  <FilesMatch "^(index\.html|sw\.js|manifest\.webmanifest|version\.json|reset\.html|reset\.js)$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
  # Hashed file names never change: cache for a year
  <If "%{REQUEST_URI} =~ m#^/assets/#">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </If>
</IfModule>

# SPA: unknown paths serve index.html (except the API and real files)
RewriteEngine On
RewriteCond %{REQUEST_URI} !^/api/
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^ /index.html [L]
```

---

## 3. Install experience

### 3.1 What the app knows about the phone

```js
// src/pwa/platform.js — what kind of phone and window are we in?
const ua = navigator.userAgent;

// iPadOS 13+ says "Macintosh"; touch points give it away.
export const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isAndroid = /Android/.test(ua);

// iOS version, e.g. 17.5 -> 17.5; null if not iOS or unknown.
export const iosVersion = (() => {
  const m = ua.match(/OS (\d+)[_.](\d+)/);
  return isIOS && m ? Number(`${m[1]}.${m[2]}`) : null;
})();

// Other browsers on iPhone can't add a Home Screen web app as reliably as Safari: ask for Safari.
export const isIOSNonSafari = isIOS && /CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|FBAN|FBAV|Instagram|Line\//.test(ua);

// Android in-app browsers (WebView) add "; wv)". WhatsApp on iPhone can't be detected (same as Safari).
export const isAndroidWebView = isAndroid && /; wv\)/.test(ua);

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

// Sent as X-Device on every request (API.md §1.2)
export function deviceLabel() {
  const phone = isIOS ? 'iPhone' : isAndroid ? 'Android' : 'Computer';
  return `${phone} · ${isStandalone() ? 'installed' : 'browser'}`;
}

// Web Push is possible here and now? (iOS: 16.4+ AND opened from the Home Screen)
export function canUsePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return false;
  if (isIOS) return isStandalone() && (iosVersion === null || iosVersion >= 16.4);
  return true;
}

// localStorage that never throws (private mode, storage blocked)
export const local = {
  get(k) { try { return window.localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { window.localStorage.setItem(k, v); } catch { /* ignore */ } },
};
```

"Already installed?" works like this:

| Where | How we know | Banner "Add this app to your Home screen"? |
|---|---|---|
| Inside the installed app (both phones) | `display-mode: standalone` (iOS also `navigator.standalone`) | Never |
| Android Chrome tab | `appinstalled` fired before (saved on this phone), or Chrome stops firing `beforeinstallprompt` | Our own banner shows only while Chrome can install. After install: "Already installed? Open A&M Wedding from your Home screen." |
| iPhone Safari tab | **Can't know.** The Home Screen app's storage is separate. | Shown, max once per 7 days (DESIGN §6.1), with "Already added? Open it from your Home Screen." |

### 3.2 Android (Chrome)

1. `captureInstallPrompt()` runs in `main.jsx` before React. It stops Chrome's mini-bar and keeps the event.
2. **Our own install prompt** (answer 1): after login, in Chrome, while not installed, a banner under the top bar says "Install A&M Wedding on this phone" with **[Install]** and **[Not now]**. Not now hides it for 7 days. It replaces DESIGN §6.1's Android "[Show me]" banner. The Install Guide has the same **Install** button.
3. If Chrome isn't ready (already installed, or used up), the guide shows the manual steps with a screenshot: "Tap ⋮ (top right) → **Install app** or **Add to Home screen** → **Install**." (V10)
4. `appinstalled` → "Done. Open A&M Wedding from your Home screen." The Android app shares Chrome's login, so no second login.
5. Link opened inside WhatsApp (`; wv)` in the user agent): "Tap ⋮ → **Open in Chrome**" first.

```js
// src/pwa/useAndroidInstall.js — Chrome's own install dialog, opened only from our guide's button
import { useEffect, useState } from 'react';
import { isStandalone, local } from './platform.js';

let deferred = null;                      // the saved beforeinstallprompt event
const subs = new Set();

// Must run at start-up (main.jsx), before React mounts: Chrome fires the event early.
export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();                   // no mini-infobar; we offer it inside the Install Guide
    deferred = e;
    subs.forEach((fn) => fn());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    local.set('am.installedAt', new Date().toISOString());
    subs.forEach((fn) => fn());
  });
}

export function useAndroidInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    subs.add(fn);
    return () => subs.delete(fn);
  }, []);
  return {
    canPrompt: !!deferred,                               // Chrome is ready to install
    installed: isStandalone() || !!local.get('am.installedAt'),
    async prompt() {                                     // call from a tap only
      if (!deferred) return 'unavailable';
      const e = deferred;
      deferred = null;                                   // each event can be used once
      await e.prompt();
      const { outcome } = await e.userChoice;            // 'accepted' | 'dismissed'
      subs.forEach((fn) => fn());
      return outcome;
    },
  };
}
```

```jsx
// src/pwa/AndroidInstallBanner.jsx — our own install prompt on Android (owner's answer, 8 Oct).
// Shown in Chrome (not the installed app) once Chrome is ready. Hidden for 7 days after "Not now".
import { useState } from 'react';
import { useAndroidInstall } from './useAndroidInstall.js';
import { isAndroid, isStandalone, local } from './platform.js';

const SNOOZE_KEY = 'am.installSnoozedAt';
const SNOOZE_MS = 7 * 24 * 3600 * 1000;

export default function AndroidInstallBanner() {
  const { canPrompt, installed, prompt } = useAndroidInstall();
  const [hidden, setHidden] = useState(() => {
    const at = Date.parse(local.get(SNOOZE_KEY) || '');
    return !Number.isNaN(at) && Date.now() - at < SNOOZE_MS;
  });
  const [done, setDone] = useState(false);

  if (!isAndroid || isStandalone() || installed || hidden || !canPrompt) {
    return done ? <p role="status" className="px-safe py-3 bg-success-soft">Done. Open A&amp;M Wedding from your Home screen.</p> : null;
  }

  return (
    <div role="region" aria-label="Install the app" className="px-safe py-3 bg-primary-soft flex flex-col gap-2">
      <p className="text-base font-bold">Install A&amp;M Wedding on this phone</p>
      <p className="text-sm text-text-muted">Opens from your Home screen, works without internet.</p>
      <div className="flex gap-3">
        <button type="button" className="tap flex-1 rounded-md bg-primary text-on-primary font-bold"
                onClick={async () => { if ((await prompt()) === 'accepted') setDone(true); }}>
          Install
        </button>
        <button type="button" className="tap flex-1 rounded-md border-[1.5px] border-border-strong bg-surface"
                onClick={() => { local.set(SNOOZE_KEY, new Date().toISOString()); setHidden(true); }}>
          Not now
        </button>
      </div>
    </div>
  );
}
```

### 3.3 iPhone (Safari): one-time illustrated guide

- Opens by itself **once**, after the first login in Safari (not in the installed app). Always available at More → **Install Guide**.
- 4 steps, one screenshot each, big Next/Back buttons. Screenshots in `/public/install-guide/` (taken on iOS 26 and iOS 18, light mode, with arrows).
- Step 1 covers both Safari layouts: "Tap **Share**. If you don't see it, tap **⋯** first."
- Step 3 mentions the iOS 26 switch **Open as Web App** (keep it on).
- Step 4 says: "Log in once more — the Home Screen app keeps its own login."
- In Chrome or another app on iPhone: "Please open this in Safari."
- iOS below 17 (§0.1): "Please update this iPhone first: Settings › General › Software Update."

```jsx
// src/pwa/IosInstallGuide.jsx — one-time illustrated "Add to Home Screen" guide for iPhone.
// Opens by itself once after the first login in Safari; always available at More › Install Guide.
import { useEffect, useRef, useState } from 'react';
import { isIOS, iosVersion, isIOSNonSafari, isStandalone, local } from './platform.js';

const SEEN_KEY = 'am.iosGuideSeen';
const MIN_IOS = 17;   // supported phones: made 2020 or later, kept up to date (PWA.md §0.1)

// Screenshots live in /public/install-guide/ (cached by the SW, PWA.md §4.3).
const STEPS = [
  { img: '/install-guide/ios-1-share.png',
    text: <>Tap <b>Share</b> <span aria-hidden="true">(□↑)</span>. If you don't see it, tap <b>⋯</b> first.</>,
    alt: 'Safari toolbar with the Share button circled' },
  { img: '/install-guide/ios-2-add.png',
    text: <>Scroll down. Tap <b>Add to Home Screen</b>.</>,
    alt: 'Share menu with Add to Home Screen circled' },
  { img: '/install-guide/ios-3-confirm.png',
    text: <>Keep <b>Open as Web App</b> on, if you see it. Tap <b>Add</b>.</>,
    alt: 'Add to Home Screen screen with the name A&M Wedding and the Add button circled' },
  { img: '/install-guide/ios-4-open.png',
    text: <>Open <b>A&amp;M Wedding</b> from your Home Screen. <b>Log in once more</b> — the Home Screen app keeps its own login.</>,
    alt: 'Home Screen with the A&M Wedding icon circled' },
];

// Should the guide open by itself? Only in Safari on iPhone, not installed, once.
export function shouldAutoOpenIosGuide() {
  return isIOS && !isStandalone() && !local.get(SEEN_KEY);
}

export default function IosInstallGuide({ onClose }) {
  const [step, setStep] = useState(0);
  const headingRef = useRef(null);

  useEffect(() => { local.set(SEEN_KEY, new Date().toISOString()); }, []);
  useEffect(() => { headingRef.current?.focus(); }, [step]);   // move focus for screen readers

  if (isStandalone()) {
    return (
      <Shell onClose={onClose} headingRef={headingRef} title="Already on your Home Screen">
        <p>You are using the Home Screen app. Nothing more to do.</p>
      </Shell>
    );
  }

  if (isIOSNonSafari) {
    return (
      <Shell onClose={onClose} headingRef={headingRef} title="Please open this in Safari">
        <p>Adding to the Home Screen works best from <b>Safari</b>.</p>
        <p>Copy the link, open <b>Safari</b>, paste it and log in. Then open this guide again.</p>
      </Shell>
    );
  }

  const s = STEPS[step];
  const last = step === STEPS.length - 1;
  return (
    <Shell onClose={onClose} headingRef={headingRef}
           title={`Add to Home Screen · Step ${step + 1} of ${STEPS.length}`}>
      {step === 0 && (
        <p className="rounded-md bg-info-soft p-3 text-sm">
          Opened from WhatsApp? Tap the <b>Safari</b> icon at the bottom first.
        </p>
      )}
      <img src={s.img} alt={s.alt} width="390" height="520"
           className="mx-auto max-h-[50dvh] w-auto rounded-md border border-border" />
      <p className="text-lg">{s.text}</p>
      {iosVersion !== null && iosVersion < MIN_IOS && (
        <p className="rounded-md bg-warning-soft p-3 text-sm">
          Please update this iPhone first: <b>Settings › General › Software Update</b>.
        </p>
      )}
      <div className="flex gap-3">
        {step > 0 && (
          <button type="button" className="tap flex-1 rounded-md border-[1.5px] border-border-strong bg-surface"
                  onClick={() => setStep(step - 1)}>Back</button>
        )}
        <button type="button" className="tap flex-1 rounded-md bg-primary text-on-primary font-bold"
                onClick={() => (last ? onClose() : setStep(step + 1))}>
          {last ? 'Done' : 'Next'}
        </button>
      </div>
    </Shell>
  );
}

function Shell({ title, onClose, headingRef, children }) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="ios-guide-title"
         className="fixed inset-0 z-50 flex flex-col bg-bg pt-safe pb-safe px-safe overflow-y-auto">
      <div className="flex items-center justify-between py-2">
        <h2 id="ios-guide-title" ref={headingRef} tabIndex={-1} className="text-xl font-bold">{title}</h2>
        <button type="button" className="tap" onClick={onClose} aria-label="Close">✕ Close</button>
      </div>
      <div className="flex flex-col gap-4 pb-6">{children}</div>
    </div>
  );
}
```

### 3.4 iPhone: two separate apps on one phone

| | Safari tab | Home Screen app |
|---|---|---|
| Login cookie | Its own | Its own: **log in once more** |
| Read cache (IndexedDB) | Its own | Its own, downloaded again on first open |
| **Outbox** (changes waiting) | Its own | Its own. **Changes waiting in Safari never move to the app.** |
| Cleared when | 7 days without use, or Clear History | The icon is deleted (everything goes) |
| Push | ✗ | ✓ |

Rules that follow:

- Before showing step 1, the guide checks this tab's outbox. If anything waits: "2 changes are still on this phone. Connect to the internet so they are sent first." (Send now button.)
- After installing, the guide's last line: "From now on, open the app from the icon only."
- Deleting the icon deletes waiting changes. The logout warning (§5.5) and the Settings → This phone screen both say: "Don't delete the app icon while changes are waiting."

Android is simpler: the installed app and Chrome share one login, one cache and one outbox.

---

## 4. Service worker (Workbox via vite-plugin-pwa)

### 4.1 Strategy per resource

| Resource | Strategy | Why |
|---|---|---|
| App shell: `index.html`, hashed JS and CSS in `/assets/` | **Precache** (installed with each version) | Opens instantly and offline. Exactly one version at a time. |
| Fonts (Atkinson, Noto Devanagari via `@fontsource`, emitted into `/assets/`) | **Precache** | Self-hosted, needed offline (DESIGN §2.3) |
| Icons | **Precache** | Small |
| Page loads (any app URL) | Cached `index.html` (**app-shell navigation route**) | Deep links like `/tasks/01JA…` open offline. The new version arrives only through the update prompt (§6). |
| `/api/*` (all JSON, files, exports) | **Network only.** Writes are not routed at all. | **The service worker never answers an API call from cache.** A failed save is always a real failure the app sees. Offline data comes from IndexedDB in app code, always labelled "Updated …". |
| `/version.json` | **Network only** | It's how we notice a new build |
| Install Guide screenshots | **Stale-while-revalidate** (cache `install-guide`, 30 files, 60 days) | Show quickly; not worth precaching on every update |
| `/reset.html`, `/reset.js` | **Not touched by the service worker** (not precached, excluded from the navigation route) | The escape hatch must work even when the service worker is broken (§6.4) |
| `/templates/*.xlsx`, `/splash/*` | Not cached | Rarely used / only read at launch by iOS |

No network-first route is needed: HTML comes from the precache (updated through the prompt), and API data never goes through the service worker's cache.

### 4.2 `vite.config.js`

```js
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
const APP_VERSION = pkg.version;                 // e.g. "1.0.7" — bump on every deploy
const BUILT_AT = new Date().toISOString();

// Writes dist/version.json, which the app polls to learn a new build exists.
function versionFile() {
  return {
    name: 'am-version-file',
    apply: 'build',
    writeBundle(opts) {
      mkdirSync(opts.dir, { recursive: true });
      writeFileSync(`${opts.dir}/version.json`,
        JSON.stringify({ version: APP_VERSION, built_at: BUILT_AT }) + '\n');
    },
  };
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __BUILT_AT__: JSON.stringify(BUILT_AT),
  },
  plugins: [
    react(),
    versionFile(),
    VitePWA({
      strategies: 'injectManifest',     // our own sw.js: we need push + full control
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'prompt',           // never auto-update; the user taps "Refresh"
      injectRegister: false,            // we import virtual:pwa-register/react ourselves (CSP: no inline script)
      manifest: false,                  // public/manifest.webmanifest is hand-written (PWA.md §2)
      injectManifest: {
        // App shell + self-hosted fonts (Vite emits @fontsource files into assets/) + icons
        globPatterns: ['**/*.{js,css,html,woff2}', 'icons/*.png'],
        // Never precache: the escape hatch, screenshots, splash images, templates, version file
        globIgnores: ['reset.html', 'reset.js', 'install-guide/**', 'splash/**',
                      'templates/**', 'version.json'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      devOptions: { enabled: false },   // test the SW on staging, not in vite dev
    }),
  ],
  build: { sourcemap: true },
});
```

### 4.3 `src/sw.js`

```js
// src/sw.js — built by vite-plugin-pwa (injectManifest)
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// 1. App shell: hashed JS/CSS, index.html, fonts, icons. Injected at build time.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// 2. Page loads (navigations) get the cached shell, so the app opens offline.
//    Exceptions go to the network: the API, the reset page, file downloads.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), {
  denylist: [/^\/api\//, /^\/reset(\.html)?$/, /^\/templates\//],
}));

// 3. API: ALWAYS network, never cached by the service worker.
//    Offline reads come from IndexedDB in app code, with "last updated" shown.
//    Writes (POST/PUT/PATCH/DELETE) are not routed at all, so the browser sends
//    them straight to the network and a failure is a real failure.
registerRoute(({ url }) => url.pathname.startsWith('/api/'), new NetworkOnly());

// 4. version.json: always network (it is how we notice a new build).
registerRoute(({ url }) => url.pathname === '/version.json', new NetworkOnly());

// 5. Install Guide screenshots: show the cached copy, refresh in the background.
registerRoute(
  ({ url }) => url.pathname.startsWith('/install-guide/'),
  new StaleWhileRevalidate({
    cacheName: 'install-guide',
    plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 24 * 3600 })],
  }),
);

// 6. Updates: only when the page asks (user tapped "Refresh"). Never on our own.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// 7. Web Push (R2a). The payload is Declarative Web Push JSON (PWA.md §7.4),
//    so iOS 18.4+ can show it even if this code fails; others run this code.
self.addEventListener('push', (event) => {
  let msg = {};
  try { msg = event.data ? event.data.json() : {}; } catch { msg = {}; }
  const n = msg.notification || {};
  const title = n.title || 'A&M Wedding';
  const options = {
    body: n.body || '',
    tag: n.tag || undefined,            // same tag replaces an older reminder
    lang: n.lang || 'en-IN',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',       // Android status-bar icon (white on transparent)
    data: { url: n.navigate || '/' },
  };
  const tasks = [self.registration.showNotification(title, options)];
  if (n.app_badge !== undefined && 'setAppBadge' in self.navigator) {
    const count = Number(n.app_badge);
    tasks.push((count > 0 ? self.navigator.setAppBadge(count) : self.navigator.clearAppBadge()).catch(() => {}));
  }
  // iOS and Chrome require a visible notification for every push. Always show one.
  event.waitUntil(Promise.all(tasks));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin);
  if (target.origin !== self.location.origin) return;     // only open our own pages
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if ('focus' in w) {
        await w.focus();
        w.postMessage({ type: 'NAVIGATE', url: target.pathname + target.search });
        return;
      }
    }
    await self.clients.openWindow(target.href);
  })());
});

// 8. The push service rotated our subscription (rare; mostly Chrome). Tell any
//    open page to re-subscribe; if none is open, the app re-checks on next open.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(self.clients.matchAll({ type: 'window' })
    .then((wins) => wins.forEach((w) => w.postMessage({ type: 'PUSH_RESUBSCRIBE' }))));
});
```

### 4.4 Rules

- **CSP** (API §10.3) stays `script-src 'self'`. So `injectRegister: false`, registration is done in our own module, and no inline scripts exist (P7).
- **Deploy order** on Hostinger (FTP or File Manager): upload `/assets/` first, then `sw.js`, then `index.html`, then `version.json` **last**. A phone that checks halfway sees the old version, never half of the new one.
- **Keep old `/assets/` files for 14 days** after a deploy. A phone still on the old version may lazy-load an old screen. Delete them after that.
- `sw.js` is always at `/sw.js` (scope `/`). Never rename it.

---

## 5. Offline design

### 5.1 Reading: IndexedDB cache

One database `am-wedding` with four stores: `records` (server rows by type and id), `snapshots` (whole replies: dashboard, wedding-day pack), `outbox`, `meta`.

```js
// src/offline/db.js — one IndexedDB database for the read cache and the outbox
import { openDB } from 'idb';

const DB_NAME = 'am-wedding';
const DB_VERSION = 1;
let dbPromise = null;

function open() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        // Outbox: one row per user action waiting to reach the server.
        const ob = d.createObjectStore('outbox', { keyPath: 'key' });
        ob.createIndex('seq', 'seq', { unique: true });
        // Read cache: server rows, keyed by [type, id]. type = 'task', 'household', 'invitation'…
        const rec = d.createObjectStore('records', { keyPath: ['type', 'id'] });
        rec.createIndex('type', 'type');
        // Whole replies kept as they came: 'dashboard', 'wedding_day'
        d.createObjectStore('snapshots');
        // Small values: 'user_id', 'next_since', 'last_synced_at', 'seq'
        d.createObjectStore('meta');
      },
      // iOS can drop the connection when the app comes back from the background.
      terminated() { dbPromise = null; },
    });
  }
  return dbPromise;
}

// Runs fn(db). If iOS closed the connection under us, reopen once and retry.
export async function withDb(fn) {
  try {
    return await fn(await open());
  } catch (e) {
    const lost = e && (e.name === 'InvalidStateError' || /connection|closing|lost/i.test(String(e.message)));
    if (!lost) throw e;
    dbPromise = null;
    return fn(await open());
  }
}

// Logout / different user: wipe guest data from this phone. The caller must
// check the outbox first (PWA.md §5.5) — this deletes it too.
export async function wipeAll() {
  await withDb(async (d) => {
    const stores = ['outbox', 'records', 'snapshots', 'meta'];
    const tx = d.transaction(stores, 'readwrite');
    await Promise.all(stores.map((n) => tx.objectStore(n).clear()));
    await tx.done;
  });
}
```

| Data | Source | Stored as | Refreshed |
|---|---|---|---|
| Dashboard (Home cards) | `GET /dashboard` | snapshot `dashboard` | Each time Home loads online |
| Tasks, checklist items, tags | `GET /sync` | `records` | App open, back online, return to the app, every 5 min while open, pull to refresh |
| Families and invitations (Coming?) | `GET /sync` | `records` | Same |
| Events (dates, venue, map link as text) | `GET /sync` | `records` | Same |
| Vendor contacts (name, phone, category) | `GET /sync` | `records` | Same. Amounts only for money users (the server filters). |
| Members (names, phones) | `GET /sync` | `records` | Same |
| Settings (names, dates) | `GET /sync` | `records` | Same |
| Wedding-day timeline, rooms (R2b) | `GET /sync?types=…,timeline` | snapshot `wedding_day` | §8 |
| Payments, budget (money users) | `GET /sync` | `records` | Same; shown offline read-only |
| Documents | details only from `/sync`; never file bytes | `records` | PDFs and photos need internet (API §8.4) |

Rules:

| Rule | Detail |
|---|---|
| Online first | Online, screens use the API as now and write each reply into the cache. Offline, the same screens read the cache. |
| Shown age | Every list and detail shows "Updated 10:42 AM" when online and fresh. Offline: "No internet · from Tue 13 Oct, 9:40 PM". Never a cached value without its age. |
| Offline lists | Search by name and the main chips work. Advanced filters and sorting show "Needs internet". |
| Your pending changes | A row with a waiting change shows your value with 🕒 (from `pendingFields()`), not the old server value. |
| Size | ~500 families, 3,500 invitations, 300 tasks ≈ 2–3 MB. Fine on both phones. |
| One user per cache | `meta.user_id`. A different person logs in on the same phone → the cache is wiped first (after the outbox check, §5.5). |
| Privacy | Guest phone numbers sit on every member's phone, all roles (answered 8 Oct). Logout wipes them. The phone's own screen lock is the protection. |
| Never opened | Screens with no cached data: "Open this once with internet to see it offline." (DESIGN §5) |

### 5.2 Writing: the outbox

**What may wait offline** (decision 7, v1.4):

| Action | Offline? | Why |
|---|---|---|
| Tick a task done | ✓ waits | Small, one record, easy to merge |
| Add or edit a task (title, due date, status, priority, notes, assignees) | ✓ waits | Most common family action |
| Add, tick or rename a checklist item | ✓ waits | Small |
| Add or edit a family | ✓ waits | Duplicate check runs when it's sent; the duplicate dialog shows then (accepted 8 Oct) |
| Set Coming? for an invited family | ✓ waits | Small; RSVP chips are the main venue action |
| Coming? on a family that was **added offline** | ✗ | The invitation doesn't exist on the server yet. Chips say "Send the new family first." |
| Any delete, Undo, restore | ✗ needs internet | Undo has a 10-minute window and needs the server's reply |
| Bulk actions, import | ✗ | Many rows, `as_of` rules |
| Money: payments, mark paid, budget | ✗ | Amounts and status are never auto-merged (FEATURES B6) |
| Events, settings, members | ✗ | Admin-only, rare |
| Uploads (photos, PDFs) | ✗ | Files too big to keep safely in a queue |

Online-only buttons stay visible but disabled, with "Needs internet" under them.

**How an entry flows**

```
Tap Save ──► outbox (IndexedDB, written first) ──► send now ──► 2xx ──► removed, "Saved ✓ 10:42"
                       │                              │
                       │                              ├─ no internet / 5xx / 429 ─► stays: 🕒 "Waiting to send"
                       │                              ├─ 401 ─► stays; login sheet; sent after login
                       │                              ├─ 409 conflict ─► "Needs your choice" ─► conflict screen
                       │                              ├─ 409 duplicate ─► duplicate dialog (Add anyway / Discard)
                       │                              ├─ 422 ─► form opens with the errors
                       │                              └─ 403 / 404 ─► "Couldn't send" with the reason + Discard
                       └─ the app is closed or killed ─► still there next time; resent with the same key
```

**Each entry**

| Field | Meaning |
|---|---|
| `key` | The `Idempotency-Key`. For creates, also the record's `client_uuid` (made when the form opened). Same key on every retry. |
| `seq` | Order. Sent strictly oldest first. |
| `userId` | Only sent while that person is logged in |
| `method`, `path`, `body` | Only the changed fields (API §4.1) |
| `ifMatch` | The version the user loaded. `'chain'` = wait for the earlier change to the same record, then use its new version. |
| `base` | The record as loaded, for the 3-way merge on conflict |
| `entity` | Which record it changes, e.g. `/tasks/01JA…` or `/tasks/{new:<key>}` for one added offline |
| `status` | `pending`, `conflict`, `duplicate`, `needs_fix`, `rejected` |
| `attempted` | True once a request may have reached the server. After that the body never changes under this key. |
| `label` | Plain words for the list: "Tick 'Book tent wala'" |

**Rules that keep it safe**

1. The entry is written to IndexedDB **before** anything is sent. Closing the app at any moment loses nothing.
2. An entry is removed **only** on a 2xx reply, or when the user taps **Discard** (with a confirm, because Undo can't bring it back).
3. Two offline edits to the same record, not yet tried, are **merged** into one request. Already tried → the second waits (`chain`) and takes the new version when the first lands.
4. A task added offline gets a stand-in id `{new:<key>}`. Its later edits wait, and their paths are fixed up when the create lands.
5. A conflict blocks only that record. Other changes keep going.
6. No Background Sync. Sends happen on: app open, `online`, app brought to the front, **Send now**, right after each save, and every 60 s while the app is open with changes waiting. Back-off 15 s → 5 min after failures.
7. One sender at a time (Web Locks, with a flag as fallback).
8. A new app version must read old entries. Entries carry `v: 1`. Changing the shape means a migration in code, never dropping entries.

Tested in Node with `fake-indexeddb` against a fake server: offline merge, create-then-tick, lost reply then retry (no double save), conflict then resolve, chained edits, discard. All 12 checks pass.

```js
// src/offline/outbox.js — every queueable save goes through here, online or not.
//
// Rules (PWA.md §5.2):
// - An entry leaves the outbox ONLY on a 2xx reply or when the user taps Discard.
// - Each entry keeps one Idempotency-Key for all its retries.
// - Entries are sent one at a time, oldest first. No Background Sync.
// - A conflict blocks later entries for the same record, never the whole queue.
import { withDb } from './db.js';

const API = '/api/v1';
const TIMEOUT_MS = 15000;

// Only these small, single-record actions may wait offline (decision 7, v1.4).
// Everything else (deletes, bulk, import, money, events, uploads) needs internet.
const QUEUEABLE = [
  { method: 'POST',  re: /^\/tasks$/,                                     type: 'task',       kind: 'create' },
  { method: 'PATCH', re: /^\/tasks\/([^/]+)$/,                            type: 'task',       kind: 'update', entity: (m) => `/tasks/${m[1]}` },
  { method: 'POST',  re: /^\/tasks\/([^/]+)\/done$/,                      type: 'task',       kind: 'action', entity: (m) => `/tasks/${m[1]}` },
  { method: 'POST',  re: /^\/tasks\/([^/]+)\/items$/,                     type: 'task_item',  kind: 'create' },
  { method: 'PATCH', re: /^\/tasks\/([^/]+)\/items\/([^/]+)$/,            type: 'task_item',  kind: 'update', entity: (m) => `/tasks/${m[1]}/items/${m[2]}` },
  { method: 'POST',  re: /^\/households$/,                                type: 'household',  kind: 'create' },
  { method: 'PATCH', re: /^\/households\/([^/]+)$/,                       type: 'household',  kind: 'update', entity: (m) => `/households/${m[1]}` },
  { method: 'PATCH', re: /^\/households\/([^/]+)\/invitations\/([^/]+)$/, type: 'invitation', kind: 'update', entity: (m) => `/households/${m[1]}/invitations/${m[2]}` },
];

export function isQueueable(method, path) {
  return QUEUEABLE.some((r) => r.method === method && r.re.test(path));
}

// ---- wiring: the app passes these in once, at start-up ------------------------
let cfg = {
  getSession: () => null,            // -> { userId, csrfToken } or null
  refreshSession: async () => null,  // GET /session; -> same shape, or null if logged out
  deviceLabel: () => 'other',        // "iPhone · installed" (API.md §1.2)
  onRecord: async () => {},          // (type, record) -> write server copy into the read cache
  onEvent: () => {},                 // ({ type: 'login_required' | 'update_required' | 'changed' })
};
export function configureOutbox(options) { cfg = { ...cfg, ...options }; }

// ---- change listeners (banner, Saved indicator) --------------------------------
const listeners = new Set();
const waiters = new Map();           // key -> [resolve]
let flushing = false;
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
async function notify() {
  const s = await status();
  listeners.forEach((fn) => fn(s));
  cfg.onEvent({ type: 'changed', status: s });
}
function settle(key, result) {
  (waiters.get(key) || []).forEach((r) => r(result));
  waiters.delete(key);
}

// ---- reading -----------------------------------------------------------------
export async function list(userId = cfg.getSession()?.userId) {
  const all = await withDb((d) => d.getAllFromIndex('outbox', 'seq'));
  return all.filter((e) => e.userId === userId);
}

// For the banners: { waiting, needsYou, flushing, foreign }
export async function status() {
  const all = await withDb((d) => d.getAll('outbox'));
  const me = cfg.getSession()?.userId;
  const mine = all.filter((e) => e.userId === me);
  return {
    waiting: mine.filter((e) => e.status === 'pending').length,
    needsYou: mine.filter((e) => e.status !== 'pending').length,
    foreign: all.length - mine.length,   // left by another login on this phone
    flushing,
  };
}

// Pending edits for one record, merged — so lists show "your" value with a 🕒.
export async function pendingFields(entityPath) {
  const mine = await list();
  return mine.filter((e) => e.entity === entityPath && e.method === 'PATCH')
             .reduce((acc, e) => ({ ...acc, ...e.body }), {});
}

// ---- writing -----------------------------------------------------------------
/**
 * Queue one user action and try to send it at once.
 * @param {object} a
 * @param {'POST'|'PATCH'} a.method
 * @param {string} a.path      e.g. '/tasks/01JA…' or '/tasks/{new:<uuid>}/done'
 * @param {object} a.body      only the changed fields (API.md §4.1)
 * @param {number} [a.version] version the user loaded (If-Match); omit for creates
 * @param {object} [a.base]    the record as loaded (for the 3-way merge on 409)
 * @param {string} [a.key]     for creates: the form's client_uuid (made when the form opened)
 * @param {string} a.label     plain words for the waiting list: "Tick 'Book tent wala'"
 * @param {number} [a.waitMs]  how long the caller waits for the server before showing 🕒
 * @returns {Promise<{state:'saved'|'waiting'|'needs_you', key:string, data?:object, error?:object}>}
 */
export async function enqueue({ method, path, body = {}, version, base = null, key, label, waitMs = 8000 }) {
  const rule = QUEUEABLE.find((r) => r.method === method && r.re.test(path));
  if (!rule) throw new Error(`Not queueable: ${method} ${path}`);
  const session = cfg.getSession();
  if (!session) throw new Error('Not logged in');

  if (rule.type === 'invitation' && path.includes('{new:')) {
    throw new Error('Set Coming? after the new family has been sent');  // UI hides the chips until then
  }
  const m = path.match(rule.re);
  const newKey = key || crypto.randomUUID();
  // A new record has no server id yet: '/tasks/{new:<key>}' stands in for it.
  // Checklist items are addressed by their key, so they never need a placeholder.
  const entity = rule.kind !== 'create' ? rule.entity(m)
    : rule.type === 'task_item' ? `${path}/${newKey}` : `${path}/{new:${newKey}}`;

  const resultKey = await withDb(async (d) => {
    const tx = d.transaction(['outbox', 'meta'], 'readwrite');
    const ob = tx.objectStore('outbox');
    const all = (await ob.index('seq').getAll()).filter((e) => e.userId === session.userId);
    const last = [...all].reverse().find((e) => e.entity === entity);

    // Coalesce into an entry the server has never seen (same record, not yet tried).
    const canMerge = last && !last.attempted && last.status === 'pending' && method === 'PATCH'
      && ((last.method === 'PATCH' && last.path === path)
          || (last.kind === 'create' && last.type !== 'task_item'));  // item create takes only key/text
    if (canMerge) {
      last.body = { ...last.body, ...body };
      last.label = label || last.label;
      last.updatedAt = new Date().toISOString();
      await ob.put(last);
      await tx.done;
      return last.key;
    }

    const seq = ((await tx.objectStore('meta').get('seq')) || 0) + 1;
    await tx.objectStore('meta').put(seq, 'seq');
    await ob.add({
      v: 1,                                   // entry format; bump + migrate if it changes
      key: newKey,                            // Idempotency-Key (= client_uuid for creates)
      seq,
      userId: session.userId,
      method, path, body, base,
      kind: rule.kind, type: rule.type, entity,
      // If an earlier entry for this record is still queued, take its new version when it lands.
      ifMatch: rule.kind === 'create' ? null : (last ? 'chain' : version),
      label: label || `${method} ${path}`,
      status: 'pending',                      // pending | conflict | duplicate | needs_fix | rejected
      attempted: false,                       // true once a request may have reached the server
      attempts: 0,
      error: null,
      createdAt: new Date().toISOString(),
    });
    await tx.done;
    return newKey;
  });

  await notify();
  const done = new Promise((resolve) => {
    waiters.set(resultKey, [...(waiters.get(resultKey) || []), resolve]);
  });
  flush();                                    // don't await: the timer below decides what the user sees
  const timer = new Promise((r) => setTimeout(() => r({ state: 'waiting', key: resultKey }), waitMs));
  return Promise.race([done, timer]);
}

// ---- sending -----------------------------------------------------------------
let retryTimer = null;
let backoff = 0;

// Safe to call any time: app open, 'online', visible again, "Send now", after enqueue.
export async function flush() {
  if (flushing) return;
  if (!navigator.onLine) return;            // a hint only; a failed fetch is the real test
  const run = async () => {
    flushing = true;
    await notify();
    try { await sendAll(); } finally { flushing = false; await notify(); }
  };
  // One flusher per origin. Web Locks: Chrome, Safari 15.4+. Falls back to the flag.
  if (navigator.locks && navigator.locks.request) {
    await navigator.locks.request('am-outbox', { ifAvailable: true }, (lock) => (lock ? run() : null));
  } else {
    await run();
  }
}

async function sendAll() {
  let session = cfg.getSession();
  if (!session || !session.csrfToken) session = await cfg.refreshSession();
  if (!session) { cfg.onEvent({ type: 'login_required' }); return; }

  const blocked = new Set();                // records with an entry that needs the user
  const entries = await list(session.userId);
  for (const queued of entries) {
    // Re-read: an earlier entry may have just landed and fixed up this one's path or version.
    const e = await withDb((d) => d.get('outbox', queued.key));
    if (!e) continue;
    if (e.status !== 'pending') { blocked.add(e.entity); continue; }
    if (blocked.has(e.entity)) continue;
    if (/\{new:/.test(e.path) || e.ifMatch === 'chain') { blocked.add(e.entity); continue; } // waits for an earlier entry
    const outcome = await sendOne(e, session);
    if (outcome === 'stop') { scheduleRetry(); return; }
    if (outcome === 'csrf') {
      session = await cfg.refreshSession();
      if (!session) { cfg.onEvent({ type: 'login_required' }); return; }
      const again = await sendOne(e, session);
      if (again !== 'ok' && again !== 'blocked') { scheduleRetry(); return; }
    }
    if (outcome === 'blocked') blocked.add(e.entity);
  }
  backoff = 0;
}

async function sendOne(e, session) {
  // Mark "may have reached the server" BEFORE sending. From now on the body
  // never changes under this key (else the server says idempotency_key_reused).
  e.attempted = true;
  e.attempts += 1;
  e.lastTryAt = new Date().toISOString();
  await withDb((d) => d.put('outbox', e));

  const headers = {
    'Content-Type': 'application/json',
    'Idempotency-Key': e.key,
    'X-CSRF-Token': session.csrfToken,
    'X-Client-Version': typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev',
    'X-Device': cfg.deviceLabel(),
  };
  if (e.ifMatch !== null) headers['If-Match'] = `"${e.ifMatch}"`;

  // Creates: the server takes client_uuid from Idempotency-Key. Checklist items also need it as `key`.
  const body = e.type === 'task_item' && e.kind === 'create' ? { ...e.body, key: e.key } : e.body;

  let res, json = null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    res = await fetch(API + e.path, {
      method: e.method, headers, body: JSON.stringify(body),
      credentials: 'same-origin', cache: 'no-store', signal: ctrl.signal,
    });
    json = await res.json().catch(() => null);
  } catch {
    clearTimeout(t);
    await saveError(e, { code: 'network', message: 'No internet.' }, 'pending');
    return 'stop';                             // offline or timeout: try again later, same key
  }
  clearTimeout(t);

  if (res.ok && json && json.ok) { await landed(e, json.data); return 'ok'; }

  const err = (json && json.error) || { code: `http_${res.status}`, message: 'Something went wrong on our side.' };
  switch (res.status) {
    case 401: cfg.onEvent({ type: 'login_required' }); await saveError(e, err, 'pending'); return 'stop';
    case 403:
      if (err.code === 'csrf_failed') return 'csrf';
      await saveError(e, err, 'rejected'); return 'blocked';   // e.g. no permission any more
    case 404: await saveError(e, err, 'rejected'); return 'blocked';
    case 409:
      if (err.code === 'request_in_progress') { await saveError(e, err, 'pending'); return 'stop'; }
      if (err.code === 'duplicate_found') { await saveError(e, err, 'duplicate'); return 'blocked'; }
      await saveError(e, err, 'conflict'); return 'blocked';   // version_conflict | record_deleted
    case 422: await saveError(e, err, 'needs_fix'); return 'blocked';
    case 426: cfg.onEvent({ type: 'update_required' }); await saveError(e, err, 'pending'); return 'stop';
    case 428: await saveError(e, err, 'rejected'); return 'blocked';   // our bug; keep it, show it
    default:  await saveError(e, err, 'pending'); return 'stop';      // 429, 5xx, 503 app_updating
  }
}

async function saveError(e, error, status) {
  e.error = { code: error.code, message: error.message, detail: error };
  e.status = status;
  if (status !== 'pending') e.attempted = false; // 4xx released the key (API.md §5.1)
  await withDb((d) => d.put('outbox', e));
  if (status !== 'pending') settle(e.key, { state: 'needs_you', key: e.key, error: e.error });
}

// 2xx: one transaction removes the entry and fixes up later entries for the same record.
async function landed(e, data) {
  const newVersion = data && typeof data.version === 'number' ? data.version : null;
  const placeholder = `{new:${e.key}}`;
  const newId = e.kind === 'create' && data && data.id ? data.id : null;
  const landedEntity = newId ? e.entity.replace(placeholder, newId) : e.entity;
  await withDb(async (d) => {
    const tx = d.transaction('outbox', 'readwrite');
    await tx.store.delete(e.key);
    const rest = await tx.store.index('seq').getAll();       // oldest first
    let chainDone = false;
    for (const r of rest) {
      let changed = false;
      if (newId && (r.path.includes(placeholder) || r.entity.includes(placeholder))) {
        r.path = r.path.replace(placeholder, newId);          // '/tasks/{new:k}/done' -> '/tasks/01JA…/done'
        r.entity = r.entity.replace(placeholder, newId);
        changed = true;
      }
      // Only the NEXT queued change to this record takes the new version.
      if (!chainDone && r.entity === landedEntity && r.ifMatch === 'chain' && newVersion !== null) {
        r.ifMatch = newVersion;
        chainDone = true;
        changed = true;
      }
      if (changed) await tx.store.put(r);
    }
    await tx.done;
  });
  if (data) await cfg.onRecord(e.type, data);
  settle(e.key, { state: 'saved', key: e.key, data });
}

function scheduleRetry() {
  clearTimeout(retryTimer);
  backoff = Math.min(backoff ? backoff * 2 : 15000, 5 * 60000);   // 15 s … 5 min
  retryTimer = setTimeout(() => { if (document.visibilityState === 'visible') flush(); }, backoff);
}

// ---- the user's decisions ----------------------------------------------------
// Conflict screen "Save my choices": a NEW decision, so a new key (API.md §4.2).
export async function resolveConflict(key, chosenBody, currentVersion, current) {
  await withDb(async (d) => {
    const tx = d.transaction('outbox', 'readwrite');
    const e = await tx.store.get(key);
    if (!e) return;
    await tx.store.delete(key);
    await tx.store.add({ ...e, key: crypto.randomUUID(), body: chosenBody, ifMatch: currentVersion,
      base: current, status: 'pending', attempted: false, attempts: 0, error: null });
    await tx.done;
  });
  await notify();
  flush();
}

// Duplicate dialog "Add anyway", or a fixed 422 form: same key (the server released it).
export async function retryWith(key, bodyPatch) {
  await withDb(async (d) => {
    const e = await d.get('outbox', key);
    if (!e) return;
    await d.put('outbox', { ...e, body: { ...e.body, ...bodyPatch }, status: 'pending', error: null });
  });
  await notify();
  flush();
}

// "Keep theirs" or "Discard this change". The UI confirms first: Undo can't bring it back.
// Discarding a new record also discards later changes to it (the UI names them first).
export async function discard(key) {
  const removed = [key];
  await withDb(async (d) => {
    const tx = d.transaction('outbox', 'readwrite');
    const e = await tx.store.get(key);
    if (!e) return;
    await tx.store.delete(key);
    const placeholder = `{new:${e.key}}`;
    // The server still has the version this entry was based on (or the one the 409 told us).
    const serverVersion = (e.error && e.error.detail && e.error.detail.current_version) ?? e.ifMatch;
    let chainDone = false;
    for (const r of await tx.store.index('seq').getAll()) {
      if (e.kind === 'create' && r.path.includes(placeholder)) {
        await tx.store.delete(r.key); removed.push(r.key);
      } else if (!chainDone && r.entity === e.entity && r.ifMatch === 'chain' && typeof serverVersion === 'number') {
        await tx.store.put({ ...r, ifMatch: serverVersion }); chainDone = true;
      }
    }
    await tx.done;
  });
  removed.forEach((k) => settle(k, { state: 'needs_you', key: k, error: { code: 'discarded' } }));
  await notify();
  flush();
}

// ---- triggers (no Background Sync: iOS has none) -----------------------------
export function startOutboxTriggers() {
  flush();                                                    // app open
  window.addEventListener('online', () => flush());           // back online
  document.addEventListener('visibilitychange', () => {       // app brought to front
    if (document.visibilityState === 'visible') flush();
  });
  setInterval(() => {                                         // gentle heartbeat while open
    if (document.visibilityState === 'visible') status().then((s) => { if (s.waiting) flush(); });
  }, 60000);
}
```

**Using it from a screen**

```js
// Task tick on a row
const res = await enqueue({
  method: 'POST', path: `/tasks/${task.id}/done`, body: {},
  version: task.version, base: task, label: `Tick '${task.title}'`,
});
// res.state: 'saved' -> "Saved ✓" | 'waiting' -> 🕒 "Waiting to send" | 'needs_you' -> open the right screen
```

Online-only actions (delete, money, uploads…) keep calling the API directly, exactly as API.md §2.4 says.

### 5.3 Conflicts (409)

| Reply | Where it shows | What happens |
|---|---|---|
| `version_conflict` on a form edit | Banner "1 change needs your choice" → **Conflict screen S42** (DESIGN §6.7, §7) | Base = `entry.base`, mine = `entry.body`, theirs = `error.current`. Fields only I changed keep mine; only they changed keep theirs; both → the user picks. **Save my choices** → `resolveConflict()` with a **new** key and `If-Match: current_version`. **Keep Papa's** → `discard()`. |
| `version_conflict` on a chip or tick | Small dialog (DESIGN §7): "Mummy already set **Coming**. Change to **Not coming**?" | Yes → `resolveConflict()`. No → `discard()`. |
| `record_deleted` | Same screen, "Papa deleted this at 10:42." | Admin: **Restore and save mine** (online). Family: "Ask Ayush or Mahi to restore it. Your change is kept here." Entry stays until resolved or discarded. |
| Changes queued behind it | Wait (`chain`) | Sent after the user decides. Discard passes the server's version on to them. |

Amounts and status are never auto-merged (money is online-only anyway).

### 5.4 Banners and indicators

| State | Where | Look and words |
|---|---|---|
| Offline | Under the top bar, every screen | `info-soft`, `wifi-off` icon: "No internet. Some changes can wait on this phone." Not dismissible. |
| Changes waiting | Same place (below Offline if both) | `warning-soft`, 🕒: "3 changes waiting to send." **[Send now]** (disabled offline, says "Will send when online") |
| Sending | Same bar | "Sending 3 changes…" |
| Needs you | Same bar, `danger-soft` | "1 change needs your choice." **[Open]** → list of entries with their labels and actions |
| Saved indicator (DESIGN §7) | Forms, rows | New state **🕒 Waiting to send** (warning). Then ✓ "Saved 10:42" when it lands. |
| Data age | List headers | "Updated 10:42 AM" / "From Tue 13 Oct, 9:40 PM" |
| Other login's changes | Settings → This phone | "2 changes from Papa's login are on this phone. Papa must log in here to send them." |

All words follow DESIGN §8 (no "sync", "cache", "server").

### 5.5 Logout with changes waiting

1. Tap **Log out**. The app checks the outbox.
2. Empty → the normal confirm (DESIGN §8).
3. Not empty → the dialog:
   - Title: "3 changes haven't been sent."
   - Line: "If you log out now, they are lost."
   - Buttons: **[Send now]** (primary) · **[Show changes]** · **[Log out and lose them]** (danger, second confirm).
4. Offline: **Send now** is disabled with "Connect to the internet first."
5. Logout then wipes IndexedDB (`wipeAll()`), unsubscribes push on this phone, and clears the cookie.

`401 session_ended` (password reset, log out everywhere) is not a logout on the phone: the outbox is kept and sent after the same person logs in again.

### 5.6 Asking the phone to keep our data

```js
// src/offline/storage.js — ask the phone not to clear our data under storage pressure
export async function protectStorage() {
  if (!navigator.storage || !navigator.storage.persist) return 'unsupported';
  if (await navigator.storage.persisted()) return 'protected';
  // Chrome decides silently (installed apps usually get it). Safari uses its own rules
  // (Home Screen app helps). No pop-up on either. Safe to call again later.
  return (await navigator.storage.persist()) ? 'protected' : 'not_protected';
}

export async function storageReport() {
  const est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : {};
  const persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
  return { usedMB: Math.round((est.usage || 0) / 1e6), quotaMB: Math.round((est.quota || 0) / 1e6), persisted };
}
```

| When | Why |
|---|---|
| After each login inside the installed app | Earliest moment both phones are likely to say yes |
| When the user taps **Get wedding-day data** | A tap, and the most important moment |
| Settings → This phone | Shows "Offline data: protected ✓" or "not protected", storage used, app version, waiting changes |

No pop-up on either phone. If it says "not protected", nothing breaks; the Ready check (§8.3) shows it.

### 5.7 iPhone-specific risks

| Risk | Guard |
|---|---|
| IndexedDB connection drops after the app returns from the background | `withDb()` reopens once and retries |
| App killed in the middle of a send | Entry already saved; resent with the same key; server replays the reply |
| Icon deleted with changes waiting | Warning in Settings and the logout dialog; Ready check |
| Safari tab and Home Screen app both used | Install Guide says to use the icon only; outbox check before install |

---

## 6. Updates

### 6.1 How a new version arrives

| Step | What happens |
|---|---|
| 1 | We deploy (order in §4.4). `version.json` says `1.0.8`. |
| 2 | The phone checks `version.json` on app open, on return to the app (max once a minute) and every 30 min while open. |
| 3 | Different from the running `1.0.7` → `registration.update()` downloads the new `sw.js` and its files in the background. |
| 4 | New service worker installed and **waiting** → the prompt appears: **"New version available. Tap to refresh."** |
| 5 | Tap → if a form has unsaved typing: "Save or close the open form first. Then tap Refresh." Otherwise wait for any send to finish, then `SKIP_WAITING` and reload. |
| 6 | The outbox and cache survive the reload (IndexedDB is not touched). |

**Never automatic.** The app never reloads by itself, and never while a form is dirty. The one exception is softer, not harder: when the server refuses old versions (`426 update_required`, `X-Min-Client-Version`), the prompt becomes "Please refresh to keep saving. Your typing is kept." Drafts are already stored on the phone (DESIGN principle 3), and the outbox waits until the refresh.

### 6.2 `src/pwa/dirtyForms.js`

```js
// src/pwa/dirtyForms.js — which forms have unsaved typing right now
import { useEffect } from 'react';

const dirty = new Set();

export function anyDirtyForm() { return dirty.size > 0; }

// In every form: useDirtyForm('task-form', isDirty)
export function useDirtyForm(id, isDirty) {
  useEffect(() => {
    if (isDirty) dirty.add(id); else dirty.delete(id);
    return () => { dirty.delete(id); };
  }, [id, isDirty]);
}
```

### 6.3 `src/pwa/UpdatePrompt.jsx`

```jsx
// src/pwa/UpdatePrompt.jsx — "New version available. Tap to refresh."
// Never reloads by itself. Never reloads while a form has unsaved typing.
import { useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { anyDirtyForm } from './dirtyForms.js';
import { status as outboxStatus } from '../offline/outbox.js';

const CHECK_EVERY_MS = 30 * 60 * 1000;   // also checked each time the app comes to the front

export default function UpdatePrompt({ forced = false }) {
  const regRef = useRef(null);
  const lastCheck = useRef(0);
  const [stale, setStale] = useState(false);       // server has a newer build but no SW update arrived
  const [blockedMsg, setBlockedMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) { regRef.current = reg || null; },
    onRegisterError() { /* app still works online; Settings › This phone shows "Offline: off" */ },
  });

  // Ask the server which build is current. Cheap: a ~60-byte file, never cached.
  async function check() {
    const now = Date.now();
    if (now - lastCheck.current < 60 * 1000 || !navigator.onLine) return;
    lastCheck.current = now;
    try {
      const res = await fetch('/version.json', { cache: 'no-store' });
      const { version } = await res.json();
      if (version && version !== __APP_VERSION__) {
        const reg = regRef.current;
        if (reg) await reg.update();               // downloads the new sw.js + precache
        // If no new worker shows up within 20 s, the old one is stuck: offer the fix page.
        setTimeout(() => {
          const r = regRef.current;
          if (!r || (!r.waiting && !r.installing)) setStale(true);
        }, 20000);
      }
    } catch { /* offline or server busy: try next time */ }
  }

  useEffect(() => {
    check();
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(() => { if (document.visibilityState === 'visible') check(); }, CHECK_EVERY_MS);
    // A lazy-loaded screen was deleted by a newer deploy (two tabs, old one open).
    const onPreloadError = (ev) => { ev.preventDefault(); setStale(true); };
    window.addEventListener('vite:preloadError', onPreloadError);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
      window.removeEventListener('vite:preloadError', onPreloadError);
    };
  }, []);

  const show = needRefresh || stale || forced;
  if (!show) return null;

  async function refresh() {
    // Forced (server refuses old versions): drafts are already kept on the phone, so go ahead.
    if (anyDirtyForm() && !forced) {
      setBlockedMsg('Save or close the open form first. Then tap Refresh.');
      return;
    }
    setBusy(true);
    // Let a running send finish, so no request is cut in half (it would be retried anyway).
    for (let i = 0; i < 20 && (await outboxStatus()).flushing; i += 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
    if (needRefresh) {
      await updateServiceWorker(true);           // SKIP_WAITING, then reload when the new SW controls
    } else {
      window.location.assign('/reset.html');     // stuck old version: clear app files, keep data
    }
  }

  return (
    <div role="status" aria-live="polite"
         className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-40 px-safe pb-2">
      <div className="rounded-md bg-info-soft text-text shadow-card p-4 flex flex-col gap-2">
        <p className="text-base font-bold">
          {forced ? 'Please refresh to keep saving. Your typing is kept.' : 'New version available.'}
        </p>
        {blockedMsg && <p className="text-sm text-warning">{blockedMsg}</p>}
        <button type="button" onClick={refresh} disabled={busy}
                className="tap rounded-md bg-primary text-on-primary font-bold">
          {busy ? 'Refreshing…' : 'Tap to refresh'}
        </button>
      </div>
    </div>
  );
}
```

Mount it once in the app layout. Pass `forced` when the outbox reports `update_required` or a response has `X-Min-Client-Version` above ours.

### 6.4 Recovering a stuck old version

Try in this order:

| # | Who | Step | Keeps waiting changes? |
|---|---|---|---|
| 1 | Anyone | Close the app fully and open it again (the prompt usually appears) | Yes |
| 2 | Anyone | Settings → This phone → **Fix the app** (opens `/reset.html`) | Yes |
| 3 | Admin, remotely | Send the link `https://wedding.lumorrahouse.com/reset.html` on WhatsApp. On iPhone it must be opened **in the installed app** — so instead say "Open the app → Settings → Fix the app". | Yes |
| 4 | Admin, on deploy | Raise `X-Min-Client-Version`. Old versions can still read but get the forced prompt on save. | Yes |
| 5 | Last resort, in person | Android: Chrome → Settings → Site settings → this site → Clear & reset. iPhone: delete the icon and add it again. **Only after "0 changes waiting".** | **No** |

The prompt also appears if a lazy screen fails to load after a deploy (`vite:preloadError`), or if a new version exists but no new service worker shows up within 20 s (then **Tap to refresh** opens `/reset.html`).

`public/reset.html` and `public/reset.js` (never precached; the service worker ignores them):

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Fixing A&amp;M Wedding</title>
</head>
<body>
  <h1>Fixing the app…</h1>
  <p id="msg">Please wait a few seconds.</p>
  <script src="/reset.js"></script>
</body>
</html>
```

```js
// public/reset.js — escape hatch for a stuck old version. Never precached.
// Removes the service worker and the app-file caches. KEEPS IndexedDB:
// the read cache and, above all, the outbox of unsent changes.
(async function () {
  var msg = document.getElementById('msg');
  try {
    if ('serviceWorker' in navigator) {
      var regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(function (r) { return r.unregister(); }));
    }
    if (window.caches) {
      var keys = await caches.keys();
      await Promise.all(keys.map(function (k) { return caches.delete(k); }));
    }
    msg.textContent = 'Done. Opening the app…';
  } catch (e) {
    msg.textContent = 'Could not fix it here. Please ask Ayush.';
    return;
  }
  setTimeout(function () { location.replace('/?fixed=' + Date.now()); }, 800);
})();
```

---

## 7. Notifications (R2a)

### 7.1 How it works

```
Hostinger cron (every 15 min) ─► reminders.php
   ├─ picks due reminders (all set for daytime IST; no quiet hours)
   ├─ Web Push to each active phone of that person (VAPID, minishlink/web-push)
   │     └─ Apple / Google push service ─► phone shows it (sw.js, or iOS 18.4+ by itself)
   └─ no phone accepted it ─► email (when MAIL_ENABLED and the person has an email)
reminder_runs row per run ─► Health "reminders" red if > 30 min old (API §11)
```

### 7.2 Rules per phone

| Rule | Android Chrome | iPhone |
|---|---|---|
| Where "Turn on reminders" appears | Tab or installed app | **Installed app only**, iOS 16.4+. In Safari: "Add the app to your Home Screen first" (button opens the Install Guide). |
| Permission request | From a tap | From a tap. `Notification.requestPermission()` is the **first** await in the tap handler. |
| If refused | "Reminders are blocked. Chrome → ⋮ → Settings → Notifications → allow this site." | "Reminders are blocked. iPhone Settings → Notifications → A&M Wedding → Allow." |
| Every push shows a notification | Required | Required. Silent pushes can get the subscription removed. |
| Badge | No (V3) | `app_badge` in the payload and `setAppBadge()` on open |

### 7.3 API additions (for API.md v1.2)

| Method | Path | Purpose | Who | Request | Response |
|---|---|---|---|---|---|
| POST | `/push/subscriptions` | Save this phone (upsert by endpoint hash; a re-login moves it to the new user) | Self | `{endpoint, keys: {p256dh, auth}, platform, device_label}` | `200 {id, created}` |
| DELETE | `/push/subscriptions` | Turn off on this phone; also called on logout | Self | `{endpoint}` | `200 {}` |
| GET | `/me/notifications` | My settings + my phones with reminders on | Self | — | `200 NotificationSettings` |
| PATCH | `/me/notifications` | Change settings | Self | `If-Match` (user version) + any of the fields in §7.7 | `200 NotificationSettings` |
| POST | `/me/notifications/test` | Send a test now (not via cron) | Self | `{channel}`: `push`, `email` or `both` | `200 {push: {devices, sent, failed, expired}, email}`; `email` is `sent`, `off`, `no_email` or `failed` |

All writes carry `Idempotency-Key` and CSRF as usual. Rate limit on test: 5 per 10 min per user. The VAPID **public** key is baked into the build (`VITE_VAPID_PUBLIC_KEY`), so no endpoint is needed for it.

### 7.4 Payload (Declarative Web Push format)

```json
{ "web_push": 8030,
  "notification": { "title": "Payment due today", "body": "₹1,25,000 to Shree Tent House",
                    "navigate": "https://wedding.lumorrahouse.com/money/payments/01JA…",
                    "lang": "en-IN", "dir": "ltr", "silent": false,
                    "tag": "payment-01JA…", "app_badge": "3" } }
```

iOS 18.4+ can show this without our code. Older iOS and Android run `sw.js`, which reads the same fields. One format for all. No guest names or phone numbers in pushes (they pass through Apple and Google).

### 7.5 Data

`push_subscriptions` already exists (`001_init.sql`). New columns on `users` — **draft for `005_notifications.sql`**, to be finalised in DATABASE.md:

```sql
ALTER TABLE users
  ADD COLUMN notify_push     TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Send to my phones with reminders on',
  ADD COLUMN notify_email    TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Email when no phone got it (needs email)',
  ADD COLUMN notify_tasks    TINYINT UNSIGNED NOT NULL DEFAULT 1,
  ADD COLUMN notify_payments TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Ignored for non-money users',
  ADD CONSTRAINT ck_users_notify CHECK (notify_push IN (0,1) AND notify_email IN (0,1)
                                        AND notify_tasks IN (0,1) AND notify_payments IN (0,1));
```

No quiet-hours columns (answer 3). Reminder rows are created by PHP when a task or payment gets a due date (FEATURES R2a defaults: payments 3 days before and on the day; tasks on the day; all at 9 AM IST, Open Question 3), using `dedupe_key`. `notify_tasks` / `notify_payments` are checked when rows are created.

### 7.6 Hostinger cron

hPanel → Advanced → **Cron Jobs** → Custom (PHP path to verify, V11):

| Job | Schedule | Command |
|---|---|---|
| Reminders | `*/15 * * * *` | `/usr/bin/php /home/<user>/domains/lumorrahouse.com/private/cron/reminders.php` |
| Daily clean-up (exists) | `30 21 * * *` (3:00 AM IST) | `…/cron/daily.php` — also deletes `push_subscriptions` revoked > 90 days |
| Nightly backup (exists) | as in DATABASE.md | — |

Turn on `gmp` (or `bcmath`) in hPanel → PHP Configuration → Extensions. Install the library on a computer with `composer require minishlink/web-push`, then upload `vendor/` with the API (or run Composer over SSH).

VAPID keys, once: `php -r 'require "vendor/autoload.php"; print_r(Minishlink\WebPush\VAPID::createVapidKeys());'` → `.env`:

```
VAPID_SUBJECT=mailto:planner@lumorrahouse.com
VAPID_PUBLIC_KEY=B…        # also VITE_VAPID_PUBLIC_KEY in the frontend build
VAPID_PRIVATE_KEY=…        # never leaves .env
```

Never change the keys after launch: every phone would have to turn reminders on again.

### 7.7 Settings → Reminders (per person)

| Setting | Default | Notes |
|---|---|---|
| **Reminders on this phone** | Off until tapped | The tap is the permission request. Shows each of my phones: "Papa's iPhone · on since 2 Nov" with [Turn off]. |
| Tasks due | On | "On the due day at 9 AM" |
| Payments due | On (money users only) | "3 days before and on the day" |
| Email if my phone misses it | On | Needs an email on my account (admins add it). Hidden while `MAIL_ENABLED=false`. |
| **Send a test reminder** | — | §7.8 |

### 7.8 Test button

1. Tap **Send a test reminder**.
2. `POST /me/notifications/test` sends straight away and replies per channel.
3. The screen shows: "Sent to 2 phones. Didn't arrive in a minute? [Help]". Email: "Sent to papa@…" or "Email is off".
4. Help lists the fixes from §7.2 for this phone, plus "Open the app from the icon, not Safari."
5. Admins also see Home → Safety → "Last reminder run 6 min ago" (red after 30 min).

### 7.9 Email fallback

PHPMailer (MIT) over SMTP to the Hostinger mailbox `planner@lumorrahouse.com` (approved 8 Oct; create it in hPanel → Emails), with SPF and DKIM turned on in hPanel. App cap 30 emails per day (API §3.4). Plain text, one line plus the link. Off while `MAIL_ENABLED=false`.

### 7.10 Code

**Turning reminders on (`src/pwa/push.js`)**

```js
// src/pwa/push.js — "Turn on reminders" (R2a). Call turnOnReminders() ONLY from a button tap.
import { canUsePush, deviceLabel, isIOS } from './platform.js';
import { apiFetch } from '../api/client.js';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;   // public half only; baked in at build

export async function turnOnReminders() {
  if (!canUsePush()) return { ok: false, reason: isIOS ? 'install_first' : 'unsupported' };
  // iOS: the permission request must be the FIRST async step after the tap. No await before it.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: permission === 'denied' ? 'blocked' : 'dismissed' };

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,                                   // required by Chrome and Safari
      applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY),
    });
  }
  const json = sub.toJSON();                                    // { endpoint, keys: { p256dh, auth } }
  await apiFetch('POST', '/push/subscriptions', {
    endpoint: json.endpoint, keys: json.keys,
    platform: isIOS ? 'ios' : /Android/.test(navigator.userAgent) ? 'android' : 'desktop',
    device_label: deviceLabel(),
  });
  return { ok: true };
}

// On every app open: if this phone had a subscription, make sure the server still has it.
export async function refreshPushSubscription() {
  if (!canUsePush() || Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    const json = sub.toJSON();
    await apiFetch('POST', '/push/subscriptions', { endpoint: json.endpoint, keys: json.keys,
      platform: isIOS ? 'ios' : 'android', device_label: deviceLabel() }).catch(() => {});
  }
}

export async function turnOffRemindersOnThisPhone() {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await apiFetch('DELETE', '/push/subscriptions', { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}

function base64UrlToBytes(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
```

**PHP push sender (`api/src/Push/PushSender.php`)**

```php
<?php
// api/src/Push/PushSender.php — sends Web Push to every active phone of one member.
// Library: minishlink/web-push (MIT). Needs PHP 8.2+, ext-openssl, ext-curl, ext-mbstring
// (ext-gmp or ext-bcmath make it faster; turn one on in hPanel › PHP Configuration).
declare(strict_types=1);

namespace App\Push;

use Minishlink\WebPush\MessageSentReport;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;
use PDO;

final class PushSender
{
    private WebPush $webPush;

    public function __construct(private PDO $db, array $env)
    {
        $this->webPush = new WebPush(
            ['VAPID' => [
                'subject'    => $env['VAPID_SUBJECT'],       // mailto:planner@lumorrahouse.com
                'publicKey'  => $env['VAPID_PUBLIC_KEY'],    // same value as VITE_VAPID_PUBLIC_KEY
                'privateKey' => $env['VAPID_PRIVATE_KEY'],   // .env only, never in Git or the frontend
            ]],
            ['TTL' => 12 * 3600, 'urgency' => 'normal'],     // a reminder older than 12 h is useless
            20                                               // HTTP timeout, seconds
        );
        $this->webPush->setReuseVAPIDHeaders(true);
    }

    /**
     * @param array{title:string, body:string, url:string, tag?:string, badge?:int} $n
     * @return array{sent:int, failed:int, expired:int, devices:int}
     */
    public function sendToUser(int $userId, array $n): array
    {
        $subs = $this->db->prepare(
            'SELECT id, endpoint, p256dh, auth_secret FROM push_subscriptions
              WHERE user_id = ? AND revoked_at IS NULL'
        );
        $subs->execute([$userId]);
        $rows = $subs->fetchAll(PDO::FETCH_ASSOC);

        $payload = self::payload($n);
        $topic   = isset($n['tag']) ? self::topic($n['tag']) : null;
        $byEndpoint = [];
        foreach ($rows as $r) {
            $byEndpoint[$r['endpoint']] = (int) $r['id'];
            $this->webPush->queueNotification(
                Subscription::create([
                    'endpoint' => $r['endpoint'],
                    'keys'     => ['p256dh' => $r['p256dh'], 'auth' => $r['auth_secret']],
                ]),
                $payload,
                $topic ? ['topic' => $topic] : []
            );
        }

        $out = ['sent' => 0, 'failed' => 0, 'expired' => 0, 'devices' => count($rows)];
        /** @var MessageSentReport $report */
        foreach ($this->webPush->flush() as $report) {
            $id = $byEndpoint[$report->getEndpoint()] ?? null;
            if ($id === null) {
                continue;
            }
            if ($report->isSuccess()) {
                // "Accepted by Apple/Google", not "seen by the person". The UI says "Sent".
                $this->db->prepare('UPDATE push_subscriptions
                    SET last_success_at = UTC_TIMESTAMP(), failure_count = 0 WHERE id = ?')->execute([$id]);
                $out['sent']++;
            } elseif ($report->isSubscriptionExpired()) {
                // 404/410: the phone removed the app, turned reminders off, or the browser rotated it.
                $this->db->prepare('UPDATE push_subscriptions
                    SET revoked_at = UTC_TIMESTAMP(), last_failure_at = UTC_TIMESTAMP() WHERE id = ?')->execute([$id]);
                $out['expired']++;
            } else {
                $this->db->prepare('UPDATE push_subscriptions
                    SET last_failure_at = UTC_TIMESTAMP(), failure_count = failure_count + 1 WHERE id = ?')->execute([$id]);
                error_log('push failed sub=' . $id . ' reason=' . $report->getReason());
                $out['failed']++;
            }
        }
        return $out;
    }

    // Declarative Web Push JSON: iOS 18.4+ can show it without our JS;
    // older iOS and Android hand it to sw.js, which reads the same fields.
    public static function payload(array $n): string
    {
        $notification = [
            'title'    => mb_substr($n['title'], 0, 80),
            'body'     => mb_substr($n['body'], 0, 180),
            'navigate' => 'https://wedding.lumorrahouse.com' . $n['url'],   // our own pages only
            'lang'     => 'en-IN',
            'dir'      => 'ltr',
            'silent'   => false,
        ];
        if (isset($n['tag'])) {
            $notification['tag'] = $n['tag'];
        }
        if (isset($n['badge'])) {
            $notification['app_badge'] = (string) max(0, (int) $n['badge']);
        }
        return json_encode(['web_push' => 8030, 'notification' => $notification],
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }

    // Topic header: max 32 URL-safe characters. A newer push with the same topic replaces
    // an undelivered older one (phone was off) — no pile of stale reminders.
    private static function topic(string $tag): string
    {
        return substr(rtrim(strtr(base64_encode(hash('sha256', $tag, true)), '+/', '-_'), '='), 0, 32);
    }
}
```

**Cron (`private/cron/reminders.php`)** — lint-clean on PHP 8.3; ₹ formatting tested.

```php
<?php
// private/cron/reminders.php — run by Hostinger cron every 15 minutes (PWA.md §7.5).
// Sends due reminders: Web Push first, email if no phone accepted it. Records every run.
// No quiet hours (owner's answer): reminders are created for daytime IST times (9 AM).
declare(strict_types=1);

require __DIR__ . '/../api/bootstrap.php';          // gives $db (PDO, UTC session), $env, $mailer

use App\Push\PushSender;

const BATCH = 200;
const MAX_ATTEMPTS = 3;

// One run at a time, even if a run is slow and the next cron starts.
if ((int) $db->query("SELECT GET_LOCK('am_reminders', 0)")->fetchColumn() !== 1) {
    exit(0);
}

$db->prepare('INSERT INTO reminder_runs (host) VALUES (?)')->execute([gethostname() ?: null]);
$runId = (int) $db->lastInsertId();
$count = ['due' => 0, 'sent' => 0, 'failed' => 0];

try {
    $push = new PushSender($db, $env);

    // A run that died mid-send leaves rows in 'sending'. Give them back after 30 min.
    $db->exec("UPDATE reminders SET status = 'pending', claimed_run_id = NULL
                WHERE status = 'sending' AND updated_at < UTC_TIMESTAMP() - INTERVAL 30 MINUTE");

    $due = $db->query("SELECT id FROM reminders
                        WHERE status = 'pending' AND remind_at <= UTC_TIMESTAMP() AND deleted_at IS NULL
                        ORDER BY remind_at LIMIT " . BATCH)->fetchAll(PDO::FETCH_COLUMN);

    foreach ($due as $id) {
        // Claim it. If another run got it first, rowCount is 0: skip.
        $claim = $db->prepare("UPDATE reminders SET status = 'sending', claimed_run_id = ?,
                                 attempts = attempts + 1, version = version + 1
                               WHERE id = ? AND status = 'pending'");
        $claim->execute([$runId, $id]);
        if ($claim->rowCount() !== 1) {
            continue;
        }
        $count['due']++;
        $r = $db->query('SELECT r.*, u.is_active, u.email, u.notify_push, u.notify_email
                           FROM reminders r JOIN users u ON u.id = r.user_id
                          WHERE r.id = ' . (int) $id)->fetch(PDO::FETCH_ASSOC);

        $msg = build_message($db, $r);                 // null = no longer needed (done, deleted, paid)
        if (!$r['is_active'] || $msg === null) {
            set_status($db, (int) $id, 'cancelled');
            continue;
        }

        $via = null;
        $error = null;
        if ($r['channel'] !== 'email' && $r['notify_push']) {
            $res = $push->sendToUser((int) $r['user_id'], $msg);
            if ($res['sent'] > 0) {
                $via = 'push';
            } else {
                $error = $res['devices'] === 0 ? 'no phone has reminders on' : 'push not accepted';
            }
        }
        if ($via === null && $r['channel'] !== 'push' && $r['notify_email'] && $r['email']
            && ($env['MAIL_ENABLED'] ?? 'false') === 'true') {
            try {
                $mailer->send($r['email'], $msg['title'], $msg['body'] . "\n\nOpen: https://wedding.lumorrahouse.com" . $msg['url']);
                $via = 'email';
            } catch (Throwable $e) {
                $error = 'email: ' . $e->getMessage();
            }
        }

        if ($via !== null) {
            $db->prepare("UPDATE reminders SET status = 'sent', sent_at = UTC_TIMESTAMP(), sent_via = ?,
                            last_error = NULL, version = version + 1 WHERE id = ?")->execute([$via, $id]);
            $count['sent']++;
        } elseif ((int) $r['attempts'] >= MAX_ATTEMPTS) {
            $db->prepare("UPDATE reminders SET status = 'failed', last_error = ?, version = version + 1
                           WHERE id = ?")->execute([mb_substr((string) $error, 0, 500), $id]);
            $count['failed']++;
        } else {
            // Try again in the next run or two.
            $db->prepare("UPDATE reminders SET status = 'pending', claimed_run_id = NULL, last_error = ?,
                            remind_at = UTC_TIMESTAMP() + INTERVAL 15 MINUTE, version = version + 1
                           WHERE id = ?")->execute([mb_substr((string) $error, 0, 500), $id]);
        }
    }

    $db->prepare("UPDATE reminder_runs SET status = 'ok', finished_at = UTC_TIMESTAMP(),
                    due_count = ?, sent_count = ?, failed_count = ? WHERE id = ?")
       ->execute([$count['due'], $count['sent'], $count['failed'], $runId]);
} catch (Throwable $e) {
    error_log('reminders run ' . $runId . ': ' . $e->getMessage());
    $db->prepare("UPDATE reminder_runs SET status = 'failed', finished_at = UTC_TIMESTAMP(),
                    error = ? WHERE id = ?")->execute([mb_substr($e->getMessage(), 0, 1000), $runId]);
} finally {
    $db->query("SELECT RELEASE_LOCK('am_reminders')");
}

// ---------------------------------------------------------------------------

/** Plain-words message, or null when the reminder is no longer needed. */
function build_message(PDO $db, array $r): ?array
{
    switch ($r['entity_type']) {
        case 'test':
            return ['title' => 'Test reminder', 'body' => 'Reminders work on this phone.',
                    'url' => '/settings/notifications', 'tag' => 'test'];
        case 'task':
            $s = $db->prepare("SELECT public_id, title FROM tasks
                                WHERE id = ? AND deleted_at IS NULL AND status NOT IN ('done','cancelled')");
            $s->execute([$r['entity_id']]);
            $t = $s->fetch(PDO::FETCH_ASSOC);
            return $t ? ['title' => 'Task due today', 'body' => $t['title'],
                         'url' => '/tasks/' . $t['public_id'], 'tag' => 'task-' . $t['public_id']] : null;
        case 'payment':
            $s = $db->prepare("SELECT p.public_id, p.title, p.amount_paise, p.due_date, v.name AS vendor
                                 FROM payments p LEFT JOIN vendors v ON v.id = p.vendor_id
                                WHERE p.id = ? AND p.deleted_at IS NULL AND p.status <> 'paid'");
            $s->execute([$r['entity_id']]);
            $p = $s->fetch(PDO::FETCH_ASSOC);
            if (!$p) {
                return null;
            }
            $when = $p['due_date'] === (new DateTimeImmutable('now', new DateTimeZone('Asia/Kolkata')))->format('Y-m-d')
                ? 'today' : 'on ' . (new DateTimeImmutable($p['due_date']))->format('D, j M');
            return ['title' => 'Payment due ' . $when,
                    'body' => inr((int) $p['amount_paise']) . ' to ' . ($p['vendor'] ?: $p['title']),
                    'url' => '/money/payments/' . $p['public_id'], 'tag' => 'payment-' . $p['public_id']];
        default:
            return null;
    }
}

/** ₹1,25,000 (Indian grouping, whole rupees) */
function inr(int $paise): string
{
    $rupees = intdiv($paise, 100);
    $s = (string) $rupees;
    if (strlen($s) > 3) {
        $last3 = substr($s, -3);
        $rest = substr($s, 0, -3);
        $s = preg_replace('/\B(?=(\d{2})+(?!\d))/', ',', $rest) . ',' . $last3;
    }
    return '₹' . $s;
}

function set_status(PDO $db, int $id, string $status): void
{
    $db->prepare('UPDATE reminders SET status = ?, version = version + 1 WHERE id = ?')->execute([$status, $id]);
}
```

---

## 8. Wedding-day offline pack (R2b)

### 8.1 What is downloaded

| Item | Detail |
|---|---|
| Events 13–16 Feb | Name, date, time, venue, address, map link as text (maps need internet) |
| Timeline | Every item: time, what, lead person, vendor, status (DESIGN §9) |
| Call list | Vendors, family coordinators, venue manager, doctor/emergency numbers |
| Guest lists | Families invited to each of those events: name, side, people, food, phone, RSVP |
| Room list | Hotel → room → family → arrival note |
| App shell and fonts | Already precached |

Not included: money, documents, photos, history. About 1–3 MB.

Needs `GET /sync?types=events,households,invitations,vendors,members,timeline,rooms` plus a small reply field `expected: {families, contacts, timeline}` so the phone can check it got everything (API.md v1.2, R2b).

### 8.2 When

| When | How |
|---|---|
| Any app open from 10 Feb, online | Refreshed quietly in the background |
| 13 Feb | Admins see "Check every family phone" with the list of members and each phone's last download time (from `sessions`) |
| Any time | **Get wedding-day data** button (More → Wedding Day). Also asks `persist()`. |
| 12 Feb | Paper copies printed (DESIGN §9.3) |

### 8.3 "Ready for offline?" check

A screen (More → Wedding Day → **Ready for offline?**) with one row per check, ✓ or ⚠ + what to do. All ✓ shows "Ready for wedding day ✓". Admins walk round with it on 13 Feb.

```js
// src/offline/weddingDayReady.js — "Ready for offline?" check (R2b, PWA.md §8.3)
import { withDb } from './db.js';
import { status as outboxStatus } from './outbox.js';
import { isStandalone } from '../pwa/platform.js';

// Each item: { id, ok, label, fix }. All ok = "Ready for wedding day ✓".
export async function weddingDayReady() {
  const pack = await withDb((d) => d.get('snapshots', 'wedding_day'));
  const persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
  const shellCached = !!(await caches.match('/index.html'));
  const swActive = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
  const out = await outboxStatus();
  const ageHours = pack ? (Date.now() - Date.parse(pack.downloaded_at)) / 36e5 : Infinity;
  const counts = pack ? pack.counts : null;          // what we stored
  const expected = pack ? pack.expected : null;      // what the server said it sent

  return [
    { id: 'installed', ok: isStandalone(), label: 'Opened from the Home Screen icon',
      fix: 'Add the app to your Home Screen, then open it from the icon.' },
    { id: 'app_files', ok: shellCached && swActive, label: 'App works without internet',
      fix: 'Close the app fully and open it again with internet.' },
    { id: 'data', ok: !!pack && counts.families === expected.families && counts.timeline === expected.timeline
        && counts.contacts === expected.contacts,
      label: pack ? `Saved: ${counts.families} families, ${counts.contacts} contacts, ${counts.timeline} timeline items`
                  : 'Wedding-day data not saved yet',
      fix: 'Tap "Get wedding-day data" with internet.' },
    { id: 'fresh', ok: ageHours <= 24, label: pack ? `Data from ${new Date(pack.downloaded_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}` : 'No data yet',
      fix: 'Tap "Get wedding-day data" again.' },
    { id: 'protected', ok: persisted, label: 'Phone will keep the data',
      fix: 'Open from the Home Screen icon and tap "Get wedding-day data" again.' },
    { id: 'sent', ok: out.waiting === 0 && out.needsYou === 0, label: 'All your changes are sent',
      fix: 'Connect to internet and tap "Send now".' },
  ];
  // No login check: reading the saved pack needs no internet and no login.
}
```

Last step on screen: "Test it: turn on Airplane mode, close the app, open it from the icon, open Wedding Day."

---

## 9. Later, optional: Capacitor

| | PWA (now) | Capacitor app |
|---|---|---|
| Push on iPhone | Only after install, iOS 16.4+, user must allow | Native push (APNs), any iOS version the app supports; more reliable delivery |
| Install | Install Guide | App Store / Play Store, or a direct APK on Android |
| Storage | Browser rules (persist, 7-day in Safari) | App storage; not cleared by the browser |
| Updates | Instant on deploy | Web code can still load from our server; native changes need store review |
| Costs | ₹0 | **Apple Developer Program US$99 per year** (verify current price). **A Mac with Xcode** to build for iPhone (or a paid cloud Mac). Google Play US$25 one-time, or free direct APK. |
| Store issues | — | Apple may reject an app that is "just a website" (guideline 4.2). A private family app usually ships through TestFlight, whose builds **expire after 90 days**: risky for a February wedding. |
| Work | — | 1–2 weeks: native push plugin, icons, signing, store forms, testing |

**When it's worth it:** with every supported iPhone able to run iOS 26 (§0.1), the old reason (iPhones below 16.4) is gone. It's worth it only if, at the **30 Nov review** (confirmed), the R2a test shows family iPhones still miss reminders or people won't use the installed app, **and** email isn't enough. Otherwise skip it. An Android-only APK is cheap if Android push misbehaves.

---

## 10. Device test checklist

Minimum phones (§0.1): 1 iPhone on the newest iOS, 1 iPhone SE (2nd gen) or iPhone 12 on the iOS it has now, 1 newer Android, 1 Android from 2020. Fill **A** = Android Chrome, **S** = iPhone Safari tab, **H** = iPhone Home Screen app.

| # | Test | A | S | H | Pass when |
|---|---|---|---|---|---|
| T1 | Open the staging link from WhatsApp | ☐ | ☐ | — | Guide says how to open in Chrome / Safari |
| T2 | (V7) Is the WhatsApp link opened inside WhatsApp on iPhone? | — | ☐ | — | Noted |
| T3 | Install: Android via our banner's **Install**; iPhone via the 4 steps | ☐ | ☐ | — | Icon "A&M Wedding" on Home Screen |
| T4 | Open from icon | ☐ | — | ☐ | No address bar. iPhone asks to log in once more; Android doesn't. |
| T5 | Icons: maskable shape (Android), no black corners (iPhone), "&" readable at small size | ☐ | — | ☐ | Looks right |
| T6 | Status bar colour light and dark (V5) | ☐ | ☐ | ☐ | Readable in both |
| T7 | Launch splash (V13) | ☐ | — | ☐ | Ivory, no long white flash |
| T8 | Long-press icon → shortcuts | ☐ | — | — | 4 shortcuts open the right screen |
| T9 | Safe areas: notch, home bar, landscape | ☐ | ☐ | ☐ | Nothing hidden |
| T10 | Text size at largest setting | ☐ | ☐ | ☐ | Rows wrap, nothing cut |
| T11 | Airplane mode, open app from icon | ☐ | ☐ | ☐ | Opens; offline banner; data with "from …" age |
| T12 | (V9) Take a photo → upload receipt | ☐ | ☐ | ☐ | JPEG under 1 MB arrives |
| T13 | Open a PDF → share sheet → Files / WhatsApp | ☐ | ☐ | ☐ | Works; no dead-end screen |
| T14 | System Back on every screen and sheet | ☐ | ☐ | — | One step back each time; at Home the app closes |
| T15 | (V2) iPhone edge-swipe Back in the app | — | — | ☐ | Goes back one step, or nothing; never loses typing |
| T16 | Offline: tick 2 tasks, edit a family, set 3 RSVPs | ☐ | ☐ | ☐ | Each shows 🕒; banner "6 changes waiting to send" |
| T17 | Kill the app (swipe away), reopen offline | ☐ | ☐ | ☐ | Still 6 waiting |
| T18 | Back online → open app | ☐ | ☐ | ☐ | All sent; ✓; other phone sees them; no duplicates |
| T19 | (V1) Settings → This phone after login in the installed app | ☐ | ☐ | ☐ | "Offline data: protected ✓" (record result) |
| T20 | Conflict: two phones edit the same family's adults, one offline | ☐ | ☐ | ☐ | Conflict screen; choices saved; History shows the merge |
| T21 | Log out with changes waiting | ☐ | ☐ | ☐ | Warning dialog; nothing lost unless confirmed |
| T22 | Online-only action offline (delete, mark paid) | ☐ | ☐ | ☐ | Disabled with "Needs internet" |
| T23 | (V4, R2a) Turn on reminders → test reminder | ☐ | — | ☐ | Arrives within a minute; tap opens the right screen |
| T24 | Safari tab shows "Add to Home Screen first" instead of the switch | — | ☐ | — | Yes |
| T25 | (V3) Badge after a push | ☐ | — | ☐ | iPhone shows number; Android noted |
| T26 | (V12) Test reminder again after an app update and after 2 weeks | ☐ | — | ☐ | Still arrives |
| T27 | Task due today with reminders on | ☐ | — | ☐ | Arrives at 9:00 AM IST (± 15 min) |
| T28 | Reminders refused → email fallback (when mail is on) | ☐ | — | ☐ | Email arrives |
| T29 | Deploy a new version while a form is open | ☐ | ☐ | ☐ | Prompt appears; refresh blocked until form saved |
| T30 | Deploy while closed, then open | ☐ | ☐ | ☐ | Prompt within a minute; after refresh, Settings shows new version |
| T31 | Settings → Fix the app with 2 changes waiting | ☐ | ☐ | ☐ | App reloads; still 2 waiting |
| T32 | (R2b) Get wedding-day data → Ready check | ☐ | ☐ | ☐ | All ✓ |
| T33 | (V6) Keep screen on in Wedding Day | ☐ | ☐ | ☐ | Toggle shown only where it works; screen stays on |
| T34 | Airplane-mode dry run of Wedding Day (by 24 Jan) | ☐ | — | ☐ | Now/Next, Call, Lists all work |

---

## 11. Testing on staging (HTTPS only)

Service workers, install and push work only over **HTTPS** (or `localhost`, which a phone can't reach). So every phone test runs on a staging copy on Hostinger.

| Item | Setup |
|---|---|
| Subdomain | `staging-wedding.lumorrahouse.com` (confirmed). hPanel → Domains → Subdomains. Free SSL on. |
| Database | Its own database and `.env`. Loaded with `seed_demo.sql`. Never real guest data. |
| Privacy | `noindex` headers as production. **No HTTP Basic Auth**: it breaks the manifest and service worker on some phones. The app's own login protects it. |
| Separate app | Different origin → its own icon, login, storage and push. Name the staging build "A&M Staging" (`short_name`) with a different icon colour so nobody mixes them up. |
| VAPID keys | Its own pair. |
| Cron | Its own reminders job, every 15 min. |
| Debugging Android | Chrome on a computer → `chrome://inspect` with the phone on USB. |
| Debugging iPhone | Safari Web Inspector needs a Mac. Without one, use **Settings → This phone** (version, service worker state, waiting changes, storage protected, push status, last error) — also useful for helping family by phone. |
| On a computer | `vite build && vite preview` serves on `localhost`, where the service worker works. Use it for quick checks; real phones for everything in §10. |

---

## 12. Scope and effort check

| Item | Release | Effort | Note |
|---|---|---|---|
| Manifest, icons, head tags, `.htaccess` | R1 | 0.5 day | Icons drafted (attached) |
| Android install banner | R1 | 0.25 day | Answer 1 |
| Service worker, update prompt, reset page | R1 | 1 day | |
| IndexedDB read cache via `/sync` | R1 | 2 days | Already planned |
| **Outbox** (P1) | R1 | **3–4 days** | New since decision 7. 17 days to launch. |
| Install Guide (both phones, screenshots) | R1 | 1 day | |
| Push, settings, cron, test button | R2a | 3 days | |
| Wedding-day pack + Ready check | R2b | 2 days | Screens in DESIGN §9 are extra |

If R1 runs late, a safe cut: launch with the outbox as the **only save path** (so failed sends are kept and retried — this alone is the data-safety win), but keep offline *starting* of edits switched off behind a flag until 1 Nov.

---

## Changes needed in other docs

| Doc | Change |
|---|---|
| CONTEXT.md → v1.5 | Decision 6 (our own Android prompt), 7 (limited outbox), 22 (Apple-style icon), 37 (no quiet hours), 39 (supported phones). Done. |
| DESIGN.md | §2.6 icon (Apple style), §6.1 Android banner → our own install banner, offline banner text, "Waiting to send" state, "changes waiting" and "needs your choice" bars, logout dialog, Settings → This phone, Install button on Android. |
| API.md v1.2 | §7.3 endpoints; `/sync` timeline and rooms types with `expected` counts (R2b). |
| DATABASE.md | `005_notifications.sql`. |
| FEATURES.md | A3 offline rules for the queueable actions. |

---

## Open Questions

1. **Icon draft:** OK as is (ivory "A&M", marigold "&", maroon gradient)? Or the reverse (maroon letters on ivory)?
2. **Minimum iOS:** support iOS 17 and newer (all 2020+ iPhones can update), or insist on the latest iOS 26?
3. **Reminder time:** with no quiet hours, is **9 AM IST** right for both task and payment reminders?
