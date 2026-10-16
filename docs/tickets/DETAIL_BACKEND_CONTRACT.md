# Service-request detail - backend contract (TKDETAILBE)

Status: **v1.5 (stable)** - 2026-10-16 (v1.5 = TKQVALID, section 12). Branch `pilot/TKDETAILBE-backend`. Changes after v1 are listed in section 12 and announced
in the hand-off report. Source decisions: `private/planning/_mockups/ticket-detail-v3/DECISIONS.md` (owner, 15.10 and 15.10 evening)
and `RFQ_SPEC_DRAFT.md` sections 1, 2, 5, 9. Backend only: no UI is part of this change.

The RFQ backend (C1) builds on sections 3-6: its `quote` / `quote_line` entities ARE `ticket_quotes` rows (with `rfq_vendor_id` set);
an award approves a quote through the same decision code, and the ticket opened from an order receives the approved quote as its
cost baseline.

## 1. Migration 0088 (on top of 0085 TK257 quotes, 0086 outbox link generation, 0087 TKSTAFF1 staff links)

`0088_ticket_detail.sql` - no table rebuild. Nothing is read while `tickets.enabled` is off. It REPLACES the 2.5.7 quote of 0085
(TK257): every `ticket_cost_quotes` row is copied into `ticket_quotes` (`seq` -> `version`, `rejected` = "needs a correction" ->
`fix_requested`, an approval approves every line, `notes` -> `note`, `reason` -> `decision_reason`, the previous seq becomes
`supersedes_id`), each 2.5.7 decision becomes a `ticket_quote_decisions` row (id `m0088-<quote id>`), and `ticket_cost_quotes` is
DROPPED. The 2.5.7 comma lists `cost_line_kinds` become `allowed_line_kinds` JSON (labour and parts added, as 2.5.7 always did):
the department's onto the department, an assignment's onto its ticket (the latest assignment that set one). The two
`cost_line_kinds` columns stay in place, unused.

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
`costs.notify_vendor_approved` is **removed** (v1.4; owner 15.10 evening: an approval never sends a message - the manager confirms
a draft, section 7). A stored 2.5.x value stays in the document as an unknown key: never served, never read; PUT refuses the key.
v1.4 also: `ticket_quote_decisions.internal_note`, `ticket_quotes.decision_internal_note` and `ticket_cost_decisions.internal_note`
(the manager's internal note of a decision, see 4.4); `idx_ticket_quotes_assignment` is UNIQUE (`assignment_id`, `version`); the
copy writes a `request_fix` row for a 2.5.7 correction request the vendor later replaced and a `superseded` row per replaced version.

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
| `GET /tickets/{id}/owner` | visible, full view | `{owner, history: [{at, from, to, by, source, reason}], candidates: [{id, name}]}`; a limited viewer gets `owner: null`, `history: []` (v1.4; `internal_owner` of `GET /tickets/{id}` likewise) |
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
| `valid_until` | v1.5 (TKQVALID): the quote's validity, a UTC instant, optional. Column added by 0089 (RFQ) - exists on every row, no new migration. Rule: an ISO instant, or a plain date (= 23:59:59 UTC of that day); not in the past by more than a day, at most 366 days ahead (same family as the work window; NOT strictly future, so a just-lapsed quote can be entered). 422 `format` / `range` / `type`, field `valid_until` |
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
| `POST /tickets/{id}/quotes` | `tickets.costs` + `tickets.costs.view` | on the vendor's behalf: `{assignment_id?, lines[], currency?, amounts_include_vat?, work_from?, work_to?, valid_until?, note?, vendor_ref?}` -> 201, the quotes answer (v1.5: `valid_until`) |
| `POST /tickets/{id}/quotes/{quote_id}/approve` | `tickets.costs` + `tickets.costs.view` | `{revision, line_indexes?: [int], internal_note?, confirm_expired?: bool}` (omitted = all) -> `{quotes..., message_draft}`; 409 `demand_pending` while a payment demand of the assignment is submitted / approved / paid (v1.4); v1.5: 409 `quote_expired` (details `valid_until`) when the quote is past its `valid_until` and `confirm_expired` is not `true` - the client asks the approver and resends; request-fix / reject never need it |
| `POST /tickets/{id}/quotes/{quote_id}/request-fix` | same | `{revision, reason, internal_note?}` -> `{..., message_draft}` |
| `POST /tickets/{id}/quotes/{quote_id}/reject` | same | `{revision, reason, internal_note?}` -> `{..., message_draft}` |
| `POST /tickets/{id}/quotes/requirement` | manager of the ticket | `{assignment_id, mode: required|optional|off}` |

`GET /tickets/{id}/costs` (existing) additionally carries `quotes`, `flow`, `allowed_line_kinds` and `baseline` with the same gating.

v1.4: `reason` is SHOWN TO THE VENDOR (its page and the draft); `internal_note` (<= 500, optional) is stored apart and is never in a
public answer, a draft, a timeline row or an audit row - the manager reads it in `decision.internal_note`. The claim decisions
(`/tickets/{id}/costs/{claim_id}/approve|adjust|reject`) take the same optional `internal_note` (in `decisions[].internal_note`);
other claim actions refuse it (422 `only_with_decision`). A staff contact's assignment (not `quote_capable`) has no quote: `flow`
stage `none` with `quote_mode: null`, `quote_mode` / `baseline` null, `external_assignments[].quote_mode` null, and
`requirement` / a decision answer 409 `not_external`.

Quote answer (full):

```json
{"id": "...", "version": 2, "state": "partially_approved", "source": "vendor", "assignment_id": "...", "vendor": "Cool Ltd",
 "currency": "ILS", "vat_mode": "excluded", "vat_rate_bp": 1800,
 "lines": [{"index": 0, "kind": "labor", "description": "", "hours": "2", "rate_minor": 15000, "total_minor": 30000, "approved": true}],
 "labor_minor": 30000, "parts_minor": 0, "travel_minor": 0, "other_minor": 0, "subtotal_minor": 30000, "vat_minor": 5400, "total_minor": 35400,
 "approved": {"line_indexes": [0], "subtotal_minor": 30000, "vat_minor": 5400, "total_minor": 35400} ,
 "work_from": null, "work_to": null, "valid_until": null, "note": null, "vendor_ref": null, "created_at": "...", "created_by_name": "",
 "decision": {"by": "Dana", "at": "...", "reason": null, "internal_note": null}, "revision": 3, "can": {"decide": true}}
```

`baseline`: `{"quote_id", "version", "total_minor", "subtotal_minor", "currency", "line_kinds": ["labor", ...]}` or null.

### 4.5 Public routes (handler page; same wiring as `/t/api/claim`)

| Route | Body / answer |
|---|---|
| `GET /t/api/quote` | the 2.5.7 (TK257) answer, unchanged for the built vendor card: `state` (`none`/`submitted`/`approved`/`rejected`), `enabled`, `writable`, `allowed_kinds`, `currency`, `quote` (the one that counts: the approved one, else the newest live one) and `form` (`currencies`, `vat`, `labor_rate_minor`, `limits.{lines, description, notes, max_total_minor}`). Added: `state_detail` (this design's exact state), `mode`, `quotes` (every version), `form.allowed_kinds`, `form.limits.{note, vendor_ref}` |
| `POST /t/api/quote` | `{lines[], currency?, amounts_include_vat?, work_from?, work_to?, valid_until?, note? or notes?, vendor_ref?, client_request_id}` -> 201 `{ok, quote}`; refusals as in 2.5.7: 409 `quote_closed` (the precise reason in `reason`: `quote_not_open`, `quote_off`, `quote_already_approved`), 422 `invalid` with `fields` (`kind_not_allowed` for a line kind the request does not allow) |

A vendor-side quote (`quote` / `quotes[]`) has the 2.5.7 fields `id`, `seq`, `state` (2.5.7 vocabulary), `lines`, `labor_minor` ...
`total_minor`, `net_minor`, `vat_mode`, `vat_rate_bp`, `currency`, `notes`, `created_at`, `reason` (when `state` is `rejected`), and
adds `version`, `state_detail`, `work_from`, `work_to`, `valid_until` (v1.5: ONLY the link's own quotes, never another vendor's), `approved` (`{line_indexes, partial, subtotal_minor, vat_minor, total_minor}`)
and per line `index` / `approved`, and (v1.4) `on_behalf` (true for a version the organisation entered; never who). Mapping: `fix_requested` and `rejected` -> `rejected` (both let the vendor send a new version);
`approved` and `partially_approved` -> `approved`. The card is hidden (`enabled: false`) when the assignment's cost mode is `off` or
its quote mode is `off`. Nothing the built card reads changed; it can show a partial approval from `quote.approved.partial`.

The `GET /t/api/ticket` answer gains `quote: {mode, enabled, state, state_detail, version, writable}` (or null) beside `claim`.
Never internal notes, other vendors' quotes, who decided, or the internal owner.
v1.4: `POST /t/api/quote` (and `/t/api/claim`) read the link again inside the write transaction (rule W2: a link revoked / regenerated
since the lookup is the uniform 404) and a stored quote / revision counts as the handler's progress (update count, access row; the
sliding expiry outside the read-only grace).

The 2.5.7 manager route `POST /tickets/{id}/costs/quotes/{quote_id}/{approve|reject}` stays as a compatibility alias (approve = all
lines, reject = request a fix with a reason; it answers the costs answer plus `message_draft`); new clients use 4.4. The `quotes`
list of `GET /tickets/{id}/costs` is now this design's (section 4.4: `decision.by` instead of 2.5.7's `decided_by`).

## 5. Payment demand (after the work) - the existing claim, extended

The demand IS the existing cost claim of migration 0083 (`ticket_cost_claims` + immutable `ticket_cost_revisions` + append-only
`ticket_cost_decisions`) and its routes (`/tickets/{id}/costs...`, `/t/api/claim`). Nothing is duplicated.

### 5.1 Validation against the baseline

At every submission (vendor, on behalf) and adjustment the server compares the lines with the baseline of the claim's assignment:

* with a baseline: a line whose kind is not among the baseline's approved line kinds is **exceptional** (`reason: not_in_quote`);
* without a baseline: a line whose kind is outside the request's allowed kinds is exceptional (`reason: kind_not_allowed`);
* against a baseline an exceptional line needs a description (422 `exceptional_description_required`, field
  `lines.N.description`); without a baseline the line is flagged only (a 2.5 demand with a travel line and no description stays
  valid - backward compatibility).

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
v1.4: `source.id` has the id pattern and must name a quote / claim / note of THIS ticket (404 `quote_not_found` / `claim_not_found`
/ `note_not_found`). The "update" notification is sent once per assignment (and link generation) per 10 minutes - the outbox
idempotency key names the window; every message is on the page.

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

## 10. Audit actions (ids and states - never a text; amounts only on claim rows)

v1.4 (public-surface review F2, reconciled with `quotes.py`): QUOTE audit rows carry ids, the version, the state / currency - never
an amount (a quote is not a financial record; an audit reader without `tickets.costs.view` must not learn quote totals). CLAIM audit
rows keep their totals (11A.12: a payment record; TK258's bulk "mark paid" relies on it).


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

* v1.5 (2026-10-16, TKQVALID): `valid_until` end to end for ticket quotes. `POST /tickets/{id}/quotes` and `POST /t/api/quote` accept it
  (4.1 rule; no migration - the column is 0089's); the manager's quote answer (full view, `tickets.costs.view`) and the vendor's own
  `GET /t/api/quote` carry it; a limited viewer never gets it; `POST .../approve` takes `confirm_expired` and answers 409 `quote_expired`
  without it for a quote past its validity (request-fix / reject are not gated). Staff assignments still take no quote, so no validity.
  The public vendor card displays it; its form does not yet send it (gap, listed in the hand-off).
* v1.4 (2026-10-16, TKFIX260 - the release 2.6.0 reviews): `costs.notify_vendor_approved` removed (approvals never send); decision
  `internal_note` apart from the vendor-facing `reason`; quote audit rows without amounts; W2 re-read + progress on the public quote /
  claim writes; `on_behalf` on the vendor's quotes; staff assignments have no quote stage / mode / decision; 409 `demand_pending`;
  `kind_deltas` null on a different VAT basis; the owner for the full view only (the contract's own rule - the earlier test pinned the
  opposite); `source` validated; one "update" notification per 10 minutes; 0088 unique version + complete decision log.

* v1 (2026-10-16): first version.
* v1.1 (2026-10-16, same day, after the implementation): 5.1 - the description of an exceptional line is required only against a
  baseline; 4.4 - each quote answer also carries `can.reject`; 4.5 - `GET /t/api/quote` per quote carries `reason` (fix / reject) and
  never `decision`; 6 - status items carry `stored_to` (the stored status, `waiting_part` included) beside the displayed `to`.
  Unchanged on purpose: a demand REJECTION still queues the existing templated `cost_rejected` notification (it is not an approval;
  the owner's rule names approvals) - the reject answer also returns a `message_draft` for a free-text explanation.
* v1.2 (2026-10-16, lead decision on the TK257 collision): merged on top of `integ/257` (0085 TK257 quotes, 0086). 0087 now migrates
  and drops `ticket_cost_quotes` and converts `cost_line_kinds` (section 1); the public `/t/api/quote` keeps the 2.5.7 shape and codes
  (4.5 - this replaces the v1 codes `quote_not_open` / `quote_already_approved` / `line_kind_not_allowed` on the PUBLIC routes; the
  internal routes keep them); a quote is also refused when the assignment's cost mode is `off` (2.5.7 rule); the 2.5.7 manager route
  stays as an alias.
* v1.3 (2026-10-16, merged on top of `integ/258`): the migration is renumbered **0088** (0087 = TKSTAFF1 staff links); it still moves
  the 0085 rows and drops `ticket_cost_quotes`. TKSTAFF1 guards kept: only an assignment of kind `contact` whose contact is not a
  staff employee is quote-capable (`quotes.quote_capable`, used by the card, its summary, `_enabled` and `submit`); a staff link gets
  the uniform 404 on `GET` / `POST /t/api/quote` (`link_context(claim_surface=True)`). TK255's public prefix routing, TK251R's
  claim-mode redeem / per-generation "link opened" and TKSTAFF2's assignees module come unchanged from `integ/258`.
