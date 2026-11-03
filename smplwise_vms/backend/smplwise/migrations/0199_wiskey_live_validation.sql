-- WISKEY-LIVE-VALIDATION-2390 (WisKey plan T16): the station acceptance runs ("בדיקת קבלה לעמדות") and their per-station,
-- per-check results (services/wiskey_live_validation.py). Number 0199: the next free number after 0197 (intercom calls, 2.38.2 train)
-- and 0198 (WISKEY-PEOPLE-COMPLETE-2390); on this branch alone 0197/0198 are a gap until the train carries them - renumber at the merge
-- if the train ends elsewhere. Additive only; older code never reads it.
-- What a row keeps: ids, the check key, a closed status, a reason CODE and a small detail object of codes / numbers / times
-- (never a frame, a source, an address, a serial number, a credential or WisKey's target identity). A pulse run also keeps the
-- witness's name and verdict - the acceptance record the installer exports.
-- Rollback: drop both tables (nothing else reads them). Not a backup table (services/backup.py exports an allow-list).

CREATE TABLE IF NOT EXISTS wiskey_validation_runs (
  id                TEXT PRIMARY KEY CHECK (length(id) BETWEEN 4 AND 64),
  kind              TEXT NOT NULL CHECK (kind IN ('checks', 'pulse')),
  scope             TEXT NOT NULL CHECK (scope IN ('one', 'all')),
  parent_run_id     TEXT REFERENCES wiskey_validation_runs(id),   -- a pulse names the check run it belongs to (or NULL)
  state             TEXT NOT NULL CHECK (state IN ('running', 'done', 'cancelled', 'interrupted')),
  created_by        TEXT NOT NULL,                                -- the Arx user id; never a token
  created_by_name   TEXT,
  created_at        TEXT NOT NULL,
  finished_at       TEXT,
  cancel_requested  INTEGER NOT NULL DEFAULT 0 CHECK (cancel_requested IN (0, 1)),
  station_count     INTEGER NOT NULL CHECK (station_count >= 0)
);
CREATE INDEX IF NOT EXISTS wiskey_validation_runs_created ON wiskey_validation_runs(created_at);
CREATE INDEX IF NOT EXISTS wiskey_validation_runs_parent ON wiskey_validation_runs(parent_run_id) WHERE parent_run_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS wiskey_validation_results (
  run_id        TEXT NOT NULL REFERENCES wiskey_validation_runs(id) ON DELETE CASCADE,
  station_id    TEXT NOT NULL CHECK (length(station_id) BETWEEN 1 AND 128),
  station_name  TEXT,
  seq           INTEGER NOT NULL,
  check_key     TEXT NOT NULL CHECK (check_key IN ('identity', 'door_capabilities', 'door_read', 'media_arx', 'media_wiskey', 'talk',
                                                   'events', 'clock', 'pulse')),
  status        TEXT NOT NULL CHECK (status IN ('pending', 'running', 'pass', 'fail', 'unsupported', 'not_run')),
  reason        TEXT,
  detail_json   TEXT,
  started_at    TEXT,
  finished_at   TEXT,
  PRIMARY KEY (run_id, station_id, check_key)
);
