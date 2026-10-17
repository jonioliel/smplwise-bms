-- CR-038 requests for quotation: files and pictures on a request (RFQATT, docs/changes/CR-RFQ-ATTACHMENTS.md;
-- docs/tickets/RFQ_BACKEND_CONTRACT.md section 19). Migration 0102 (provisional 0104 on pilot/RFQATT, confirmed at the integ/264
-- integration).
--
-- Two tables, both additive (no rebuild, nothing existing changes):
-- * ticket_rfq_attachments - one file of a request, written by an RFQ manager: a re-encoded JPEG (with a re-encoded thumbnail) or a
--   PDF / DOCX / XLSX kept byte for byte after the structural refusal checks (services/tickets/rfq_files.py). `name` is the cleaned
--   display name (never a storage path: the file lives under a random name in `<data>/tickets/<folder>/rfq/`). `folder` is the
--   request's id at upload time and never changes (the orphan sweep reads it; `rfq_id` becomes NULL when a purged request leaves a
--   file to the service requests that reference it). `visible_vendors` = the manager's "visible to vendors" switch (default on).
--   `removed_at` = removed after the request was sent: the row and the file stay (what the vendors received is kept) until the
--   request is purged; a draft's file is deleted outright.
-- * ticket_rfq_attachment_refs - the reference copy (owner 17.10: "copied by REFERENCE, not duplicated"): when an award opens its
--   service request (TKRFQ4 order), every vendor-visible file of the request is referenced by the new ticket, so the vendor keeps
--   it on the request's handler page after the RFQ link ends. A ticket purge removes its references (cascade); the janitor deletes
--   a file that no request and no reference names any more.
-- Rollback: additive (drop the two tables; nothing else reads them).

CREATE TABLE ticket_rfq_attachments (
  id               TEXT PRIMARY KEY,
  rfq_id           TEXT REFERENCES ticket_rfqs(id) ON DELETE SET NULL,
  folder           TEXT NOT NULL,
  kind             TEXT NOT NULL CHECK (kind IN ('image', 'pdf', 'docx', 'xlsx')),
  name             TEXT NOT NULL,
  caption          TEXT NOT NULL DEFAULT '',
  mime             TEXT NOT NULL,
  path             TEXT NOT NULL,
  thumb_path       TEXT,
  sha256           TEXT NOT NULL,
  bytes            INTEGER NOT NULL CHECK (bytes > 0),
  width            INTEGER,
  height           INTEGER,
  visible_vendors  INTEGER NOT NULL DEFAULT 1 CHECK (visible_vendors IN (0, 1)),
  position         INTEGER NOT NULL DEFAULT 0,
  created_by       TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  removed_at       TEXT,
  removed_by       TEXT
);
CREATE INDEX idx_ticket_rfq_attachments_rfq ON ticket_rfq_attachments (rfq_id, position, created_at);
CREATE INDEX idx_ticket_rfq_attachments_folder ON ticket_rfq_attachments (folder);

CREATE TABLE ticket_rfq_attachment_refs (
  ticket_id      TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  attachment_id  TEXT NOT NULL REFERENCES ticket_rfq_attachments(id) ON DELETE CASCADE,
  award_id       TEXT,
  created_at     TEXT NOT NULL,
  PRIMARY KEY (ticket_id, attachment_id)
);
CREATE INDEX idx_ticket_rfq_attachment_refs_attachment ON ticket_rfq_attachment_refs (attachment_id);
