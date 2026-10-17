# Release notes — new look (redesign) · version 1.0.23

**Goes to:** STAGING (and the Vercel test copy) first.
**Migrations:** none new. (Home's tile counts come from the existing tables.) (If you have not imported `004`–`009` yet, do that first, in order: the app needs schema version **9**.)
**.env / hPanel / `.htaccess`:** no change.

## What's new
The whole app has the new look from the A&M Design System. Every screen, field, button and permission works exactly as before. Only the look changed.

- **Home (like your reference):** your cover photo fills the top with the menu button, the **A&M ♥ Wedding planner** logo and your monogram. Over the photo: "Namaste, …", **"Every Detail, A Beautiful Tomorrow"**, and the **Months · Days · Hours · Minutes** countdown in frosted tiles. A **Next event** card sits on the photo's edge ("In 36 days"). Under it are four tiles: **Tasks · Guests · Budget · Vendors**. Budget shows only for Ayush, Mahi and Papa ji, as before. Then "Our beautiful moments" (couple photos), upcoming events with pictures, my tasks, overdue and activity.
- **Drawn pictures and flowers:** every event and workspace gets a soft picture that matches its kind (rings for Engagement, marigolds and diyas for Haldi, henna patterns for Mehndi, music and lights for DJ Night or Sangeet, a fire glow for Varmala & Phere, candles for Reception). They work offline. The Log in screen has drawn roses in the corners.
- **Bottom navigation** floats in a frosted bar with the labels always visible. The selected tab has a blush pill.
- **Buttons** are rounded. The main action is burgundy and secondary buttons have a burgundy outline. The + button is a rounded square.
- **Filter chips:** the selected chip is frosted blush with a tick.
- **Cards** are white with a fine border on ivory. Lists, forms and money stay solid and easy to read.
- **Sheets and dialogs** are frosted, with larger rounded corners.
- **Screen titles** on Home, Calendar, Tasks, Workspace and More use the elegant wedding font. Everything you read and type stays in Atkinson Hyperlegible at 17 px.
- **Workspace:** each workspace card has a blush header with its name in the wedding font. A workspace page opens with a hero showing its calendar event and **"N days to go"**.
- **Log in:** roses in the corners, the A&M ♥ logo, **Welcome back** and "Plan your beautiful tomorrow", with phone and lock icons in the fields.
- Dark mode has the same look.

## Phone checks
| # | Do | Pass when |
|---|---|---|
| R1 | Open Home | Photo (or blush card) on top with the headline and the 3 frosted countdown tiles, readable |
| R2 | Scroll any list | The bottom bar stays readable; the last row is not hidden behind it or behind + |
| R3 | Tasks → tap a filter chip | The chosen chip shows a tick and the blush frosted look |
| R4 | Workspace → open Mehndi | Big "Mehndi" header, the event link, "days to go" |
| R5 | Phone in dark mode | Same screens, all text readable |
| R6 | Log out → Log in screen | Blush A&M card above the form; log in still works |

## Live — release checklist
1. **Backup now** (no SQL this time). 2. Upload `live/` in order, `version.json` last. 3. If anything looks wrong: upload `deploy-session14g.zip` (1.0.22) again. Nothing in the database changed.
