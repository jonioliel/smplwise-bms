-- CR-038 slice 9 (docs/changes/CR-038-TICKETS-MODULE.md section 11A, owner decisions D31 / D32): cost claims from external
-- vendors - the per-assignment requirement and its defaults (vendor -> department -> installation), the claims, their immutable
-- revisions, the append-only decisions, the invoice files (photographed pages and PDFs) and the denormalised cost columns of the
-- board. Additive only: nothing here is read while the module switch `tickets.enabled` is off.
--
-- Money is ALWAYS an integer in minor units (agorot for ILS); never a REAL. The VAT mode and rate in force at submission are
-- frozen in the revision (a later settings change never re-prices it). Revisions are never updated; decisions are never updated
-- or deleted (only the retention janitor removes a whole claim at its own `purge_after`).
--
-- Deviations from the spec's DDL (11A.10), recorded in docs/changes/CR-038-S9-NOTES.md:
-- * ticket_cost_claims.ticket_id is NULLABLE with ON DELETE SET NULL: 11A.11 keeps a claim after its ticket is purged ("no
--   ticket link", the record stays readable through snapshot_json) - a NOT NULL reference without cascade would block the purge.
--   `department_id` is copied so a claim of a purged ticket can still be gated in the report.
-- * `missing_at`: when the claim window of a REQUIRED claim passed without a submission (the "claim missing" signal is raised once).
-- * ticket_cost_files gains ticket_id (the folder of the file), name (the vendor's own label of the file, shown back to the
--   vendor only), width / height (photographed pages), and the pending scope of an internal upload (uploaded_by + ticket_id).
-- * ticket_cost_revision_files: which files a revision carries, as documents and pages (a corrected revision may carry the files
--   of an earlier one without a new upload; an adjustment carries the files of the revision it corrects).

ALTER TABLE ticket_departments ADD COLUMN cost_claim TEXT CHECK (cost_claim IN ('required', 'optional', 'off'));
ALTER TABLE ticket_departments ADD COLUMN claim_window_days INTEGER CHECK (claim_window_days IS NULL OR claim_window_days BETWEEN 1 AND 90);
ALTER TABLE ticket_contacts ADD COLUMN cost_claim TEXT CHECK (cost_claim IN ('required', 'optional', 'off'));
ALTER TABLE ticket_contacts ADD COLUMN vat_exempt INTEGER NOT NULL DEFAULT 0 CHECK (vat_exempt IN (0, 1));
ALTER TABLE ticket_contacts ADD COLUMN vat_default TEXT NOT NULL DEFAULT 'excluded' CHECK (vat_default IN ('included', 'excluded'));
ALTER TABLE ticket_contacts ADD COLUMN labor_rate_minor INTEGER CHECK (labor_rate_minor IS NULL OR labor_rate_minor >= 0);
ALTER TABLE ticket_contacts ADD COLUMN rate_currency TEXT;
ALTER TABLE ticket_assignments ADD COLUMN cost_claim TEXT CHECK (cost_claim IN ('required', 'optional', 'off'));
ALTER TABLE tickets ADD COLUMN cost_status TEXT NOT NULL DEFAULT 'not_required'
  CHECK (cost_status IN ('not_required', 'awaiting', 'submitted', 'rejected', 'approved', 'paid'));
ALTER TABLE tickets ADD COLUMN cost_total_minor INTEGER;
ALTER TABLE tickets ADD COLUMN cost_currency TEXT;

CREATE INDEX idx_tickets_cost_status ON tickets (cost_status) WHERE cost_status <> 'not_required';

CREATE TABLE ticket_cost_claims (
  id                   TEXT PRIMARY KEY,
  ticket_id            TEXT REFERENCES tickets(id) ON DELETE SET NULL,
  department_id        TEXT NOT NULL,
  assignment_id        TEXT NOT NULL UNIQUE,
  contact_id           TEXT NOT NULL,
  required             INTEGER NOT NULL CHECK (required IN (0, 1)),
  status               TEXT NOT NULL CHECK (status IN ('awaiting', 'submitted', 'rejected', 'approved', 'paid')),
  currency             TEXT NOT NULL,
  no_charge            INTEGER NOT NULL DEFAULT 0 CHECK (no_charge IN (0, 1)),
  current_revision_id  TEXT,
  approved_revision_id TEXT,
  approved_total_minor INTEGER,
  approved_by          TEXT,
  approved_at          TEXT,
  paid_at              TEXT,
  paid_by              TEXT,
  payment_ref          TEXT,
  payment_date         TEXT,
  claim_until          TEXT,
  missing_at           TEXT,
  snapshot_json        TEXT NOT NULL,
  purge_after          TEXT,
  revision             INTEGER NOT NULL DEFAULT 1,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);
CREATE INDEX idx_cost_claims_ticket ON ticket_cost_claims (ticket_id);
CREATE INDEX idx_cost_claims_status ON ticket_cost_claims (status, updated_at);
CREATE INDEX idx_cost_claims_contact ON ticket_cost_claims (contact_id, approved_at);
CREATE INDEX idx_cost_claims_window ON ticket_cost_claims (claim_until) WHERE status IN ('awaiting', 'rejected') AND missing_at IS NULL;
CREATE INDEX idx_cost_claims_purge ON ticket_cost_claims (purge_after) WHERE purge_after IS NOT NULL;

CREATE TABLE ticket_cost_revisions (
  id              TEXT PRIMARY KEY,
  claim_id        TEXT NOT NULL REFERENCES ticket_cost_claims(id) ON DELETE CASCADE,
  seq             INTEGER NOT NULL CHECK (seq >= 1),
  source          TEXT NOT NULL CHECK (source IN ('vendor', 'manager')),
  kind            TEXT NOT NULL CHECK (kind IN ('submission', 'adjustment', 'on_behalf')),
  based_on        TEXT,
  no_charge       INTEGER NOT NULL DEFAULT 0 CHECK (no_charge IN (0, 1)),
  lines_json      TEXT NOT NULL,
  labor_minor     INTEGER NOT NULL CHECK (labor_minor >= 0),
  parts_minor     INTEGER NOT NULL CHECK (parts_minor >= 0),
  travel_minor    INTEGER NOT NULL CHECK (travel_minor >= 0),
  other_minor     INTEGER NOT NULL CHECK (other_minor >= 0),
  subtotal_minor  INTEGER NOT NULL CHECK (subtotal_minor >= 0),
  vat_mode        TEXT NOT NULL CHECK (vat_mode IN ('excluded', 'included', 'none')),
  vat_rate_bp     INTEGER NOT NULL CHECK (vat_rate_bp >= 0),
  vat_minor       INTEGER NOT NULL CHECK (vat_minor >= 0),
  total_minor     INTEGER NOT NULL CHECK (total_minor >= 0),
  currency        TEXT NOT NULL,
  vendor_ref      TEXT,
  notes           TEXT,
  reason          TEXT,
  created_by_kind TEXT NOT NULL CHECK (created_by_kind IN ('contact', 'user')),
  created_by      TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  UNIQUE (claim_id, seq)
);

CREATE TABLE ticket_cost_decisions (
  id           TEXT PRIMARY KEY,
  claim_id     TEXT NOT NULL REFERENCES ticket_cost_claims(id) ON DELETE CASCADE,
  revision_id  TEXT,
  action       TEXT NOT NULL CHECK (action IN ('approve', 'adjust', 'reject', 'mark_paid', 'unmark_paid', 'reopen_window',
                                                'override_close', 'superseded', 'requirement')),
  reason       TEXT,
  amount_minor INTEGER,
  payment_ref  TEXT,
  by_user      TEXT NOT NULL,
  at           TEXT NOT NULL
);
CREATE INDEX idx_cost_decisions_claim ON ticket_cost_decisions (claim_id, at);

CREATE TABLE ticket_cost_files (
  id               TEXT PRIMARY KEY,
  ticket_id        TEXT NOT NULL,
  claim_id         TEXT REFERENCES ticket_cost_claims(id) ON DELETE CASCADE,
  revision_id      TEXT,
  link_id          TEXT,
  kind             TEXT NOT NULL CHECK (kind IN ('photo', 'pdf')),
  document_key     TEXT,
  page_no          INTEGER,
  ocr_status       TEXT,
  name             TEXT NOT NULL DEFAULT '',
  path             TEXT NOT NULL,
  sha256           TEXT NOT NULL,
  bytes            INTEGER NOT NULL,
  width            INTEGER,
  height           INTEGER,
  uploaded_by_kind TEXT NOT NULL CHECK (uploaded_by_kind IN ('contact', 'user')),
  uploaded_by      TEXT NOT NULL,
  created_at       TEXT NOT NULL
);
CREATE INDEX idx_cost_files_claim ON ticket_cost_files (claim_id);
CREATE INDEX idx_cost_files_pending ON ticket_cost_files (created_at) WHERE claim_id IS NULL;
CREATE INDEX idx_cost_files_link ON ticket_cost_files (link_id, created_at) WHERE claim_id IS NULL;

CREATE TABLE ticket_cost_revision_files (
  revision_id TEXT NOT NULL REFERENCES ticket_cost_revisions(id) ON DELETE CASCADE,
  file_id     TEXT NOT NULL REFERENCES ticket_cost_files(id) ON DELETE CASCADE,
  doc_no      INTEGER NOT NULL CHECK (doc_no BETWEEN 1 AND 3),
  page_no     INTEGER NOT NULL CHECK (page_no BETWEEN 1 AND 10),
  PRIMARY KEY (revision_id, doc_no, page_no)
);
CREATE INDEX idx_cost_revision_files_file ON ticket_cost_revision_files (file_id);
