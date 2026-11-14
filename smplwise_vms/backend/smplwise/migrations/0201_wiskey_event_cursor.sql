-- WISKEY-EVENT-CURSOR-2400 (docs/changes/WISKEY-EVENT-CURSOR-2400.md): gap-free WisKey door events across restarts. The service feed
-- (services/intercom_sync.py) reads WisKey's durable event cursor `events/resume_v1` (signed) through services/wiskey_event_resume.py:
-- one cursor per WisKey event source, the door events it delivered (stored once per event id), and every discontinuity as a gap row.
-- Number 0201: 0197 is the last on origin/release/2382-train; 0198 (station people), 0199 (live validation) and 0200 (two open branches:
-- conflict reviews, access review decisions) are reserved by other branches. The train that merges this file renumbers it if needed.
-- Additive only; older code never reads these tables. None of them is a backup table (services/backup.py PROJECT_TABLES does not
-- list them): they describe THIS installation's exchange with WisKey. Ids, codes, station ids and instants only - never a person's
-- name, an employee number, a card or a device address. Rollback: drop the three tables.

-- One row per WisKey event source (WisKey's 32-hex `source`: a reinstall or a storage reset is a new source). Exactly one row is
-- active: the one the next resume reads from. `cursor` NULL = read that source from its beginning.
CREATE TABLE IF NOT EXISTS wiskey_event_cursors (
  source         TEXT PRIMARY KEY,
  cursor         TEXT,
  last_sequence  INTEGER NOT NULL DEFAULT 0,
  active         INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0, 1)),
  fresh_gap_id   TEXT,                            -- the gap that already covers this source's fresh start (a reset on the NULL cursor extends it)
  caught_up_at   TEXT,                            -- the last page that said all_delivered: Arx held everything WisKey had then
  last_event_at  TEXT,                            -- WisKey's received_at of the newest event stored from this source
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS wiskey_event_cursors_one_active ON wiskey_event_cursors(active) WHERE active = 1;

-- The door events the cursor delivered, once per WisKey event id (a replayed page inserts nothing). A closed projection of
-- WisKey's event record: no person_name, employee_no, card, major or minor.
CREATE TABLE IF NOT EXISTS wiskey_door_events (
  event_id        TEXT PRIMARY KEY,
  source          TEXT NOT NULL,
  sequence        INTEGER NOT NULL,
  station_id      TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  result          TEXT NOT NULL,
  authentication  TEXT NOT NULL,
  door            INTEGER,
  occurred_at     TEXT NOT NULL,                  -- WisKey's `timestamp` as sent (see time_source)
  time_source     TEXT NOT NULL,
  received_at     TEXT NOT NULL,                  -- when WisKey received it
  recovered       INTEGER NOT NULL DEFAULT 0 CHECK (recovered IN (0, 1)),
  stored_at       TEXT NOT NULL                   -- when Arx stored it
);
CREATE INDEX IF NOT EXISTS wiskey_door_events_time ON wiskey_door_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS wiskey_door_events_station ON wiskey_door_events(station_id, occurred_at DESC);

-- Every discontinuity of the door-event history: WisKey could not hand on what lies between from_at and to_at. from_at NULL = the
-- start is unknown (Arx never held a cursor). `event_ref` = the event-centre `coverage_gap` row that shows it.
CREATE TABLE IF NOT EXISTS wiskey_event_gaps (
  id           TEXT PRIMARY KEY,
  reason       TEXT NOT NULL CHECK (reason IN ('first_start', 'source_replaced', 'source_mismatch', 'cursor_ahead', 'retention_gap', 'cursor_invalid')),
  from_at      TEXT,
  to_at        TEXT NOT NULL,
  old_source   TEXT,
  new_source   TEXT,
  event_ref    TEXT,
  observed_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS wiskey_event_gaps_time ON wiskey_event_gaps(observed_at DESC);
