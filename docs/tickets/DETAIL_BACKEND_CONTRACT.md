# Service-request detail - backend contract (TKDETAILBE)

Status: **v1 (stable)** - 2026-10-16. Branch `pilot/TKDETAILBE-backend`. Changes after v1 are listed in section 12 and announced
in the hand-off report. Source decisions: `private/planning/_mockups/ticket-detail-v3/DECISIONS.md` (owner, 15.10 and 15.10 evening)
and `RFQ_SPEC_DRAFT.md` sections 1, 2, 5, 9. Backend only: no UI is part of this change.

The RFQ backend (C1) builds on sections 3-6: its `quote` / `quote_line` entities ARE `ticket_quotes` rows (with `rfq_vendor_id` set);
an award approves a quote through the same decision code, and the ticket opened from an order receives the approved quote as its
cost baseline.

## 1. Migration (provisional number 0087)

`0087_ticket_detail.sql` - additive only (no table rebuild). Provisional: other branches hold 0085 / 0086; the lead renumbers at
integration. Nothing is read while `tickets.enabled` is off.

| Object | Change |
|---|---|
| `tickets.internal_owner_user_id` | TEXT, NULL - the internal person responsible ("אחראי בארגון") |
| `tickets.allowed_line_kinds` | TEXT, NULL - JSON array of line kinds for this request; NULL = the department / installation default |
| `ticket_departments.allowed_line_kinds` | TEXT, NULL - JSON array; NULL = the installation default |
| `ticket_assignments.quote_mode` | TEXT CHECK (`required`, `optional`, `off`), NULL = `optional` |
| `ticket_cost_claims.quote_id` | TEXT, NULL - the approved quote the payment demand was validated against (frozen at submission) |
| `ticket_cost_revisions.exceptional_json` | TEXT NOT NULL DEFAULT `'[]'` - the exceptional lines of this revision (see 5.3) |
| `ticket_owner_changes` | new - the owner history (section 2) |
| `ticket_quotes` | new - quotes (section 4) |
| `ticket_quote_decisions` | new - append-only decisions on quotes |

Installation setting (the `tickets.settings` document): `costs.allowed_line_kinds`, default `["labor", "parts"]`.
Changed default: `costs.notify_vendor_approved` is now **false** (owner 15.10 evening: an approval never sends a message silently;
the manager confirms a draft - section 7). An installation that saved `true` keeps it.

Full deletion and retention: `store.purge_ticket` removes the ticket's quotes, quote decisions and owner changes. A quote of a
purged ticket is not kept (unlike an approved claim, a quote is not a financial record).

## 2. Internal owner ("אחראי בארגון")

Fields on the ticket answer (`GET /tickets/{id}` -> `internal_owner`, and `GET /tickets/{id}/owner`):

```json
"internal_owner": {"id": "<user id>", "name": "Dana", "since": "2026-10-16T09:00:00Z", "source": "handoff|manual|rfq", "active": true}
```

`null` while nobody is set. `active` is false when the user was deactivated (the name stays readable).

**Default (owner decision 2):** when a request is handed to an outside contact (`POST /tickets/{id}/assign` with `kind: contact`),
and the request has no owner yet, the owner becomes the CURRENT internal assignee at that moment; when there is none, the manager who
hands it over. An existing owner is never replaced automatically (a reassignment to another vendor keeps it).

`ticket_owner_changes`: `id` (autoincrement), `ticket_id` (FK, cascade), `from_user_id`, `to_user_id` (NULL = cleared), `by_user_id`
(NULL = the system), `source` (`handoff`, `manual`, `rfq`), `reason` (<= 500, optional), `at`. Every change also writes a timeline
row `owner_changed` (internal only, `data: {from, to, source}` with names) and an audit row `ticket.owner.change` (ids only).

Routes:

| Route | Who | Body / answer |
|---|---|---|
| `GET /tickets/{id}/owner` | visible, full view | `{owner, history: [{at, from, to, by, source, reason}], candidates: [{id, name}]}` |
| `PUT /tickets/{id}/owner` | manager of the ticket | `{user_id: str|null, reason?: str, revision: int}` -> the same answer; 409 `ticket_stale`, 409 `owner_not_allowed` (not an eligible member of the department), 409 `owner_unchanged` |

Candidates = the eligible assignees of the department (active members who may view the ticket).

## 3. Allowed line kinds

Kinds: `labor`, `parts`, `travel`, `other` (money.LINE_KINDS; "other" always needs a description). Effective kinds of a request =
`tickets.allowed_line_kinds` -> `ticket_departments.allowed_line_kinds` -> `costs.allowed_line_kinds` (default `labor`, `parts`).
`labor` is always allowed (a list without it is refused, 422 `labor_required`).

| Route | Who | Body |
|---|---|---|
| `PUT /tickets/{id}/allowed-line-kinds` | `tickets.costs` + `tickets.costs.view` on the ticket | `{kinds: [..] | null}` (null = back to the default); answer = `GET /tickets/{id}/quotes` |
| `PUT /tickets/costs/departments/{dept_id}` | `tickets.configure` (existing) | adds optional `allowed_line_kinds: [..] | null`; omitted = unchanged |
| `PUT /tickets/settings` | existing | `costs.allowed_line_kinds` |

Effect: a quote may only carry allowed kinds (422 `line_kind_not_allowed`, field `lines.N.kind`). A payment demand is NOT refused for a
kind: a line outside its baseline is an exceptional line (5.3).

## 4. Quotes (before the work)

### 4.1 Entity `ticket_quotes`

| Column | Notes |
|---|---|
| `id` | |
| `ticket_id` | NULL for an RFQ quote before an order opens a ticket (C1) |
| `rfq_vendor_id` | NULL in this change; reserved for C1 (no FK) |
| `assignment_id` | the external assignment the quote belongs to (NULL for an RFQ quote) |
| `contact_id` | the vendor contact (NOT NULL) |
| `department_id` | copied from the ticket |
| `version` | 1, 2, ... per (`assignment_id` or `rfq_vendor_id`) |
| `supersedes_id` | the previous version |
| `source` | `vendor` (handler page) / `manager` (entered on the vendor's behalf) |
| `state` | `submitted`, `fix_requested`, `approved`, `partially_approved`, `rejected`, `superseded`, `withdrawn`, `not_awarded` |
| `currency`, `vat_mode` (`excluded`/`included`/`none`), `vat_rate_bp` | frozen at submission (money.py rules) |
| `lines_json` | the validated lines (money.Line.as_json, each with `kind`, `description`, `total_minor` and its inputs) |
| `labor_minor`, `parts_minor`, `travel_minor`, `other_minor`, `subtotal_minor`, `vat_minor`, `total_minor` | server-computed integers (minor units) |
| `work_from`, `work_to` | the proposed work window (UTC instants), optional; `work_to >= work_from` |
| `note` (<= 1000), `vendor_ref` (<= 40) | |
| `approved_lines_json` | JSON array of line indexes (0-based) approved; NULL until approved |
| `approved_subtotal_minor`, `approved_vat_minor`, `approved_total_minor` | the approved part, same VAT mode / rate |
| `decided_by`, `decided_at`, `decision_reason` | the last decision (fix / reject reason <= 500) |
| `created_by_kind` (`contact`/`user`), `created_by`, `created_at`, `updated_at`, `revision` (optimistic) | |

`ticket_quote_decisions` (append-only): `id`, `quote_id` (FK cascade), `action` (`approve`, `partial_approve`, `request_fix`, `reject`,
`superseded`, `withdrawn`, `not_awarded`), `reason`, `lines_json` (approved indexes), `amount_minor`, `by_user` (`contact:<id>` for the
vendor), `at`.

### 4.2 States and moves

```
submitted --approve(all lines)--> approved
submitted --approve(subset)-----> partially_approved
submitted --request_fix(reason)-> fix_requested
submitted|fix_requested --reject(reason)--> rejected
submitted|fix_requested --new version----> superseded (the new version is submitted)
rejected --new version--> (allowed: the new version is submitted; the rejected row stays rejected)
approved|partially_approved --> final (a new version is refused: 409 quote_already_approved)
withdrawn / not_awarded: reserved for C1 (RFQ); not reachable from the routes of this change
```

Rules: a quote needs an ACTIVE external assignment on a request in `assigned`, `acknowledged`, `in_progress` or `waiting_part`
(409 `quote_not_open`). Only allowed line kinds (section 3). At least one line (422 `required`, field `lines`). The approver may not
be the user who entered the quote on the vendor's behalf (409 `self_approval`). Decisions carry `revision` (409 `quote_stale`).

**Baseline (owner rule "the selected quote becomes the approved cost baseline automatically"):** the latest `approved` /
`partially_approved` quote of an assignment IS its cost baseline - no separate step. Partial approval: the baseline is the approved
lines only.

**Quote mode per assignment** (`ticket_assignments.quote_mode`): `required` (the cost flow starts at `quote_requested` and the
handler page shows the quote card as required), `optional` (default), `off` (the handler page offers no quote). It gates no status
move.

### 4.3 Cost flow (the stage indicator)

`flow.stage` for the current (else the latest) external assignment, one of:
`none` (no external assignment), `quote_optional`, `quote_requested`, `quote_submitted`, `quote_fix_requested`, `quote_rejected`,
`quote_approved`, `work`, `demand_awaiting`, `demand_submitted`, `demand_rejected`, `demand_approved`, `paid`.
`work` = a baseline exists and the request is `in_progress` / `waiting_part`; the demand stages follow the claim of the assignment.
`flow.sub_state` = `waiting_part` when the request status is `waiting_part` (2.5.6: a sub-state of "in progress", the stored status is
unchanged and the vendor may set it), else null.

### 4.4 Routes (internal, `/api/v1`)

| Route | Who | Body / answer |
|---|---|---|
| `GET /tickets/{id}/quotes` | visible | `{flow, allowed_line_kinds, quote_mode, quotes: [...], baseline}`; amounts / lines / note only with `tickets.costs.view` (full view), else `{id, version, state, source, created_at}` per quote |
| `POST /tickets/{id}/quotes` | `tickets.costs` + `tickets.costs.view` | on the vendor's behalf: `{assignment_id?, lines[], currency?, amounts_include_vat?, work_from?, work_to?, note?, vendor_ref?}` -> 201, the quotes answer |
| `POST /tickets/{id}/quotes/{quote_id}/approve` | `tickets.costs` + `tickets.costs.view` | `{revision, line_indexes?: [int]}` (omitted = all) -> `{quotes..., message_draft}` |
| `POST /tickets/{id}/quotes/{quote_id}/request-fix` | same | `{revision, reason}` -> `{..., message_draft}` |
| `POST /tickets/{id}/quotes/{quote_id}/reject` | same | `{revision, reason}` -> `{..., message_draft}` |
| `POST /tickets/{id}/quotes/requirement` | manager of the ticket | `{assignment_id, mode: required|optional|off}` |

`GET /tickets/{id}/costs` (existing) additionally carries `quotes`, `flow`, `allowed_line_kinds` and `baseline` with the same gating.

Quote answer (full):

```json
{"id": "...", "version": 2, "state": "partially_approved", "source": "vendor", "assignment_id": "...", "vendor": "Cool Ltd",
 "currency": "ILS", "vat_mode": "excluded", "vat_rate_bp": 1800,
 "lines": [{"index": 0, "kind": "labor", "description": "", "hours": "2", "rate_minor": 15000, "total_minor": 30000, "approved": true}],
 "labor_minor": 30000, "parts_minor": 0, "travel_minor": 0, "other_minor": 0, "subtotal_minor": 30000, "vat_minor": 5400, "total_minor": 35400,
 "approved": {"line_indexes": [0], "subtotal_minor": 30000, "vat_minor": 5400, "total_minor": 35400} ,
 "work_from": null, "work_to": null, "note": null, "vendor_ref": null, "created_at": "...", "created_by_name": "",
 "decision": {"by": "Dana", "at": "...", "reason": null}, "revision": 3, "can": {"decide": true}}
```

`baseline`: `{"quote_id", "version", "total_minor", "subtotal_minor", "currency", "line_kinds": ["labor", ...]}` or null.

### 4.5 Public routes (handler page; same wiring as `/t/api/claim`)

| Route | Body / answer |
|---|---|
| `GET /t/api/quote` | the link's own quotes (vendor view: state, its lines and totals, the fix / reject reason, the approved line indexes and total), `mode`, the form (`allowed_kinds`, currencies, VAT default / exempt, rate, limits), `writable` |
| `POST /t/api/quote` | `{lines[], currency?, amounts_include_vat?, work_from?, work_to?, note?, vendor_ref?, client_request_id}` -> 201 `{ok, quote}`; refusals `{code}`: 409 `quote_not_open`, 409 `quote_already_approved`, 422 `invalid` with `fields` |

The `GET /t/api/ticket` answer gains `quote: {mode, state, version, writable}` (or null) beside `claim`. Never internal notes, other
vendors' quotes, who decided, or the internal owner.

## 5. Payment demand (after the work) - the existing claim, extended

The demand IS the existing cost claim of migration 0083 (`ticket_cost_claims` + immutable `ticket_cost_revisions` + append-only
`ticket_cost_decisions`) and its routes (`/tickets/{id}/costs...`, `/t/api/claim`). Nothing is duplicated.

### 5.1 Validation against the baseline

At every submission (vendor, on behalf) and adjustment the server compares the lines with the baseline of the claim's assignment:

* with a baseline: a line whose kind is not among the baseline's approved line kinds is **exceptional** (`reason: not_in_quote`);
* without a baseline: a line whose kind is outside the request's allowed kinds is exceptional (`reason: kind_not_allowed`);
* an exceptional line needs a description (422 `exceptional_description_required`, field `lines.N.description`).

`claim.quote_id` is set at submission (the baseline in force then).

### 5.2 Answer additions (`present_claim`, full view)

```json
"baseline": {"quote_id": "...", "version": 2, "total_minor": 35400, "currency": "ILS"} | null,
"delta_minor": 1200 | null,
"kind_deltas": {"labor": 0, "parts": 1200, "travel": 0, "other": 0} | null,
"needs_review": true
```

Each revision gains `exceptional: [{"index": 2, "kind": "travel", "description": "...", "total_minor": 5000, "reason": "not_in_quote",
"review": "pending|accepted|excluded"}]`. `needs_review` = the current revision is submitted and has exceptional lines.
The vendor's `GET /t/api/claim` shows its own exceptional flags (`exceptional` per revision) and the approved total, never the reason
the manager typed beyond what it sees today.

### 5.3 Approving with or without the exceptional lines

`POST /tickets/{id}/costs/{claim_id}/approve` accepts `exceptional: "include" | "exclude"` (default `include`). `exclude` writes a
manager adjustment revision without the exceptional lines (`kind = adjustment`, reason = the body's `reason` or the default text in the
vendor's language) and approves it - the same self-approval rule. The decision answer gains `message_draft`; NOTHING is sent.

## 6. Timeline (one list for messages, notes, status, costs)

`GET /tickets/{id}/timeline?filter=all|messages|notes|status|costs&limit=50&before=<cursor>` - visible ticket; a limited viewer
(creator / internal assignee who is not a member) gets only the rows marked external plus their own (the existing `event_visible`
rule). Answer: `{"items": [...], "next_before": "<cursor>" | null, "counts": {"all", "messages", "notes", "status", "costs"}}`,
items in time order (oldest first) - the LAST `limit` items before the cursor.

Item:

```json
{"id": "ev:123", "type": "message|internal_note|status_event|quote|demand|owner_change|photo|system", "kind": "<ticket_events.kind>",
 "at": "...", "actor": {"kind": "user|contact|system|inbound", "name": "...", "me": false},
 "body": "...", "external": true,
 "message": {"direction": "in|out", "channel": "page|whatsapp|email", "purpose": "assign|update|...|null",
             "delivery": {"state": "queued|held|sent|unknown|failed", "at": "..."} | null, "from_note_id": "ev:120" | null,
             "unverified": false, "external_id": null},
 "status": {"from": "assigned", "to": "in_progress", "sub_state": "waiting_part" | null, "on_behalf": false},
 "cost": {"subject": "quote|claim", "id": "...", "version": 2, "action": "submitted|approve|..."},
 "owner": {"from": "Dana", "to": "Avi", "source": "manual"},
 "can": {"forward": true}}
```

Only the block that matches `type` is present. Classification of `ticket_events.kind`:

| type | kinds |
|---|---|
| `message` out | `note` written by a user and marked external (the handler page shows it); `link_sent`, `update_sent`, `reminder`, `code_sent`, `message_unknown`, `message_failed`, `message_fallback`, `cost_message` (channel WhatsApp / e-mail, the text is the template - `body` null); queued / held outbox rows (managers and `tickets.external` holders only, `id: "ob:<id>"`) |
| `message` in | `note` written by the contact on the handler page (`channel: page`); `inbound` / `late_reply` from WhatsApp (`unverified: true`) |
| `internal_note` | `note` written by a user and NOT external |
| `status_event` | `created`, `status`, `closed`, `cancelled`, `reopened`, `assigned`, `reassigned`, `returned`, `auto_closed` |
| `quote` | `quote_submitted`, `quote_decided` |
| `demand` | `cost_submitted`, `cost_decision` |
| `owner_change` | `owner_changed` |
| `photo` | `photo`, `photo_removed` |
| `system` | everything else (`eta`, `link_opened`, `stuck`, ...) |

Filters: `messages` = message; `notes` = internal_note; `status` = status_event + owner_change; `costs` = quote + demand. Cost rows
carry ids, versions and actions only - never an amount (members without `tickets.costs.view` read the timeline too).
No logging of messages sent outside the system (owner decision 4).

### 6.1 Writing to the vendor

| Route | Who | Body |
|---|---|---|
| `POST /tickets/{id}/vendor-message` | manager + `tickets.external` | `{text (<= 2000), notify: bool = true, source?: {kind: "quote"|"claim"|"note", id}}` |
| `POST /tickets/{id}/notes/{event_id}/forward` | manager + `tickets.external` | `{text?: str, notify: bool = true}` (text omitted = the note's own text) |

Both need an ACTIVE external assignment (409 `no_external_assignment`) and an open request (409 `ticket_closed`). The message is a
timeline row `note` marked external (the handler page shows it; `data.from_note_id` for a forward, `data.source` when it answers a
decision draft). With `notify` and a live link the vendor also gets the existing templated "update" notification (WhatsApp /
e-mail, purpose `update`, held by the send hours) - the free text never travels in WhatsApp / e-mail. The answer is
`{"item": <timeline item>, "notified": {"queued": bool, "channel": "whatsapp|email|manual|null"}}`. A forward is refused for a
note that is already external (409 `note_already_external`) or is not an internal note (404 `note_not_found`).

## 7. Decision drafts (no automatic message)

`POST /tickets/{id}/message-drafts` - `tickets.costs` + `tickets.costs.view` - body `{subject: "quote"|"claim", id, decision:
"approved"|"partially_approved"|"fix_requested"|"rejected"|"approved_without_exceptional"}` -> `{"text", "lang", "notify_default":
true, "send": {"route": "POST /tickets/{id}/vendor-message", "source": {"kind", "id"}}}`.

Every quote decision and every claim approval also returns `message_draft` (the same object). The text is in the vendor's language
(he / en / ar / ru; ar / ru are first drafts pending a native review), names the approved line kinds and the work window, never an
amount. The manager edits it and sends it with `POST /tickets/{id}/vendor-message`, or does nothing - nothing is ever sent by a
decision.

## 8. Ticket detail additions (`GET /tickets/{id}`)

`internal_owner` (section 2), `status_view: {"stage": "<status, waiting_part shown as in_progress>", "sub_state": "waiting_part"|null}`,
and `can.change_owner`, `can.vendor_message`.

## 9. Permission matrix

| Action | Permission (no new permission added) |
|---|---|
| read timeline / owner / quote states | visible ticket (limited viewers: external rows + own) |
| read amounts, lines, baseline, deltas | `tickets.costs.view` on the ticket's place + full view |
| change owner, quote mode | manager of the ticket (`tickets.manage` + department manager or all departments) |
| vendor message, forward a note | manager + `tickets.external` |
| enter a quote on behalf, decide a quote, approve / adjust / reject a demand, drafts, allowed kinds of a request | `tickets.costs` + `tickets.costs.view` |
| department default of allowed kinds | `tickets.configure` |
| vendor quote | handler link (+ code when the link requires one) |

The task named `tickets.costs.approve`: no such permission exists - `tickets.costs` IS the approval permission (its label: "אישור
עלויות"). Nothing was added.

## 10. Audit actions (ids, states, totals only - never a text)

`ticket.owner.change`, `ticket.allowed_kinds`, `ticket.quote.submit` (vendor, via the link audit), `ticket.quote.on_behalf`,
`ticket.quote.approve`, `ticket.quote.request_fix`, `ticket.quote.reject`, `ticket.quote.requirement`, `ticket.vendor_message`,
`ticket.note.forward`, `ticket.cost.approve` (existing, now with `exceptional`).

## 11. Not in this change (recorded)

* Quote documents (photo / PDF of a quote): the next step reuses `ticket_cost_files` with a `quote_id` column; the vendor page
  attaches invoices to the demand as today.
* Read receipts beyond "the link was opened"; a structured "next step" field; SLA badge; vendor-language picker (the contact's
  existing `lang` is used).
* The RFQ entities other than the quote (C1).

## 12. Change log of this contract

* v1 (2026-10-16): first version.
