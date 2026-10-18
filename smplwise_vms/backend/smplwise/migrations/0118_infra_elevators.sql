-- CR-INFRA-ELEVATORS: elevators under Infrastructure (docs/changes/CR-INFRA-ELEVATORS.md). An elevator is a name, an optional area and
-- up to six binary-sensor roles plus up to four free labelled extras. Live state is NOT stored: it is derived on read from the state
-- mirror (ha_entities), like the generator module. No row = the feature is absent (no tab, no home tile).

CREATE TABLE infra_elevators (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  name_key    TEXT NOT NULL,                       -- casefolded, trimmed name: one elevator per name
  area_id     TEXT,                                -- ha_areas.area_id (optional)
  sort_order  INTEGER NOT NULL DEFAULT 0,
  enabled     INTEGER NOT NULL DEFAULT 1,
  revision    INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_infra_elevators_name ON infra_elevators (name_key);

CREATE TABLE infra_elevator_sensors (
  elevator_id TEXT NOT NULL REFERENCES infra_elevators(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('moving_up', 'moving_down', 'waiting', 'fault', 'door_open', 'out_of_service', 'extra')),
  position    INTEGER NOT NULL DEFAULT 0,          -- 0 for the fixed roles; 0..3 for the extras
  entity_id   TEXT NOT NULL,                       -- a binary_sensor.*; returned only to holders of infra.elevators.manage
  label       TEXT,                                -- extras only
  PRIMARY KEY (elevator_id, role, position)
);
CREATE INDEX idx_infra_elevator_sensors_entity ON infra_elevator_sensors (entity_id);
