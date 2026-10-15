-- TKSTAFF1 (owner 2026-10-16; private security design TKSTAFF1_LINK_SECURITY_DESIGN_2026-10-16, R5 / R7 / R12): the no-login
-- STAFF link. An internal employee with an account who is assigned a ticket may get the SAME scoped handler link a vendor gets,
-- over that one assignment, by WhatsApp. PROVISIONAL NUMBER: the lead renumbers at integration (contiguous sequence rule).
--
-- 1. ticket_links.kind ('external' | 'staff'): every staff-specific rule keys on it (no cost-claim surface, the staff durations,
--    the staff code default, the mint audit). Existing rows are 'external'.
-- 2. ticket_links.revoked_reason gains 'user_inactive' (the user was deactivated, left the department or lost tickets.view there).
--    SQLite cannot change a CHECK in place, so ticket_links is rebuilt with the same columns, rows and indexes. Its five child
--    tables reference it ON DELETE CASCADE and migrations run with foreign keys ON (a DROP TABLE deletes their rows), so their
--    rows are kept in temporary tables across the rebuild and written back unchanged (ids, AUTOINCREMENT ids included).
-- 3. ticket_contacts.notify_whatsapp: the user's own "WhatsApp for my assignments" switch on their directory row (R12; default on,
--    it only matters when the row has a mobile). Content-free: the audit names the field, never the value.
-- Additive for every reader: nothing here is read while the module switch `tickets.enabled` is off.

CREATE TEMP TABLE _tk_sessions AS SELECT * FROM ticket_link_sessions;
CREATE TEMP TABLE _tk_codes AS SELECT * FROM ticket_link_codes;
CREATE TEMP TABLE _tk_failures AS SELECT * FROM ticket_link_failures;
CREATE TEMP TABLE _tk_access AS SELECT * FROM ticket_link_access;
CREATE TEMP TABLE _tk_redeems AS SELECT * FROM ticket_link_redeems;

CREATE TABLE ticket_links_new (
  id               TEXT PRIMARY KEY,
  ticket_id        TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  assignment_id    TEXT NOT NULL REFERENCES ticket_assignments(id) ON DELETE CASCADE,
  contact_id       TEXT NOT NULL REFERENCES ticket_contacts(id),
  generation       INTEGER NOT NULL DEFAULT 1 CHECK (generation >= 1),
  key_id           TEXT NOT NULL,
  token_hash       TEXT NOT NULL UNIQUE,
  require_code     INTEGER NOT NULL CHECK (require_code IN (0, 1)),
  sent_via         TEXT CHECK (sent_via IN ('whatsapp', 'email', 'manual')),
  sent_at          TEXT,
  created_at       TEXT NOT NULL,
  generation_at    TEXT,
  expires_at       TEXT NOT NULL,
  cap_at           TEXT NOT NULL,
  grace_until      TEXT,
  revoked_at       TEXT,
  revoked_reason   TEXT CHECK (revoked_reason IN ('closed', 'cancelled', 'reassigned', 'returned', 'not_mine', 'manual',
                                                'resent', 'module_key', 'contact_changed', 'contact_erased', 'user_inactive')),
  first_opened_at  TEXT,
  last_opened_at   TEXT,
  open_count       INTEGER NOT NULL DEFAULT 0,
  update_count     INTEGER NOT NULL DEFAULT 0,
  kind             TEXT NOT NULL DEFAULT 'external' CHECK (kind IN ('external', 'staff'))
);
INSERT INTO ticket_links_new (id, ticket_id, assignment_id, contact_id, generation, key_id, token_hash, require_code, sent_via, sent_at,
                              created_at, generation_at, expires_at, cap_at, grace_until, revoked_at, revoked_reason, first_opened_at,
                              last_opened_at, open_count, update_count, kind)
  SELECT id, ticket_id, assignment_id, contact_id, generation, key_id, token_hash, require_code, sent_via, sent_at, created_at, generation_at,
         expires_at, cap_at, grace_until, revoked_at, revoked_reason, first_opened_at, last_opened_at, open_count, update_count, 'external'
  FROM ticket_links;
DROP TABLE ticket_links;
ALTER TABLE ticket_links_new RENAME TO ticket_links;
CREATE INDEX idx_ticket_links_ticket ON ticket_links (ticket_id);
CREATE UNIQUE INDEX idx_ticket_links_assignment ON ticket_links (assignment_id);
CREATE INDEX idx_ticket_links_contact ON ticket_links (contact_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_ticket_links_expiry ON ticket_links (expires_at) WHERE revoked_at IS NULL;
CREATE INDEX idx_ticket_links_key ON ticket_links (key_id);

INSERT INTO ticket_link_sessions SELECT * FROM _tk_sessions;
INSERT INTO ticket_link_codes SELECT * FROM _tk_codes;
INSERT INTO ticket_link_failures SELECT * FROM _tk_failures;
INSERT INTO ticket_link_access SELECT * FROM _tk_access;
INSERT INTO ticket_link_redeems SELECT * FROM _tk_redeems;
DROP TABLE _tk_sessions;
DROP TABLE _tk_codes;
DROP TABLE _tk_failures;
DROP TABLE _tk_access;
DROP TABLE _tk_redeems;

ALTER TABLE ticket_contacts ADD COLUMN notify_whatsapp INTEGER NOT NULL DEFAULT 1 CHECK (notify_whatsapp IN (0, 1));
