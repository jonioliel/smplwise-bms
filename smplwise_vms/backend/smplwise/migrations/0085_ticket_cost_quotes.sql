-- TK257 (owner test of 2.5.5, 2026-10-16): the quote BEFORE the work. The vendor page gets a permanent "quote / payment demand" card; the
-- payment demand after the work is the existing cost claim (migration 0083), the quote is this separate, much smaller record. A quote
-- is NOT a claim: it never settles anything, never blocks closing, never counts in the cost report, and approving it sends nothing.
-- Provisional number: the lead renumbers at integration if another branch took 0085.
--
-- One row per submission (append-only versions per assignment: `seq`); a newer submission supersedes the open one. Money is integer
-- minor units like the claim's revisions. `state`: submitted -> approved | rejected ("needs a correction", with `reason`) | superseded.
-- `cost_line_kinds`: an optional comma list of the line kinds a vendor may quote on this request (assignment) or by default in a
-- department; NULL = the default "labor,parts". "travel" / "other" appear only when listed here.

ALTER TABLE ticket_assignments ADD COLUMN cost_line_kinds TEXT;
ALTER TABLE ticket_departments ADD COLUMN cost_line_kinds TEXT;

CREATE TABLE ticket_cost_quotes (
  id             TEXT PRIMARY KEY,
  ticket_id      TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  assignment_id  TEXT NOT NULL,
  contact_id     TEXT NOT NULL,
  seq            INTEGER NOT NULL CHECK (seq >= 1),
  state          TEXT NOT NULL CHECK (state IN ('submitted', 'approved', 'rejected', 'superseded')),
  lines_json     TEXT NOT NULL,
  labor_minor    INTEGER NOT NULL CHECK (labor_minor >= 0),
  parts_minor    INTEGER NOT NULL CHECK (parts_minor >= 0),
  travel_minor   INTEGER NOT NULL CHECK (travel_minor >= 0),
  other_minor    INTEGER NOT NULL CHECK (other_minor >= 0),
  subtotal_minor INTEGER NOT NULL CHECK (subtotal_minor >= 0),
  vat_mode       TEXT NOT NULL CHECK (vat_mode IN ('excluded', 'included', 'none')),
  vat_rate_bp    INTEGER NOT NULL CHECK (vat_rate_bp >= 0),
  vat_minor      INTEGER NOT NULL CHECK (vat_minor >= 0),
  total_minor    INTEGER NOT NULL CHECK (total_minor >= 0),
  currency       TEXT NOT NULL,
  notes          TEXT,
  reason         TEXT,
  decided_by     TEXT,
  decided_at     TEXT,
  created_at     TEXT NOT NULL,
  UNIQUE (assignment_id, seq)
);
CREATE INDEX idx_cost_quotes_ticket ON ticket_cost_quotes (ticket_id, created_at);
