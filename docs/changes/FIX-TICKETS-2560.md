# FIX-TICKETS-2560 - tickets final review (TK-01, TK-02, TK-03)

Findings: `docs/review/DEEP-REVIEW-2560-TICKETS.md` (branch `review/DEEP-2560-TICKETS`). Base: `release/2560-train`.

## TK-01 / TK-03 - an idempotent replay now compares the request body too

- The request log keeps a digest of the request body next to the route, in the existing `ticket_requests.route` column as
  `route#digest` (no migration; a row without a digest - older rows, or callers that send no body such as photo upload - matches any body).
  Helpers: `store_links.route_key / request_match / body_digest`.
- Same key + same body = the first answer (replay). Same key + another body = `409 request_body_changed`. Same key on another route is
  still `409 request_id_reused`.
- Covered: public handler page (status + note, note + ask, ETA, give back), vendor claim page, vendor quote page (same helper, same
  shape), home ticket note (`POST /home/tickets/{id}/notes`).
- Pages: on that 409 the edited part is sent as a NEW request under a fresh key (handler page `withFreshId`, claim page `isBodyChanged`,
  home `sendNote`). The request id of an unchanged retry is still kept (the offline queue is unchanged).
- Test that pinned the old behaviour and was changed on purpose: `test_tickets_public_app.py::test_idempotent_replay_and_reuse_on_another_route`
  (the same id with another text used to replay the first answer). Its test double now passes the body to `Idempotency.run`.

## TK-02 - multi-vendor award with a second approval

- The server is unchanged (it correctly refuses any award after one that waits: `409 award_pending`).
- `splitPlan(sel, threshold, currency)` sends the awards predicted to need a second approval LAST (stable order), so the others are awarded
  first; `finalize` stays on the last.
- When the server still answers `pending_second` before the end: the loop stops, `awardOutcome` reports per vendor awarded / waiting /
  not sent, the unsent selections keep their schedule, arrival and notice choices, and the message says exactly that
  (`awardPartAwarded / awardPartPending / awardPartHeld`, Hebrew + English). Winners' message drafts are offered for the awarded ones only.

## Tests
Backend: `test_tickets_public_app.py`, `test_tickets_s4_public.py` (new `test_tk01_...`), `test_home_ticket_note_idem_2540.py`
(new `test_tk03_...`). Frontend unit: `unit-tickets-rfq.spec.ts` (TK-02), `unit-public-ticket.spec.ts` (TK-01).
No look changed: no pixel baselines.
