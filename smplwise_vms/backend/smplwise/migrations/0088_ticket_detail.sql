-- CR-038 service-request detail (TKDETAILBE, docs/tickets/DETAIL_BACKEND_CONTRACT.md; owner decisions 15.10): the internal owner of a
-- request with its history, the allowed cost line kinds (request -> department -> installation), the quote mode of an external
-- assignment, quotes before the work (versions, partial approval, append-only decisions) and the link from a payment demand (the
-- 0083 claim) to the approved quote it was validated against, with the exceptional lines of each revision.
-- No table rebuild; nothing here is read while the module switch `tickets.enabled` is off. Applies on top of 0085 (TK257, 2.5.7: the
-- first, minimal quote table `ticket_cost_quotes` and the comma lists `cost_line_kinds`), 0086 (outbox link generation) and 0087 (TKSTAFF1 staff links).
--
-- REPLACES 0085 (lead decision 2026-10-16): at the end of this file every `ticket_cost_quotes` row is copied into `ticket_quotes`
-- (seq -> version; 2.5.7 `rejected` = "needs a correction" -> `fix_requested`; an approval approves every line; each decision becomes
-- a `ticket_quote_decisions` row) and the old table is DROPPED (nothing references it; one quote implementation only). The two
-- `cost_line_kinds` columns are converted into `allowed_line_kinds` (JSON; 2.5.7 always added labour and parts) - the department's
-- onto the department, an assignment's onto its ticket (the latest assignment that set one) - and are then left in place, unused
-- (nothing reads them after this migration; dropping a column is not worth a rebuild).
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

-- ---------------------------------------------------------------- 0085 (TK257) -> this design

UPDATE ticket_departments SET allowed_line_kinds =
  '["labor","parts"' ||
  CASE WHEN instr(',' || replace(cost_line_kinds, ' ', '') || ',', ',travel,') > 0 THEN ',"travel"' ELSE '' END ||
  CASE WHEN instr(',' || replace(cost_line_kinds, ' ', '') || ',', ',other,') > 0 THEN ',"other"' ELSE '' END || ']'
WHERE cost_line_kinds IS NOT NULL AND trim(cost_line_kinds) <> '' AND allowed_line_kinds IS NULL;

UPDATE tickets SET allowed_line_kinds = (
  SELECT '["labor","parts"' ||
         CASE WHEN instr(',' || replace(a.cost_line_kinds, ' ', '') || ',', ',travel,') > 0 THEN ',"travel"' ELSE '' END ||
         CASE WHEN instr(',' || replace(a.cost_line_kinds, ' ', '') || ',', ',other,') > 0 THEN ',"other"' ELSE '' END || ']'
  FROM ticket_assignments a
  WHERE a.ticket_id = tickets.id AND a.cost_line_kinds IS NOT NULL AND trim(a.cost_line_kinds) <> ''
  ORDER BY a.assigned_at DESC, a.rowid DESC LIMIT 1)
WHERE allowed_line_kinds IS NULL AND EXISTS (
  SELECT 1 FROM ticket_assignments a WHERE a.ticket_id = tickets.id AND a.cost_line_kinds IS NOT NULL AND trim(a.cost_line_kinds) <> '');

INSERT INTO ticket_quotes (id, ticket_id, rfq_vendor_id, assignment_id, contact_id, department_id, version, supersedes_id, source, state,
                           currency, vat_mode, vat_rate_bp, lines_json, labor_minor, parts_minor, travel_minor, other_minor,
                           subtotal_minor, vat_minor, total_minor, work_from, work_to, note, vendor_ref, approved_lines_json,
                           approved_subtotal_minor, approved_vat_minor, approved_total_minor, decided_by, decided_at, decision_reason,
                           created_by_kind, created_by, created_at, updated_at, revision)
SELECT q.id, q.ticket_id, NULL, q.assignment_id, q.contact_id, t.department_id, q.seq,
       (SELECT p.id FROM ticket_cost_quotes p WHERE p.assignment_id = q.assignment_id AND p.seq = q.seq - 1), 'vendor',
       CASE q.state WHEN 'rejected' THEN 'fix_requested' ELSE q.state END,
       q.currency, q.vat_mode, q.vat_rate_bp, q.lines_json, q.labor_minor, q.parts_minor, q.travel_minor, q.other_minor,
       q.subtotal_minor, q.vat_minor, q.total_minor, NULL, NULL, q.notes, NULL,
       CASE WHEN q.state = 'approved' THEN (SELECT json_group_array(CAST(j.key AS INTEGER)) FROM json_each(q.lines_json) j) END,
       CASE WHEN q.state = 'approved' THEN q.subtotal_minor END,
       CASE WHEN q.state = 'approved' THEN q.vat_minor END,
       CASE WHEN q.state = 'approved' THEN q.total_minor END,
       q.decided_by, q.decided_at, q.reason, 'contact', q.contact_id, q.created_at, COALESCE(q.decided_at, q.created_at), 1
FROM ticket_cost_quotes q LEFT JOIN tickets t ON t.id = q.ticket_id;

INSERT INTO ticket_quote_decisions (id, quote_id, action, reason, lines_json, amount_minor, by_user, at)
SELECT 'm0088-' || q.id, q.id, CASE q.state WHEN 'approved' THEN 'approve' ELSE 'request_fix' END, q.reason,
       CASE WHEN q.state = 'approved' THEN (SELECT json_group_array(CAST(j.key AS INTEGER)) FROM json_each(q.lines_json) j) END,
       CASE WHEN q.state = 'approved' THEN q.total_minor END, q.decided_by, q.decided_at
FROM ticket_cost_quotes q WHERE q.state IN ('approved', 'rejected') AND q.decided_by IS NOT NULL AND q.decided_at IS NOT NULL;

DROP INDEX IF EXISTS idx_cost_quotes_ticket;
DROP TABLE ticket_cost_quotes;
