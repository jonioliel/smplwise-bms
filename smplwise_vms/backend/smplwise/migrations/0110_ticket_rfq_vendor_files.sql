-- CR-038 requests for quotation: files and pictures a VENDOR attaches to his own quote (RFQ-VENDOR-UPLOAD, owner decision
-- 2026-10-17; docs/changes/CR-RFQ-VENDOR-UPLOAD.md; docs/tickets/RFQ_BACKEND_CONTRACT.md section 19.10). Migration 0110 (the number
-- the lead reserved for this branch; 0107..0109 belong to other branches).
--
-- One table, additive (no rebuild, nothing existing changes):
-- * ticket_rfq_vendor_files - one file a vendor uploaded through his own RFQ link (POST /t/api/rfq/upload, behind the installation
--   setting `rfq.vendor_uploads.enabled`, OFF by default): a re-encoded JPEG (with a re-encoded thumbnail) or a PDF / DOCX / XLSX
--   kept byte for byte after the SAME structural refusal checks as a manager's file (services/tickets/rfq_files.py). `name` is the
--   cleaned display name (never a storage path, never trusted for the kind: the extension is the content's). The file lives under a
--   random name in `<data>/tickets/<folder>/rfq/` - `folder` is the request's id and never changes (the orphan sweep reads it).
--   `rfq_vendor_id` = the vendor row of the link that uploaded it (his own request only), `quote_id` = HIS quote the file was
--   attached to (the submitted version at upload time). `removed_at` = the vendor removed it: the row and the file stay (managers
--   see it marked) until the request is purged - so the per-vendor byte quota counts removed files too (no churn through removal).
--   Every row of a request goes with the request's purge (store_rfq.purge_rfq deletes them explicitly; the cascade is a backstop).
-- Rollback: additive (drop the table; delete `<data>/tickets/*/rfq/` files no `ticket_rfq_attachments` row names - the orphan sweep
-- does that once the table is gone).

CREATE TABLE ticket_rfq_vendor_files (
  id               TEXT PRIMARY KEY,
  rfq_id           TEXT NOT NULL REFERENCES ticket_rfqs(id) ON DELETE CASCADE,
  rfq_vendor_id    TEXT NOT NULL REFERENCES ticket_rfq_vendors(id) ON DELETE CASCADE,
  quote_id         TEXT,
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
  removed_at       TEXT
);
CREATE INDEX idx_ticket_rfq_vendor_files_vendor ON ticket_rfq_vendor_files (rfq_vendor_id, created_at);
CREATE INDEX idx_ticket_rfq_vendor_files_rfq ON ticket_rfq_vendor_files (rfq_id);
CREATE INDEX idx_ticket_rfq_vendor_files_folder ON ticket_rfq_vendor_files (folder);
