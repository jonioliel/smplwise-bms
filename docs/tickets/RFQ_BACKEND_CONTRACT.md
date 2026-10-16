# Requests for quotation (RFQ) - backend contract, stage C1 (TKRFQ1)

Status: **v1.0 (implemented)** - 2026-10-16. Branch `pilot/TKRFQ1-core` (from `pilot/TKDETAILBE-backend`). Release
target 2.6.1. Sources: `private/planning/_mockups/ticket-detail-v3/RFQ_SPEC_DRAFT.md` (sections 1-6 and 9 "Owner decisions 2026-10-16
(final)"), `docs/tickets/DETAIL_BACKEND_CONTRACT.md` v1.2 (the quote entity, money, drafts), the approved mock-up v5
(`private/planning/_mockups/ticket-module-v4/rfq.js`: new request, vendors board, comparison, order). Backend only. Changes after this
version are listed in section 14.

**The owner's distinction.** An RFQ is a request for quotes sent to SEVERAL vendors with NO commitment to award. It is not a ticket and
not the quote a vendor sends on a ticket that is already assigned to him (DETAIL contract section 4). Only the selected (awarded) quote
becomes the approved cost baseline (automatically - no separate step) and, in stage C4, an order and a ticket; every other quote
becomes `not_awarded` silently (no message to vendors who were not selected).

## 1. Migration 0089 (provisional number - the lead renumbers at integration)

`0089_ticket_rfq.sql`. Nothing is read while `tickets.enabled` is off. One table rebuild: `ticket_outbox` (its `purpose` CHECK cannot
be widened in place; nothing references it by foreign key, so the rebuild cascades nothing). Every other change is additive.

| Object | Change |
|---|---|
| `ticket_rfqs` | new - the request (section 2) |
| `ticket_rfq_vendors` | new - one invited contact per row (section 3) |
| `ticket_rfq_links` | new - the vendor's personal link: the SAME token model as `ticket_links` (section 4) |
| `ticket_rfq_link_redeems` | new - the e-mail form of an RFQ link (same model as `ticket_link_redeems`) |
| `ticket_rfq_awards` | new - awards, with the optional second approval (section 7) |
| `ticket_rfq_messages` | new - the private thread with each vendor (clarifications, award notices the manager confirms) |
| `ticket_rfq_events` | new - the RFQ's own timeline (ids, states and versions only) |
| `ticket_departments.rfq_second_approval_minor` | INTEGER NULL - the per-department double-approval threshold; NULL = off (the default) |
| `ticket_sequence` | row `rfq` (the running RFQ number, from 1; shown as `RFQ-07`) |
| `ticket_outbox` | rebuilt: `purpose` also allows `rfq_invite`, `rfq_reminder`, `rfq_update`, `rfq_cancelled`, `rfq_order` (C4); new column `rfq_id` (no FK) + index. Every row, column and index is kept |

Quotes are NOT a new table: an RFQ quote IS a `ticket_quotes` row with `rfq_vendor_id` set and `ticket_id` / `assignment_id` NULL
(DETAIL v1.2, migration 0087 reserved exactly this). `version` counts per `rfq_vendor_id`. `ticket_quote_decisions` records every
decision (`approve` / `partial_approve` at the award, `superseded`, `withdrawn`, `not_awarded`).

## 2. The request - `ticket_rfqs`

| Column | Notes |
|---|---|
| `id`, `number` (UNIQUE) | `number` from the `rfq` sequence; the UI shows `RFQ-{number:02d}` |
| `department_id` | FK; visibility and the manager rule follow it like a ticket's |
| `title` (<= 120), `description` (<= 4000) | text hygiene as tickets |
| `site_id`, `building_id`, `floor_id`, `place_text` (<= 200) | the place; a placed RFQ is authorised on its place like a placed ticket |
| `source_ticket_id` | optional: the ticket this RFQ was opened from (FK, SET NULL on purge); the caller must see that ticket |
| `allowed_line_kinds` | JSON, NOT NULL - frozen at creation from the department / installation default unless given; `labor` always allowed |
| `due_at` | the quote deadline (UTC instant); in the future when sent |
| `work_from`, `work_to` | the wanted work window (optional; `work_to >= work_from`) |
| `internal_owner_user_id` | "האחראי בארגון": the creator unless changed; an eligible member of the department |
| `state` | section 5 |
| `created_by`, `created_at`, `updated_at`, `sent_at`, `due_passed_at`, `awarded_at`, `closed_at`, `cancelled_at`, `cancel_reason` (<= 500), `revision` | optimistic `revision` on every manager write |

## 3. Invited vendors - `ticket_rfq_vendors`

`id`, `rfq_id` (FK cascade), `contact_id` (FK `ticket_contacts`), `channel` (`whatsapp` / `email` / `manual`, the planned channel - the
contact's preferred channel resolved like an assignment's), `state` (section 5), `invited_at`, `sent_at`, `first_opened_at`,
`last_opened_at`, `open_count`, `quoted_at`, `declined_at`, `decline_reason` (<= 200), `removed_at`, `require_code` (frozen from the
contact / its vendor), `created_by`, `created_at`, `updated_at`, `revision`. UNIQUE (`rfq_id`, `contact_id`).

Who may be invited: an ACTIVE, not erased contact of kind `vendor`, or a `person` that works for a vendor or is a free-lance person -
never a contact that names an internal user (`user_id`) and never an employee contact (`employee = 1`, the "staff" kind: an employee
does not quote). Refusal: 409 `vendor_not_allowed`. A contact assigned to the RFQ's department (`ticket_contact_departments`) or to no
department is allowed; a contact limited to OTHER departments only is refused (409 `vendor_not_allowed`, reason `department`).

## 4. Vendor links - `ticket_rfq_links` (reuse of the handler-link mechanism)

The RFQ link reuses `links.py` / `handler_links.py` unchanged in spirit: a 32-hex link id, a generation, the module key id
(`key_id`), `token_hash = sha256(token)` (UNIQUE), `require_code`, `sent_via` / `sent_at`, `created_at`, `generation_at`,
`expires_at`, `cap_at`, `grace_until`, `revoked_at` / `revoked_reason`, `first_opened_at` / `last_opened_at` / `open_count`. The token
is DERIVED, never stored: `links.derive_token(key, link_id, generation, domain="rfq")` - the same HMAC with its own domain prefix
(`rfq|...` instead of `tkt|...`), so an RFQ token can never be a ticket token and the ticket listener's lookup (one indexed read of
`ticket_links.token_hash`) never finds it. The e-mail never carries the fragment: `ticket_rfq_link_redeems` (same model as
`ticket_link_redeems`).

Why a table of its own: `ticket_links.ticket_id` and `assignment_id` are NOT NULL foreign keys (0080) and an RFQ has no ticket; a
rebuild of `ticket_links` would cascade into its five child tables. One link per invited vendor (`rfq_vendor_id` UNIQUE).

Life of a link: minted at the first send (not before); `expires_at = max(due_at, now) + rfq.link_keep_days` (default 30), `cap_at =
now + 180 days`; a later `due_at` moves `expires_at` with it. Revoked at once: vendor removed (`removed`), manager revoke (`manual`),
a new generation (`resent`), key rotation (`module_key`), a phone / e-mail change of the contact (`contact_changed`), erase
(`contact_erased`). On close / cancel: read-only grace (`grace_until = now + rfq.grace_hours`, default 24). Key rotation and the
"does any row depend on a key" check include RFQ links. Link rows are deleted 30 days after the RFQ closed (spec section 6).

Staff-link lessons applied (S4 / TK251A / deep review): never a link for a contact that names a user or is an employee; a contact
change revokes; the token never appears in a log, audit row, timeline row, outbox row or answer (the manager's copy is C2, one-time,
`no-store`); one indexed lookup per request (C2's listener).

**The public vendor page is NOT part of C1** (stages C2-C4). Until it exists the module answers `vendor_page: false` and sending an
invitation by WhatsApp / e-mail is refused (409 `rfq_vendor_page_unavailable`) - a message would carry a link to a page that cannot
show the request. `channel: manual` always works: the manager contacted the vendor himself (no link, no message) and enters the quote
on the vendor's behalf. The model, the link mint, the outbox purposes and the starter templates are complete, so C2 only adds the
listener routes and flips `rfq.VENDOR_PAGE`.

## 5. States and moves

```
rfq:        draft --send--> sent --(first open or quote)--> collecting --(due passes)--> due_passed
            sent|collecting|due_passed --award (approved)--> awarded --close--> closed
            sent|collecting|due_passed --close (no award)--> closed
            draft|sent|collecting|due_passed --cancel--> cancelled          (refused once any award exists: 409 rfq_has_award)
            (C4: awarded --orders sent--> ordered --close--> closed)
vendor:     draft --send--> sent --> opened --> quoted | declined
            sent|opened --(due passes)--> expired
            quoted --award--> awarded ;  quoted --finalize / close--> not_awarded (internal only, NO message)
            quoted --quote withdrawn--> withdrawn  (a new quote before the deadline makes it quoted again)
            draft|sent|opened|quoted|declined|expired|withdrawn --remove--> removed   (refused once awarded)
quote:      submitted --new version--> superseded ;  submitted --withdraw--> withdrawn
            submitted --award--> approved | partially_approved ;  submitted --finalize / close / cancel--> not_awarded
```

`due_passed` / `expired` are applied by the janitor and by every write on the RFQ; reads compute the effective state (never stale).
Illegal moves answer 409 `rfq_invalid_transition` with `{from, action}`.

## 6. Permissions (no new permission names)

| Action | Rule |
|---|---|
| see an RFQ (list, detail, timeline, vendor states) | module on + `tickets.view` on the RFQ's place (any scope when placeless) + (`tickets.all_departments` OR member of its department OR the creator OR the internal owner). An invisible / unknown id is the uniform 404 `rfq_not_found` |
| see amounts, lines, comparison, lowest / earliest, award amounts | + `tickets.costs.view` on the place (the comparison route answers an audited 403 without it; other answers omit the amounts) |
| create a draft | `tickets.create` in a department the caller may open in (member or `open_to_all`) + `tickets.external` |
| edit, add / remove vendors, send, remind, revoke a link, cancel, close, write to a vendor | an **RFQ manager** = (the creator OR the internal owner OR a manager of the department / `tickets.all_departments` with `tickets.manage`) + `tickets.external` on the place |
| enter / withdraw a quote on the vendor's behalf, record a decline | RFQ manager + `tickets.costs` + `tickets.costs.view` |
| award, confirm / decline a second approval | `tickets.costs` + `tickets.costs.view` on the place + full visibility; never the user who entered that quote on the vendor's behalf (409 `self_approval`) |
| department threshold | `tickets.configure` |
| delete an RFQ fully | `tickets.delete` (installation) |

The spec's proposed `tickets.rfq.*` names map onto these existing permissions (create -> `tickets.create` + `tickets.external`; send /
clarify / cancel / order -> RFQ manager + `tickets.external`; award -> `tickets.costs`; over-limit -> the department threshold below).
Refusals of role or membership are audited (`decision: denied`), like the tickets routes.

## 7. Award - single approval by default, optional second approval

`POST /tickets/rfqs/{id}/awards` `{quote_id, revision (of the quote), line_indexes?: [int] | kinds?: [labor|parts|travel|other],
finalize: bool = true}`: approve the whole quote (neither given), a subset of its lines (`line_indexes`), or the lines of some kinds
(`kinds` - the mock-up's "עבודה בלבד" / "חלקים בלבד"). Amounts are recomputed by `money.compute` on the approved lines with the
quote's frozen VAT mode and rate. Several awards on one RFQ = a split (one per vendor, `finalize: false` until the last).

**Owner rule (16.10, final): single approval must work.** The second approval applies only when ALL hold:
1. the RFQ's department has `rfq_second_approval_minor` set (NULL = off - the default), and
2. the approved total (minor units, VAT included) is ABOVE it, and
3. a second approver exists: an active user, not the first approver and not the requester (the RFQ's creator), who holds
   `tickets.costs` + `tickets.costs.view` where the RFQ lies, sees the RFQ fully, and is ABOVE the requester in the department's
   chain (member < department manager < `tickets.all_departments` holder).
Otherwise the first approval is final at once. The system never waits for an approver who does not exist and never asks the requester
to approve twice. With a second approval pending the award is `pending_second` (the quote stays `submitted`, the vendor sees nothing);
`POST .../awards/{award_id}/confirm` (another eligible approver: 409 `second_approver_required` for the first approver or the
requester) makes it final, `.../decline {reason}` drops it (the RFQ goes on).

Final award (one transaction): the quote -> `approved` / `partially_approved` (through `quotes.decide`, the same decision code as a
ticket quote: approved lines, approved subtotal / VAT / total, an append-only decision row); the vendor -> `awarded`; the RFQ ->
`awarded`; with `finalize` every other live quote -> `not_awarded` (decision row `not_awarded`) and their vendors -> `not_awarded`.
**This approved quote IS the cost baseline** (owner: automatic). In C4 the order opens a ticket and the quote row gets that
`ticket_id` / `assignment_id`, so the DETAIL contract's `baseline` of the assignment is this quote with no copy.

**Nothing is sent.** The award answer carries `message_draft` (`{text, lang, notify_default, send: {route, source}}`, the vendor's
language, no amount) that the manager may edit and send with `POST .../vendors/{rv_id}/messages`, or ignore. Vendors who were not
selected get no message at all (owner decision).

## 8. Messages to vendors (no free text outbound)

Templates (`message_templates.STARTERS`, editable per department and language like every message template; he / en / ar / ru, ar / ru
pending a native review): `rfq_invite` (title, deadline, work window, `{link}`; "not interested" is offered on the page),
`rfq_reminder`, `rfq_update` ("there is a new message about your quote for ..." + `{link}`), `rfq_cancelled` (to vendors who already
quoted - owner decision 2), `rfq_order` (C4). New placeholders: `{due}`, `{window}` (allowed in every template). No message carries an
amount, a phone number or free text.

Which act sends what: **send** queues `rfq_invite` per vendor (WhatsApp / e-mail by the contact's channel; `manual` = nothing);
**remind** queues `rfq_reminder` (manual, per vendor or "everyone who did not answer"); **cancel** queues `rfq_cancelled` to vendors
with a live quote (`notify: false` skips it); a **vendor message** is stored in the private thread (`ticket_rfq_messages`, shown on the
vendor page in C2) and, with `notify`, queues `rfq_update`. **Award, second approval, decline-on-behalf, close, not_awarded: never a
message.** Outbox rows carry `rfq_id` and the link id; the outcome hooks write `message_sent` / `message_failed` RFQ events and the
`ticket.message.send` audit row like ticket rows.

## 9. Routes (internal, `/api/v1`, all behind the module gate, registered before `/tickets/{ticket_id}`)

| Route | Who | Body / answer |
|---|---|---|
| `GET /tickets/rfqs/meta` | `tickets.view` | `{vendor_page, settings: {default_due_days, ...}, departments: [{id, name, can_create, second_approval_minor}], line_kinds}` |
| `GET /tickets/rfqs` | visible | `?state=open|draft|sent|collecting|due_passed|awarded|closed|cancelled|all&department_id&q&limit<=200&cursor` -> `{items: [rfq summary], next_cursor}` |
| `POST /tickets/rfqs` | create | `{department_id, title, description?, place_text?, site_id?, building_id?, floor_id?, source_ticket_id?, due_at, work_from?, work_to?, allowed_line_kinds?, internal_owner_user_id?, vendors?: [{contact_id}], client_request_id}` -> 201 detail (replayed for the same `client_request_id`) |
| `GET /tickets/rfqs/{id}` | visible | the detail (section 10) |
| `PATCH /tickets/rfqs/{id}` | RFQ manager | `{revision, title?, description?, place_text?, due_at?, work_from?, work_to?, allowed_line_kinds?, internal_owner_user_id?}`; after the send only `due_at` (later only), the work window and the owner change (409 `rfq_field_locked`) |
| `POST /tickets/rfqs/{id}/vendors` | RFQ manager | `{contact_id, revision}` - draft vendor (sent with the next `send`) |
| `POST /tickets/rfqs/{id}/vendors/{rv_id}/remove` | RFQ manager | `{revision}`; revokes the link, withdraws a live quote |
| `POST /tickets/rfqs/{id}/send` | RFQ manager | `{revision, client_request_id}` - every `draft` vendor; first send moves the RFQ to `sent` |
| `POST /tickets/rfqs/{id}/remind` | RFQ manager | `{vendor_ids?: [..]}` (omitted = everyone `sent` / `opened`) |
| `POST /tickets/rfqs/{id}/vendors/{rv_id}/link/revoke` | RFQ manager | revoke the vendor's link (`manual`) |
| `POST /tickets/rfqs/{id}/vendors/{rv_id}/quotes` | on behalf | the DETAIL quote body (`lines[]`, `currency?`, `amounts_include_vat?`, `work_from?`, `work_to?`, `note?`, `vendor_ref?`) -> 201 detail |
| `POST /tickets/rfqs/{id}/vendors/{rv_id}/quotes/{quote_id}/withdraw` | on behalf | `{revision}` |
| `POST /tickets/rfqs/{id}/vendors/{rv_id}/decline` | on behalf | `{reason?}` |
| `GET /tickets/rfqs/{id}/comparison` | + costs.view | section 11 |
| `POST /tickets/rfqs/{id}/awards` | award | section 7 -> `{rfq: detail, award, message_draft}` |
| `POST /tickets/rfqs/{id}/awards/{award_id}/confirm` | award (second approver) | `{revision}` -> same shape |
| `POST /tickets/rfqs/{id}/awards/{award_id}/decline` | award (second approver) | `{revision, reason}` |
| `POST /tickets/rfqs/{id}/cancel` | RFQ manager | `{revision, reason?, notify: bool = true}` |
| `POST /tickets/rfqs/{id}/close` | RFQ manager | `{revision}` |
| `GET /tickets/rfqs/{id}/vendors/{rv_id}/messages` | visible | `{items: [{id, direction, text, at, by, notified}]}` |
| `POST /tickets/rfqs/{id}/vendors/{rv_id}/messages` | RFQ manager | `{text (<= 2000), notify: bool = true, source?: {kind: "award", id}}` -> 201 `{item, notified}` |
| `DELETE /tickets/rfqs/{id}` | `tickets.delete` | full deletion (section 12) |
| `PUT /tickets/rfqs/departments/{dept_id}` | `tickets.configure` | `{second_approval_minor: int | null}` |

Errors: the module's envelope (`{code, message (Hebrew), details}`): 404 `rfq_not_found`, `vendor_not_found`, `quote_not_found`,
`award_not_found`; 409 `rfq_stale` (`details.revision`), `rfq_invalid_transition`, `rfq_field_locked`, `rfq_no_vendors`,
`rfq_due_passed`, `vendor_not_allowed`, `vendor_duplicate`, `rfq_vendor_page_unavailable`, `rfq_has_award`, `quote_not_open`,
`quote_stale`, `self_approval`, `second_approver_required`, `award_pending`; 422 `validation` with `fields`.

## 10. The detail answer

```json
{"id": "...", "number": 7, "ref": "RFQ-07", "state": "collecting", "title": "...", "description": "...",
 "department": {"id": "...", "name": "..."}, "place": {"site_id": null, "building_id": null, "floor_id": null, "text": "..."},
 "source_ticket": {"id": "...", "number": 1042} | null, "due_at": "...", "work_from": "...", "work_to": "...",
 "allowed_line_kinds": ["labor", "parts"], "internal_owner": {"id": "...", "name": "...", "active": true},
 "created_by": {"id": "...", "name": "..."}, "created_at": "...", "sent_at": "...", "closed_at": null, "revision": 4,
 "kpis": {"invited": 6, "sent": 6, "opened": 5, "quoted": 3, "declined": 1, "no_response": 2, "lowest_total_minor": 750000, "currency": "ILS"},
 "vendors": [{"id": "rv", "contact": {"id": "...", "name": "...", "company": "..."}, "channel": "whatsapp", "state": "quoted",
              "sent_at": "...", "first_opened_at": "...", "open_count": 2, "quoted_at": "...", "decline_reason": null,
              "link": {"state": "live|grace|expired|revoked|none", "expires_at": "...", "sent_via": "whatsapp"},
              "quote": {"id": "...", "version": 2, "state": "submitted", "total_minor": 760000, "currency": "ILS", "work_from": "..."},
              "messages": 2, "can": {"remove": true, "remind": true, "quote_on_behalf": true}}],
 "awards": [{"id": "...", "vendor_id": "rv", "quote_id": "...", "state": "approved", "line_indexes": [0, 1], "total_minor": 750000,
             "first_by": "Dana", "second_required": false, "second_by": null}],
 "second_approval": {"threshold_minor": null, "applies": false},
 "timeline": [{"id": 12, "kind": "quote_submitted", "at": "...", "actor": "...", "vendor_id": "rv", "data": {"quote_id": "...", "version": 2}}],
 "vendor_page": false,
 "can": {"edit": true, "send": true, "remind": true, "cancel": true, "close": false, "award": true, "see_amounts": true, "delete": false}}
```

Without `tickets.costs.view`: `kpis.lowest_total_minor`, every `quote.total_minor`, award amounts are `null` and `quote` carries `{id,
version, state}` only. Timeline rows carry ids, versions and states only; the amount of a quote row is resolved at read time for
costs.view holders (`data.total_minor`).

## 11. The comparison (`GET /tickets/rfqs/{id}/comparison`)

`{"currency": "ILS", "quotes": [{"vendor_id", "vendor": {...}, "quote_id", "version", "submitted_at", "late": false, "vat_mode",
"vat_rate_bp", "lines": [...], "by_kind": {"labor": 120000, "parts": 640000, "travel": 0, "other": 0}, "subtotal_minor", "vat_minor",
"total_minor", "net_minor", "work_from", "work_to", "in_window": true, "note", "messages": 1, "lowest": false, "earliest": true,
"award": {"id", "state", "line_indexes"} | null, "revision": 3}], "lowest_quote_id": "...", "earliest_quote_id": "...",
"filters": {"all": 3, "in_window": 2}}`. Only the latest live version per vendor (`submitted`, or the awarded one). Lowest = the
smallest `total_minor` (VAT included) among quotes in the RFQ's majority currency; earliest = the earliest `work_from`. Integer
arithmetic only (money.py); a quote in another currency is shown and never ranked.

## 12. Retention and deletion

* Links: deleted 30 days (`rfq.link_keep_days`) after the RFQ closed / was cancelled (with their redeem rows).
* Quotes that were not selected and the whole RFQ: kept `rfq.retention_months` (default 24) after closing, then purged by the janitor;
  an awarded quote that an order linked to a ticket stays with the ticket (it is the baseline).
* `DELETE /tickets/rfqs/{id}` (`tickets.delete`): `store_rfq.purge_rfq` removes the RFQ, vendors, links, redeems, awards, messages,
  events, its outbox rows and its quotes WITHOUT a ticket (and their decisions), explicitly (not relying on cascades), in one
  transaction; audit `ticket.rfq.delete` (ids and counts).
* A ticket purge (`store.purge_ticket`) leaves an RFQ in place (`source_ticket_id` becomes NULL).
* Erasing a contact revokes its RFQ links; the vendor rows keep the contact id (the directory shows the tombstone).

## 13. Settings (`tickets.settings`, section `rfq`)

`default_due_days` (1-60, default 3), `grace_hours` (0-168, 24), `link_keep_days` (1-365, 30), `retention_months` (6-120, 24),
`reminder_hours` (0-168, 24 - C2's automatic reminder; 0 = off). Department: `rfq_second_approval_minor` (section 7). The allowed line
kinds default is DETAIL's (`costs.allowed_line_kinds` <- department <- the RFQ).

Audit actions (ids, states, totals, counts - never a text): `ticket.rfq.create`, `.edit`, `.vendor_add`, `.vendor_remove`, `.send`,
`.remind`, `.link_revoke`, `.quote_on_behalf`, `.quote_withdraw`, `.decline_on_behalf`, `.award`, `.award_confirm`, `.award_decline`,
`.cancel`, `.close`, `.message`, `.delete`, `.department`.

## 14. Change log

* v0.9 (2026-10-16): first version, before the implementation (the UI may start on sections 9-11).
* v1.0 (2026-10-16, after the implementation):
  - Status moved to v1.0. Place: only `floor_id` is accepted (building / site derived); `site_id` / `building_id` in the body are not.
  - Section 7: the second approver also may not be the user who entered that quote on the vendor's behalf (the decision code's
    self-approval rule would refuse him anyway); `second_approval` in the detail is `{threshold_minor (costs.view only), enabled}`.
  - Section 8: the RFQ purposes are NOT yet listed by the message-template editor (`routers/tickets_messages.TEMPLATE_PURPOSES`) -
    the starters are used until the C2 UI adds labels; the cancellation notice goes only to vendors whose invitation went through
    WhatsApp / e-mail (a vendor reached by hand gets no first system message). Reminders: one per vendor per hour (idempotency key).
  - `send` takes `channel: "auto" | "manual"` (default auto); `auto` with the vendor page off answers 409
    `rfq_vendor_page_unavailable` before any write.
  - Detail extras: `vendors[].delivery` (newest outbox state of the vendor's link, managers only), `vendors[].revision`.
  - Retention runs inside the cost janitor (`costs_retention.janitor`, every 10 min): deadlines, link rows, purge.
  - Inbound WhatsApp replies are not matched to RFQs (residual: a vendor's text reply to an RFQ message is handled by the ticket
    matcher as today - usually `unknown_sender`).
