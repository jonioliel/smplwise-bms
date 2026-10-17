-- CR-038 requests for quotation: files and pictures a VENDOR attaches to his own quote or to his own question (RFQ-VENDOR-UPLOAD,
-- owner decisions 2026-10-17; docs/changes/CR-RFQ-VENDOR-UPLOAD.md; docs/tickets/RFQ_BACKEND_CONTRACT.md section 19.10). Migration
-- 0109 (provisional 0110 on pilot/RFQ-VENDOR-UPLOAD; renumbered at the integ/270 integration, 2.7.0). Unreleased: edited in place on the branch.
--
-- Two tables, additive (no rebuild, nothing existing changes):
-- * ticket_rfq_vendor_files - one file a vendor uploaded through his own RFQ link (POST /t/api/rfq/upload, behind the installation
--   setting `rfq.vendor_uploads.enabled`, OFF by default): a re-encoded JPEG (with a re-encoded thumbnail) or a PDF / DOCX / XLSX
--   kept byte for byte after the SAME structural refusal checks as a manager's file (services/tickets/rfq_files.py). `name` is the
--   cleaned display name (never a storage path, never trusted for the kind: the extension is the content's). The file lives under a
--   random name in `<data>/tickets/<folder>/rfq/` - `folder` is the request's id and never changes (the orphan sweep reads it).
--   `rfq_vendor_id` = the vendor row of the link that uploaded it. EXACTLY ONE of `quote_id` (HIS quote: the submitted version at
--   upload time) or `message_id` (HIS question in his own thread) - the CHECK below. `removed_at` = the vendor removed it: the row
--   and the file stay (managers see it marked) - so the per-vendor quota counts removed files too (no churn through removal).
--   `rfq_id` / `rfq_vendor_id` are SET NULL when the request is purged and a work order still references the file (below); the purge
--   deletes every other row explicitly (store_rfq.purge_rfq), the janitor a row nothing names any more.
-- * ticket_rfq_vendor_file_refs - the work order's REFERENCE to the awarded vendor's files (owner decision 2026-10-17: visible on the
--   work order, no copy of the bytes), written when the award opens its service request (TKRFQ4 order). A ticket purge removes its
--   references (cascade + store.purge explicitly).
-- Rollback: additive (drop the two tables; the orphan sweeps then remove the vendor files under `<data>/tickets/*/rfq/` that no
-- `ticket_rfq_attachments` row names).

CREATE TABLE ticket_rfq_vendor_files (
  id               TEXT PRIMARY KEY,
  rfq_id           TEXT REFERENCES ticket_rfqs(id) ON DELETE SET NULL,
  rfq_vendor_id    TEXT REFERENCES ticket_rfq_vendors(id) ON DELETE SET NULL,
  quote_id         TEXT,
  message_id       TEXT,
  folder           TEXT NOT NULL,
  kind             TEXT NOT NULL CHECK (kind IN ('image', 'pdf', 'docx', 'xlsx')),
  name             TEXT NOT NULL,
  mime             TEXT NOT NULL,
  path             TEXT NOT NULL,
  thumb_path       TEXT,
  sha256           TEXT NOT NULL,
  bytes            INTEGER NOT NULL CHECK (bytes > 0),
  stored_bytes     INTEGER NOT NULL CHECK (stored_bytes > 0),
  width            INTEGER,
  height           INTEGER,
  created_at       TEXT NOT NULL,
  removed_at       TEXT,
  CHECK ((quote_id IS NULL) <> (message_id IS NULL))
);
CREATE INDEX idx_ticket_rfq_vendor_files_vendor ON ticket_rfq_vendor_files (rfq_vendor_id, created_at);
CREATE INDEX idx_ticket_rfq_vendor_files_rfq ON ticket_rfq_vendor_files (rfq_id);
CREATE INDEX idx_ticket_rfq_vendor_files_message ON ticket_rfq_vendor_files (message_id);
CREATE INDEX idx_ticket_rfq_vendor_files_folder ON ticket_rfq_vendor_files (folder);

CREATE TABLE ticket_rfq_vendor_file_refs (
  ticket_id   TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  file_id     TEXT NOT NULL REFERENCES ticket_rfq_vendor_files(id) ON DELETE CASCADE,
  award_id    TEXT,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (ticket_id, file_id)
);
CREATE INDEX idx_ticket_rfq_vendor_file_refs_file ON ticket_rfq_vendor_file_refs (file_id);
