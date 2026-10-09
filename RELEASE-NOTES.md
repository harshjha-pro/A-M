# Release notes — Session 09 · Budget and payments · version 1.0.10

**Goes to:** STAGING first, then **LIVE** (release checklist below).
**Migrations:** none. Nothing to run in phpMyAdmin.
**.env:** no change.
**`.htaccess`:** no change.

## What's new
- **Money** (More → Money; only for people with money access).
  - **Totals:** Planned · Spent · Still to pay · Left, and **Free** (red "Over by …" when you are over).
  - **"Not yet split"** when the total budget is more than the categories add up to.
  - "Set your total budget" link (Wedding details) until it is set.
  - **Categories** with planned, spent and due. Tap one to change its plan or name. A red **Over by** shows when spent + due is more than the plan.
  - **Add a category.**
  - **Delete a category** (Ayush and Mahi):
    - If it has payments, the app asks which category to move them to, then moves and deletes in one step, with one **Undo**.
    - Miscellaneous can't be deleted.
- **Payments and expenses** (Money → Payments, or **+ on Home → Payment**).
  - **Amount** in ₹: type 50000, 1,25,000 or "1.25 lakh"; it shows ₹1,25,000 as you type. Up to ₹1 crore per payment.
  - **Paid to:** pick a vendor, type a **new vendor** (created at the same time), or none (an expense).
  - **Category** is optional: the vendor's usual one, otherwise Miscellaneous.
  - **Paid already** switch → date (today) and how (UPI, cash, bank, cheque, card). Otherwise a due date.
  - **Duplicate warning:** the same vendor and amount within 2 days → "Looks like a duplicate of 'Tent advance' ₹50,000 on 12 Oct", with [Open it] [Save anyway].
  - **List:** All · Due · Overdue (red) · Paid · No date, with totals ("12 · ₹6,45,000 · ₹5,20,000 due · ₹1,25,000 paid").
  - **Payment page:**
    - **Mark as paid** comes with an Undo.
    - **Pay part:** e.g. pay ₹40,000 of ₹1,00,000 → "Paid ₹40,000. ₹60,000 still due." One Undo puts back the single ₹1,00,000 row.
    - Edit, Delete (with Undo; Ayush and Mahi can restore from Deleted items), History.
  - Receipt photos arrive with Documents (next update).
- **Vendors** (More → Vendors — **for everyone**, so anyone can call the tent wala).
  - Name, type, contact person, phones (tap to call), Booked, notes, and **Message on WhatsApp**.
  - People with money access also see and set the **agreed amount**, with "Agreed ₹3,50,000 · paid ₹1,00,000 · due ₹1,50,000" and **"₹1,00,000 not yet scheduled"** (or red "₹x more than agreed").
  - Others never receive any amount from the server.
  - Same phone as another vendor → asks before saving.
  - Delete is Ayush and Mahi only. Payments keep the name, shown "(deleted vendor)".
- **If money access is turned off** for someone, their next tap shows "You no longer have access to Money", and any unsaved drafts with amounts are thrown away.
- Home's **Payments due** card and the Calendar's payment items now show what you enter.

## 1. Staging (≈ 10 minutes)
Standard upload from the **`staging/`** folder → `/api/v1/health` = `{"status":"ok"}` → phone checks below.

## 2. Live (after staging passes) — release checklist
1. Live Settings → Safety all green.
2. **Backup now** — SSH: `php ~/domains/wedding.lumorrahouse.com/private/backup/backup.php --kind=manual_db` → `Done in … s.`
3. Save `deploy-session09.zip` to Drive `deploys/`; tell the family group (quiet hour).
4. Standard upload from the **`live/`** folder.
5. Within 10 minutes:
   - Health check says `ok`, and the app refreshes to 1.0.10.
   - More → Money opens; the 14 categories are there.
   - Add a test expense of ₹1, mark it paid, Undo, then delete it.
6. **From now on you and Mahi can enter real advances and due payments on live** (the plan, answer 8). Set your total budget in Wedding details first if you have a figure. Receipt photos follow after Session 10.
7. If anything fails: upload `deploy-session8b.zip` (`live/`) the same way.

## Phone checks (staging, then live) — Android and iPhone
Staging logins (password `demo-1234`): Ayush 98290 00001 · Papa 98290 00004 (money) · Kavita 98290 00005 (no money).

| # | Do | Pass when |
|---|---|---|
| M1 | As Papa: + → Payment → "Test advance", type **1.25 lakh**, Paid to → **+ New vendor** "Test Tent", due in 3 days → Save | Shows ₹1,25,000; the Home Payments card counts it |
| M2 | Open a due payment → **Mark as paid** → UPI → Save | Paid, with an Undo bar (the receipt photo comes next update) |
| M3 | Add a ₹1,00,000 due payment → **Pay part** ₹40,000 | "Paid ₹40,000. ₹60,000 still due."; Undo → one ₹1,00,000 due row again |
| M4 | Log in as **Kavita** | No Money in More; no Payments card on Home; Vendors opens with phones, no amounts |
| M5 | Money → check by hand | Left = Planned − Spent; Free = Left − Still to pay; Payments list "due" and "paid" match Still to pay and Spent |
| M6 | Money → tap **Clothing** → Delete category (as Ayush) | "Move … payments first" → pick Miscellaneous → Move and delete → Undo brings it back with its payments |
| M7 | Add a payment for the same vendor and amount as an existing one, 1 day apart | "Looks like a duplicate of …" with Open it / Save anyway |
| M8 | As Ayush: turn Papa's money off (Members) while Papa is on Money → Papa taps anything | "You no longer have access to Money" |

## Old files to delete later
After 14 days: files in `public_html/assets/` that are not in this ZIP's `2-assets.zip`.
