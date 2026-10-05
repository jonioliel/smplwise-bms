-- EL6 (CR-023 follow-up): manual readings of the physical electricity meter and calibration of the system counter against it.
-- Number 0058: the next free number after fetching every origin branch on 2026-10-05 (main ends at 0056; 0057 is
-- pilot/mobile-presence-push-server's 0057_mobile_presence_push.sql). Design: docs/changes/EL6-MANUAL-READING-CALIBRATION.md.
-- Nothing here is ever rewritten: a reading or a calibration is voided (undo window), never edited or deleted.

-- A typed reading of the physical meter at an instant. value_wh is what the meter showed; counter_wh the same value on the
-- system counter's own scale (through the calibration in force at read_at); system_raw_wh / system_exact what the system's
-- counter said at that instant before the reading was saved (the deviation shown next to it, and the calibration suggestion).
CREATE TABLE energy_meter_manual_readings (
  id             TEXT PRIMARY KEY,
  meter_id       TEXT NOT NULL REFERENCES energy_meters(id) ON DELETE CASCADE,
  epoch_id       TEXT NOT NULL,                 -- the counter life the instant belongs to
  read_at        TEXT NOT NULL,                 -- UTC ISO
  value_wh       INTEGER NOT NULL CHECK (value_wh >= 0),
  typed_value    TEXT NOT NULL,                 -- as typed (decimal text)
  typed_unit     TEXT NOT NULL CHECK (typed_unit IN ('kWh', 'Wh', 'MWh')),
  counter_wh     INTEGER NOT NULL,
  system_raw_wh  INTEGER,                       -- NULL = the system had no value at that instant
  system_exact   INTEGER NOT NULL DEFAULT 0,    -- 1 = a system reading lies within 15 minutes of read_at
  effect         TEXT NOT NULL CHECK (effect IN ('allocation', 'record')),
  effect_reason  TEXT NOT NULL,                 -- open_gap | closed_gap | reported | outside_counter | no_counter_data | counter_events | implausible | billed
  span_from      TEXT,                          -- allocation: the counter reading before (UTC ISO)
  span_to        TEXT,                          -- allocation: the counter reading after (NULL = an open gap)
  note           TEXT,
  created_by     TEXT,
  created_at     TEXT NOT NULL,
  voided_at      TEXT,
  voided_by      TEXT,
  void_reason    TEXT
);
CREATE INDEX idx_energy_manual_readings_meter ON energy_meter_manual_readings (meter_id, read_at);

-- physical = factor x system counter + offset_wh, from local midnight of effective_date (installation zone) until the next
-- calibration of the same counter life, or the end of that life (a replaced meter starts uncalibrated).
CREATE TABLE energy_meter_calibrations (
  id                 TEXT PRIMARY KEY,
  meter_id           TEXT NOT NULL REFERENCES energy_meters(id) ON DELETE CASCADE,
  epoch_id           TEXT NOT NULL,
  effective_date     TEXT NOT NULL,             -- YYYY-MM-DD, local
  effective_from     TEXT NOT NULL,             -- UTC ISO of that local midnight
  factor             TEXT NOT NULL,             -- decimal text, 0.5 - 2
  offset_wh          INTEGER NOT NULL DEFAULT 0,
  anchor_reading_id  TEXT,                      -- the manual reading the offset was taken from (NULL = typed)
  note               TEXT,
  created_by         TEXT,
  created_at         TEXT NOT NULL,
  voided_at          TEXT,
  voided_by          TEXT,
  void_reason        TEXT
);
CREATE INDEX idx_energy_calibrations_meter ON energy_meter_calibrations (meter_id, effective_from);
