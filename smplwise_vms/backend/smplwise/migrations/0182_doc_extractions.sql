-- SUPPLIERDOCS-297 (docs/changes/CR-SUPPLIERDOCS-297.md, builds on CR-OCR119): reading a supplier document - PROPOSED field values
-- that a person decides field by field. Number 0182: release/2241 holds 0180 (external access codes / visitors) and 0181
-- (door-window program write); renumbered from the provisional 0180 on pilot/SUPPLIERDOCS2-297 (contiguous after 0181).
-- Additive only: one new table, no change to an existing table. Nothing here is read or written while `docread.enabled` is off
-- (default "false") or the maintenance module is off. Instants are UTC ISO-8601 text.
--
-- fields_json: {field: {proposed, confidence, evidence, snippet (<= 80 chars, scrubbed), status: proposed|confirmed|edited|rejected,
--               value (the person's final value, NULL until decided), decided_by, decided_at}} - NEVER the document's full text.
-- The kind / source lists already name the later slices (invoice, quote, service report; tickets files) so a later slice needs no
-- table rebuild; this slice writes only kind 'certificate' from source 'maint_file'.
CREATE TABLE doc_extractions (
  id             TEXT PRIMARY KEY,
  kind           TEXT NOT NULL CHECK (kind IN ('certificate', 'invoice', 'quote', 'service_report')),
  source_kind    TEXT NOT NULL CHECK (source_kind IN ('maint_file', 'cost_file', 'rfq_file', 'rfq_vendor_file')),
  source_id      TEXT NOT NULL,                      -- maint_files.id in this slice
  task_id        TEXT,                               -- maint_tasks.id (the visibility of the proposal is the task's)
  file_sha256    TEXT NOT NULL,
  tier           INTEGER NOT NULL DEFAULT 1 CHECK (tier IN (1, 2, 3)),  -- 1 text layer, 2 OCR (not built), 3 model (not built)
  engine         TEXT NOT NULL,                      -- the text source, e.g. 'pdftotext'; 'none' when nothing was read
  rules_version  TEXT NOT NULL,
  state          TEXT NOT NULL CHECK (state IN ('proposed', 'reviewed', 'needs_ocr', 'failed', 'discarded')),
  error_code     TEXT,                               -- needs_ocr / failed: ocr_not_available | no_text_layer | unreadable | too_many_pages | timeout
  pages          INTEGER,
  summary        TEXT CHECK (summary IN ('good', 'partial', 'none')),
  flags_json     TEXT NOT NULL DEFAULT '[]',         -- rule flags: date_order, visual_order
  fields_json    TEXT NOT NULL DEFAULT '{}',
  requested_by   TEXT NOT NULL,
  requested_at   TEXT NOT NULL,
  reviewed_by    TEXT,                               -- the person who decided the last open field
  reviewed_at    TEXT,
  purge_after    TEXT NOT NULL,                      -- the janitor deletes the row after this instant
  revision       INTEGER NOT NULL DEFAULT 1
);
-- one live proposal per file ("read again" = discard, then read)
CREATE UNIQUE INDEX idx_doc_extractions_live ON doc_extractions (source_kind, source_id) WHERE state IN ('proposed', 'reviewed', 'needs_ocr');
CREATE INDEX idx_doc_extractions_task ON doc_extractions (task_id);
CREATE INDEX idx_doc_extractions_purge ON doc_extractions (purge_after);
