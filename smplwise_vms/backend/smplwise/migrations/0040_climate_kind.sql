-- Heating versus air conditioning (owner 2026-09-30): a climate entity that cannot cool (hvac_modes without cool / dry /
-- fan_only: a thermostat, a heat pump, floor heating, pool or water heat) is listed in the "חימום" group, not in
-- "מיזוג". The kind is derived from the entity's own modes; an administrator (system.configure) may override it per
-- entity here. No row = automatic.
CREATE TABLE device_climate_kind (
  entity_id          TEXT PRIMARY KEY,
  kind               TEXT NOT NULL CHECK (kind IN ('ac', 'heating')),
  set_by             TEXT,
  set_by_username    TEXT,
  set_at             TEXT NOT NULL
);
