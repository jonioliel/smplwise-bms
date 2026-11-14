-- Final number 0126 (built as PROVISIONAL 0128 on pilot/SHAREDID-293; renumbered at the 2.9.3 integration, integ/293: 0124 is 2.9.2,
-- 0125 the temperature phase 3). The content does not depend on the number.
--
-- SHAREDID-293 (owner decisions 2026-10-20, "Shared Arx + WisKey identity UI"): the server side of the external-access screen.
--  2  "Active - verified" only when the server stores READ-BACK PROOF: the digest of the scope a fresh WisKey read proved
--     (doors, validity, timing, credential), when, and when Arx last read to check. A scope change makes the stored digest
--     differ from the row's scope, so a proof is never carried over to a scope it did not prove.
--  3  the manual "confirmed gone" closure (one system administrator, an evidence reference, a notice to every manager): its own
--     table, so the grant's state stays one of the existing final states (`ended`) and the screen tells it apart.
--  5  name drift: a digest of the name WisKey showed at the last read and of the name Arx last wrote - never the name itself
--     (the link table stays ids-only, 0107).
--
-- Additive only: three nullable columns on access_grants, three on access_person_links, one new table. Nothing here is read while
-- `access.external_grants` is off (and it cannot be turned on in this build). Ids, digests and instants only - the one free-text
-- column is the closure's evidence reference (8..128 characters, no phone numbers: checked in services/access_external.py).
-- Rollback: additive; older code ignores the columns and the table.

ALTER TABLE access_grants ADD COLUMN scope_proof TEXT;          -- sha256 (32 hex) of the scope a fresh read proved; NULL = no proof
ALTER TABLE access_grants ADD COLUMN scope_proof_at TEXT;       -- when that read happened (UTC ...Z)
ALTER TABLE access_grants ADD COLUMN scope_checked_at TEXT;     -- the last verification read, proven or not (throttles the reads)

ALTER TABLE access_person_links ADD COLUMN name_seen TEXT;      -- sha256 (32 hex) of WisKey's display name at the last read
ALTER TABLE access_person_links ADD COLUMN name_pushed TEXT;    -- sha256 (32 hex) of the name Arx last wrote (create or push)
ALTER TABLE access_person_links ADD COLUMN name_checked_at TEXT;

CREATE TABLE access_grant_closures (
  grant_id         TEXT PRIMARY KEY REFERENCES access_grants(id) ON DELETE CASCADE,
  kind             TEXT NOT NULL CHECK (kind IN ('confirmed_gone')),
  link_id          TEXT,                                  -- the link that was missing (kept to watch for the person reappearing)
  wiskey_person_id TEXT,
  closed_by        TEXT NOT NULL,                         -- users.id of the system administrator
  closed_at        TEXT NOT NULL,
  reference        TEXT NOT NULL CHECK (length(reference) BETWEEN 8 AND 128),
  watch_checked_at TEXT,                                  -- the last read that looked for the person again
  reappeared_at    TEXT                                   -- the person was found again: the revocation was reopened
);
CREATE INDEX idx_access_grant_closures_watch ON access_grant_closures (reappeared_at, watch_checked_at);
