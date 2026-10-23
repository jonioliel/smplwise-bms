-- Final number 0150 (built as PROVISIONAL 0152; renumbered at the 2.14.0 integration, release/2140) (CR-WATER78, pilot/WATER78-295). ONE file for the
-- water module slice 1 (released in 2.14.0: slice 2 adds its alert tables in a NEW migration, never here). The content does not depend on the number.
--
-- CR-WATER78 slice 1 (water meters, readings, consumption): the meter registry in the main database. The time-series lives in its
-- own file water.db (services/water_meters.py opens it through the energy store with the water medium profile), never here.
-- Volumes are integer millilitres (mL); `unit_factor` is MICRO-litres per source unit so gallons and cubic feet stay exact
-- integers (CR-WATER78 section 14, C2). Rollback: drop these tables and delete the `water.*` settings; nothing else reads them.

CREATE TABLE water_meters (
  id             TEXT PRIMARY KEY,
  medium         TEXT NOT NULL DEFAULT 'water' CHECK (medium IN ('water', 'gas')),   -- 'gas' reserved (owner Q2: reserve only)
  source_kind    TEXT NOT NULL DEFAULT 'ha_entity' CHECK (source_kind IN ('ha_entity')),
  source_ref     TEXT NOT NULL,                 -- the entity id; shown only to water.manage
  display_name   TEXT NOT NULL,
  unit           TEXT NOT NULL CHECK (unit IN ('L', 'm3', 'gal', 'ft3')),
  unit_factor    INTEGER NOT NULL CHECK (unit_factor IN (1000000, 1000000000, 3785412, 28316847)),   -- micro-litres per source unit
  area_id        TEXT,                          -- override of the entity's own area (NULL = the entity's)
  kind           TEXT NOT NULL DEFAULT 'main' CHECK (kind IN ('main', 'sub', 'irrigation', 'cooling', 'pool', 'other')),
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'retired')),
  status_reason  TEXT,                          -- manual | unit_changed | NULL
  max_flow_lph   REAL NOT NULL DEFAULT 20000,   -- plausibility cap, litres per hour
  rules_json     TEXT,                          -- slice 2: per-meter overrides of the leak rules (NULL = the installation defaults)
  revision       INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL,
  created_by     TEXT,
  updated_at     TEXT NOT NULL,
  retired_at     TEXT
);
-- one live meter per entity (a retired meter keeps its row and data; the entity may be registered again)
CREATE UNIQUE INDEX idx_water_meters_live_ref ON water_meters (source_kind, source_ref) WHERE status <> 'retired';

CREATE TABLE water_meter_epochs (
  id                TEXT PRIMARY KEY,
  meter_id          TEXT NOT NULL REFERENCES water_meters(id) ON DELETE CASCADE,
  started_at        TEXT NOT NULL,
  ended_at          TEXT,                       -- NULL = the current counter life
  start_reading_ml  INTEGER,
  end_reading_ml    INTEGER,
  reason            TEXT NOT NULL CHECK (reason IN ('first', 'replaced', 'source_changed')),
  source_ref        TEXT NOT NULL,
  note              TEXT,
  created_by        TEXT,
  created_at        TEXT NOT NULL
);
CREATE INDEX idx_water_meter_epochs_meter ON water_meter_epochs (meter_id, started_at);

-- A typed reading of the physical meter (the 0058 rules: an open or closed reporting gap is allocated, everything else is recorded
-- only). Never edited or deleted: undone (voided) instead.
CREATE TABLE water_meter_manual_readings (
  id             TEXT PRIMARY KEY,
  meter_id       TEXT NOT NULL REFERENCES water_meters(id) ON DELETE CASCADE,
  epoch_id       TEXT NOT NULL,
  read_at        TEXT NOT NULL,                 -- UTC ISO
  value_ml       INTEGER NOT NULL CHECK (value_ml >= 0),
  typed_value    TEXT NOT NULL,                 -- as typed (decimal text)
  typed_unit     TEXT NOT NULL CHECK (typed_unit IN ('L', 'm3')),
  effect         TEXT NOT NULL CHECK (effect IN ('allocation', 'record')),
  effect_reason  TEXT NOT NULL,
  note           TEXT,
  created_by     TEXT,
  created_at     TEXT NOT NULL,
  voided_at      TEXT,
  voided_by      TEXT,
  void_reason    TEXT
);
CREATE INDEX idx_water_manual_readings_meter ON water_meter_manual_readings (meter_id, read_at);
