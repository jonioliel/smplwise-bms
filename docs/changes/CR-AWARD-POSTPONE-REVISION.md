# CR-AWARD-POSTPONE-REVISION - recommendation for the lead (no code; finding A6 of the 2.7.1 review)

**Question.** `rfq_postpone.vendor_postpone` calls `store_rfq.update_rfq(..., {"updated_at": at})` with the default `bump=True`, so a vendor's postponement notice raises the request's `revision` and an open manager form fails with 409 `rfq_stale`. The vendor-file path (`rfq_attach`) and the system write in `rfq_inbound` use `bump=False`. Pick one rule.

**Recommendation: `bump=False` for the postponement notice (the "vendor report" rule).**
1. The notice is a report: the agreed date and every field a manager edits stay as they were (CR-AWARD-NOTICE decision 8). A revision bump is for a change to the request's content (a new quote in `rfq_vendor.py:374`, a terms change in `rfq_terms.py:609`), not for a message about it.
2. Cost of the current rule: a manager typing a long edit loses the form to a notice that did not touch it. Cost of the new rule: none, the notice still moves `updated_at` (list order, the banner), writes the timeline event and notifies the managers.
3. The open notice is protected by its own state, not by the revision: one open notice per award (`postponement_open`), the manager's acknowledge / date-move actions re-read it in their transaction.
4. Rule to write in `RFQ_BACKEND_CONTRACT.md`: "a vendor-originated report (file, postponement) never bumps the revision; a vendor-originated content change (quote, terms) does".
5. Implementation when approved (S, about 1 hour): change line 140 to `bump=False`, flip the comment to "a report: the managers' copies stay valid", add a test that an open edit still saves after a notice (no existing postponement test asserts `rfq_stale`). No migration, no UI change.
