# API route inventory

Generated from `docs/openapi.yaml` by `tools/docs/route-inventory.py` — 182 operations.

Who: Adm = Ayush and Mahi · Ed = anyone who edits (not Viewer) · Money = money users · All = everyone logged in.

| Area | Method | Path | Who | What |
|---|---|---|---|---|
| Auth | POST | `/auth/login` | Anyone | Log in with phone and password |
| Auth | POST | `/auth/logout` | Self | Log out this phone |
| Auth | POST | `/auth/logout-all` | Self | Log out all my phones |
| Auth | POST | `/auth/password-link/complete` | Anyone | Set a password from a link and log in |
| Auth | POST | `/auth/password-link/inspect` | Anyone | Check an invite or reset link before showing the form |
| Auth | POST | `/auth/password-reset/request` | Anyone | Email a reset link. Off until MAIL_ENABLED. Always 202. |
| Auth | POST | `/auth/password/change` | Self | Change my password. Other sessions are revoked; this one gets a new cookie. |
| Auth | GET | `/session` | Self | Current user, permissions and CSRF token. This is the refresh (slides the 90 days). |
| Auth | POST | `/setup/owner` | Holder of SETUP_TOKEN | First run only. Creates the Owner. Disabled once an owner exists. |
| Dashboard | GET | `/calendar` | All (payments only $) | Events, open tasks with a due date, and due payments ($) in a date range |
| Dashboard | GET | `/dashboard` | All (cards filtered by role and money) | All Home cards this user may see, in one call |
| Dashboard | GET | `/home-photos` | All | Home photos (cover slideshow, couple photos, monogram), by place then order. meta.max gives each place's limit. |
| Dashboard | POST | `/home-photos` | Adm | Add one photo (max 3 MB; JPEG, PNG, WebP). Stored in the database. Up to 8 cover, 4 couple, 1 monogram (422 when full). |
| Dashboard | DELETE | `/home-photos/{id}` | Adm | Soft delete (Undo for 10 minutes). The bytes stay. |
| Dashboard | PATCH | `/home-photos/{id}` | Adm | Change the order. The image and its place never change. |
| Dashboard | GET | `/home-photos/{id}/image` | All (deleted ones Adm) | The image bytes. The URL carries ?v=<hash>, so the service worker can keep a copy. |
| Documents | GET | `/documents` | All (filtered by visibility) | Documents this user may see |
| Documents | POST | `/documents` | Ed (payment link needs $; is_private Adm) | Upload one file (max 10 MB; JPEG, PNG, WebP, PDF) with details |
| Documents | DELETE | `/documents/{id}` | Adm; Family own uploads | Soft delete (file stays on disk) |
| Documents | GET | `/documents/{id}` | Visible to user | Document details |
| Documents | PATCH | `/documents/{id}` | Adm; Family own uploads | Edit details. The file never changes. |
| Documents | GET | `/documents/{id}/file` | Visible to user | Stream the file after an auth and visibility check. Never a public URL. |
| Events | GET | `/events` | All | All events (not paged) |
| Events | POST | `/events` | Adm | Add a custom event |
| Events | DELETE | `/events/{id}` | Adm | Soft delete; invitations go in the same batch |
| Events | GET | `/events/{id}` | All | Event page with counts |
| Events | PATCH | `/events/{id}` | Adm | Edit an event |
| Events | GET | `/events/{id}/delete-preview` | Adm | Counts shown in the delete dialog |
| Events | GET | `/events/{id}/headcount` | All | People coming, waiting, not asked, not coming, Jain |
| Export | GET | `/exports` | Adm | Recent exports |
| Export | POST | `/exports` | Adm | Take a consistent snapshot and prepare the ZIP |
| Export | GET | `/exports/{id}` | Adm | One export |
| Export | GET | `/exports/{id}/download` | Adm, or holder of the export token | Stream the ZIP (built while streaming). Admin session or the export token. |
| Export | GET | `/exports/{id}/summary` | Adm, or holder of the export token | The export's summary.html on its own, for Print → Save as PDF (FEATURES B8). Same access as the download. |
| Guests | GET | `/households` | All | Guest list (families). meta.totals.people for the filter. |
| Guests | POST | `/households` | Ed | Add a family, optionally with invitations |
| Guests | POST | `/households/bulk` | Ed; the delete action is Adm only | One action on up to 2,000 families, one batch, one Undo |
| Guests | GET | `/households/duplicate-check` | Ed | Duplicate hints while typing |
| Guests | GET | `/households/export` | Adm | Filtered guest list as CSV (UTF-8 BOM, IST, formula-safe). Audited. |
| Guests | GET | `/households/suggestions` | Ed | Autocomplete values |
| Guests | DELETE | `/households/{id}` | Ed | Soft delete with invitations |
| Guests | GET | `/households/{id}` | All | Family page with invitations |
| Guests | PATCH | `/households/{id}` | Ed | Edit a family (only changed fields) |
| Guests | DELETE | `/households/{id}/invitations/{event_id}` | Ed | Remove from event (soft, with Undo) |
| Guests | PATCH | `/households/{id}/invitations/{event_id}` | Ed | RSVP and expected counts. If-Match is the invitation's version. |
| Guests | PUT | `/households/{id}/invitations/{event_id}` | Ed | Invite (create or revive). Already invited returns 200 unchanged. |
| Guests | POST | `/households/{id}/invitations/{event_id}/whatsapp-opened` | Ed | Record a WhatsApp reminder tap. No version bump. Never means sent. |
| Health | POST | `/client-log` | Anyone | Phone-side error report (TESTING §9.3). Written to private/logs/client-error.log only. |
| Health | GET | `/health` | Anyone (details Adm) | Health. Anonymous gets ok/fail only; admins get details. |
| History | GET | `/activity` | Adm | Activity feed |
| History | GET | `/{resource}/{id}/history` | Anyone who can see the record | Plain-sentence history of one record. Money fields hidden for non-money users. |
| Imports | GET | `/imports` | Adm | Past imports |
| Imports | POST | `/imports` | Adm | Run the import in one transaction and one batch |
| Imports | POST | `/imports/preview` | Adm | Check rows. Writes nothing. |
| Imports | GET | `/imports/{id}` | Adm | One import |
| Imports | POST | `/imports/{id}/undo` | Adm | Undo this import (no 10-minute limit). Rows edited since are kept and listed. |
| Members | GET | `/me/sessions` | Self | My logged-in phones |
| Members | GET | `/members` | All | All members (not paged). Family and Viewer get id, name, phone, role, left only. |
| Members | POST | `/members` | Adm | Add a member and set a password or make an invite link |
| Members | GET | `/members/{id}` | Adm, Self | One member with last seen and devices |
| Members | PATCH | `/members/{id}` | Adm; Self (name only) | Edit a member. Deactivate with is_active false. Members are never deleted. |
| Members | GET | `/members/{id}/access` | Adm | Access history (1.0.24) — recent log-ins (worked or not), phones (last used, logged out and why), password changes. No IP addresses or tokens. |
| Members | POST | `/members/{id}/password-reset` | Adm (Partner cannot reset the Owner) | Admin reset. Revokes all of that member's sessions. |
| Money | GET | `/budget-categories` | $ | Budget categories |
| Money | POST | `/budget-categories` | $ | Add a category |
| Money | DELETE | `/budget-categories/{id}` | Adm | Delete. With payments, move_payments_to is required. Fallback can't be deleted. |
| Money | PATCH | `/budget-categories/{id}` | $ | Rename, plan or reorder |
| Money | GET | `/money/summary` | $ | Totals card and per-category table |
| Money | GET | `/payments` | $ | Payments and expenses. meta.totals has amount_paise, due_paise, paid_paise. |
| Money | POST | `/payments` | $ | Add a payment or expense (optionally creating the vendor) |
| Money | POST | `/payments/bulk` | Money | Change category or event for up to 500 payments; one batch, one Undo. Never paid, amount or delete in bulk. |
| Money | GET | `/payments/export` | Money | The chosen payments as CSV (formula-safe). Audited. |
| Money | DELETE | `/payments/{id}` | $ | Soft delete with receipts |
| Money | GET | `/payments/{id}` | $ | One payment with receipts |
| Money | PATCH | `/payments/{id}` | $ | Edit a payment |
| Money | POST | `/payments/{id}/mark-paid` | $ | Mark a due payment paid |
| Money | POST | `/payments/{id}/pay-part` | $ | New Paid row + Due row reduced, in one batch |
| Money | GET | `/vendors` | All | Vendor contacts (amounts only for $) |
| Money | POST | `/vendors` | Ed (agreed amount only $) | Add a vendor |
| Money | POST | `/vendors/bulk` | Ed; delete is Adm only | Change type or booked for up to 500 vendors, or delete them; one batch, one Undo; vendors changed after as_of are skipped and named |
| Money | GET | `/vendors/export` | Ed | The chosen vendors as CSV (formula-safe); agreed, paid and due columns only for money users. Audited. |
| Money | DELETE | `/vendors/{id}` | Adm | Soft delete. Payments keep the link. |
| Money | GET | `/vendors/{id}` | All | Vendor page. Money users also get balance. |
| Money | PATCH | `/vendors/{id}` | Ed (agreed amount only $) | Edit a vendor |
| Settings | GET | `/backups` | Adm | Last backup runs |
| Settings | GET | `/restore-drills` | Adm | Restore drill log |
| Settings | POST | `/restore-drills` | Adm | Log a restore drill |
| Settings | DELETE | `/restore-drills/{id}` | Adm | Soft delete a drill entry |
| Settings | PATCH | `/restore-drills/{id}` | Adm | Fix a drill entry |
| Settings | GET | `/settings` | All | Wedding facts (total budget only for money users) |
| Settings | PATCH | `/settings` | Adm | Edit wedding facts |
| Settings | GET | `/settings/history` | Adm | History of settings changes |
| Sync | GET | `/sync` | All (rows filtered as in normal endpoints) | Changes since a timestamp, for the read-only offline cache |
| Tasks | GET | `/tags` | All | All tags with task counts |
| Tasks | POST | `/tags` | Ed | Create a tag |
| Tasks | DELETE | `/tags/{id}` | Adm | Soft delete; removes it from tasks in the same batch |
| Tasks | PATCH | `/tags/{id}` | Adm | Rename a tag |
| Tasks | GET | `/tasks` | All | Tasks with view chips, filters and search |
| Tasks | POST | `/tasks` | Ed | Create a task |
| Tasks | POST | `/tasks/bulk` | Ed; Family may delete only tasks they made or are assigned to; set_workspace needs workspace write | One change on up to 500 tasks (status, priority, due date, event, workspace, add/remove people or tags, done, delete), one batch, one Undo. Tasks changed after as_of are skipped and named. |
| Tasks | GET | `/tasks/check-code` | All | Is this task ID free? (3–30 letters, numbers, - or _; unique across tasks, capitals ignored) |
| Tasks | GET | `/tasks/export` | Ed | The chosen tasks as CSV (UTF-8 BOM, formula-safe). Audited. |
| Tasks | DELETE | `/tasks/{id}` | Adm any task; Family own tasks only (created by or assigned to them) | Soft delete with checklist, assignees and tags |
| Tasks | GET | `/tasks/{id}` | All | One task with assignees, tags and checklist |
| Tasks | PATCH | `/tasks/{id}` | Ed | Edit a task. Lists given here replace the whole list and bump the task version. |
| Tasks | POST | `/tasks/{id}/done` | Ed | Tick done. If already done, 200 with meta.already_done. |
| Tasks | POST | `/tasks/{id}/items` | Ed | Add a checklist item. key = the item's UUID = Idempotency-Key. |
| Tasks | DELETE | `/tasks/{id}/items/{key}` | Ed | Remove an item (soft) |
| Tasks | PATCH | `/tasks/{id}/items/{key}` | Ed | Tick, rename or reorder one item. If-Match is the item's version. |
| Trash | POST | `/accessories/{id}/restore` | Adm | Restore (Accessory) |
| Trash | POST | `/attachment-links/{id}/restore` | Adm | Restore a removed link |
| Trash | POST | `/attachments/{id}/restore` | Adm | Restore a deleted attachment (and the links deleted with it) |
| Trash | POST | `/budget-categories/{id}/restore` | Adm | Restore a deleted category (blocked if its name is now used) |
| Trash | POST | `/documents/{id}/restore` | Adm | Restore a deleted document |
| Trash | POST | `/events/{id}/restore` | Adm | Restore a deleted event with its same-batch invitations (same as the shared Restore path item) |
| Trash | POST | `/home-photos/{id}/restore` | Adm | Restore a deleted Home photo (422 when its place is full) |
| Trash | POST | `/households/{id}/restore` | Adm | Restore a deleted family with its same-batch invitations. A phone clash restores anyway and warns (meta.warnings). |
| Trash | POST | `/menu-categories/{id}/restore` | Adm | Restore (MenuCategory) |
| Trash | POST | `/menu-items/{id}/restore` | Adm | Restore (MenuItem) |
| Trash | POST | `/notes/{id}/restore` | Adm | Restore (Note) |
| Trash | POST | `/outfit-steps/{id}/restore` | Adm | Restore (OutfitStep) |
| Trash | POST | `/outfits/{id}/restore` | Adm | Restore |
| Trash | POST | `/payments/{id}/restore` | Adm | Restore a deleted payment with its same-batch receipts |
| Trash | POST | `/restore-drills/{id}/restore` | Adm | Restore a deleted drill entry (same as the shared Restore path item) |
| Trash | POST | `/tags/{id}/restore` | Adm | Restore a deleted record and its same-batch children (same as the shared Restore path item) |
| Trash | POST | `/tasks/{id}/restore` | Adm | Restore a deleted record and its same-batch children (same as the shared Restore path item) |
| Trash | POST | `/timeline-steps/{id}/restore` | Adm | Restore (TimelineStep) |
| Trash | GET | `/trash` | Adm | Deleted items, one row per batch, newest first |
| Trash | DELETE | `/trash/{batch_id}` | Own | Purge for good. Later. Always 403 before 16 May 2027. |
| Trash | GET | `/trash/{batch_id}` | Adm | Items inside one batch |
| Trash | POST | `/trash/{batch_id}/restore` | Adm | Restore a whole batch or chosen items |
| Trash | POST | `/undo/{batch_id}` | The person who acted | Undo own action within 10 minutes |
| Trash | POST | `/vendors/{id}/restore` | Adm | Restore a deleted vendor |
| Trash | POST | `/workspace-contacts/{id}/restore` | Adm | Restore (WorkspaceContact) |
| Trash | POST | `/workspaces/{id}/restore` | Adm | Restore a deleted workspace (422 if a live one has the same name) |
| Vault | POST | `/attachment-links/bulk` | Adm | Use up to 100 Vault files in one place (add), or take them out of this place only (remove). One batch, one Undo; the files stay in the Vault. |
| Vault | DELETE | `/attachment-links/{id}` | Adm | Remove from one place only (the attachment stays in the Vault; Undo) |
| Vault | POST | `/attachment-uploads` | Adm | Start sending a file of any size in 2 MB pieces. A file already in the Vault (same SHA-256 and size) replies complete = true. |
| Vault | POST | `/attachment-uploads/{id}/chunks` | Adm | One piece (seq from 0; 2 MB except the last). Sending a piece again stores it once. |
| Vault | POST | `/attachment-uploads/{id}/finish` | Adm | Check every piece and the SHA-256 of the whole (422 upload_incomplete with received, or checksum_mismatch) |
| Vault | GET | `/attachments` | Adm | The Attachment Vault — every attachment with "where it's used". meta.storage = database size against the 3 GB limit. |
| Vault | POST | `/attachments` | Adm | Add an attachment (finished upload, link or text), optionally used in a workspace section at once. code defaults to the next ATT-000001. |
| Vault | GET | `/attachments/check-code` | Adm | Is this ID free? (unique across the app, capitals ignored; deleted ones keep theirs) |
| Vault | DELETE | `/attachments/{id}` | Adm | Delete everywhere (its links go in the same batch; Undo). A document is deleted in Documents (422). |
| Vault | GET | `/attachments/{id}` | Adm | One attachment with every place it is used |
| Vault | PATCH | `/attachments/{id}` | Adm | Edit the ID (unique), title, note, link, text, favourite, vendor, task |
| Vault | GET | `/attachments/{id}/file` | Adm | The bytes, streamed piece by piece; single byte ranges (206) so videos play on iPhone |
| Vault | POST | `/attachments/{id}/links` | Adm | Use the attachment in one more place (a second link to the same place changes nothing) |
| Workspaces | DELETE | `/accessories/{id}` | Adm | Soft delete (Accessory) with Undo |
| Workspaces | PATCH | `/accessories/{id}` | Adm | Edit (Accessory) |
| Workspaces | DELETE | `/menu-categories/{id}` | Adm | Soft delete (MenuCategory) with Undo — its dishes and their attachment links go with it; tasks stay |
| Workspaces | PATCH | `/menu-categories/{id}` | Adm | Edit (MenuCategory) |
| Workspaces | POST | `/menu-categories/{id}/items` | Adm | Add a dish (Normal or Jain, must-have, note); replies with the whole menu |
| Workspaces | DELETE | `/menu-items/{id}` | Adm | Soft delete (MenuItem) with Undo |
| Workspaces | PATCH | `/menu-items/{id}` | Adm | Edit (MenuItem) |
| Workspaces | POST | `/notes` | Adm | Add a note to exactly one of outfit_id, accessory_id, outfit_step_id |
| Workspaces | DELETE | `/notes/{id}` | Adm | Soft delete (Note) with Undo |
| Workspaces | PATCH | `/notes/{id}` | Adm | Edit (Note) |
| Workspaces | DELETE | `/outfit-steps/{id}` | Adm | Soft delete (OutfitStep) with Undo |
| Workspaces | PATCH | `/outfit-steps/{id}` | Adm | Edit (OutfitStep) |
| Workspaces | POST | `/outfits` | Adm | Add an outfit (bride, groom, family) with the default timeline Selected → Stitched → Trial done → Final approved, or a decor item (person decor) with Booked → Sample seen → Final approved → Set up |
| Workspaces | DELETE | `/outfits/{id}` | Adm | Soft delete with its steps, accessories, notes and attachment links (one Undo); tasks stay |
| Workspaces | GET | `/outfits/{id}` | Adm | The outfit page: timeline (each step with notes, attachments, tasks), moodboard, accessories, notes, tasks |
| Workspaces | PATCH | `/outfits/{id}` | Adm | Rename, set the vendor, or reorder |
| Workspaces | POST | `/outfits/{id}/accessories` | Adm | Add an accessory |
| Workspaces | POST | `/outfits/{id}/steps` | Adm | Add a timeline step (at the end) |
| Workspaces | DELETE | `/timeline-steps/{id}` | Adm | Soft delete (TimelineStep) with Undo — its attachment links go with it; tasks stay |
| Workspaces | PATCH | `/timeline-steps/{id}` | Adm | Edit (TimelineStep) |
| Workspaces | POST | `/timeline-steps/{id}/move` | Adm | Swap a step with the one above or below it |
| Workspaces | DELETE | `/workspace-contacts/{id}` | Adm | Soft delete (WorkspaceContact) with Undo — only unlinks the vendor |
| Workspaces | PATCH | `/workspace-contacts/{id}` | Adm | Edit (WorkspaceContact) |
| Workspaces | GET | `/workspaces` | Adm | Every workspace, in order (Ayush and Mahi only). meta.sections lists the section keys. |
| Workspaces | POST | `/workspaces` | Adm | Add a workspace (name unique; one workspace per calendar event) |
| Workspaces | DELETE | `/workspaces/{id}` | Adm | Soft delete with its attachment links (Undo). Its tasks stay. |
| Workspaces | GET | `/workspaces/{id}` | Adm | One workspace with its tasks (for the strip at the top) |
| Workspaces | PATCH | `/workspaces/{id}` | Adm | Rename, link to a calendar event, reorder, notes |
| Workspaces | POST | `/workspaces/{id}/contacts` | Adm | Link a vendor to this workspace as a contact (one vendor can be in many workspaces); replies with the planning block |
| Workspaces | GET | `/workspaces/{id}/menu` | Adm | The menu of a workspace: caterer, counts, categories with their dishes (each with attachments and tasks) |
| Workspaces | POST | `/workspaces/{id}/menu-categories` | Adm | Add a menu category (at the end); replies with the whole menu |
| Workspaces | POST | `/workspaces/{id}/menu/copy` | Adm | Copy another workspace's menu here: same-named categories get the missing dishes, the rest come as new categories; one Undo (meta.undo) takes it back |
| Workspaces | POST | `/workspaces/{id}/timeline` | Adm | Add an event timeline step (at the end); purpose and duration required, time optional |
| Workspaces | POST | `/workspaces/{id}/timeline/suggested` | Adm | Add the suggested steps for this workspace (by its name, or general ones) to an empty timeline; 409 when it has steps |
