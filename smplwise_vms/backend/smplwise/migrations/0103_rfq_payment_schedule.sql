-- CR-RFQ-PAYMENT-SCHEDULE (docs/changes/CR-RFQ-PAYMENT-SCHEDULE.md; RFQ contract section 20): the vendor's proposed payment
-- schedule on a quote, the APPROVED schedule on the awarded quote, and the arrival confirmation of an award.
-- Migration 0103 (provisional 0105 on pilot/RFQPAY, confirmed at the integ/264 integration).
--
-- Additive only (two nullable columns, one new table + index); nothing is rebuilt and nothing existing is rewritten. Nothing is read
-- while the installation switch `tickets.settings.rfq.schedule_arrival` is off (default OFF): an upgrade changes no behaviour.
-- Money: integers in minor units, VAT included (the award's approved total); Arx never initiates or executes a payment - it records
-- the agreed dates and amounts and checks a payment demand against them. No bank data is ever stored (amounts and dates only).
-- Rollback: additive (the columns stay NULL, the table empty).

-- The vendor's proposal as he sent it (normalised JSON: kinds, percent / fixed amount, due rule) - NULL = no proposal.
ALTER TABLE ticket_quotes ADD COLUMN payment_plan_json TEXT;
-- The schedule APPROVED with the award (exact amounts summing to approved_total_minor) - copied here when the award becomes final, so
-- the schedule stays with the quote (the ticket's cost baseline after the work order) even when the request is purged (section 18.5).
ALTER TABLE ticket_quotes ADD COLUMN payment_schedule_json TEXT;

-- One row per award created while the switch is on. The schedule waits here during a pending second approval; the arrival
-- confirmation lives here for the life of the award. Deleted with the award / the request (ON DELETE CASCADE + store_rfq.purge_rfq).
CREATE TABLE ticket_rfq_award_terms (
  award_id         TEXT PRIMARY KEY REFERENCES ticket_rfq_awards(id) ON DELETE CASCADE,
  rfq_id           TEXT NOT NULL REFERENCES ticket_rfqs(id) ON DELETE CASCADE,
  rfq_vendor_id    TEXT NOT NULL REFERENCES ticket_rfq_vendors(id) ON DELETE CASCADE,
  currency         TEXT NOT NULL,
  total_minor      INTEGER NOT NULL CHECK (total_minor >= 0),
  schedule_json    TEXT NOT NULL,
  schedule_source  TEXT NOT NULL CHECK (schedule_source IN ('vendor', 'manager', 'default')),
  arrival_state    TEXT NOT NULL CHECK (arrival_state IN ('awaiting', 'proposed', 'confirmed')),
  planned_from     TEXT,
  planned_to       TEXT,
  proposed_from    TEXT,
  proposed_to      TEXT,
  rejected_at      TEXT,
  requested_at     TEXT,           -- the vendor was messaged (award notice or work order): the reminder clock starts
  reminded_at      TEXT,
  reminders        INTEGER NOT NULL DEFAULT 0 CHECK (reminders >= 0),
  escalated_at     TEXT,           -- not confirmed after the last reminder: the RFQ managers were notified (once per clock)
  confirmed_at     TEXT,
  confirmed_by     TEXT CHECK (confirmed_by IN ('vendor', 'manager')),
  acknowledged_at  TEXT,           -- the vendor acknowledged the approved payment schedule (with the arrival date)
  acknowledged_hash TEXT,          -- sha256 of the schedule_json he acknowledged: the acknowledgement counts only for that content
  decided_by       TEXT,
  decided_at       TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  revision         INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_ticket_rfq_award_terms_rfq ON ticket_rfq_award_terms (rfq_id);
CREATE INDEX idx_ticket_rfq_award_terms_waiting ON ticket_rfq_award_terms (requested_at) WHERE arrival_state = 'awaiting';
