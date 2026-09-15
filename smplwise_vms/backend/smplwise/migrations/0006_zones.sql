-- Spatial zones (design M13): named rooms/areas as normalized polygons on a floor, separate from the plan
-- image and from camera detection zones; 'auto' rows come from the local room detection, 'manual' from the editor.
CREATE TABLE spatial_zones (
  id              TEXT PRIMARY KEY,
  floor_id        TEXT NOT NULL REFERENCES floors(id),
  plan_version_id TEXT,
  name            TEXT NOT NULL DEFAULT '',
  kind            TEXT NOT NULL DEFAULT 'room' CHECK (kind IN ('room', 'zone', 'corridor', 'outdoor', 'service')),
  polygon_json    TEXT NOT NULL,
  color           TEXT,
  source          TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('auto', 'manual')),
  searchable      INTEGER NOT NULL DEFAULT 1,
  revision        INTEGER NOT NULL DEFAULT 1,
  created_by      TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  deleted_at      TEXT
);
CREATE INDEX idx_spatial_zones_floor ON spatial_zones (floor_id, deleted_at);
