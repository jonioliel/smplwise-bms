-- CR-038 service-request detail (TKDETAILBE, docs/tickets/DETAIL_BACKEND_CONTRACT.md; owner decisions 15.10): the internal owner of a
-- request with its history, the allowed cost line kinds (request -> department -> installation), the quote mode of an external
-- assignment, quotes before the work (versions, partial approval, append-only decisions) and the link from a payment demand (the
-- 0083 claim) to the approved quote it was validated against, with the exceptional lines of each revision.
-- Additive only (no table rebuild); nothing here is read while the module switch `tickets.enabled` is off.
-- PROVISIONAL NUMBER: other branches hold 0085 / 0086; renumbered at integration (the release check wants a contiguous sequence).
--
-- Money is an integer in minor units, as in 0083. A quote's VAT mode and rate are frozen at submission. Quote rows are never
-- re-priced: a correction is a new version (the previous one `superseded`); decisions are append-only rows.
-- `ticket_quotes.ticket_id` is NULLABLE (an RFQ quote exists before an order opens a ticket - the RFQ change sets `rfq_vendor_id`);
-- the state CHECK already carries the RFQ states (`withdrawn`, `not_awarded`) so the RFQ change needs no rebuild.

ALTER TABLE tickets ADD COLUMN internal_owner_user_id TEXT;
ALTER TABLE tickets ADD COLUMN allowed_line_kinds TEXT;
ALTER TABLE ticket_departments ADD COLUMN allowed_line_kinds TEXT;
ALTER TABLE ticket_assignments ADD COLUMN quote_mode TEXT CHECK (quote_mode IN ('required', 'optional', 'off'));
ALTER TABLE ticket_cost_claims ADD COLUMN quote_id TEXT;
ALTER TABLE ticket_cost_revisions ADD COLUMN exceptional_json TEXT NOT NULL DEFAULT '[]';

CREATE INDEX idx_tickets_internal_owner ON tickets (internal_owner_user_id) WHERE internal_owner_user_id IS NOT NULL;

CREATE TABLE ticket_owner_changes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id    TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  from_user_id TEXT,
  to_user_id   TEXT,
  by_user_id   TEXT,
  source       TEXT NOT NULL CHECK (source IN ('handoff', 'manual', 'rfq')),
  reason       TEXT,
  at           TEXT NOT NULL
);
CREATE INDEX idx_ticket_owner_changes_ticket ON ticket_owner_changes (ticket_id, id);

CREATE TABLE ticket_quotes (
  id                      TEXT PRIMARY KEY,
  ticket_id               TEXT REFERENCES tickets(id) ON DELETE CASCADE,
  rfq_vendor_id           TEXT,
  assignment_id           TEXT,
  contact_id              TEXT NOT NULL,
  department_id           TEXT,
  version                 INTEGER NOT NULL CHECK (version >= 1),
  supersedes_id           TEXT,
  source                  TEXT NOT NULL CHECK (source IN ('vendor', 'manager')),
  state                   TEXT NOT NULL CHECK (state IN ('submitted', 'fix_requested', 'approved', 'partially_approved', 'rejected',
                                                         'superseded', 'withdrawn', 'not_awarded')),
  currency                TEXT NOT NULL,
  vat_mode                TEXT NOT NULL CHECK (vat_mode IN ('excluded', 'included', 'none')),
  vat_rate_bp             INTEGER NOT NULL CHECK (vat_rate_bp >= 0),
  lines_json              TEXT NOT NULL,
  labor_minor             INTEGER NOT NULL CHECK (labor_minor >= 0),
  parts_minor             INTEGER NOT NULL CHECK (parts_minor >= 0),
  travel_minor            INTEGER NOT NULL CHECK (travel_minor >= 0),
  other_minor             INTEGER NOT NULL CHECK (other_minor >= 0),
  subtotal_minor          INTEGER NOT NULL CHECK (subtotal_minor >= 0),
  vat_minor               INTEGER NOT NULL CHECK (vat_minor >= 0),
  total_minor             INTEGER NOT NULL CHECK (total_minor >= 0),
  work_from               TEXT,
  work_to                 TEXT,
  note                    TEXT,
  vendor_ref              TEXT,
  approved_lines_json     TEXT,
  approved_subtotal_minor INTEGER,
  approved_vat_minor      INTEGER,
  approved_total_minor    INTEGER,
  decided_by              TEXT,
  decided_at              TEXT,
  decision_reason         TEXT,
  created_by_kind         TEXT NOT NULL CHECK (created_by_kind IN ('contact', 'user')),
  created_by              TEXT NOT NULL,
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  revision                INTEGER NOT NULL DEFAULT 1,
  CHECK (ticket_id IS NOT NULL OR rfq_vendor_id IS NOT NULL)
);
CREATE INDEX idx_ticket_quotes_ticket ON ticket_quotes (ticket_id, created_at);
CREATE INDEX idx_ticket_quotes_assignment ON ticket_quotes (assignment_id, version) WHERE assignment_id IS NOT NULL;
CREATE INDEX idx_ticket_quotes_rfq_vendor ON ticket_quotes (rfq_vendor_id, version) WHERE rfq_vendor_id IS NOT NULL;

CREATE TABLE ticket_quote_decisions (
  id           TEXT PRIMARY KEY,
  quote_id     TEXT NOT NULL REFERENCES ticket_quotes(id) ON DELETE CASCADE,
  action       TEXT NOT NULL CHECK (action IN ('approve', 'partial_approve', 'request_fix', 'reject', 'superseded', 'withdrawn',
                                               'not_awarded')),
  reason       TEXT,
  lines_json   TEXT,
  amount_minor INTEGER,
  by_user      TEXT NOT NULL,
  at           TEXT NOT NULL
);
CREATE INDEX idx_ticket_quote_decisions_quote ON ticket_quote_decisions (quote_id, at);
