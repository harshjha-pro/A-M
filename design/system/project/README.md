A warm, editorial wedding planner for Ayush & Mahi's family: ivory pages, solid white cards, burgundy actions, blush selections and a little frosted glass over photographs. It has to work for about 1,800 guests, Nani's phone in bright sunlight, and patchy internet in Bhilwara.

## Content fundamentals

- **Talk like the family talks.** Write short, plain sentences. Address the reader as "you". Name the people who decide: "Only Ayush and Mahi can add tasks. You can still edit and tick tasks."
- **Use the product's own words, always:** Family, Coming?, Coming / Waiting / Not coming / Not asked yet, To do / Doing / Waiting / Done / Cancelled, Paid / Due / Overdue, Waiting to send, Deleted items, Undo, Restore, More details.
- **Use sentence case** for every label, button and title ("Add a family", "Save task", "Mark as done"). Never write in all caps, except the date-box month and the small section overlines.
- **Write numbers the Indian way:** ₹1,50,000 and "1.25 lakh"; times like 6:30 pm; dates like Sun 22 Nov 2026. All times are IST.
- **Never claim more than happened.** Say "Saved" only after the server confirms it. A queued change says "Kept on this phone. It will be sent when the internet is back." A WhatsApp reminder "opens WhatsApp" — the app never sends a message itself.
- **Make every error a next step:** "Enter an amount, like 50000 or 1.25 lakh." "This link has expired or was already used. Ask Ayush or Mahi for a new one."
- **No emoji in the interface.** Lucide icons carry the meaning, and every icon has a word next to it.

## Visual foundations

### Colour
- Use `bg` for the page, `surface` for cards, rows and fields, and `surface-2` for quiet panels. Body text is `text`; help text and metadata are `text-muted`.
- `primary` (burgundy #8A1C2B) is for actions: one primary button per screen, links, the selected nav pill text and the Quick Add button. White text goes on it (`on-primary`).
- `blush` marks selection and soft emphasis: the active nav pill, secondary buttons, summary cards and progress tracks.
- `accent` (champagne) is decorative only: the monogram ring, the progress highlight and hairlines. Never set text in `accent` on a light background.
- Status always comes in pairs: `success`/`success-soft`, `warning`/`warning-soft`, `danger`/`danger-soft`, `info`/`info-soft`. Each status also has a word and an icon (`StatusBadge`). Colour alone never carries meaning.
- The Dark theme mirrors every token. Burgundy lightens to rose (#F2A7AF), with dark text on it.

### Glass (restrained)
- Glass is used only on: the countdown tiles over the hero, the bottom navigation and floating controls, selected filter chips, overlays on photos, small stat tiles over photos, bottom sheets and dialogs.
- The recipe is `glass-white` or `glass-blush`, an 18px backdrop blur, a `glass-border` hairline and `shadow-glass`. Text on glass stays `text` or `primary`.
- Task lists, form fields, guest data, money and long reading text always sit on solid `surface`. Sheets and dialogs use the nearly opaque `glass-sheet`.

### Type
- Use **Atkinson Hyperlegible** for everything people read and tap: `body` (17px) as the base, `body-strong` for row titles and buttons, `label` for form labels and chips, `caption` for metadata.
- **Cormorant Garamond** (`display-hero`, `display-title`, `display-numeral`) is only for wedding moments: the Home headline "Every Detail, A Beautiful Tomorrow", workspace and outfit hero titles, countdown numbers, date boxes and desktop page titles. Never use it for form text or lists.
- Text follows the phone's text-size setting. Nothing is smaller than 13px, and 13px is only for single-word labels.

### Space, shape, depth
- The phone gutter is `space-4` (16px). Cards are padded `space-4`, with `space-3` gaps inside and `space-4`–`space-6` between sections. Desktop content is padded `space-6`/`space-8`.
- Radii: `radius-md` for inputs and countdown tiles, `radius-lg` for cards and photos, `radius-xl` for the hero and dialogs, `radius-2xl` for sheet tops, and `radius-pill` for buttons, chips, badges and the nav.
- Shadows are soft and warm (`shadow-card`). Glass gets `shadow-glass`. Burgundy controls get `shadow-fab`. Dark mode removes card shadows.
- Every touch target is at least 48px. Rows are at least 64px, and the whole row is the target.

### Layout
- Design at 390 × 844 first (`PhoneFrame`), with safe-area-aware top and bottom spacing. Content scrolls clear of the floating glass `BottomNav`.
- The bottom nav is Home · Calendar · Tasks · Workspace · More. Guests, Money, Vendors, Attachment Vault, Documents, Settings and the Install Guide live under More.
- Quick Add (`QuickAdd`) floats bottom-right above the nav, only for people allowed to create on that screen.
- Long forms put the essential fields first and tuck the rest under `MoreDetails`. Save stays visible in `StickyActions`.
- On desktop and tablet (`DesktopFrame`, 1280 wide) a persistent `SideNav` replaces the bottom nav. Lists become tables (guests, payments), and details open in a right-hand panel. Form widths stay readable. Desktop adds no new features.

### Imagery
- Photographs carry the wedding mood: the hero, event and workspace covers, moodboards and dishes. White text over a photo always sits on a `scrim`.
- The images in **Photography** are warm placeholders (marigold, candlelight, drapes, petals, fabrics). They mark where the couple's own photos go. In the app, the Home cover and couple photos come from Settings › Home photos.
- Photos are never required. Families and vendors use initials avatars (`Avatar`), and a missing photo falls back to a blush card with the monogram.

### Motion and states
- Motion is minimal: sheets slide up, skeletons shimmer, and the spinner turns. All of it stops under reduced-motion.
- Every screen has the states in **System states**: loading skeleton, empty with one action, no results, offline read-only, waiting to send, saved, failed with "Try again", session expired (draft kept), conflict ("Mahi changed this…"), Undo after a tick or delete, duplicate warning, upload progress and failure, permission-restricted, not found, update available.
- The focus ring is a solid 3px `focus` outline with a 2px offset, at 3:1 or better on every surface.

## Permissions in the interface

- **Ayush & Mahi (Owner, Partner)** see everything: Money, Activity, Members, and Add for events, tasks and workspaces.
- **Family editors** can edit and tick tasks, and edit guests, workspaces and vendors. They see no Money, and get no Quick Add on Tasks or Calendar.
- **Viewers (Nani)** can look and call. Edit controls are hidden and replaced by a `Hint` saying who can change things.
- Private documents carry the `private` badge and are hidden from everyone except Ayush & Mahi. Money amounts are hidden in History for family and viewers.

## Iconography

- **Lucide** outline icons at stroke 2, 20–24px, in `text-muted` or `primary`. They are the same icons the app already uses.
- An icon never stands alone. Icon buttons carry an accessible `label`, and status icons sit inside a badge with a word.
- WhatsApp actions use the `MessageCircle` icon on `success-soft`, and calls use `Phone` on `blush`. Brand logos are not drawn.

## Screens

Every route in `web/src/routes.jsx` has a page in Components, numbered like the design brief: 2 Authentication · 3 Home · 4 Calendar & events · 5 Tasks · 6 Guests & families · 7 Money & vendors · 8 Workspaces · 9 Outfits, menu & decoration · 10 Documents & Vault · 11 Settings & members · 12 System states · 13 Responsive desktop · 14 Prototype. Each frame is a live React screen built only from this system's components. Edit a component or a token and every screen follows.
