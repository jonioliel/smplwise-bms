# CR-MAINT215 - maintenance and field: one recurring-task model

Status: slice 1 (backend) implemented on `pilot/MAINT215-295` (from `origin/main` @ `90cd7d9ae`). Release target 2.15.0, bundle
"maintenance and field" (owner-approved; the design is ours to propose). Board rows r084 (supplier documents), r085 (certificate /
inspection ledger), r086 (preventive maintenance), r087 (rounds), r088 (QR / NFC tags). Sources of intent:
`private/planning/EXPANSION_IDEAS_2026-10-20.md` ideas 2, 3, 10, 11 and 29 (idea 10: "build the three on one recurring task").

Module switch `maintenance.enabled`, **OFF by default**. Migration `0147_maintenance.sql` (provisional; 0146 is held by another
branch - the lead renumbers at integration). No new public surface, no external model, no device write.

## 1. The problem

Five owner rows describe one thing seen from five sides: something in the building must be done or renewed on a date, somebody
must be reminded before it lapses, and the work should land in the service-request module.

| Row | What the building manager has today |
|---|---|
| Ledger of certificates and mandatory inspections (elevators, generator, fire safety, kitchen hoods) | A spreadsheet; the date lapses silently |
| Preventive maintenance | Done "when someone remembers"; service requests are reactive only |
| Rounds / digital checklists | A paper sheet; no history, no link to a request when something is wrong |
| Supplier documents with expiry (insurance, electrician licence, work-at-height) | Nothing; a supplier without valid insurance works in the building |
| QR / NFC tags on equipment | Nothing |

## 2. The model: one task, four kinds

`maint_tasks` - one row per obligation:

| Kind | What it is | Its date means | Renewed / done by | Default lead |
|---|---|---|---|---|
| `certificate` | A certificate or a mandatory inspection (elevator inspector, generator test, fire extinguishers, sprinklers, kitchen hood cleaning) | valid **through** the date | `maintenance.manage` enters the new valid-until date (suggested from the interval when there is one) | 30 days |
| `preventive` | A preventive plan (filters, pumps, lubrication) with an interval and an optional checklist | to be done by the date | `maintenance.perform` marks it done; the next date follows the fixed schedule | 7 days |
| `round` | A round: an interval and a checklist of checkpoints | to be walked by the date | `maintenance.perform` walks it (a run, section 3.2) | 0 days |
| `vendor_document` | A supplier's document (insurance, electrician licence, work-at-height approval, other) | valid **through** the date | `maintenance.manage` enters the new date | 30 days |

Common columns: title, category (closed list in code: elevator, generator, fire, kitchen_hood, electrical, pumps, hvac, water,
safety, other), notes, **place** (site / building / floor - the RBAC target), and optional links: an entity (a catalogued device),
an elevator (`infra_elevators`), a generator (`generator_devices`), a supplier (`ticket_contacts` of kind vendor), a responsible
user. Schedule: `interval_unit` (day / week / month / year) + `interval_count`, `anchor_date`, `due_date`, `lead_days` (0-365).
Automation: `auto_ticket` + `department_id`. `active` (pause), soft delete (`deleted_at`).

`maint_records` - the history: a completion (`kind = completion`) or a round run (`kind = run`, `status` open / done / cancelled,
the checklist snapshot, the answers with the time of each mark, the request ids opened from it). One open run per round
(unique partial index).

`maint_tags` - a QR / NFC tag: an opaque random token (`secrets.token_urlsafe(16)`, 128 bits), its target (a task or a device), a
label, revocation.

### 2.1 Dates and expiry maths

All task dates are local calendar dates in the installation's IANA zone (`time.zone`, default Asia/Jerusalem; never a fixed
offset). Instants are UTC. The module has an injectable clock (`services/maintenance/access.set_clock`) - the tests cross every
boundary with explicit instants, no sleeps.

    overdue   today > D                 (a certificate / document: expired - it is valid THROUGH its date)
    due_soon  D - lead <= today <= D
    ok        today < D - lead
    none      no date, or the task is paused

Fixed schedule: occurrence k = anchor + k x interval; months and years clamp to the month's last day and are always measured from
the anchor (31 Jan -> 28/29 Feb -> 31 Mar, never drifting to the 28th; 29 Feb yearly -> 28 Feb in common years). A completion
moves the date to the first occurrence strictly after max(current due date, completion date): early work never skips the next
cycle, late work never asks for the missed ones. A plan created with an anchor in the past starts at the first occurrence from
today. A manager may override the next date (`next_due`, after the work date).

## 3. State machines

### 3.1 Task

    created (active) --pause--> paused --resume--> active
         |   due state is derived: ok -> due_soon -> overdue (never stored)
         |-- complete / round finished --> active with the next due date (records row)
         `-- delete --> deleted (soft; open run cancelled, tags revoked, reminders resolved)

Kind never changes. `revision` guards concurrent edits (409 `revision_conflict`).

### 3.2 Round run

    (none) --start [perform, active round, checklist not empty, no open run]--> open
    open --answers [the starter with perform, or a manager]--> open
    open --finish [every required checkpoint answered]--> done (result ok | issues; the round's next date follows)
    open --cancel [the starter or a manager]--> cancelled (the due date stays)

A checkpoint answer is `check` (ok true/false), `number` (judged against the item's min/max; a person may still mark an in-range
value as a problem) or `text`. Each answer keeps the time of the mark only - never a position (EXPANSION_IDEAS idea 2: no GPS).

### 3.3 The reminder level of a due date (worker)

    0 --today >= D - lead--> 1 (maintenance.due_soon) --today > D--> 2 (maintenance.overdue; the level-1 row is resolved)

Stored as `reminded_due` + `reminded_level` in the same transaction as the notification, so a second pass never repeats it. A
completion, a new date, a pause or a delete resolves the open rows of the old date.

## 4. Permissions and isolation

| Permission | Built-in holders | Opens |
|---|---|---|
| `maintenance.view` | operator, site_admin, system_admin | the ledger, plans, rounds, a task's history, the card helpers, a scanned tag |
| `maintenance.perform` | operator, site_admin, system_admin | start / answer / finish a round, mark a preventive plan done |
| `maintenance.manage` | site_admin, system_admin | create / edit / move / pause / delete tasks, renew a certificate or a supplier document, override a next date, create / list / revoke tags |

Not sensitive (no money, no person data, no physical action) - recorded so the owner can say otherwise (question 2). Default deny
for viewer, kiosk, editor. `roles.json` and `contracts/examples/role-catalog.design.json` agree (test).

**Where**: the task's place - floor, else building, else site, else the installation. A placeless task is an installation-level
task: a floor-scoped holder does not see it (stricter than the tickets module's "any scope" rule for placeless tickets, on purpose:
an inspection of the whole building is not a floor operator's business). The RBAC chain applies unchanged, so an explicit deny on
the chain wins. Supplier documents are always placeless (a place is refused), so they need `maintenance.view` at the installation.

**Order of every route**: signed-in principal -> module switch (404 `feature_disabled`, a router dependency, so a later route is
gated too) -> permission (an audited 403) -> visibility (an invisible, unknown, deleted or foreign task is the same 404
`maint_task_not_found`; a run, a tag the same way). Moving a task needs `manage` on both places.

**Cross-module rules** (fail closed):
* Setting `auto_ticket` (requests on schedule into a department) needs, besides `maintenance.manage`, `tickets.configure` or
  manager rights in that department (`tickets.manage` + a manager membership, or `tickets.all_departments`) - the tickets module's
  own model (`tickets/access.Viewer.manages_department`). Refused: an audited 403 `not_department_manager`.
* A device link needs the device readable (`tickets/device_context.readable_entity`: `devices.read` and the lock / alarm rule); an
  unreadable device is "unknown" (422), never "forbidden" - no existence leak.
* Owner rule 2026-10-20: **with the tickets module off there is no "open a service request" action anywhere**: `can.open_request`
  is false in the module state, the task detail, the run and the scan answer; the checkpoint route answers the tickets module's own
  404 `feature_disabled`; the worker opens nothing.

Arx RBAC is the only authority: no client flag, no Home Assistant admin flag, no WisKey claim grants any of this.

## 5. Reminders and requests - the existing infrastructure

* **Loop**: one more step of the existing janitor (`main.janitor_tick`, every 30 s), throttled to one pass per 15 minutes per
  process (`services/maintenance/reminders.janitor`). No new thread. Nothing runs while the module is off.
* **Notifications**: the CR-018 pipeline (`notify.emit_full`), two new catalogue sources:
  `maintenance.due_soon` (info) and `maintenance.overdue` (alert), category `device_faults`, in the app only by default (no push,
  no e-mail, no WhatsApp - the administrator may add channels in Settings > Notifications like any source). Dedupe key
  `maint:<task>:<due>:<level>`. Text: the task's title, a verb and a date - never a person, a phone number or a file. The two
  sources are hidden from the policy matrix while the module is off (the tickets module's precedent).
* **Who**: new recipient rule `maintenance` = the task's responsible user + the holders of `maintenance.manage` on the task's
  place; new subject kind `maintenance` whose visibility is exactly the task's (module on + `maintenance.view` there), so the
  centre's usual intersection drops anyone who may not see the task.
* **Requests on schedule**: from the due-soon day on, a task with `auto_ticket` and a department opens ONE request for that due
  date through the tickets module's single creation path for system authors (`tickets/create.create_by_rule`: placeless,
  unassigned, author "system", origin `rule`, `rule_ref = maint:<task>`, dedupe key `maint:<task>:<due>` so a repeat is absorbed).
  The description carries the due date, the checklist lines and the notes. Inside a SAVEPOINT: a refusal (department gone,
  inactive) leaves nothing half-made and is kept as `ticket_error` (`department_unavailable`, `tickets_off`) for the screen; the
  reminder still goes out. Audited `maintenance.ticket.open` (actor: system).
* **Checkpoint -> request**: from a round, the person opens a request with the tickets module's person path
  (`tickets/create.create_ticket`): their own `tickets.create` in the department, the task's device when it has one (origin
  `device`, the device's 24 h context captured as for any device request). The request id is kept on the answer and the run.

## 6. Reuse of the tickets, elevators and generator modules

| Reused | How |
|---|---|
| Tickets: creation | `create_by_rule` (worker) and `create_ticket` (checkpoint) - no second creation path |
| Tickets: departments, managers | the auto-request gate (`Viewer.manages_department`, `tickets.configure`) |
| Tickets: supplier directory | `vendor_id` points at `ticket_contacts` (kind vendor); supplier documents hang off the existing card |
| Tickets: device rule | `device_context.readable_entity` for device links and device tags; `visible_for_entity` for the open-request count of a scanned device |
| Elevators / generator | `elevator_id` / `generator_id`; `GET /maintenance/by-subject/{elevator|generator|entity|vendor}/{id}` answers the "inspection valid until ..." row of those cards (the cards themselves change in slice 2) |
| Notifications | sources, recipient rule, subject kind (section 5) |
| Janitor loop | one more throttled step |
| Settings | `maintenance.enabled` with its own audit rows `maintenance.module.enable` / `.disable` (system.configure, like every setting) |

`vendor_status(conn, vendor_ids, today)` is the helper the tickets assignee picker will use in slice 2 ("insurance expired
03.10"): document types and dates only; empty while the module is off.

## 7. API (slice 1)

| Route | Permission |
|---|---|
| `GET /maintenance/module` (answers while off) | signed in |
| `GET /maintenance/tasks?kind&state&category&q&include_inactive` | view (rows filtered per place) |
| `POST /maintenance/tasks` | manage on the new place (+ department gate for `auto_ticket`) |
| `GET /maintenance/tasks/{id}` / `GET .../records` | view |
| `PATCH /maintenance/tasks/{id}` (revision) | manage (on both places when it moves) |
| `DELETE /maintenance/tasks/{id}` | manage |
| `POST /maintenance/tasks/{id}/complete` | manage (certificate, document, `next_due` override) / perform (preventive) |
| `POST /maintenance/tasks/{id}/runs` | perform |
| `GET /maintenance/runs/{id}` | view |
| `PUT /maintenance/runs/{id}/answers`, `POST .../finish`, `POST .../cancel` | the starter with perform, or manage |
| `POST /maintenance/runs/{id}/items/{key}/request` | the starter or manage, AND the tickets module on and the tickets rules |
| `GET /maintenance/by-subject/{kind}/{id}` | view |
| `GET /maintenance/vendors/{id}/documents` | view at the installation |
| `GET /maintenance/tags`, `POST /maintenance/tags`, `DELETE /maintenance/tags/{id}` | manage (on the task's place; installation for a device) |
| `GET /maintenance/scan/{token}` | view, and the target visible (else the same 404) |

Audit rows: `maintenance.task.create|update|delete|complete|department`, `maintenance.run.start|finish|cancel|request|answer`,
`maintenance.tag.create|revoke`, `maintenance.ticket.open`, `maintenance.module.enable|disable`, and every refusal. A tag's token
is never written to the audit.

## 8. What is explicitly NOT built (slice 1; slice 2 and MAINT215B built most of it - see the last section)

* **No UI** beyond the API (the mockup `docs/design/mockups/maintenance-215/index.html` is for the owner's approval).
* **No file of the certificate / document** (upload, preview). Slice 2, through the tickets attachment validator - not a second
  file pipeline.
* **No public scan page**: a tag resolves only for a signed-in person. A tenant scanning without an account (idea 5, the tenant
  page) is a new public surface and needs its own security review - not part of this bundle.
* **No QR image / NFC writing in the backend**: the token and the in-app path (`#/m/<token>`) only; printing is slice 2 (the
  address printed on the sticker is owner question 4).
* **No location tags** (organisation locations) - only task and device tags.
* **No usage-based schedules** (run hours from a power sensor) - calendar intervals only (idea 10's "later").
* **No change to the tickets assignee picker, the elevator or the generator cards** yet - the read helpers exist.
* **No link back from a request's closure to the task** (closing the request does not complete the plan) - slice 2 proposal.
* **Not in project backups yet** (the three tables are not in `backup.PROJECT_TABLES`) - owner question 6.
* No WhatsApp, e-mail or push by default; no notification to a supplier.
* No GPS or any position, no photo in a run (photos come with the file work of slice 2).

## 9. Migration and rollback

`0147_maintenance.sql`: three new tables and their indexes, nothing else. Rollback = switch the module off (data kept, every route
404, the worker idle); a downgrade leaves three unused tables. The permissions are additive in `roles.json`; custom roles are not
touched.

## 10. Tests

`smplwise_vms/backend/tests/test_maintenance_215.py` (negative first): the switch off by default and every route's uniform 404,
the switch audited and system.configure-only; the permission catalogue (defaults, labels, contract, not sensitive); refusals
audited, nothing written; isolation floor / building / installation and moving between places; deny on the chain wins;
22 validation cases; revision conflict; date maths (month clamp, leap year, early / late / very late completion, due-state
boundaries, the zone's midnight); the reminder pass (once per level, resolved by renewal / pause / reschedule / delete, recipients
by scope and visibility, notification visibility = task visibility, the janitor throttle, sources hidden while off); requests on
schedule (one per due date, the system path, none while tickets is off, a vanished department recorded); completion rules; a
round end to end; a checkpoint request as the person; tags; the elevator card and supplier documents.

## 11. Open owner questions (recommendation first)

1. Reminder lead times - defaults 30 days (certificates, documents), 7 (plans), 0 (rounds), editable per task.
   a. as built (recommended)  b. 60 days for certificates  c. one installation-wide value
2. `maintenance.manage` - an ordinary permission (site_admin, system_admin), or sensitive like `tickets.configure`?
   a. ordinary (recommended: no money, no person data)  b. sensitive, system_admin only by default
3. A placeless task (e.g. the sprinkler certificate of the whole site) is visible only to installation-level holders.
   a. as built (recommended)  b. like the tickets module: visible to a holder at any scope
4. What address a QR sticker carries: the in-app path behind the installation's remote address (sign-in required).
   a. the remote address (recommended)  b. the local address only  c. ask per print
5. Assigning a request to a supplier whose insurance has expired (slice 2):
   a. a red mark in the picker plus a manager confirmation (recommended)  b. a mark only  c. refuse
6. Include the maintenance tables in project backups?
   a. yes, in slice 2 with restore tests (recommended)  b. no
7. Closing the request opened by a plan:
   a. marks the plan done automatically (recommended, with the closer as performer)  b. stays manual
8. Notification category for the two sources: `device_faults` today.
   a. keep (recommended)  b. a new "maintenance" category in the notification settings

## 12. Proposed slice 2

UI (after the mockup is approved): the ledger screen with states and filters, the task sheet, the round runner for the phone
(one checkpoint per screen, large targets), supplier documents on the supplier card, the "valid until" row on the elevator and
generator cards, tag printing (QR SVG, label) and the `#/m/<token>` route; certificate / document files through the tickets
attachment pipeline; the supplier mark in the tickets assignee picker; request closure -> plan done (question 7); backup inclusion
(question 6); the API inventory and user-guide pages; he / en first, ar / ru marked initial.

## Owner review 24.10 decisions

Source: the owner's review of the mockups, 2026-10-24 (`private/planning/OWNER_MOCKUP_REVIEW_2026-10-24_raw.txt`, item 6). Question numbers below are those of the review form; where they differ from this document's own question list the matching section is named. Recorded as the owner's decisions; the build follows them.

Mockup v2 approved with these answers:

- **Reminders (form Q3; this document's Q1):** the proposed lead times (30 days before a certificate expires, 7 days for a plan) are accepted, **but reminders are sent only after they are enabled in settings**; until then none goes out.
- **Phone round (form Q4):** the mockup's one point per screen stays, and the technician can **switch the round to one long list**, either from settings or with a **quick-change button on the screen**.
- **Vendor without insurance (form Q5; this document's Q5):** **marking only** (option b): a mark in the picker, no manager confirmation and no refusal.
- **Closing a request opened by a plan (form Q6; this document's Q7):** closing marks the plan done **automatically**, but the system **asks the user a question and he decides** whether to mark it done. This is the automatic behavior: a proposal with a confirmation, neither a silent change nor a manual-only flow. Option a of Q7 is adjusted accordingly (the closer is recorded as the performer when the user confirms).
- **Sticker address (form Q7; this document's Q4):** the **remote address** (option a).

## MAINT215B - the owner review 24.10 built (branch `pilot/MAINT215B-295`)

Implements the decisions above on top of slice 2. Migration 0147 is still provisional and was edited in place (two more tables: `maint_files`, `maint_reminder_log`; neither is carried in a project backup - `backup.NEVER_EXPORTED_TABLES`). Every threshold and behaviour is a setting (Settings > Infrastructure > Maintenance, `system.configure`):

| Setting | Default | Meaning |
|---|---|---|
| `maintenance.reminders_enabled` | false | **No reminder goes out until it is enabled.** While off the level reached is not advanced, so enabling later sends what is due at that moment (once). A request on schedule is a per-task automation a manager set and does not wait for this switch. |
| `maintenance.reminder_check_minutes` | 15 (1-1440) | how often the worker looks |
| `maintenance.reminder_log_keep_days` | 365 (7-3650) | how long the log is kept |
| `maintenance.round_phone_view` | step | `step` (one checkpoint per screen) or `list`; the person's own choice on the screen (quick switch, saved in his browser) wins |
| `maintenance.close_request_mode` | ask | `ask` / `auto` / `off`, see below |
| `maintenance.vendor_missing_insurance_mark` | true | also mark a supplier with no insurance document at all |
| `maintenance.vendor_insurance_warn_days` | 30 (0-365) | amber mark when the insurance ends within this many days |
| `maintenance.file_max_per_task` | 10 (1-50) | files per certificate / document |
| `maintenance.tag_base_url` | "" | sticker address override; empty = the **remote address** (`security.local_public_url`, else the tickets public address) |

* **Supplier without insurance (form Q5, option b: marking only).** `GET /tickets/assignees` carries `insurance: {state: expired|expiring|missing|ok, valid_until}` on a supplier (and on a contact of a supplier) while the module is on; the picker shows a red mark (amber while ending). Nothing is refused, no confirmation is asked, no approval permission is involved (the earlier "manager approval" of q17 was superseded by the owner's later answer "marking only"). Document types and dates only; the assign dialog is a manager's.
* **Certificate / document file.** `POST/GET/DELETE /maintenance/tasks/{id}/files`. A PDF passes the tickets cost-file check (`cost_files.check_pdf`: header, `%%EOF`, no active content or encryption, 10 MiB, stored as received and served only as a sandboxed download); a photographed page passes the tickets image pipeline (`image_intake.reencode`: fresh metadata-free JPEG, 8 MiB). Random names under `<data>/maintenance/<task>/`, confined paths, the decode outside the write lock, its own body-limit row. Upload / delete: `maintenance.manage` on the task's place; download: `maintenance.view`. Audited without the name or the bytes.
* **Reminder log.** `GET /maintenance/reminder-log` and the page "יומן תזכורות": reminders (soon / overdue), requests opened, requests that could not be opened; only tasks the caller may see (a deleted task's line: managers only); the page says when reminders are off.
* **Elevator and generator rows.** The task form links a task to an elevator or a generator (`GET /maintenance/options` lists them); each elevator card and the generator page show a "certificates and inspections" row (nearest date and state, link to the ledger) through `GET /maintenance/by-subject/...`, only while the module is on and the person may view it.
* **Closing a request opened by a plan (form Q6).** Default `ask`: the closing does NOT change the plan; the shell asks the closer ("mark the plan done? next date ...") through `GET /maintenance/close-proposal/{ticket}` and, on yes, `POST .../confirm` marks the plan done for that due date with the confirming person as the performer. The question appears only for a person who may mark the plan (perform / manage) and only for the plan's current cycle; `auto` keeps the 24.10 q19 behaviour (marked at the close), `off` leaves the plan alone. Limit: the question is raised by the closing in the staff UI; a close by the tickets janitor or the vendor page asks nobody.
* **Phone round list.** The module state carries the installation default; the round run has a quick switch (one point / one list) saved in the person's browser; the list saves all marks in one call.
* **No page scrolling in control screens.** The maintenance section fills the height of the screen; the places tree, the table, the log, the stickers and the run scroll inside their own panel.
