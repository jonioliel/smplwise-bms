-- energy.db E001 (CR-023 P1): the electricity time-series, its own file, gate and migration series.
-- Energy is integer Wh, instants are UTC epoch seconds. Only services/energy_store.py opens this file.

-- text meter id (main DB energy_meters.id) -> small integer used by every table below
CREATE TABLE meter_map (
  meter_id  INTEGER PRIMARY KEY,
  ext_id    TEXT NOT NULL UNIQUE
);

-- raw cumulative readings: at most one per meter per minute (plus a 15-minute heartbeat while the value is unchanged)
-- flags: 1 reset, 2 glitch (held), 4 after_unavailable, 8 noise (ignored), 16 spike dropped, 32 jump accepted,
-- 64 rebase, 128 replacement (manual final/start reading), 256 last_reset change
CREATE TABLE readings (
  meter_id  INTEGER NOT NULL,
  ts        INTEGER NOT NULL,
  value_wh  INTEGER NOT NULL,
  flags     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (meter_id, ts)
) WITHOUT ROWID;

-- 15-minute buckets (UTC epoch of the bucket start): energy and the seconds of the bucket that lie between two accepted
-- readings (coverage). quality: 0 measured (both readings within 15 minutes), 1 spread over a longer gap, 4 manual
CREATE TABLE intervals (
  meter_id    INTEGER NOT NULL,
  bucket      INTEGER NOT NULL,
  wh          INTEGER NOT NULL DEFAULT 0,
  covered_s   INTEGER NOT NULL DEFAULT 0,
  quality     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (meter_id, bucket)
) WITHOUT ROWID;

-- per meter per local date (installation zone at the time of writing): kept as long as bills (7 years by default) so
-- history windows and monthly totals survive raw / quarter-hour retention
CREATE TABLE daily (
  meter_id    INTEGER NOT NULL,
  date        TEXT NOT NULL,
  wh          INTEGER NOT NULL DEFAULT 0,
  covered_s   INTEGER NOT NULL DEFAULT 0,
  day_s       INTEGER NOT NULL DEFAULT 86400,   -- 82800 / 90000 on DST days
  quality_max INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (meter_id, date)
) WITHOUT ROWID;

-- the processing state per meter: the last accepted reading, a held (glitch) reading, the last report seen
CREATE TABLE cursor (
  meter_id        INTEGER PRIMARY KEY,
  epoch_id        TEXT,
  last_ts         INTEGER,
  last_value_wh   INTEGER,
  held_ts         INTEGER,
  held_value_wh   INTEGER,
  held_kind       TEXT,              -- 'up' (jump) | 'down' (drop)
  stored_ts       INTEGER,           -- the last raw row written (throttle / heartbeat)
  stored_value_wh INTEGER,
  seen_ts         INTEGER,           -- last time a valid numeric value was seen (the "last report")
  seen_value_wh   INTEGER,
  last_reset      TEXT,              -- state_class total: the last_reset attribute last seen
  unavailable     INTEGER NOT NULL DEFAULT 0
);
