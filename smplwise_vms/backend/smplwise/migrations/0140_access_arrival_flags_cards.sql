-- PROVISIONAL number 0140 (GRANTS3-295, pilot/GRANTS3-295 from integ/293 + pilot/GRANTSMIN-295); the lead renumbers at integration.
-- The content does not depend on the number.
--
-- GRANTS3-295, three approved backlog items of the shared Arx + WisKey identity (CR-ARX-WISKEY-SHARED-IDENTITY sections 4.5, 5, 8 X5):
--  - `access_arrival_flags`: the manager's "access needed" tick on a REGULAR external assignment (not an RFQ work order), which makes the
--    arrival step ("who arrives, when") available on that assignment's vendor page. One row per assignment, ids and an instant only.
--  - `access_grants.card_state`: the card of a card grant (credential = 'card'): NULL for a PIN / no-credential grant; 'awaiting' (approved,
--    no card yet), 'adding' (a card write is out), 'attached', 'unknown' (the card write's outcome was lost: a fresh read decides),
--    'removed' (the grant ended and the card was taken off the WisKey person). The card NUMBER is never stored anywhere (not even masked).
--  - an index on audit_log (resource_type, resource_id) for the owner's per-grant history (GET /access-grants/{id}/history).
--
-- Additive only. Nothing here is read while `access.external_grants` is off (and it cannot be turned on in this build).
-- Rollback: older code ignores the table, the column and the index.

CREATE TABLE IF NOT EXISTS access_arrival_flags (
  assignment_id TEXT PRIMARY KEY,                 -- ticket_assignments.id of a contact assignment
  ticket_id     TEXT NOT NULL,
  set_by        TEXT NOT NULL,                    -- users.id of the manager who ticked it
  set_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_access_arrival_flags_ticket ON access_arrival_flags (ticket_id);

ALTER TABLE access_grants ADD COLUMN card_state TEXT CHECK (card_state IS NULL OR card_state IN ('awaiting', 'adding', 'attached', 'unknown', 'removed'));

CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_log (resource_type, resource_id);
