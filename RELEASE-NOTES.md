# Release notes — admin operations · version 1.0.24

**Goes to:** STAGING (and the Vercel test copy) first.
**Migrations:** none new. The app still needs schema version **9** (import `004`–`009` in order first if you have not).
**.env / hPanel / `.htaccess`:** no change.

## What's new
Doing the same thing to many things at once, safely. Every bulk change shows what will change before you tap Apply, goes in one step, and has **one Undo** for 10 minutes. Anything someone else changed after you opened the list is left as it was and listed by name with the reason.

- **Tasks → Select:** tick tasks (or "Select all shown"), then Mark done, Status, Priority, Due date, Assign, Unassign, add or remove tags, Event, Workspace, Export selected (CSV) or Delete. Family can delete only tasks they made or are assigned to; Viewers don't see Select.
- **Many files at once:** Add attachment → Choose photos (or files) lets you pick several. Each shows a thumbnail, progress and ✓; one that fails keeps **↻ Try again** and the rest are saved. Trying again never makes a second copy.
- **From Vault, many at once:** every Files block, moodboard, accessory, step, decor board, menu, dish and timeline step has **From Vault**: tick several and tap "Use N here". **Select → Remove from here** takes files out of that place only. They stay in the Vault and everywhere else.
- **Vendors → Select:** change Type or Booked for many, Export selected (amounts only for money users). Delete many: Ayush and Mahi only, with Undo. Adding a vendor whose **name** is already there now warns first ("Add anyway" still works).
- **Payments → Select (money users):** change Category or Event for many, Export selected. Marking paid, amounts and deleting stay one payment at a time on purpose.
- **Guests → Select:** the sheet now says what will change ("2 families will change: Mehndi → Coming"). Families left as they were are listed by name. Ayush and Mahi get **Export selected**.
- **Members:** each member shows their set-password link: open until …, used, or expired. **Send a new link** works from the member page. **Access history** lists recent log-ins (including wrong passwords), their phones and password changes.
- **Sort:** Tasks (Overdue first · Due date · Newest · A to Z), Vendors (A to Z · Type · Newest · Not booked first), Payments (Due date · Recently paid · Biggest first). Lists show "8 of 40 shown".
- **More actions (⋯):** on a task or vendor page, History and Delete sit under More actions; Edit and the main buttons stay in view.
- **Storage card:** the Vault and Settings (Ayush and Mahi) show how full the database is (of 3 GB), how much is Vault files, when it was checked, and what to do when it gets close.

## Phone checks
| # | Do | Pass when |
|---|---|---|
| O1 | Tasks → Select → tick 2 → Priority → Urgent → Apply | "Set Urgent for 2 tasks" with Undo; Undo puts both back |
| O2 | Mehndi → Files → Add attachment → Choose photos → pick 3 | 3 rows with thumbnails and progress; all ✓; 3 new files in the Vault |
| O3 | Mehndi → Files → From Vault → tick 2 → Use 2 here | Both appear in Files; Undo removes both links only |
| O4 | Files → Select → tick 1 → Remove from here → confirm | Gone from Files, still in the Vault |
| O5 | Vendors → Select → tick 2 → Type → Florist | Both show Florist; Mummy sees no Delete |
| O6 | Payments → Select → Export selected | A CSV opens with the chosen payments |
| O7 | Settings → Members → someone not logged in yet | Link status shows; Send a new link gives a new link to share |
| O8 | Tasks → Sort → Due date | Order changes; the choice stays after going back |
| O9 | A task → More actions | History and Delete show; Escape or a tap outside closes it |

## Live — release checklist
1. **Backup now** (no SQL this time). 2. Upload `live/` in order, `version.json` last. 3. If anything looks wrong: upload the 1.0.23 files again. Nothing in the database changed.
