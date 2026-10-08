# FEATURES.md — Release 1 Functional Spec (+ R2/R3 outline)

Version 1.1 · 8 Oct 2026 · Owner: Ayush Porwal · v1.1: Excel import + template (A8), one R1 launch, save-error wording from DESIGN.md
Reads from: `CONTEXT.md` (source of truth) and `PRD.md`.

## Conflicts flagged

I have made a provisional call on each of these. Each one is listed again in Open Questions.

| # | Topic | Source says | This spec does |
|---|---|---|---|
| C1 | Undo time | PRD §7: 10 s | **8 s**, per your latest brief. PRD needs updating. |
| C2 | Roles | CONTEXT: Admin / Editor / Viewer | Owner (Ayush) and Partner (Mahi) are both Admins. Family = Editor. Viewer stays. The Owner can't be deactivated or demoted. Otherwise Owner = Partner. |
| C3 | PDF in export | CONTEXT decision 15: no server PDF library | The ZIP holds `summary.html`, which is print-ready. The in-app "Print summary" → Save as PDF gives the PDF. |
| C4 | Activity log | PRD §3: editors can't view the audit log | Per-record **History** is visible to anyone who can see that record, with money fields hidden. The full Activity feed stays admin-only. |
| C5 | "Phone contacts" import | The Contact Picker API is Android-only | Not used. Paste text or a `.vcf` contacts file instead. Both work on iPhone and Android. |
| C6 | Task status "Completed" | CONTEXT statuses: To do, Doing, Waiting, Done, Cancelled | Uses **Done**. |
| C7 | Expense vs Payment | CONTEXT glossary lists both | One `payments` table. A paid record with no vendor is shown as an "Expense". |
| C8 | Hotel / room fields | CONTEXT puts them in v1 | PRD puts them in R2b. **Not in R1.** |

## Notation

- **Types:**
  - `text(n)`: plain text, up to n characters.
  - `longtext`: up to 5,000 characters.
  - `int`: whole number.
  - `money`: stored as BIGINT paise, typed in ₹.
  - `date`: IST calendar date. `time`: IST.
  - `datetime`: stored in UTC, shown in IST.
  - `enum`: one of a fixed list.
  - `bool`: yes/no.
  - `ref → x`: link to one record. `refs → x`: links to many.
- **Standard columns** (`id`, `client_uuid`, `version`, `created_*`, `updated_*`, `deleted_*`) exist on every table. They are not repeated below.
- **Roles:** Owner, Partner, Family (Editor; a planner is Family with an end date), Viewer. "Money user" = someone with **Can see money** on.
- **IDs:** `US-xxx-nn` are user stories. `AC-xxx-nn` are acceptance criteria.
- "Today" always means today in IST.

---

# Part A — Cross-cutting features

## A0. Common rules (apply to every module)

| Rule | Behaviour |
|---|---|
| Lists | Server-side paging, 50 rows, with a "Load more" button. A count header ("512 families"). Search waits 300 ms after typing. |
| Offline | Banner: "No internet — you can look but not save." Last-loaded lists show read-only. Save, tick and delete are disabled. No queued writes. |
| Session expired (401) | Form stays open and its draft is kept. A login sheet opens over it. After login, the save retries once with the same `client_uuid`. |
| Deleted links | A record linked to a deleted record keeps the link. It shows the name with "(deleted)". |
| Visibility | The server filters every response by role and money flag. The UI only hides. Security lives on the server. |
| Plain words | All UI text lives in one strings file, ready for Hindi later. |

## A1. Quick Add (+ button)

**Purpose:** Add anything in 3 taps from anywhere.

**Rules:**

- A round **+** button, 64 px, bottom-right, above the bottom nav. It appears on Home, Tasks, Calendar, Guests, Money and Documents. Viewers don't see it.
- Tapping it opens a sheet showing the types allowed for that role.
- On a module screen, + opens that module's form directly. On an event, vendor or family page, + pre-fills the link to it.
- Tap count: **+** (1) → type (2) → type the name → **Save** (3). The Save button stays visible at the bottom.
- Task and Family forms also have **Save & add another**.

| Type | Shown by default | Under "More details" | Sticky defaults (kept for 30 min) |
|---|---|---|---|
| Task | Title. Due chips: Today / Tomorrow / This week / Pick date / No date. Assigned to (default: me) | Notes, priority, time, event, vendor, family, tags, checklist | — |
| Family | Name, Phone, Side, Adults (stepper, default 2), Children (default 0), Invite to (event chips) | Group, relation, area, city, address, food, Jain count, VIP, alt phone, notes | Side, Invite to, Group, Area |
| Payment (money users) | Paid to (pick a vendor or type a new name), Amount, Due date **or** "Paid already" toggle | Category, event, method, paid by, reference, notes, receipt | — |
| Expense (money users) | What for, Amount, Paid on (default today) | Category, event, method, paid by, receipt | Category |
| Document | Take photo / Choose file, Type | Title, links, private (admins), notes | — |
| Vendor | Name, Category, Phone | Contact person, alt phone, agreed amount (money users), booked, notes | — |
| Event (admins) | Name, Type, Date & time | All other event fields | — |

Sticky defaults show as pre-filled chips. They are never hidden, so the user always sees what will be saved.

| ID | Given | When | Then |
|---|---|---|---|
| AC-QA-01 | I'm on Home as Family | I tap +, Task, type "Call tent wala", tap Save | A task is created, assigned to me, no due date. "Saved" shows. 3 taps in total. |
| AC-QA-02 | I'm on the Mehndi event page | I tap + and add a task | The task's event is Mehndi. |
| AC-QA-03 | I just saved a Groom-side family invited to Reception | I tap Save & add another | The new form has Side = Groom and Reception ticked. |
| AC-QA-04 | I'm a Viewer | I open any screen | No + button. `POST` to any create endpoint returns 403. |
| AC-QA-05 | I'm Family without money access | I open the + sheet | Payment and Expense are not listed. |

## A2. Undo snackbar and bulk undo

**Purpose:** Every delete and bulk action can be reversed in one tap.

**Rules:**

- Shown after: delete, bulk delete, bulk update, import, task done, mark paid.
- Text example: "Deleted 'Book tent wala'. **UNDO**". Bulk: "Deleted 50 families. **UNDO**".
- Lasts **8 s**. The timer pauses while touched. It sits above the bottom nav and the button is ≥ 48 px. A new snackbar replaces the old one; older actions stay recoverable in Trash or History.
- Undo calls `POST /api/v1/undo/{batch_id}`.
  - The server allows it for the actor, within 10 min, so the session-expiry flow still works.
  - For each record: if the version still equals the post-action version, revert it. Otherwise skip it.
  - Message: "Undone. 2 families were changed by someone else and were left as they are."
- After 8 s, admins recover from Trash or record History.
- Undo is not shown while offline. The message says "No internet — ask Ayush or Mahi to restore it from Deleted items."

| ID | Given | When | Then |
|---|---|---|---|
| AC-UND-01 | I deleted a task | I tap Undo within 8 s | The task is back with all fields and its checklist. Version +1. Audit says "restored". |
| AC-UND-02 | I bulk-set 30 families to Coming for Mehndi, and Mummy then edited 1 of them | I tap Undo | 29 revert. 1 is skipped, with the message naming it. |
| AC-UND-03 | A snackbar is showing | I keep my finger on it for 20 s | It stays visible. It closes 8 s after I lift my finger. |
| AC-UND-04 | I deleted something 11 min ago | I call the undo API | 403. Restore is only via Trash. |

## A3. Save state and local drafts

**Purpose:** The user always knows whether their work is saved, and never loses typing.

**Rules:**

- Forms use an explicit **Save**. There is no silent server autosave, so the audit stays clean.
- **Local draft:**
  - Saved 1 s after any change, to `localStorage` under the key `draft:{user}:{form}:{recordId|new}`.
  - Stores the field values, the base version and the base values (needed for conflict merging).
  - Cleared on successful save or on Discard. Expires after 7 days. Max 50 drafts.
  - Never stores passwords. Drafts stay on that phone only.
- Reopening a form that has a draft shows a banner: "You have unsaved changes from 10:42. [Use them] [Discard]".
- Leaving a form with changes doesn't block. A toast says "Draft kept."
- On logout with drafts present: "You have 2 unsaved drafts. Log out anyway?"

| State | Shown text | Form | Cause |
|---|---|---|---|
| Saving | "Saving…" (button disabled) | Stays | Request in flight |
| Saved | "Saved ✓ 10:42" | Closes | 2xx |
| No internet | "Couldn't save. Your changes are kept on this phone. [Try again]" | Stays | Network error or 15 s timeout |
| Fix fields | "Please fix 2 things below." + inline errors | Stays | 422 |
| Conflict | Opens the conflict screen (A4) | Stays | 409 |
| Logged out | Login sheet, then auto-retry | Stays | 401 |
| Server problem | "Something went wrong on our side. Your changes are kept. [Try again]" | Stays | 5xx |

A retry reuses the same `client_uuid`, so it can never create a duplicate.

| ID | Given | When | Then |
|---|---|---|---|
| AC-SAV-01 | I typed a family's details and closed the app | I reopen the form | The draft banner shows. [Use them] restores every field. |
| AC-SAV-02 | Airplane mode is on | I tap Save | "Couldn't save. Your changes are kept on this phone." shows. Nothing is sent. The form keeps my text. |
| AC-SAV-03 | The first save timed out but reached the server | I tap Try again | Only one record exists. The server returned the original record. |
| AC-SAV-04 | A save succeeds | — | The draft is deleted. "Saved ✓ HH:MM" is shown in IST. |
| AC-SAV-05 | "Saved" is showing | — | The server has confirmed it. "Saved" is never shown before a 2xx. |

## A4. Conflict resolution screen

**Purpose:** When two people edit the same record, nobody's change is silently lost.

**Rules:**

- The server returns 409 with the current record, its version, who changed it and when.
- The client does a **3-way merge** of base (what I loaded), mine and theirs:
  - A field changed only by me keeps my value.
  - A field changed only by them keeps their value.
  - A field changed by both to the same value keeps that value.
  - A field changed by both to different values is listed for me to choose.
- Screen header: "**Papa changed this family at 10:42 while you were editing.**"
- One row per conflicting field: **Field | Yours | Papa's**, each with a large radio button.
- Long text fields add a third option, **Keep both** (joined on a new line).
- A collapsed line shows "2 fields merged automatically" and can be expanded.
- Buttons: **[Save my choices]** and **[Keep Papa's, discard mine]**.
- Save sends the merged values with the new version. If another 409 comes back, the screen repeats.
- **If the record was deleted by someone else:**
  - Admins see "Deleted by Papa at 10:42. [Restore and save mine] [Discard]".
  - Family see "Ask Ayush or Mahi to restore it. Your changes are kept as a draft."
- **Inline controls** (RSVP chip, task tick, mark paid): if the same field changed, a small dialog asks "Mummy already set **Coming**. Change to **Not coming**?" [Yes] [No].
- Money fields appear only to money users. Only they can edit money, so this is consistent.

| ID | Given | When | Then |
|---|---|---|---|
| AC-CON-01 | Mummy and I both open a family at version 3. She changes the phone and saves. | I change the city and save | Saved automatically. No conflict screen. Result has her phone and my city, at version 5. |
| AC-CON-02 | Same start. She sets adults to 4. | I set adults to 5 and save | The conflict screen shows Adults: Yours 5 / Mummy's 4. Nothing is saved until I choose. |
| AC-CON-03 | Both of us edited notes | I pick Keep both | Notes contain both texts. Audit records the merge. |
| AC-CON-04 | Papa deleted the task while I edited it (I'm Family) | I save | The deleted message shows. My draft is kept. Nothing is restored. |

## A5. Activity feed and record History

**Purpose:** Show who changed what, and when.

**`audit_log` fields:**

| Field | Type | Notes |
|---|---|---|
| at | datetime | Server time, UTC |
| user_id | ref → users | Null for system jobs |
| action | enum | create, update, delete, restore, undo, import, export, login, login_failed, logout, password_reset, role_change |
| entity_type, entity_id | text, int | e.g. `household`, 42 |
| batch_id | text(36) | Groups bulk/import/delete actions |
| changes | JSON | `{field: [old, new]}`. Passwords are never logged. |
| ip, device | text | Short user-agent label, e.g. "iPhone · installed" |

**Rules:**

- The audit row is written in the **same DB transaction** as the change.
- The log is append-only. App code has no update or delete path for it.
- A DB trigger rejects `UPDATE`/`DELETE` on `audit_log`. If Hostinger blocks triggers, the code-only rule applies and nightly backups are the safety net. I'll verify this on the server.
- **History** on every record page reads as plain sentences: "Mummy changed RSVP for Mehndi from Waiting to Coming · 12 Oct, 6:40 PM".
  - Visible to anyone who can see the record.
  - Money fields are hidden from non-money users.
- **Activity feed** (admins only) is under Settings → Activity.
  - Filters: person, type, date. 50 per page.
  - Home shows the last 10.

| ID | Given | When | Then |
|---|---|---|---|
| AC-ACT-01 | Mummy changes a family's RSVP | Anyone who can see the family opens History | The line shows her name, the old and new values, and the IST time. |
| AC-ACT-02 | A money user edits a payment amount | A non-money user opens the vendor's History | No amount appears. |
| AC-ACT-03 | A DB save fails | — | No audit row exists (same transaction). |
| AC-ACT-04 | Family user | Calls `GET /api/v1/activity` | 403 |

## A6. Full export

Fully specified in **B8 Export**.

## A7. WhatsApp share links

**Purpose:** Send RSVP reminders, event details and vendor messages with no API and no cost.

**Rules:**

- Link format: `https://wa.me/<digits, no +>?text=<url-encoded>`. With no number: `https://wa.me/?text=…`, which opens the WhatsApp chat picker.
- Each template comes in **English** and **Hinglish**. The user picks once, and the choice is remembered.
- The sender's name comes from the logged-in user.
- R1 templates are not editable in the app. The user can edit the text in WhatsApp before sending.

| Template | Where | Text (English version) |
|---|---|---|
| RSVP reminder | Family page, per event; bulk stepper | "Namaste {name} ji, we'd love you to join Ayush & Mahi's {events} on {dates} at {venue}. Please reply with how many will come. – {sender}" |
| Event details | Event page | "{event} · {date}, {time} IST · {venue} · {map link}" |
| Vendor message | Vendor page | "Namaste {contact}, this is {sender} for Ayush & Mahi's wedding, about {event} on {date}: " |
| Task to assignee | Task page | "{task} — due {date}. Please update it in the wedding app." |

- **Reminders one by one:** from a filtered guest list (e.g. Reception + Waiting), "Send reminders one by one" opens a stepper: family card → [Open WhatsApp] → [Next].
  - Its position is saved locally, because iOS may reload the app when you return from WhatsApp.
- Tapping a WhatsApp button records `last_reminder_opened_at` and a History line "WhatsApp opened". It never marks a message as **sent**, because the app can't know that.
- If there is no phone, or only a landline, the button is disabled with "Add a mobile number".

| ID | Given | When | Then |
|---|---|---|---|
| AC-WA-01 | Family with +919829012345 invited to Mehndi | I tap RSVP reminder on iPhone and on Android | WhatsApp opens to that chat with the filled text. |
| AC-WA-02 | A filtered list of 40 Waiting families | I use the stepper and return from WhatsApp each time | The next family shows. Position survives an app reload. |
| AC-WA-03 | A family with no phone | — | The button is disabled with the hint. |
| AC-WA-04 | Text contains "&" and Hindi characters | The link opens | The text arrives intact (correct URL encoding). |

## A8. Guest import (Excel, CSV, pasted text, contacts file)

**Purpose:** Get existing lists in fast, without duplicates.

**Inputs (all work on iPhone and Android):**

| Input | How the user gets it |
|---|---|
| **Excel (.xlsx)** — main route | Fill the in-app template (below), or any sheet with a header row. Read on the phone with `read-excel-file` (MIT); no server library. |
| CSV | Excel → Save as CSV; Google Sheets → Download → CSV |
| Pasted text | One family per line. Name and number in any order, separated by comma, tab or space |
| `.vcf` contacts file | iPhone: Contacts → select → Share. Android: Contacts → Share / Export |

**Template (Guests → Import a list → Download template):**

- A static file, `AM_Guest_List_Template.xlsx`, shipped in `/public/templates/` and precached for offline.
- Sheets: **Read me** (plain-English steps), **Guests** (the list), **Summary** (live counts of families and people, per side and per function).
- Guests columns, in order: Family name\*, Phone, Other phone, Side\* (dropdown), Group, Relation (suggestions), Area, City, Address, Adults, Children, Food (dropdown), Jain people, Important (Yes/No), one **Yes/No column per function** (Engagement, Haldi, Mehndi, Sangeet, Mayra, Wedding, Reception), Notes.
- Phone columns are formatted as text, so Excel keeps leading zeros and doesn't turn numbers into 9.83E+09.
- Row 2 is an example. **Any row whose name starts with "EXAMPLE" is skipped** on import.
- If event names change in Settings, the template is regenerated on the server from the same layout (R1: the static file matches the 7 seeded events).

**Steps:**

1. **Source.** Upload a file (.xlsx, .csv, .vcf) or paste text. Max 3,000 rows and 5 MB. For .xlsx, the "Guests" sheet is used if present, otherwise the first sheet.
2. **Defaults.** Side for rows without one. "Invite everyone to:" event chips (added to any per-row Yes columns). Default city.
3. **Map columns.** Auto-detected from header words: Name/Naam/Family name, Phone/Mobile/Number, Other phone, Side, Group, Relation, City/Shehar, Area, Address, Adults, Children/Bacche, Food, Jain people, Important, Notes, and any column named after an event (Yes/Y/Haan = invited). Side words are mapped too:
   - Bride: bride, ladki, ladkiwale, mahi, jagetiya
   - Groom: groom, ladka, ladkewale, ayush, porwal
4. **Preview.** Counts: "480 new · 12 possible duplicates · 3 errors".
   - Errors (no name, bad phone) can be fixed inline or are skipped.
   - Duplicates (same phone as an existing family or another row; or same name + city) each get a choice: **Skip** (default), **Add anyway**, or **Update existing**. Update existing only fills empty fields and never overwrites.
5. **Import.** One DB transaction, one `batch_id`. An 8 s Undo snackbar shows.
   - Admins also get **Undo this import** under Settings → Imports.
   - Records edited after the import are kept, and are listed when undoing.

**Parsing:** a 10-digit mobile number anywhere in a line is taken as the phone. The rest of the line is the name.

| ID | Given | When | Then |
|---|---|---|---|
| AC-IMP-01 | A CSV with 500 rows, 10 of whose phones already exist | I import with defaults | The preview shows 490 new and 10 duplicates set to Skip. After import, 490 families exist. |
| AC-IMP-02 | Pasted line "Ramesh Sharma 98290 12345" | Preview | Name "Ramesh Sharma", phone +919829012345. |
| AC-IMP-03 | Two rows in the same file with the same phone | Preview | Both are flagged as possible duplicates. |
| AC-IMP-04 | Update existing chosen; the existing family has a city but no area | Import | Area is filled. City is unchanged. |
| AC-IMP-05 | Import just finished | I tap Undo | All imported families and their invitations are soft-deleted. Updated families revert. |
| AC-IMP-06 | A `.vcf` with 20 contacts shared from an iPhone | Import | 20 rows appear with names and numbers. |
| AC-IMP-07 | The template with the EXAMPLE row plus 50 filled rows | Import the .xlsx on iPhone and on Android | 50 families. The EXAMPLE row is skipped. Columns map with no manual step. |
| AC-IMP-08 | A row with Mehndi = Yes and Reception = Yes | Import | That family is invited to exactly Mehndi and Reception (plus any "Invite everyone to" events). |
| AC-IMP-09 | Phone stored in Excel as the number 9829012345 | Import | Read as +919829012345 (numbers are converted to text before validation). |
| AC-IMP-10 | Guests screen | Tap Download template | The .xlsx downloads (Android: Downloads; iPhone: Files save sheet) and opens in Excel and Google Sheets with dropdowns working. |

## A9. Indian formats

| Item | Rule | Examples |
|---|---|---|
| Money display | `Intl.NumberFormat('en-IN')`, ₹, no paise in the UI unless non-zero | ₹1,25,000 · ₹1,250.50 |
| Money compact (cards) | ≥ 1 lakh → L; ≥ 1 crore → Cr | ₹1.25 L · ₹2.4 Cr |
| Money input | Accepts digits with or without commas; suffixes L / lakh / lac, Cr / crore, k; up to 2 decimals; no negatives | "1.25 lakh" → ₹1,25,000 |
| Mobile (+91) | Strip spaces, dashes and brackets. Drop a leading +91, a leading 91 (if 12 digits) or a leading 0. The result must be 10 digits starting with 6–9. | "098290-12345" → +919829012345 |
| International | Starts with + and isn't +91: 8–15 digits | +971501234567 |
| Landline | 10 digits after removing a leading 0, not starting 6–9. Accepted with the warning "Landline — WhatsApp won't work". | 01482 230456 |
| Phone display | Grouped | +91 98290 12345 |
| Dates / times | IST, 12-hour clock | Sat, 14 Feb 2027 · 6:00 PM |
| Names | Devanagari allowed. Duplicate matching ignores case, "ji", "family" and "&". | "राम शर्मा" |
| Side | Labels come from Settings | "Mahi's side (Jagetiya)" · "Ayush's side (Porwal)" · "Both" |
| Relations (suggested) | Free text, with suggestions | Mama, Mami, Bua, Fufa, Mausi, Mausa, Chacha, Chachi, Tau, Tai, Nana-Nani, Dada-Dadi, Bhai, Behen, Friend, Office, Neighbour, Samaj, Other |
| Food | Veg, Jain (no onion/garlic/root veg), Non-veg, Mixed (+ Jain count) | — |
| Counts | en-IN grouping | 1,804 · 1,00,000 |

| ID | Given | When | Then |
|---|---|---|---|
| AC-IND-01 | Amount input "1.25L" | Save | Stored as 12500000 paise. Shown as ₹1,25,000. |
| AC-IND-02 | Phone "12345" | Save | Error: "Enter a 10-digit mobile number." |
| AC-IND-03 | Phone "+91 98290 12345" and "9829012345" | Compared | Treated as the same number. |
| AC-IND-04 | Device timezone is Dubai | View a 6:00 PM IST event | Shows "6:00 PM IST". |

---

# Part B — Release 1 modules

## B1. Auth & members

**Purpose:** Only invited people can log in, and each person gets the right access.

**User stories**

- **US-AUTH-01** As Owner, I want to add a family member with their phone and role, so that they can log in without signing up.
- **US-AUTH-02** As a family member, I want to log in with my phone number and a password, so that I don't need email.
- **US-AUTH-03** As any user, I want to stay logged in for 90 days, so that I don't have to remember my password.
- **US-AUTH-04** As an admin, I want to reset a password and share it on WhatsApp, so that a forgotten password takes a minute to fix.
- **US-AUTH-05** As an admin, I want to switch off a member or give them an end date, so that access stops when it should (e.g. a planner).
- **US-AUTH-06** As an admin, I want to turn "Can see money" on or off per person, so that the budget stays private.
- **US-AUTH-07** As any user, I want to change my own password and log out of all my phones, so that a lost phone isn't a risk.

**Fields — `users`**

| Name | Type | Req? | Default | Validation | Example |
|---|---|---|---|---|---|
| name | text(80) | Yes | — | 1–80 chars | Sunita Porwal |
| phone | text(16) | Yes | — | A9 mobile or international; unique among active users | +919829012345 |
| role | enum owner/partner/family/viewer | Yes | family | Exactly one owner | family |
| can_see_money | bool | Yes | On for owner/partner, off for others | Always on for owner/partner | false |
| password | (hash only) | Yes | — | Min 6 chars. Not the phone number. Not in a top-100 common list. | — |
| is_active | bool | Yes | true | Owner always true | true |
| access_ends_on | date | No | null | ≥ today | 2027-02-20 |
| last_seen_at | datetime | Auto | — | — | — |

The `sessions` table holds: token hash, user, created, last used, expires, and a device label.

**Behaviours and rules**

- There is no sign-up. The login screen has Phone, Password (with a Show toggle) and a large **Log in** button.
- **Session cookie:** HttpOnly, Secure, SameSite=Lax. It lasts 90 days, extended on each use.
- **CSRF:** every write must carry the token header from `GET /api/v1/session`.
- **Login errors:**
  - Wrong phone and wrong password give the same message: "Phone or password is wrong."
  - 5 failures for one phone within 15 min lock that phone for 15 min. 20 failures per IP within 15 min lock that IP.
  - Lock message: "Too many tries. Wait 15 minutes or ask Ayush or Mahi to reset your password."
- **Password reset (admin):**
  - The admin types a new password, or taps **Make one** to get an easy one (e.g. `rose-4821`).
  - The password is shown once, with **Share on WhatsApp**.
  - All of that user's sessions are revoked.
- **Deactivate or past `access_ends_on`:** sessions are revoked on their next request. Their records stay, and their name shows "(left)".
- **Members are never deleted.** They are only deactivated, so history stays readable.
- **Role and money changes** take effect on the user's next request.
- There must always be ≥ 1 active admin. The Owner can't be demoted or deactivated.
- **iPhone:** the Home Screen app has separate storage, so the user logs in once more after installing. The Install Guide says this.

**Links:** users are task assignees, the "added by" on every record, document uploaders, and audit actors.

**Permissions**

| | View members | Add | Edit | Deactivate | Reset password |
|---|---|---|---|---|---|
| Owner | ✓ | ✓ | ✓ | ✓ (not self) | ✓ |
| Partner | ✓ | ✓ | ✓ (not Owner's role) | ✓ (not Owner) | ✓ |
| Family | Names + phones | ✗ | Own name/password only | ✗ | ✗ |
| Viewer | Names + phones | ✗ | Own name/password only | ✗ | ✗ |

**Edge cases**

| Case | Behaviour |
|---|---|
| Empty (first run) | A one-time setup page, protected by a setup token in `.env`, creates the Owner. It is disabled after first use. Then the Settings wizard runs (B10). |
| Long list | ≤ 30 members expected. No paging. |
| Duplicate | Same phone as an active member is blocked: "Already a member: Sunita Porwal." |
| Two editing at once | A4 conflict screen. |
| Offline | Log in is disabled: "No internet." |
| Session expired mid-form | A0: the login sheet opens over the form. |
| Deleting linked | Not possible. Deactivate only. |

**Acceptance criteria**

| ID | Given | When | Then |
|---|---|---|---|
| AC-AUTH-01 | An admin added "Sunita, 98290 12345, Family" | Sunita logs in with that phone and password | She sees Home, with no Money tab. |
| AC-AUTH-02 | 5 wrong passwords for one phone within 15 min | A 6th try with the right password | Refused with the lock message until 15 min pass. |
| AC-AUTH-03 | Logged in 89 days ago, used yesterday | Opens the app today | Still logged in. |
| AC-AUTH-04 | An admin reset Papa's password | Papa's old session makes a request | 401, and the login screen shows. |
| AC-AUTH-05 | Planner with `access_ends_on` = 20 Feb 2027 | Opens the app on 21 Feb IST | Logged out. Login refused. |
| AC-AUTH-06 | Money off for Mummy | She calls `GET /api/v1/payments` | 403 |
| AC-AUTH-07 | Partner is logged in | Tries to demote or deactivate the Owner | No button shows. The API returns 403. |
| AC-AUTH-08 | Phone typed "098290-12345" | Saved | Stored as +919829012345. |
| AC-AUTH-09 | Any write request without the CSRF header | Sent | 403 |

---

## B2. Dashboard (Home)

**Purpose:** One screen showing what needs attention today.

**User stories**

- **US-DASH-01** As Partner, I want overdue and today's tasks first, so that nothing slips.
- **US-DASH-02** As a family member, I want my own tasks at the top, so that I know what I must do.
- **US-DASH-03** As a money user, I want payments due in the next 14 days and the budget summary, so that I can arrange money.
- **US-DASH-04** As Owner, I want the headcount per event, so that I can answer the caterer.
- **US-DASH-05** As Owner, I want to see the last backup and restore drill, so that I know data is safe.
- **US-DASH-06** As a Viewer, I want the countdown and the next event, so that I know what's coming.

**Cards (no stored fields; computed live)**

| # | Card | Content | Visible to |
|---|---|---|---|
| 1 | Countdown | "129 days to the wedding". From 14 Feb: "Day 1 of 3". Hidden after 16 Feb. Next event name, date, time and venue (tap to open). | All |
| 2 | My tasks | My overdue tasks (red), then due today. If none, the next 3 upcoming. Tick to mark done. | Owner, Partner, Family |
| 3 | Everyone's overdue | "7 overdue tasks" → Tasks · Overdue | Owner, Partner, Family |
| 4 | Payments due | Due within 14 days and overdue: vendor, amount, date. Total. | Money users |
| 5 | Headcount | Per guest event: Coming (people), Waiting, Not asked, Jain. Tap → filtered guest list. | All |
| 6 | Budget | Planned, Spent, Still to pay, Free, with a bar | Money users |
| 7 | Safety | Last backup (red if > 26 h). Last restore drill (amber if > 35 days). Items in Trash. | Owner, Partner |
| 8 | Recent activity | Last 10 changes | Owner, Partner |

**Behaviours and rules**

- One call, `GET /api/v1/dashboard`, returns only the cards this user may see.
- Refreshes when the app comes to the front and on pull-to-refresh. Shows "Updated 10:42".
- Each card shows max 5 items, then "See all 23".
- Deleted records are excluded from every count.
- Loads in < 2 s on Slow 4G with 2,000 families and 1,000 tasks.

**Links:** every item deep-links to its record or filtered list.

**Permissions:** read-only for all, per the card table. Ticking a task follows Task permissions.

**Edge cases**

| Case | Behaviour |
|---|---|
| Empty | A "Start here" checklist: set event dates, add family members, import guests, add the first payment. Each item links to its screen. |
| Long lists | Capped at 5 per card, plus "See all". |
| Duplicate | Not applicable. Each family counts once per event. |
| Two editing | Ticking a task someone just completed shows "Already done by Papa". |
| Offline | Cached dashboard, with "Offline — showing 10:42 data". Ticks disabled. |
| Session expired | A0 |
| Deleted linked | Excluded from counts. |

**Acceptance criteria**

| ID | Given | When | Then |
|---|---|---|---|
| AC-DASH-01 | Today is 8 Oct 2026 IST, wedding start 14 Feb 2027 | Open Home | "129 days to the wedding" |
| AC-DASH-02 | Mummy has a task due yesterday (To do) and one due today | She opens Home | The overdue task shows first, in red, then today's. |
| AC-DASH-03 | Mummy has no money access | Opens Home | No Payments or Budget card, and the API response doesn't contain them. |
| AC-DASH-04 | Mehndi: Family A Coming 2+1, Family B Coming 4+0, Family C Waiting 3+0 | Admin opens Home | Mehndi: Coming 7 · Waiting 3 · Not asked 0 |
| AC-DASH-05 | Last backup finished 27 h ago | Admin opens Home | Red: "Last backup 27 hours ago" |
| AC-DASH-06 | Seeded 2,000 families and 1,000 tasks | Open Home on Slow 4G | Loads in < 2 s |
| AC-DASH-07 | Home loaded at 10:42, then the phone goes offline | Reopen | Cached data with the offline banner |

---

## B3. Tasks

**Purpose:** Track every job, who does it, and by when.

**User stories**

- **US-TASK-01** As Owner, Partner or Family, I want to add a task in 3 taps, so that I capture it before I forget.
- **US-TASK-02** As Partner, I want to assign a task to one or more people, so that ownership is clear.
- **US-TASK-03** As a family member, I want My tasks for today, this week and overdue, so that I know what to do.
- **US-TASK-04** As anyone who edits, I want to postpone a task and keep its history, so that we see what keeps slipping.
- **US-TASK-05** As anyone who edits, I want a checklist inside a task (e.g. items to buy), so that we don't need a shopping module.
- **US-TASK-06** As Owner, I want to tag tasks (Shopping, Outfit, Jewelry…) and filter by tag or event, so that related work is grouped.
- **US-TASK-07** As anyone who edits, I want to send a task to its assignee on WhatsApp, so that elders who rarely open the app still get it.

**Fields — `tasks`**

| Name | Type | Req? | Default | Validation | Example |
|---|---|---|---|---|---|
| title | text(200) | Yes | — | 1–200 chars | Book tent wala for Mehndi |
| notes | longtext | No | — | ≤ 5,000 | Ask for 2 quotes |
| status | enum todo/doing/waiting/done/cancelled | Yes | todo | — | waiting |
| priority | enum urgent/normal/low | Yes | normal | — | urgent |
| due_date | date | No | null | Any date | 2026-10-20 |
| due_time | time | No | null | Requires due_date | 18:00 |
| assignees | refs → users | No | [creator] | Active users, max 10 | [Papa, Mummy] |
| event_id | ref → events | No | Context | Active event | Mehndi |
| vendor_id | ref → vendors | No | null | Active vendor | Shree Tent House |
| household_id | ref → households | No | null | Active family | Sharma family |
| tags | refs → tags | No | [] | Max 10. Tag name 1–30 chars, unique. | Shopping |
| completed_at / completed_by | datetime / ref | Auto | — | Set on Done, cleared on reopen | — |
| postpone_count | int | Auto | 0 | — | 2 |

**Fields — `task_items` (checklist):** text text(200), required · is_done bool, false · sort int.

**Behaviours and rules**

- **Overdue:** status is To do, Doing or Waiting, **and** either:
  - no `due_time` and `due_date` < today, or
  - `due_date` + `due_time` (IST) < now.
- **Due today:** `due_date` = today, and not Done or Cancelled.
- **Postpone:** a sheet offers Tomorrow / Next Monday / Pick date.
  - A later date makes `postpone_count` +1. History says "Postponed from 12 Oct to 19 Oct by Mummy".
  - An earlier date is a normal edit, not a postpone. Status doesn't change.
- **Done:** tap the circle. Status becomes Done and `completed_*` is set. The Undo snackbar shows.
  - Any assignee can mark it done.
  - Ticking the last checklist item asks "Mark the task done too?"
- **Cancelled** tasks are hidden from default views. They show under "Done & cancelled".
- **Default sort:** overdue first, then due date (no date last), then priority (Urgent first), then newest.
- **Views (chips):** My tasks (default for Family), All (default for admins), Today, This week (Mon–Sun IST), Overdue, No date, Done & cancelled.
- **Filters:** event, tag, assignee, priority. **Search:** title.
- **Seeded tags:** Shopping, Outfit, Jewelry, Gifts, Decor, Food, Travel, Bride, Groom. New tags can be created inline.
- No reminders in R1. Those arrive in R2a. Until then the dashboard shows overdue and today's tasks.

**Links:** the calendar (tasks with a due date), event page Tasks tab, vendor page, family page, dashboard, WhatsApp.

**Permissions**

| | View | Add | Edit | Delete (soft) |
|---|---|---|---|---|
| Owner, Partner | ✓ | ✓ | ✓ | ✓ |
| Family | ✓ | ✓ | ✓ | ✓ (any; undo + trash protect) |
| Viewer | ✓ | ✗ | ✗ | ✗ |

Only admins can delete or rename tags.

**Edge cases**

| Case | Behaviour |
|---|---|
| Empty | "No tasks yet. Tap + to add your first task." My tasks empty: "Nothing for you today." |
| 500+ tasks | Paged 50 at a time. Chip counts come from the server. |
| Duplicate | An open task with the same title (ignoring case) exists → hint "A similar task exists: Book tent wala" [Open] [Add anyway]. |
| Two editing | A4. Marking done is idempotent: if already Done, show "Already done by Papa". |
| Offline | Ticks and save disabled. Draft kept. |
| Session expired | A0 |
| Deleting linked | Deleting a task deletes its checklist in the same batch. A task linked to a deleted event, vendor or family shows "(deleted)". |

**Acceptance criteria**

| ID | Given | When | Then |
|---|---|---|---|
| AC-TASK-01 | On Tasks | +, type title, Save | Created in 3 taps, assigned to me |
| AC-TASK-02 | Task due 10 Oct, no time, status Waiting | Viewed 10 Oct IST / 11 Oct IST | 10 Oct: in Today, not Overdue. 11 Oct: in Overdue. |
| AC-TASK-03 | Task due 10 Oct 6:00 PM | At 6:01 PM IST on 10 Oct | Overdue |
| AC-TASK-04 | Task due 12 Oct | Postponed to 19 Oct | `postpone_count` = 1. History line shown. Appears on 19 Oct in the calendar. |
| AC-TASK-05 | Task due 19 Oct | Moved to 15 Oct | `postpone_count` unchanged |
| AC-TASK-06 | Task Done, due date in the past | Overdue view | Not listed |
| AC-TASK-07 | Mummy is an assignee | She ticks it done | Done, completed_by = Mummy. Undo returns the previous status. |
| AC-TASK-08 | Viewer | Opens Tasks | No + and no tick circles. `POST /tasks` returns 403. |
| AC-TASK-09 | 5 tasks, 2 tagged Shopping | Filter by Shopping | Exactly 2 shown |
| AC-TASK-10 | Task with 3 checklist items | Delete, then Undo | Task and all 3 items restored |

---

## B4. Calendar & Events

**Purpose:** Put every function, deadline and payment on one IST timeline.

**User stories**

- **US-EVT-01** As Owner, I want the 7 functions pre-created, so that I only add dates and venues.
- **US-EVT-02** As anyone, I want an agenda list grouped by day, so that I see what's coming.
- **US-EVT-03** As anyone, I want a month view with dots, so that I spot busy days.
- **US-EVT-04** As anyone, I want an event page with time, map, tasks, invited families and headcount, so that each function has one home.
- **US-EVT-05** As anyone, I want to share event details on WhatsApp, so that relatives get the right time and place.
- **US-EVT-06** As Owner, I want custom events (Bhaat nyotna, Ganesh puja, makeup trial), so that smaller dates are tracked too.

**Fields — `events`**

| Name | Type | Req? | Default | Validation | Example |
|---|---|---|---|---|---|
| name | text(80) | Yes | — | 1–80 chars | Mehndi |
| type | enum engagement/roka/haldi/mehndi/sangeet/mayra/wedding/reception/other | Yes | other | — | mehndi |
| side | enum bride/groom/both | Yes | both | — | both |
| guests_invited | bool | Yes | true for the 7 seeded, false for custom | Controls guest invitations and headcount | true |
| start_at | datetime | No | null ("Date not set") | — | 2027-02-14 18:00 IST |
| end_at | datetime | No | null | > start_at | 2027-02-14 23:00 IST |
| all_day | bool | No | false | — | false |
| venue_name | text(120) | No | — | — | Sukhadia Bhawan |
| venue_address | text(300) | No | — | — | Bhilwara |
| map_url | text(500) | No | — | Must start `https://` | maps link |
| dress_code | text(120) | No | — | — | Yellow |
| notes | longtext | No | — | ≤ 5,000 | — |

**Seed:** Engagement, Haldi, Mehndi, Sangeet, Mayra, Wedding, Reception. All have "Date not set" and `guests_invited` = true.

**Behaviours and rules**

- **Calendar items:**
  - Events.
  - Tasks with a due date that aren't Done or Cancelled.
  - Payments with status Due and a due date (money users only).
- Each item type has its own colour, icon **and** text label. Colour is never the only signal.
- **Agenda (default view):** from today forward, grouped by day ("Sat, 14 Feb"). Loads 60 days at a time. [Show past] reveals earlier days. "Date not set" events are listed at the top.
- **Month view:** each day shows up to 3 dots plus "+n". Tapping a day shows its agenda below the grid.
- **Filters:** Events / Tasks / Payments toggles, and "Only mine".
- **Event page tabs:** Details · Tasks · Guests (invited families, RSVP summary, headcount) · Money (money users) · Documents.
- All times show in IST. "IST" is added to labels when the device timezone isn't IST.
- Overlapping events are allowed.

**Links:** tasks, payments, documents and invitations (`household_events`) all reference `event_id`.

**Permissions**

| | View | Add | Edit | Delete (soft) |
|---|---|---|---|---|
| Owner, Partner | ✓ | ✓ | ✓ | ✓ |
| Family | ✓ | ✗ | ✗ | ✗ |
| Viewer | ✓ | ✗ | ✗ | ✗ |

Calendar items follow their own module's visibility rules.

**Edge cases**

| Case | Behaviour |
|---|---|
| Empty | Seeded events exist. A month with no items: "Nothing planned this month." |
| Long lists | Agenda pages by 60 days. |
| Duplicate | Same type on the same date → warning, Save allowed (e.g. Mayra on each side). |
| Two editing | A4 |
| Offline | Last-loaded agenda, read-only. |
| Session expired | A0 |
| Deleting linked | A dialog lists counts: "12 tasks, 340 invited families, 3 payments. They will stay but lose this event. You can restore it from Deleted items." Invitations are soft-deleted in the same batch. Tasks, payments and documents keep the link, labelled "(deleted event)". Restore brings the invitations back. |

**Acceptance criteria**

| ID | Given | When | Then |
|---|---|---|---|
| AC-EVT-01 | Fresh install | Open Calendar | 7 events under "Date not set" |
| AC-EVT-02 | Mehndi at 14 Feb 2027 6:00 PM IST | Viewed on a phone set to Dubai time | Shows "6:00 PM IST" |
| AC-EVT-03 | A task and a payment both due 20 Oct | Money user / non-money user view the agenda | Money user: both under "Tue, 20 Oct". Non-money user: the task only. |
| AC-EVT-04 | 5 items on 20 Oct | Month view | 3 dots and "+2" |
| AC-EVT-05 | Family user | Opens Mehndi | No Edit button. `PUT` returns 403. |
| AC-EVT-06 | Event with linked items | Delete, then Undo | The dialog shows correct counts. After Undo, all invitations are back. |
| AC-EVT-07 | Mehndi with venue and map | Share on WhatsApp | Text contains the name, "14 Feb 2027, 6:00 PM IST", the venue and the map link. |
| AC-EVT-08 | End before start | Save | "End time must be after the start time." |

---

## B5. Guests & RSVP

**Purpose:** One clean list of invited families, and who is coming to which function.

**User stories**

- **US-GST-01** As a parent, I want to add a family (name, phone, side, people) in under 30 s, so that list-building isn't a chore.
- **US-GST-02** As Owner, I want to import our existing list with duplicates caught, so that we start with clean data.
- **US-GST-03** As anyone, I want to know a family is already listed before adding, so that we don't send two cards.
- **US-GST-04** As a family member, I want to tick which functions a family is invited to, so that Mayra and Haldi stay close-family.
- **US-GST-05** As a family member, I want to record the RSVP per function after a phone call, so that the headcount is real.
- **US-GST-06** As a family member, I want a one-tap WhatsApp RSVP reminder, so that chasing is quick.
- **US-GST-07** As Owner, I want to filter by side, function, RSVP, group and area with totals, so that I can answer any count question.
- **US-GST-08** As Owner, I want to select many families and invite them to an event at once, so that Reception isn't 500 taps.
- **US-GST-09** As the person dealing with the halwai, I want Jain and Veg counts per function, so that food is planned right.

**Fields — `households` (UI: "Family")**

| Name | Type | Req? | Default | Validation | Example |
|---|---|---|---|---|---|
| name | text(120) | Yes | — | 1–120 chars | Ramesh Sharma & family |
| phone | text(16) | No | — | A9 | +919829012345 |
| alt_phone | text(16) | No | — | A9 | — |
| side | enum bride/groom/both | Yes | Sticky (last used) | — | groom |
| group_name | text(80) | No | — | Autocomplete from existing | Nanihal (Mama ji) |
| relation | text(40) | No | — | Suggestions (A9) | Mama |
| area | text(80) | No | Sticky | Autocomplete | Shastri Nagar |
| city | text(60) | No | Bhilwara (Settings) | — | Bhilwara |
| address | text(300) | No | — | — | — |
| adults | int | Yes | 2 | 0–50 | 3 |
| children | int | Yes | 0 | 0–50; adults + children ≥ 1 | 1 |
| food | enum veg/jain/nonveg/mixed | Yes | veg | — | mixed |
| jain_count | int | No | 0 | Shown only if Mixed; ≤ adults + children. If food = Jain, it equals the total. | 2 |
| is_vip | bool | No | false | Label: "Important" | true |
| notes | longtext | No | — | ≤ 5,000 | — |

**Fields — `household_events` (invitation + RSVP)**

| Name | Type | Req? | Default | Validation | Example |
|---|---|---|---|---|---|
| household_id, event_id | ref | Yes | — | Unique pair. Event must have `guests_invited` = true. | — |
| rsvp | enum not_asked/waiting/coming/not_coming | Yes | not_asked | UI: Not asked yet / Waiting / Coming / Not coming | coming |
| expected_adults | int | No | null (uses the family's) | 0–50 | 2 |
| expected_children | int | No | null | 0–50 | 0 |
| rsvp_note | text(200) | No | — | — | Arriving late |
| rsvp_updated_by / _at | ref / datetime | Auto | — | — | — |
| last_reminder_opened_at | datetime | Auto | — | Set by the WhatsApp tap | — |

**Behaviours and rules**

- **People for an invitation** = `expected_adults ?? adults` + `expected_children ?? children`.
- **Headcount per event:**
  - Coming = Σ people where RSVP is Coming.
  - "Up to" = Coming + Waiting.
  - Not coming counts 0.
- **Jain per event** = Σ over Coming families: the full total if food = Jain, `jain_count` if Mixed.
- Changing a family's adults or children updates every event where the expected values are null.
- **Duplicate check** runs on add, on phone edit, on import and on restore.
  - Same normalised phone or alt phone as another active family → a modal: "Already on the list: Ramesh Sharma & family (Groom side, added by Papa)" [Open that family] [Add anyway].
  - Same normalised name + city → an inline hint only.
  - A "Possible duplicates" filter lists families that share a phone.
- **List:**
  - Server search on name, phone digits, group and area.
  - Filter chips: side, event, RSVP, group, area, Important, food, "No phone", "Possible duplicates". Filters are remembered per user.
  - Header: "512 families · 1,804 people" (for the current filter).
  - "Both" side families appear under both side filters.
- **Bulk actions:**
  - Select rows, or "Select all 260 filtered" (applied on the server by filter, not by loaded rows).
  - Actions: Invite to event, Remove from event, Set RSVP for event, Change side, Delete.
  - Max 2,000 per action. One `batch_id`, with an Undo snackbar.
  - Bulk invite skips existing invitations and never changes their RSVP.
- Removing an invitation uses Undo, not a confirm dialog.
- Import follows A8. WhatsApp follows A7.

**Links:** events (invitations, headcount), tasks (`household_id`), dashboard headcount, WhatsApp. Later: R2a card tracking, R2b rooms.

**Permissions**

| | View | Add | Edit / RSVP | Delete (soft) | Import / Bulk | Export CSV |
|---|---|---|---|---|---|---|
| Owner, Partner | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Family | ✓ | ✓ | ✓ | ✓ | ✓ (pending Q10) | ✗ |
| Viewer | ✓ (incl. phones, to call) | ✗ | ✗ | ✗ | ✗ | ✗ |

**Edge cases**

| Case | Behaviour |
|---|---|
| Empty | "No families yet." [Add a family] [Import a list] |
| 500–2,000 families | Paged 50 at a time. First page < 1.5 s and search < 1 s on Slow 4G. Totals and "select all filtered" are computed on the server. |
| Duplicate | Phone-match modal, name-match hint, Possible duplicates filter, and import preview (A8). |
| Two editing | A4. RSVP chips use the inline conflict dialog. |
| Offline | Cached list, read-only. Draft kept. |
| Session expired | A0 |
| Deleting linked | Deleting a family soft-deletes its invitations in the same batch, so headcounts drop at once. Linked tasks show "(deleted family)". Undo restores everything. |

**Acceptance criteria**

| ID | Given | When | Then |
|---|---|---|---|
| AC-GST-01 | A parent who has used the app once | Asked to add "Ramesh Sharma, 98290 12345, Groom side, 4 people", unaided | Done in < 30 s (usability test, 2 parents) |
| AC-GST-02 | A family with +919829012345 exists | Anyone adds "98290 12345" | The duplicate modal shows before saving. |
| AC-GST-03 | Reception: A Coming 2+1; B Coming, adults 3 but expected 2; C Waiting 4 | Open Reception | Coming 5 · Up to 9 |
| AC-GST-04 | A Mixed family of 4 with jain_count 2, Coming to Mehndi | Mehndi headcount | Jain 2 |
| AC-GST-05 | Filter Side = Groom gives 260 families, 20 already invited to Reception | Select all filtered → Invite to Reception | 240 new invitations (Not asked). The existing 20 are unchanged. Undo removes exactly the 240. |
| AC-GST-06 | — | Search "9829" / "sharma" | Matches by phone digits / by name |
| AC-GST-07 | 2,000 seeded families | Open Guests on Slow 4G | First page in < 1.5 s |
| AC-GST-08 | Viewer | Opens Guests | No + and no selection. Writes return 403. |
| AC-GST-09 | A family with 3 invitations | Delete, then Undo | Headcounts drop, then return to the same values. |
| AC-GST-10 | A family with adults 2, invited to 3 events with no overrides | Edit adults to 4 | All 3 invitations count 4 adults. |

---

## B6. Budget & Payments (with light Vendors)

**Purpose:** Know what we planned, paid and still owe, and never miss a due date.

**User stories**

- **US-MON-01** As Owner, I want a total budget and a planned amount per category, so that we have a limit.
- **US-MON-02** As Partner, I want to record an advance with the method and a receipt photo, so that every rupee is traceable.
- **US-MON-03** As Owner, I want balance payments scheduled with due dates, so that they show on Home and in the Calendar.
- **US-MON-04** As Owner, I want planned, spent, still to pay and left per category, so that I see overruns early.
- **US-MON-05** As a money user, I want to log small expenses without a vendor, so that cash spends aren't forgotten.
- **US-MON-06** As a family member, I want vendor phone numbers without the amounts, so that I can call the tent wala.
- **US-MON-07** As a money user, I want a vendor's agreed vs paid vs scheduled amounts, so that I spot balances not yet scheduled.
- **US-MON-08** As a money user, I want to pay part of a due amount, so that partial payments are recorded properly.

**Fields — `budget_categories`**

| Name | Type | Req? | Default | Validation | Example |
|---|---|---|---|---|---|
| name | text(60) | Yes | — | Unique | Catering / Halwai |
| planned | money | No | ₹0 | ≥ 0 | ₹8,00,000 |
| sort | int | Yes | Auto | — | 2 |

**Seeded categories:** Venue · Catering / Halwai · Tent & Decor · Photo & Video · Clothing · Jewelry · Invitations · Makeup & Mehndi · Music, Band & DJ · Transport · Stay · Puja & Pandit · Gifts · Miscellaneous.

**Fields — `vendors`**

| Name | Type | Req? | Default | Validation | Example |
|---|---|---|---|---|---|
| name | text(120) | Yes | — | 1–120 chars | Shree Tent House |
| category | enum venue/caterer/tent_decor/photo_video/makeup/mehndi_artist/band_dj/florist/transport/printer/pandit/jeweller/tailor/other | Yes | other | — | tent_decor |
| contact_person | text(80) | No | — | — | Rajesh ji |
| phone, alt_phone | text(16) | No | — | A9 | +919414012345 |
| agreed_amount | money | No | null | ≥ 0; money users only | ₹3,50,000 |
| is_booked | bool | Yes | false | — | true |
| notes | longtext | No | — | — | — |

**Fields — `payments` (UI: "Payment" if it has a vendor, otherwise "Expense")**

| Name | Type | Req? | Default | Validation | Example |
|---|---|---|---|---|---|
| title | text(120) | Yes | — | 1–120 chars | Tent advance |
| vendor_id | ref → vendors | No | null | — | Shree Tent House |
| category_id | ref → budget_categories | Yes | Vendor's last-used, else Miscellaneous | — | Tent & Decor |
| event_id | ref → events | No | null | — | Mehndi |
| amount | money | Yes | — | > 0 and ≤ ₹10 crore | ₹50,000 |
| status | enum due/paid | Yes | due ("Paid already" → paid) | — | paid |
| due_date | date | No | null | — | 2026-11-20 |
| paid_on | date | If paid | today | Not in the future | 2026-10-12 |
| method | enum cash/upi/bank/cheque/card/other | If paid | upi | — | cash |
| paid_by | text(60) | No | — | — | Papa |
| reference | text(60) | No | — | — | UPI ref 4821… |
| notes | longtext | No | — | — | — |

**Behaviours and rules**

- **Spent** = Σ amount where status = Paid.
- **Still to pay** = Σ amount where status = Due.
- **Planned** = the total budget from Settings if set, otherwise Σ category planned.
- **Left** = Planned − Spent.
- **Free** = Planned − Spent − Still to pay. If negative, show red: "Over by ₹x".
- **Per category:** planned, spent, due, left. Red when spent + due > planned (and planned > 0).
- If the total budget > Σ category planned, show "Not yet split: ₹x".
- **Vendor balance** = agreed − (paid + due):
  - > 0: "₹x not yet scheduled" (amber).
  - < 0: "₹x more than agreed" (red).
- **Overdue payment:** status Due and `due_date` < today.
- A Due payment with no due date shows a "No date" warning chip.
- **Mark as paid:** a sheet with paid on (today), method, paid by, and receipt (camera/file).
  - The payment saves first, then the receipt uploads.
  - If the upload fails, the payment stays paid with a chip: "Receipt not uploaded — try again".
- **Pay part:** enter an amount less than the due amount.
  - Creates a Paid record for that amount.
  - Reduces the Due record by the same amount.
  - Both happen in one transaction and one batch, so a single Undo reverses both.
- Amounts are typed in ₹ (A9) and show live en-IN grouping. INR only.
- Typing a new vendor name in "Paid to" creates the vendor in the same transaction.
- Totals for any filter are computed on the server.

**Links:** vendors ↔ payments and tasks; payments → category, event; receipts (documents) → payment; calendar (due dates); dashboard.

**Permissions**

| | Categories, payments, agreed amounts | Vendor contacts (view) | Vendor add/edit | Vendor delete |
|---|---|---|---|---|
| Owner, Partner | Full | ✓ | ✓ | ✓ |
| Family + money on | Full except delete categories | ✓ | ✓ | ✗ |
| Family, money off | ✗ (module hidden; API 403) | ✓ | ✓ (no amount field) | ✗ |
| Viewer | ✗ | ✓ | ✗ | ✗ |

**Edge cases**

| Case | Behaviour |
|---|---|
| Empty | "Set your total budget" prompt. Categories seeded at ₹0. Vendors: "No vendors yet." |
| 500+ payments | Paged. Filters: status, category, vendor, event, month. |
| Duplicate payment | Same vendor + same amount + a date within 2 days → "Looks like a duplicate of 'Tent advance' ₹50,000 on 12 Oct" [Open] [Save anyway]. |
| Duplicate vendor | Same phone → modal, as for families. |
| Two editing | A4. Amount and status conflicts must be chosen; they are never auto-merged if both sides changed them. |
| Offline | Read-only. Draft kept. |
| Session expired | A0 |
| Delete vendor with payments | Allowed. Payments keep the name, shown "(deleted vendor)". Totals unchanged. |
| Delete category with payments | Blocked: "Move 4 payments to another category first" → pick a target → move and delete in one batch. |
| Delete payment with receipts | Receipts are soft-deleted in the same batch and restore together. |
| Money switched off mid-session | The next request returns 403. The screen shows "You no longer have access to Money". Drafts holding amounts are discarded. |

**Acceptance criteria**

| ID | Given | When | Then |
|---|---|---|---|
| AC-MON-01 | Total ₹40,00,000; paid ₹6,50,000; due ₹3,00,000 | Open Money | Planned ₹40,00,000 · Spent ₹6,50,000 · Still to pay ₹3,00,000 · Left ₹33,50,000 · Free ₹30,50,000 |
| AC-MON-02 | — | Type "125000" in Amount | Shows ₹1,25,000. Stored as 12500000 paise. |
| AC-MON-03 | Due 20 Oct, status Due | On 21 Oct | Red "Overdue" on Money, Home and Calendar |
| AC-MON-04 | Due ₹1,00,000 | Pay part ₹40,000 | Paid ₹40,000 + Due ₹60,000. Spent +40,000, Still to pay −40,000. One Undo reverses both. |
| AC-MON-05 | Category planned ₹2,00,000; spent ₹1,50,000; due ₹80,000 | View the category | Red, "Over by ₹30,000" |
| AC-MON-06 | Non-money Family | Opens a vendor | Sees name, phone, contact. The API response has no `agreed_amount`. |
| AC-MON-07 | Category with 4 payments | Delete | Blocked with the move prompt |
| AC-MON-08 | Existing ₹50,000 tent payment on 12 Oct | Add ₹50,000 tent on 13 Oct | Duplicate warning |
| AC-MON-09 | Mark paid, receipt upload fails | — | Payment is Paid. "Receipt not uploaded" chip with retry. |
| AC-MON-10 | Agreed ₹3,50,000; paid ₹1,00,000; due ₹1,50,000 | Open the vendor | "₹1,00,000 not yet scheduled" |

---

## B7. Documents

**Purpose:** Contracts, receipts and bookings, findable and linked, not lost in WhatsApp.

**User stories**

- **US-DOC-01** As Partner, I want to photograph a receipt and attach it to a payment, so that proof is stored with the payment.
- **US-DOC-02** As Owner, I want to upload a PDF contract linked to a vendor and an event, so that terms are one tap away.
- **US-DOC-03** As anyone, I want to find documents by type, vendor or event, so that I can show proof quickly.
- **US-DOC-04** As Owner, I want some documents private to the couple (IDs), so that sensitive files stay private.

**Fields — `documents`**

| Name | Type | Req? | Default | Validation | Example |
|---|---|---|---|---|---|
| title | text(120) | Yes | Auto: "{Type} – {vendor/event} – {date}" | 1–120 chars | Receipt – Shree Tent House – 12 Oct 2026 |
| type | enum contract/quotation/receipt/booking/id/photo/other | Yes | other | — | receipt |
| file | stored file + original_name, mime, size_bytes, sha256 | Yes | — | JPEG/PNG/WebP/PDF. ≤ 10 MB after compression. MIME checked by content. | — |
| payment_id | ref → payments | No | Context | — | Tent advance |
| vendor_id | ref → vendors | No | Context | — | Shree Tent House |
| event_id | ref → events | No | Context | — | Mehndi |
| is_private | bool | Yes | false (true if type = id) | Admins only can set it | false |
| notes | longtext | No | — | — | — |

**Behaviours and rules**

- **Images are compressed on the device:** longest side 1,600 px, JPEG 80%, EXIF stripped (removes GPS), orientation fixed.
- iPhone usually hands over JPEG. If HEIC arrives and can't be decoded, show "Please share it as a JPEG photo."
- Choosing several files creates one document per file, all with the same links.
- **Server handling:**
  - Checks MIME with `finfo`.
  - Renames to `uploads/YYYY/MM/<uuid>.<ext>`, outside `public_html`.
  - Serves only via `GET /api/v1/documents/{id}/file`, after an auth and visibility check, with `Cache-Control: private, no-store`.
- **Visibility:**
  - Private → Owner and Partner only.
  - Linked to a payment → money users only.
  - Otherwise → everyone.
- Files are never overwritten. To replace one, upload a new document and delete the old (it goes to Trash).
- An upload progress bar shows. A failure shows "Not uploaded — [Try again]". The file is kept in memory while the page is open.
- PDFs open in the phone's own viewer.

**Links:** payments (paperclip icon), vendor page, event page Documents tab.

**Permissions**

| | View | Upload | Edit details | Delete (soft) | Set private |
|---|---|---|---|---|---|
| Owner, Partner | All | ✓ | ✓ | ✓ | ✓ |
| Family | Non-private (+ payment-linked if money on) | ✓ (link to payments only if money on) | Own uploads | Own uploads | ✗ |
| Viewer | Non-private, not payment-linked | ✗ | ✗ | ✗ | ✗ |

**Edge cases**

| Case | Behaviour |
|---|---|
| Empty | "No documents. Take a photo of a receipt or contract." |
| Long lists | Paged 30. Thumbnails lazy-load. |
| Duplicate | Same `sha256` already stored → "This file is already saved as 'X'." [Open it] [Save again] |
| Two editing | Details only. A4. |
| Offline | Upload disabled: "Not uploaded — no internet. Pick the file again when online." |
| Session expired during upload | 401 → login sheet → automatic re-upload of the in-memory file. |
| Too big | "This file is too big (14 MB). Max 10 MB." |
| Deleting linked | Deleting a document affects nothing else. Deleting a payment deletes its receipts in the same batch. |

**Acceptance criteria**

| ID | Given | When | Then |
|---|---|---|---|
| AC-DOC-01 | A 4032×3024, 4.2 MB phone photo with GPS | Upload | Stored JPEG has a longest side of 1,600 px, < 600 KB, and no GPS EXIF. |
| AC-DOC-02 | — | Not logged in, request a file URL / Family requests a private doc / guess a public path | 401 / 403 / 404 |
| AC-DOC-03 | Receipt linked to a payment | A non-money user lists documents or opens its URL | Not listed / 403 |
| AC-DOC-04 | — | Upload the same file twice | Duplicate prompt |
| AC-DOC-05 | — | Upload a 14 MB PDF / a 9 MB PDF | Rejected with message / accepted |
| AC-DOC-06 | An `.exe` renamed to `.pdf` | Upload | Rejected |
| AC-DOC-07 | — | Use the camera from the installed iPhone app and from Android Chrome | Both succeed |

---

## B8. Export

**Purpose:** Get every record and file out in one tap, readable without the app.

**User stories**

- **US-EXP-01** As Owner, I want a full export ZIP, so that we can recover even if hosting disappears.
- **US-EXP-02** As Owner, I want CSVs that open in Excel with Hindi and ₹ intact, so that anyone can read them.
- **US-EXP-03** As Owner, I want a readable summary I can print or save as PDF, so that there is a paper copy.
- **US-EXP-04** As Owner, I want to export a filtered guest list as CSV, so that I can hand it to the printer or caterer.

**ZIP contents — `wedding-export_YYYY-MM-DD.zip`**

| Path | Content |
|---|---|
| `README.txt` | What each file is, export time (IST), app version, row counts |
| `csv/<table>.csv` | One per table, **including deleted rows** (`deleted_at` column). Users exclude password hashes. Sessions are excluded. |
| `csv/audit_log.csv` | Full audit log |
| `json/all.json` | Everything, with paise and UTC, for machine restore |
| `documents/<id>_<safe-title>.<ext>` | Every file, including those in Trash. Mapped in `csv/documents.csv`. |
| `summary.html` | Readable, print-ready: wedding facts, events, tasks by status, headcount per event, guests by side, budget summary, payments, vendor contacts |

**Behaviours and rules**

- **CSV format:**
  - UTF-8 with BOM, commas, RFC 4180 quoting, a header row.
  - Dates and times in IST (`2026-10-12 18:00`).
  - Money in rupees (`125000.00`).
- **Formula safety:** cells starting with `=` or `@`, or with `+`/`-` when they aren't a phone number or a number, get a leading `'`.
- **Generation:**
  - Built on the server on request, with progress: "Preparing export…".
  - When ready, a download link appears, valid for 24 h, listed under "Recent exports". The server deletes the file after 24 h.
  - If files total > 200 MB, the export is split: part 1 holds the data and summary, then `files-part2…n`.
- Every export is audited.
- "Export this list (CSV)" on a filtered guest list gives that list only.
- **Download:** iPhone opens the Files save sheet. Android saves to Downloads.
- **PDF:** "Print summary" in Settings opens `summary.html` → Print → Save as PDF (see conflict C3).

**Links:** reads every table. Writes nothing except the audit entry.

**Permissions:** Owner and Partner only. Family and Viewer get 403.

**Edge cases**

| Case | Behaviour |
|---|---|
| Empty | Works. CSVs have headers only. |
| Very large | Split as above. |
| Duplicate | Not applicable. |
| Two editing | The export is a consistent snapshot (one read transaction for the data). |
| Offline | Button disabled. |
| Session expired | The job continues. The link waits under Recent exports after re-login. |
| Deleted records | Included, with `deleted_at`. |
| Failure | "Export failed — try again." Logged. Settings shows the last successful export date. |

**Acceptance criteria**

| ID | Given | When | Then |
|---|---|---|---|
| AC-EXP-01 | Any data | Export | The ZIP has README, csv/*, json/all.json, documents/*, summary.html |
| AC-EXP-02 | A guest named "राम शर्मा" and an amount of ₹1,25,000 | Open the CSV in Excel (Windows) and Google Sheets | Text and numbers display correctly. |
| AC-EXP-03 | Data including 5 deleted families | Export | `households.csv` row count = DB count including deleted |
| AC-EXP-04 | Family user | `POST /api/v1/exports` | 403 |
| AC-EXP-05 | An export | Restore `json/all.json` into an empty DB with the restore script | Every table count matches. |
| AC-EXP-06 | — | Download on the installed iPhone app and on Android Chrome | The file saves on both. |
| AC-EXP-07 | Notes cell `=HYPERLINK(…)`; phone `+919829012345` | Export | `'=HYPERLINK(…)`; the phone is unchanged. |
| AC-EXP-08 | An export made 25 h ago | Open its link | Expired message |

---

## B9. Trash & Undo

**Purpose:** Every delete can be reversed. Nothing is ever hard-deleted in R1.

**User stories**

- **US-TRS-01** As anyone who edits, I want Undo right after deleting, so that mistakes cost nothing.
- **US-TRS-02** As Owner, I want to see everything deleted, by whom, and restore it with its linked items, so that recovery is self-service.
- **US-TRS-03** As Owner, I want a bulk mistake undone in one go, so that 50 deleted families come back together.

**Fields**

- Every table has `deleted_at`, `deleted_by` and `delete_batch_id`.
- `delete_batches` holds: id, user, at, entity type, count, summary text.

**Behaviours and rules**

- Every delete is soft. There is no confirm dialog; Undo follows (A2).
- **Children deleted in the same batch:** task → checklist; family → invitations; event → invitations; payment → receipts. Other links stay and are labelled "(deleted)".
- Deleted rows are excluded from lists, search, counts, the dashboard and the calendar.
- **Trash screen (admins):**
  - Newest first. Filters: type, person, date.
  - Each row shows what, who, when, and the linked item count, with **[Restore]**.
  - A bulk batch shows "Restore all 50", and can be expanded to restore single items.
- **Restore rules:**
  - Restoring a child also restores its deleted parent (e.g. a checklist item restores its task).
  - Unique clash (member phone) → blocked, with the reason shown.
  - Family phone clash → restored, with the duplicate warning.
  - Every restore bumps the version and is audited.
- **No permanent delete in R1.** Purge is allowed only after 16 May 2027 (Later).

**Links:** every module.

**Permissions:** Undo (8 s) is for the person who acted. Trash view and restore are for Owner and Partner. Family and Viewer get 403 on Trash.

**Edge cases**

| Case | Behaviour |
|---|---|
| Empty | "Nothing deleted." |
| Long list | Paged 50. |
| Duplicate on restore | As in the rules above. |
| Two restore at once | Idempotent: "Already restored." |
| Offline | Undo is hidden. The message says to ask an admin to restore later. |
| Session expired | After login, a banner offers "Undo your last delete?" for 5 min. |
| Deleting linked | See the batch rules above. |

**Acceptance criteria**

| ID | Given | When | Then |
|---|---|---|---|
| AC-TRS-01 | I deleted a family | Undo within 8 s | Same record, same fields, version +1, audit "restored" |
| AC-TRS-02 | 8 s passed | Admin opens Trash | The family is listed with my name and the time. |
| AC-TRS-03 | Bulk-deleted 50 families | Undo | All 50 and their invitations are back. |
| AC-TRS-04 | A task linked to a deleted event | Restore the task | The task is back. The event stays deleted, labelled. |
| AC-TRS-05 | Family user | `GET /api/v1/trash` | 403 |
| AC-TRS-06 | Any `DELETE` endpoint | Called | The row still exists with `deleted_at` set. (Automated test over all endpoints.) |
| AC-TRS-07 | A deleted family | Search its name; view headcount | Not found; not counted |

---

## B10. Settings

**Purpose:** Wedding facts, people, safety status and help, in one place.

**User stories**

- **US-SET-01** As Owner, I want to set names, dates, city and total budget, so that the whole app uses them.
- **US-SET-02** As Owner, I want to manage members here (B1), so that access is in one place.
- **US-SET-03** As Owner, I want backups, restore drills and storage use visible, so that I can trust the data.
- **US-SET-04** As anyone, I want an Install Guide for my phone, so that I can add the app to my Home Screen.
- **US-SET-05** As anyone, I want to change my password and see the app version, so that I can help myself.
- **US-SET-06** As Owner, I want to log each restore drill, so that the monthly check is recorded.

**Fields — `settings` (one row)**

| Name | Type | Req? | Default | Validation | Example |
|---|---|---|---|---|---|
| bride_name | text(80) | Yes | Mahi Jagetiya | — | — |
| groom_name | text(80) | Yes | Ayush Porwal | — | — |
| bride_side_label | text(40) | Yes | Mahi's side (Jagetiya) | — | — |
| groom_side_label | text(40) | Yes | Ayush's side (Porwal) | — | — |
| wedding_start_date | date | Yes | 2027-02-14 | — | — |
| wedding_end_date | date | Yes | 2027-02-16 | ≥ start | — |
| city | text(60) | Yes | Bhilwara | — | — |
| total_budget | money | No | null | ≥ 0 | ₹40,00,000 |
| timezone | fixed | — | Asia/Kolkata | Read-only | — |
| currency | fixed | — | INR | Read-only | — |

**Fields — `restore_drills`:** date · done_by · result (passed/failed) · backup file used · notes.
**Fields — `backup_runs`** (written by the cron job): started, finished, status, size, destination, error.

**Behaviours and rules**

- **First Owner login runs a setup wizard:** names → dates → city → budget (skippable) → add members (skippable).
- **Sections:**
  - Wedding
  - Members (B1)
  - Money access
  - Safety (last 7 backup runs, restore drill log, storage used for DB and files, last export)
  - Activity (A5)
  - Imports (A8)
  - Print summary (B8)
  - Install Guide
  - My account (name, change password, log out, log out of all my phones)
  - About (app version, server time)
- **Install Guide:**
  - Detects the platform and shows matching steps with screenshots.
  - **Inside the WhatsApp in-app browser**, it shows "Tap ⋯ → Open in Safari/Chrome first", because install isn't possible there.
  - Reminds iPhone users to log in again after installing.
- **Status colours:** backup red if > 26 h; drill amber if > 35 days.
- Changing a password requires the current one, and logs out the user's other sessions.

**Links:** dates → countdown; side labels → Guests; total budget → Money and Home.

**Permissions**

| | View facts | Edit facts | Safety / Activity / Imports | My account |
|---|---|---|---|---|
| Owner, Partner | ✓ | ✓ | ✓ | ✓ |
| Family, Viewer | ✓ | ✗ | ✗ | ✓ |

**Edge cases**

| Case | Behaviour |
|---|---|
| Empty | Setup wizard (above). |
| Long / duplicate | Not applicable. |
| Two editing | A4 |
| Offline | Cached and read-only. |
| Session expired | A0 |
| Deleting linked | Settings can't be deleted. |

**Acceptance criteria**

| ID | Given | When | Then |
|---|---|---|---|
| AC-SET-01 | — | An admin sets the total budget to ₹40,00,000 | Home and Money show Planned ₹40,00,000. |
| AC-SET-02 | Family user | Edits wedding facts | No Edit control. API 403. |
| AC-SET-03 | The backup cron ran 7 nights | Admin opens Safety | 7 rows with status, size and time |
| AC-SET-04 | The app link opened inside the WhatsApp in-app browser on iPhone | Open Install Guide | "Open in Safari first" shows above the steps. |
| AC-SET-05 | Logged in on 2 phones | Change password on one | The other phone is logged out on its next request. |
| AC-SET-06 | Last drill 40 days ago | An admin logs a passed drill | The amber status clears. |
| AC-SET-07 | — | End date before start date | Error: "End date must be on or after the start date." |

---

# Part C — Releases 2 and 3 (outline)

| Release | Target | Features | Key rules | Done when (from PRD) |
|---|---|---|---|---|
| **R2a** | Sun 15 Nov 2026 | Reminders · global search · card tracking · printable lists | **Reminders:** a `reminders` table, cron every 15 min, Web Push (VAPID) plus email fallback. "Last reminder run" health check. "Send test reminder" button. Default: a payment reminder 3 days before and on the due day; a task reminder on the due day at 9 AM IST. **Search:** one box across families, tasks, vendors, payments (money users) and documents. **Card tracking:** `card_given_on`, `card_given_by` and `einvite_opened_at` on each family; distribution list by area. **Print:** guest lists by side, area and event, via print CSS. | A test reminder arrives on an installed iPhone (iOS 16.4+), an Android, and by email. Health is green for 7 days. |
| **R2b** | Sun 10 Jan 2027 | Wedding-day mode · rooms | **Timeline items** per event: time, what, who, vendor, status (upcoming / now / done). **Vendor contact sheet.** **Rooms:** hotel, room, check-in date and arrival note on each family, plus a room list. All of this is cached offline (read-only), with "Refresh for wedding day" on 13 Feb. Printable packet. | An airplane-mode dry run passes on 2 iPhones + 2 Androids by 24 Jan. |
| **R3** | Only if a feature passes PRD §4.1 by 20 Dec | Candidates: Hindi/Hinglish UI labels (strings file already in place); transport list (only if > 20 pickups) | Shopping, outfits, jewelry, accommodation module, seating and the invitation designer were **cut** in PRD §4.1. Tasks, tags, expenses and family fields cover them. | Used by named people in its first week. |
| **Later** | After 20 Feb 2027 | AI assistant, Capacitor apps, guest self-RSVP portal, Trash purge (after 16 May 2027) | — | — |

---

# Part D — Traceability

| Feature | User stories | Acceptance criteria |
|---|---|---|
| A1 Quick Add | US-TASK-01, US-GST-01, US-MON-05 | AC-QA-01…05 |
| A2 Undo snackbar | US-TRS-01, US-TRS-03, US-GST-08 | AC-UND-01…04 |
| A3 Save state + drafts | US-GST-01 (all forms) | AC-SAV-01…05 |
| A4 Conflict screen | US-GST-05, US-MON-02 (all edits) | AC-CON-01…04 |
| A5 Activity / History | US-TASK-04, US-TRS-02 | AC-ACT-01…04 |
| A7 WhatsApp | US-GST-06, US-EVT-05, US-TASK-07, US-AUTH-04 | AC-WA-01…04 |
| A8 Guest import | US-GST-02, US-GST-03 | AC-IMP-01…06 |
| A9 Indian formats | US-MON-02, US-GST-01, US-EVT-02 | AC-IND-01…04 |
| B1 Auth & members | US-AUTH-01…07 | AC-AUTH-01…09 |
| B2 Dashboard | US-DASH-01…06 | AC-DASH-01…07 |
| B3 Tasks | US-TASK-01…07 | AC-TASK-01…10 |
| B4 Calendar & Events | US-EVT-01…06 | AC-EVT-01…08 |
| B5 Guests & RSVP | US-GST-01…09 | AC-GST-01…10, AC-IMP-01…06 |
| B6 Budget & Payments | US-MON-01…08 | AC-MON-01…10 |
| B7 Documents | US-DOC-01…04 | AC-DOC-01…07 |
| B8 Export | US-EXP-01…04 | AC-EXP-01…08 |
| B9 Trash & Undo | US-TRS-01…03 | AC-TRS-01…07, AC-UND-01…04 |
| B10 Settings | US-SET-01…06 | AC-SET-01…07 |

**Release 1 launch (PRD v1.1):** everything in Parts A and B ships together on Sun 25 Oct 2026. No slices.

---

# Part E — Open Questions

**Decisions on conflicts in this file:**

1. **Undo:** keep 8 s (C1)? If yes, I'll update PRD §7.
2. **Owner vs Partner:** any difference beyond "Owner can't be removed" (C2)?
3. **Export PDF:** is `summary.html` + "Print → Save as PDF" enough (C3)? A true PDF inside the ZIP needs a server PDF library, which goes against CONTEXT decision 15.
4. **Record History** for Family users: OK (C4), even though PRD keeps the full audit log admin-only?

**Product choices:**

5. Is non-veg served at any function? If not, I'll remove the Non-veg option.
6. Default adults per new family: is 2 right?
7. WhatsApp templates: English, Hinglish, or both? Should they sign with the sender's name or "Ayush & Mahi"?
8. Mayra: one event (both sides) or two (one per side)? This sets the event seed.
9. ~~.xlsx import~~ — answered: yes, with an in-app template (A8).
10. Can Family editors import and bulk-delete guests, or should that be admins only?
11. Can Family delete any task, or only ones they created or are assigned to?
12. Events editable by admins only: OK?
13. Is a minimum 6-character password OK for elders, or switch to a 4–6 digit PIN?
14. Is a 10 MB max upload OK? It depends on the Hostinger plan's PHP upload limit.
15. Is the seeded budget category list right? Should "Shagun / Lena-dena" (cash gifts given) be tracked?

**Still open from CONTEXT.md and PRD.md:**

16. Off-site backup account (Gmail / Google Drive) for the nightly encrypted copy.
17. Logo file (didn't arrive).
