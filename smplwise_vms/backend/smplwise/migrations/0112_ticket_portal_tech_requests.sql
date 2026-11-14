-- VPORTALRFQ (owner 2026-10-17: "possible in future", approved to build, OFF by default): the vendor portal's "company technician
-- requests". Migration 0112 (provisional 0114 on pilot/VPORTALRFQ; renumbered at the integ/270 integration, 2.7.0). Additive only: one new
-- table, nothing existing is altered, nothing here is read or written while `tickets.settings.vendor_portal.technician_requests` (or
-- the portal, or the module) is off.
--
-- ticket_portal_tech_requests: a signed-in vendor COMPANY (a directory row of kind `vendor` whose proved number is the portal
-- session's) asks to ADD a technician or to REPLACE one of its own technicians (a `person` row with `vendor_id` = the company) - a
-- name and a mobile number. Nothing changes in the directory until a directory editor (`tickets.configure`) approves it; the approval
-- creates the person row through the directory's own create path (contacts.create: the same validation, keyed number, audit) and, for
-- a replacement, sets the replaced row inactive through contacts.update (its live links are revoked by that path). No door / access
-- right of any kind is created here (that is a separate WisKey flow).
--   `phone_e164` holds the typed number as E.164 digits (contacts.normalize_phone): it is the number the editor will put in the
--   directory. It never leaves to the vendor again in full (the portal shows the last four digits only), never reaches a log line or
--   an audit row. A decided row is deleted 180 days after the decision, a pending one 90 days after it was sent (the janitor); erase
--   of the company or of the sending row deletes its rows (vendor_portal.forget_contact). Not a project-backup table.
--   `display_name` went through model.text_field (controls / bidi / zero-width stripped) and the portal's own name rule (letters,
--   no address, few digits) before it was stored.

CREATE TABLE ticket_portal_tech_requests (
  id                   TEXT PRIMARY KEY,
  vendor_id            TEXT NOT NULL,                     -- the company (ticket_contacts, kind 'vendor')
  sender_contact_id    TEXT NOT NULL,                     -- the directory row whose number signed in (today the company row itself)
  action               TEXT NOT NULL CHECK (action IN ('add', 'replace')),
  replaces_contact_id  TEXT,                              -- 'replace' only: the company's own technician row
  display_name         TEXT NOT NULL,
  phone_e164           TEXT NOT NULL,
  state                TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'approved', 'rejected', 'cancelled')),
  created_at           TEXT NOT NULL,
  decided_at           TEXT,
  decided_by           TEXT,                              -- the editor's user id ('vendor_portal' when the vendor cancelled)
  result_contact_id    TEXT,                              -- the person row the approval created
  revision             INTEGER NOT NULL DEFAULT 1,
  CHECK ((action = 'replace') = (replaces_contact_id IS NOT NULL))
);
CREATE INDEX idx_ticket_portal_tech_requests_vendor ON ticket_portal_tech_requests (vendor_id, created_at);
CREATE INDEX idx_ticket_portal_tech_requests_state ON ticket_portal_tech_requests (state, created_at);
