-- PROVISIONAL number 0142 (STATIONPERM-295, built on pilot/STATIONPERM-295 from main @ 61ddf6a91); the lead renumbers at integration.
-- The content does not depend on the number.
--
-- CR-STATION-PERMISSIONS-295 section 2: a person's personal decision per access-control station (WisKey), as a first-class Arx record.
-- One row per (WisKey person, station). Ids only: never a name, a phone number, a PIN, a card, a schedule. The history of every
-- decision is in the audit log (access.station_permission.*).
--
-- Additive only. Nothing here is read while the switch `access.station_permissions` is off (default), and the switch cannot be turned
-- on in this build (services/access_grants.GO_LIVE_PERMITTED is False).
-- Rollback: additive; older code ignores the table.

CREATE TABLE access_station_permissions (
  id                   TEXT PRIMARY KEY,                -- uuid4 hex
  wiskey_person_id     TEXT NOT NULL CHECK (length(wiskey_person_id) BETWEEN 1 AND 128),
  station_id           TEXT NOT NULL CHECK (length(station_id) BETWEEN 1 AND 128),
  effect               TEXT CHECK (effect IS NULL OR effect IN ('allow', 'deny', 'inherit')),  -- NULL only while the first request waits
  relays_json          TEXT NOT NULL DEFAULT '[]',      -- the relays of an allow ('[1]', '[1,2]'); '[]' otherwise
  sync_state           TEXT NOT NULL DEFAULT 'none' CHECK (sync_state IN ('none', 'pending', 'applied', 'unverified', 'failed')),
  decided_by           TEXT,                            -- users.id of who decided the current effect
  decided_at           TEXT,
  approval_revision    INTEGER,                         -- permission_revision when the current effect was decided
  request_effect       TEXT CHECK (request_effect IS NULL OR request_effect IN ('allow', 'inherit')),  -- a widening waiting for a decision
  request_relays_json  TEXT,
  requested_by         TEXT,
  requested_at         TEXT,
  wiskey_revision      INTEGER,                         -- the WisKey person revision after Arx's last write
  proof_at             TEXT,                            -- when a fresh read proved the current effect
  last_error           TEXT,                            -- closed code of the last push (never a WisKey text)
  attempts             INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  revision             INTEGER NOT NULL DEFAULT 1,
  CHECK (effect IS NOT NULL OR request_effect IS NOT NULL)
);
CREATE UNIQUE INDEX idx_asp_person_station ON access_station_permissions (wiskey_person_id, station_id);
CREATE INDEX idx_asp_station ON access_station_permissions (station_id);
CREATE INDEX idx_asp_requests ON access_station_permissions (requested_at) WHERE request_effect IS NOT NULL;
