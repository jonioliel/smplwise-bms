# Requests for quotation (RFQ) - backend contract, stage C1 (TKRFQ1)

Status: **v1.4 (section 19 = files and pictures on a request - BUILT on `pilot/RFQATT` from `integ/264`, 2026-10-17, migration 0104
PROVISIONAL; section 16 = the managers' notifications and inbound WhatsApp replies; section 17 = the earlier attachments design, superseded by 19;
section 18 = the work order, stage C4)** - 2026-10-16 / 2026-10-17. v1.0 implemented on `pilot/TKRFQ1-core`; v1.1 on `pilot/TKRFQVP` (from `integ/260`); v1.2 on `pilot/TKRFQ5` (from `integ/263`); section 18 on `pilot/TKRFQ4` (from `integ/263`), combined as v1.3 at the integ/264 integration. Release target 2.6.0. Sources: `private/planning/_mockups/ticket-detail-v3/RFQ_SPEC_DRAFT.md` (sections 1-6 and 9 "Owner decisions 2026-10-16
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
 "messages": [{"id", "mine": true | false, "text", "at"}],
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
| `POST /t/api/rfq/quote` | `{lines[] (kind, description?, hours?, rate?, quantity?, unit_price?, amount? - the ticket quote's line), currency?, amounts_include_vat?, work_from?, work_to?, valid_until?, note?, vendor_ref?, base_version: int \| null, client_request_id}` | 201 `{ok, quote}` (the 15.3 shape) | 409 `rfq_due_passed`, 409 `quote_closed` (`reason`: `ended` \| `vendor`), 409 `quote_changed` (`version` = the current live version; `base_version` must name it, `null` when none), 422 `invalid` (`kind_not_allowed`, money / date fields) |
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
| the files themselves (`GET /t/api/rfq/file/<id>[/thumb]`) | the stored re-encoded JPEG / its thumbnail, or the stored PDF / DOCX / XLSX as a download | the same rule, re-checked per request (19.4) |
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

### 19.1 Migration 0104 (PROVISIONAL number - the lead renumbers at integration; 0101..0103 are free on integ/264)

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
| PDF | `cost_files.check_pdf` (magic, trailer in the last KiB, active-content names incl. inflated streams, encryption refused), at most 10 MiB | byte for byte, never parsed / rendered / thumbnailed | download only: `application/pdf`, `Content-Disposition: attachment` (ASCII fallback name + RFC 5987 `filename*`), nosniff, `Content-Security-Policy: sandbox`, `private, no-store` |
| DOCX / XLSX | `check_office`: a ZIP that starts at byte 0 and ends with its EOCD record (no prepended / appended bytes, no comment, no ZIP64); <= 2000 entries; unique plain names (no absolute, `..`, backslash, drive, NUL; case-folded duplicates refused); no encryption; stored / deflate only; <= 100 MiB uncompressed and <= 100:1 per entry over 1 MiB (a bomb is refused from the directory); exactly one main part (`word/document.xml` / `xl/workbook.xml`) with the macro-FREE content type; at most 10 MiB | byte for byte | download only (as PDF, the exact OOXML type) |
| anything else | - | - | 415 `unsupported_format` (HEIC: `heic_refused`) |

Office refusals (422 `office_refused`): `vbaProject` / `vbaData` / any `macroEnabled` type, ActiveX, `embeddings/` and OLE objects (any
`.bin` except `printerSettings/*.bin`), macro sheets, `externalLinks/` (external workbooks, DDE links), an executable-looking entry name, a
DOCTYPE / ENTITY in any XML part, an EXTERNAL relationship other than a hyperlink (remote templates, frames, OLE / image links), a refused
relationship type (attachedTemplate, oleObject, activeX, vbaProject, frame, subDocument, externalLink, package, control), a DDE field
(`DDEAUTO`, `instrText DDE`, `w:instr="DDE`) and a `|` inside a spreadsheet formula. Inflating for the scans is bounded (100 MiB in all, 32
MiB per part). 422 `office_invalid`: not a well-formed package. As for invoice PDFs, the scans are a FILTER, not a guarantee; the controls
are "never rendered by Arx" and "a download only" (+ the listener's CSP on the public side).

Names: the display name is the last path segment only, NFC, without control / bidi / zero-width / private characters or characters a file
system refuses, <= 100 characters before the extension, Windows device names prefixed, and ALWAYS the extension of what the content is (a
picture called `plan.pdf` becomes `plan.jpg`). Storage uses random names only. Captions: one line, control characters removed, <= 200.

Limits per request (live files): **10 files**, a picture 8 MiB / a document 10 MiB as uploaded, **40 MiB stored in total** (checked
before the decode - the role, the state, a full request - and again inside the write transaction with the stored size), plus the
installation's 2 GiB cap of the tickets file store (507 `storage_full`). The manager route's body cap: `body_limit` row `rfq_attachment`
(10 MiB + the multipart framing). The decode runs outside the database write lock, in a decode slot of its own.

### 19.3 Manager routes (internal, `/api/v1`, RFQ visibility first - the uniform 404 `rfq_not_found`)

| Route | Who | Body / answer |
|---|---|---|
| `POST /tickets/rfqs/{id}/attachments` | RFQ manager (section 6), the request `draft` / `sent` / `collecting` / `due_passed` | multipart `file`, `caption?`, `visible_vendors?` (`true` / `false`, default true) -> 201 the detail + `attachment` |
| `PATCH /tickets/rfqs/{id}/attachments/{aid}` | the same | `{caption?, visible_vendors?}` -> the detail + `changed` |
| `DELETE /tickets/rfqs/{id}/attachments/{aid}` | the same | -> the detail (19.5) |
| `GET /tickets/rfqs/{id}/attachments/{aid}` and `.../thumb` | everyone who sees the request (internal-only and removed files included) | the file (19.2) |
| `GET /tickets/{ticket_id}/rfq-attachments/{aid}` and `.../thumb` | the ticket's viewers (`access.py`) | a request file THAT ticket references (19.6) |

Refusals: audited 403 `forbidden` (`not_manager`, `external_permission_missing`); 404 `attachment_not_found` (another request's id, a
removed file on a write); 409 `attachment_locked` (awarded / ordered / closed / cancelled), `attachment_limit` (`max_files`); 413
`attachment_total` (`max_bytes`), `payload_too_large` (`max_bytes`); 415 `unsupported_format`, `heic_refused`; 422 `image_invalid`,
`too_many_pixels`, `pdf_invalid`, `pdf_refused`, `office_invalid`, `office_refused`, `validation` (`caption`, `visible_vendors`); 429
`busy`; 507 `storage_full`. A refusal never echoes the file's content or name; a pipeline refusal is audited (`decision: denied`, the code).
A write never bumps the request's `revision` (an open form never goes stale for a file) and never sends anything.

Detail (section 10) adds `attachments: [{id, name, caption, kind, mime, bytes, width, height, thumb, visible_vendors, created_at, removed
(+ removed_at for managers)}]` (live files; an RFQ manager also sees the removed ones) and `can.attach`. Meta adds `attachments: true` and
`attachment_limits: {files, image_bytes, document_bytes, total_bytes, caption, types}`. Timeline kinds `attachment_added` (`{attachment_id,
kind, visible_vendors}`), `attachment_changed` (`{attachment_id, fields, visible_vendors?}`), `attachment_removed` (`{attachment_id, kept}`).
Audit `ticket.rfq.attachment_add` / `.attachment_edit` / `.attachment_remove` - ids (and the kind / changed field names / `kept`) only:
never a name, a caption, a hash or a size.

### 19.4 The vendor (public listener)

`GET /t/api/rfq` `rfq.attachments` (15.3 / 15.5). `GET /t/api/rfq/file/<id>` and `GET /t/api/rfq/file/<id>/thumb` (edge kind `photo_read`,
its 120 / min window): the token through `rfq_context()` (one indexed lookup; a ticket token, an unknown / revoked / expired token, a removed
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
only past its code gate, absent when none) and serves them through `GET /t/api/ticket/rfq-file/<id>[/thumb]` (the ticket link's
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

* A vendor's own files on his quote (section 17 direction (b)) and any public upload route.
* Per-vendor file selection (every invited vendor gets the same vendor-visible files; "internal only" is the one switch).
* Re-ordering files; an automatic "new file" notice to vendors when a file is added after the send (the manager may write to them).
* The internal ticket drawer shows the referenced files only through `rfq_origin.attachments` (no new UI block there in this version).
* Server-side antivirus (none exists in the add-on - 19.2's "refuse what cannot be proven simple" instead).

## 14. Change log

* v1.4 (2026-10-17, RFQATT, `pilot/RFQATT` from `integ/264`): section 19 - files and pictures a manager attaches to a request (pictures
  re-encoded through the image pipeline incl. still WebP for this signed-in route only, PDF / DOCX / XLSX by structural refusal checks and
  served as downloads only), per-file caption and "visible to vendors", the vendor page's files (his own link, the uniform 404 otherwise),
  removal rules (deleted before any quote, marked after), the work order's reference copy, the `{files}` placeholder (a count only), meta
  `attachments` / `attachment_limits`, detail `attachments` / `can.attach`. Migration 0104 (PROVISIONAL). 15.3 / 15.5 updated (the
  attachments are no longer always `[]`); section 17 marked superseded. Deviation from section 17 (owner request 17.10): Office documents
  (DOCX / XLSX) and WebP are accepted (17 said "no Office types" and the pipeline refused WebP) - see CR-RFQ-ATTACHMENTS.md.

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
