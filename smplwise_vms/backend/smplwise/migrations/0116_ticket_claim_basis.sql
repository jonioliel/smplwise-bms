-- CR-CLAIM-PREFILL (owner request 2026-10-17): a vendor's payment demand is pre-filled from the approved quote of his work order; what the
-- demand was compared with is stored on each revision so the managers' claim view can say "differs from the approved quote" later.
-- Migration 0116 (provisional 0115 on pilot/CLAIM-PREFILL; renumbered at the integ/271 integration for 2.7.1 - 0115 went to CR-AWARD-NOTICE).
-- Additive only: one nullable JSON column, an older build ignores it. Shape (claim_prefill.basis):
--   {"quote_id", "basis": "total" | "instalment", "instalment_index": int | null, "basis_minor": int, "above_reason": text | null}
-- NULL = no approved quote when the revision was written (or written before this migration). Never bank data: the column carries ids,
-- an amount copied from the approved quote / schedule (never from the client) and the vendor's short reason (text hygiene, <= 500).
ALTER TABLE ticket_cost_revisions ADD COLUMN basis_json TEXT;
