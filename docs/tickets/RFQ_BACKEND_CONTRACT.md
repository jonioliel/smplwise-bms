# Requests for quotation (RFQ) - backend contract, stage C1 (TKRFQ1)

Status: **v1.4.1 (the review fixes of RFQPAY (section 20) and RFQATT (section 19), no new migration) / v1.4 (combined at the integ/264 integration, 2026-10-17: section 19 = files and pictures on a request (RFQATT, migration 0102);
section 20 = the payment schedule and the arrival confirmation, behind a switch that is OFF by default (RFQPAY, migration 0103); section
21 = vendor questions (RFQQUESTIONS, migration 0104); the organisation location of a request (CR-ORG-LOCATIONS, migration 0101, change
log only); section 16 = the managers' notifications and inbound WhatsApp replies; section 17 = the earlier attachments design, superseded
by 19; section 18 = the work order, stage C4)** - 2026-10-16 / 2026-10-17. v1.0 implemented on `pilot/TKRFQ1-core`; v1.1 on `pilot/TKRFQVP` (from `integ/260`); v1.2 on `pilot/TKRFQ5` (from `integ/263`); section 18 on `pilot/TKRFQ4` (from `integ/263`), combined as v1.3 at the integ/264 integration; sections 19-21 on `pilot/RFQATT`, `pilot/RFQPAY`, `pilot/RFQQUESTIONS` (each from `integ/264`), combined as v1.4. Release target 2.6.0. Sources: `private/planning/_mockups/ticket-detail-v3/RFQ_SPEC_DRAFT.md` (sections 1-6 and 9 "Owner decisions 2026-10-16
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
(DETAIL v1.2, migration 0088 reserved exactly this). `version` counts per `rfq_vendor_id`. `ticket_quote_decisions` records every
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
            awarded --every approved award has its order (section 18)--> ordered --close--> closed
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

Audit actions (ids, states, totals, counts - never a text; the PUBLIC vendor rows of 15.4 carry ids / versions / states / counts only, never an amount): `ticket.rfq.create`, `.edit`, `.vendor_add`, `.vendor_remove`, `.send`,
`.remind`, `.link_revoke`, `.quote_on_behalf`, `.quote_withdraw`, `.decline_on_behalf`, `.award`, `.award_confirm`, `.award_decline`,
`.cancel`, `.close`, `.message`, `.delete`, `.department`.

## 15. Public vendor page (stage C2, TKRFQVP)

The screen a vendor opens from the invitation to read the request and fill in a quote. It lives on the EXISTING public listener (the
ticket handler page's app, port 18093, the same edge, rate gate, security headers, uniform 404, TK255 prefix routing) and the existing
page bundle (`frontend/src/public-ticket/`, `www-public`), in an RFQ mode. Nothing here is a staff surface; nothing is sent outward
by the system from these routes (no WhatsApp / e-mail text, no free text); the only outbox row a vendor can cause is the verification
`code` message (fixed template, no link, no title) when his link requires a code.

### 15.1 The link, the URL and the e-mail form

* Token: `links.derive_token(key, link_id, generation, domain="rfq")`, transported in the same `X-Ticket-Token` header as a ticket token.
  The RFQ routes look the hash up ONLY in `ticket_rfq_links` (one indexed read, joined with the vendor, the request and the contact);
  the ticket routes look it up ONLY in `ticket_links`. A ticket token on an RFQ route, an RFQ token on a ticket route, an unknown,
  revoked or expired token: the uniform 404 `{"code":"link_unavailable"}` (same bytes, same headers), counted as an unknown token.
* URL (WhatsApp): `<base>/<prefix>/#q.<token>` - the fragment `q.` marks an RFQ link (`.` is not a base64url character, so it can never
  be a ticket token); the page reads it, keeps it in memory, removes the fragment from the address bar (as for a ticket link).
* E-mail form: `<base>/<prefix>/r/<rid>` (the same shape as a ticket's; `ticket_rfq_link_redeems`, 3 releases in 24 h).
  `POST /t/api/redeem {rid}` looks the id up in the ticket redeems and, when absent there, in the RFQ redeems; an RFQ answer is
  `{"token": "...", "kind": "rfq"}` (a ticket answer stays `{"token": "..."}`). One failure is counted per unknown id, as before.
* The link serves (`available`) when: not revoked; not past `min(expires_at, cap_at)`; the vendor is not `removed`; the contact is
  not erased, still active, names no internal user (`user_id`) and is not an employee (`employee = 1`) - a contact that became staff
  after the invitation is the uniform 404 (fail closed); a request that is `closed` / `cancelled` serves read-only until
  `grace_until` and is the uniform 404 when no grace was recorded.

### 15.2 Verification code (owner decision 16.10: OPTIONAL per vendor, OFF by default)

* `ticket_rfq_vendors.require_code` decides: 0 by default; the directory's own demand (the contact's or its vendor's `require_code`)
  turns it on and cannot be lowered for that vendor; otherwise the manager switches it per vendor (when he is sure the number is the
  vendor's): at creation (`vendors[].require_code`), when adding a vendor, or later with the vendor-options route (15.6). A change
  reaches the vendor's live link at once (`ticket_rfq_links.require_code`).
* With the code required and no code session, `GET /t/api/rfq` answers the minimal card only (15.3) and every write answers 403
  `code_required`. `POST /t/api/rfq/code/send {}` and `POST /t/api/rfq/code/verify {code}` behave exactly like the ticket routes
  (`/t/api/code/send|verify`: the D6 channel rule, the six digits derived from the code row id at render time and never stored, the
  per-link-generation codes / failures / lock, the per-recipient caps on the same limiter, `X-Ticket-Session` for the session) over
  the RFQ tables `ticket_rfq_link_codes`, `ticket_rfq_link_failures`, `ticket_rfq_link_sessions`. Answers: `{"sent": true, "channel",
  "expires_in_s"}`, `{"session", "expires_in_s"}`; errors 409 `code_not_required`, 503 `code_unavailable`, 422 `code_invalid` /
  `code_expired` / `code_missing` / `code_malformed` (+ `attempts_left`), 429 `code_locked` / `rate_limited` (+ `retry_after_s`).
* `send` refuses a vendor whose code is required when no channel can carry a code (409 `code_channel_unavailable`, before any write).

### 15.3 `GET /t/api/rfq` - the request as the vendor may see it

Counts as an open (vendor `sent` -> `opened`, `first_opened_at` / `last_opened_at` / `open_count` on the vendor and the link, the
request `sent` -> `collecting`, an `opened` timeline row on the first open only; no revision bump) ONLY when the code gate is passed:
a code-protected link read without a code session counts nothing (2.6.3 review F1 - a forwarded link alone must not forge "the
vendor opened it"); the first read after `code/verify` is the open. Answer:

```json
{"kind": "rfq", "ref": "RFQ-07", "organization": "...", "department": "...", "lang": "he", "dir": "rtl", "theme": "light",
 "time_zone": "Asia/Jerusalem", "code_required": false, "code_ok": true, "code_locked_s": 0, "read_only": false,
 "read_only_until": null,
 "page_state": "open | due_passed | declined | awarded | closed | cancelled",
 "rfq": {"title": "...", "description": "...", "place_text": "...", "due_at": "...", "work_from": "...", "work_to": "...",
         "allowed_line_kinds": ["labor", "parts"], "attachments": []},
 "quote": null | {"id", "version", "state": "submitted | withdrawn | awarded | partially_awarded", "lines": [{"index", "kind",
         "description", "total_minor", "hours" + "rate_minor" (labor) | "quantity" + "unit_minor" (parts) | "amount_minor" (travel /
         other)}], "currency", "vat_mode", "vat_rate_bp",
         "subtotal_minor", "vat_minor", "total_minor", "net_minor", "work_from", "work_to", "in_window": true | false | null,
         "valid_until", "note", "vendor_ref", "submitted_at", "approved": null | {"line_indexes", "subtotal_minor", "vat_minor",
         "total_minor"}},
 "declined": null | {"at", "reason"},
 "messages": [{"id", "mine": true | false, "text", "at", "answered"?: bool (v1.4: his own questions only)}],
 "form": {"currencies": ["ILS"], "currency": "ILS", "allowed_kinds": ["labor", "parts"], "vat": {"exempt": false, "rate_bp": 1800,
          "default": "excluded | included | none"}, "labor_rate_minor": null,
          "limits": {"lines": 30, "description": 120, "note": 1000, "vendor_ref": 40, "message": 2000, "decline_reason": 200,
                     "max_total_minor": 0}},
 "can": {"quote": true, "withdraw": false, "decline": true, "ask": true}}
```

* Without a code session on a code-protected link: ONLY `kind`, `ref`, `organization`, `department`, `lang`, `dir`, `theme`,
  `time_zone`, `code_required`, `code_ok`, `code_locked_s`, `read_only`, `read_only_until` (a forwarded link alone discloses nothing
  beyond "a request exists").
* `page_state` (the vendor's own view, computed at read time): `cancelled` - the request was cancelled; `closed` - the request is
  `awarded` / `ordered` / `closed` and this vendor was not awarded (he never learns who was, at what price, or that anyone was);
  `awarded` - an APPROVED award names this vendor (a pending second approval shows nothing yet); `due_passed` - the deadline passed
  and the request is still deciding; `declined` - he marked "not interested" (he may still quote until the deadline); else `open`.
* `quote` is the vendor's OWN latest live quote only (`submitted`, or the awarded one with its approved part); a withdrawn quote shows
  as `state: withdrawn` until a new one. `not_awarded` is never shown (it reads as no special state: the page shows `closed`).
* `messages`: the vendor's private thread - his questions (`mine: true`) and the organisation's answers (`mine: false`); no author
  names, no internal ids beyond the message id.
* `can.*` is false everywhere when `read_only`, when the deadline passed, when `page_state` is not `open` / `declined`, or when an
  award on this vendor is pending a second approval (2.6.3 review F2: the page and the write path agree - the form simply closes,
  `page_state` stays `open`, nothing names the pending decision) (`withdraw` needs a `submitted` quote, `decline` needs no live
  quote, `ask` needs fewer than 30 questions).
* `attachments` (v1.4, section 19.4): the request's live, vendor-visible files `[{id, name, caption, kind, bytes, width, height, thumb}]`;
  `[]` on a `closed` / `cancelled` page. The vendor uploads nothing (a vendor's own files on his quote are not built - 19.9).
* `messages` never includes a message that came by a WhatsApp reply (16.2 - an unverified sender; managers only).

### 15.4 Writes (JSON, strict models, `client_request_id` mandatory, replayed per link generation; the write budget is spent only
by a NEW stored effect; read-only grace 409 `read_only`; no code session 403 `code_required`)

| Route | Body | Answer | Refusals |
|---|---|---|---|
| `POST /t/api/rfq/quote` | `{lines[] (kind, description?, hours?, rate?, quantity?, unit_price?, amount? - the ticket quote's line), currency?, amounts_include_vat?, work_from?, work_to?, valid_until?, note?, vendor_ref?, question? (v1.4, section 21: <= 2000, stored as a question in his thread), base_version: int \| null, client_request_id}` | 201 `{ok, quote}` (the 15.3 shape) | 409 `rfq_due_passed`, 409 `quote_closed` (`reason`: `ended` \| `vendor`), 409 `quote_changed` (`version` = the current live version; `base_version` must name it, `null` when none), 422 `invalid` (`kind_not_allowed`, money / date fields) |
| `POST /t/api/rfq/withdraw` | `{quote_id, client_request_id}` | 200 `{ok}` | 409 `rfq_due_passed`, `quote_closed`; a quote under a pending award, an unknown / another vendor's quote: 409 `quote_closed` `reason: vendor` (`award_pending` is no longer answered on the public route) |
| `POST /t/api/rfq/decline` | `{reason? (<= 200), client_request_id}` | 200 `{ok}` | 409 `rfq_due_passed`, `quote_closed`, `quote_exists` (withdraw first) |
| `POST /t/api/rfq/message` | `{text (1-2000), client_request_id}` | 201 `{ok, message}` | 409 `rfq_due_passed`, `quote_closed`, `message_limit` (30 per vendor) |

Rules: a new quote supersedes the vendor's `submitted` one (version + 1; `source: vendor`, `created_by_kind: contact`); a quote after a
"not interested" makes the vendor `quoted` again; the request moves `sent` -> `collecting`. `valid_until` is an instant (the page sends
the end of the chosen day in the installation's zone), `> now` and within 366 days. Work dates may lie outside the wanted window (the
page warns; `in_window` is computed on the server). Money is computed on the server only (money.py; client totals are refused by
`extra = forbid`); only the request's allowed line kinds. All writes stop at the deadline (owner decision: no late quote; the
manager may still enter one on the vendor's behalf). Every write records an RFQ timeline row (`quote_submitted` / `quote_withdrawn` /
`declined` / `vendor_message`, actor `contact`, ids and versions only) and an audit row (`ticket.rfq.vendor_quote`,
`.vendor_withdraw`, `.vendor_decline`, `.vendor_message`; actor `contact:<id>`, source `rfq_link`, ids / versions / totals - never a
text). A vendor question is stored in the thread only; NOTHING is sent to anyone outside (v1.2: the RFQ managers get an internal
notification - section 16.1).

Refusal vocabulary (2.6.3 review F2): `quote_closed.reason` is ONLY `ended` (the request no longer takes quotes - awarded, ordered,
closed or cancelled, never said which) or `vendor` (this vendor's own row is closed, a decision on his quote is pending, or the quote
id is not his live one). A non-awarded vendor therefore never learns from a refusal that anyone was awarded (15.3).
Audit details of the public writes (2.6.3 review F3): ids, versions, states, counts - never a text or an amount
(`ticket.rfq.vendor_quote` = vendor id, quote id, version).
Link re-check (2.6.3 review F4): every write re-reads the link row (joined with the vendor, the request and the contact) INSIDE its
transaction; a revoke, a new generation, a contact change, a vendor removal or a close without grace that landed after the lookup is
the uniform 404, a read-only grace 409 `read_only`, a code switched on meanwhile 403 `code_required`. Nothing is stored.

### 15.5 Exposed fields (for the public-surface security review)

| Field (vendor page) | Source | Shown when |
|---|---|---|
| `ref`, `organization`, `department` | `ticket_rfqs.number`, settings `organization_name`, department name | always (also before the code) |
| `lang`, `dir`, `theme`, `time_zone` | the contact's language, settings | always |
| `rfq.title`, `rfq.description`, `rfq.place_text` | the request (manager-written text meant for vendors) | after the code (or no code) |
| `rfq.due_at`, `rfq.work_from`, `rfq.work_to`, `rfq.allowed_line_kinds` | the request | after the code |
| `quote.*` | the vendor's OWN latest live `ticket_quotes` row (`rfq_vendor_id` = his) | after the code |
| `declined` | his own vendor row (`declined_at`, `decline_reason`) | after the code |
| `messages[].text/at/mine` | his own thread (`ticket_rfq_messages` of his vendor row) | after the code |
| `form.vat`, `form.labor_rate_minor` | his own directory row (VAT default / exemption, his rate; owner decision 16.10, accepted risk A1) | after the code |
| `form.currencies`, `form.currency`, `form.allowed_kinds` | settings (currency allow-list), his rate currency / his quote, the request's allowed kinds | after the code |
| `form.limits.*` (`lines`, `description`, `note`, `vendor_ref`, `message`, `decline_reason`, `max_total_minor`) | code constants; `max_total_minor` is the installation's `max_claim_total_minor` setting | after the code |
| `quote.approved.*` (`line_indexes`, `subtotal_minor`, `vat_minor`, `total_minor`) | his own APPROVED award on his own quote | after the code, when awarded |
| `rfq.attachments[]` (`id`, `name`, `caption`, `kind`, `bytes`, `width`, `height`, `thumb`) | `ticket_rfq_attachments` of THIS request, live (`removed_at` NULL) and `visible_vendors = 1` (v1.4, 19.4); `name` = the cleaned display name, never a path | after the code, not on a closed / cancelled page |
| `uploads` (`files[]` `{id, name, kind, bytes, at}`, `limits`, `quote_id`, `used_bytes`, `uploads_left`, `can`) | v1.4.2, 19.10: HIS OWN `ticket_rfq_vendor_files` rows (live), `null` while `rfq.vendor_uploads.enabled` is off; no other vendor's file, no path, no hash, no read route | after the code, not on a closed / cancelled page |
| the files themselves (`GET /t/api/rfq/file/<id>[/thumb]`) | the stored re-encoded JPEG / its thumbnail, or the stored PDF / DOCX / XLSX as a download | the same rule, re-checked per request (19.4) |
| `quote.payment` (v1.4) | his OWN proposed instalments on his own quote | after the code |
| `form.payment` (v1.4) | the installation switch + code constants (`null` while off) | after the code |
| `terms.*` (v1.4, section 20.4) | his OWN approved award's schedule (amounts of his award only) and arrival confirmation | after the code, only when page_state is `awarded` |
| `messages[].id` | his own thread's message ids | after the code |
| `can.*` | derived (15.3) | after the code |
| `page_state` | derived (15.3) | after the code |
| `code_required`, `code_ok`, `code_locked_s`, `read_only`, `read_only_until` | the link (code switch, session, lock, grace) | always (also before the code) |

Side effect of a read: `GET /t/api/rfq` past the code gate counts an open (vendor / link `open_count`, first / last open, the
request `sent` -> `collecting`, the `opened` timeline row on the first open); before the code it counts nothing (F1).

NEVER exposed: other vendors (names, count, states, opens), other quotes or amounts, lowest / earliest, the comparison, awards of
others, the second-approval threshold, internal notes, `cancel_reason`, the internal owner, the creator, who answered a question,
the source ticket, the site / building / floor ids, the link's id / key id / expiry internals, outbox / delivery states, the token,
and - on the read AND the write path - the request's internal state after an award (`awarded` / `ordered`) or a pending second
approval (2.6.3 review F2).

### 15.6 Manager-side additions (the internal API)

* `GET /tickets/rfqs/meta` adds `vendor_options: true`.
* `POST /tickets/rfqs` `vendors[]` accepts `{contact_id, channel?: auto|whatsapp|email|manual (default auto), require_code?: bool}`;
  `POST /tickets/rfqs/{id}/vendors` accepts the same two optional fields.
* `POST /tickets/rfqs/{id}/vendors/{rv_id}/options` `{revision, require_code?, channel?}` (RFQ manager) -> the detail. `channel` only
  for a `draft` vendor (else 409 `rfq_field_locked`); `require_code` until the vendor is awarded / removed; lowering a code the
  directory demands is 409 `vendor_code_locked`. Audit `ticket.rfq.vendor_options` (field names and booleans only).
* Detail `vendors[]` adds `require_code` (bool) and `channel_choice` (`auto` | `whatsapp` | `email` | `manual`, managers only).
* `send` with `channel: auto` uses each vendor's `channel_choice` (`auto` = the contact's preferred channel, `manual` = no message for
  that vendor); `channel: manual` on the send still means "nobody gets a message".
* `rfq.VENDOR_PAGE = True`: invitations, reminders and the "new message" notice by WhatsApp / e-mail work when the public listener is
  ready (`vendor_page_ready`), through the existing outbox purposes.

### 15.7 Migration (no new number)

0089 (still provisional, not released) gains, additively: `ticket_rfq_vendors.channel_choice` (TEXT NOT NULL DEFAULT 'auto'),
`ticket_quotes.valid_until` (TEXT NULL), and `ticket_rfq_link_codes`, `ticket_rfq_link_failures`, `ticket_rfq_link_sessions` (the
ticket code tables' columns; `link_id` -> `ticket_rfq_links(id)` ON DELETE CASCADE). Retention and full deletion remove them with
the links.

## 16. Notifications and inbound replies (v1.2, TKRFQ5)

### 16.1 The RFQ managers' notifications (CR-018 notification centre)

Four sources (catalogue `services/tickets/notify_sources.py`, rendered by `services/tickets/rfq_notify.py`), category `tickets`, subject
kind `rfq`, recipient rule `rfq_managers`. Listed in Settings › התראות (the policy matrix, next to the ticket sources) only while the
module is on; each has the usual switch, severity, recipients and channels there.

| Source | When | Default | Row (dedupe key) | Resolved by |
|---|---|---|---|---|
| `rfq.quote_received` "הצעת מחיר התקבלה או עודכנה" / "Quote received or updated" | a vendor's page: a new quote, a new version, a withdrawal | info, push on | one per request, folded (`rfq:<id>:quote`; the title says new / updated / withdrawn) | award (final), close, cancel, delete |
| `rfq.declined` "ספק השיב שאינו מעוניין" / "Vendor declined" | a vendor's "not interested" | info, push off | one per request, folded (`rfq:<id>:declined`) | the same |
| `rfq.question` "שאלת הבהרה מספק" / "Clarification question from a vendor" | a page question, or a WhatsApp reply matched by 16.2 | alert, push on | one per vendor (`rfq:<id>:question:<rv_id>`) | a manager writes to that vendor; the same |
| `rfq.due_passed` "המועד להגשת הצעות עבר" / "Quote deadline passed" | the deadline passed (janitor or the first write after it) | info, push on | one per request (`rfq:<id>:due`) | a later deadline (the edit reopens the collection); the same |

* Defaults: enabled, inbox always, WhatsApp OFF (NOTIFWA: never on by default; when an administrator turns it on, it reaches an Arx
  user's own confirmed number only, with the channel's own detail rule). E-mail off. Nothing is ever sent to a vendor.
* Recipients (`rfq_managers`, the section 6 manager rule): the creator, the internal owner and the department's manager members (when
  the department has none: the `tickets.manage` + `tickets.all_departments` holders where the request lies), each kept only when
  `rfq.visible()` sees the request and `rfq.is_manager()` holds (`tickets.external` on the place). A plain member, another department's
  manager, an all-departments viewer without manage, a user without `tickets.external` and the vendors are never told. Visibility of a
  row (subject `rfq`) is `rfq.visible()` now - a moved department, a revoked binding or a deleted request hides old rows.
* Texts: `RFQ-07: <what happened>` + the place (place text, else the department name); the deadline row adds the counts "N of M
  quoted". NEVER an amount, a vendor's name / phone / text, the request title, or anything about another vendor (the origin carries ids
  only: the request, the department, the vendor row, the message). Hebrew is the notification centre's language; the English column
  is kept in `rfq_notify.TEXTS` and the settings labels follow the UI language (`frontend/src/i18n/rfq-notify.ts`).
* Not raised: entries the manager makes on the vendor's behalf (he did it himself), awards, second approvals, close / cancel.
* Link: `#/tickets/rfqs?rfq=<id>`.

### 16.2 Inbound WhatsApp replies to RFQ messages

A vendor's TEXT reply to an RFQ message (`rfq_invite`, `rfq_reminder`, `rfq_update`; RFQ messages carry no buttons / nonce, so the
nonce path is not involved) is matched by the sender's keyed number (`ticket_contacts.phone_key`, as for tickets) to an OPEN request:

* Candidate = the contact is an invited vendor whose link is live (not revoked / expired / in a read-only grace; contact not erased,
  inactive or staff - the `public_rfq.fold` rule), the request is `sent` / `collecting` before its deadline, the vendor row is not
  `draft` / `removed` / `awarded` / `not_awarded` and no award on him is pending, and an RFQ message went to him by WhatsApp over that
  link (`sent` / `unknown`) within `reply_window_h`. The account filter, the `account_unknown` fail-closed rule, freshness and the 24 h
  dedupe run first, unchanged.
* Order: an `RFQ-<n>` reference naming exactly one of his open requests wins; with no live ticket, his only open request takes it;
  several open requests and no reference -> `ignored` / `rfq_several` (envelope only, never guessed); a reference naming none of them ->
  `ignored` / `rfq_reference_unknown`; a live ticket AND an open request with no reference of either kind -> the ticket flow's
  `ambiguous` (`ticket_or_rfq`, the managers' claim-before-reveal list); a `#<ticket>` reference -> the ticket rules.
* A sender with no candidate at all (a stranger, or a vendor whose request closed, passed its deadline or removed him) is
  `unknown_sender`, exactly as before - nothing tells him or the log which requests exist. No automatic reply, ever.
* Applied (worker transaction, everything re-checked first; a change meanwhile -> `ignored` / `rfq_closed`): a `ticket_rfq_messages`
  row `direction = 'in'`, `author_kind = 'contact'`, `source_kind = 'clarify'`, `source_id = 'whatsapp:<inbound id>'`; the RFQ timeline
  row `vendor_message` (`data.via = whatsapp`, `unverified`); audit `ticket.rfq.vendor_message` (source `whatsapp`, ids only); the
  `rfq.question` notification ("הודעה מספק בוואטסאפ" / "שולח לא מאומת"). The `ticket_inbound` envelope is `result = note`,
  `reason = rfq`, `ticket_id` NULL, `content` NULL (the text lives in the thread only); audit `ticket.inbound` names the request id.
* Trust: an HA event is not authenticated (9.6), so the message is shown to managers as "via WhatsApp - unverified sender"
  (`messages[].via = "whatsapp"`, `unverified = true`, `source = null`), it never moves a state (no quote / decline / withdrawal from a
  text), and it is NOT shown on the vendor's public page (15.3 `messages` excludes it - a forged event must not put words in the
  vendor's own thread). The 30-message cap of a thread counts these too (`rfq_message_limit`).
* Residual: a reply to an RFQ message from a vendor who also has a live ticket and names neither lands in the ticket managers'
  ambiguous list (claim-before-reveal), which can be a different department's managers than the request's.
* No migration: `ticket_inbound` keeps its result CHECK (`note`), `ticket_rfq_messages.source_id` is free text.

## 17. Attachments - DESIGN ONLY (v1.2; SUPERSEDED by section 19, which is what was built - kept for the record)

What files on a request would need, so a later version can build it without re-deciding. Nothing here exists in code.

* **Two directions.** (a) Manager -> vendors: drawings / photos attached to the request, shown on every invited vendor's page after the
  code gate (15.5 row `rfq.attachments`). (b) Vendor -> manager: a vendor's own files on HIS quote (a PDF quote, a spec sheet), seen by
  that vendor and the managers only - never by another vendor.
* **Storage.** Reuse the ticket photo store (`services/tickets/attachments.py` / `image_intake.py` / `cost_storage.py`: files under the
  add-on data directory, content-addressed names, metadata rows) with two new tables in a future migration: `ticket_rfq_attachments`
  (request files: `id, rfq_id, kind (image|pdf), mime, bytes, sha256, width, height, created_by, created_at, removed_at`) and
  `ticket_rfq_quote_files` (`id, rfq_vendor_id, quote_id NULL, ...` with `created_by_kind = contact`). Retention and full deletion
  follow section 12 (purged with the request; the awarded quote's files move with it to the ticket in C4).
* **Limits.** Request: 10 files, 10 MB each, 40 MB per request. Vendor: 5 files, 10 MB each, 25 MB per vendor per request; a write
  budget of its own on the public listener (uploads per link per hour) and the existing body caps raised only for the upload route.
* **Image pipeline.** The ticket photos' path: magic-byte type check (JPEG / PNG / WebP / HEIC -> re-encoded JPEG), EXIF / GPS stripped,
  re-encode to a bounded size (max 2560 px, thumbnail 480 px), decompression-bomb limits (pixel count), never served from the original
  bytes. PDF: accepted as is only after a structural check (header / trailer, no JavaScript / embedded files / launch actions - refused,
  not sanitised), served with `Content-Disposition: attachment` and `Content-Type: application/pdf`, never rendered inline by us.
* **Malware / privacy.** No server-side antivirus exists in the add-on; the rule is therefore "refuse what cannot be proven simple"
  (the image re-encode, the PDF structural refusal list), no Office / archive / executable types at all, and every download as an
  attachment with `X-Content-Type-Options: nosniff` and the public listener's CSP. Files are personal data (a vendor's letterhead,
  phone numbers in a PDF): never in logs, audit (ids / sizes / hashes only), notifications or outbox rows; access is checked on every
  read (manager side: `rfq.visible`; vendor side: his link + code gate, and a vendor file only for its own vendor).
* **Vendor upload route (public listener).** `POST /t/api/rfq/files` (multipart, the existing `public_multipart.py` parser and its
  limits, `client_request_id`, the link re-check of 15.4, code gate, deadline and `quote_closed` rules as for a quote) -> 201
  `{file: {id, name, kind, bytes}}`; `DELETE /t/api/rfq/files/{id}` before the deadline; `GET /t/api/rfq/files/{id}` streams his own
  file or a request file. Manager side: `POST /tickets/rfqs/{id}/attachments` (RFQ manager, draft or open), `DELETE ...`, `GET ...`.
* **Contract changes when built:** 15.3 `rfq.attachments: [{id, name, kind, bytes, thumb}]`, `quote.files: [...]`, `form.limits.files`;
  15.5 rows for both; a security review of the public upload surface before release (new public surface = a dedicated review); the
  migration number is assigned by the lead at integration.

## 18. The work order (stage C4, TKRFQ4)

After an award is FINAL (`approved`; a `pending_second` award has none) the manager opens, for each awarded vendor, the service request
the vendor will work on. Owner decisions (RFQ_SPEC section 9): one service request per vendor when the award is split, linked to each
other; a vendor that was not selected gets nothing; the selected quote is the approved cost baseline automatically; an approval never
sends a message by itself - the order message leaves only on the manager's explicit click, after a preview of the exact text.

### 18.1 No new table (no migration)

An order IS the award (its id names the order) + the awarded quote's `ticket_id` / `assignment_id` (set by the create, DETAIL 4.2:
"the latest approved quote of an assignment IS its baseline" - no copy) + the RFQ timeline rows `order_created` (`{award_id,
ticket_id, ticket_number, assignment_id, quote_id, work_from, work_to, documents: bool}`) and `order_sent` (`{award_id, ticket_id,
outbox_id, channel}`) + the `rfq_order` outbox row (0089 reserved the purpose). Idempotency of the create: the module's request ledger
(`ticket_requests`, scope `rfqorder:<award_id>`, the body's `request_key`). Nothing else is stored: the dates live in the timeline row
and in the request's description, the agreed documents in the request's description only (requests carry no files yet - text).

### 18.2 Routes

| Route | Who | Body / answer |
|---|---|---|
| `POST /tickets/rfqs/{id}/awards/{award_id}/order` | order (18.3) | `{work_from?, work_to?, documents? (<= 1000), request_key}` -> 201 `{rfq: detail, award: <the award with its order>, ticket: {id, number}, replayed: bool}` |
| `GET /tickets/rfqs/{id}/awards/{award_id}/order/preview` | order | `{award_id, text, lang, channel: whatsapp\|email\|manual, refusals: [code], sent: bool, sent_at}` - no side effect |
| `POST /tickets/rfqs/{id}/awards/{award_id}/order/send` | order | no body -> `{rfq, award, notified: {queued, channel, outbox_id, already}}` |

Create, in this order - every refusal before the first write (the writes then run in a savepoint, so a late refusal of the reused
create / assign code leaves nothing half-made):
1. the request is visible (else the uniform 404 `rfq_not_found`), the caller may order (18.3, audited 403 `not_manager` /
   `external_permission_missing` / `not_department_manager` / `create_not_allowed`);
2. the award exists on this request (404 `award_not_found`); the same `request_key` again answers the first answer (`replayed: true`);
3. 409 `award_pending` (a second approval is pending); 409 `rfq_invalid_transition` (`{from, action: "order"}`) for a declined award
   or a request that is not `awarded` / `ordered` (closed, cancelled, still collecting); 409 `order_exists` (`details.ticket_id`
   when the caller may open it) for an award that already has its request;
4. the vendor: still `awarded` (else 409 `vendor_not_allowed`, reason `vendor_state`) and still a contact that may receive a link -
   the section-3 rule again (`vendor_not_allowed` with reason `employee` / `internal_user` / `inactive` / `kind` / `department` /
   `not_found`: NEVER a staff contact);
5. the handler page is ready (409 `public_link_unavailable` - the vendor works through the request's handler link);
6. the dates: `work_from` / `work_to` (UTC instants, `rfq._instant` rules); omitted = the awarded quote's work window, else the
   request's wanted window; `work_from` is required in the end (422 `required`), `work_to >= work_from` (422 `order`);
   `documents` text hygiene, <= 1000.

Then, one transaction: `create.create_ticket` (title = the request's title; description = the request's description + the order block:
"הזמנת עבודה מבקשת הצעת מחיר RFQ-07", the scope - "ההצעה במלואה" / "סעיפי עבודה בלבד" / "סעיפים נבחרים: ..." -, the dates, the
documents; NEVER an amount); the request's place (`site_id` / `building_id` / `floor_id` / `place_text`) and allowed line kinds; the
internal owner = the request's (`owners.set_from_rfq`, source `rfq`); `external.assign_contact` (the existing external assignment: a
handler link, the cost demand `required`, the request `assigned`) with `dispatch=False` - the assignment message is NOT queued; the
awarded quote gets `ticket_id` / `assignment_id` (the baseline; the flow stage reads `quote_approved`); a ticket timeline row `rfq_order`
(`{rfq_id, number, award_id, quote_id, version}`); the RFQ row `order_created`; the request becomes `ordered` when every approved award
has its order AND an award was final (`finalize`; a split still being decided stays `awarded`); audit `ticket.rfq.order` (ids only).

Send: the order exists (404 `order_not_found`) and the caller may open its request; refusals (also listed by the preview):
`order_ticket_closed` (the request is closed / cancelled), `order_link_unavailable` (the handler link is not live / the assignment
ended), `vendor_not_allowed`, `order_channel_unavailable` (no WhatsApp / e-mail can reach the vendor: the manager copies the link
from the request - nothing is queued). Then ONE outbox row: purpose `rfq_order`, the vendor's contact, `ticket_id`, `assignment_id`,
the request's handler `link_id`, `rfq_id`, idempotency key `rfqorder:<award_id>:<link generation>`; a repeat answers `already: true`
and queues nothing. Timeline rows `order_sent` (RFQ) and `rfq_order_sent` (ticket); audit `ticket.rfq.order_send`. When the row leaves,
the ticket's line reads `link_sent` (the order carries the link) and the RFQ timeline reads `message_sent`.

The message (`rfq_order`, he / en / ar / ru starters, editable like every template; ar / ru pending a native review): the request's
title and number, the order's dates as `{window}`, the link - no amount, no phone, no free text. The preview renders the same template
the outbox will pick for the vendor's language, the link shown as a placeholder.

### 18.3 Permissions

"order" = an RFQ manager (section 6: creator / internal owner / department manager, with `tickets.external` on the place) who ALSO
manages the department where the request lies (`tickets.manage` + department manager / all departments - the external assignment is
a manager act) and may open a request there (`tickets.create`, member or `open_to_all`). The cost permissions are NOT required (the
award already decided the money; the order carries no amount). The detail's `can.order` / `can.send_order` and each award's
`can.{order, send_order}` follow this rule.

### 18.4 The detail and the ticket answer

`GET /tickets/rfqs/{id}` `awards[]` add: `order` (null, or `{ticket: {id (null when the caller may not open it), number, status},
work_from, work_to, created_at, created_by, sent: null | {at, channel, by}}`), `ticket` (the same `{id, number, status}` - kept from
v0.9's gap), `scope` (`{kind: all | kinds | lines, kinds: [..], lines: n}`), `order_defaults` (`{work_from, work_to}` while no order
exists, for a caller who may order), `can: {order, send_order}`. `can` of the request adds `order` and `send_order`. Timeline kinds
`order_created` / `order_sent`.

`GET /tickets/{ticket_id}` adds `rfq_origin` (full view only; null for a ticket not opened from a request): `{id (null when the
caller may not see the request), number, ref, work_from, work_to, siblings: [{id, number}]}` - siblings = the other requests the same
RFQ opened (a split), only those the caller may see.

### 18.5 Retention and deletion

A ticket an order opened keeps its baseline quote when the request is deleted / purged (section 12: the quote's `rfq_vendor_id` is
cleared; `rfq_origin` becomes null); the order's outbox row stays with the ticket (its `rfq_id` is cleared, not deleted). A ticket
purge removes its quotes (DETAIL section 1) - the request then shows the award without a request.

### 18.6 Not in this version (recorded)

* The vendor's date confirmation / alternative dates on the page (RFQ_SPEC "order: sent -> confirmed | alt_dates_proposed"): the vendor
  confirms through the request's handler page as for any request (acknowledge, notes, ETA); no separate order state is stored.
* Files: requests and orders carry no files yet - the agreed documents are text in the request's description.

## 19. Files and pictures on a request (v1.4, RFQATT - owner request 2026-10-17)

The owner (17.10): "in a request for quotation the manager must be able to attach files and images so that as much detail as possible
reaches the vendors we want quotes from (photos of the site, plans, specs, PDFs)". Direction (a) of section 17 is built - manager ->
vendors; direction (b) (a vendor's own files on his quote) is not (19.9). Decisions and open questions: `docs/changes/CR-RFQ-ATTACHMENTS.md`.

### 19.1 Migration 0102 (provisional 0104 on `pilot/RFQATT`, renumbered at the integ/264 integration)

Additive, no rebuild. `ticket_rfq_attachments`: `id`, `rfq_id` (FK SET NULL - a purged request leaves a file a work order references),
`folder` (the request's id at upload, never changes; the orphan sweep reads it), `kind` (`image` | `pdf` | `docx` | `xlsx`), `name` (the
cleaned display name), `caption` (<= 200), `mime`, `path` / `thumb_path` (relative, `<folder>/rfq/<16 hex>.<ext>`), `sha256`, `bytes`,
`width`, `height`, `visible_vendors` (0 / 1, default 1), `position`, `created_by`, `created_at`, `updated_at`, `removed_at`, `removed_by`.
`ticket_rfq_attachment_refs` (`ticket_id` FK cascade, `attachment_id` FK cascade, `award_id`, `created_at`; PK (ticket, attachment)) - the
reference copy of a work order (19.6). Rollback: drop both tables.

### 19.2 What a file may be (services/tickets/rfq_files.py) - by CONTENT, never the name or the declared type

| Kind | Accepted when | Stored | Served |
|---|---|---|---|
| picture | JPEG / PNG / WebP magic; the ONE image pipeline (`image_intake.reencode`, here with `allow_webp=True` - the public routes keep refusing WebP): structure walk, pixel budget (16 MP; 8 MP for PNG, progressive JPEG and WebP), a metadata-free copy for the decoder, still WebP only (animation refused), at most 8 MiB | a FRESH JPEG (q82, <= 2048 px, no EXIF / GPS / ICC / XMP / comments / appended bytes) + a 480 px re-encoded thumbnail; the original bytes never | inline, `image/jpeg`, nosniff, `private, no-store` |
| PDF | `rfq_files.check_pdf`: `cost_files.check_pdf` (magic at 0, active-content names incl. inflated streams, encryption refused) plus (v1.4.1, review F3) nothing but whitespace after the LAST `%%EOF` (`pdf_invalid`) and no ZIP central directory + end record anywhere in the bytes (`pdf_refused` - the PDF/ZIP polyglot), at most 10 MiB | byte for byte, never parsed / rendered / thumbnailed | download only: `application/pdf`, `Content-Disposition: attachment` (ASCII fallback name + RFC 5987 `filename*`), nosniff, `private, no-store`; CSP: `sandbox` on the internal API, the listener's `default-src 'none'; ...` on the public edge (v1.4.1, review F7: the edge replaces every route CSP) |
| DOCX / XLSX - **only while the installation setting `rfq.attachments.allow_office` is on (OFF by default; otherwise 422 `office_disabled` before any scan)** | `check_office`: a ZIP that starts at byte 0 and ends with its classic EOCD record (no prepended / appended bytes, no comment; a ZIP64 archive also ends with that record and is read by `zipfile` - its counts and sizes are judged from the directory like any other), no `%PDF-` in the first KiB and no other format's magic in the first entry's name / extra field; <= 2000 entries; unique plain names (no absolute, `..`, backslash, drive, NUL; case-folded duplicates refused); no encryption; stored / deflate only; <= 100 MiB uncompressed and <= 100:1 per entry over 1 MiB (a bomb is refused from the directory); exactly one main part (`word/document.xml` / `xl/workbook.xml`) with the macro-FREE content type; at most 10 MiB | byte for byte | download only (as PDF, the exact OOXML type) |
| anything else | - | - | 415 `unsupported_format` (HEIC: `heic_refused`) |

Office refusals (422 `office_refused`; v1.4.1 after the 2.6.4 review F1 / F2 - the checks PARSE, they do not grep):
* **Content-type allow-list** (`[Content_Types].xml`): every declared Default / Override type and every part's resolved type must be on
  the list - the OOXML `wordprocessingml` / `spreadsheetml` / `drawingml` / theme / properties `+xml` types (minus connections, query
  tables, external links, OLE, ActiveX, controls, macros, templates, mail merge, shared-workbook revision parts), package relationships and
  core properties, `application/xml` (customXml), printer settings, VML drawings, JPEG / PNG / GIF / BMP / TIFF and a short list of
  `vnd.ms-*` chart / comment / people types. Refused, never cleaned: altChunk carriers (MHT `message/rfc822`, HTML, XHTML, RTF, plain text),
  data connections, query tables, external links, OLE / ActiveX, macros, embedded fonts (`obfuscatedFont`), EMF / WMF / SVG, signatures,
  web extensions, any unknown type, a part with no declared type. The main part's own Override must be EXACTLY the macro-free main type.
* **Names** (defence in depth, before anything is read): `vbaProject` / `vbaData`, `activeX/`, `embeddings/`, OLE objects, macro sheets,
  `externalLinks/`, `xl/connections.xml`, `queryTables/`, `word/fonts/`, `afchunk`, any `.bin` except `printerSettings/*.bin`, and
  executable / HTML / MHT / RTF / text / metafile / font / SVG extensions.
* **Every XML part is parsed** with expat: character references are decoded, attribute whitespace and tag length are irrelevant, a
  DOCTYPE / ENTITY anywhere in a part is refused (raw scan of the WHOLE part, and the parser's own DOCTYPE handler - also in UTF-16), so no
  entity is ever defined or expanded (an undefined entity -> `office_invalid`); at most 2 million elements per part.
* **Relationships** (every one, decoded): a refused type in any mode (attachedTemplate, oleObject, activeX, vbaProject, frame,
  subDocument, externalLink(Path), package, control, aFChunk, connections, queryTable, font, mail-merge sources, web extensions, macro /
  dialog sheets, ...); an EXTERNAL target only for a hyperlink; an internal target never a URL or a UNC path.
* **Word field codes**: the text of all `instrText` / `delInstrText` runs of one field (begin .. separate) is joined before it is judged,
  `fldSimple@instr` likewise, in EVERY Word part (headers, footers, notes ...): DDE, DDEAUTO, INCLUDETEXT, INCLUDEPICTURE, LINK, EMBED,
  IMPORT, DATABASE, PRINT, MACROBUTTON, RD, AUTOTEXTLIST, and a field whose type would come from a nested field (the QUOTE obfuscation).
* **Spreadsheets**: a `|` in ANY formula location (cell `f`, `definedName`, table formulas, data-validation `formula1` / `formula2`,
  conditional-format `formula`, `xm:f` in extension lists); pivot caches over anything but a worksheet (or with a `connectionId`).
* **Elements** refused anywhere: `altChunk`, `subDoc`, OLE objects, ActiveX controls, `ddeLink`, `oleLink`, `externalReference(s)`,
  Power Query `DataMashup`, VML `FmlaMacro`, `webPublishItems`.

Inflating for the scans is bounded (100 MiB in all, 32 MiB per part) and runs in the route's decode slot (429 `busy` when it is taken).
422 `office_invalid`: not a well-formed package / XML. As for invoice PDFs, the scans are a FILTER, not a guarantee (a false refusal of an
unusual but harmless document is accepted - save it as PDF); the controls are "never rendered by Arx" and "a download only" (+ the
listener's CSP on the public side). Residual (recorded, not filtered): parser bugs in Office itself on allowed parts (PNG / JPEG / XML),
and hyperlinks (a click by the vendor).

**Installation setting `rfq.attachments.allow_office`** (v1.4.1; tickets.settings, `PUT /tickets/settings` body `{"rfq": {"attachments":
{"allow_office": true}}}`, `system.configure`, audited as `tickets.settings.update` with the changed key; OFF by default - owner question
1, decided by the lead 2026-10-17: Word / Excel stay available but off until the hardened checks are verified). Off: the upload answers
422 `office_disabled` (audited `denied`) before the scan; `meta.attachment_limits.types` drops `docx` / `xlsx` and `office` is `false`
(the form hides them); and office files ALREADY attached stop travelling - they leave the vendor page, its file route (the uniform 404),
the work order's reference copy, the `{files}` count and the ticket's `rfq_origin` until the switch is on again (fail closed); managers
still see and download them on the request. PDF and pictures never depend on the switch. There is no settings card for it yet (the RFQ
settings have no UI card); it is set through the API.

Names: the display name is the last path segment only, NFC, without control / bidi / zero-width / private characters or characters a file
system refuses, <= 100 characters before the extension, Windows device names prefixed, and ALWAYS the extension of what the content is (a
picture called `plan.pdf` becomes `plan.jpg`). Storage uses random names only. Captions: one line, control characters removed, <= 200.

Limits per request (live files): **10 files**, a picture 8 MiB / a document 10 MiB as uploaded, **40 MiB stored in total** (checked
before the decode - the role, the state, a full request - and again inside the write transaction with the stored size), plus the
installation's 2 GiB cap of the tickets file store (507 `storage_full`; v1.4.1, review F6: the cap's cached size is told about every stored
RFQ file and thumbnail and credited on delete / purge, as the ticket photos are). The manager route's body cap: `body_limit` row `rfq_attachment`
(10 MiB + the multipart framing). The decode runs outside the database write lock, in a decode slot of its own.

### 19.3 Manager routes (internal, `/api/v1`, RFQ visibility first - the uniform 404 `rfq_not_found`)

| Route | Who | Body / answer |
|---|---|---|
| `POST /tickets/rfqs/{id}/attachments` | RFQ manager (section 6), the request `draft` / `sent` / `collecting` / `due_passed` | multipart `file`, `caption?`, `visible_vendors?` (`true` / `false`, default true) -> 201 the detail + `attachment` |
| `PATCH /tickets/rfqs/{id}/attachments/{aid}` | the same | `{caption?, visible_vendors?}` -> the detail + `changed` |
| `DELETE /tickets/rfqs/{id}/attachments/{aid}` | the same | -> the detail (19.5) |
| `GET /tickets/rfqs/{id}/attachments/{aid}` and `.../thumb` | everyone who sees the request (internal-only and removed files included) | the file (19.2) |
| `GET /tickets/{ticket_id}/rfq-attachments/{aid}` and `.../thumb` | the ticket's viewers (`access.py`) | a request file THAT ticket references (19.6) |

Refusals (the role / state / quota first - v1.4.1, review F9: before the `visible_vendors` form check): audited 403 `forbidden`
(`not_manager`, `external_permission_missing`); 404 `attachment_not_found` (another request's id, a
removed file on a write); 409 `attachment_locked` (awarded / ordered / closed / cancelled), `attachment_limit` (`max_files`); 413
`attachment_total` (`max_bytes`), `payload_too_large` (`max_bytes`); 415 `unsupported_format`, `heic_refused`; 422 `image_invalid`,
`too_many_pixels`, `pdf_invalid`, `pdf_refused`, `office_invalid`, `office_refused`, `office_disabled`, `validation` (`caption`, `visible_vendors`); 429
`busy`; 507 `storage_full`. A refusal never echoes the file's content or name; a pipeline refusal is audited (`decision: denied`, the code).
A write never bumps the request's `revision` (an open form never goes stale for a file) and never sends anything.

Detail (section 10) adds `attachments: [{id, name, caption, kind, mime, bytes, width, height, thumb, visible_vendors, created_at, removed
(+ removed_at for managers)}]` (live files; an RFQ manager also sees the removed ones) and `can.attach`. Meta adds `attachments: true` and
`attachment_limits: {files, image_bytes, document_bytes, total_bytes, caption, types, office}` (`types` holds `docx` / `xlsx` and `office`
is true only while `rfq.attachments.allow_office` is on); `settings.attachments.allow_office`. Timeline kinds `attachment_added` (`{attachment_id,
kind, visible_vendors}`), `attachment_changed` (`{attachment_id, fields, visible_vendors?}`), `attachment_removed` (`{attachment_id, kept}`).
Audit `ticket.rfq.attachment_add` / `.attachment_edit` / `.attachment_remove` - ids (and the kind / changed field names / `kept`) only:
never a name, a caption, a hash or a size.

### 19.4 The vendor (public listener)

`GET /t/api/rfq` `rfq.attachments` (15.3 / 15.5). `GET /t/api/rfq/file/<id>` (edge kind `file_read` - v1.4.1, review F4: a window of its
own, 20 / min and 60 / h per link, because a document is up to 10 MiB and the edge drops `Range`, so every read is the whole file) and
`GET /t/api/rfq/file/<id>/thumb` (edge kind `photo_read`, its 120 / min window): the token through `rfq_context()` (one indexed lookup; a ticket token, an unknown / revoked / expired token, a removed
vendor or a contact that became staff -> the uniform 404); a code-protected link without its session -> 403 `code_required`; then, re-read
per request: the link row as it is now, the page not `closed` / `cancelled`, the file of THIS request, live and `visible_vendors`. Anything
else - another request's file, an internal-only or removed file, a thumbnail of a document - is the uniform 404 (same bytes). There is NO
list or index route; a file id alone is worth nothing without a live link of that request. Every invited vendor of the request receives
the same set of files (per-vendor selection is not built - 19.9). The page shows pictures as thumbnails with a lightbox and documents as
download buttons (fetched with the token header, handed to the browser as `application/octet-stream` - never rendered by the page).

### 19.5 Removal and retention

* Before any quote arrived on the request (any vendor, any state, also entered on a vendor's behalf): the row and its file(s) are deleted.
* After a quote arrived: the row is MARKED removed (`removed_at`, `removed_by`), the file stays (what the vendors priced against is kept),
  vendors stop seeing it at once, managers see it marked and may still download it.
* Both: one transaction with the timeline row `attachment_removed` and the audit row - no audit row, no removal. A file is removed from
  disk only after the commit; the janitor's orphan sweeps (`deletion.sweep_orphans` / `sweep_orphan_files`, which now know the `rfq`
  sub-folder and the request folders) retry what could not be removed.
* Full deletion / retention purge of the request (section 12): every file no service request references is deleted (rows in
  `store_rfq.purge_rfq`, files after the commit by the delete route, or by the orphan sweep after a janitor purge); a referenced file stays
  with `rfq_id` NULL. The janitor deletes a file row that neither a request nor a reference names any more (`rfq.retention`).

### 19.6 The work order's reference copy (TKRFQ4)

`POST .../awards/{award_id}/order` inserts one `ticket_rfq_attachment_refs` row per live, vendor-visible file of the request for the new
service request - no copy of the bytes. `order_created` data adds `files` (the count). The ticket's `rfq_origin` (18.4) adds `attachments`
(the referenced files, `present_public` shape). The service request's handler page (`GET /t/api/ticket`) adds `rfq_files` (same shape,
only past its code gate, absent when none) and serves them through `GET /t/api/ticket/rfq-file/<id>[/thumb]` (`file_read` / `photo_read` as in 19.4; the ticket link's
`link_context`; a file that ticket does not reference -> the uniform 404). A ticket purge deletes its references.

### 19.7 Messages (owner: "N attachments", never a name or a URL)

New placeholder `{files}` (allowed in every template, cap 60): "מצורפים לבקשה N קבצים (בקישור)." / "N files are attached to the request
(see the link)." (ar / ru too, pending a native review), from the COUNT of live vendor-visible files; empty -> the line is dropped. The
`rfq_invite` starters carry a `{files}` line after the work window; the order message's params never carry it. No message ever carries a
file name, a caption or an address other than the personal `{link}`.

### 19.8 Not in logs

File names, captions and contents never reach a log record, an audit row, a timeline row, a notification or an outbox row (ids, the kind,
counts only). The image pipeline's own rule (no metadata reaches Pillow) applies unchanged.

### 19.9 Not built in v1.4 (recorded)

* A vendor's own files on his quote (section 17 direction (b)) and any public upload route. **Built in v1.4.2 as 19.10 (owner decision
  2026-10-17), behind a switch that is OFF by default.**
* Per-vendor file selection (every invited vendor gets the same vendor-visible files; "internal only" is the one switch).
* Re-ordering files; an automatic "new file" notice to vendors when a file is added after the send (the manager may write to them).
* The internal ticket drawer shows the referenced files only through `rfq_origin.attachments` (no new UI block there in this version).
* Server-side antivirus (none exists in the add-on - 19.2's "refuse what cannot be proven simple" instead).

### 19.10 A vendor's own files on his quote (v1.4.2, RFQ-VENDOR-UPLOAD - owner decision 2026-10-17)

> **Release gate: a Fable review of this public upload surface is REQUIRED before the switch `rfq.vendor_uploads.enabled` may be turned
> on in a release** (security checklist row 5.12; `private/planning/REVIEW_POLICY_2026-10-16.md`: Fable for a new public surface). The
> branch ships it OFF; while it is off nothing on the public surface changes except two more paths that answer the uniform 404.

The owner (17.10, reversing the earlier "not now" of 19.9 / CR-RFQ-ATTACHMENTS question 4): a vendor may attach files and pictures to
his quote; the request opener and the RFQ managers see them. Decisions and open questions: `docs/changes/CR-RFQ-VENDOR-UPLOAD.md`.

**Switch.** `tickets.settings.rfq.vendor_uploads.enabled` (bool, default **false**; `PUT /tickets/settings` `{revision, rfq:
{vendor_uploads: {enabled: true}}}`, `system.configure`, audited `tickets.settings.update` with the changed key `rfq.vendor_uploads.enabled`).
Off: both routes below answer the uniform 404 (checked FIRST - before the read-only / code answers, so the route reads as absent), the
page's `uploads` is `null`, `meta.vendor_uploads` is `false`; files already uploaded stay readable by the managers. Word / Excel need
`rfq.attachments.allow_office` in addition (19.2; off: 422 `office_disabled` before any scan, and the managers' list / read leave office
files out - fail closed).

**Migration 0110** (additive): `ticket_rfq_vendor_files` (`id`, `rfq_id` FK cascade, `rfq_vendor_id` FK cascade, `quote_id` (his quote at
upload), `folder` (the request's id - the orphan sweeps know it: `store.folder_in_use` / `stored_paths`), `kind`, `name` (cleaned), `mime`,
`path` / `thumb_path` (`<folder>/rfq/<16 hex>.<ext>`, random), `sha256`, `bytes`, `stored_bytes` (file + thumbnail), `width`, `height`,
`created_at`, `removed_at`). Purged with the request (`store_rfq.purge_rfq`; the delete route removes the files after the commit).

| Route (public listener) | Edge | Body / answer |
|---|---|---|
| `POST /t/api/rfq/upload` | kind `rfq_upload` (multipart, 10 MiB + 64 KiB, the 60 s upload deadline and 5 s idle limit; per LINK `token_rfq_uploads` 12 / h - spent when the body phase starts, whatever follows; per CLIENT NETWORK `rfq_upload_per_network` 12 / 10 min + 30 / h - counted at admission for every attempt, valid token or not) | multipart `file` (its own filename is never used), `quote_id`, `client_request_id` (UUID), `name?` (text <= 240 bytes: a display name only, cleaned by `rfq_files.display_name`, the extension is ALWAYS the content's) -> `201 {ok, file: {id, name, kind, bytes, at}}` |
| `POST /t/api/rfq/upload/remove` | kind `token_write` (JSON <= 1 KiB) | `{file_id, client_request_id}` -> `200 {ok}` |

Order on the upload: the switch (404) -> read-only grace (409 `read_only`) -> a code-protected link without its session (403
`code_required`) -> one upload in flight per link (429 `busy`) -> the upload memory budget (429 `busy`) -> the installation's 2 GiB cap
(507 `storage_full`) -> the body (strict multipart: unknown / duplicate fields, a file without a filename -> 422 `invalid`) -> the
processing slot -> a replay of the same `client_request_id` answers the stored result (before any decode) -> the link row re-read, the
request still takes quotes from him (`rfq_vendor._open_for_writes`: 409 `rfq_due_passed` / `quote_closed` `{reason: ended | vendor}`)
-> `quote_id` = HIS current submitted quote (any other id - another vendor's, a superseded / withdrawn version, unknown: ONE answer, 409
`quote_closed` `{reason: "vendor"}`) -> the quota with the raw size -> the decode / scan in the public listener's decode slot with
`rfq_files.store(..., allow_webp=False)` (the SAME checks as a manager's file, 19.2: 413 `too_large`, 415 `unsupported_format` (WebP
included) / `heic_refused`, 422 `image_invalid` / `too_many_pixels` / `pdf_invalid` / `pdf_refused` / `office_disabled` / `office_invalid`
/ `office_refused`, 429 `busy`) -> the write transaction re-checks everything (switch, link, request, quote, quota with the STORED size)
before the row; any failure there deletes the stored file and credits the cap.

Limits per vendor per request: **5 live files**, **10 uploads in all** (a removal gives none back), a picture **8 MiB** / a document
**10 MiB** as uploaded, **20 MiB stored in all** (removed files and thumbnails included - they stay on disk until the purge). Refusals:
409 `upload_limit` (`max_files` | `max_uploads`), 413 `upload_total` (`max_bytes`). Pictures are stored as our fresh JPEG + a 480 px
thumbnail (never the upload's bytes); PDF / DOCX / XLSX byte for byte after the structural checks.

Removal: one of HIS live files is MARKED removed (the row and the file stay for the record until the purge; managers see it marked);
any other id - another vendor's, a removed or an unknown file - is 409 `upload_not_found` (never the uniform 404: the page forgets a
link on 404). Same request-state rules as the upload.

**What the vendor sees** (`GET /t/api/rfq`, after the code gate, never on a closed / cancelled page): `uploads: null` (switch off) or
`{files: [{id, name, kind, bytes, at}] (his own live files, text only), limits: {files, uploads, image_bytes, document_bytes, total_bytes,
types (["jpg", "png", "pdf"] + docx / xlsx only while allow_office)}, quote_id (his submitted quote or null), used_bytes, uploads_left,
can: {upload, remove}}`. There is **no public read route** of a vendor file (he has the originals): the vendor never receives one of
these files back, and no vendor ever sees another vendor's file.

**What the managers see** (internal API): the comparison's `quotes[].vendor_files: [{id, name, kind, mime, bytes, width, height, thumb,
quote_id, quote_version, created_at, removed}]` (THAT vendor's files; office files only while allow_office is on); `GET
/tickets/rfqs/{id}/vendor-files/{fid}` and `.../thumb` - the comparison's rule: the request visible (uniform 404 `rfq_not_found`), then
`tickets.costs.view` (audited 403 `costs_permission_missing`, action `ticket.rfq.vendor_file` - a vendor's file is part of his quote and
may carry prices); another request's id, a document's thumbnail, an office file while allow_office is off -> 404 `attachment_not_found`.
Served ALWAYS as a download, a picture too: `Content-Disposition: attachment` (ASCII fallback + RFC 5987 name), the exact type,
`X-Content-Type-Options: nosniff`, `Content-Security-Policy: sandbox`, `Cache-Control: private, no-store`. `meta.vendor_uploads` (bool).
Nothing travels to the work order's reference copy (not built).

Timeline `vendor_file_added` (`{file_id, kind, quote_id}`) / `vendor_file_removed` (`{file_id}`); audit `ticket.rfq.vendor_file_add` /
`.vendor_file_remove` (actor `contact:<id>`, source `rfq_link`; ids + kind only - never a name, a size, a hash). No notification (the
quote's own notification already told the managers); no message to anyone.

## 20. Payment schedule and arrival confirmation (v1.4, CR-RFQ-PAYMENT-SCHEDULE, `pilot/RFQPAY`)

Owner request 2026-10-17; decisions and open questions in `docs/changes/CR-RFQ-PAYMENT-SCHEDULE.md`. Arx NEVER initiates or executes a
payment: it records agreed amounts and dates and checks a payment demand against them. No bank data is accepted or stored anywhere
(unknown keys are refused by `extra = forbid` and by the plan parser).

### 20.1 Switch, settings, migration

* `tickets.settings.rfq.schedule_arrival` (bool, default **false**) and `rfq.arrival_reminder_hours` (0-168, default 24; 0 = no
  reminder), settable through `PUT /tickets/settings` `{revision, rfq: {...}}` (`system.configure`, as every installation key). While the
  switch is off no terms are created, no reminder runs and no answer changes shape except the always-present `null` fields below (terms
  agreed while it was on stay readable and confirmable - a settings change does not withdraw an agreement); every new input
  field is refused with 422 `validation` `{field: "payment" | "arrival", code: "disabled"}` (public: `{code: "invalid", fields: [...]}`), so
  a client never believes it agreed terms the server ignored.
* Migration **0103** (provisional 0105 on `pilot/RFQPAY`, renumbered at the integ/264 integration), additive only: `ticket_quotes.payment_plan_json` (the vendor's
  proposal), `ticket_quotes.payment_schedule_json` (the APPROVED schedule, copied when the award becomes final - it stays with the quote,
  i.e. with the ticket's cost baseline after the work order, even when the request is purged), and `ticket_rfq_award_terms` (one row per
  award created while the switch is on: the schedule while a second approval is pending, the arrival confirmation for the award's life;
  deleted with the award / request - `store_rfq.purge_rfq` deletes it explicitly).

### 20.2 The plan (vendor's proposal, manager's edit) - one wire shape

`payment: {items: [{kind: advance|progress|final, percent?: "30" | "12.5", amount?: "1500.00", due: date|completion|after_completion,
date?: "YYYY-MM-DD", days?: 0..180}]}` - 1..6 items: at most one `advance` and only first; 0..4 `progress`; exactly one `final`, last.
Non-final items: exactly one of `percent` (1-100, at most 2 decimals) / `amount` (money.py decimal string, > 0), `due: "date"` with a
plain day in the installation zone, today .. today + 366, non-decreasing. The final item carries NO share (it is the remainder - the sum
is exact by construction): `completion`, `date` (not before the last instalment's day) or `after_completion` with `days`. The percents
together are <= 100. Refusals name the field: `payment.items`, `payment.items.<i>[.<field>]` with `count`, `final_last`,
`advance_first`, `share_required`, `final_is_remainder`, `range`, `format`, `order`, `exceeds_total`, `invalid`.

Accepted on: `POST /t/api/rfq/quote` (`payment?`), `POST /tickets/rfqs/{id}/vendors/{rv_id}/quotes` (on behalf, `payment?`). Stored
normalised on the quote (`percent_bp` or `amount_minor`). Shown back: the vendor's own `quote.payment` (15.3) and the comparison's
`payment_proposal` (costs.view only) as `{items: [{kind, due, date, days, percent (text) | null, amount_minor | null}]}`.

### 20.3 Approval with the award (the existing flow, incl. partial and split approval)

`POST /tickets/rfqs/{id}/awards` adds `payment?` (20.2: the manager's plan), `payment_source?: "vendor" | "default"` and
`arrival?: {work_from, work_to?}` (the planned window; omitted = the awarded quote's work dates, else the request's wanted window, else
none - the vendor then proposes). Every refusal happens BEFORE the award writes anything (422 `validation`).

The schedule is an EXPLICIT choice whenever the vendor proposed one (v1.4.1, review F1 - silence never approves the counter-party's
figures, so a stale tab or an old client cannot approve his advance):

| Body | Vendor proposed | Result |
|------|-----------------|--------|
| `payment` | either | the manager's plan, source `manager` |
| `payment_source: "vendor"` | yes | his proposal as is, source `vendor` - re-validated now (below) |
| `payment_source: "vendor"` | no | 422 `{field: "payment_source", code: "no_proposal"}` |
| `payment_source: "default"` | either | ONE final instalment on completion, source `default` |
| neither | yes | 422 `{field: "payment", code: "required"}` |
| neither | no | ONE final instalment on completion, source `default` (D7) |
| both | either | 422 `{field: "payment_source", code: "conflict"}` |

`payment_source` while the switch is off is 422 `disabled` like the other fields. Accepting the proposal re-runs the checks an edit
meets: a date before today is 422 `{field: "payment.items.<i>.date", code: "proposal_date_passed"}` (F3), and a proposal that does not
convert on the APPROVED total answers `proposal_exceeds_total` (`payment.items`) / `proposal_zero_amount` (`payment.items.<i>`) (F4).
Every 422 whose field starts with `payment` makes the award dialog open the schedule editor prefilled with the proposal. The dialog
always sends `payment` (edited) or `payment_source: "vendor"` (a proposal exists). The second approver never edits the schedule
(owner decision 2026-10-17): he confirms or declines it as set.

Conversion (integers only, `rounding: "floor_final"`): with T = the award's approved total (minor units, VAT included - the same
`money.compute` figure as `approved_total_minor`), each percent instalment = floor(T x percent_bp / 10000), each fixed amount as given,
the final = T - the others. Refused: the non-final instalments above T (`exceeds_total`, e.g. a fixed advance above a partial
approval), or one that rounds to zero (`zero_amount`). A final of 0 is allowed (100 % in advance). The approved schedule:
`{currency, total_minor, rounding, items: [{index, kind, amount_minor, percent_bp | null, due, date | null, days | null}]}` - the sum of
`amount_minor` is always `total_minor`. A pending second approval keeps it in `ticket_rfq_award_terms` (the second approver sees it, the
vendor sees nothing); a declined award deletes it; the final award copies it to the quote and writes the RFQ timeline row `terms_set`
(`{award_id, items, source: vendor|manager|default}`). Audit `ticket.rfq.award` adds `schedule_source`.

The award's `message_draft` (section 7) gains one sentence asking the vendor to confirm the arrival date and the schedule on the page
(he / en / ar / ru; no amount).

### 20.4 What the vendor sees (`GET /t/api/rfq`, after the code gate)

* `form.payment`: `null` (switch off) or `{max_items: 6, days_max: 180, horizon_days: 366}` - the page then offers the optional block.
* `terms`: `null`, except for the vendor whose APPROVED award has terms (page_state `awarded`): `{schedule: {currency, total_minor, items:
  [{kind, amount_minor, due, date, days}], hash}, arrival: {state: awaiting|proposed|confirmed, planned_from, planned_to, proposed_from,
  proposed_to, rejected (bool), confirmed_at, acknowledged_at}, can: {confirm, propose}}`. `schedule.hash` (v1.4.1, F10) = sha256 hex of the
  stored approved schedule; `acknowledged_at` is non-null only when the acknowledgement was given for THAT content (a changed schedule
  reads as unacknowledged). Amounts are HIS award's only. A vendor that was
  not selected, a pending second approval, a closed request: `terms: null` (nothing tells him an award exists elsewhere).
* `can.confirm` = not read-only, request `awarded` / `ordered`, vendor `awarded`, arrival `awaiting` and a planned date exists;
  `can.propose` = the same with arrival `awaiting` or `proposed`.

### 20.5 The vendor's write - `POST /t/api/rfq/arrival`

`{action: confirm|propose, work_from?, work_to?, acknowledge_schedule: true, schedule_hash?, client_request_id}` - a `token_write` route of the edge,
the 15.4 rules (strict model, replay per link generation, the link re-read inside the transaction, read-only grace 409 `read_only`, no
code session 403 `code_required`, uniform 404). `confirm` takes no dates (422) and needs a planned date (409 `arrival_date_missing`);
`propose` needs `work_from` (`quotes._instant` range rules; `work_to >= work_from`). `acknowledge_schedule` must be `true` (422
`{field: "acknowledge_schedule", code: "required"}`) - both actions record `acknowledged_at` (the first time for a given content) and
`acknowledged_hash` (F10: the acknowledgement is bound to the schedule hash). `schedule_hash` (optional, 64 lowercase hex) is the
`terms.schedule.hash` the page showed: a different value is 409 `terms_changed` and nothing is recorded (he acknowledges only the
current terms; about his own terms only, so no oracle). The public page does not send it yet (no public bundle change in v1.4.1); a
later page version sends it. Every other case - no
approved award with terms for THIS vendor, a pending second approval, a request that ended, an arrival already confirmed - is ONE answer:
409 `arrival_closed`. Answer `200 {ok, terms}` (20.4 shape). Timeline `arrival_confirmed` (`{award_id, by: "vendor", work_from, work_to}`)
or `arrival_proposed` (`{award_id}`); audit `ticket.rfq.vendor_arrival` (actor `contact:<id>`, ids + `arrival_action` - never an amount);
the managers' notification `rfq.arrival` (20.7). A confirmation, when the work order's ticket exists, also writes the ticket timeline row
`rfq_arrival_confirmed` (`{rfq_id, award_id, work_from, work_to}`). A confirmation emits the `rfq.arrival` row and resolves it at once
(F8: the managers are told; nothing waits on them, so nothing stays open in the inbox).

### 20.6 The manager's decision - `POST /tickets/rfqs/{id}/awards/{award_id}/arrival`

`{action: accept|reject, revision (of the terms)}` - an RFQ manager (section 6; audited 403 otherwise; invisible request = uniform 404).
404 `terms_not_found` (no terms or the award is not final), 409 `rfq_stale` (`details.revision`), 409 `arrival_not_proposed`. Accept: the
proposed window becomes the planned one, `confirmed` (`confirmed_by: "manager"`); 409 `arrival_date_passed` when the proposed window
starts before today in the installation zone (F9 - reject it so he proposes again). Reject: back to `awaiting` (`rejected_at`; the vendor
confirms the planned window or proposes again) and - F7 - `reminders` = 0, `reminded_at` / `requested_at` / `escalated_at` cleared.
Nothing is sent by the reject: the terms block then carries `draft` (the award-draft pattern: `{text, lang, notify_default, send: {route,
source: {kind: "award", id}}}`, the vendor's language, no amount or date), offered while the arrival is `awaiting` after a rejection
and no notice was queued since. The manager sends it (editable) with the vendor-message route; with a queued `rfq_update` notice that
restarts the reminder clock. Timeline `arrival_confirmed` / `arrival_rejected`; audit `ticket.rfq.arrival_decide`; the vendor's
`rfq.arrival` notification row is resolved. Answer: the detail.

### 20.7 Detail, timeline, notifications, reminders

* Detail `awards[].terms` (and the award answers' `award.terms`): `null` or `{schedule: {currency, total_minor, rounding, items, source},
  proposal (the vendor's, costs.view only), arrival: {state, planned_from, planned_to, proposed_from, proposed_to, rejected_at,
  confirmed_at, confirmed_by, acknowledged_at, requested_at, reminders, escalated_at}, revision, draft (20.6, managers only, else
  null), can: {decide_arrival}}` - amounts / percents `null`
  without `tickets.costs.view`. `meta.schedule_arrival` (bool) tells the award dialog to offer the fields.
* Timeline kinds: `terms_set`, `arrival_requested` (`{award_id, via: award|order}`), `arrival_reminder`, `arrival_proposed`,
  `arrival_confirmed`, `arrival_rejected` (ids, states, the confirmed dates - never an amount).
* Notification source `rfq.arrival` ("ספק אישר מועד הגעה או הציע מועד אחר" / "Vendor confirmed or proposed an arrival date"), the 16.1
  rules (subject `rfq`, rule `rfq_managers`, info, inbox + push, WhatsApp off), one row per vendor (`rfq:<id>:arrival:<rv_id>`), kinds
  `arrival_confirmed` (resolved at once, F8), `arrival_proposed` (resolved by the decision), `arrival_unconfirmed` (below; resolved by his
  confirmation or a decision), all resolved by close / cancel / delete. Text: the reference + place only.
* The reminder clock starts when the vendor is TOLD (v1.4.1, F6): a thread message with `source: {kind: "award"}` whose `rfq_update`
  notice was actually queued (not `notify: false`, not a manual channel, not without a live link) on a FINAL award (never while it waits
  for the second approval), or the work order's send (`requested_at`, once). The janitor (`costs_retention` -> `rfq.retention` ->
  `rfq_terms.tick`) reminds a vendor whose arrival is still `awaiting` `arrival_reminder_hours` after that, at most twice, spaced by the
  same delay: a thread message (fixed text, vendor's language) + the existing `rfq_update` notice over his live link (existing purpose,
  existing send-hours rules, idempotency key `rfqarr:<award_id>:<n>`). No new outbox purpose. The candidate query (F5) returns only
  actionable rows - fewer than two reminders, the last reminder at least one delay ago, award `approved`, request `awarded` / `ordered`,
  vendor `awarded` - ordered by the longest wait (`COALESCE(reminded_at, requested_at)`), so the `LIMIT 200` batch cannot be filled by
  exhausted or closed rows and starve newer vendors. The thread message is stored as `author_kind: "user"`, `author_id: "system"`
  (F11: the `ticket_rfq_messages.author_kind` CHECK of 0089 allows only `user | contact`; adding `system` needs a table rebuild - deferred
  to the next rebuild of that table; `present_message` renders the author as "system").
* Escalation (owner decision 2026-10-17): still `awaiting` one delay after the SECOND reminder -> one `rfq.arrival` row
  `arrival_unconfirmed` to the RFQ managers (`escalated_at`, once per clock; a reject clears it). The work order is NOT blocked.

### 20.8 The payment demand against the schedule (flag, never refuse)

The cost claim of the order's assignment (the quote is its baseline, DETAIL 4.2) gains `schedule_check` in the managers' full claim
view: `null` without an approved schedule, else `{status: ok|flagged, flags: [currency | above_total | ahead_of_schedule |
before_completion], currency, schedule_total_minor, due_minor, demand_minor, as_of, completed_on, items: [{index, kind, amount_minor, due,
due_date, is_due}]}`. `as_of` = the day the current revision was submitted; an instalment is due on its date, on completion (= the
ticket's `done_at` - ONLY that, v1.4.1 F2), or N days after completion. While `done_at` is NULL (`completed_on: null`) nothing due on /
after completion is due (`due_date: null`). Above the instalments due by `as_of`: `ahead_of_schedule` when the job is done,
`before_completion` while it is not (e.g. the default single final instalment: any demand before the job is marked done). A flagged
submitted demand also sets `needs_review`. Nothing is refused, nothing is sent, no payment is made or scheduled.

### 20.9 Work order

`order_defaults` (18.4) = the confirmed / planned arrival window first, then the 18.2 rule. The order's description block adds
"מועד הגעה: <window> (<state>)" and "לוח תשלומים מאושר: <kind> - <due rule>; ..." - NEVER an amount. Sending the order starts the
reminder clock (20.7). The arrival confirmation does not block the order (owner decision 2026-10-17: an unconfirmed arrival escalates
to the managers, 20.7, and never blocks the order).

### 20.10 Not built (owner item C)

After the arrival is confirmed, a personal access code and the doors / time windows of the work (depends on the WisKey absorption).
Extension point: `rfq_terms.on_arrival_confirmed(conn, row, terms)` - called after every confirmation (vendor or manager accept), does
nothing in this version; it must stay a separate, explicitly approved action (physical access).

## 21. Vendor questions (v1.4, RFQQUESTIONS - owner report 2026-10-17)

Owner report: a vendor's question was not obvious to the manager - it sat in the vendor's private thread (only a timeline row and the
TKRFQ5 notification said so) or, more often, in the quote's free "note" (shown only in the comparison's notes row). v1.4 makes a question
a first-class, visible item. Decisions and open owner questions: `docs/changes/CR-RFQ-QUESTIONS.md`.

### 21.1 Model - migration 0104 (provisional 0106 on `pilot/RFQQUESTIONS`, renumbered at the integ/264 integration)

A question IS an inbound `ticket_rfq_messages` row (`direction = 'in'`: the page's question box, the quote form's own `question` field, or
a WhatsApp reply matched by 16.2 - unverified). Additive columns: `quote_id` (in: the quote it came with), `read_at` / `read_by` (in: first
opened by an RFQ manager - ONE shared state per request), `answered_at` / `answered_by` / `answer_id` (in: answered; `answer_id` NULL =
handled without a reply), `reminded_at` (in: the reminder was raised), `answers_id` (out: the question it answers), `broadcast_id` (out: one
"answer every vendor" act). Partial index on the pending rows. Backfill: an inbound message followed by an outbound message to the same
vendor is answered (and read) by it - the TKRFQ5 resolve rule, now stored. No table rebuild; purge / retention remove them with the
messages (section 12).

States: **pending** = `answered_at IS NULL`; **unread** = pending and `read_at IS NULL`; **answered**. Badges count pending questions only
while the request is open (`sent` / `collecting` / `due_passed`): after an award, a close or a cancel nobody can act on them; the thread
still shows them as never answered.

### 21.2 Reads

* Detail (section 10) adds `questions: {pending, unread, items: [{id, vendor_id, vendor: {name, company}, text, at, read, via: page |
  whatsapp, unverified, quote: {id, version} | null, age_h}]}` (oldest first, the open request's pending questions; removed vendors are
  left out), `vendors[].questions: {pending, unread}`, `can.answer` (= RFQ manager). `vendors[].quote.has_note` (costs.view only, like the
  rest of the quote summary): the vendor wrote a note.
* List summary adds `questions: {pending, unread}`; comparison `quotes[].questions: {pending, unread}`.
* `GET .../vendors/{rv}/messages` items: inbound rows add `question: {state: pending | answered, read, answered_at, answer_id, quote_id}`;
  outbound rows add `answers_id`, `to_all`.
* `GET /tickets/rfqs/questions/summary` (`tickets.view`) -> `{pending, unread, requests}` over the open requests the caller MANAGES
  (section 6 manager rule, `rfq.visible` + `rfq.is_manager`; at most 500 requests scanned) - the navigation badge. A plain viewer gets zeros.

### 21.3 Writes (RFQ manager; visibility first: uniform 404 `rfq_not_found`; then the audited 403)

| Route | Body | Answer | Refusals |
|---|---|---|---|
| `POST /tickets/rfqs/{id}/vendors/{rv}/messages/read` | none | `{read: n}` | 404 `vendor_not_found` |
| `POST /tickets/rfqs/{id}/questions/{mid}/preview` | `{text (<= 2000), scope: vendor \| all = vendor, question_text? (<= 1000, scope all), name_asker: bool = false, notify: bool = true}` | `{question_id, scope, name_asker, recipients: [{vendor_id, vendor, asker, text, lang, notify_channel}]}` - nothing stored | 404 `message_not_found` (another request's, an outbound or an unknown id), 409 `question_answered`, 409 `rfq_invalid_transition` (scope all on a request that is not open; a draft / removed asker), 422 `validation` (`text`, `question_text`, `scope`) |
| `POST /tickets/rfqs/{id}/questions/{mid}/answer` | the preview body + `client_request_id` | 201 `{rfq: detail, answer: {question_id, scope, items: [{vendor_id, message_id, notified}], notified, broadcast_id}, replayed}` (the same `client_request_id` answers the first answer) | as the preview |
| `POST /tickets/rfqs/{id}/questions/{mid}/resolve` | none | the detail | 404 `message_not_found`, 409 `question_answered` |

* **vendor** (the default): one outbound message to the asking vendor (his question sits above it in his thread).
* **all**: the asker gets the answer; every other invited vendor (not `draft` / `removed` / `not_awarded`) gets ONE message of his own:
  `"<frame>: <question as the manager worded it>\n<answer frame>: <answer>"`, the frame in the vendor's language (he / en / ar / ru; ar / ru
  pending a native review); the asker is named (`"שאלה מ<company>"`) only with `name_asker`. The default question text is the vendor's
  own - the manager edits it (e.g. to remove a phone number) before the preview. A vendor never sees another vendor's copy.
* `notify`: per copy, the templated `rfq_update` notice through the existing outbox (live link, ready page, a channel; never the free
  text - section 8); the outbox's send-hours rules apply as for every RFQ message.
* The vendor-message route (section 9) also answers every pending question of that vendor (a `clarify` message, not an award draft).
* `resolve` = handled without a reply (answered by phone): nothing is sent; the vendor page shows no "answered" for it.
* Every write: the timeline row (`question_answered` `{message_id, scope, copies, notified, named}` / `question_resolved` / the per-copy
  `message` rows with `answers`, `broadcast`), audit `ticket.rfq.answer` / `.question_resolve` / `.answer_preview` (denied only) /
  `.question_read` (denied only) - ids, scope, counts; never a text, never a name. The `rfq.question` and `rfq.question_unanswered`
  notifications of that vendor are resolved once he has no pending question.

### 21.4 The vendor page (15.3 / 15.4 / 15.5)

* The quote form has its own optional `question` field (<= 2000, the same text hygiene; the message cap of 30 applies - a refused question
  stores NO quote: every check runs before the first write). Stored as his question with `quote_id`, the `vendor_message` timeline / audit
  rows (ids + the quote id), the `rfq.question` notification. The note stays the quote's note.
* `messages[]` of his own questions add `answered` (an answer was sent to HIM; a question handled by phone stays `false`). Exposure (15.5):
  `messages[].answered` - his own thread, after the code. An answer to every vendor appears in each vendor's thread as an organisation
  message (`mine: false`); it names the asker only when the manager chose it.

### 21.5 The reminder

`rfq.question_reminder_hours` (settings section `rfq`, 0-168, default 24, 0 = off; `PUT /tickets/settings {rfq: {...}}` now accepts the
whole `rfq` section, which had no route before): the cost janitor (`rfq.retention`, every 10 min) raises `rfq.question_unanswered`
("שאלת ספק ממתינה לתשובה", alert, push on, WhatsApp off, recipients `rfq_managers`, one row per vendor `rfq:<id>:qremind:<rv_id>`) ONCE per
question still pending after N hours on an open request, and the timeline row `question_reminder`. Texts: the reference, the place and the
hours - never the text or the vendor. The engine applies each recipient's channels and quiet hours.

## 14. Change log

* v1.4.2 (2026-10-17, `pilot/RFQ-VENDOR-UPLOAD` from `integ/264` @ 5fa03e7a; owner decision 2026-10-17): 19.10 - a vendor's own files
  and pictures on his quote: `POST /t/api/rfq/upload` (edge kind `rfq_upload`, per link and per client network) and `POST
  /t/api/rfq/upload/remove`, behind `rfq.vendor_uploads.enabled` (OFF by default - the uniform 404); the same content checks as 19.2
  (WebP refused on the public side); quotas 5 live / 10 uploads / 8 MiB picture / 10 MiB document / 20 MiB per vendor per request; the
  page's `uploads` block; the comparison's `vendor_files` and the managers' download route `GET /tickets/rfqs/{id}/vendor-files/{fid}[/thumb]`
  (visible + costs.view); meta `vendor_uploads`; migration 0110. **A Fable review of the public surface is required before release.**

* v1.4.1 (2026-10-17, the review fixes merged at integ/264; no new migration file):
  * (2026-10-17, `pilot/RFQPAY-FIX`, review `RELEASE_264_REVIEW_RFQPAY` F1-F11 + the lead's owner answers; merged at integ/264,
    section numbers as renumbered there): 20.3 the explicit schedule choice (`payment_source`, 422 `payment` `required` over a proposal),
    the proposal re-validated at the award (`proposal_date_passed`, `proposal_exceeds_total`, `proposal_zero_amount`); 20.4 / 20.5
    `schedule.hash`, `schedule_hash?`, 409 `terms_changed`, the acknowledgement bound to the content; 20.5 a confirmation's notification
    resolved at once; 20.6 409 `arrival_date_passed`, the reject resets the reminders and offers the `draft` notice; 20.7 the clock only on
    a queued notice and a final award, the actionable candidate query, the escalation after the second reminder (`arrival_unconfirmed`,
    `escalated_at`); 20.8 `before_completion` / `completed_on` (no completion without `done_at`). Migration 0103 (unreleased) gains
    `acknowledged_hash` and `escalated_at` - edited in place, no new migration file.
  * (2026-10-17, RFQATT-FIX, `pilot/RFQATT-FIX` from `pilot/RFQATT`; the Fable review `RELEASE_264_REVIEW_RFQATT.md`): 19.2 - the
    office checks PARSE every XML part (expat, character references decoded, DTDs refused anywhere, every relationship, Word field codes
    joined across runs, every spreadsheet formula location) and allow-list parts by `[Content_Types].xml` (altChunk / MHT / HTML,
    connections, query tables, external pivot caches, Power Query, EMF / WMF / SVG, embedded fonts refused); PDF structure rules (nothing
    after the last `%%EOF`, no ZIP inside) and the office head polyglot rule; the ZIP64 wording; the new installation setting
    `rfq.attachments.allow_office` (OFF by default, 422 `office_disabled`, office files stop travelling while off); the office scan in the
    decode slot; the storage cap's accounting. 19.3 - the role refusal before the form check; meta `attachment_limits.office`. 19.4 / 19.6 -
    edge kind `file_read` for the full files. 19.2 - the `sandbox` CSP is internal-API only (the public edge serves the listener's CSP). No
    migration. The branch named this v1.5; merged as part of v1.4.1. Owner decision (lead, 17.10): `allow_office` default OFF,
    fail-closed (422 `office_disabled`; existing office files stop travelling while off).

* v1.4 (2026-10-17, integration 2.6.4 - one version for four branches built in parallel from `integ/264` @ `75f41b19`; each wrote its
  own "v1.4 section 19", renumbered here: RFQATT = section 19, RFQPAY = section 20, RFQQUESTIONS = section 21; CR-ORG-LOCATIONS adds no
  section; final migrations 0101 org locations, 0102 attachments, 0103 payment schedule, 0104 questions):
  * (2026-10-17, CR-ORG-LOCATIONS, `pilot/ORGLOC`; migration 0101): an RFQ may name an organisation location -
    create / draft edit take `location_id` (an ACTIVE location; `place_text` stays the "other (free text)") and `location_nav`; the row
    keeps `location_id` + `location_snapshot` (JSON taken at creation, never rewritten) + `location_nav` (default 0). `POST .../send`
    takes an optional `location_nav` (the preview dialog's switch). The invitation's `{place}` is `place_text`, else the location's
    "name · street, city" (+ " · <map link>" only when `location_nav`); the new placeholder `{location}` carries the same text and is
    present in `params_json` only when the request names a location. The detail / summary carry `location` (`id`, `name`, `address`,
    `details`, `text`, `message`, `map_url`, `has_coordinates`) and `location_nav`; the vendor page's `rfq.location` = `{text, map_url}`
    after the code gate (`map_url` empty unless switched on). The work order copies the reference and the snapshot to its ticket. See
    `docs/changes/CR-ORG-LOCATIONS.md`.
  * (2026-10-17, RFQATT, `pilot/RFQATT` from `integ/264`): section 19 - files and pictures a manager attaches to a request (pictures
    re-encoded through the image pipeline incl. still WebP for this signed-in route only, PDF / DOCX / XLSX by structural refusal checks and
    served as downloads only), per-file caption and "visible to vendors", the vendor page's files (his own link, the uniform 404 otherwise),
    removal rules (deleted before any quote, marked after), the work order's reference copy, the `{files}` placeholder (a count only), meta
    `attachments` / `attachment_limits`, detail `attachments` / `can.attach`. Migration 0102 (provisional 0104). 15.3 / 15.5 updated (the
    attachments are no longer always `[]`); section 17 marked superseded. Deviation from section 17 (owner request 17.10): Office documents
    (DOCX / XLSX) and WebP are accepted (17 said "no Office types" and the pipeline refused WebP) - see CR-RFQ-ATTACHMENTS.md.
  * (2026-10-17, CR-RFQ-PAYMENT-SCHEDULE, `pilot/RFQPAY` from `integ/264`): section 20 - the vendor's proposed payment schedule on his
    quote, the schedule approved with the award (percents -> exact amounts, floor + remainder to the final instalment), the arrival
    confirmation on the vendor's RFQ link (`POST /t/api/rfq/arrival`), the manager's accept / reject (`POST .../awards/{id}/arrival`), the
    reminder through existing purposes, the `rfq.arrival` notification, the demand's `schedule_check`, the work order's defaults / text.
    Switch `rfq.schedule_arrival` default OFF; migration 0103 (provisional 0105; additive).
  * (2026-10-17, RFQQUESTIONS, `pilot/RFQQUESTIONS` from `integ/264`): section 21 - vendor questions: migration 0104 (provisional 0106;
    question state on `ticket_rfq_messages`), pending / unread counts on the list, the detail, the comparison and a navigation summary, the
    pending items of the detail, read / answer (one vendor or every vendor, preview first, idempotent) / resolve, the quote form's own
    `question` field, `messages[].answered` on the vendor page, the `rfq.question_unanswered` reminder and the `rfq` settings section on the
    settings route. 15.3 / 15.4 amended in place.

* v1.3 (2026-10-16, integration 2.6.4; TKRFQ4 stage C4, built as "v1.2" on `pilot/TKRFQ4` in parallel with TKRFQ5): section 18 - the work order: create (opens one service request per awarded vendor through the
  existing create and external-assignment code, the assignment message suppressed; the awarded quote becomes its baseline with no
  copy; idempotent by `request_key`), the preview of the exact `rfq_order` text and the explicit send (one outbox row; never on the
  create), `ordered` once every approved award has its order, the detail's `awards[].order / ticket / scope / order_defaults / can`,
  the ticket's `rfq_origin`. No migration (an order is derived from the award, the quote's ticket and two timeline rows). Section 12:
  the purge keeps an order's outbox row with its ticket.

* v1.2 (2026-10-16, TKRFQ5, `pilot/TKRFQ5` from `integ/263`): section 16 - the RFQ managers' notifications (`rfq.quote_received`,
  `rfq.declined`, `rfq.question`, `rfq.due_passed`; subject `rfq`, rule `rfq_managers`; no amount, no vendor name, WhatsApp off by
  default) and inbound WhatsApp text replies matched to the vendor's thread (unverified, managers only, never on the vendor page;
  closes the v1.0 residual "inbound replies are not matched to RFQs"); section 17 - attachments designed, not built. 15.3: WhatsApp
  messages are not in the page's `messages`. Manager thread items add `via` / `unverified`. No migration.
* v1.1.1 (2026-10-16, integration 2.6.3, public RFQ review F1-F4 / F6): the open counts only past the code gate (15.3); the fixed
  refusal vocabulary `ended` / `vendor` and the form closed while an award on the vendor is pending (15.3 / 15.4; the public withdraw
  no longer answers `award_pending`); public audit rows carry no amount (section 13 audit line, 15.4); writes re-read the link row
  inside their transaction (15.4); the RFQ code message's footer / e-mail subject uses the RFQ label (F6); the 15.5 exposure table
  completed. F5 (a code switched on for a vendor no channel can reach) is recorded, not fixed.

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
    matcher as today - usually `unknown_sender`). Closed in v1.2 (section 16.2).
* v1.1 (2026-10-16, TKRFQVP): section 15 - the public vendor quote page (routes on the existing public listener, `#q.<token>` URL,
  shared e-mail redeem, optional per-vendor verification code - owner decision: off by default, exposed-fields table), the manager-side
  vendor options (`meta.vendor_options`, `vendors[].channel / require_code`, `POST .../vendors/{rv_id}/options`), `rfq.VENDOR_PAGE = True`,
  additive changes inside the still-provisional 0089 (no new migration number). `form.currency` added after the contract-first push.
