-- VPORTAL (owner-approved design 2026-10-16): the vendor portal on the public listener (`/support`, OFF by default -
-- `tickets.settings.vendor_portal.enabled`). Migration 0105 (provisional 0110 on pilot/VPORTAL, confirmed at the integ/264
-- integration). Additive only: two new tables, nothing
-- existing is altered, nothing here is read while the portal switch or the module switch is off.
--
-- 1. ticket_portal_codes: one row per sign-in code request for a NUMBER (not per contact): `phone_key` is the keyed index of the
--    canonical number (HMAC under the module key `key_id`, links.phone_key) - the number itself is never stored. A row is written
--    for EVERY accepted request, also for a number that belongs to nobody (`contact_id` NULL, nothing is sent): the verify path then
--    behaves the same for known and unknown numbers (no enumeration through timing or attempts). No code is stored: `code_hash` =
--    HMAC-SHA256(k_tickets[key_id], 'vp|' id | phone_key | code); the six digits are DERIVED from the 128-bit row id under the same
--    key (codes.derive_code, the W9 pattern), so the outbox renders the WhatsApp message from the row id (purpose `phone_verify`,
--    the fixed code text) and never holds the digits. `contact_id` names the directory row the message went to (the outbox needs a
--    recipient row). Operational data, pruned after 2 days; not a project-backup table.
-- 2. ticket_portal_sessions: the read-only portal session after a correct code - 30 minutes from the sign-in, never extended. The
--    cookie value (256 bits) is never stored, only its SHA-256 (`id_hash`). Bound to the number (`phone_key` + `key_id`): a key
--    rotation or a changed number ends what the session shows. `revoked_at` = signed out. Pruned once expired.

CREATE TABLE ticket_portal_codes (
  id              TEXT PRIMARY KEY,                    -- 32 lowercase hex; the six digits are derived from it (never stored)
  phone_key       TEXT NOT NULL,
  key_id          TEXT NOT NULL,
  code_hash       TEXT NOT NULL,
  contact_id      TEXT,                                -- the row the message went to; NULL = nothing was sent (unknown number / capped)
  created_at      TEXT NOT NULL,
  expires_at      TEXT NOT NULL,
  attempts        INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  consumed_at     TEXT,
  invalidated_at  TEXT,                                -- a newer code, five wrong guesses, or the message could not be queued
  outbox_id       TEXT,
  net_hash        TEXT                                 -- 2.6.4 review F6: HMAC(k, 'vpn|' requesting client network); a guess from another network is not counted
);
CREATE INDEX idx_ticket_portal_codes_number ON ticket_portal_codes (phone_key, created_at);
CREATE INDEX idx_ticket_portal_codes_created ON ticket_portal_codes (created_at);
CREATE INDEX idx_ticket_portal_codes_contact ON ticket_portal_codes (contact_id) WHERE contact_id IS NOT NULL;

CREATE TABLE ticket_portal_sessions (
  id_hash     TEXT PRIMARY KEY,
  phone_key   TEXT NOT NULL,
  key_id      TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  revoked_at  TEXT
);
CREATE INDEX idx_ticket_portal_sessions_expiry ON ticket_portal_sessions (expires_at);
CREATE INDEX idx_ticket_portal_sessions_number ON ticket_portal_sessions (phone_key);
