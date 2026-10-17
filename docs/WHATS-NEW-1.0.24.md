# What's new in A&M Wedding Planner — version 1.0.24

Live test copy: **https://am-wedding-rust.vercel.app** (refresh, or tap "New version", to get it).
Nothing changed in the database: no SQL to run.

The big idea: **do the same thing to many things at once, safely.** Every bulk change:
- shows what will change before you tap **Apply**,
- happens in one step with **one Undo** (10 minutes),
- leaves anything someone else changed after you opened the list as it was, and lists it by name with the reason.

---

## 1. Tasks: change many at once
**Where:** bottom bar → **Tasks** → **Select** (top right of the list)

- Tick tasks one by one, or tap **Select all N shown**.
- Then choose: **Mark done · Status · Priority · Due date · Assign · Unassign · Tag · Remove tag · Event · Workspace · Export selected · Delete**.
- **Export selected** downloads a spreadsheet (CSV) of the chosen tasks.
- Family can delete only tasks they made or are assigned to. Viewers don't see Select.

## 2. Add many photos or files at once
**Where:** Workspace → open any workspace (e.g. Mehndi) → **Files** → **Add attachment** → **Choose photos** / **Choose files**
(Also works in the Attachment Vault: More → **Attachment Vault** → **+**.)

- Pick several at once. Each shows a thumbnail, its progress, and ✓ when saved.
- A failed one shows **↻ Try again**. The others are still saved, and trying again never makes a second copy.
- **Add more** adds files to the list before saving; **✕** takes one out.

## 3. Pick many from the Vault, and Remove from here
**Where:** any attachment area in a workspace: **Files**, outfit **moodboard**, **accessories**, outfit **steps**, **Theme & decoration** board, **Menu** files, a **dish**, an **event timeline** step

- **From Vault:** tick several files and tap **Use N here**.
- **Select → Remove from here:** takes the chosen files out of this place only. They stay in the Vault and anywhere else they are used. You can Undo.

## 4. Vendors
**Where:** More → **Vendors** (money users: also Money → Vendors) → **Select**

- Change **Type** or **Booked** for many vendors at once.
- **Export selected** (CSV). Amounts appear only for people who can see money.
- **Delete** many: only Ayush and Mahi, with Undo.
- **Duplicate warning:** adding a vendor whose name is already there warns first. **Add anyway** still works.

## 5. Payments (money users only)
**Where:** More → **Money** → **Payments** → **Select**

- Change **Category** or **Event** for many payments at once.
- **Export selected** (CSV).
- Marking paid, changing amounts and deleting stay **one payment at a time** on purpose, so nothing big changes by mistake.

## 6. Guests
**Where:** More → **Guests** → **Select**

- The sheet now says what will happen before you apply it, e.g. "2 families will change: Mehndi → Coming".
- Families that couldn't be changed are listed by name, with the reason.
- **Export selected** (Ayush and Mahi) downloads just the chosen families.

## 7. Members: login link and access history (Ayush and Mahi)
**Where:** More → **Settings** → **Members** → tap a person → **Log-in link and access**

- Shows their set-password link: **open until …**, **used**, or **expired**. The members list marks "link expired" too.
- **Send a new link** makes a fresh one to share on WhatsApp.
- **Access history** shows recent log-ins (including wrong passwords), their phones, and password changes.

## 8. Sort and counts
**Where:**
- **Tasks:** the ⇅ menu above the list. Choices: Overdue first, Due date, Newest first, A to Z.
- **Vendors:** the ⇅ menu above the list. Choices: A to Z, Type, Newest first, Not booked first.
- **Payments:** the ⇅ menu above the list. Choices: Due date, Recently paid, Biggest first.
- Lists show counts like **"8 of 40 shown"**.

## 9. More actions (⋯)
**Where:** open a **task** or a **vendor** → **More actions** at the bottom

- **History** and **Delete** now sit here. **Edit** and the main buttons stay in view.

## 10. Storage card
**Where:** More → **Attachment Vault** (top), and More → **Settings** (Ayush and Mahi)

- Shows how full the database is (out of 3 GB), how much is Vault files, and when it was checked.
- Turns amber with a warning and advice ("use links for big videos") when it gets close to full.

## 11. Smoother Home
**Where:** bottom bar → **Home**

- The page no longer jumps while it loads: the lower parts wait until the cards above are ready.

---

## For the record
- GitHub: merged into `main` ([PR #11](https://github.com/harshjha-pro/A-M/pull/11) for the features, [PR #12](https://github.com/harshjha-pro/A-M/pull/12) for the upload package).
- Hostinger upload package: `releases/deploy-session16.zip` (no SQL; upload `1-server.zip`, `2-assets.zip`, `3-shell.zip` in order, `version.json` last).
- Phone checks to try: `RELEASE-NOTES.md` (O1–O9). Full technical list of the new API: `docs/API.md` §6.9g and `docs/ROUTES.md`.
- Not built (as agreed): guests answering RSVP themselves, sending WhatsApp automatically, vendor quotations, changing many calendar events at once.
