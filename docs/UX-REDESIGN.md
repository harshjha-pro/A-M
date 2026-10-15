# A&M Wedding Planner — UX Redesign Blueprint

Status: research and design specification; no production UI changes in this document.
Branch: `ux/redesign-blueprint`
Source of truth: `docs/CONTEXT.md`, `docs/DESIGN.md`, `docs/FEATURES.md`, and `web/src/routes.jsx`.

## 1. Goal

Make the existing PWA feel calmer, more polished, and more wedding-specific while improving real task completion for family members who have mixed digital confidence. Design mobile-first for Android Chrome and iPhone Safari, then adapt to desktop. Preserve existing API contracts, permissions, validation, offline outbox, versioned writes, undo, audit history, privacy, and all existing fields.

## 2. UX principles

1. **One obvious next action.** Each screen has one primary action; secondary actions are visually quieter.
2. **Readable before decorative.** Ivory canvas, burgundy actions, muted blush for selected states, champagne/marigold used as a small accent only. Avoid ornamental backgrounds behind dense operational content.
3. **Words alongside icons.** Never make an icon or swipe gesture the only way to perform an action.
4. **Short first, complete when needed.** Put essential fields first; group infrequent fields under a clearly named “More details” section. Do not remove fields or validation.
5. **Immediate and honest feedback.** Distinguish Saving, Saved, Waiting to sync, Offline/read-only, Conflict, and Failed. Never claim a save before the API confirms it.
6. **Safe recovery.** Keep drafts, use Undo for reversible changes, explain conflicts in plain language, and never make destructive actions easy to tap accidentally.
7. **Responsive, not merely shrunk.** Phone layouts use single-column lists and bottom sheets; wide layouts may use a content column with a supporting panel or two-column forms where this improves scanning.
8. **Accessibility by default.** Aim for at least 48px touch targets (stronger than WCAG 2.2 AA’s 24px minimum), base type around 17px, clear focus rings, readable contrast, and text labels for statuses.

## 3. Visual system direction

- **Canvas:** ivory `#FBF7F0`; cards and fields `#FFFFFF`; soft inset surface `#F3ECE1`.
- **Primary:** burgundy `#8A1C2B`; selected background blush `#F7E4E6`.
- **Accent:** marigold/champagne `#E8A317`, reserved for small highlights and wedding countdown details.
- **Text:** `#2A1F1A`; secondary `#5E5048`; borders `#E2D6C4`; strong field border `#8C7A68`.
- Keep the current Atkinson Hyperlegible typeface and phone-following light/dark theme.
- Use consistent spacing, rounded corners, subtle elevation only where it clarifies layering, and restrained iconography.
- Use one status vocabulary and pair colour with words/icons. Do not use colour alone to convey status.

## 4. Shared application shell

### Mobile
- Compact top bar with screen title and only relevant contextual actions.
- Main content respects safe areas and has consistent horizontal padding.
- Fixed bottom navigation stays visible without covering content; scroll containers include bottom padding.
- Floating Quick Add appears only where permitted and opens a role-aware sheet. Keep the visible action label accessible.
- Sheets have a clear title, close control, scrollable content, and a sticky action area when a form is involved.
- Offline and outbox status bars must not obscure page titles or primary actions.

### Desktop/tablet
- Use a constrained content width for forms and detail screens; allow data-heavy lists to expand.
- Keep navigation persistent without consuming excessive width.
- Convert bottom sheets into centered dialogs or side panels where appropriate; retain the same interaction and labels.

### App-wide states
Design and verify: loading skeleton, first-use empty state, filtered-empty state, network/API error with retry, offline read-only, queued write, save success, session-expired login overlay, stale-write conflict, deleted/undo toast, not-found, and permission-restricted actions.

## 5. Page-by-page design scope

### A. Authentication and install
- **Login** (`/login`): clear “A&M Wedding” identity, phone and password fields, show/hide password, large Log in action, concise help copy. Avoid decorative hero art that pushes the form below the fold.
- **Set password** (`/set-password`): explain one-time invitation link and expiry, password requirements next to the field, confirmation and actionable errors.
- **First owner setup** (`/setup`): step-by-step setup with progress and no ambiguous secondary path.
- **Install guide** (`/install`): separate illustrated iPhone and Android instructions, with current platform surfaced first and a clear “Open app” return path.

### B. Home and calendar
- **Home** (`/`): wedding cover/photo area with monogram; countdown; upcoming events; “My tasks”; everyone’s overdue work; recent activity for admins. Use strong hierarchy and keep operational cards concise. Provide an explicit empty state when photos or planning data have not been added.
- **Calendar** (`/calendar`): Month as default; obvious Month/Agenda switch; selected date detail; Events and Tasks filters; “Only mine / Everyone”; uncluttered date markers. Admin-only + offers Add event/Add task. Include undated events and empty days clearly.
- **Event detail** (`/calendar/events/:id`): event date/time/venue first, associated tasks and guest summary next, edit action only for admins, with clear back navigation.
- **Add/edit event** (`/calendar/events/new`, `/calendar/events/:id/edit`): name/type/date/time first; optional fields grouped below; fixed Save action; show field-level errors and preserve draft on failure.

### C. Tasks
- **Task list** (`/tasks`): search, status filters/counts, due-date emphasis, priority, assignee, workspace/event context, and one-tap completion with Undo. Avoid making the row visually noisy.
- **Task detail** (`/tasks/:id`): title and status at top; due date and priority grouped; assignees, checklist, notes, linked event/workspace, and history clearly separated. Keep task ID findable but visually secondary.
- **Add/edit task** (`/tasks/new`, `/tasks/:id/edit`): title, due date shortcut chips, and assignee first; status/priority and associations remain available; advanced fields are grouped, never discarded. Admin-only creation remains enforced; eligible family editors can edit/tick tasks according to existing permissions.

### D. Families and guest coordination
- **Family list** (`/guests`): count families and people; fast search; Bride/Groom/Both side filters; event-specific “Coming?” filter; additional filters in a sheet; clear VIP/duplicate indicators; selection mode with a visible Select button.
- **Family detail** (`/guests/:id`): family name, phone/call/WhatsApp actions, side, adult/child counts, food/Jain details, event invitations and Coming? statuses, notes, and history. Keep contact actions explicit.
- **Add/edit family** (`/guests/new`, `/guests/:id/edit`): name, phone, side, adults/children and invite-to-event choices first; group location, food, alternate phone and notes under More details. Preserve sticky defaults where implemented.
- **Reminder stepper** (`/guests/remind`): preview recipient count, message, and selected event before opening WhatsApp; make back/edit steps safe.
- **Import** (`/guests/import`): staged flow: choose file → preview new/duplicate/error rows → resolve or skip issues → confirm import → show undo route. Never hide destructive/bulk consequences.

### E. Money and vendors
- **Money overview** (`/money`): planned, due, and paid amounts with clear definitions; upcoming dues and recent payments; hide money details for users without permission.
- **Payment list** (`/money/payments`): searchable list with paid/due state, amount, payee, due/paid date, and filters.
- **Payment detail** (`/money/payments/:id`): amount and status, payee, dates, method/reference, receipt, linked event and history.
- **Add/edit payment** (`/money/payments/new`, `/money/payments/:id/edit`): payee, amount, due date or Paid already first; payment method/date/reference/receipt in details. Duplicate warnings must offer “Open existing” and “Save anyway.” Money values/status are never silently auto-merged in conflicts.
- **Vendor list/detail/form** (`/vendors`, `/vendors/:id`, `/vendors/new`, `/vendors/:id/edit`): name, category, phone and call/WhatsApp actions; linked payments and workspace roles; optional details stay secondary.

### F. Documents and Attachment Vault
- **Documents** (`/documents`, `/documents/:id`, `/documents/:id/edit`): obvious file type, title, private indicator, linked record, and accessible preview/open/download action.
- **Vault** (`/vault`): search by title and attachment ID; filter by type; list “where it is used”; distinguish unlinking from deleting everywhere; show upload progress and storage warning without blocking unrelated work.
- **Attachment detail** (`/vault/:id`): preview/metadata, editable unique ID with inline validation, links to every usage location, favourite/vendor/task relationships, and explicit unlink versus global delete actions.

### G. Workspaces and outfits
- **Workspace list** (`/workspaces`): function/event name, linked calendar event, task progress, and concise sections summary. Make it easy to resume the last workspace.
- **Workspace detail** (`/workspaces/:id`): overview and section navigation for Bride/Groom outfits, Family outfits, Theme & decoration, Menu, Contacts, Guest details, and Event timeline. On mobile, use a clear section list or tabs that do not overflow.
- **Outfit detail** (`/outfits/:id`): person/group, editable timeline stages, stage dates/notes/attachments/tasks, moodboard, accessories, vendor, and notes. Timeline order and completion state must be readable without relying on colour.
- Each workspace section should reuse the same header, section navigation, task links, attachment picker, vendor picker, and empty-state patterns.

### H. Settings, activity, safety
- **More** (`/more`): grouped links by purpose, not a long unstructured list.
- **Settings** (`/settings`): sections for wedding details, members, account, home photos, phone/PWA, data safety, export, imports, deleted items, activity and history.
- **Wedding details** (`/settings/wedding`): simple labeled form and clear save state.
- **Members list/form** (`/settings/members`, `/settings/members/new`, `/settings/members/:id`): role and permissions in plain language; destructive access changes require clear confirmation.
- **My account** (`/settings/account`): account details and theme preference.
- **Home photos** (`/settings/home-photos`): order, upload state, preview, remove/undo; explain photo limits.
- **This phone** (`/settings/phone`): version/update, install state, waiting changes and “Fix the app” without implying queued data is cleared.
- **Waiting changes** (`/settings/waiting`): queued operations with what is waiting, retry/discard where supported, and a plain explanation of offline restrictions.
- **Safety** (`/settings/safety`): backup/health status and warnings with last-run timestamps.
- **Activity/history** (`/settings/activity`, `/settings/wedding/history`, `/history/:resource/:id`): readable who/what/when entries; hide money fields according to permissions.
- **Deleted items** (`/settings/deleted`): type, deletion time, restore and Undo behavior.
- **Exports/import history** (`/settings/export`, `/settings/imports`): explain scope, privacy, expiry, and irreversible consequences before starting.

### I. Global fallback
- **Not found** (`*`): plain-language message, one “Go to Home” action, preserve a sensible back path where possible.
- **Quick Add sheet**: role-aware actions, clear type labels, module-aware prefilled links, no hidden permission failures.

## 6. Interaction and content rules

- Use the exact existing domain vocabulary: “Family” for invitation household, “Coming?” for RSVP, “Done” for completed task, “Deleted items” for trash.
- Use IST for wedding dates and times.
- Keep admin-only task/event creation enforced in UI and API. UI visibility is not security.
- Never expose guest phone numbers or private attachments on public pages; keep authentication and privacy behavior unchanged.
- Keep offline support honest: only operations explicitly supported by the current outbox can queue; money, events, imports, uploads, deletes and settings must not appear to save offline.
- Preserve version checks, idempotency keys, soft-delete/Undo, conflict resolution, audit log, export and backup flows.
- Use inline validation beside the field and a concise summary when multiple fields fail.
- For empty states, tell the user what the page is for and give one relevant next action if their role permits it.

## 7. Acceptance criteria for the redesign

- Every route listed in `web/src/routes.jsx` is accounted for in design inventory.
- Mobile and desktop behavior are specified for every reusable screen pattern.
- Primary action is obvious and no important action relies only on a gesture.
- Interactive targets are at least 48px wherever practical; base body text is about 17px and scales with device text settings.
- All key statuses remain understandable in monochrome and with assistive technology.
- Forms retain all current fields, validations, draft persistence, conflict rules, and save semantics.
- Permission behavior matches existing API and product decisions.
- No production data, API contract, database migration, or deployment setting changes as part of visual redesign alone.
- Test the highest-frequency flows with a family editor and a viewer, not only an admin: open task, mark Done/Undo, add/edit family, set Coming?, open workspace, and inspect a document.
- Verify on iPhone Safari and Android Chrome, in light/dark mode, with offline/online transitions and a narrow 320px viewport.

## 8. Research references

- W3C WAI, WCAG 2.2 target size minimum: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- W3C WAI, enhanced target size explanation: https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html
- Design Guidelines of Mobile Apps for Older Adults: Systematic Review and Thematic Analysis (JMIR, 2023): https://mhealth.jmir.org/2023/1/e43186

These sources support generous targets, visible interactive affordances, readable text, and testing with users. The existing project docs remain the authority for product behavior.
