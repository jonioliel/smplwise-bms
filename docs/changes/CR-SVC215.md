# CR-SVC215 - service module upgrades: vendor reputation, budgets, visits and the arrival signal

Status: PROPOSAL (change record + mockup) on `pilot/SVC215-295` (from `origin/main` @ `750a1d049`, v2.12.2). Release target
2.15.0, bundle "service module upgrades". Board rows r081 (vendor reputation card), r082 (quote comparison side by side),
r083 (department budget vs approved costs), r084 (vendor documents with expiry), r126 (detect a missed vendor arrival),
r127 (arrival step on the public vendor page + door-access-code request with approval). Mockup for the owner's approval:
`docs/design/mockups/svc-215/index.html`. No backend or frontend code in this record.

Everything here lives inside the tickets module (`tickets.enabled`): nothing is reachable while it is off, and the owner rule
of 2026-10-20 (no "open a service request" action anywhere while the module is off) is inherited unchanged. Three feature
switches inside the module (section 8). Migrations `0150_ticket_visits.sql` and `0151_ticket_department_budgets.sql`
(PROVISIONAL numbers from 0150; the lead renumbers at integration - 0146 is the next free number on main today and
MAINT215 holds 0147).

## 0. What already exists - read before the rows

The sweep of `origin/main` (tickets, rfq, vendors, public page, notifications) changes two of the six rows:

| Row | Finding on main | What this CR does with it |
|---|---|---|
| r082 quote comparison side by side | **Already built** (TKRFQ2): `frontend/src/tickets/rfq-compare.ts`, element `<tickets-rfq-compare>`, reached from the RFQ screen at `?rfq=<id>&view=compare` and the "compare (N)" buttons of `rfq-board.ts`; backend `GET /tickets/rfqs/{id}/comparison` (`routers/tickets_rfq.py`, `tickets.costs.view`). One column per quote: cost per line kind, before VAT, VAT, total, work window (in / out of window), validity, lines, note, files, reference, payment proposal, messages, award scope; "lowest" and "earliest" marked by the server; other currencies in their own group, never ranked or summed; filters (all / in window), sort (price / date); award of one quote or a split. | **Nothing is rebuilt.** The CR adds two rows to the existing table - the vendor's reputation strip (r081) and the vendor's document state (r084) - so the person comparing prices also sees who keeps a quote and whose insurance has lapsed. The mockup shows the existing layout with the two new rows marked. |
| r127 arrival step + door code with approval | **Mostly built** (GRANTS3-295 / ACCESSREQ-293): the public page has an arrival step (`services/access_arrival.py`, `frontend/src/public-ticket/arrival/*`): the vendor names the technician, the dates and hours, acknowledges the privacy notice, and this creates an `access_grants` **request** (never a grant); a second person approves it (`services/access_request.py`, a system administrator may approve his own); the code is delivered only to the technician's verified number and is never shown on the page (`ArrivalView.current.access` shows doors, dates, hours, "····NN"). It is offered on RFQ work orders and on assignments whose manager ticked "access needed" (`access_arrival_flags`, 0132), and it is gated by `access.external_grants`, which cannot be switched on in this build (`GO_LIVE_PERMITTED = False`). | What is **missing** is the signal that the vendor is actually on site - there is no "arrived" event of any kind (`ticket_events` has `access_request`, `eta`, `rfq_arrival_confirmed`, nothing for a physical arrival). This CR adds the **"I have arrived" step** (section 3) after the existing access step, makes the arrival step available on every external assignment when the department asks for it (not only RFQ orders), and leaves the grant / code mechanics exactly as they are. |
| r084 vendor documents | **Modelled in CR-MAINT215** (slice 1 on `pilot/MAINT215-295`): `maint_tasks` of kind `vendor_document` (insurance, electrician licence, work-at-height, other), valid-through date, reminders `maintenance.due_soon` / `maintenance.overdue` 30 days ahead, `GET /maintenance/vendors/{id}/documents`, helper `vendor_status(conn, vendor_ids, today)` written for the assignee picker. | **One model, not two.** SVC215 owns the surfaces of the service module only: the documents block on the vendor card, the mark in the assignee picker (MAINT215 question 5) and in the quote comparison, the manager confirmation when assigning a vendor with a lapsed document, and the document file through the tickets attachment validator. The data, the dates and the reminders stay MAINT215's. Owner question 1 confirms the split. |
| "the building report" (r081) | **No building report exists.** The service module has `GET /tickets/reports/monthly.csv` (counts per department or vendor, `monthly_report.py`) and `GET /tickets/costs/report` (sums per vendor / department / device / room / month, `costs_report.py`); the PDF pipeline exists for temperature, billing and health. | The reputation numbers go into the monthly CSV as vendor columns, and a vendor PDF ("דוח ספקים") through the existing PDF pipeline is proposed as slice 4. Owner question 3. |

The remaining rows (r081 reputation, r083 budgets, r126 missed arrival) are new ground: the words "budget", "arrived" and any
vendor statistic appear nowhere in the module today.

## 1. The problem

| Row | What the building manager has today |
|---|---|
| r081 | He chooses a vendor by memory. The data exists (link opened, acknowledged, done, reopened, quote vs demand) but no screen adds it up. |
| r083 | Approved costs are summed per department (`costs_report.py`), but there is no number to compare them with; the yearly amount lives in a spreadsheet. |
| r084 | Covered by MAINT215; the service module does not yet show it where the decision is made (picker, comparison, assignment). |
| r126 | A vendor confirms an arrival date (RFQ) or sends an ETA (link); when he does not come, nobody knows until the tenant calls. The "two reminders then escalation" ladder (`rfq_terms.py`, `MAX_REMINDERS = 2`) is about **confirming the date**, not about **being there**. |
| r127 | The access step exists; the vendor cannot say "I am here", so the manager, the tenant and the missed-arrival detector have nothing to work with. |

## 2. Vendor reputation (r081)

### 2.1 The card

A read model, **never stored**: computed on request from `ticket_events`, `ticket_links`, `ticket_assignments`, `ticket_visits`
(section 4) and the cost tables, over a window (default the last 12 months, chips 3 / 12 / 36 months). Shown on the vendor's
card in the outside-contacts directory (`contacts-directory.ts`), as a strip in the assignee picker and in the quote comparison.
Six numbers, each with the count behind it (so "100 %" of one visit reads as what it is):

| Number | Definition (per vendor company; a technician's events count for his `vendor_id`) |
|---|---|
| Response time | median of (first vendor signal - assignment instant) over the window; first signal = `ticket_links.first_opened_at`, or the first `via = link` event, or a status move to `acknowledged`, whichever is earliest. Working minutes when the working-hours calendar is on (`SLACAL`), wall clock otherwise. Shown as "3 ש׳ 20 ד׳ (14 בקשות)". |
| Arrival | share of visits that reached `arrived` inside their window (`ticket_visits`, section 4): "9 מתוך 11 בזמן". Empty while no visit exists. |
| Repeat visits | share of the vendor's done / closed tickets that were **reopened** (`reopened` event) within 30 days, or followed within 30 days by a new ticket on the **same device** (`device_id`) that was assigned to the same vendor: "2 מתוך 23". The 30 days and the same-device rule are the only heuristics; a tenant opening a new, unrelated request on another device does not count. |
| Quote adherence | over approved payment demands that have a quote basis (`ticket_cost_revisions.basis_json`, the existing `claim_prefill.check()` `quote_check`): share with status `same` or `below_quote`, and the median overshoot of the `above_quote` ones: "11 מתוך 13 לפי ההצעה · חריגה חציונית 6 %". Needs `tickets.costs.view` (money); hidden otherwise. |
| Returned | share of assignments given back by the vendor (`cannot_handle` / `not_mine`). |
| Volume | tickets done + closed in the window, and the open ones now (already on the contact: `open_tickets`). |

No score, no stars, no ranking between vendors. The owner asked for the three facts; a single composite number would hide
which one is bad and would turn a technician's data into a grade (section 10). Each number links to the filtered ticket list
that produced it ("the 2 repeat visits"), so a manager can read the stories, not only the ratio.

### 2.2 Who is measured

The unit is the **vendor company** (`ticket_contacts.kind = vendor`). A person contact without a vendor (a freelance
technician) is a business of one and gets the same card; an **employee** (`employee = 1`) and an Arx user never get one - the
module measures outside vendors, not staff. Erased contacts (`erased_at`) are excluded from every computation and the card
answers 404 like the rest of the directory.

### 2.3 Where it appears

* The vendor card (directory): the six numbers, the window chips, the document block (section 5).
* The assignee picker (`assignee-model.ts`): one line under the vendor's name - arrival share, repeat share, document mark.
  No numbers for people who cannot see the card.
* The quote comparison: one row "הספק" with the same line, plus the document mark (section 5).
* The monthly CSV (`monthly_report.py`): vendor rows gain `response_median_min`, `arrival_on_time`, `arrival_total`,
  `repeat_visits`, `repeat_base`, `quote_kept`, `quote_base`, `quote_overshoot_median_bp` (the last three only when the caller
  holds `tickets.costs.view`; the columns are absent, not blank, otherwise).

## 3. The arrival signal (r127) and 4. visits and missed arrivals (r126)

### 3.1 A visit

`ticket_visits` - one row per planned presence of a vendor in the building:

| Column | Meaning |
|---|---|
| `id`, `ticket_id`, `assignment_id` (nullable for an RFQ order before the ticket exists: then `rfq_award_id`) | which work |
| `vendor_id`, `contact_id` (the technician when known) | who |
| `planned_from`, `planned_to` (UTC instants), `source` (`vendor_eta` / `rfq_terms` / `manager` / `vendor_arrival_step`) | when, and who said so |
| `grace_min` (department default 30, 0-240) | how late is late |
| `state` (`planned` / `arrived` / `missed` / `cancelled` / `done`), `arrived_at`, `arrived_by` (`vendor_link` / `staff` / `door`), `arrived_actor` | the outcome |
| `missed_at`, `missed_notified_at`, `rescheduled_to` (the visit that replaced it) | the miss |
| `revision`, `created_at`, `updated_at` | |

One `planned` visit per assignment at a time (unique partial index). A visit is created by:

1. the RFQ arrival confirmation (`rfq_terms`: `arrival_state = confirmed` -> a visit with the confirmed `planned_from / to`);
2. the vendor's ETA on the public page (`POST /t/api/eta` -> a visit `[eta, eta + grace]`; a new ETA replaces the planned visit);
3. the arrival step's date and hours (the existing step: the day and hour window the vendor entered become the visit);
4. a manager in the request drawer ("ביקור" row: date, from, to).

Every create / move is an audited event `visit_planned` (visible to the vendor), and the window is shown in the status sentence
("הספק מגיע היום 09:00-11:00").

### 3.2 The arrival signal

Three ways a visit becomes `arrived`, in order of trust:

| Signal | Who | `arrived_by` |
|---|---|---|
| The vendor presses **"הגעתי"** on his page (new `POST /t/api/arrived`, section 7) | the link holder | `vendor_link` - **a claim**, recorded as such ("הספק דיווח על הגעה 09:12") |
| Staff marks "הגיע" in the drawer (`POST /tickets/{id}/visits/{vid}/arrived`) | `tickets.manage` at the ticket's place, or the internal assignee | `staff` |
| A door opened with the technician's grant credential (only when external grants go live; the event already exists in the grants model) | system | `door` - the only proof; it also records the arrival when the vendor forgot to press |

A status move to `in_progress` through the link, and a photo through the link, count as the vendor's claim too (they cannot
happen from elsewhere). No GPS, no position, no camera match - the owner's standing rule (EXPANSION_IDEAS idea 2) and the
technician-privacy pack. The vendor's claim is therefore **a statement, not evidence**, and the card says "דיווח" where it
matters (section 2's arrival share counts a claim as an arrival; owner question 5 lets the owner demand staff confirmation
instead).

### 3.3 The public page step

After the existing access step (or without it, when the department does not need access), the page shows one row for today's
visit: the window, and one large button "הגעתי" that is enabled from `planned_from - 60 min` until `planned_to + grace`
(outside it the page shows "הביקור מתוכנן ל-14.02 09:00-11:00" and no button, so a press at the wrong day cannot happen). After
the press: "דווח על הגעה 09:12", no undo on the page (a wrong press is corrected by staff in the drawer, audited). Idempotent
(`client_request_id`), counted in the 20 writes / hour of the link, no new data entered, no new text field: the rate gate, the
uniform 404 and the one-transaction rule of the public-surface checklist apply unchanged. The door-code request part of r127 is
the existing step; this CR changes none of it.

### 3.4 Missed arrival (r126)

One more throttled step of the janitor (every 5 minutes, like `stuck.py`): a `planned` visit whose `planned_to + grace_min` has
passed with no arrival becomes `missed` in the same transaction as:

* the event `arrival_missed` (visible to the vendor);
* the notification `ticket.arrival_missed` (alert, rule `ticket_managers` + the internal owner of the ticket, push on by
  default, dedupe `visit:<id>:missed`);
* a message to the vendor through the existing link channel (`handler_actions` / WhatsApp-or-email as the contact prefers),
  text from the catalogue: "לא נרשמה הגעה לביקור של היום 09:00-11:00. אם הגעת - סמן בדף; אחרת נא לתאם מועד חדש" - sent only inside
  the send-hours rules of the module; otherwise queued like any other link message.

The drawer then shows the missed state in the status block (one chip "לא הגיע", the sentence "הספק לא הגיע בחלון 09:00-11:00")
with three actions: **ביקור חדש** (reschedule: a new visit, the old one gets `rescheduled_to`), **תזכורת** (resend the link
message), **העברה** (the existing reassign). An arrival after the miss (the vendor presses late, staff marks) moves the visit to
`arrived` with `late = true` and resolves the notification; the reputation counts it as late. Grace per department
(`ticket_departments.visit_grace_min`, in 0150) and the whole detector per department (`visit_detect`, default on when the
feature is on).

What the detector is **not**: it never changes the ticket status, never closes anything, never escalates beyond the managers,
never touches a grant. The existing RFQ reminder ladder (date confirmation) is untouched; a confirmed RFQ date simply becomes a
visit.

## 5. Vendor documents in the service module (r084)

Data = MAINT215 (`maint_tasks`, kind `vendor_document`; `vendor_status()`). SVC215 adds the surfaces:

* **Vendor card**: the documents block (type, valid through, state chip, "חידוש" for `maintenance.manage` holders, the file).
  The block renders nothing while the maintenance module is off (the helper answers empty), so the card does not depend on it.
* **Assignee picker and quote comparison**: one mark per vendor - `פג` (red, expired document), `עד 01.02` (amber, inside the
  lead), nothing when fine; the mark names the document type on hover / in the row ("ביטוח פג 10.01").
* **Assigning a vendor with an expired document** (MAINT215 question 5, recommendation a): the assign dialog asks for a
  manager confirmation ("לספק ביטוח צד ג׳ שפג ב-10.01 - להמשיך?"), audited `tickets.assign.lapsed_document` with the document
  ids. Never a refusal: the owner may need the only electrician in town tonight.
* **The file**: a document upload on the renewal uses the tickets attachment validator (`services/tickets/files`: type,
  size, image re-encode, PDF check) - no second file pipeline. The file is visible to `maintenance.view` at the installation
  and to `tickets.directory`; never to the public page.
* **Warning before lapse**: MAINT215's reminders (30 days, `maintenance.due_soon`). SVC215 adds nothing here except that a
  vendor **with an open assignment** whose document lapses inside the lead also appears in the manager dashboard's alerts
  list (`mgrdash_alerts`) - the manager sees "ביטוח חשמל השרון פג בעוד 12 ימים · 3 בקשות פתוחות".

## 6. Department budgets (r083)

### 6.1 Model

`ticket_department_budgets`:

| Column | Meaning |
|---|---|
| `id`, `department_id` | |
| `period_kind` (`year` / `quarter` / `month`), `period_start` (local date, first day) | one row per department, period and currency |
| `amount_minor`, `currency` | money in minor units like every cost row; one currency per row, never summed across currencies |
| `warn_bp` (default 8000 = 80 %) | the warning threshold |
| `note`, `created_by`, `created_at`, `updated_at`, `revision`, `deleted_at` | |

Unique `(department_id, period_kind, period_start, currency) WHERE deleted_at IS NULL`. Budgets are set by `tickets.configure`
(the same hand that sets the cost mode and the second-approval threshold), edited with the revision guard.

### 6.2 Consumption (computed, never stored)

For a department, a period and a currency:

* **approved** = sum of `ticket_cost_claims.approved_total_minor` with status `approved` or `paid`, `approved_at` inside the
  period, on tickets of the department (an RFQ instalment demand counts on its approval date like any claim);
* **committed** = sum of awarded RFQ totals (`ticket_rfq_awards.approved_total_minor`, state `approved`) and approved quotes
  on tickets whose demand is not yet approved - money the department has promised but not yet paid;
* **remaining** = amount - approved - committed; state `ok` (< warn), `warning` (>= warn), `exceeded` (approved + committed >
  amount).

Approving a demand that would move the department to `exceeded` shows the number in the approval dialog ("אישור זה חורג
מהתקציב השנתי ב-4,200 ₪") and asks for the same confirmation as a second approval; it is **never refused** (the invoice is real;
the budget is a management number, not a lock) - owner question 7 lets the owner choose a block. The approval is audited with
`budget_state` so the audit shows who approved over budget.

### 6.3 Screens and notifications

* **Budget view** in the costs area (`#/tickets/costs?view=budget`): one row per department: amount, approved, committed,
  remaining, a bar, the state chip; chips for the period; a department row opens the filtered demand list. The mockup shows it.
* The department settings page (`system-tickets.ts`, departments tab) gains the budget rows (period, amount, currency, 80 %).
* Notifications `ticket.budget_warning` (warning, when a department first crosses `warn_bp` in a period) and
  `ticket.budget_exceeded` (alert, when it first exceeds), rule `managers` of that department (the existing
  `RULE_MANAGERS` membership) plus `tickets.configure` holders; app and inbox by default, push for `exceeded`; dedupe
  `budget:<id>:<state>`; resolved when the state falls back (an adjusted approval).
* The costs CSV export gains a `budget_state` column per demand (the department's state at approval time, from the audit).

## 6a. Placement in the service area (owner directive 2026-10-23)

Nothing gets a screen of its own; every surface lands inside an existing tab of `#/tickets/*` (`TICKETS_TABS`, `shell/nav.ts`),
and every mockup screen follows the visual language of the EXISTING screens - infrastructure temperature, elevators, schedules and
automations (owner standing rule 2026-10-23): the product token table of `frontend/src/design/tokens.ts` (classic skin, light + dark),
the real shell (area rail, floating search / status pill, no top bar; bottom bar on phones), the `sw-tabs` rows (level 1 = pill track,
level 2 = compact underline row), the `.top` page head (`h1` + subtitle + actions), the KPI row of the temperature / elevators screens,
the places-tree panel beside the list, the electricity table, the solid state badge and the soft chips, the pill buttons and the
`sw-state-panel` states - no new look. The mockup v2 (`docs/design/mockups/svc-215/index.html`, screenshots in
`private/review/svc-215-v2/`) is drawn with the same method as the maintenance mockup (CR-MAINT215).

**The four sections.** The service-management area is being reorganised into four level-1 sections - **בקשות** / **תחזוקה ובקרה** /
**ספקים וכספים** / **סקירה ודוחות** - and the existing tabs become the level-2 pages of their section. Each section label is written
once (`SECTIONS` in the mockup script; one constant per label in the shell when built), so the final names are a one-line change.

| Surface | Section > page | Where on the page |
|---|---|---|
| Vendor reputation card (section 2) + vendor documents with expiry (section 5) | **ספקים וכספים > מטפלים וספקים** (`#/tickets/handlers`) | the vendor's card: the directory list beside it (the tree panel; a select on phones), the window chips and a KPI row of six tiles (number + base, each a link to the list behind it) above the contact fields, the documents panel beside them (badge per document, "חידוש" for managers) |
| Quote comparison with the two new rows (section 0) | **ספקים וכספים > בקשות הצעת מחיר** (`#/tickets/rfqs`, `?view=compare`) | the existing table; rows "הספק" and "מסמכים" after the header, before the money (cards on phones) |
| Department budget vs approved costs (section 6) | **סקירה ודוחות > סקירה** (the manager overview, `#/tickets/overview`) | a "תקציב" panel per department (amount, approved solid, committed soft, remaining, the state chip, period chips) beside the existing alerts panel; the department settings keep the editing; the full budget table belongs to the reports page of the same section when it exists (owner question 11) |
| Missed arrival (section 3.4) | **בקשות** > the ticket detail (`#/tickets/<id>`: the status block with the "לא הגיע" badge, the sentence and the three actions, plus a "ביקור" row in the details and the events in the history) **and** **סקירה ודוחות > סקירה** (an alert row "לא הגיע" in the alerts panel; a "לא הגיע" KPI in the row) | the status block also draws the planned and the late-arrival variants |
| Arrival step + "הגעתי" (section 3.3) | the public vendor page | after the access step; the public page keeps its own public look (one column, step cards, no shell) |
| Reports | **סקירה ודוחות > דוחות** | the reports hub proposed by the lead (monthly CSV, costs report, the vendor PDF of slice 5) now sits as a page of the סקירה ודוחות section instead of a hub tab of its own; the certificate ledger, rounds, plans and tags are the pages of **תחזוקה ובקרה** (CR-MAINT215). This CR only places the page; its screens are drawn by other agents. |

With a feature switch off (section 8) the feature's blocks leave and the rest of the page stays: no KPI row and no "הספק" row
without `tickets.vendor_stats`, no visit block / arrival step / "לא הגיע" KPI without `tickets.visits.enabled`, the budget panel
replaced by the module-off state panel without `tickets.budgets.enabled`. Operators and viewers see no management actions and no
money (the "לפי ההצעה" tile, the budget panel, the "חשבון ספקים" page, the costs tab of the ticket).

## 7. API (all behind the tickets module gate)

| Route | Permission |
|---|---|
| `GET /tickets/contacts/{id}/stats?months=3|12|36` | `tickets.manage` or `tickets.directory`; money fields need `tickets.costs.view` |
| `GET /tickets/contacts/{id}/stats/tickets?metric=repeat|late|returned|overshoot` | the same (the list behind a number, filtered by the usual ticket visibility) |
| `GET /tickets/{id}/visits` | `tickets.view` on the ticket |
| `POST /tickets/{id}/visits` (date, from, to, grace) / `PATCH .../visits/{vid}` (move, revision) / `POST .../cancel` | `tickets.manage` at the ticket's place (the manager role of the assign route) |
| `POST /tickets/{id}/visits/{vid}/arrived` / `POST .../missed` (manual) | `tickets.manage` at the place, or the internal assignee |
| `GET|PUT /tickets/costs/budgets?department&period` | GET `tickets.costs.view`; PUT `tickets.configure` |
| `GET /tickets/costs/budgets/summary?period` | `tickets.costs.view` (per department, only the departments the caller may see) |
| `GET /tickets/reports/monthly.csv` | unchanged permission; the new columns per section 2.3 |
| Public: `GET /t/api/ticket` gains `visit: {state, planned_from, planned_to, can_arrive}`; `POST /t/api/arrived` | the link token, the code gate when the link has one, the rate gate; the same uniform 404 |
| `GET /tickets/rfqs/{id}/comparison` | unchanged; the answer gains `vendors[].stats` (section 2.3 line) and `vendors[].documents` |

Audit rows: `tickets.visit.plan|move|cancel|arrived|missed|arrived_late`, `tickets.assign.lapsed_document`,
`tickets.budget.set|delete`, `tickets.cost.approve` gains `budget_state`, `tickets.stats.view` (the card opened - one row per
vendor per session, because a reputation read is a read about a business's people, section 10), and every refusal. The public
arrival is audited with the link id and the visit id only.

## 8. Permissions, switches and isolation

No new permission names: the module has twelve (`tickets.view / create / manage / external / all_departments / configure /
costs / costs.view / delete / directory / handlers / technician_requests`) and each new route maps onto one of them (section 7).
`tickets.costs.view` stays the money line: without it a person sees no quote adherence, no budget, no overshoot.

Three switches inside the module (Settings > Service requests > General, `system.configure`, audited like `tickets.enabled`):

| Key | Default | Off means |
|---|---|---|
| `tickets.vendor_stats` | **on** | no stats routes (404 `feature_disabled`), no strip in the picker / comparison, no CSV columns |
| `tickets.visits.enabled` | **off** | no visits, no arrival button on the public page, the detector idle; the ETA and the RFQ date behave exactly as today |
| `tickets.budgets.enabled` | **off** | no budget routes, no budget view, approvals ask nothing |

Isolation follows the tickets module unchanged: a ticket's visibility (place + department) decides the visits and the list
behind a number; the budget summary lists only the departments the caller sees; the vendor card is directory-level (the
installation). The public page learns nothing it does not know today except its own visit window. Arx RBAC is the only
authority: no client flag, no Home Assistant admin flag, no WisKey claim grants any of this.

## 9. Threat model

| Threat | Where | Mitigation |
|---|---|---|
| A stolen or guessed link marks a false arrival (hides a no-show) | public page | the arrival is a **claim** labelled as such; the window gate (no press outside planned - 60 min .. planned_to + grace); staff can undo (audited); the `door` signal, when grants go live, is the only proof; the token stays 192-bit hash-stored, rate-gated, uniform 404 |
| The arrival route becomes a write amplifier | public page | one more write in the existing 20 / hour per link; no body text; idempotent by `client_request_id`; no new upload |
| A vendor learns other vendors' numbers | public page, comparison | the public page never carries stats or documents (the answer shape is explicit, the evidence spec asserts the absence); the comparison is `tickets.costs.view` only |
| Reputation used to blacklist a person | directory | the unit is the company; numbers carry their base counts; no score; the card view is audited; export only through the permissioned CSV; section 10 |
| Budget over-approval unnoticed | costs | the dialog shows the overshoot; audit row carries `budget_state`; `budget_exceeded` goes to the department managers and `tickets.configure` |
| A manager without `tickets.costs.view` infers money from the strip | picker | the picker line never shows money (adherence is a share only when the caller has `costs.view`; otherwise the field is absent) |
| The detector fires on a clock skew / zone bug | janitor | instants in UTC, windows from local dates through the installation zone (never a fixed offset); the detector reads `planned_to + grace` only; tests cross DST and midnight |
| Mass notifications on a backfill | janitor | the detector only looks at visits with `planned_to` in the last 7 days; older `planned` visits move to `missed` silently (`missed_notified_at` null) |

## 10. Privacy

* The measured subject is a business. A person contact's events are aggregated into his `vendor_id`; a freelancer's card is his
  business's card. Employees and Arx users are never measured here (staff performance is a different matter and not in this
  CR). Erased contacts are excluded and their past events are not attributed to anyone.
* The card is read by `tickets.manage` / `tickets.directory` only, audited per view, never on the public page, never pushed.
  The CSV columns exist only for callers with the report permission; money columns only with `costs.view`.
* No position data of any kind. The arrival is a button on a page the vendor already holds; the time is the server's. A door
  signal, when grants go live, records that the credential was used at the door the grant covered - which the grants model
  already stores.
* The technician-privacy legal pack (`legal_pack_technician_privacy_2026-10-18`, lead's counsel) applies: the vendor's page
  states that arrival times are recorded for the building's records (one sentence in the existing privacy notice of the
  arrival step; no new consent screen). Retention follows the ticket (events are deleted with the ticket, the tickets delete
  path already covers `ticket_events`; `ticket_visits` joins `TICKET_TABLES` of that path).
* Budgets contain no person data. Vendor documents: file and dates per MAINT215; the lapse confirmation audit names document
  ids, not the document.

## 11. Notifications

| Source | Severity | Rule | Default channels | Resolves |
|---|---|---|---|---|
| `ticket.visit_planned` | info | `ticket_managers` | inbox + app (no push) | - |
| `ticket.arrived` | info | `ticket_managers`, the internal owner | inbox + app (no push) | `ticket.arrival_missed` of the same visit |
| `ticket.arrival_missed` | alert | `ticket_managers`, the internal owner | inbox + app + push | by `arrived`, reschedule or cancel |
| `ticket.budget_warning` | warning | `managers` of the department, `tickets.configure` | inbox + app | when the state falls back |
| `ticket.budget_exceeded` | alert | the same | inbox + app + push | when the state falls back |

All in the `tickets` category of `notify_sources.py`, hidden from the policy matrix while the owning switch is off (the module's
own precedent), e-mail / WhatsApp never on by default. The vendor's own message on a miss (section 3.4) goes through the link
channel, not the notification centre. Vendor document reminders stay `maintenance.*`.

## 12. Migration and rollback

* `0150_ticket_visits.sql` (provisional): `ticket_visits` + indexes; `ticket_departments.visit_grace_min INTEGER` (default 30)
  and `visit_detect INTEGER` (default 1). Additive only, nothing read while `tickets.enabled` or `tickets.visits.enabled` is off.
* `0151_ticket_department_budgets.sql` (provisional): `ticket_department_budgets` + unique index. Additive only.
* No migration for stats (computed), for the comparison rows, for the documents surfaces (MAINT215's tables) or for the public
  route.
* Rollback = the switches off (data kept, routes 404, the detector idle); a downgrade leaves two unused tables and two unused
  columns. Ticket tables stay out of project backups (`backup.PROJECT_TABLES`, operational data by decision) - the new tables
  follow that line unless MAINT215 question 6 changes it for the whole module.

## 13. Test plan

Negative first, fakes only (no lab device, no real link, no WhatsApp). Backend `tests/test_tickets_visits.py`,
`test_tickets_budgets.py`, `test_tickets_vendor_stats.py`, `test_public_arrival.py`; frontend `unit-tickets-visits.spec.ts`,
`unit-tickets-budget.spec.ts`, `unit-vendor-stats.spec.ts`, `evidence-tickets-vendor-card.spec.ts`,
`evidence-public-arrival.spec.ts`; layout specs at the five skins x light / dark x 320-1440 like every tickets screen.

1. Switches: each feature off by its key -> every route the uniform 404, the public answer carries no `visit`, the detector
   writes nothing; the switch audited, `system.configure` only; sources hidden from the matrix while off.
2. Permissions: every route x the twelve permissions; money fields absent (not null) without `costs.view`; the list behind a
   number filtered by ticket visibility; refusals audited, nothing written.
3. Visits: one planned per assignment; created from RFQ confirmation, ETA, arrival step, manager; moved with revision (409);
   window maths across the zone's midnight and DST; the vendor press inside / outside the window (422 `outside_window`), twice
   (idempotent), on a dead link (404), counted in the rate gate; staff arrived / undo audited; door signal from a fake grants
   event.
4. Detector: fires once per visit (`missed_notified_at`), throttle, the 7-day backfill rule, grace per department, `detect` off
   per department, late arrival resolves, reschedule links the visits, the vendor message respects the send hours.
5. Stats: each number against a hand-built fixture (median with even count, working minutes vs wall clock, the 30-day repeat
   rule on the same device only, reopened counts once, erased contact excluded, employee has no card, freelancer aggregated as
   his own vendor, windows 3 / 12 / 36, empty bases render as "-" not "0 %"); CSV columns present / absent by permission; the
   comparison answer carries `stats` and `documents` per vendor and never a stat of a vendor outside the RFQ.
6. Budgets: unique per period / currency; consumption per currency never summed; approved vs committed; the approval dialog
   number; `exceeded` never blocks (or blocks when question 7 says so); notifications once per crossing and resolved on the
   way back; summary lists only visible departments; CSV `budget_state`.
7. Documents surfaces: picker and comparison marks from `vendor_status()`; empty while the maintenance module is off; the
   lapsed-document confirmation audited with ids; the file through the tickets validator (type / size / re-encode) and never on
   the public page.
8. Public page: the evidence spec asserts the absence of stats, documents and other vendors' data in `GET /t/api/ticket`; the
   arrival button states (before window, open, pressed, after grace); CSP unchanged; bundle budget (the lazy chunk) within its
   20 KB.
9. Four-language key parity (he / en, ar / ru initial) for every new string; token lint on the new components.

## 14. Slices

| Slice | Content | Size |
|---|---|---|
| S1 backend | migrations 0150 / 0151, visits model + routes, the detector, the public `arrived` route, budgets model + routes, notifications, audit | L |
| S2 backend | vendor stats read model, the list route, CSV columns, comparison `stats` / `documents`, the lapsed-document confirmation on assign, the file through the validator | M |
| S3 UI | vendor card (numbers, documents), picker and comparison rows, visit row + missed state in the drawer, budget view + settings rows, all states (empty / loading / error / off) | L |
| S4 public page + review | the arrival step's "הגעתי" row, the public-surface security review (checklist) before release, evidence specs | M |
| S5 report | the vendor PDF ("דוח ספקים") through the PDF pipeline, if question 3 says so | M |

S1 and S2 are independent of each other; S3 needs both; S4 needs S1. S5 is optional and last.

## 15. What is explicitly NOT built

* No GPS, no position, no camera verification of an arrival; no tenant confirmation of an arrival (idea 5's tenant page is a
  new public surface outside this bundle).
* No vendor score, no ranking, no automatic exclusion of a vendor; no sharing of the card with the vendor himself.
* No change to the grant / code mechanics, to `GO_LIVE_PERMITTED`, or to the RFQ reminder ladder.
* No budget lock (unless question 7), no multi-year budgets, no budget per building (per department only; question 8).
* No invoice / payment integration (the billing idea of 2026-10-19 stays future, no work without approval).
* No new permission names, no new module; the three switches live inside the tickets module.
* r082 is not rebuilt; r084's data is not duplicated.

## 16. Open owner questions (recommendation first)

1. r084 ownership: the vendor documents' data and reminders stay in the maintenance bundle (CR-MAINT215), this bundle adds the
   service-module surfaces (card block, picker / comparison marks, assign confirmation, the file).
   a. as proposed (recommended: one model)  b. move the documents entirely into the service module (a second table)
2. Which numbers on the vendor card: response time, arrival, repeat visits, quote adherence, returned, volume - no composite
   score.
   a. the six, no score (recommended)  b. the owner's three only (response, repeat, adherence)  c. add a composite score
3. "Included in the building report": no building report exists today.
   a. vendor columns in the monthly CSV now, a vendor PDF as slice 5 (recommended)  b. CSV only  c. a new building report is its own change record
4. Who may open the vendor card: `tickets.manage` (site admin) with money only for `tickets.costs.view`.
   a. as proposed (recommended)  b. `tickets.directory` only (system admin by default)
5. The vendor's own "הגעתי" press counts as an arrival (recorded as a claim).
   a. yes, a claim counts; staff may undo (recommended)  b. a claim is "reported" only; staff confirmation makes it an arrival
6. Grace after the planned window before a miss: 30 minutes per department, 0-240.
   a. 30 minutes (recommended)  b. 60 minutes  c. one installation-wide value
7. Approving a payment demand that exceeds the department budget:
   a. show the overshoot, require the confirmation, never refuse (recommended)  b. refuse unless `tickets.configure`
8. Budget granularity: per department and period (year / quarter / month), one currency per row.
   a. as proposed (recommended)  b. per building too  c. year only
9. The vendor message on a miss ("לא נרשמה הגעה..."), through the link channel inside the send hours:
   a. yes (recommended)  b. notify the managers only, no message to the vendor
10. Switch defaults: `tickets.vendor_stats` on, `tickets.visits.enabled` off, `tickets.budgets.enabled` off.
    OWNER DECISION 400 (2.16.0, supersedes answer 36 for visits and the arrival button): `tickets.visits.enabled` and `tickets.visits.public_arrival` (the vendor "I arrived" button) default OFF; an installation that saved its own `visits` settings keeps them. `vendor_stats` and `budgets` keep their defaults as built (both ON, owner answer 36).
    a. as proposed (recommended)  b. all three off  c. all three on
11. The reports page "דוחות" inside the section סקירה ודוחות (section 6a; the earlier "דוחות ובקרות" hub tab is superseded by the
    four-section layout): reports, the vendor PDF and the full budget table live there; the budget summary stays on סקירה.
    a. as proposed (recommended)  b. no reports page: each item stays where it is today  c. the page, but budgets only on סקירה

## 17. Owner answers (2026-10-24, batch 1 items 27-37) and slice 1 as built

Mockup v2 APPROVED. Standing rule: every threshold, recipient and default asked about is editable in Settings; permissions are
grantable to any role (the existing role editor - no new permission names). Answers: (1) a, the documents' data stay in MAINT215, this
module adds the views; (2) the six numbers, no score, which numbers are shown editable; (3) CSV vendor columns now, the vendor PDF later;
(4) the card is opened by the site manager, money only by cost viewers, both editable; (5) a, the vendor's press counts (a declaration),
staff may cancel it, editable; (6) grace default **60** minutes, per department, editable; (7) a, show the overrun, require the approval,
never refuse; (8) per department and period AND the whole building and other cuts, one currency per row, editable; (9) the missed-arrival
message goes to the managers only by default, the vendor message is one switch away; (10) **all three switches ON**, editable; (11) a.

Slice 1 (backend, `pilot/SVC215-295`), deviations from the sections above, each following an answer:

| Item | As built |
|---|---|
| Migration | ONE file `0156_ticket_visits_budgets.sql` (built as provisional 0155, renumbered at the 2.15.0 integration, release/2150): `ticket_visits`, `ticket_departments.visit_grace_min` (NULL = the installation default) + `visit_detect`, `ticket_budgets`. The CR's `ticket_department_budgets` became `ticket_budgets` with `scope_kind` in installation / department / site / building / category (answer 8). |
| Settings (`tickets.settings`, system.configure, audited) | `vendor_stats.{enabled, numbers, default_months, repeat_days, card_permission, money_permission}`, `visits.{enabled, grace_min=60, claim_counts, public_arrival, staff_can_undo_claim, early_min, eta_window_min, rfq_window_min, notify_vendor_on_miss=false, notify_internal_owner, backfill_days}`, `budgets.{enabled, warn_bp=8000, require_confirmation, count_committed, notify_configurers}`. Per department: `PUT /tickets/admin/departments/{id}/visits {grace_min, detect}` (tickets.configure). `GET /tickets/module` gains `features`. |
| Visits | services/tickets/visits.py + store_visits.py, routers/tickets_visits.py; sources manager / ETA / RFQ confirmation / arrival step; `POST /t/api/arrived` (a claim; `visits.public_arrival` is its own kill switch); "in progress" through the link is a claim too; staff arrive / undo-claim / missed by hand; the detector rides the tickets janitor every 5 minutes with an injectable clock. The visit timeline rows are internal in slice 1 (`visible_external = 0`) until the public page draws them (S4). The vendor's message on a miss reuses the link channel's `reminder` purpose (one per visit); the CR's own catalogue text is a follow-up. |
| Budgets | services/tickets/budgets.py + store_budgets.py, routers/tickets_budgets.py (`/tickets/costs/budgets[...]`, `/budget-check`); the approve / adjust route asks for `budget_confirm` (409 `budget_confirm_required` with the overrun) - never a refusal; the audit row carries `budget_state`, `budget_ids`, `budget_confirmed`. Committed = approved quotes whose demand is not approved yet + approved RFQ awards less paid instalment demands (an approximation documented in store_budgets.py). |
| Vendor card | services/tickets/vendor_stats.py + store_vendor_stats.py, `GET /tickets/contacts/{id}/stats` (audited per view). Response time is wall clock in slice 1 (the working-hours variant is a follow-up). |
| Notifications | `ticket.visit_planned`, `ticket.arrived`, `ticket.arrival_missed`, `ticket.budget_warning`, `ticket.budget_exceeded`; listed in the policy matrix only while their switch is on. |
| Not in slice 1 | The CSV vendor columns, the stats list route, the comparison rows and the lapsed-document confirmation (slice 2); every screen (slice 3); the public page's button and the public-surface review (slice 4, due before a release ships `visits.public_arrival` on); the vendor PDF (slice 5). |

## 18. Slice 2 as built (`pilot/SVC215B-295`, backend only)

All thresholds and defaults below are `tickets.settings` keys (system.configure, audited like every key of the document).

| Item | As built |
|---|---|
| The list behind a number | `GET /tickets/contacts/{id}/stats/tickets?metric=...&months=3\|12\|36` (routers/tickets_vendor_stats.py, `vendor_stats.tickets_behind`). Metrics: `response`, `on_time`, `late`, `missed`, `repeat`, `kept`, `overshoot`, `returned`, `done`, `open` (each says which card number it explains). Same gate as the card (`vendor_stats.card_permission` or tickets.directory); `kept` / `overshoot` also need `vendor_stats.money_permission` (403, audited `money_permission_missing`); a number hidden in `vendor_stats.numbers` answers 404 `metric_hidden`. Rows are filtered by the usual ticket visibility (`access.visible_by_ids`): an invisible request is not listed and not in `total`. One row per request, newest first, the ordinary list item plus `at` and a small `detail` (minutes, return kind, repeat days, quote basis / total / overshoot - money only in the money metrics). Cut at `vendor_stats.list_limit` (50, 10-200). Audit `tickets.stats.list` carries the metric, window and counts - never request ids or titles. |
| CSV vendor columns | `GET /tickets/reports/monthly.csv?group=vendor`: `response_median_min`, `arrival_on_time`, `arrival_total`, `repeat_visits`, `repeat_base` and, with the money permission, `quote_kept`, `quote_base`, `quote_overshoot_median_bp` (Hebrew headers in `lang=he`, the CR names in `lang=en`). Computed per (month, vendor) line over that month cut to the report range. Absent (not blank) without the card permission, with `vendor_stats.csv_columns` off, or when the number is hidden in `vendor_stats.numbers`; an empty base or a line with no card is an empty cell. The department group is unchanged. The numbers are the vendor company's: two technicians of one company in one month repeat the company's figures. |
| Comparison rows | `GET /tickets/rfqs/{id}/comparison` gains `vendors[]` (one per quoting vendor of THAT request): `stats` (the card trimmed to `vendor_stats.strip_numbers`, default arrival + repeat; money only for the money permission; absent without the card permission or with `vendor_stats.enabled` off) and `documents` (`{state: expired \| expiring \| ok, expired[], expiring[]}` with document type and valid-through only; null when none, when `vendor_documents.comparison_marks` is off or the maintenance module is off). The comparison route itself is unchanged (tickets.costs.view). The strip does not write a `tickets.stats.view` audit row (it is a line of the comparison, not a card open). |
| Lapsed-document confirmation | `POST /tickets/{id}/assign` gains `document_confirm`. For an outside contact whose vendor holds an expired document (the expiring ones too when `vendor_documents.confirm_expiring`; the whole check is `vendor_documents.confirm_on_assign`) the route answers 409 `document_confirm_required` with the documents and writes nothing; repeated with `document_confirm: true` it assigns and writes `tickets.assign.lapsed_document` (document types and dates). The refusal is audited as a denied row. Never a block. The RFQ work-order assignment does not ask (the manager chose from the comparison that shows the mark). `document_confirm` on a user assignee is a 422. |
| Documents data | One reader, `services/tickets/vendor_documents.py`: it calls CR-MAINT215's `vendor_status()` once that bundle is merged and, until then, reads the same `maint_tasks` rows itself; it answers empty while the table or `maintenance.enabled` is missing. The tests create a minimal `maint_tasks` table (`IF NOT EXISTS`, MAINT215's column names) so they hold on both sides of the merge. |
| Settings added | `vendor_stats.{list_limit, csv_columns, strip_numbers}`, `vendor_documents.{confirm_on_assign, confirm_expiring, comparison_marks}`. No migration. |
| Not in slice 2 | The strip in the assignee picker (`/tickets/assignees`), the documents block on the card answer, the vendor card's working-hours response time, the RFQ work-order confirmation, every screen. |

## 19. Owner review 24.10 decisions

Source: the owner's review of the mockups, 2026-10-24 (`private/planning/OWNER_MOCKUP_REVIEW_2026-10-24_raw.txt`, item 8). Question numbers below are those of the review form; where they differ from this document's own question list the matching section is named. Recorded as the owner's decisions; the build follows them.

Mockup v2 approved with these answers:

- **Comparison rows (form Q3):** the "supplier" and "documents" rows of the quote comparison go **before** the price row (the recommended option).
- **Missed-arrival actions (form Q5):** the three actions offered when the vendor did not arrive are **enough for now**, and **adding and editing actions is to be allowed later** (the action list is to be extensible, in line with the standing rule that thresholds, recipients and defaults are editable in Settings).
