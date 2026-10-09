# Release notes — Session 10 · Documents and uploads · version 1.0.11

**Goes to:** STAGING first, then **LIVE** (release checklist below).
**Migrations:** none. Nothing to run in phpMyAdmin (the `files` and `documents` tables already exist).
**.env:** no change. `STORAGE_ROOT` must point at `…/private/storage` (it already does if you copied `.env.example`).
**`.htaccess`:** no change.
**New one-time step in hPanel:** raise the PHP upload limits (step 0 below).

## What's new
- **Documents** (More → Documents): contracts, receipts, bookings and quotations in one place, linked to payments, vendors and events.
  - **+ → Take photo** or **Choose file** (choose several and each becomes its own document, all with the same links).
  - **Photos are made small on the phone** before upload: longest side 1,600 px, JPEG, with the location (GPS) and camera details removed. A 4 MB phone photo becomes about 200–500 KB.
  - JPEG, PNG, WebP and PDF, up to 10 MB. A bigger file says "This file is too big (14 MB). Max 10 MB."
  - A **progress bar** while it uploads. If it fails: "Not uploaded — Try again"; the file stays in memory, so Try again never needs picking it again. With no internet the Upload button is off and says so.
  - **Same file twice** → "This file is already saved as 'X'." with **Open it** / **Save again**.
  - If your login ends mid-upload, log in on the sheet and the file is sent again by itself.
  - Find by type (Receipt, Contract, Quotation, Booking, ID, Photo, Other) or search by name. Thumbnails load as you scroll.
  - **Document page:** the photo itself, or **Open** for a PDF (your phone's own viewer); **Share** (the phone's share sheet: WhatsApp, Save to Files…); **Download**; Edit details; Delete (with Undo, and in Deleted items for Ayush and Mahi); History.
  - **Private** (Ayush and Mahi only): for IDs and similar papers. Type "ID" is private by default.
  - Who sees what: private → Ayush and Mahi; linked to a payment → only people with money access; everything else → everyone. Family edit and delete only what they uploaded. Viewers only look.
  - Files are never reachable by a web address: only through the app, after login, and never cached.
- **Receipts on payments**
  - Payment page → **Add receipt photo**, and a **Receipts** list.
  - **Mark as paid** has an **Add receipt photo** button. The payment is saved first; if the photo then fails, the payment stays Paid and a red chip says **"Receipt not uploaded — try again"** (tap it to retry).
  - Payments with receipts show a 📎 in the Payments list.
- **Vendor page** and **event page** now have a **Documents** section with Add.
- History's Back button now returns to the payment, vendor, family or document you came from.

## 0. One time: PHP upload limits (hPanel, ≈ 2 minutes) — do this for staging AND live
Hostinger's default upload limit can be lower than our 10 MB.
1. hPanel → **Websites** → the site (staging first) → **Advanced → PHP Configuration** → tab **PHP options**.
2. Set **upload_max_filesize = 12M** and **post_max_size = 16M**. Leave everything else. **Save**.
3. Repeat for the live site.
4. Check the folder exists: **File Manager** → `domains/<site>/private/storage/uploads/` (it is created by the upload ZIP; it must be **outside** `public_html`).

## 1. Staging (≈ 10 minutes)
Standard upload from the **`staging/`** folder → `/api/v1/health` = `{"status":"ok"}` → phone checks below.
The staging ZIP also brings 6 small demo files so the demo documents open (live never gets these).

## 2. Live (after staging passes) — release checklist
1. Live Settings → Safety all green. Step 0 done for live.
2. **Backup now** — SSH: `php ~/domains/wedding.lumorrahouse.com/private/backup/backup.php --kind=manual_db` → `Done in … s.`
3. Save `deploy-session10.zip` to Drive `deploys/`; tell the family group (quiet hour).
4. Standard upload from the **`live/`** folder.
5. Within 10 minutes:
   - Health check says `ok`, and the app refreshes to 1.0.11.
   - More → Documents opens (empty on live).
   - Take a test photo, check it opens, then delete it.
6. From now on, attach real receipts and contracts on live.
7. If anything fails: upload `deploy-session09.zip` (`live/`) the same way. Uploaded files stay where they are.

## Phone checks (staging, then live) — Android and iPhone
Staging logins (password `demo-1234`): Ayush 98290 00001 · Papa 98290 00004 (money) · Kavita 98290 00005 (Family, no money).
On iPhone, do D1 and R7 **from the installed app** (Home Screen icon) as well as in Safari.

| # | Do | Pass when |
|---|---|---|
| D1 | As Papa: Documents → + → **Take photo** of a paper → type **Contract** → Upload | Progress bar; "Document saved"; thumbnail in the list; opens full size; Size on the page is under 1 MB |
| D2 | Upload a PDF (Choose file) → open it → **Open**, then **Share** | The phone's PDF viewer opens; the share sheet offers WhatsApp / Save to Files; back in the app nothing is stuck |
| D3 | As Ayush: open a document → Edit details → turn on **Only Ayush and Mahi** → Save. Log in as **Kavita** | Not in her Documents list |
| D4 | Upload the same photo again | "This file is already saved as …" with Open it / Save again |
| M2 | Open a due payment → **Mark as paid** → **Add receipt photo** → pick a photo → Save as paid | Paid with Undo; the photo appears under **Receipts**; 📎 on the payment in the list |
| R7 | Payment → **Add receipt photo** → **Take photo** | Photo uploads (< 1 MB). iPhone: a photo picked from the gallery (HEIC) also uploads |
| R8 | Open a PDF → Share → Save to Files / open in viewer → come back | App is where you left it, not stuck |
| D5 | As **Kavita**: Documents | The demo receipts linked to payments are **not** listed; the contract is |
| D6 | Turn on airplane mode → Documents → + | "Not uploaded — no internet. Pick the file again when online."; Upload is off |

## Old files to delete later
After 14 days: files in `public_html/assets/` that are not in this ZIP's `2-assets.zip`.
