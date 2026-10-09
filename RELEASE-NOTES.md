# Release notes — Session 08 · Guests and RSVP · version 1.0.8

**Goes to:** STAGING first, then **LIVE** (release checklist below).
**Migrations:** none. Nothing to run in phpMyAdmin.
**.env:** no change.
**`.htaccess`:** no change.

## What's new
- **Guests tab is live.** One list of invited families.
  - Header for the current filter: "512 families · 1,804 people".
  - Search by name, part of a phone number (typed any way), group or area.
  - Side chips (All · Bride · Groom · Both). "Both" families also show under Bride and under Groom.
  - Pick an **event** to see each family's answer, then filter by **Coming?** (Not asked yet · Waiting · Coming · Not coming).
  - **More filters**: group, area, food, Important, No phone, Possible duplicates.
  - Your filters are remembered on your phone. The list loads 50 at a time as you scroll.
- **Add a family in under 30 seconds** (+ on Home → Family, or + on Guests).
  - Fields: name, phone, side, adults and children (− / + buttons), food (Veg · Jain · Mixed with a Jain count), and the events to invite them to.
  - Group, relation, area, city, address and notes sit under "More details". Group, area and relation suggest values already used.
  - Side and area stay as you last used them; city starts as Bhilwara.
  - **Same phone as another family** → "Already on the list: Ramesh Sharma & family (Groom's side, added by Papa)", with [Open that family] and [Add anyway].
  - Same name in the same city shows a gentle hint while you type.
- **Family page**:
  - Tap to call.
  - For each invited event:
    - **Coming?** buttons that save at once.
    - "Change numbers" for that event only (e.g. 2 of the 4 coming).
    - **Remind on WhatsApp**, in English or Hinglish (your choice is remembered).
    - × to remove the family from that event, with Undo.
  - "Invite to …" buttons for the other guest events.
  - Edit, Delete (with Undo; Ayush and Mahi can restore it from Deleted items later), History.
- **WhatsApp reminders**
  - Opens WhatsApp with the message filled in.
  - The app notes "WhatsApp opened", never "sent": the app can't know whether you sent it.
  - No mobile number (or only a landline) → the button is greyed out with "Add a mobile number".
  - **Send reminders one by one**: on Guests, pick an event (e.g. Reception) and Waiting, then tap the button.
    - Each family appears in turn: [Remind on WhatsApp] → [Next].
    - Your place is kept when you come back from WhatsApp.
- **If two people change the same answer**: "Papa changed this to Waiting at 3:10 PM", with [Keep Waiting] [Change to Coming]. Changing a family's details and its answer at the same time both save.
- **Headcounts are now real**: event pages and Home use the answers (Coming, "up to" = Coming + Waiting, Jain).
- **Activity stays readable**: deleting a family with 5 invitations is one line, not six.
- Coming next, as its own update (8b): select many families → invite / set answer / change side / delete in one go with one Undo; Excel / CSV / contacts import with preview; template; CSV export.

## 1. Staging (≈ 10 minutes)
Standard upload from the **`staging/`** folder → `/api/v1/health` = `{"status":"ok"}` → phone checks below.

## 2. Live (after staging passes) — release checklist
1. Live Settings → Safety all green.
2. **Backup now** — SSH: `php ~/domains/wedding.lumorrahouse.com/private/backup/backup.php --kind=manual_db` → `Done in … s.`
3. Save `deploy-session08.zip` to Drive `deploys/`; tell the family group (quiet hour).
4. Standard upload from the **`live/`** folder.
5. Within 10 minutes:
   - Health check says `ok`, and the app refreshes to 1.0.8.
   - Guests opens and says "No families yet".
   - Add yourself as a test family, invite it to Mehndi, set Coming, then delete it and Undo.
   - Do the same on Mahi's phone.
   - UptimeRobot shows "Up".
6. If anything fails: upload `deploy-session07.zip` (`live/`) the same way.

## Phone checks (staging, then live) — Android and iPhone
Staging logins (password `demo-1234`): Ayush 98290 00001 · Papa 98290 00004 · Dadi 98290 00006 (Viewer).

| # | Do | Pass when |
|---|---|---|
| G1 | As Papa: + on Home → Family → "Test Sharma", phone **98280 10085**, Groom's side → Save | "Already on the list: Ramesh Sharma & family …" with Open that family / Add anyway. Open that family shows Ramesh's page. |
| G2 | Guests → search **9829** then **sharma** | Families matching by phone digits, then by name |
| G3 | Guests → event **Mehndi** → Coming? **Waiting** | Only Waiting families; header numbers change |
| G4 | Open a family → Mehndi → **Coming** → Change numbers → 3 adults | "3 people for this event"; Mehndi event page "coming" goes up |
| G5 | On that family → **Remind on WhatsApp** (Android and iPhone) | WhatsApp opens to that number with "Namaste … ji, we'd love you to join Ayush & Mahi's Mehndi …"; come back → "WhatsApp opened …" |
| G6 | Switch the message language to **Hinglish**, tap again | The Hinglish text opens |
| G7 | Guests → Mehndi + Waiting → **Send reminders one by one** → Remind → come back → Next | The next family shows; after closing and reopening the app the position is kept |
| G8 | Family page → × on Mehndi | "Removed … from Mehndi" with UNDO; Undo brings it back with its answer |
| G9 | As Dadi (Viewer) | Guests list and family pages open, phones can be tapped to call; no +, no Coming? changes |
| G10 | Two phones, same family: Papa sets Waiting, then (without refreshing) Ayush sets Coming | Ayush sees "Papa changed this to Waiting at …" with Keep Waiting / Change to Coming |

## Old files to delete later
After 14 days: files in `public_html/assets/` that are not in this ZIP's `2-assets.zip`.
