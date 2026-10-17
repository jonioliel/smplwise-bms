# CR-AWARD-NOTICE - the award is binding; the vendor gives notice in advance if he postpones

Status: built on `pilot/AWARD-NOTICE` (from `integ/270` @ 4fde337e), 2026-10-17. Contract: `docs/tickets/RFQ_BACKEND_CONTRACT.md` v1.6
sections 20.16 / 20.17 (+ 15.5 `binding`, 13 settings / audit). Migration **0115** (provisional - the lead renumbers at integration).
**A Fable review of the public surface (POST /t/api/rfq/arrival `action: postpone`, the `binding` block of GET /t/api/rfq) is required
before release.**

## Owner request (2026-10-17, Hebrew, meaning)

After a quote is approved, the vendor must receive a message that his quote was APPROVED and is now BINDING, and that it is his
responsibility to notify IN ADVANCE, through the link, if he postpones the work.

## What was there before

* An award never sent anything by itself (contract sections 7 / 8 / 18, owner rule 16.10): the award answer carried an editable free-text
  `message_draft` the manager could send to the vendor's thread (+ the templated `rfq_update` "there is a new message" notice). Nothing
  said "binding", nothing asked for advance notice, and the vendor had no way to report a postponement except a phone call.
* The payment-schedule switch (20.1, OFF by default) gives the vendor an arrival confirmation / "propose another date" on his page - only
  while the switch is on, and as a proposal BEFORE the date is agreed, not as a notice that he will not keep the agreed date.

## Decisions (made here; numbered for the owner's review)

1. **The notice text is fixed and code-owned**, in he / en / ar / ru (ar / ru developer translations, pending a native review), never
   editable in Settings: it is the organisation's commitment wording, not a free text. It travels as a code-owned VARIANT of the existing
   `rfq_update` outbox purpose (the TKSTAFF1 / VPORTAL `template_id` pattern) - so the outbox's link handling, send-hours rules, fallbacks
   and idempotency apply unchanged and no outbox table rebuild (new purpose) is needed. No amount, no date, no phone.
2. **Setting `rfq.award_notice` = `confirm` (default) | `auto` | `off`.** `confirm` keeps the existing rule "an award never sends silently":
   the award dialog shows the exact text with a send tick (ON by default in the UI) and the server sends only when the award request
   carries `award_notice: true` (an older client sends nothing). `auto` sends with every final award (an explicit `false` opts one award
   out). `off` refuses the tick (422, never silently dropped).
3. **A ticked notice that cannot go is refused before the award writes anything** (`confirm` only; 409 `award_notice_unavailable` with the
   reason - the preview already said why). `auto` never blocks an award: the failure is recorded on the timeline.
4. **Second approval**: nothing is sent while the award waits; the first approver's tick is the default of the second approver's confirm,
   who may untick. The notice goes when the award becomes final.
5. **One notice per award** (idempotency key, one timeline row, one audit row); a later "send the approval notice" button exists for a
   final award whose notice did not go (unticked, or unreachable then).
6. **A queued notice starts the arrival-confirmation clock** of the terms (20.7), like an award-sourced thread message (it tells the vendor).
7. **The same sentence on the vendor's page** (`binding.text`): served by the server in his language (the same words as the WhatsApp text,
   "here" instead of "through the link"). This keeps the page's lazy `rfq-page-terms` chunk inside its budget (+~350 B gzip measured with
   esbuild; the `rfq-page` chunk grows by ~7 B: the `binding` check that loads the lazy chunk). Deviation from the brief, which placed the
   page strings in the lazy chunk: only the reason label is there; the sentence would have cost ~350 B more and left no margin.
8. **The postponement notice is a report, not a change**: the vendor gives a proposed new date and a short reason (required, <= 500) on his
   page (`POST /t/api/rfq/arrival` `action: postpone`); the agreed date never moves by itself. The RFQ managers are notified (new source
   `rfq.vendor_postponement`, content-free: the reference and the place only) and the timeline records it. A manager moves the date through
   the existing route 20.14 (which can notify the vendor and re-send the work order) - that closes the notice - or acknowledges it without a
   date change (needed when the payment-schedule switch is off, where 20.14 does not exist).
9. **Lead time recorded as a fact**: `lead_seconds` = the scheduled start - the notice time (negative = given after the start). No
   judgement, no "late" flag (open question 1).
10. **Limits on the public write**: only HIS approved award, after the award is final and before the work is done (the order's request has
   no `done_at`); one OPEN notice per award (DB partial unique index + 409 `postponement_open`); at most 10 per award in its life; the edge's
   per-token write budget (`token_write`, spent only by a stored effect); the link re-read inside the transaction; the uniform 404 for a bad
   token; ONE refusal (`postpone_closed`) for every "not now" so nothing tells a vendor about anyone else's award.
11. **Text hygiene / privacy**: the reason is cleaned (control, bidi, zero-width characters removed), stored only in its row and shown to
   the request's viewers; it never reaches a notification, an audit row, the timeline, the outbox or the vendor's page answer.

## What was built

* Backend: `services/tickets/rfq_award_notice.py` (mode, reachability, preview, send once, later send, `awards[].notice`),
  `services/tickets/rfq_postpone.py` (the vendor's notice, the managers' acknowledge, the 20.14 hook, close / purge),
  `message_templates.CODE_VARIANTS` + `messaging.DbTemplates.pick` (the code-owned variant), `rfq.award` / `rfq.confirm` (the tick, the
  check before writing, the send after the final award), `rfq_notify` (`rfq.vendor_postponement`, keyed `rfqpost:<rfq>:<award>`),
  `notify_sources`, `settings_doc` (`rfq.award_notice`), `store_rfq` (the table, the purge), `public_rfq` (the `postpone` action),
  `rfq_vendor.view` (`binding`), routes in `routers/tickets_rfq.py` (preview, later send, acknowledge, the confirm body).
* Migration `0115_rfq_vendor_postponements.sql` (additive).
* Manager UI: the award dialog's notice block (exact text, tick ON by default / "do not send this time" in auto), the request's award banner
  (notice sent / not sent + "send the approval notice"), the open postponement banner (proposed date, the scheduled date, the lead time,
  the reason, "mark handled", the hint to move the arrival date), the timeline lines, the settings row (confirm / auto / off), the
  notification label.
* Vendor page (`rfq-page-terms` lazy chunk): the binding sentence, his open notice, the notice form (a day + a reason).

## Tests

`smplwise_vms/backend/tests/test_tickets_rfq_award_notice.py` (negative first: bad tokens, before award, not awarded, pending second, done,
invalid input, foreign fields, replay, second open notice, the write budget, the lifetime cap; then the flows), the existing RFQ suites,
the frontend `tsc` and node-only unit specs. Not run here: Playwright evidence / screenshots, the add-on build and its bundle-budget test
(the runner was busy with a release gate) - the chunk deltas above are esbuild measurements, not the built bundle.

## Open questions for the owner

1. **Late notices**: should a notice given less than N hours before the scheduled start (or after it) be flagged to the managers (a
   stronger notification, a chip, a report)? Built: the lead time is stored and shown, nothing is judged.
2. **Default mode**: `confirm` (the tick, ON by default) keeps "an award never sends silently". Should new installations default to `auto`?
3. **auto and the opt-out**: in `auto` an explicit `award_notice: false` skips one award (the dialog shows "do not send this time"). Keep it,
   or make `auto` absolute?
4. **Link lifetime**: the vendor's RFQ link expires `rfq.link_keep_days` (default 30) after the quote deadline; a job scheduled later than
   that leaves him without the page to give notice (the same limit applies to the arrival confirmation of 20.5). Extend the awarded
   vendor's link to the work window, or move the notice to the work order's handler page?
5. **Second approval**: should the second approver always be shown the notice block (built: his confirm uses the first approver's tick
   unless he sends `award_notice`), or should the notice wait for an explicit tick from him?
6. **Native review** of the ar / ru texts (the WhatsApp variant and the page sentence).
7. **The postponement while the payment-schedule switch is off**: the manager can only acknowledge (there is no arrival date route); should
   an acknowledged notice also move the work order's window / offer a re-send of the order?
