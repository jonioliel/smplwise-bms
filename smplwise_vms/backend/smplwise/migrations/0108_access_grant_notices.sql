-- CR-ARX-WISKEY-SHARED-IDENTITY sections 2.6, 4.2 and 5 (owner answers 2026-10-17, questions 7 and 9): the privacy-notice
-- acknowledgements, the technicians a vendor added on the arrival page (pending until a manager accepts them), the per-station
-- "entrance for external people" flag, and the send ledger of the access-code caps. Final number 0108 (provisional 0109 on pilot/WISKEYID-BUILD; renumbered at integ/270).
--
-- Additive only; nothing is read while `access.external_grants` is off. No code, no message text, no phone number is stored here:
-- the send ledger keys a number by the contact's existing keyed index (`ticket_contacts.phone_key`), never the digits.
-- Rollback: additive (older code ignores the four tables).

-- Owner answer 9: a short notice on the arrival page (or the approver's "the person was told" tick) - recorded with the text version.
CREATE TABLE access_grant_notices (
  grant_id      TEXT NOT NULL REFERENCES access_grants(id) ON DELETE CASCADE,
  version       TEXT NOT NULL CHECK (length(version) BETWEEN 1 AND 16),
  via           TEXT NOT NULL CHECK (via IN ('page', 'approver')),
  by_ref        TEXT NOT NULL,                         -- 'contact:<id>' (page) or users.id (approver)
  at            TEXT NOT NULL,
  PRIMARY KEY (grant_id, via)
);

-- Owner answer 7: a technician the vendor added on the arrival page is a contact row with active = 0 until a manager accepts it;
-- he then confirms his own number with the existing code flow (phone_confirmed_via = 'code') before any access code reaches it.
CREATE TABLE access_pending_contacts (
  contact_id    TEXT PRIMARY KEY REFERENCES ticket_contacts(id) ON DELETE CASCADE,
  vendor_id     TEXT NOT NULL,
  assignment_id TEXT,
  created_by    TEXT NOT NULL,                         -- 'contact:<id>' of the vendor's link
  created_at    TEXT NOT NULL,
  accepted_by   TEXT,
  accepted_at   TEXT,
  rejected_at   TEXT
);

-- CR section 5: the stations Settings marks as "entrance for external people" (suggested doors besides the ticket's building).
CREATE TABLE access_station_entrance (
  station_id    TEXT PRIMARY KEY,
  set_by        TEXT NOT NULL,
  set_at        TEXT NOT NULL
);

-- CR 4.2 caps: per grant 3 sends in total, per number 3 a day, per installation 50 a day, 1 per 60 s per grant.
CREATE TABLE access_code_sends (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  grant_id      TEXT NOT NULL,
  number_ref    TEXT NOT NULL,                         -- ticket_contacts.phone_key (keyed index), or 'contact:<id>' without one
  at            TEXT NOT NULL,
  outcome       TEXT NOT NULL CHECK (outcome IN ('sent', 'not_sent', 'unknown'))
);
CREATE INDEX idx_access_code_sends_at ON access_code_sends (at);
CREATE INDEX idx_access_code_sends_number ON access_code_sends (number_ref, at);
CREATE INDEX idx_access_code_sends_grant ON access_code_sends (grant_id, at);
