# CR-038 phase 2 (TKRULES-291): tickets opened automatically from alerts - design note

Backlog item `tickets-rule-based-creation` ("פתיחת קריאות אוטומטית מכללים והתראות (שלב 2)"). Branch `pilot/TKRULES-291`, cut from
`integ/290`; target 2.9.1 / 2.10 (not the 2.9.0 gate). Migration **0123** (built as 0122; renumbered at integ/291) (`ticket_rule_fires`). This note is the smallest safe
phase 2; section 18 of `CR-038-TICKETS-MODULE.md` was the hook (`TicketSpec.origin = 'rule'`, `rule_ref`, `dedupe_key`).

## 1. What it does

An installation-level rule set (setting `tickets.rules`, its own revision-checked JSON document, default **empty** = nothing
happens):

> when an alert of source **S** (optionally one subject) is active and has been active for **N** minutes, open **one** ticket in
> department **D** with a template title / description / priority (optional category), attach the alert, and do not open another
> while one is open for the same key; when the alert clears, add an automatic system note, and close the ticket when the rule says
> so and nobody has taken it yet.

- **Trigger = an open row of the notification core** (`notifications`, CR-018). Every alert source of the product (sensors, device
  faults, recorders, generator, elevators, doors left open, schedules, backups ...) already lands there as ONE open condition per
  dedupe key with `first_at` (when it started) and `state` (`resolved` when it ended). No new hook in `notify.emit()` and nothing in
  the source modules changes. A source whose notification policy is switched off produces no row and therefore no ticket (stated
  in the UI).
- **Allowed trigger sources** (`rules_doc.allowed_sources()`): catalogue sources that resolve by themselves (`resolves=True`), not
  in the `tickets` / `security` categories, subject kind not `ticket` / `rfq` / `session`. Event-like sources that close on
  acknowledge (rule alerts, sign-ins, bulk results) cannot be a trigger in this phase: their "clear" is a person's acknowledge.
- **The engine** (`services/tickets/rule_engine.py`) is a janitor step next to the SLA monitor (`retention.janitor`, own
  once-a-minute throttle). Polling - not a hook in `emit()` - is what makes "stays active N minutes" and loop-freedom simple.
- **Author = the system.** `create.create_by_rule()` is the system branch of the one creation path: same validation of department
  (active, not deleted), category, priority, text hygiene and length limits; `created_by = "system"` (never a user id, so nobody
  gains the "creator" reason of the visibility rule), `origin = 'rule'`, `rule_ref = 'rule:<id>'`, timeline actor `system`,
  audit actor `None` with `details.origin = rule`. No assignment, never an outside contact, no device history capture.

## 2. Settings document `tickets.rules`

```
{ "revision": n, "enabled": true,                 # the global kill switch
  "daily_limit_default": 20,                      # installation default, 1..200 (HARD_DAILY_MAX)
  "rules": [ { "id", "name", "enabled", "source", "subject_id" ("" = any), "hold_min" (0..1440),
               "department_id", "priority_id" | null, "category_id" | null,
               "title" (template, <= 120), "description" (template, <= 2000),
               "on_clear": "comment" | "comment_close",
               "daily_limit": null | 1..200 } ] }    # null = the installation default
```

- At most **50 rules** (`MAX_RULES`). Placeholders: `{alert}` `{details}` `{place}` `{source}` `{since}` - anything else is
  refused (422 `placeholder`). Rendered values come from the notification row (already person-free by the CR-018 contract), are
  cleaned (`model.clean_text`) and clipped to the ticket limits.
- **Daily limit:** effective = rule override or the installation default; hard bound **200** per rule per local day (installation
  time zone). 200 is chosen as the bound because it is ten times the default, far above any real fault rate of one rule, and still
  small enough that a mis-configured rule cannot flood a department's board in a day. Validation: integer, `1 <= n <= 200`.
- Not in `GET /settings`; kept out of project backups (`backup.SETTINGS_KEEP`, a restore never switches rules on).
- Edited only with **`system.configure`** at installation scope (`tickets.configure` is not enough: the rule decides which
  installation-wide alerts flow into which department). Every save is audited (`tickets.rules.update`, rule ids + changed fields,
  never free text).

## 3. Data: migration 0123 `ticket_rule_fires`

One row per (rule, notification row): `outcome` `created | absorbed | suppressed | refused`, `ticket_id`, `day` (local date),
`at`, `cleared_at`. `UNIQUE(rule_id, notification_id)` = **idempotency**: a notification occurrence is acted on at most once per
rule, whatever the restarts or overlapping ticks. The ticket table's existing unique index on open `dedupe_key` is the second lock.

**Stable dedupe key:** `trule:<rule id>:<sha256(notification dedupe key)[:24]>` - the notification's own dedupe key is stable per
condition (`sensor.leak:entity:binary_sensor.x`), so a condition that clears and comes back while its ticket is still open is
**absorbed** (a system note "the alert came back", no new ticket, not counted against the limit).

## 4. One tick

1. Module off or `enabled = false` (kill switch) -> nothing at all (no tickets, no notes, no closes).
2. Per enabled rule: open notification rows of its source (and subject), `first_at <= now - hold`, with no fire row yet, oldest
   first, at most 50 per rule per tick:
   - an open ticket with the key -> `absorbed` (+ system note);
   - else today's `created` count >= effective limit -> `suppressed` + audit `tickets.rule.suppressed` (decision `denied`, reason
     `daily_limit`; once per notification row thanks to the unique row). A suppressed occurrence is not retried the next day
     (no midnight burst);
   - else create -> `created` (+ a system note that carries the alert: source, place, since);
   - a refusal of the creation path (department deleted / inactive, priority gone) -> `refused` + audit `tickets.rule.refused`.
3. Clear pass: `created` / `absorbed` fires whose notification row is resolved (or already pruned) -> system note "the alert
   ended"; with `on_clear = comment_close` the ticket is closed by the system **only while it is still `new` and unassigned**
   (a new system move `new -> closed`; a ticket somebody already took gets the note only). `cleared_at` set, so once only.

## 5. Threat model

| Threat | Control |
|---|---|
| Loops (a ticket raises a notification that opens a ticket ...) | ticket / RFQ / security / session sources are not allowed as triggers (validation at save AND at fire time); the engine is a poll that writes only tickets and timeline rows; one fire per notification row |
| Floods | per-rule daily limit (default 20, override, hard 200), max 50 rules, at most 50 new fires per rule per tick, the global kill switch, absorbed repeats instead of new tickets |
| Duplicates / races | `UNIQUE(rule_id, notification_id)`; the open-dedupe unique index on `tickets`; single janitor thread; the fire row and the ticket commit in one transaction |
| Widened visibility | the ticket is placeless and created by `system`: visible exactly as any placeless ticket of D (members, managers, all-departments holders with tickets.view) - nobody gains "creator"; no device history is frozen into it; the dry-run lists only notifications the caller may see (`Reach.can_see`). The alert's title / place do enter the ticket - that is the administrator's explicit routing decision (system.configure), documented in the UI sub-title |
| Privilege | edit, list and dry-run need `system.configure`; the engine never assigns, never messages outside contacts, never acts on devices |
| Untrusted text | templates and rendered values pass `clean_text` (bidi / controls stripped), placeholder whitelist, length clips |
| Audit | rule edits, every created ticket (`ticket.create`, actor system, origin rule), suppression and refusal; the timeline shows the system notes |

## 6. API (all `system.configure`, behind the module gate)

- `GET /tickets/rules` - the document + per-rule `effective_limit`, `today_created`, `limit_reached`, `last_fired_at`; the allowed
  sources (key, label, category); the bounds.
- `PUT /tickets/rules` - the whole document with `revision` (409 `rules_stale`), 422 with `details.fields` (`rules[i].field`).
- `POST /tickets/rules/test` - dry run of one rule body: validation, the matching open alerts the caller may see (count + up to 5),
  what would happen now (`create | absorb | suppressed | wait_hold | nothing | rules_off`) and the rendered title / description.
  Writes nothing.

## 7. UI

Settings > service management > new tab **"פתיחה אוטומטית"** (`rules`, system.configure): the kill switch, the installation daily
default, the rule list (name, source, department, effective limit "x / day", today's count, a "limit reached today" chip, enable
toggle, edit), the inline editor with client-side validation mirroring the server, and "בדיקת כלל" showing the dry-run answer.

## 8. Not in this phase (open for the owner)

- A per-department policy "accept rule tickets" (section 18 mentions it); today the administrator's rule is the decision.
- Rule alerts (`rule.alert`, camera events) as triggers - they close on acknowledge, so "clear" has no meaning yet.
- Automatic assignment of rule tickets.
- A `ticket` action kind inside the camera rules engine (`services/rules.py`) and a HA-side `create_ticket` service.
