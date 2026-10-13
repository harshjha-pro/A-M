# A&M Wedding — design (as built, version 1.0.20)

Taken from the real app (demo data, phone size 412 × 915, Pixel-style), so Figma matches what people see.

| What | Where |
|---|---|
| Style sheet: colours (light + dark), type, buttons, chips, cards, banners, shapes | `style-sheet.png` (picture) · `style-sheet.html` (open in a browser) |
| Every screen, light | `screens/light/01-login.png` … `46-offline-not-saved.png` (38 = Outfit page, 39 = Decor item, 40 = Reception workspace) |
| Every screen, dark | `screens/dark/…` (same names) |
| Fonts used | `fonts/` (Atkinson Hyperlegible 400/700; Hindi uses Noto Sans Devanagari) |

## Into Figma
1. New design file → drag the whole `screens/light` and `screens/dark` folders onto the canvas (each image becomes a frame-sized picture).
2. Drag `style-sheet.png` next to them.
3. Optional: create colour styles from the hex codes on the style sheet.

## Screens (43)
Login · Home · Calendar · Event · Event form · Tasks · Task · Task form · Guests · Family · Family form · Guest import ·
Reminders · More · Money · Payments · Payment · Payment form · Vendors · Vendor · Vendor form · Documents · Document ·
Settings · Wedding details · Members · Member form · Safety · Activity · Deleted items · This phone · Changes on this phone ·
Export · Home photos · Workspace list · Workspace (Mehndi) · Attachment Vault · Imports · My account · Install guide · Not found · Offline guest list (with its age) · Offline "open this once with internet".

## Refresh after a change
`AM_CAPTURE=1 AM_CAPTURE_OUT=$PWD/design/screens tools/test-e2e.sh --project=android e2e/zz-capture.spec.js` (run from the repo root; needs the sandbox MySQL + demo data).
