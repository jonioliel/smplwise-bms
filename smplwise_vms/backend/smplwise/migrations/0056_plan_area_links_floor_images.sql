-- Plan Studio advanced (K88, 2.0.1).
-- 1. A plan room may point at one area of the device tree (optional). `ha_area_id` is a plain text id: the area
--    registry (ha_areas) is rewritten whole on every refresh, so no foreign key; a dangling id reads as "unlinked".
ALTER TABLE spatial_zones ADD COLUMN ha_area_id TEXT;
CREATE INDEX IF NOT EXISTS idx_spatial_zones_area ON spatial_zones(ha_area_id) WHERE ha_area_id IS NOT NULL;

-- 2. Own floor images (CR-006 2c without AI): one picture per floor and variant (lights off / lights on), made anywhere,
--    stored under <data>/plans/floor-images/<floor id>/ so the backup's plan root covers it. Both variants share one
--    alignment: the plan-normalized positions of the image's four corners (top-left, top-right, bottom-right, bottom-left).
CREATE TABLE IF NOT EXISTS floor_images (
  id TEXT PRIMARY KEY,
  floor_id TEXT NOT NULL REFERENCES floors(id),
  variant TEXT NOT NULL CHECK (variant IN ('off', 'on')),
  path TEXT NOT NULL,
  mime TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (floor_id, variant)
);
CREATE TABLE IF NOT EXISTS floor_image_layout (
  floor_id TEXT PRIMARY KEY REFERENCES floors(id),
  corners_json TEXT NOT NULL,
  opacity REAL NOT NULL DEFAULT 1.0,
  updated_by TEXT,
  updated_at TEXT NOT NULL
);
