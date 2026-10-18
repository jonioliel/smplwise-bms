-- CR-AWARD-NOTICE (docs/changes/CR-AWARD-NOTICE.md; RFQ contract 20.16 / 20.17): after an award the vendor is told that his quote is
-- APPROVED and BINDING and that he must give notice IN ADVANCE, through his link, if he postpones the work. This table records those
-- notices: the awarded vendor reports, on his own RFQ page, a proposed new date and a short reason. A notice never changes the agreed
-- date by itself (an RFQ manager moves it through the existing arrival-date route, contract 20.14, or acknowledges the notice).
-- The award notice itself needs no column: it is ONE outbox row (purpose `rfq_update`, the code-owned template variant
-- `starter:rfq_award_notice:<lang>`, idempotency key `rfqaward:<award_id>`) + the RFQ timeline row `award_notice`.
-- Migration 0115 (kept its provisional number at the integ/271 integration for 2.7.1). Additive only: one new table, nothing existing is rebuilt.
-- Rollback: run the previous version (the table stays, unread).

CREATE TABLE ticket_rfq_postponements (
  id              TEXT PRIMARY KEY,                    -- 32 lowercase hex
  rfq_id          TEXT NOT NULL REFERENCES ticket_rfqs(id) ON DELETE CASCADE,
  award_id        TEXT NOT NULL REFERENCES ticket_rfq_awards(id) ON DELETE CASCADE,
  rfq_vendor_id   TEXT NOT NULL REFERENCES ticket_rfq_vendors(id) ON DELETE CASCADE,
  link_id         TEXT NOT NULL,                       -- the vendor link the notice came through (plain id: links are pruned)
  proposed_from   TEXT NOT NULL,                       -- UTC instant: the new date the vendor proposes
  proposed_to     TEXT,
  reason          TEXT NOT NULL,                       -- <= 500 characters after text hygiene; never in a log, audit row or notification
  scheduled_from  TEXT,                                -- the date that was scheduled when he gave notice (NULL: none was known)
  lead_seconds    INTEGER,                             -- scheduled_from - created_at (negative = given after the scheduled start);
                                                       -- recorded as a fact (NULL when no date was scheduled)
  late            INTEGER NOT NULL DEFAULT 0 CHECK (late IN (0, 1)),  -- owner decision 2026-10-17: given after the scheduled start or
                                                       -- less than `rfq.postpone_late_hours` before it (frozen at notice time); a tag, never a block
  created_at      TEXT NOT NULL,                       -- when the notice was given
  state           TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'acknowledged', 'rescheduled', 'ended')),
  resolved_at     TEXT,
  resolved_by     TEXT                                 -- users.id of the manager (NULL for `ended`)
);
CREATE INDEX idx_ticket_rfq_postponements_rfq ON ticket_rfq_postponements (rfq_id, created_at);
-- one OPEN notice per award (the second is refused until a manager acted on the first)
CREATE UNIQUE INDEX idx_ticket_rfq_postponements_open ON ticket_rfq_postponements (award_id) WHERE state = 'open';
