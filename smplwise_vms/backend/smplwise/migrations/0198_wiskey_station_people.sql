-- WISKEY-PEOPLE-COMPLETE-2390 (owner Q3 "a", 03.11): the users found on a door station that are not in WisKey's person list
-- (services/station_people.py). One row per (station, station user number): when Arx first and last saw it in a station inventory,
-- and the administrator's reversible "ignore" decision. No name, PIN, card number, face or other personal value is stored: the
-- name and the credential presence are read from the station each time (WisKey `stations/inventory`).
-- Number 0198: main ends at 0196 and pilot/WISKEY-INBOUND-CALLS-2382 claims 0197; renumber to the next free number at merge time.
-- Additive only; older code never reads it. Rollback: drop the table (first-seen dates and ignore decisions are lost; WisKey's own
-- ignore flag, mirrored by the same action, stays). Not in a backup (services/backup.py lists tables to export; this one is not
-- listed): a restore to another installation must not carry decisions about devices it may not have.

CREATE TABLE IF NOT EXISTS wiskey_station_people (
  station_id     TEXT NOT NULL CHECK (length(station_id) BETWEEN 1 AND 128),
  employee_no    TEXT NOT NULL CHECK (length(employee_no) BETWEEN 1 AND 32),
  first_seen_at  TEXT NOT NULL,                 -- UTC ISO-8601 with Z: the first inventory that listed it
  last_seen_at   TEXT NOT NULL,                 -- the latest inventory that listed it
  ignored_at     TEXT,                          -- set = ignored; NULL = shown (an "undo" clears the three ignore columns)
  ignored_by     TEXT,                          -- the Arx user id that ignored it; never a token
  PRIMARY KEY (station_id, employee_no),
  CHECK ((ignored_at IS NULL) = (ignored_by IS NULL))
);
