-- Number 0179 (built as PROVISIONAL on pilot/BUSTIMES-295 from origin/main where 0177 is the highest and 0178 is taken by another branch;
-- renumbered after 2.22.0, release 2.23.0; TPLV2 may take 0179). The content does not depend on the number.
-- BUSTIMES-295 (docs/changes/BUSTIMES-295.md): nearby public-transport times on the notice board (scheduled times only in v1).
--   transit_stops   the local copy of the stop catalogue (Open Bus Stride `gtfs_stops`, deduplicated by the stable stop CODE), replaced by a
--                   nightly job, so the settings search (city / name / code) never calls the third party
--   transit_cache   per stop code: the normalized boardable arrivals of a window wider than any display window, and when they were fetched
--                   (the age that decides fresh / cached / expired is derived from `fetched_at`)
-- Both are operational data of this installation, not project data: neither is exported by a backup (see services/backup.py SETTINGS_KEEP).
-- Rollback = run the previous version: it never reads these tables; dropping them is optional.
CREATE TABLE transit_stops (
  code  INTEGER PRIMARY KEY,
  name  TEXT NOT NULL,
  city  TEXT NOT NULL DEFAULT '',
  lat   REAL,
  lon   REAL
);
CREATE INDEX idx_transit_stops_city ON transit_stops (city);

CREATE TABLE transit_cache (
  code        INTEGER PRIMARY KEY,
  fetched_at  TEXT NOT NULL,
  window_to   TEXT NOT NULL,
  rows_json   TEXT NOT NULL DEFAULT '[]'
);
