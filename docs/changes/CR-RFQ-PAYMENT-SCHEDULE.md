# CR-RFQ-PAYMENT-SCHEDULE - vendor payment schedule and arrival confirmation (RFQ awards)

Status: **implemented on `pilot/RFQPAY`** (cut from `integ/264` @ `75f41b19`), not integrated, not released. Contract:
`docs/tickets/RFQ_BACKEND_CONTRACT.md` v1.4 section 19. Migration **0105 - PROVISIONAL** (the last file on `integ/264` is 0100; the lead
renumbers at integration; additive only). Switch `tickets.settings.rfq.schedule_arrival` - **OFF by default** (an upgrade changes nothing).

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
| D2 | The reminder clock starts when the vendor is **messaged**: the award notice sent through the thread (`source: award`) or the work order's send. Nothing is sent by the award itself (owner rule kept). | "after ... the vendor is messaged". A manager who never messages the vendor gets no automatic messages either. |
| D3 | Reminders reuse the existing `rfq_update` purpose ("there is a new message about your quote" + link) plus a fixed thread message in the vendor's language; at most **two**, spaced by `arrival_reminder_hours`; the send-hours rules apply unchanged. | No outbox rebuild (a new purpose would need the CHECK rebuild of `ticket_outbox`); no free text leaves the system. |
| D4 | The final instalment is always the **remainder** - the vendor and the manager give shares only for the advance / progress instalments. | The exact-sum rule then holds by construction, also after a partial approval. |
| D5 | Rounding `floor_final`: each percent instalment = floor(T x bp / 10000) in agorot, the final takes the remainder (T = approved total incl. VAT). A fixed amount stays fixed; fixed + percents above T is refused (`exceeds_total`); an instalment that rounds to 0 is refused (`zero_amount`); a final of 0 is allowed (100 % advance). | Integers only (money.py); deterministic; documented in contract 19.3. |
| D6 | Percents apply to the **approved** total (after a partial approval), not the quoted total. | The owner: "converted to exact amounts at approval". |
| D7 | No proposal and no edit = **one final instalment on completion** (source `default`), so every award made with the switch on has a schedule to check demands against. | A demand check needs a basis; "on completion" is today's implicit practice. |
| D8 | A pending second approval keeps the schedule in the terms row; the second approver sees it and cannot edit it; a declined award deletes it. The schedule reaches the quote (`payment_schedule_json`) only when the award is final. | One approval path; nothing visible to the vendor before the decision is final (as for the award itself). |
| D9 | The approved schedule is stored on the quote too, so it survives a purge of the request with the ticket's cost baseline (contract 18.5). | The demand check must keep working on an ordered ticket. |
| D10 | Both vendor actions (confirm / propose) require `acknowledge_schedule: true` and record the acknowledgement. | "the vendor acknowledges it together with the arrival date". |
| D11 | Every vendor-side refusal of the arrival route is ONE code, `arrival_closed` (except validation 422s and `arrival_date_missing` when nothing is planned). | The 15.x rule: a vendor who was not selected must not learn from a refusal that someone else was. |
| D12 | The arrival confirmation does **not block** the work order; the order takes the confirmed / planned window as its default and writes the state ("not yet confirmed" / "confirmed") in its description - never an amount. A confirmation after the order adds a timeline row to the order's ticket. | Blocking would be a behaviour change the owner did not ask for; open question Q3. |
| D13 | The demand check is a view-time flag (`schedule_check` + `needs_review`) on the manager's claim card; no notification, no refusal, no payment. One claim per assignment (today's model) is compared with the instalments due by the day it was submitted. | "flagged for the manager, not silently refused"; Arx never pays. |
| D14 | Permissions: the schedule edit is part of the award (`tickets.costs` + view); the arrival decision is an RFQ manager act (section 6); the vendor acts only through his signed link. No new permission. | Owner: reuse the existing checks. |
| D15 | A new notification source `rfq.arrival` (info, inbox + push, WhatsApp off) tells the RFQ managers that a vendor confirmed or proposed a date; one row per vendor, resolved by the decision. | A proposed date needs a decision; the 16.1 pattern. |
| D16 | The switch and the reminder delay are installation settings (`rfq.schedule_arrival`, `rfq.arrival_reminder_hours`), editable in Settings › ניהול השירות › כללי and through `PUT /tickets/settings` (the route had no `rfq` block before - it was added with only these two keys). | Owner: per-installation switch, default OFF. |

## 3. What was built

* Backend: `services/tickets/rfq_terms.py` (plan parser, conversion, terms life cycle, vendor block / actions, manager decision,
  reminders, demand check, order lines, the `on_arrival_confirmed` extension point); hooks in `rfq.py` (on-behalf quote, award, finalize,
  second-approval decline, award message, award draft, detail / comparison / meta, retention tick), `rfq_vendor.py` (vendor quote,
  `form.payment`, `quote.payment`, `terms`), `public_rfq.py` (`payment` on the quote, `POST /t/api/rfq/arrival`), `public_http.py` (the
  route on the edge), `routers/tickets_rfq.py` (`payment` on the on-behalf quote and the award, `arrival` on the award,
  `POST .../awards/{id}/arrival`), `routers/tickets_admin.py` (`rfq` settings block), `rfq_orders.py` (defaults, description, the clock),
  `quotes.demand_view` (`schedule_check`), `rfq_notify` + `notify_sources` (`rfq.arrival`), `settings_doc` (two keys), `store_rfq`
  (terms SQL, purge), migration 0105.
* Vendor page (public bundle, RFQ chunk only): the optional schedule block in the quote form, the terms card with the acknowledgement,
  confirm / propose; he / en / ar / ru (ar / ru: developer translations, pending a native review like the rest of the page).
* Manager screens: the comparison's "proposed payment schedule" row, the award dialog's schedule editor and planned arrival day, the
  board's "arrival date and payment schedule" card with accept / reject, the settings card, the notification source; he / en.
* Docs: contract v1.4 section 19 (+ the 15.5 exposure rows), the user guide (46-tickets_HE.md section 4), this CR.

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

## 6. Open questions for the owner

1. **Several demands per job?** Today one payment demand exists per assignment (after the work). An advance before the work cannot be
   demanded through the system yet - the check compares the single demand with what is due. Should each instalment become its own demand
   (milestones), with its own approval and "paid" mark?
2. **Late payment / overdue instalments:** should Arx remind the managers (notification) when an approved instalment's date passes
   without a "paid" mark? Today nothing happens.
3. **Missed arrival date:** should a vendor who did not confirm (after the two reminders) or did not arrive on the confirmed date
   escalate (a managers' notification, a "stuck" state), and should the work order be blocked until the arrival is confirmed?
4. **Manager changes the planned date after the award** (today: only at the award, or by accepting the vendor's proposal) - needed?
5. **Second approver edits the schedule?** Today the second approver approves or declines it as the first approver set it.
6. **Arrival on the handler page:** after the work order the vendor also has the request's handler link; should the confirmation move
   there (one link) once the ticket page budget allows?
7. **Ticket quotes (a vendor already assigned):** the schedule exists for RFQ awards only. Extend it to the quote on an assigned ticket
   (the ticket page's quote card)?
8. **Access code (item C):** confirm the scope for the WisKey stage - which doors, which time window around the confirmed arrival, who
   approves each code.

## 7. Rollback

Turn the switch off: new quotes / awards carry no schedule again and reminders stop at once; terms already agreed stay readable and
their vendors may still confirm (an agreement is not withdrawn by a settings change). Code rollback: revert the branch's commit;
migration 0105 is additive (two NULL columns and one table; leaving them in place is harmless).
