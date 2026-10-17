-- CR-RFQ-PAYMENT-SCHEDULE follow-up (RFQPAY2; docs/changes/CR-RFQ-PAYMENT-SCHEDULE.md section 8; RFQ contract 20.11 - 20.13): the
-- owner approved three items that v1.4.1 recorded as "not built":
--   (1) a separate payment demand per approved instalment - created MANUALLY by a manager from the schedule row (idempotent: one row
--       per quote + instalment), marked paid or cancelled by a manager; never created or paid automatically;
--   (2) the overdue-instalment notification - the janitor compares each dated instalment with its demand; `overdue_key` remembers which
--       instalments the last `rfq.instalment_overdue` signal covered, so a signal is raised only when a NEW instalment becomes overdue;
--   (3) a manager may move an instalment's planned date after the award - stored inside the schedule JSON (`agreed_date`,
--       `date_changed_at`), so no column is needed for it.
-- Migration 0112 (provisional - the lead renumbers at integration). Additive only: one new table + one nullable column; nothing existing
-- is rebuilt or rewritten, nothing is read while the installation switch `tickets.settings.rfq.schedule_arrival` is off and no terms exist.
-- Money: integers in minor units (VAT included, as the approved schedule). Arx never initiates or executes a payment: "paid" is the
-- manager's record that the payment was made outside the system. No bank data, no payment reference text.
-- Rollback: additive (the table stays empty, the column NULL).

-- One payment demand per approved instalment. Bound to the QUOTE (the ticket's cost baseline, which keeps the approved schedule after a
-- purge of the request, contract 20.1) - `award_id` / `rfq_id` are plain ids (the award may be purged with the request).
CREATE TABLE ticket_rfq_instalment_demands (
  id               TEXT PRIMARY KEY,
  quote_id         TEXT NOT NULL REFERENCES ticket_quotes(id) ON DELETE CASCADE,
  award_id         TEXT NOT NULL,
  rfq_id           TEXT NOT NULL,
  instalment_index INTEGER NOT NULL CHECK (instalment_index BETWEEN 0 AND 5),
  kind             TEXT NOT NULL CHECK (kind IN ('advance', 'progress', 'final')),
  amount_minor     INTEGER NOT NULL CHECK (amount_minor > 0),
  currency         TEXT NOT NULL,
  due_date         TEXT,            -- the instalment's due day when the demand was made / last moved (NULL: on completion, not done yet)
  status           TEXT NOT NULL CHECK (status IN ('open', 'paid', 'cancelled')),
  created_by       TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  paid_by          TEXT,
  paid_at          TEXT,
  cancelled_by     TEXT,
  cancelled_at     TEXT,
  updated_at       TEXT NOT NULL,
  revision         INTEGER NOT NULL DEFAULT 1,
  UNIQUE (quote_id, instalment_index)
);
CREATE INDEX idx_ticket_rfq_instalment_demands_award ON ticket_rfq_instalment_demands (award_id);

-- The overdue instalments (comma-separated indexes) the last `rfq.instalment_overdue` signal covered; NULL = none open.
ALTER TABLE ticket_rfq_award_terms ADD COLUMN overdue_key TEXT;
