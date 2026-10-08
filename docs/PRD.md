# PRD.md — Ayush & Mahi Wedding Planner

Version 1.1 · 8 Oct 2026 · Owner: Ayush Porwal · v1.1: one R1 launch, Excel import, Business plan, daily + off-site backups
Reads from: `CONTEXT.md` (source of truth) and `Wedding_Planner_App_Specification.docx`.

**Assumptions (until CONTEXT.md open questions are answered):**

- Release 1 launches complete, in one go (owner's decision). No Day-1 slice.
- All 7 events fall on 14–16 Feb 2027 (Sun–Tue). If the Engagement is earlier, its milestones move up.
- Ayush builds the app part-time, alongside his own wedding work.

---

## 1. Problem

Today the wedding runs on an Excel/Google sheet, WhatsApp groups and people's memory. With 7 events and about 1,800 guests, that breaks in specific ways.

| What goes wrong | Example |
|---|---|
| Many copies of the guest list | Mummy's notebook, Papa's sheet and Mahi's family list disagree. Families get two cards or none. |
| Per-event lists get lost | Mayra and Haldi are close family. Reception is everyone. Nobody knows who is invited to what. |
| Headcount is a guess | The halwai wants a per-event plate count. The number comes from memory, not from RSVPs. |
| Payments slip | Advance paid in cash, receipt photo stuck in someone's WhatsApp. Balance due date forgotten until the vendor calls. |
| Tasks live in chats | "Who is calling the tent wala?" is asked in the group, answered, then scrolled away. |
| Sheets get overwritten | Two people edit the same cell, or one sorts a column and breaks rows. No undo, no history. |
| Elders are left out | Older family members can't use sheets on a phone. They phone someone instead, and information gets lost. |
| No single view of the days | On 14–16 Feb, timings, vendor numbers and room lists sit on five phones with bad venue network. |
| Rooms are allotted on paper | Outstation families arrive and nobody knows their room. |

---

## 2. Goals and non-goals

### Goals and success criteria

| Goal | Measure | Target |
|---|---|---|
| One place for the plan | Shared sheet / Excel retired | By 8 Nov 2026 (2 clean weeks after launch) |
| Couple use it daily | Days per week each partner opens the app | 5+ days, every week from 1 Nov |
| Family actually use it | Family editors active weekly | ≥ 4 people from Nov |
| Zero data loss | Records lost or unrecoverable | 0, ever |
| Backups work | Nightly backup success; monthly restore drill passed | 100%; 1 per month, logged |
| Easy for elders | A parent adds a guest family unaided | < 30 seconds |
| Complete guest list | Families entered | All by 30 Nov (list freeze) |
| Known headcount | Families with RSVP for each event they're invited to | ≥ 90% by 31 Jan |
| No missed payments | Payments with a due date that have a reminder | 100% from 15 Nov |
| Reminders don't die quietly | "Last reminder run" older than 30 min | Never, 1 Jan – 20 Feb |
| Wedding days run from the app | Wedding-day mode passes an airplane-mode dry run | 2 iPhones + 2 Androids, by 24 Jan |

### Non-goals

- Serving any other wedding, planner business or paying user.
- Guests logging in or using the app.
- Replacing WhatsApp for chat. We only create share links.
- Designing invitation cards. Use the printer or Canva.
- Hosting full photo galleries.
- Native app-store apps before the wedding.

---

## 3. Users and jobs-to-be-done

Roles come from CONTEXT.md §3. Money access is a per-user switch ("Can see money"), set by an admin. It is OFF by default for everyone except the couple (pending Open Question 8).

| User | Top jobs | Must NOT be able to |
|---|---|---|
| **Couple (Admin)** — Ayush, Mahi | See today's and overdue work. Track budget vs spend. Never miss a payment. Know headcount per event. Assign work to family. Recover anything deleted. Export everything. | Hard-delete data before 3 months after the wedding. Edit or erase the audit log. |
| **Parents / family (Editor)** | Add and update families on their side. Mark RSVPs after phone calls. Tick off tasks assigned to them. Upload a receipt or contract. Share event details on WhatsApp. | Manage users or roles. Change settings. Empty Trash. Export all data, since it holds 1,800 phone numbers. View the audit log. See budget or payments unless "Can see money" is on. |
| **Elders (Viewer)** | Check what is happening when and where. Call a vendor or family from the app. | Edit anything. See money. Export. |
| **Planner (optional, Editor)** | Track vendor tasks and the wedding-day timeline. Call vendors. Read guest and room lists. | Everything an Editor can't. Also no money by default, and no access after 20 Feb 2027 (account expires). |

The planner is a normal Editor account on our wedding. It is not a planner product (CONTEXT.md §4, decision 1).

---

## 4. Release plan

Planning-season needs set these dates (see §5). Payments and guest-list building are happening **now**. Cards go out in **December**. Wedding-day needs peak in **February**.

| Release | Target | In | Out | Done when |
|---|---|---|---|---|
| **R1 — full launch** | Sun 25 Oct 2026 | Everything in FEATURES.md Part B: login and members, settings, dashboard, tasks, events with agenda + month calendar, guest families + per-event RSVP, **Excel/CSV import with in-app template**, budget, payments, light vendors, documents, full export, Trash/Undo, audit log, Install Guide. All data safety (§7) and backups. | Reminders/push, global search, wedding-day mode, week/day calendar views | All AC in FEATURES.md pass on 1 iPhone (installed) + 1 Android. Guest Excel imported with duplicates resolved. Every advance paid so far entered with a receipt. First off-site backup received; restore drill #1 passed. 2 parents each add a family in < 30 s. |
| **Pre-launch (no app)** | 8–24 Oct | Owners fill the **Excel guest template** (`AM_Guest_List_Template.xlsx`) and keep payments in the sheet | — | Template filled for at least one side by 24 Oct |
| **R2a** | Sun 15 Nov | Reminders (cron + Web Push + email fallback + health check + "Send test reminder"). Global search. "Card given" / "E-invite sent" per family. Printable lists (by side, area, event). | Wedding-day offline | A test payment reminder arrives on an installed iPhone (16.4+), an Android, and by email. Health check green for 7 days. |
| **R2b** | Sun 10 Jan | Wedding-day mode: timeline per event, vendor contacts, guest and room lists cached offline and printable. Room/hotel and arrival fields on families get a room list view. | Seating, transport module | Airplane-mode dry run passes on 2 iPhones + 2 Androids by 24 Jan. Printed packet reviewed by family. |
| **R3** | Only if a feature passes §4.1 by 20 Dec; otherwise after the wedding | Candidates: Hindi/Hinglish labels; transport list | Everything cut in §4.1 | Feature is used by named people in its first week. |
| **Later / maybe** | After 20 Feb 2027 | AI assistant, Capacitor apps, guest self-RSVP portal | — | — |

**Freezes:**

- Feature freeze: Sun 24 Jan. After this date, only fixes go in.
- Deploy freeze: Wed 10 Feb – Fri 19 Feb. No deploys during the events.

### 4.1 Features challenged

Rule: a feature earns a place only if it is needed **before the date the wedding needs it**, and a task, tag, note or field can't do the job.

| Feature (spec / your R2–R3) | Verdict | Why |
|---|---|---|
| Shopping, outfits, jewelry modules | **Cut.** Use tasks + tags + expenses. | Lehengas and jewelry are ordered Oct–Nov. A Dec module arrives after the purchases. |
| Accommodation module | **Cut.** Hotel, room and check-in fields on the family, plus a room list in R2b. | That covers allotment and the wedding-day list. |
| Transport module | **Cut for now.** Use a "pickup needed" flag, an arrival note, and tasks. | Rebuild only if more than ~20 families need pickups. |
| Seating | **Cut.** | 1,800-guest functions are buffet and open seating. Confirm there is no seated dinner. |
| Invitations (designer, digital invite builder) | **Cut.** Keep "card given" tracking and wa.me e-invites in R2a. | Cards are printed outside the app. Tracking is the part that matters, and it's needed in Dec, not in R3. |
| Hindi UI | **Decide 20 Dec.** All UI text goes in one strings file from day 1. | Elders will have learned the English UI by then. Translation only pays if viewers are struggling. |
| Vendors in depth (quotes, comparison) | **Cut.** | Peak-season bookings close in Oct. Comparison would arrive too late. |
| Calendar week/day views, drag-and-drop | **Cut.** Agenda + month only. | Hard on small screens and adds little. |
| Task sizes, project tasks | **Cut.** Use a simple checklist inside a task. | Fewer fields for 3/5 users. |
| Photo albums, moodboards | **Cut.** | Galleries stay external (CONTEXT.md decision 13). |
| Reports module | **Cut.** | Dashboard counts and printable lists answer the real questions. |
| Guest self-RSVP portal | **Later.** | RSVP happens by phone. A public page exposes guest data and adds attack surface. |
| AI assistant | **Later.** | No job it does better than the dashboard before Feb. |
| Capacitor apps | **Later.** | The PWA covers both platforms. App-store work adds risk with no wedding benefit. |
| Global search | **Keep** (R2a). | 1,800 guests and growing vendors/tasks need it. |
| Printable PDFs | **Keep**, but the guest lists move up to R2a. | Card distribution needs printed lists in early Dec. |

---

## 5. Timeline (today → wedding)

Weeks run Monday to Sunday. Feature deadlines are set before the wedding need.

| Week | Dates | Wedding milestone | App milestone |
|---|---|---|---|
| W0 | 8–11 Oct | Confirm event dates and venues. List booked vs unbooked vendors. Start filling the Excel guest template. | Build starts: database, login, data safety, backups. |
| W1 | 12–18 Oct | Book any remaining key vendors now (peak Feb season): halwai, tent/decor, photographer, band/ghodi, pandit. | Build: tasks, events, guests, import, money, documents. Staging on the subdomain for the couple to try. |
| W2 | 19–25 Oct | Finish the Excel guest list per side. | Dashboard, export, polish. Restore drill #1. Parent usability test. **R1 launch Sun 25 Oct:** import the Excel, enter advances and receipts. |
| W3 | 26 Oct–1 Nov | Order outfits and jewelry (8–12 week lead times). | Fixes from family feedback. Track orders as tasks. |
| W4 | 2–8 Nov | Diwali week. Family is together. | Install the app on family phones in person. **Retire the sheet on 8 Nov** if there were no incidents. |
| W5 | 9–15 Nov | Block rooms with hotels/dharamshalas. | **R2a live:** reminders, search, card tracking, print lists. |
| W6 | 16–22 Nov | Final card design. Place the print order. | Review payment due dates. Every one should have a reminder. |
| W7 | 23–29 Nov | De-duplicate the guest list. | Restore drill #2. Duplicate report. |
| W8 | 30 Nov–6 Dec | **Guest list freeze (30 Nov).** Cards being printed. | Print distribution lists by area. Start building R2b. |
| W9 | 7–13 Dec | Cards arrive. Start local distribution. Courier to outstation. | "Card given" ticked as cards go out. |
| W10 | 14–20 Dec | Distribution continues. wa.me e-invites to outstation families. | Hindi go/no-go (20 Dec). |
| W11 | 21–27 Dec | Distribution complete (target 27 Dec). | Restore drill #3. |
| W12 | 28 Dec–3 Jan | Buffer week. Review balance payment schedule. | Buffer. |
| W13 | 4–10 Jan | Start RSVP calls. | **R2b live:** wedding-day mode. |
| W14 | 11–17 Jan | RSVP calls. Allot rooms. | Room list checked against hotel blocks. |
| W15 | 18–24 Jan | Draft the event-day timelines. | **Feature freeze 24 Jan.** Airplane-mode dry run on both platforms. Restore drill #4. |
| W16 | 25–31 Jan | **RSVP close (31 Jan).** | Headcount per event finalised from data. |
| W17 | 1–7 Feb | Final headcount to the caterer. Timelines final. Vendor balances scheduled. | Wedding-day data complete. Export a copy. |
| W18 | 8–14 Feb | Print packets 12 Feb. **Events start 14 Feb.** | **Deploy freeze from 10 Feb.** On 13 Feb, every phone opens Wedding Day online to refresh the cache. |
| W19 | 15–21 Feb | Events 15–16 Feb. Final payments, returns. | Final export, archived off-site. Planner account expires 20 Feb. |

If the Engagement or Mayra is earlier than 14 Feb, it gets its own wedding-day check one week before it.

---

## 6. Cross-platform requirements

Rule: every feature must work on both platforms. No Android-only capability is used. Background Sync is not used on either platform.

| Topic | Android (Chrome) | iPhone (Safari) | What we tell users |
|---|---|---|---|
| Minimum | Android 10+, current Chrome | Works on iOS 15+. Push needs iOS 16.4+ | "Update your phone software." |
| Install | Chrome menu ⋮ → Install app / Add to Home screen. We show no custom prompt. | Safari only: Share → Add to Home Screen. There is no prompt. | Install Guide page with screenshots for each phone. |
| Login after install | Stays logged in | **Home Screen app has its own storage. Log in once more.** | "After adding to Home Screen, open it and log in again." |
| Push reminders | Works in the browser or installed. Permission is asked only after tapping "Turn on reminders". Some brands (Xiaomi, Oppo, Vivo, Realme) delay notifications to save battery. | Only after install, on 16.4+. Permission is asked only from a button tap. Focus modes can hide it. | "Tap Turn on reminders. You'll also get email." Android: battery setting how-to. |
| Email fallback | Same | Same | "Check spam once and mark it Not spam." |
| Offline | Service-worker cache. Request persistent storage. | Service-worker cache. Safari may clear data for sites unused ~7 days if not installed. | "Install the app. Open Wedding Day once on 13 Feb with internet." |
| Saving offline | Blocked, with a clear message | Blocked, with a clear message | "Not saved — no internet. Try again." |
| Photos / files | File picker or camera; compressed on device | File picker or camera (iPhone gives JPEG); compressed on device | "Take a photo of the receipt." |
| Print / PDF | Print button → Save as PDF | Print button → share icon → Save to Files | Short how-to on each print page |
| WhatsApp | wa.me opens WhatsApp | wa.me opens WhatsApp | "Tap Share on WhatsApp." |
| Calls | `tel:` links | `tel:` links | Tap a number to call. |
| Updates | "New version ready — Tap to update" banner | Same banner. The installed app updates when reopened. | "Tap Update when you see it." |
| Text size | Respect the system font size. Pinch-zoom never blocked. | Same | — |
| Layout | Bottom nav clears the gesture bar | Respect notch and home-indicator safe areas | — |

**Test devices before each release:** at least 1 iPhone (installed and in Safari) and 1 low-end Android.

---

## 7. Data-safety requirements (non-negotiable)

These ship in R1. They apply to every later feature.

1. Every editable table has `version`. A write with a stale version returns 409. The UI shows both values and a Reload button. It never silently overwrites.
2. Every create sends a client UUID. A repeat request returns the original record, not a duplicate.
3. "Saved" appears only after the server confirms. No optimistic "saved".
4. Unsent form text is kept as a local draft. Closing the app or losing signal doesn't lose typing.
5. Delete is always soft. An Undo toast shows for 10 seconds. Trash is restorable by admins.
6. No hard delete by anyone until 3 months after the wedding.
7. The audit log is append-only. It records who, when, what, and before/after values. Nobody can edit it.
8. Multi-table writes use DB transactions.
9. All input is validated on the server. Prepared statements are used everywhere.
10. Nightly encrypted DB backup goes off-site. Uploaded files are backed up weekly off-site. Retention: 30 daily + 12 monthly.
11. The dashboard shows the last backup time to admins. It turns red after 26 hours.
12. A restore drill runs monthly on a scratch database. The result is logged in the app.
13. One-tap full export (JSON + CSV + files ZIP) is available to admins. It opens in Excel.
14. Every deploy and migration takes a backup first. Migrations only move forward.
15. Uploads are stored outside `public_html` and served only to logged-in users.

---

## 8. Usability requirements

| Requirement | Rule |
|---|---|
| Tap targets | ≥ 48 × 48 px, with ≥ 8 px gaps |
| Adding anything | Max 3 taps: **+ Add** → type → fill the name → Save. Only the name is required. |
| Readable | Base text 17 px. Contrast WCAG AA. Words beside every icon. |
| One-handed | Bottom navigation. Primary buttons in the bottom third. Forms open as bottom sheets. |
| Save state | Always visible: "Saving…", "Saved ✓ 10:42", or "Not saved — no internet. Try again". |
| Plain language | No jargon ("sync", "RSVP", "entity"). Use "Coming?", "Deleted items", "Families". |
| Right keyboard | Number pad for phone numbers and amounts. Amounts in whole rupees. |
| Errors | Say what to do: "Enter a 10-digit phone number." |
| No hidden gestures | No swipe-only or long-press-only actions. |
| Forgiving | Undo instead of "Are you sure?". Confirm only for logout and export. |
| Language-ready | All UI text lives in one strings file, so Hindi can be added later. |
| Tested with real users | 2 parents before R1 complete. 1 elder (viewer) before R2b. |

---

## 9. Risks and mitigations

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| 1 | One big launch slips, or isn't trusted | High | Nothing waits on the app before 25 Oct: guests go in the Excel template, payments in the sheet. Keep both in parallel until 2 clean weeks after launch (retire 8 Nov). If launch slips past 1 Nov, ship guests + tasks first and the rest a week later. |
| 2 | The groom is also the only developer. Wedding work eats build time. | High | Releases are small. §4.1 cuts are firm. Feature freeze 24 Jan. Buffer week W12. |
| 3 | Data loss or overwrite | High | §7 in full, from launch. Backups in three layers (Hostinger daily, our nightly off-site copy, monthly export). |
| 4 | Family doesn't adopt it | High | In-person install at Diwali. Assign real tasks to named people. Viewer role for elders. |
| 5 | Reminders fail (cron, iOS permission, Android battery saver, spam) | Med-High | Email fallback. Health check. Test button. Dashboard "due in 14 days" list from R1. |
| 6 | Venue network fails, or hosting is down on event days | Med-High | Offline Wedding Day refreshed on 13 Feb. Printed packets 12 Feb. Deploy freeze. |
| 7 | Bulk entry of 1,800 guests is too slow | Med | Excel template + import. Families, not individuals. Duplicate-phone warning. |
| 8 | Guest privacy leak (1,800 numbers) | Med | Only admins can export. Login on every endpoint. `noindex`. No public pages. |
| 9 | Hostinger limits (storage, upload size, cron) | Med | Business plan (50 GB). On-device compression. External galleries. Check PHP upload limit in W0. |
| 10 | Scope creep from the 30-module spec | Med | §4.1. New ideas go on a Later list. |

---

## 10. Open Questions

**Answered in v1.1:** Hostinger plan (Business) · one complete launch · Excel import with template · subdomain set by owners · daily backups.

**Still open:**

1. **Off-site backup account:** which Gmail or Google Drive receives the nightly encrypted copy? Hostinger's daily backups stay on Hostinger.
2. Dates and venues of each event. Is the Engagement before 14 Feb?
3. Who can see money? Is the default (couple only, others by switch) right?
4. Will you hire a planner? If yes, should they see guest phone numbers?
5. Which vendors are already booked? Which are still open?
6. Are cards physical, digital, or both? How are they distributed?
7. Is RSVP close on 31 Jan right? When does the caterer need final numbers?
8. Any seated meal that would justify seating?
9. Roughly how many outstation families need rooms or pickups?
10. How many hours per week can you give to testing and deploying, Oct–Jan?
11. Should anyone besides the couple be an admin, e.g. a sibling as backup?

Also open from CONTEXT.md: phone mix, Mayra side(s), "Hinglish" meaning, login method (password vs PIN), hotels list, reminder mailbox, logo file.
