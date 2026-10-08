# DESIGN.md — Release 1 UX & Visual Design

Version 1.1 · 8 Oct 2026 · Owner: Ayush Porwal · v1.1 applies the owner's answers: WhatsApp-like, minimal, ivory, one UI font, "A&M Wedding"
Reads from: `CONTEXT.md` (source of truth), `PRD.md`, `FEATURES.md`.

## Conflicts flagged

| # | Topic | Earlier docs | This doc does |
|---|---|---|---|
| D1 | "List row with swipe actions" | PRD §8 / FEATURES: no swipe-only actions | **Answered:** works like WhatsApp. Swipe and long-press behave as WhatsApp users expect, but each is a shortcut. Every action also has a visible button (§7 List row). |
| D2 | Wedding-day mode | PRD/FEATURES: built in R2b (10 Jan) | Designed here so R1 doesn't block it. Built in R2b. |
| D3 | Error wording | FEATURES A3: "Not saved — no internet. [Try again]" | Your new tone, with the button kept as **Try again** (plainer than "Retry"). FEATURES strings should be updated to §8 of this doc. |
| D4 | Dark mode | Not specified before | Follows the phone setting. Can be overridden per phone in My account. Stored on the phone only, so no new DB field. |
| D5 | Bottom nav has no Money | FEATURES puts Money on its own screen | Money sits under **More**. Money users also get the Payments and Budget cards on Home. |
| D6 | Base font | PRD: 17 px; brief: 16–18 px | 17 px, scaling with the phone's text size. |

---

## 1. Design principles

| # | Principle | What it means in practice |
|---|---|---|
| 1 | **One primary action per screen** | One filled button (or the + button). Everything else is secondary. |
| 2 | **Show what's due, hide what's not** | Overdue and today come first. Done, cancelled and past items are one tap away, not on screen. |
| 3 | **Never lose input** | Drafts on the phone. "Saved" only after the server confirms. Undo instead of "Are you sure?". |
| 4 | **Words beat icons** | Every icon has a text label. Nothing relies on colour, gesture or memory alone. |
| 5 | **Same on every phone** | No feature or layout depends on Android or iPhone. Test both before each release. |
| 6 | **Familiar like WhatsApp, calm like a wedding card** | Patterns everyone already knows. Ivory, lots of space, almost no decoration. |

---

## 2. Visual identity

### 2.1 Mood

**Ivory, minimal and easy to read** (owner's choice). Ivory paper everywhere, with maroon used only for actions and a small marigold touch only on the countdown ring. No patterns, toran lines or display fonts. Content always wins.

It should feel as familiar as WhatsApp:

| WhatsApp habit | Our equivalent |
|---|---|
| Chat list rows | List rows with a round initials avatar (families, vendors), bold name, one muted line, time or badge on the right |
| Green + bottom-right | Maroon + bottom-right (Quick Add) |
| Search bar at the top of lists | Search box at the top of Guests, Tasks, Vendors, Documents |
| Long-press a message to select | Long-press a row to start Select mode. A visible **Select** button in the top bar does the same. |
| Swipe a message to reply | Swipe a row for its main shortcut (§7). Never the only way. |
| 🕒 while sending, ✓ when sent | 🕒 "Saving…" → ✓ "Saved" (§7 Saved indicator) |
| Share to a chat | Every WhatsApp button opens the normal WhatsApp share flow |

### 2.2 Colour tokens

All text pairs were checked with the WCAG 2.1 formula. **Body text ≥ 4.5:1. UI borders and focus rings ≥ 3:1.**

| Token | Light | Dark | Used for | Contrast (light / dark) |
|---|---|---|---|---|
| `bg` | `#FBF7F0` ivory | `#17120F` | Page background | — |
| `surface` | `#FFFFFF` | `#211A16` | Cards, sheets, inputs | — |
| `surface-2` | `#F3ECE1` | `#2B231E` | Sunken areas, selected rows | — |
| `text` | `#2A1F1A` | `#F5EEE4` | Main text | 15.0 / 16.1 on bg |
| `text-muted` | `#5E5048` | `#C9BBAA` | Secondary text (never below 15 px) | 7.2 / 9.9 on bg |
| `border` | `#E2D6C4` | `#3D332C` | Decorative dividers only | — |
| `border-strong` | `#8C7A68` | `#8A7A6A` | Input borders, checkboxes | 3.9 / 4.5 on bg |
| `primary` | `#8A1C2B` maroon | `#F2A7AF` rose | Primary buttons, links, active nav | 8.6 / 9.7 on bg |
| `on-primary` | `#FFFFFF` | `#3A0B12` | Text on primary | 9.2 / 8.8 |
| `primary-soft` | `#F7E4E6` | `#3D1D22` | Active nav pill, selected chip | primary text on it: 7.5 / 7.8 |
| `accent` | `#E8A317` marigold | `#F2B84B` | Toran line, countdown ring, highlights | — |
| `on-accent` | `#2A1F1A` | `#17120F` | Text on accent | 7.4 / 10.4 |
| `success` / `-soft` | `#2F6B3A` / `#E3F0E3` | `#86C991` / `#1D3322` | Done, Coming, Paid | 5.4 / 7.0 |
| `warning` / `-soft` | `#8A5300` / `#FFF0D4` | `#FFC266` / `#3A2C12` | Waiting, due soon, drafts | 5.6 / 8.5 |
| `danger` / `-soft` | `#B3261E` / `#FBE4E2` | `#FF8A80` / `#3D1B19` | Overdue, errors, Delete | 5.4 / 6.7 |
| `info` / `-soft` | `#1F5A8A` / `#E2EEF8` | `#93C5F0` / `#16293A` | Offline banner, tips | 6.2 / 8.1 |
| `focus` | `#1A4F8B` | `#93C5F0` | Focus ring (3 px + 2 px offset) | 7.8 / 10.2 on bg |

**Event colours** are decorative. They are always paired with an icon and the event name. Light mode uses the tint as the chip background with `text`. Dark mode uses `surface-2` with a 4 px left border in the strong colour.

| Event | Strong | Light tint | Lucide icon |
|---|---|---|---|
| Engagement | `#B0477A` | `#F6E1EC` | `gem` |
| Roka | `#8A1C2B` | `#F7E4E6` | `handshake` |
| Haldi | `#C98A00` | `#FCEFC7` | `sun` |
| Mehndi | `#3F7A3A` | `#DDEBD5` | `leaf` |
| Sangeet | `#6B4AA0` | `#E9E0F3` | `music` |
| Mayra | `#C4621A` | `#FBE3CF` | `gift` |
| Wedding | `#8A1C2B` | `#F7E4E6` | `flame` |
| Reception | `#2C4F86` | `#DDE6F2` | `sparkles` |
| Other | `#6E6259` | `#ECE6DD` | `calendar` |

### 2.3 Typography

| Role | Font | Why | Fallbacks |
|---|---|---|---|
| UI and body (Latin) | **Atkinson Hyperlegible** (400, 700) | Designed for low-vision readers. Clear I/l/1 and 0/O. | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` |
| Devanagari (Hindi names now, Hindi UI later) | **Noto Sans Devanagari** (400, 700) | Pairs well, full conjunct support | `"Kohinoor Devanagari"` (iPhone), `"Noto Sans Devanagari"` (Android system), `sans-serif` |

**Font loading:**

- Self-host the fonts with `@fontsource/*` packages. No Google Fonts calls: this keeps them working offline and protects privacy.
- Precache them in the service worker.
- Devanagari uses `unicode-range`, so it only downloads when Devanagari text appears.
- Use `font-display: swap`.

**Type scale** (1 rem = 17 px at the phone's default text size):

| Token | rem | ≈ px | Line height | Use |
|---|---|---|---|---|
| `text-xs` | 0.875 | 15 | 1.4 | Timestamps, helper text (minimum size in the app) |
| `text-sm` | 0.9375 | 16 | 1.45 | Secondary row text, nav labels |
| `text-base` | 1 | 17 | 1.5 | Body, inputs, buttons |
| `text-lg` | 1.125 | 19 | 1.4 | Row titles, card titles |
| `text-xl` | 1.375 | 23 | 1.3 | Screen titles |
| `text-2xl` | 1.75 | 30 | 1.25 | Section heroes |
| `text-3xl` | 2.25 | 38 | 1.15 | Countdown number |

Devanagari text uses line-height + 0.1 (taller letterforms). Weights are 400 and 700 only.

### 2.4 Spacing, radius, shadow

| Item | Values |
|---|---|
| Spacing (4-pt, in rem) | 1 = 0.25 · 2 = 0.5 · 3 = 0.75 · 4 = 1 · 5 = 1.25 · 6 = 1.5 · 8 = 2 · 10 = 2.5 · 12 = 3 · 16 = 4 |
| Screen padding | 16 px sides (`px-4`); 24 px between sections |
| Radius | `sm` 8 px (chips, inputs) · `md` 12 px (buttons, cards) · `lg` 16 px (dialogs) · `xl` 24 px (sheet top corners) · `full` (+ button, badges) |
| Shadows (light) | `card`: `0 1px 2px rgb(42 31 26 / .06), 0 2px 8px rgb(42 31 26 / .06)` · `sheet`: `0 -8px 24px rgb(42 31 26 / .14)` · `fab`: `0 6px 16px rgb(138 28 43 / .30)` |
| Shadows (dark) | No shadows. Use a 1 px `border` around cards and sheets instead. |

### 2.5 Icons

**Lucide** (`lucide-react`, MIT): 24 px with a 2 px stroke in rows, 28 px in the bottom nav.

- Always paired with a visible text label, except the close (×) and back (←) buttons, which have `aria-label`.
- Item icons:
  - Event: `calendar-days`
  - Task: `circle` / `circle-check`
  - Payment: `indian-rupee`
  - Family: `users`
  - Document: `file-text`
  - Vendor: `store`
  - WhatsApp action: `message-circle` + the label "WhatsApp" (no WhatsApp logo, for trademark reasons)

### 2.6 App icon and name

| Item | Spec |
|---|---|
| Icon | **Your logo** (please re-upload; it didn't arrive). Placeholder until then: "A&M" in Atkinson Hyperlegible Bold, maroon on ivory. |
| Files | 512 and 192 px (`purpose: any` and `maskable`, with a safe zone); 180 px `apple-touch-icon` |
| Name under icon | **"A&M Wedding"** (`short_name`). Full `name`: "A&M Wedding Planner". |
| `theme-color` | `#FBF7F0` (light) / `#17120F` (dark), via two `<meta name="theme-color" media="…">` tags |

### 2.7 Tailwind config (v4, CSS-first)

```css
/* src/styles/app.css */
@import "tailwindcss";
@import "@fontsource/atkinson-hyperlegible/400.css";
@import "@fontsource/atkinson-hyperlegible/700.css";
@import "@fontsource/noto-sans-devanagari/400.css";
@import "@fontsource/noto-sans-devanagari/700.css";

:root {
  --c-bg:#FBF7F0; --c-surface:#FFFFFF; --c-surface-2:#F3ECE1;
  --c-text:#2A1F1A; --c-text-muted:#5E5048;
  --c-border:#E2D6C4; --c-border-strong:#8C7A68;
  --c-primary:#8A1C2B; --c-on-primary:#FFFFFF; --c-primary-soft:#F7E4E6;
  --c-accent:#E8A317; --c-on-accent:#2A1F1A;
  --c-success:#2F6B3A; --c-success-soft:#E3F0E3;
  --c-warning:#8A5300; --c-warning-soft:#FFF0D4;
  --c-danger:#B3261E;  --c-danger-soft:#FBE4E2;
  --c-info:#1F5A8A;    --c-info-soft:#E2EEF8;
  --c-focus:#1A4F8B;
  --shadow-card-v: 0 1px 2px rgb(42 31 26/.06), 0 2px 8px rgb(42 31 26/.06);
  --shadow-sheet-v: 0 -8px 24px rgb(42 31 26/.14);
  --shadow-fab-v: 0 6px 16px rgb(138 28 43/.30);
  color-scheme: light;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { /* same block as below */ } }
:root[data-theme="dark"] {
  --c-bg:#17120F; --c-surface:#211A16; --c-surface-2:#2B231E;
  --c-text:#F5EEE4; --c-text-muted:#C9BBAA;
  --c-border:#3D332C; --c-border-strong:#8A7A6A;
  --c-primary:#F2A7AF; --c-on-primary:#3A0B12; --c-primary-soft:#3D1D22;
  --c-accent:#F2B84B; --c-on-accent:#17120F;
  --c-success:#86C991; --c-success-soft:#1D3322;
  --c-warning:#FFC266; --c-warning-soft:#3A2C12;
  --c-danger:#FF8A80;  --c-danger-soft:#3D1B19;
  --c-info:#93C5F0;    --c-info-soft:#16293A;
  --c-focus:#93C5F0;
  --shadow-card-v:none; --shadow-sheet-v:none; --shadow-fab-v:none;
  color-scheme: dark;
}

@theme inline {
  --color-bg:var(--c-bg); --color-surface:var(--c-surface); --color-surface-2:var(--c-surface-2);
  --color-text:var(--c-text); --color-text-muted:var(--c-text-muted);
  --color-border:var(--c-border); --color-border-strong:var(--c-border-strong);
  --color-primary:var(--c-primary); --color-on-primary:var(--c-on-primary); --color-primary-soft:var(--c-primary-soft);
  --color-accent:var(--c-accent); --color-on-accent:var(--c-on-accent);
  --color-success:var(--c-success); --color-success-soft:var(--c-success-soft);
  --color-warning:var(--c-warning); --color-warning-soft:var(--c-warning-soft);
  --color-danger:var(--c-danger); --color-danger-soft:var(--c-danger-soft);
  --color-info:var(--c-info); --color-info-soft:var(--c-info-soft);
  --color-focus:var(--c-focus);
  --shadow-card:var(--shadow-card-v); --shadow-sheet:var(--shadow-sheet-v); --shadow-fab:var(--shadow-fab-v);
}

@theme {
  --font-sans: "Atkinson Hyperlegible", "Noto Sans Devanagari", "Kohinoor Devanagari", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --text-xs:0.875rem;   --text-xs--line-height:1.4;
  --text-sm:0.9375rem;  --text-sm--line-height:1.45;
  --text-base:1rem;     --text-base--line-height:1.5;
  --text-lg:1.125rem;   --text-lg--line-height:1.4;
  --text-xl:1.375rem;   --text-xl--line-height:1.3;
  --text-2xl:1.75rem;   --text-2xl--line-height:1.25;
  --text-3xl:2.25rem;   --text-3xl--line-height:1.15;
  --radius-sm:0.5rem; --radius-md:0.75rem; --radius-lg:1rem; --radius-xl:1.5rem;
}

/* Base size: 17 px that follows the phone's text-size setting */
html { font-size:106.25%; -webkit-text-size-adjust:100%; }
html.ios { font:-apple-system-body; font-family:var(--font-sans); } /* iPhone Dynamic Type: 17 px at default */
body { @apply bg-bg text-text font-sans text-base antialiased; }
:lang(hi) { line-height:1.6; }

@utility tap { min-height:3rem; min-width:3rem; }           /* ≥ 48 px */
@utility focus-ring { outline:3px solid var(--c-focus); outline-offset:2px; }
@utility pb-safe { padding-bottom:env(safe-area-inset-bottom); }
@utility pt-safe { padding-top:env(safe-area-inset-top); }
@utility px-safe { padding-left:max(1rem, env(safe-area-inset-left)); padding-right:max(1rem, env(safe-area-inset-right)); }
:focus-visible { outline:3px solid var(--c-focus); outline-offset:2px; }
@media (prefers-reduced-motion: reduce) { *{ animation-duration:0.01ms!important; transition-duration:0.01ms!important; } }
```

The `ios` class is added to `<html>` by a 3-line script that checks for iPhone/iPad. It isn't applied on Mac, because there `-apple-system-body` gives 13 px.

---

## 3. Accessibility for older users

| Area | Rule |
|---|---|
| Text size | Base 17 px. Nothing smaller than 15 px. All sizes in `rem`, so they follow the phone's text setting. **iPhone:** `-apple-system-body` (Dynamic Type). **Android:** Chrome's text scaling (Chrome → Settings → Accessibility), which normally matches the phone. Layouts must work at 200% text: rows wrap and never truncate key info. |
| Zoom | Never set `maximum-scale` or `user-scalable=no`. Pinch-zoom always works. |
| Tap targets | ≥ 48 × 48 px (`tap` = 3 rem ≈ 51 px), with ≥ 8 px gaps. The whole row is tappable, not just its text. |
| Colour | Status always uses **icon + word**, with colour on top. Overdue = red + ⚠ + "Overdue". Links are underlined in body text. |
| Contrast | §2.2 tokens only. No grey-on-grey, and no text over photos. |
| Focus | A 3 px focus ring with 2 px offset on every interactive element. Focus moves into opened sheets and dialogs, and returns to the trigger on close. |
| Forms | A label is always visible above the field (placeholders only show examples). Errors appear under the field with an icon and words, and are announced via `aria-live`. |
| Motion | Short fades and slides only (≤ 200 ms). All are off with "Reduce motion". No parallax or confetti. |
| Time limits | The Undo snackbar pauses while touched. Undo is also recoverable from Trash or History later. |
| Screen readers | Semantic HTML (buttons are `<button>`, lists are `<ul>`). Icon-only buttons have `aria-label`. The save state is announced in an `aria-live="polite"` region. |
| Language | `lang="en"` on `<html>`. Devanagari names are wrapped in `lang="hi"` where known. |
| Reading | Short sentences, everyday words, no jargon (see §8). |

---

## 4. Navigation

### 4.1 Layout

```
┌─────────────────────────────┐ ← safe-area-inset-top (notch / status bar)
│ ←  Screen title        [⋯]  │ Top bar, 56 px
├─────────────────────────────┤
│ Offline / draft banner      │ (only when needed)
│                             │
│ Content (scrolls)           │ bottom padding 96 px so the + never covers the last row
│                         (+) │ + button, 64 px, 16 px above the nav
├─────────────────────────────┤
│ Home Calendar Tasks Guests More │ Bottom nav, 64 px
└─────────────────────────────┘ ← safe-area-inset-bottom (home indicator)
```

### 4.2 Bottom nav

| Item | Icon | Screen | Notes |
|---|---|---|---|
| Home | `house` | Dashboard | Default after login |
| Calendar | `calendar-days` | Agenda | Month toggle inside |
| Tasks | `list-checks` | Tasks | Shows the overdue count badge (number + red dot) |
| Guests | `users` | Families list | — |
| More | `menu` | More list | Money*, Documents, Vendors, Trash*, Settings, Install Guide, (R2b) Wedding Day |

\* Only shown to users who may see them.

**Bottom nav rules:**

- Labels are always visible.
- The active item gets a `primary-soft` pill, a bold label and `aria-current="page"`, so it isn't shown by colour alone.
- Tapping the active item scrolls to the top.
- The nav is hidden on full-screen forms, the conflict screen and the login screen.

### 4.3 + button (Quick Add)

- 64 px circle in `primary`, with the `plus` icon and an `aria-label` "Add".
- Placed bottom-right: 16 px + `env(safe-area-inset-right)` from the edge, and 16 px above the nav.
- Shown on Home, Calendar, Tasks, Guests, Money and Documents.
- Hidden for Viewers, and on More, Settings, Trash, forms and sheets.
- Behaviour follows FEATURES A1.

### 4.4 Back and top bar

- **iPhone Home Screen apps have no browser Back button.** So every non-root screen shows **← Back** (`tap` size, labelled) in the top bar.
- Android's system Back maps to the same history.
- Closing a sheet is also one Back step.
- The ⋯ menu holds secondary actions (Share, History, Delete). Delete is always last, in `danger` colour.

### 4.5 Safe areas and phone quirks

| Item | Rule |
|---|---|
| Viewport | `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` |
| Top | Top bar padding-top: `env(safe-area-inset-top)` |
| Bottom | Nav, sheets and snackbars add `env(safe-area-inset-bottom)` |
| Sides | `px-safe` handles landscape notch insets |
| iPhone status bar | `apple-mobile-web-app-status-bar-style = default`. Check in dark mode on a real device. |
| Keyboard | Forms are full-screen with the Save bar pinned above the keyboard (uses `visualViewport`, which both platforms support). The bottom nav is hidden while typing. |
| Height | Use `100dvh`, not `100vh` (iOS address bar). |
| Gestures | Swipe actions start ≥ 24 px from screen edges, so they don't clash with system back gestures. |
| Pull to refresh | Custom, only on Home and lists. Uses `overscroll-behavior-y: contain` to stop the browser's own reload. |

---

## 5. Screen inventory (Release 1)

**Standard states** (used where a cell says "Std"):

- **Loading:** skeleton rows/cards in `surface-2` (no spinners for lists). A spinner appears inside a button only while saving.
- **Error:** "Couldn't load this. Check your internet and try again." [Try again]
- **Offline:** last-loaded data with the `info` banner "No internet — you can look, but not save." Write buttons are disabled with the reason. Screens never opened before show "Open this once with internet to see it offline."

| # | Screen | Purpose | Main content | Primary action | Empty state |
|---|---|---|---|---|---|
| S01 | First setup | Create the Owner (one-time) | Setup token, name, phone, password | Create owner | — |
| S02 | Login | Get in | Phone, password (Show toggle), help line "Forgot? Ask Ayush or Mahi." | Log in | — |
| S03 | Setup wizard | Wedding facts | 5 steps: names → dates → city → budget → members | Next / Finish | — |
| S04 | Install Guide | Add to Home Screen | Platform-detected steps with screenshots; WhatsApp-browser warning | Done | — |
| S05 | Home | What needs attention | Countdown, My tasks, Overdue, Payments*, Headcount, Budget*, Safety*, Activity* | + | "Start here" checklist |
| S06 | Calendar — Agenda | What's coming | Day groups; "Date not set" at top | + | "Nothing planned yet. Set your event dates." |
| S07 | Calendar — Month | Spot busy days | Grid with up to 3 dots + "+n"; tapped day's agenda | + | "Nothing planned this month." |
| S08 | Event detail | One home per function | Details · Tasks · Guests · Money* · Documents tabs; Share on WhatsApp | Edit* (admins) / Share | Per tab: "No tasks for Mehndi yet." |
| S09 | Event form | Create/edit an event (admins) | Name, type, date/time, venue, map, dress code, notes | Save | — |
| S10 | Tasks | Do the work | View chips, filters, rows with tick circle | + | "No tasks yet. Tap + to add one." / "Nothing for you today." |
| S11 | Task detail | See and act on one task | Title, status, due, assignees, links, checklist, notes, History | Mark done | — |
| S12 | Task form | Add/edit | Quick fields + More details | Save | — |
| S13 | Postpone sheet | Move a task | Tomorrow · Next Monday · Pick date | Move | — |
| S14 | Guests (Families) | One clean list | Search, filter chips, totals header, rows (name, side, people, RSVP summary) | + | "No families yet." [Add a family] [Import a list] |
| S15 | Family detail | One family, all functions | Contact (Call, WhatsApp), people, food, invitations with RSVP chips per event, History | Set RSVP (per event) | "Not invited to any function yet." [Invite] |
| S16 | Family form | Add/edit | Name, phone, side, adults, children, Invite to; More details | Save | — |
| S17 | Select mode | Bulk actions | Checkboxes, "Select all 260 filtered", action bar | Choose action | — |
| S18 | Import (4 steps) | Bring a list in | Source → Defaults → Map columns → Preview (New / Duplicates / Errors) | Import 480 families | — |
| S19 | Reminders one by one | WhatsApp RSVP chasing | Family card, event list, "3 of 40" | Open WhatsApp | "Everyone in this list has a reply." |
| S20 | Money overview* | Budget health | Planned / Spent / Still to pay / Free; categories with bars | + | "Set your total budget." |
| S21 | Category detail* | One category | Totals, payments list | + | "No payments in Catering yet." |
| S22 | Payments list* | All payments | Filter chips (Due, Overdue, Paid, month), rows | + | "No payments yet." |
| S23 | Payment detail / form* | One payment | Amount, status, vendor, dates, method, receipts | Mark as paid (if due) / Save | — |
| S24 | Mark-paid sheet* | Record payment | Paid on, method, paid by, Add receipt photo | Save payment | — |
| S25 | Vendors | Contacts | Rows with category, phone (Call, WhatsApp), booked badge | + | "No vendors yet." |
| S26 | Vendor detail / form | One vendor | Contact, agreed vs paid vs scheduled*, tasks, documents | Call | — |
| S27 | Documents | Find proof | Filter by type/vendor/event; thumbnail rows | + | "No documents. Take a photo of a receipt or contract." |
| S28 | Document viewer | See file | Image or PDF open, details, links | Open / Share | — |
| S29 | Upload sheet | Add a file | Take photo · Choose file, type, links, progress | Upload | — |
| S30 | More | Everything else | Large list rows with icons and labels | — | — |
| S31 | Settings | Facts and account | Sections from FEATURES B10 | — | — |
| S32 | Members* | People and access | Rows: name, role, money, last seen; member form; reset password | Add member | "Only you so far. Add family members." |
| S33 | Safety* | Trust the data | Last 7 backups, drill log, storage, last export | Log a restore drill | "No backups yet — check the server cron." (red) |
| S34 | Activity* | Who changed what | Plain-sentence feed; filters | — | "No changes yet." |
| S35 | Imports* | Past imports | Rows with counts; Undo this import | — | "No imports yet." |
| S36 | Trash* | Restore | Rows: what, who, when, linked count | Restore | "Nothing deleted." |
| S37 | Export* | Get everything out | Recent exports (24 h links), progress | Export everything | "No exports yet." |
| S38 | Print summary* | Paper copy | `summary.html` in print layout | Print | — |
| S39 | My account | Self-service | Name, change password, theme, log out, log out everywhere | Save | — |
| S40 | Record History | One record's changes | Plain-sentence list | — | "No changes since it was added." |
| S41 | Quick Add sheet | Choose what to add | Type list allowed for role | (type rows) | — |
| S42 | Conflict screen | Merge edits | §7 Conflict dialog | Save my choices | — |
| S43 | Login sheet (session expired) | Re-auth without losing the form | Phone (prefilled), password | Log in | — |
| S44 | No access / not found | Dead ends | "You don't have access to this. Ask Ayush or Mahi." / "This item was deleted." | Go to Home | — |

\* Money and admin screens are only shown to users who may see them.

**Loading, error and offline states by screen:**

- **Loading:** Std for all list and detail screens. S02 and the S12/S16 Save buttons show a spinner inside the button. S18 and S37 show a progress bar.
- **Error:** Std. Form errors are inline per field, plus a summary at the top ("Fix 2 fields").
- **Offline:** Std. S02 shows "No internet. Connect to log in." S18, S24, S29 and S37 are disabled with the reason.

---

## 6. Key flows

### 6.1 First login and install to Home Screen

The admin creates the member and taps **Share on WhatsApp**. The message contains the app link, the phone number and a temporary password.

**Android (Chrome)**

| Step | User does | App shows |
|---|---|---|
| 1 | Taps the link in WhatsApp | If it opened inside WhatsApp: "Tap ⋮ → **Open in Chrome**" |
| 2 | Logs in with phone + password | Home, plus a one-time banner "Add this app to your Home screen" [Show me] |
| 3 | Taps Show me | Install Guide: "Tap ⋮ (top right) → **Add to Home screen** → **Install**." Screenshot. |
| 4 | Installs | The icon appears. Opens already logged in. |
| 5 | (R2a) Turn on reminders | "Tap **Turn on reminders** → **Allow**." |

**iPhone (Safari)**

| Step | User does | App shows |
|---|---|---|
| 1 | Taps the link in WhatsApp | If it opened inside WhatsApp: "Tap the **Safari** icon / **Open in Safari**." If in Chrome: "Please open this link in **Safari**." |
| 2 | Logs in | Home, plus the banner [Show me] |
| 3 | Taps Show me | Install Guide: "Tap **Share** (□↑). If you don't see it, tap **⋯** first. Scroll down → **Add to Home Screen** → keep **Open as Web App** on (if shown) → **Add**." Screenshots. |
| 4 | Opens the app from the new icon | **"Log in once more — the Home Screen app keeps its own login."** Login form with that note. |
| 5 | (R2a) Turn on reminders | "Works on iOS 16.4 or newer, only from the Home Screen app. Tap **Turn on reminders** → **Allow**." |

The banner can be dismissed. It doesn't come back for 7 days and never shows inside the installed app (`display-mode: standalone`).

### 6.2 Add a task

1. Tap **+** (or + on Tasks, which opens the form directly).
2. Tap **Task**.
3. Type a title. Optional: tap a due chip (Today / Tomorrow / This week / Pick date). Assigned to defaults to me.
4. Tap **Save**. The button shows "Saving…", then the form closes and the snackbar says "Task added. [Open]".

### 6.3 Postpone a task

1. On the task row or detail, tap **Move date** (`calendar-arrow-right` icon + label).
2. A sheet opens: **Tomorrow · Next Monday · Pick date**.
3. Tap a choice. The row moves. Snackbar: "Moved to Mon, 19 Oct. [Undo]".
4. History shows "Postponed from 12 Oct to 19 Oct by Mummy". The row shows a small "Moved 2×" tag.

### 6.4 Add a family (guest household)

1. Tap **+ → Family** (on Guests: + opens it directly).
2. Fill in Name, Phone, Side, Adults/Children (steppers), and Invite to (event chips; sticky defaults are pre-filled and visible).
3. Optional: **More details** for group, area, food, notes.
4. Tap **Save**. If the phone matches a family already listed, a dialog shows that family: [Open that family] [Add anyway].
5. Snackbar: "Sharma family added. [Open]". For batch entry, tap **Save & add another**.

### 6.5 Mark RSVP

- **From the family page:** each invited event shows 4 chips: **Not asked yet · Waiting · Coming · Not coming**. Tap one.
  - It saves at once with an inline "Saved ✓".
  - "Coming" offers an optional "How many?" stepper, pre-filled from the family.
- **From an event's Guests tab:** the same chips on each row.
- **In bulk:** Select mode → **Set RSVP** → pick event and answer → Apply → "Updated 30 families. [Undo]".
- If someone else changed the same RSVP, a dialog asks: "Mummy already set **Coming**. Change to **Not coming**?" [Yes] [No].

### 6.6 Record a payment with a receipt photo

1. **New payment already paid:** + → Payment → choose or type the vendor → amount (shows ₹1,25,000 while typing) → toggle **Paid already**.
2. **Existing due payment:** open it → **Mark as paid**.
3. The sheet asks for Paid on (today), Method (chips: UPI, Cash, Bank, Cheque, Card), and optionally Paid by.
4. Tap **Add receipt photo**. This opens the camera or gallery. The photo is shrunk on the phone, and a thumbnail plus "Ready to upload" appears.
5. Tap **Save payment**. The payment saves first, then the receipt uploads with a progress bar.
6. If the upload fails, the payment still shows **Paid**, with a chip "Receipt not uploaded — [Try again]".
7. To pay only part: **Pay part of this** → amount → Save → "Paid ₹40,000. ₹60,000 still due. [Undo]".

### 6.7 Resolve an edit conflict

1. Save returns a conflict, and the Conflict screen opens full-screen.
2. Header: "Papa changed this family at 10:42 while you were editing."
3. "2 changes merged automatically" (tap to see).
4. One card per clashing field: **Your version / Papa's version** (+ **Keep both** for notes). Large radio buttons.
5. Tap **Save my choices**, or **Keep Papa's** to discard mine.
6. "Saved ✓". History records the merge.

### 6.8 Undo a delete

1. ⋯ → **Delete** (no confirm dialog).
2. Snackbar: "Deleted 'Book tent wala'. **Undo**" for 8 s. The timer pauses while touched.
3. Tap **Undo**. The item returns to its place. "Restored."
4. Missed it? Admins use Trash (6.9). Family see "Ask Ayush or Mahi to restore it" in their History screen.

### 6.9 Restore from Trash (admins)

1. More → **Deleted items**.
2. Filter by type, person or date. Each row reads: "Sharma family · deleted by Papa · 12 Oct, 6:40 PM · 3 invitations".
3. Tap **Restore** (bulk rows: **Restore all 50**, or expand to pick one).
4. If the phone now clashes with another family, a note says so and offers [Open the other family].
5. "Restored. [Open]".

### 6.10 Export everything (admins)

1. More → Settings → **Export** → **Export everything**.
2. Progress: "Preparing export… (guests, money, documents)". It's safe to leave the screen; the export continues.
3. When ready: "Your export is ready. [Download] Link works for 24 hours."
4. **Download:** Android saves to Downloads. iPhone opens the save sheet → **Save to Files**.
5. Tip under the button: "Keep a copy in Google Drive or on a computer."
6. **Print summary** (optional): opens the summary → Print → Save as PDF.

---

## 7. Components

Every interactive component: ≥ 48 px target, a visible focus ring, a text label, and a `disabled` state with the reason given nearby.

### Button

| Variant | Look | Use |
|---|---|---|
| Primary | `primary` fill, `on-primary` text, `md` radius, full width in sheets | One per screen |
| Secondary | `surface` fill, `border-strong` 1.5 px, `text` | Alternatives |
| Text | No fill, `primary` text, underlined on focus | Low-priority links ("More details") |
| Danger | `danger` text and border (fill only in the final step) | Delete, Log out |
| Icon + label | 24 px icon above or beside the label | Call, WhatsApp, Share |

**States:** default · pressed (darken 8%, scale .98) · focus (ring) · disabled (40% opacity + reason) · loading (spinner + "Saving…", same width).
**Rules:** verbs on buttons ("Save payment", not "OK"). Never two primaries side by side.

### Inputs

| Type | Spec |
|---|---|
| Text | Label above · 52 px tall · `border-strong` · helper text below · error = `danger` border + ⚠ + message |
| Phone | `type="tel"`, `inputmode="tel"`, `autocomplete="tel"`. Formats as "+91 98290 12345" on blur. |
| Money | `inputmode="decimal"`. A fixed "₹" prefix. Live en-IN grouping. Accepts "1.25 lakh". |
| Stepper | − value + with 48 px buttons and a typed value allowed. Used for adults and children. |
| Chips (single/multi select) | For ≤ 6 options (side, RSVP, method, status). Selected = `primary-soft` + ✓ icon + bold. Wraps onto more lines; never scrolls sideways. |
| Select | Only for long lists (vendor, category): opens a searchable bottom sheet, not a native dropdown. |
| Textarea | Grows to 6 lines, then scrolls. Shows a counter at 80% of the limit. |

**States:** empty · filled · focus · error · disabled · read-only (no border, plain text).

### Date and time picker

- Quick chips first: **Today · Tomorrow · This week · Pick date · No date**.
- **Pick date** opens the **native** `<input type="date">`. iPhone and Android pickers are accessible, familiar and need no library. Time uses the native `<input type="time">`.
- The display is always "Sat, 14 Feb 2027" (with "6:00 PM IST" when a time is set) next to the field.
- Clear is a separate "No date" chip, not a tiny ×.

### Status badge

Shape: `full` radius, soft background, **icon + word**.

| Group | Values (icon) |
|---|---|
| Task | To do (`circle`) · Doing (`circle-dot`) · Waiting (`hourglass`, warning) · Done (`circle-check`, success) · Cancelled (`circle-x`, muted) |
| Due | Overdue (`triangle-alert`, danger) · Today (`sun`, warning) · No date (`calendar-x`, muted) |
| RSVP | Not asked yet (`circle-help`, muted) · Waiting (`hourglass`, warning) · Coming (`check`, success) · Not coming (`x`, danger) |
| Payment | Due (`clock`, warning) · Overdue (`triangle-alert`, danger) · Paid (`check`, success) |
| Priority | Urgent (`flag`, danger) · Low (`arrow-down`, muted). Normal is not shown. |
| Other | Important (`star`) · Private (`lock`) · Draft (`pencil`, warning) |

### Card

- `surface`, `md` radius, `card` shadow (border in dark mode), 16 px padding.
- Title (`text-lg`, bold) plus an optional "See all 23 →" text button.
- Max 5 items, and one action per card.
- Tapping the card title opens the full list.

### List row with swipe actions

- Row (WhatsApp-style): min 64 px tall. Leading initials avatar (families, vendors, members) or tick circle (tasks) or type icon. Bold title (`text-lg`), one secondary line (`text-sm` muted), trailing badge or date. The whole row opens the detail.
- **Long-press** (500 ms) starts Select mode with that row ticked, like WhatsApp. A visible **Select** button in the top bar does the same, for anyone who doesn't long-press.
- **Swipe (shortcut only, D1):**
  - Left reveals **Done** (tasks) or **Coming** (RSVP rows).
  - Right reveals **Delete**.
  - Each revealed button is ≥ 80 px wide with an icon + word. The action needs a full swipe or a tap on the revealed button.
  - The same actions are always visible as buttons on the detail screen (and the task tick circle is visible on the row).
- Swipe is disabled on the conflict screen and in Select mode. It doesn't start within 24 px of the screen edge.
- **States:** default · pressed · selected (Select mode, checkbox) · disabled (offline: actions hidden).

### Bottom sheet

- `surface`, `xl` top radius, `sheet` shadow, drag handle plus a visible **Close** button (✕ + "Close").
- Max height 90 dvh. Content scrolls. The action bar is pinned with the safe-area inset.
- Focus is trapped inside. Esc, Back or a tap on the backdrop closes it, **unless** there are unsaved changes; then the draft is kept and a toast says "Draft kept."
- Used for: Quick Add type list, postpone, mark paid, filters, searchable select, upload.

### Snackbar with Undo

- Bottom, above the nav and the + button. `text` background with `bg` text (inverted) and a 4.5:1 action button.
- Message ≤ 1 line, plus **UNDO** (≥ 48 px).
- Lasts 8 s. Pauses while touched or focused. One at a time. Announced via `aria-live`.
- Not shown offline (see FEATURES A2).

### Saved indicator

| State | Look |
|---|---|
| Saving… | 🕒 clock icon (`clock`) + "Saving…", `text-muted` (like WhatsApp's pending clock) |
| Saved ✓ 10:42 | `success` ✓ (`check`) + text, like WhatsApp's sent tick. Fades to muted after 3 s; never disappears entirely on forms. |
| Couldn't save | `danger` ⚠ + message + **Try again** |
| Draft kept | `warning` pencil + "Draft on this phone" |

**Placement:**

- Forms: in the top bar, under the title.
- Inline edits (RSVP chips, ticks): next to the changed control.

### Conflict dialog

- Full screen (not a small modal), with the header sentence naming who and when.
- One card per field: **Your version** / **Their version**, each a radio with the value shown in full. Long text gets **Keep both**.
- A collapsed "Merged automatically (2)" section.
- Footer: primary **Save my choices** (disabled until every field is chosen) and secondary **Keep theirs**.
- Inline variant for single-field controls: a small dialog with a Yes/No question.

### Empty state

- A centred Lucide icon (48 px, muted), one sentence of what this is, and one primary action.
- Optional second text action (e.g. "Import a list").
- No illustrations in R1, to keep it light.
- **Filtered empty:** "No families match these filters." [Clear filters]

### Also needed

| Component | Spec |
|---|---|
| Top bar | 56 px + safe-area top. Back · title (1 line, truncates) · ⋯ |
| Offline banner | `info-soft`, `wifi-off` icon, full width under the top bar, not dismissible while offline |
| Draft banner | `warning-soft`: "You have unsaved changes from 10:42." [Use them] [Discard] |
| Tabs | Text tabs ≥ 48 px. Active = bold + 3 px underline in `primary`. Scroll sideways only when there are more than 4. |
| Filter chips row | Wraps. A "Filters (2)" button opens the full sheet. Active filters show as removable chips ("Groom side ✕"). |
| Skeleton | `surface-2` blocks shaped like rows. Shimmer is off under reduced motion. |
| Progress bar | 8 px, `primary`, with a % and words ("Uploading 2 of 5"). |
| Countdown | Atkinson Bold `text-3xl` number, "days to the wedding", inside a thin marigold ring (the only decoration in the app). |

---

## 8. Microcopy guide

**Voice:** like a helpful cousin. Plain, warm and short. The user is never blamed.

**Rules:**

- ≤ 12 words per sentence. Lead with what happened, then what to do.
- Use "you" and everyday words: "families", not "households"; "Coming?", not "RSVP status"; "Deleted items", not "Trash".
- No jargon: no sync, cache, server, error code, 409 or session.
- Never all caps, except the UNDO button.
- No exclamation marks in errors.
- Name people and things: "Papa changed this…", "Deleted 'Sharma family'."
- Dates: "Sat, 14 Feb". Times: "6:00 PM". Money: "₹1,25,000".
- **Translation-ready:** no string concatenation, use placeholders (`{name}`), and don't put text in images.

| Situation | Copy |
|---|---|
| Save, no internet | "Couldn't save. Your changes are kept on this phone. **[Try again]**" |
| Save, server problem | "Something went wrong on our side. Your changes are kept. **[Try again]**" |
| Field error — phone | "Enter a 10-digit mobile number." |
| Field error — amount | "Enter an amount, like 50000 or 1.25 lakh." |
| Fix fields summary | "Please fix 2 things below." |
| Logged out mid-form | "Please log in again. Your changes are safe." |
| Wrong login | "Phone or password is wrong. Try again, or ask Ayush or Mahi." |
| Too many tries | "Too many tries. Wait 15 minutes or ask Ayush or Mahi." |
| Offline banner | "No internet. You can look, but not save." |
| Saved | "Saved ✓ 10:42" |
| Added | "Task added. [Open]" · "Sharma family added. [Open]" |
| Deleted | "Deleted 'Book tent wala'. [UNDO]" |
| Bulk | "Invited 240 families to Reception. [UNDO]" |
| Restored | "Restored." |
| Moved task | "Moved to Mon, 19 Oct. [UNDO]" |
| Paid | "Payment saved. ₹50,000 paid to Shree Tent House." |
| Receipt failed | "Receipt not uploaded. [Try again]" |
| Duplicate family | "Already on the list: Ramesh Sharma & family (Groom side, added by Papa)." [Open that family] [Add anyway] |
| Conflict | "Papa changed this at 10:42 while you were editing. Choose what to keep." |
| Deleted by someone | "Papa deleted this at 10:42. Your changes are kept as a draft." |
| No access | "You don't have access to this. Ask Ayush or Mahi." |
| Empty — tasks | "No tasks yet. Tap + to add one." |
| Empty — my tasks | "Nothing for you today." |
| Empty — guests | "No families yet. Add one, or import your list." |
| Empty — documents | "No documents. Take a photo of a receipt or contract." |
| Empty — trash | "Nothing deleted." |
| Install (iPhone) | "Open the app from your Home Screen and log in once more." |
| Export ready | "Your export is ready. The link works for 24 hours." |
| Backup late (admins) | "Last backup was 27 hours ago. Please check." |

**Confirmations** are used only where Undo can't help: Log out, Log out everywhere, and Reset password.

- Pattern: a question as the title, a consequence in one line, then a verb button.
- Example: "Log out of all phones?" / "You'll need your password on each phone." [Log out everywhere] [Cancel]

---

## 9. Wedding-day mode (designed now, built in R2b)

**Goal:** At a noisy venue, with weak network, any family member can see **what's happening now, what's next and who to call**, in seconds.

### 9.1 Theme

It uses its own high-contrast theme, regardless of the app's light/dark setting (a dark option is available).

| Token | Value | Contrast |
|---|---|---|
| Background | `#FFFFFF` | — |
| Text | `#000000` | 21:1 |
| Secondary text | `#3D3D3D` | 10.9:1 |
| NOW block | `#7A1626` background, `#FFFFFF` text | 10.7:1 |
| Done | `#1F5E2C` background, `#FFFFFF` text | 7.8:1 |
| Offline badge | `#FFE08A` background, `#111111` text | 14.6:1 |

- **Text:** base 1.25 rem (≈ 21 px). Titles 2 rem. The current time is 2.5 rem.
- **Targets:** ≥ 64 px. No decoration, no shadows, no animation.

### 9.2 Layout

```
┌──────────────────────────────────┐
│ Mehndi · Sun 14 Feb   [⚠ OFFLINE] │ offline badge: icon + word + "Data from 13 Feb, 9:40 PM"
│ Now 6:42 PM                      │
├──────────────────────────────────┤
│ ███ NOW ██████████████████████    │
│ 6:30 PM  Mehndi artists start    │
│ Lead: Priya (Mehndi artist)      │
│ [ 📞 Call Priya ]                 │
├──────────────────────────────────┤
│ NEXT  7:30 PM  Dinner opens      │
│ Lead: Rajesh ji (Halwai)          │
│ [ 📞 Call Rajesh ji ]             │
├──────────────────────────────────┤
│ [ Full timeline ]  [ Guest list ] │
├──────────────────────────────────┤
│   Now   ·   Call   ·   Lists      │ 3-tab bar replaces the normal nav
└──────────────────────────────────┘
```

| Tab | Content |
|---|---|
| **Now** | Current event, the NOW item, the NEXT item, each with a lead person and a big Call button. "Full timeline" shows all items: Done (✓ + word), **NOW** (maroon block + word), Upcoming. |
| **Call** | Big rows: name, role, event, **[Call]** and **[WhatsApp]**. Sorted by today's events. Includes vendors, family coordinators, venue manager, and the doctor/emergency numbers entered by admins. |
| **Lists** | Guest list by family, with people and food. Room list (hotel → room → family → arrival). Search box. Read-only. |

### 9.3 Rules

- **NOW and NEXT** come from the timeline times and the phone's clock (IST). Admins can tap **Mark done** or **Mark as now** to override when things run late (see Open Questions).
- **Offline badge:**
  - Online: green "✓ Up to date · 6:40 PM".
  - Offline: yellow "⚠ Offline · data from 13 Feb, 9:40 PM".
  - Always visible. Never shown by colour alone.
- **Refresh:** "Get wedding-day data" downloads and caches everything (timeline, contacts, guest and room lists) for 13–16 Feb. Admins are prompted to do this on every family phone on 13 Feb.
- **Keep screen on:** a toggle, shown only if the phone supports the Screen Wake Lock API. Otherwise it's hidden; the app never assumes it works.
- **Print:** each tab has **Print**. The same layout prints black-on-white on A4, one event per page, with the timeline, contacts and lists. These are the paper copies for 12 Feb.
- **No editing** in wedding-day mode except admin Mark done / Mark as now. Everything else is read-only, to avoid offline write problems.
- Entry points: More → **Wedding Day**. From 13–16 Feb, Home shows a large "Open Wedding Day" button at the top.

---

## 10. Open Questions

**Answered in v1.1:** WhatsApp-like interactions (1) · Calendar stays in the nav (2) · minimal, easy to read, one UI font (3) · ivory (4) · app name "A&M Wedding" (6) · theme follows the phone (7) · wedding-day overrides admins only (8) · emergency numbers added later (9) · "Try again" (10).

**Still open:**

1. **Logo:** it didn't arrive. Please re-upload (SVG or a PNG of at least 1024 px, on a plain background).
2. **Off-site backup account** for the nightly encrypted copy (see CONTEXT.md).
