-- CR-CLAIM-PREFILL follow-up (owner decision 2026-10-17, open question 2): SEVERAL payment demands per assignment, one per approved
-- instalment, so a vendor demands the NEXT instalment from his page after the previous demand was approved.
-- Migration 0117 (provisional 0116 on pilot/CLAIM-PREFILL; renumbered at the integ/271 integration for 2.7.1). It needs 0116 (basis_json) first.
--
-- 0083 made `ticket_cost_claims.assignment_id` UNIQUE (one claim per assignment). SQLite cannot drop a column constraint in place, so the
-- table is rebuilt with the same columns + `instalment_index` (NULL = the ordinary claim - the only one an assignment without a payment
-- schedule ever has, exactly as before) and the uniqueness moves to an expression index: (assignment_id, IFNULL(instalment_index, -1)) -
-- at most ONE ordinary claim and at most one claim per instalment of an assignment (NULLs would not collide in a plain UNIQUE pair).
-- Existing rows are copied unchanged with `instalment_index` NULL (every pre-0117 claim is an ordinary claim). No data is changed or lost.
--
-- Migrations run with foreign keys ON, and ticket_cost_revisions / ticket_cost_decisions / ticket_cost_files reference the claims ON
-- DELETE CASCADE (ticket_cost_revision_files cascades from revisions and files): the DROP would delete them, so their rows are kept in
-- temporary tables across the rebuild and written back unchanged (the 0087 pattern). The column order of the children is untouched, so
-- `SELECT *` round-trips. Runs once (schema_migrations); the whole file is one transaction (Database.migrate), so a failure leaves the
-- 0116 schema intact.
--
-- Rollback (manual, only while no assignment holds two claims): `SELECT assignment_id FROM ticket_cost_claims GROUP BY assignment_id
-- HAVING COUNT(*) > 1` must be empty; then rebuild the table the same way with `assignment_id TEXT NOT NULL UNIQUE` and without
-- `instalment_index`, and delete version 117 from schema_migrations. An older build ignores the extra column but would not refuse a
-- second claim row it never writes; it reads `claim_for_assignment` as "the first row", which is the primary claim.

CREATE TEMP TABLE _cc_revisions AS SELECT * FROM ticket_cost_revisions;
CREATE TEMP TABLE _cc_decisions AS SELECT * FROM ticket_cost_decisions;
CREATE TEMP TABLE _cc_files AS SELECT * FROM ticket_cost_files;
CREATE TEMP TABLE _cc_revision_files AS SELECT * FROM ticket_cost_revision_files;

CREATE TABLE ticket_cost_claims_new (
  id                   TEXT PRIMARY KEY,
  ticket_id            TEXT REFERENCES tickets(id) ON DELETE SET NULL,
  department_id        TEXT NOT NULL,
  assignment_id        TEXT NOT NULL,
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
  updated_at           TEXT NOT NULL,
  quote_id             TEXT,
  instalment_index     INTEGER CHECK (instalment_index IS NULL OR instalment_index BETWEEN 0 AND 5)
);
INSERT INTO ticket_cost_claims_new (id, ticket_id, department_id, assignment_id, contact_id, required, status, currency, no_charge,
                                    current_revision_id, approved_revision_id, approved_total_minor, approved_by, approved_at, paid_at,
                                    paid_by, payment_ref, payment_date, claim_until, missing_at, snapshot_json, purge_after, revision,
                                    created_at, updated_at, quote_id, instalment_index)
  SELECT id, ticket_id, department_id, assignment_id, contact_id, required, status, currency, no_charge, current_revision_id,
         approved_revision_id, approved_total_minor, approved_by, approved_at, paid_at, paid_by, payment_ref, payment_date, claim_until,
         missing_at, snapshot_json, purge_after, revision, created_at, updated_at, quote_id, NULL
  FROM ticket_cost_claims;
DROP TABLE ticket_cost_claims;
ALTER TABLE ticket_cost_claims_new RENAME TO ticket_cost_claims;
CREATE UNIQUE INDEX idx_cost_claims_assignment ON ticket_cost_claims (assignment_id, IFNULL(instalment_index, -1));
CREATE INDEX idx_cost_claims_ticket ON ticket_cost_claims (ticket_id);
CREATE INDEX idx_cost_claims_status ON ticket_cost_claims (status, updated_at);
CREATE INDEX idx_cost_claims_contact ON ticket_cost_claims (contact_id, approved_at);
CREATE INDEX idx_cost_claims_window ON ticket_cost_claims (claim_until) WHERE status IN ('awaiting', 'rejected') AND missing_at IS NULL;
CREATE INDEX idx_cost_claims_purge ON ticket_cost_claims (purge_after) WHERE purge_after IS NOT NULL;

INSERT INTO ticket_cost_revisions SELECT * FROM _cc_revisions WHERE id NOT IN (SELECT id FROM ticket_cost_revisions);
INSERT INTO ticket_cost_decisions SELECT * FROM _cc_decisions WHERE id NOT IN (SELECT id FROM ticket_cost_decisions);
INSERT INTO ticket_cost_files SELECT * FROM _cc_files WHERE id NOT IN (SELECT id FROM ticket_cost_files);
INSERT INTO ticket_cost_revision_files SELECT * FROM _cc_revision_files
  WHERE (revision_id, doc_no, page_no) NOT IN (SELECT revision_id, doc_no, page_no FROM ticket_cost_revision_files);
DROP TABLE _cc_revisions;
DROP TABLE _cc_decisions;
DROP TABLE _cc_files;
DROP TABLE _cc_revision_files;
