# CR-RFQ-PAYMENT-SCHEDULE - vendor payment schedule and arrival confirmation (RFQ awards)

Status: **RFQPAY2 follow-up (section 8: a demand per instalment, the overdue notification, a moved instalment date) on `pilot/RFQPAY2`,
migration 0110 (provisional 0112 on the branch), merged at integ/270 (2.7.0).** Base: **implemented on `pilot/RFQPAY`** (cut from `integ/264` @ `75f41b19`), merged into `integ/264` (2.6.4), not released. Contract:
`docs/tickets/RFQ_BACKEND_CONTRACT.md` v1.4 section 20. Migration **0103** (provisional 0105 on the branch,
renumbered at the integ/264 integration; additive only). Switch `tickets.settings.rfq.schedule_arrival` - **OFF by default** (an upgrade changes nothing).

## 1. Owner request (2026-10-17, Hebrew intent, summarised)

* (A) After a quote is approved and the vendor is messaged, the vendor CONFIRMS through his personal link that he will arrive on a
  specific date (confirm the planned date/window, or propose another that a manager approves or rejects). The confirmation becomes part of
  the work-order request and the timeline. Reminders when he does not confirm within a configurable time (default 24 h), using the
  existing reminder / send-hours rules.
* (B) Payment schedule: with his quote the vendor may ask for an advance (fixed amount or percent) and propose payment dates for each
  instalment (advance, optional progress instalments, final). The final may be on completion, on a later date, or N days after
  completion. The approver reviews and approves the dates with the award (accept as proposed or edit), incl. partial / split approval.
  The approved schedule is stored with the award, shown to the vendor and acknowledged by him together with the arrival date. Instalments
  sum exactly to the approved total (VAT as in the quote model); percents become exact amounts at approval; the rounding rule is
  documented. The payment-demand flow checks a demand against the schedule and FLAGS (never silently refuses) a demand outside it.
* (C) FUTURE, not built: after the arrival is confirmed, a personal access code and the doors / time windows of the work (WisKey).

## 2. Decisions taken in this implementation

| # | Decision | Why |
|---|----------|-----|
| D1 | The vendor confirms on his **RFQ quote link** (the same page where he quoted and where "your quote was selected" shows), not on the work order's handler page. | The RFQ link exists right after the award (the work order is a later, separate manager act); the page already shows his approved part. It also keeps the code out of the ticket page bundle (61 KB gzip budget, ~0.7 KB headroom). |
| D2 | The reminder clock starts when the vendor is **told**: the award notice sent through the thread (`source: award`) whose `rfq_update` notice was actually queued, on a final award, or the work order's send. Nothing is sent by the award itself (owner rule kept). (Narrowed in v1.4.1, review F6: not with `notify: false`, a manual channel, no live link, or a pending second approval.) | "after ... the vendor is messaged". A manager who never messages the vendor gets no automatic messages either; the first thing the vendor hears is never the reminder. |
| D3 | Reminders reuse the existing `rfq_update` purpose ("there is a new message about your quote" + link) plus a fixed thread message in the vendor's language; at most **two**, spaced by `arrival_reminder_hours`; the send-hours rules apply unchanged. | No outbox rebuild (a new purpose would need the CHECK rebuild of `ticket_outbox`); no free text leaves the system. |
| D4 | The final instalment is always the **remainder** - the vendor and the manager give shares only for the advance / progress instalments. | The exact-sum rule then holds by construction, also after a partial approval. |
| D5 | Rounding `floor_final`: each percent instalment = floor(T x bp / 10000) in agorot, the final takes the remainder (T = approved total incl. VAT). A fixed amount stays fixed; fixed + percents above T is refused (`exceeds_total`); an instalment that rounds to 0 is refused (`zero_amount`); a final of 0 is allowed (100 % advance). | Integers only (money.py); deterministic; documented in contract 20.3. |
| D6 | Percents apply to the **approved** total (after a partial approval), not the quoted total. | The owner: "converted to exact amounts at approval". |
| D7 | No proposal and no edit = **one final instalment on completion** (source `default`), so every award made with the switch on has a schedule to check demands against. When the vendor DID propose, the award must carry an explicit choice (D17). | A demand check needs a basis; "on completion" is today's implicit practice. |
| D8 | A pending second approval keeps the schedule in the terms row; the second approver sees it and cannot edit it; a declined award deletes it. The schedule reaches the quote (`payment_schedule_json`) only when the award is final. | One approval path; nothing visible to the vendor before the decision is final (as for the award itself). |
| D9 | The approved schedule is stored on the quote too, so it survives a purge of the request with the ticket's cost baseline (contract 18.5). | The demand check must keep working on an ordered ticket. |
| D10 | Both vendor actions (confirm / propose) require `acknowledge_schedule: true` and record the acknowledgement. | "the vendor acknowledges it together with the arrival date". |
| D11 | Every vendor-side refusal of the arrival route is ONE code, `arrival_closed` (except validation 422s and `arrival_date_missing` when nothing is planned). | The 15.x rule: a vendor who was not selected must not learn from a refusal that someone else was. |
| D12 | The arrival confirmation does **not block** the work order; the order takes the confirmed / planned window as its default and writes the state ("not yet confirmed" / "confirmed") in its description - never an amount. A confirmation after the order adds a timeline row to the order's ticket. | Blocking would be a behaviour change the owner did not ask for; open question Q3. |
| D13 | The demand check is a view-time flag (`schedule_check` + `needs_review`) on the manager's claim card; no notification, no refusal, no payment. One claim per assignment (today's model) is compared with the instalments due by the day it was submitted. | "flagged for the manager, not silently refused"; Arx never pays. |
| D14 | Permissions: the schedule edit is part of the award (`tickets.costs` + view); the arrival decision is an RFQ manager act (section 6); the vendor acts only through his signed link. No new permission. | Owner: reuse the existing checks. |
| D15 | A new notification source `rfq.arrival` (info, inbox + push, WhatsApp off) tells the RFQ managers that a vendor confirmed or proposed a date; one row per vendor, resolved by the decision. | A proposed date needs a decision; the 16.1 pattern. |
| D17 | (v1.4.1, review F1, lead's design decision) Over a vendor proposal the award body MUST carry `payment` (the manager's plan) or `payment_source` (`vendor` = accept the proposal as is, `default` = one final instalment); omission is 422 `{field: "payment", code: "required"}`. The award dialog always sends the explicit choice. Accepting the proposal re-validates it (F3: a past date -> `proposal_date_passed`; F4: not convertible on the approved total -> `proposal_exceeds_total` / `proposal_zero_amount`), and any `payment*` refusal opens the editor prefilled. | A stale tab, a script or an old client must never approve the counter-party's advance by silence. |
| D18 | (v1.4.1, F2) The job is complete only when the ticket's `done_at` is set. Before that, instalments due on / after completion are not due, and a demand above the dated instalments is flagged `before_completion` (sets `needs_review`). | The claim's creation day is not the completion; with the default schedule every early demand was `ok`. |
| D19 | (v1.4.1, F7) A rejected proposal resets the reminder count and clock, and the terms block offers an editable notice (`draft`, the award-draft pattern). The manager sends it explicitly (thread + the existing `rfq_update`), which restarts the clock; nothing is auto-sent. | The vendor learns of the rejection without a new purpose; his reminders may already have been spent before he proposed. |
| D20 | (v1.4.1, F8 / F9 / F10) A confirmation's `rfq.arrival` row is resolved at once; a manager cannot accept a proposed window that starts before today (409 `arrival_date_passed`); the acknowledgement is bound to the sha256 of the approved schedule (`acknowledged_hash`; optional `schedule_hash` echo -> 409 `terms_changed`; a changed schedule reads as unacknowledged). | No stale inbox rows; no past dates in the order; an acknowledgement means "these terms". |
| D21 | (v1.4.1, F11 - recorded, not fixed) The reminder's thread message stays `author_kind: "user"`, `author_id: "system"`: the 0089 CHECK allows only `user | contact`, and adding `system` needs a rebuild of `ticket_rfq_messages` - deferred to the next rebuild of that table. `present_message` shows the author as "system"; no lookup fails. | A table rebuild for one label is not worth a migration now. |
| D16 | The switch and the reminder delay are installation settings (`rfq.schedule_arrival`, `rfq.arrival_reminder_hours`), editable in Settings › ניהול השירות › כללי and through `PUT /tickets/settings` (the route had no `rfq` block before - it was added with only these two keys). | Owner: per-installation switch, default OFF. |

## 3. What was built

* Backend: `services/tickets/rfq_terms.py` (plan parser, conversion, terms life cycle, vendor block / actions, manager decision,
  reminders, demand check, order lines, the `on_arrival_confirmed` extension point); hooks in `rfq.py` (on-behalf quote, award, finalize,
  second-approval decline, award message, award draft, detail / comparison / meta, retention tick), `rfq_vendor.py` (vendor quote,
  `form.payment`, `quote.payment`, `terms`), `public_rfq.py` (`payment` on the quote, `POST /t/api/rfq/arrival`), `public_http.py` (the
  route on the edge), `routers/tickets_rfq.py` (`payment` on the on-behalf quote and the award, `arrival` on the award,
  `POST .../awards/{id}/arrival`), `routers/tickets_admin.py` (`rfq` settings block), `rfq_orders.py` (defaults, description, the clock),
  `quotes.demand_view` (`schedule_check`), `rfq_notify` + `notify_sources` (`rfq.arrival`), `settings_doc` (two keys), `store_rfq`
  (terms SQL, purge), migration 0103.
* Vendor page (public bundle, RFQ chunk only): the optional schedule block in the quote form, the terms card with the acknowledgement,
  confirm / propose; he / en / ar / ru (ar / ru: developer translations, pending a native review like the rest of the page).
* Manager screens: the comparison's "proposed payment schedule" row, the award dialog's schedule editor and planned arrival day, the
  board's "arrival date and payment schedule" card with accept / reject, the settings card, the notification source; he / en.
* Docs: contract v1.4 section 20 (+ the 15.5 exposure rows), the user guide (46-tickets_HE.md section 4), this CR.

## 4. Bundle budgets (measured with the guard's method: gzip of each js/css file, `rfq-page*` apart)

| Bundle | Before (integ/264) | After | Budget |
|--------|-------------------:|------:|-------:|
| ticket page (all js/css except `rfq-page*`) | 61,775 B | 61,798 B | 62,464 B (61 KB) |
| RFQ chunk `rfq-page-*` | 14,830 B | 19,110 B | 20,480 B (20 KB) |

The terms code lives in `rfq-page-terms.ts`, which Rollup folds into the `rfq-page` chunk (statically imported by the RFQ page only). No
CSS was added (the single style sheet counts against the ticket budget): existing `swc-*` / `rfq-*` classes only. Measured on a local
build into the scratch directory; `smplwise_vms/www-public` was NOT rebuilt or committed.

## 5. Security notes (public surface)

* New public route `POST /t/api/rfq/arrival` (`token_write`): the existing link resolution, uniform 404, write budget, code gate, replay,
  in-transaction link re-check; strict body; one refusal code for every "not now".
* New public fields after the code gate only: `form.payment` (constants), `quote.payment` (his own proposal), `terms` (his own approved
  award). Never another vendor's data, the comparison, the threshold or who decided. Public audit rows carry ids and the action only.
* No bank data: the plan parser and the strict models refuse unknown keys (a test sends an `iban` key and is refused).
* Physical access (item C) is NOT wired: the extension point does nothing.

## 6. Owner questions - answered by the lead (2026-10-17) and still open

Answered (lead, on the owner's behalf, 2026-10-17):

1. **Several demands per job** -> instalments as separate demands: **BUILT in RFQPAY2 (section 8, contract 20.11)**; originally YES, **LATER** (a future change; today one demand per assignment is
   checked against what is due, with `before_completion` / `ahead_of_schedule` flags).
2. **Overdue instalments** -> notify the managers when an approved instalment's date passes unpaid: **BUILT in RFQPAY2 (section 8,
   contract 20.12)**; originally **YES - recorded, NOT built in v1.4.1.** Why not small: "paid" exists only on the single claim per assignment (`ticket_cost_claims.status = paid`), so "this
   instalment is unpaid" has no data until instalments become separate demands (answer 1); a correct version needs a new notification
   source (the settings matrix, labels, the `costs` audience), a janitor scan over `ticket_quotes.payment_schedule_json` with one
   dedupe key per instalment, and a rule for partial payment. Proposed design for the follow-up: source `rfq.instalment_overdue` (alert,
   audience `costs`, resolves), emitted by the costs janitor for each dated instalment whose date passed while the assignment's claim is
   not `paid`; resolved by mark-paid; built together with answer 1.
3. **Unconfirmed arrival after the two reminders** -> escalate to the managers, do NOT block the work order: **built in v1.4.1** (one
   `rfq.arrival` row `arrival_unconfirmed`, `escalated_at`, contract 20.7). A missed arrival on the confirmed date is not detected (no
   arrival signal exists yet; item C / the handler page would give one).
4. **Manager changes the planned date after the award (with a timeline row)** -> the owner's approval (2026-10-17) is for the planned
   date of an INSTALMENT: **BUILT in RFQPAY2 (section 8, contract 20.13)**. Moving the ARRIVAL date after the award is still not built
   (the analysis below stays valid for it). Originally: YES if small: **recorded, NOT built in v1.4.1.** Why:
   it reopens the confirmation state machine (a confirmed arrival goes back to `awaiting`, the reminders and the escalation restart, the
   order's ticket needs its own timeline row, the vendor needs a notice with its own draft text, and an order already sent carries the
   old window), plus a manager UI on the terms card - not small enough to add safely beside the review fixes. Proposed design: `action:
   "reschedule"` with `{work_from, work_to?}` on the 20.6 route, timeline `arrival_rescheduled`, the 20.6 `draft` pattern for the notice,
   the schedule hash unchanged (the acknowledgement of the payment terms stays valid; the date needs a new confirmation).
5. **Second approver edits the schedule** -> **NO**: he confirms or declines it as the first approver set it (unchanged behaviour).

Still open:

6. **Arrival on the handler page:** after the work order the vendor also has the request's handler link; should the confirmation move
   there (one link) once the ticket page budget allows?
7. **Ticket quotes (a vendor already assigned):** the schedule exists for RFQ awards only. Extend it to the quote on an assigned ticket
   (the ticket page's quote card)?
8. **Access code (item C):** confirm the scope for the WisKey stage - which doors, which time window around the confirmed arrival, who
   approves each code.

## 6a. Review fixes (v1.4.1, `pilot/RFQPAY-FIX`, review `private/planning/RELEASE_264_REVIEW_RFQPAY.md`)

| Finding | Fix |
|---------|-----|
| F1 (P2) silence approved the vendor's proposal | D17: explicit `payment` / `payment_source`; 422 `payment` `required`; the dialog always sends the choice |
| F2 (P2) an unfinished job counted as completed | D18: `done_at` only; `before_completion` + `completed_on` |
| F3 stored proposal dates not re-checked | `proposal_date_passed` on `payment.items.<i>.date`; the editor opens |
| F4 non-convertible proposal = generic error | `proposal_exceeds_total` / `proposal_zero_amount`; the editor opens on any `payment*` 422 |
| F5 reminder query could starve newer vendors | only actionable rows in SQL (reminders < 2, spacing, award / request / vendor state), oldest wait first |
| F6 clock started on an untold vendor | only a queued `rfq_update` on a final award (or the order's send) |
| F7 silent rejection, spent reminders | reminders and clock reset; the `draft` notice, sent only by the manager |
| F8 a confirmation's row stayed open | resolved at once on confirmation (and on a decision, as before) |
| F9 accepting a past window | 409 `arrival_date_passed` |
| F10 acknowledgement bound to nothing | `acknowledged_hash` (sha256 of the schedule), optional `schedule_hash`, 409 `terms_changed` |
| F11 system message as `author_kind: user` | recorded (D21) - needs a table rebuild |

Migration: 0103 (provisional 0105 on the branch; unreleased) is edited in place - two nullable columns `acknowledged_hash`, `escalated_at` on
`ticket_rfq_award_terms`; no new migration file. A database that already ran the previous 0103 / 0105 text (a developer's scratch database
only - the branch was never released) must be recreated. No public bundle file was touched (server-side fixes only); the managers'
screens changed (`rfq-compare.ts`, `rfq-terms.ts`, `rfq-text.ts`, `rfq-model.ts`, `api/tickets-rfq.ts`).

## 8. RFQPAY2 - the three items approved after v1.4.1 (owner approval 2026-10-17, `pilot/RFQPAY2` from `integ/264`, contract v1.5)

The owner approved answers 1, 2 and 4 of section 6 (previously "recorded, not built"). Contract 20.11 - 20.13; migration **0110**
(provisional, additive: table `ticket_rfq_instalment_demands` + column `ticket_rfq_award_terms.overdue_key`).

| # | Decision | Why |
|---|----------|-----|
| E1 | A separate payment demand per instalment is its OWN record (`ticket_rfq_instalment_demands`, one per quote + instalment index), not a second 0083 cost claim. | `ticket_cost_claims.assignment_id` is UNIQUE; allowing several claims per assignment means rebuilding that table and every "one claim per assignment" read (vendor portal, cost status, claim window). The 20.8 check of the vendor's claim is unchanged. |
| E2 | The demand is created only by a manager's click on the schedule row; `create` is idempotent (an open / paid demand is returned unchanged, a cancelled one is reopened); `paid` records a payment made outside Arx; `cancel` withdraws it. Amount and due day are copied from the approved schedule, never from the client. | Owner: manual, idempotent, never automatic. Arx never pays. |
| E3 | Permission: tickets.costs + view (the award's own rule) for demand actions and the date move; the request awarded / ordered / closed (a closed request still owes its vendor; a cancelled one does not). | "requires costs-manage permission"; payments outlive the quote collection. |
| E4 | Overdue = due day strictly before today (installation zone), amount above 0, no demand marked paid. A cancelled demand does NOT settle the instalment; moving the date later or marking it paid does. | A withdrawn demand does not mean the money is no longer owed. |
| E5 | One `rfq.instalment_overdue` row per award, raised again only when a NEW instalment becomes overdue (the set lives in `overdue_key`, written without a revision bump), keyed `rfqpay:<rfq>:<award>` outside `rfq:<id>:`; audience costs (RFQ managers with tickets.costs.view); text = reference + place + a count. | No inbox spam on every janitor pass; the close of the request or a later award must not silence a payment that is due; ids / counts only. |
| E6 | A moved date is stored inside the schedule JSON (`agreed_date` on the first move, `date_changed_at`); the schedule hash reads the agreed day, so the vendor's acknowledgement stays valid; the vendor sees `date_changed: true` (never the agreed day or the reason); nothing is sent to him. | The manager's unilateral record must not silently "un-acknowledge" the terms (the vendor cannot re-acknowledge once his arrival is confirmed); the owner asked for a visible marker, not a message. |
| E7 | Only dated instalments move, in order with the others, today .. today + 366; never one marked paid; the quote's copy and an open demand's due day follow. | The same rules as the plan (20.2); the demand check and the overdue scan read the moved day. |
| E8 | The vendor-page marker text lives in `rfq-page-terms.ts` (its own lazy chunk), not in `rfq-text.ts`. | The `rfq-page` chunk has ~120 B of its 20 KB budget left; the terms chunk has its own 3 KB cap. |

Owner decisions on the RFQPAY2 open questions (2026-10-17, second commit on `pilot/RFQPAY2`; contract 20.12 - 20.14):

| # | Decision | Why |
|---|----------|-----|
| E9 | A moved instalment date: the MANAGER chooses whether the vendor is told - "notify the vendor" tick (default OFF) with the editable preview (`terms.notice`, his language); sent in the same act through the F7 / vendor-message path (thread + the templated `rfq_update`, send hours, `rfqmsg:<id>` idempotency). A text without the tick is refused, never dropped. The tick also needs the RFQ manager rule (who may message the vendor). | Owner answer to Q9 (was "nothing is sent"); no free text outside; the vendor-message permission is not widened by the costs permission. |
| E10 | The ARRIVAL window can be moved after the award (tickets.costs + view, audited, reason optional, revision, today .. today + 366, refused once the work is marked done), same notice mechanism. `awaiting` stays, a pending proposal is superseded, `confirmed` stays confirmed by the manager. The vendor page shows "date changed". | Owner answer to Q5 (previously "not built"); re-opening the confirmation state machine for a confirmed date was not asked for - the vendor can still message / the manager can notify him. |
| E11 | The overdue reminder repeats only every `rfq.instalment_reminder_hours` (default 24, 0 = once; 0-168) while the same instalments stay overdue; a NEW overdue instalment always notifies. `overdue_notified_at` per award. | Owner: the reminder must not be annoying. |
| E12 | (third commit) After a date change the manager may re-send the ALREADY-SENT work order - tick "send the updated work order" (default OFF), preview = the existing order preview rendered with the new window; checked before any write (the order rule, sent, not done / closed, link + channel); the existing `rfq_order` send path (`_enqueue_order`, shared with the first send), one message per change (`...:re<terms revision>`); the request's description lines are updated where they still stand verbatim. | Owner answer to Q13; reuse the send path; never a second copy of its logic; the first send stays the order card's. |

Kept as built (owner): closed requests keep working until a cancel (Q3); no Costs-tab display (Q11); the separate demand record (Q1);
no "waived" status (Q12); a confirmed arrival moved by the manager stays confirmed (E10); the settings field he / en only; no "paid"
display for the vendor (Q10 - closed). Migration 0110 was edited in place (unreleased): + `arrival_changed_at`, `overdue_notified_at`.

Bundle budgets (measured with the guard's method on a local build into the scratch directory, `www-public` NOT rebuilt): see the
report of each commit - the vendor marker stays in the lazy `rfq-page-terms` chunk (3 KB cap).

Still open after RFQPAY2: none from this CR's owner questions (Q10 no, Q13 built as E12). TKGATEFIX8 (gate #2 of 2.7.0): a re-send
rewrites the order block's generated lines by their LABEL (a verbatim match missed a line written before an earlier move without a
re-send); a line whose label the manager changed is left alone. The tests' "today" is the installation's (Asia/Jerusalem), not the
machine's (the Etc/UTC runner is a day behind between the installation's midnight and 24:00 UTC).

## 7. Rollback

Turn the switch off: new quotes / awards carry no schedule again and reminders stop at once; terms already agreed stay readable and
their vendors may still confirm (an agreement is not withdrawn by a settings change). Code rollback: revert the branch's commit;
migration 0103 is additive (two NULL columns and one table; leaving them in place is harmless).
