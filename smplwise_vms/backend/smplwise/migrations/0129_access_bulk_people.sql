-- Final number 0129 (CR-BULKPEOPLE-295; built as PROVISIONAL 0131 on pilot/BULKPEOPLE-295; renumbered at the 2.10.0 integration, integ/2100: 0128 = VENDORQ-294). The content does not depend on the number.
--
-- CR-BULKPEOPLE-295 (docs/changes/CR-BULKPEOPLE-295.md): staged bulk import / bulk edit of access-control people.
-- One row per job. `rows_json` holds the normalized rows needed to apply (names, phones: PII) and is set to NULL when the job ends,
-- is cancelled or expires (24 h) - the uploaded bytes are never stored, only their SHA-256. `report_json` / `results_json` hold row
-- indexes, field NAMES and error codes only (never a value). Nothing here is read while `access.bulk_people` is off (the default).
-- Rollback: additive; older code ignores the table.

CREATE TABLE access_bulk_jobs (
  id              TEXT PRIMARY KEY,
  kind            TEXT NOT NULL CHECK (kind IN ('import', 'edit')),
  state           TEXT NOT NULL CHECK (state IN ('staged', 'previewed', 'confirmed', 'applying', 'paused', 'done', 'cancelled', 'expired')),
  created_by      TEXT NOT NULL,                 -- the Arx user id of the uploader
  idempotency_key TEXT NOT NULL,                 -- the client's key (per creator)
  source_digest   TEXT NOT NULL,                 -- sha256 of the uploaded bytes / the edit request
  row_count       INTEGER NOT NULL,
  rows_json       TEXT,                          -- normalized rows (PII) - NULL once the job is over
  report_json     TEXT NOT NULL DEFAULT '[]',    -- the validation report: [{row, status, codes, fields}]
  plan_json       TEXT,                          -- the dry-run plan: [{row, op, person_id, revision, fields}] (no values)
  plan_digest     TEXT,
  previewed_at    TEXT,
  previewed_by    TEXT,
  confirmed_by    TEXT,
  confirmed_at    TEXT,
  results_json    TEXT NOT NULL DEFAULT '{}',    -- {row index: {outcome, code, person_id}}
  cursor          INTEGER NOT NULL DEFAULT 0,    -- the next plan position to apply
  lease_until     TEXT,                          -- an apply call in progress holds the job until then
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  expires_at      TEXT NOT NULL,
  UNIQUE (created_by, idempotency_key)
);

CREATE INDEX access_bulk_jobs_state ON access_bulk_jobs(state, expires_at);
