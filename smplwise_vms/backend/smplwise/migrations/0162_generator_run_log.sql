-- GENLOG092-295 (board row r092, version 2.17.0): the generator run log - start tests, mains-failure runs, run hours and fuel.
-- Final number 0162 (built as PROVISIONAL 0175 on pilot/GENLOG092-295; renumbered at the 2.16.0 integration, release/2160).
-- Nothing in the code refers to the number.
-- It needs the tables of 0061_generator only (new tables, no ALTER).
--
-- Read-only against the controller, like the rest of the generator screen: every row is DERIVED from the state mirror (ha_entities) by
-- services/generator_log.py on the generator tick. Nothing here is ever sent to the controller, and no row starts or stops anything.

-- One row per engine run (running = the controller's "generator running" flag, else the engine state, else the rpm above `running_rpm`).
-- kind: test | mains_failure | manual | other (classified at the start, refined while the run lasts; kind_reason says which signal decided).
CREATE TABLE generator_run_log (
  id             TEXT PRIMARY KEY,
  device_id      TEXT NOT NULL REFERENCES generator_devices(id) ON DELETE CASCADE,
  start_ts       INTEGER NOT NULL,                  -- epoch seconds (UTC)
  end_ts         INTEGER,                           -- NULL = running now
  end_reason     TEXT,                              -- stopped | no_data (no reading for `no_data_close_min`: closed at the last running reading)
  kind           TEXT NOT NULL DEFAULT 'other' CHECK (kind IN ('test', 'mains_failure', 'manual', 'other')),
  kind_reason    TEXT,                              -- mode_test | start_reason | mains_lost | mode_manual | unloaded | none
  mode_at_start  TEXT,                              -- the normalised controller mode at the start (auto | manual | test | off | other)
  mains_at_start INTEGER,                           -- 1 / 0 / NULL (no mains sensor)
  took_load      INTEGER NOT NULL DEFAULT 0,        -- the generator carried the site's load at some point of the run
  hours_start    REAL,                              -- the controller's run-hours counter at the start / end (NULL = no counter)
  hours_end      REAL,
  starts_start   REAL,                              -- the controller's start counter at the start (NULL = none)
  fuel_start_pct REAL,
  fuel_end_pct   REAL,
  fuel_start_l   REAL,
  fuel_end_l     REAL,
  peak_load_pct  REAL,
  peak_kw        REAL,
  last_run_ts    INTEGER NOT NULL                   -- the last tick that still saw the engine running
);
CREATE INDEX idx_generator_run_log_device ON generator_run_log (device_id, start_ts);
CREATE UNIQUE INDEX idx_generator_run_log_open ON generator_run_log (device_id) WHERE end_ts IS NULL;

-- Fuel events derived from the level: a refill (a rise of at least `refill_min_pct`, folded until the level settles) and an unexplained drop
-- while the engine rests (at least `drop_min_pct` inside `fuel_window_h`: a leak or a theft to check - a hint, never an alarm).
CREATE TABLE generator_fuel_events (
  id         TEXT PRIMARY KEY,
  device_id  TEXT NOT NULL REFERENCES generator_devices(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('refill', 'drop')),
  start_ts   INTEGER NOT NULL,
  end_ts     INTEGER NOT NULL,
  from_pct   REAL NOT NULL,
  to_pct     REAL NOT NULL
);
CREATE INDEX idx_generator_fuel_events_device ON generator_fuel_events (device_id, start_ts);

-- Per generator, the tracker's own memory between ticks (survives a restart): when the mains were last seen lost, the fuel anchor and a
-- refill being folded.
CREATE TABLE generator_log_state (
  device_id        TEXT PRIMARY KEY REFERENCES generator_devices(id) ON DELETE CASCADE,
  mains_lost_ts    INTEGER,                         -- the last tick that saw the mains lost
  fuel_anchor_pct  REAL,
  fuel_anchor_ts   INTEGER,
  refill_from_pct  REAL,                            -- a refill in progress: where it started, its highest level and its last rise
  refill_from_ts   INTEGER,
  refill_peak_pct  REAL,
  refill_last_ts   INTEGER
);
