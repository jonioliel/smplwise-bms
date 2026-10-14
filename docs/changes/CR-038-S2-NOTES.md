# CR-038 slice 2 - departments + SLA: implementation notes

Branch `pilot/TICKETS-s2`, cut from `origin/pilot/TICKETS-s1` (02f6a57a). Spec: `docs/changes/CR-038-TICKETS-MODULE.md` (r2.7),
section 20 row 2, with sections 7.1, 8, 8.2, 10.2 (link lifetime), 13.1-13.3, 13.7, 14.1-14.2 and decisions D3-D5, D10, D11, D23,
D25, D28. No migration: 0079 (slice 1) already holds every column slice 2 writes.

## 1. What slice 2 delivers

**Installation values (`tickets.settings`, `system.configure`, revision-checked).** `settings_doc.SCHEMA` gains `links.sliding_days`
(14, 1-90), `links.cap_days` (90, 7-365, never below the sliding window), `links.grace_hours` (24, 0-168), `send_hours`
(`{"from":"07:00","to":"21:00"}`, `from < to`: a window across midnight or an empty one is 422) and `urgent_is_critical` (true).
A stored pair that breaks the cap rule reads as the default pair (fail safe). `PUT /tickets/settings` accepts the blocks with strict
types; a 422 names the key path and the code (`range`, `below_sliding`, `order`, `time`).

**Department policy (`services/tickets/policy.py`).** The ONE place that resolves what is in force for a department: its overrides
(`link_sliding_days`, `link_cap_days`, `link_grace_hours`, `send_hours_json`, `urgent_is_critical`; NULL = the installation value) over
the installation values, plus `auto_close_after_days` (D10, 1-30 or NULL = two-step), `share_history_external` (D3 / D23 department
default) and `reopen_days`. Helpers for the later slices: `effective(conn, dept)`, `notify_severity(policy, severity)` (D28 cap of
`critical` to `alert`) and `may_share_history(policy, domain)` (never lock / alarm_control_panel / cover / camera).

**Admin routes (`routers/tickets_admin.py`, all `tickets.configure` at installation scope, module gate first).**
- `PATCH /tickets/admin/departments/{id}` (and `POST`) accept the policy fields; an explicit `null` clears an override; ranges as the
  installation values; the cap rule is checked against the values that will be in force (the override, or the installation value it
  falls back to). The audit row `ticket.department.update` carries the changed field names and, for policy fields, `[before, after]`
  (numbers, flags, a time window - configuration, never text). A change of `auto_close_after_days` recomputes the dues of the
  department's waiting "done" tickets.
- `GET /tickets/admin/departments` adds per department `overrides`, `effective`, `auto_close_after_days`, `share_history_external`,
  `sla` (one row per priority with all nine fields and its revision), `templates`, `categories[].domains`, and at the top
  `installation` (the values the overrides fall back to - the screens show "ברירת המחדל: ...").
- `PUT /tickets/admin/departments/{id}/sla` `{rows: [{priority_id, revision, <fields>}]}`: only the fields sent change (null turns a
  threshold off; the two counters are never null). Every row is checked first (priority of THIS department, values, revision) and
  nothing is written unless all pass: 422 with `rows.<i>.<field>`, 409 `sla_stale` with the stale priority ids. Open tickets of a changed
  priority get their dues recomputed at once. One audit row `ticket.sla.update` per changed priority with `{field: [before, after]}`.
- Ticket templates (`kind = 'ticket'`): `POST /tickets/admin/departments/{id}/templates`, `PATCH /tickets/admin/templates/{id}`
  (revision, 409 `template_stale`), `DELETE /tickets/admin/templates/{id}` (soft). Name 1-60, title <= 120, body <= 4000 (Cc/Cf
  stripped), category of the same department, priority key, active. At most 50 per department. Audit
  `ticket.template.create|update|delete` with a unified diff of name / title / body (review T19; capped at 4000 characters).
  `kind = 'message'` answers 422 `kind: not_supported` (slice 5b).
- Categories accept `domains` (device types that preselect the category from a device; `^[a-z][a-z0-9_]{0,39}$`, <= 20, stored sorted
  and unique in `domains_json`). Members accept `notify_new` from the screen (slice 1's route).
- `GET /tickets/admin/holders` adds `roles`: every role but the six grant roles, with the ticket permissions it carries (the "מי רשאי"
  matrix; built-in first in a fixed order, then organisation-defined roles).
- `GET /tickets/meta` adds the active ticket templates per department (the create form prefills from them).

**SLA dues (`services/tickets/sla.py`).** `compute()` (pure) and `refresh(conn, ticket_id)` set `ack_due_at`, `stuck_due_at`,
`resolve_due_at` and `next_check_at` at every change of a ticket - create, edit (a priority change recomputes from creation, 11.3),
status, assign, return, note, ETA, photo - and on a rule or automatic-close change. The revision does not move. The columns:

| Column | Status | Threshold (from) |
|---|---|---|
| `ack_due_at` | new / returned | `unassigned_after_min` from the moment it became unassigned (creation, the last assignment end, the last reopen) |
| `ack_due_at` | assigned | `ack_within_min` from the assignment |
| `stuck_due_at` | acknowledged / in progress | `stuck_after_min` from the last activity; a later ETA moves it to the ETA (13.2) |
| `stuck_due_at` | waiting for a part | `stuck_waiting_min` from the last activity; same ETA rule |
| `resolve_due_at` | every open status but done | `resolve_within_min` from creation |
| `next_check_at` | open | the earliest of the above; for "done" with an automatic close: `done_at + N days` |

`due_kind(status, column)` names the threshold each column carries (`unassigned`, `ack`, `stuck`, `waiting`, `overdue`). Ticket items
carry `sla: {ack_due_at, stuck_due_at, resolve_due_at}`.

**Screens (Settings › the module).** כללי: two new cards - link lifetime (D5) and vendor send hours + urgent as critical (D4 / D28),
`system.configure`. מחלקות: a list of departments (name, counts, inactive tag, "+ חדשה") beside the editor of the chosen department
(`tickets/settings-dept.ts`): details (name, description, active, open to all, reopen days), categories (chips; a chosen chip edits its
parent, default priority and device types), members (manager / member, the new-ticket alert for managers), the department rules
(history to the handler, automatic close with days, urgent as critical "as the installation / yes / no", link lifetime and send-hour
overrides behind "לפי המחלקה" with the installation value in the hint), the SLA grid (`tickets/settings-sla.ts`: thresholds x
priorities, value + unit, empty = off, one save, all or nothing; one card per priority on a phone), priorities (name, alert severity,
default, active) and opening templates. הרשאות: the "מי רשאי" matrix (roles x the six permissions, sensitive ones marked), holders by
person or by permission (deny bindings marked), and the personal grant card now with a scope (installation / site / building / floor)
and an optional end date - still the ordinary `POST /access/bindings` (rbac.assign and the delegation rules decide). The create form
offers the department's opening templates.

## 2. Readings taken (safest one each time)

1. **Cost-claim default per department** is not slice 2: its columns live in migration 0083 (slice 9, 11A.10); nothing here.
2. **Message templates** (purposes, languages, `{link}` / `{code}` rules, preview) are slice 5b's ("message templates per language (D26)
   and preview"). Slice 2 builds the template routes, storage, diff audit and the ticket kind; the routes refuse `kind = 'message'` until
   5b adds `templates.validate_message()` and lifts the refusal.
3. **"Link not opened"** (`link_unopened_min`) is edited in the grid but produces no due here: it is measured from a handler link's send
   time (slice 4 data, slice 6 monitor).
4. **`ack_due_at` holds the first-response due** for unassigned tickets as well as the acknowledge due (the schema has no separate
   column); `sla.due_kind()` disambiguates. Slice 6 may keep or split it.
5. **Lowering the installation or department link cap** pulls in live links (10.2) - there are no links before slice 4; slice 4 hooks
   that into the settings / department writes (the audit `changed` lists tell it what moved).
6. **The cap rule across levels.** A department's cap override is validated against the window in force; when an installation change
   later makes a department pair invalid, `policy.resolve` pulls the cap UP to the window (never shortens a link silently).
7. **Personal grants with a scope**: a floor-scoped grant limits the permission to tickets placed there; placeless tickets follow the
   "any held scope" rule (8). Department configuration stays installation-only (a floor-scoped `tickets_configure` grant configures
   nothing - slice 1's rule, re-asserted by a test).
8. **The mock-up's per-department WhatsApp account** ("ערוץ לחיצוניים") is slice 5a / 5b (the account mapping and its use per
   department); not built here.
9. **Priorities** stay the four fixed keys (CHECK in 0079): the mock-up's "+ עדיפות" is not offered; name, severity, default and active
   are editable.
10. **Department order** (`sort_order`) is accepted by the API (slice 1) but has no drag handle on the screen yet.
11. **Visible switch labels**: `sw-toggle` flips only on its switch, not on its visible label text (a shared-component behaviour,
    unchanged).
12. **Fixed in passing** (store.py, owned here): `store.assignments()` ordered same-second rows by their random id, so
    `test_tickets_api.py::test_assignment_rules` failed about half the time (seen on the runner); it now breaks ties by rowid.

## 3. Shared files

None of `roles.json`, `rbac.py`, migration 0079, `routers/access.py`, `nav.ts`, `main.py` is touched. Files of slice 1 that slice 2
edited (no reordering, additive except where noted): `services/tickets/{store,settings_doc,service,create,present}.py`,
`routers/tickets.py` (meta: + `templates`), `routers/tickets_admin.py`, `frontend/src/api/{tickets,tickets-mock}.ts` (types and calls
appended; `putMember` gains an optional `notifyNew`), `tickets/text.ts` (keys inserted after `depMembersLocked` in both languages),
`tickets/ticket-create.ts` (the template select), `screens/system-tickets.ts` (rewritten: its CSS moved to `tickets/settings-styles.ts`,
the department card moved to `tickets/settings-dept.ts`), `tests/tickets-mocks.ts`, `tests/test_tickets_admin.py` (the settings
document assertions compare the `ui` block only, since the document now carries more keys). No integration one-liner is needed.

## 4. For the next slices

- **Slice 3 (device tab):** `categories[].domains` is in the admin listing; add `domains` to `GET /tickets/meta` categories (one key,
  e.g. `tickets_admin.domains_of(c)`) for the create sheet's preselect. Device creation goes through `create_ticket`, which already
  calls `sla.refresh`. The D23 per-ticket box defaults from `policy.may_share_history(policy.effective(conn, dept), domain)`.
- **Slice 4 (links):** read the lifetime from `policy.effective(conn, dept)` (`link_sliding_days`, `link_cap_days`, `link_grace_hours`)
  at each computation; the first expiry needs the priority's `resolve_within_min` (`store.sla_rule`). Hook the cap pull-in into
  `put_settings` / `patch_department` (`changed` / `policy` details).
- **Slice 5a / 5b:** the send-hours window is `policy.effective(...).send_hours` (installation zone `time.zone`). Message templates:
  extend `services/tickets/templates.py` (`KINDS_BUILT`, `validate_message`) and the existing routes; the diff audit is already there.
- **Slice 6:** add the monitor to `services/tickets/sla.py` (read `next_check_at <= now`, `due_kind()` for `stuck_kind`); the
  automatic close time is already in `next_check_at`; severity through `policy.notify_severity`; the counters
  `max_reminders` / `manager_alert_after_steps` are per row in `ticket_sla_rules`.
- **Slice 6b:** the table's SLA column reads `item.sla`.

## 5. Tests

Backend `tests/test_tickets_s2.py` (11): policy resolution and fail-safe reads, the due computation per status, rule and window
validation, the installation values (ranges, cross-key rule, strict types, permission, fail-safe read), department overrides and
flags (nulls clear, ranges, the cap rule against the effective window, audit before/after), the SLA grid (defaults, partial fields,
all-or-nothing on a bad row and on a stale row, foreign priority, counters never null, audit changes), dues recomputed at every change
(assign, acknowledge, ETA, waiting, priority edit, rule edit, done, automatic close, close, return), templates (validation, kind
refusal, revision, diff in the audit, meta lists active only, delete), category domains, the roles matrix (incl. a custom role) and
the permission matrix of every new route (viewer / member / manager without configure / all-departments / floor-scoped configure ->
403; installation configure -> 2xx; module off -> 404). Frontend: `unit-tickets-durations.spec.ts` (6), `evidence-tickets-s2.spec.ts`
(6 per project: screenshots desktop 1440 + phone 390, light / dark, classic / domus, plus what each control sends), the slice-1
layout guard over the settings tabs (five skins). Evidence images: `docs/design/evidence/tickets-s2/`.
