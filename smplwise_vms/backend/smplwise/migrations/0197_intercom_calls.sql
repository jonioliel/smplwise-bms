-- WISKEY-INBOUND-CALLS-2382: the call log of the WisKey door stations (services/intercom_calls.py).
-- WisKey has no call id, no caller identity and no call history (its `events/list` keeps a bare `ring` row only), so Arx
-- mints one row per ring it observes in the station feed (`call_state` ringing / in_call / idle) and records what Arx itself
-- did about it: who answered, rejected or hung up from Arx, and whether a door of that station was opened from Arx during the
-- call. A call answered on another panel is `answered_via = 'elsewhere'` with no name. Station id + name and Arx operator ids /
-- display names only: never a visitor, an image, a phone number or a device address.
-- Number 0197: the next free number on origin/main (ends at 0196); a train that already holds 0197 renumbers this file.
-- Additive only; older code never reads it. Not a backup table (services/backup.py PROJECT_TABLES does not list it): an
-- operational log with its own retention (90 days, services/intercom_calls.RETENTION_DAYS). Rollback: drop the table.

CREATE TABLE IF NOT EXISTS intercom_calls (
  id                   TEXT PRIMARY KEY,
  station_id           TEXT NOT NULL,
  station_name         TEXT NOT NULL DEFAULT '',
  rang_at              TEXT NOT NULL,                 -- when Arx first saw the station ringing (or in a call, `observed` = 'in_call')
  observed             TEXT NOT NULL DEFAULT 'ringing' CHECK (observed IN ('ringing', 'in_call')),
  state                TEXT NOT NULL CHECK (state IN ('ringing', 'in_call', 'ended')),
  outcome              TEXT CHECK (outcome IS NULL OR outcome IN ('answered', 'rejected', 'missed', 'unknown')),
  answered_at          TEXT,
  answered_via         TEXT CHECK (answered_via IS NULL OR answered_via IN ('arx', 'elsewhere')),
  answered_by          TEXT,                          -- the Arx user id (answered_via = 'arx' only)
  answered_by_name     TEXT,
  ended_at             TEXT,
  ended_by             TEXT,                          -- the Arx user who rejected / hung up; NULL when the call ended by itself or elsewhere
  ended_by_name        TEXT,
  door_opened_at       TEXT,
  door_opened_by       TEXT,
  door_opened_by_name  TEXT,
  updated_at           TEXT NOT NULL,
  CHECK ((state = 'ended') = (ended_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS intercom_calls_station ON intercom_calls(station_id, rang_at DESC);
CREATE INDEX IF NOT EXISTS intercom_calls_rang ON intercom_calls(rang_at DESC);
