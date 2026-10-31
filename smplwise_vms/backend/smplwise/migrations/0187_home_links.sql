-- SYNOPTIC-HA-2310: which of our floors a home-platform floor / area belongs to (the cross-section and the synoptic map read their
-- per-floor numbers through it). Number 0186 is provisional: renumber at train integration if another branch took it (the content
-- does not depend on the number).
-- Generic mapping rows keyed by the PLATFORM id -> our floor id, the layers of docs/changes/PROPOSAL-MULTI-BUILDING-HOME.md
-- (branch pilot/MULTI-BUILDING-HOME-PLAN): layer 1 = one row per platform floor, layer 2 = per-area override. Layer 3 (map placement)
-- is the plan rooms' own link (spatial_zones.ha_area_id, 0056) and is not stored here. Our floor already belongs to a building, so a
-- building level needs no change to these rows. Plain text ids (like spatial_zones.ha_area_id): a platform floor / area that disappears
-- leaves a dangling row the screens ignore; a row whose floor is deleted is ignored on read.
CREATE TABLE IF NOT EXISTS home_floor_links (
  ha_floor_id TEXT PRIMARY KEY,         -- the platform floor
  floor_id    TEXT NOT NULL,            -- our floor (floors.id)
  updated_at  TEXT NOT NULL,
  updated_by  TEXT
);
CREATE INDEX IF NOT EXISTS idx_home_floor_links_floor ON home_floor_links(floor_id);
CREATE TABLE IF NOT EXISTS home_area_links (
  area_id    TEXT PRIMARY KEY,          -- the platform area
  floor_id   TEXT,                      -- our floor; NULL = taken off every floor by hand ("לא משויך")
  updated_at TEXT NOT NULL,
  updated_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_home_area_links_floor ON home_area_links(floor_id);
