-- TKNOTIFOTP (owner decision 2026-10-16): OPTIONAL verification of number ownership by a one-time WhatsApp code - OFF by default,
-- never mandatory. PROVISIONAL NUMBER: the lead renumbers at integration (contiguous sequence rule). The outbox purpose the code
-- message needs lives in its own small migration (0092), because TKRFQ1 rebuilds `ticket_outbox` too.
--
-- 1. ticket_contacts.phone_verify: the per-contact / per-person switch "verify the number with a code" (default 0). It only RAISES
--    the installation switch (`tickets.settings.phone_verify.required`): either one on = the number counts as confirmed only after
--    the code sent to it was typed back.
-- 2. ticket_contacts.phone_confirmed_via: HOW the current number was confirmed - 'user' (the signed-in user confirmed the number shown
--    to them, TKSTAFF1 review F3), 'manager' (a configurer marked it: "אני בטוח שזה המספר שלו", only while verification is off for
--    the row) or 'code' (the code was typed back). While verification is on, only 'code' counts. Cleared with phone_confirmed_at on
--    every change of the number. Rows confirmed before this migration were confirmed by their user (TKSTAFF1 had no other path).
-- 3. ticket_phone_verifications: one row per code sent. No code is stored: `code_hash` = HMAC-SHA256(k_tickets[key_id],
--    'pv|' id | phone_key | code); the six digits are DERIVED from the 128-bit row id under the same key (codes.derive_code, the
--    W9 pattern), so the outbox renders the message from the row id and never holds the digits. `phone_key` binds the code to the
--    number it went to (a number changed in between can never be confirmed by it). Operational data, pruned after 2 days;
--    not a project-backup table.

ALTER TABLE ticket_contacts ADD COLUMN phone_verify INTEGER NOT NULL DEFAULT 0 CHECK (phone_verify IN (0, 1));
ALTER TABLE ticket_contacts ADD COLUMN phone_confirmed_via TEXT
  CHECK (phone_confirmed_via IS NULL OR phone_confirmed_via IN ('user', 'manager', 'code'));
UPDATE ticket_contacts SET phone_confirmed_via = 'user' WHERE phone_confirmed_at IS NOT NULL;

CREATE TABLE ticket_phone_verifications (
  id              TEXT PRIMARY KEY,                    -- 32 lowercase hex; the six digits are derived from it (never stored)
  contact_id      TEXT NOT NULL REFERENCES ticket_contacts(id) ON DELETE CASCADE,
  phone_key       TEXT NOT NULL,                       -- the contact's keyed phone index when the code was sent (binding)
  key_id          TEXT NOT NULL,                       -- the module key that derived and hashed the code
  code_hash       TEXT NOT NULL,
  requested_by    TEXT NOT NULL CHECK (requested_by IN ('self', 'manager')),
  requester_id    TEXT,                                -- users.id of the person who asked for it
  created_at      TEXT NOT NULL,
  expires_at      TEXT NOT NULL,
  attempts        INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  consumed_at     TEXT,
  invalidated_at  TEXT,                                -- a newer code, five wrong guesses, or the message could not be queued
  outbox_id       TEXT
);
CREATE INDEX idx_ticket_phone_verify_contact ON ticket_phone_verifications (contact_id, created_at);
CREATE INDEX idx_ticket_phone_verify_number ON ticket_phone_verifications (phone_key, created_at);
CREATE INDEX idx_ticket_phone_verify_created ON ticket_phone_verifications (created_at);
