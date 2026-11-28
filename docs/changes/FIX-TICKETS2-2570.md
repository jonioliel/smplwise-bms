# FIX-TICKETS2-2570

Findings TK2-01..TK2-04 of `docs/review/DEEP-REVIEW-2570-TICKETS.md` (second review pass, base v2.56.0). Re-confirmed at the 2.57 base.

- TK2-01 (medium, money): `costs.adjust` ("approve with correction") built the corrected revision with today's `costs.vat_rate_bp`; the
  dialog previews the rate frozen in the vendor's revision. `costs.draft` gets an optional `vat_rate_bp`; `adjust` passes the base revision's
  rate (same as `approve(exceptional="exclude")`). Dialog preview and approved amount now agree.
- TK2-02 (low): RFQ list. A quiet refresh re-reads as many pages as the viewer loaded (`readPages`), a newest-read guard drops stale pages, and
  while more pages exist a note says the counts / filters / search cover the loaded requests only (new text `loadedOnly`, Hebrew + English).
  Server-side counts were NOT added (would need a count route; additive API left to a later row).
- TK2-03 (low): `ticket-detail.ts` `run`, `uploadFiles`, `sendHandlerMessage` ignore the answer (and the `ticket-changed` event) when another
  ticket is open now; the action itself still counts as done.
- TK2-04 (low): `tickets-overview.ts` `loadSlow` checks the department key before every assignment (rfqs, awarded details, failure flag, handled
  counts, approval count).

New helper `frontend/src/tickets/late-answer.ts`. No look changes, no baselines, no compare page.

Tests: see the report (backend `test_adjust_keeps_the_vat_rate_frozen_in_the_vendors_revision_tk2_01`; frontend
`unit-tickets-late-answer-2570.spec.ts`, node-only: the helpers' behaviour plus source-wiring checks - the screens themselves were not
page-driven).

## Results (runner, slot B)

- TK2-01 test `test_adjust_keeps_the_vat_rate_frozen_in_the_vendors_revision_tk2_01`: BEFORE (costs.py at base) FAILED on
  `adj["vat_rate_bp"] == 1800`; AFTER PASSED. Whole `tests/test_tickets_costs.py` after the fix: 34 passed (the 35th was this test's first
  draft, which sent a forbidden body field; corrected and re-run alone: passed).
- Frontend unit: `unit-tickets-late-answer-2570.spec.ts` + `unit-tickets-rfq.spec.ts`: 29 passed. `tsc --noEmit`: exit 0.
  (The new spec cannot run before the fix: the helper module did not exist.)
- NOT_RUN: page-driven (Playwright page) specs of the three screens; other backend files; pixel / layout specs (no look changed).
