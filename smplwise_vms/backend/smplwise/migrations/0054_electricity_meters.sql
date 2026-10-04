-- CR-023 phase P1 (electricity meters and readings): the meter registry in the main database.
-- Number 0054 set at integration (0050-0053 belong to other branches; billing is 0055_electricity_billing.sql).
-- The time-series itself lives in its own file energy.db
-- (services/energy_store.py, migrations_energy/), never here. Contract: docs/architecture/ELECTRICITY_INTERFACES.md.

CREATE TABLE energy_meters (
  id             TEXT PRIMARY KEY,
  source_kind    TEXT NOT NULL DEFAULT 'ha_entity' CHECK (source_kind IN ('ha_entity', 'satec')),
  source_ref     TEXT NOT NULL,                 -- the entity id; never printed on a bill or a PDF
  display_name   TEXT NOT NULL,
  unit           TEXT NOT NULL CHECK (unit IN ('kWh', 'Wh', 'MWh')),
  unit_factor    INTEGER NOT NULL CHECK (unit_factor IN (1, 1000, 1000000)),   -- Wh per source unit
  area_id        TEXT,                          -- override of the entity's own area (NULL = the entity's)
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'retired')),
  status_reason  TEXT,                          -- manual | unit_changed | source_missing | NULL
  max_kw         REAL NOT NULL DEFAULT 100,     -- plausibility cap of the jump rule
  revision       INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL,
  created_by     TEXT,
  updated_at     TEXT NOT NULL,
  retired_at     TEXT
);
-- one live meter per entity (a retired meter keeps its row and data; the entity may be registered again)
CREATE UNIQUE INDEX idx_energy_meters_live_ref ON energy_meters (source_kind, source_ref) WHERE status <> 'retired';

CREATE TABLE energy_meter_epochs (
  id                TEXT PRIMARY KEY,
  meter_id          TEXT NOT NULL REFERENCES energy_meters(id) ON DELETE CASCADE,
  started_at        TEXT NOT NULL,
  ended_at          TEXT,                       -- NULL = the current counter life
  start_reading_wh  INTEGER,
  end_reading_wh    INTEGER,
  reason            TEXT NOT NULL CHECK (reason IN ('first', 'replaced', 'source_changed')),
  source_ref        TEXT NOT NULL,
  note              TEXT,
  created_by        TEXT,
  created_at        TEXT NOT NULL
);
CREATE INDEX idx_energy_meter_epochs_meter ON energy_meter_epochs (meter_id, started_at);
