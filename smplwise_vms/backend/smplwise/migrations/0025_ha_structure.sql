-- CR-007 slice 1 (devices area): the Home Assistant floor and area registries as rows of their own. ha_entities
-- already carries each entity's area / floor ids and names (0004); the tree of "חשמל והתקנים" also needs floors and
-- areas that hold no entity yet, a floor's level and an area's icon, so the sync mirrors both registries here.
-- Rewritten whole on every registry refresh (services/ha_sync.apply_structure); never written by the API.
CREATE TABLE ha_floors (
  floor_id   TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  level      INTEGER,
  icon       TEXT,
  position   INTEGER NOT NULL DEFAULT 0,   -- order in the registry listing (HA sorts its own UI by level, then name)
  updated_at TEXT NOT NULL
);
CREATE TABLE ha_areas (
  area_id    TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  floor_id   TEXT,
  icon       TEXT,
  position   INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_ha_areas_floor ON ha_areas (floor_id);
