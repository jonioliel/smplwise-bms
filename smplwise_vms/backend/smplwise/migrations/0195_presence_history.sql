-- PRESENCE-2280 (building presence, release 2.28.0). Numbers 0183 (building presence, 2.27.1 line) and 0190/0194 are taken on other branches; this
-- starts at the next free number, 0195. NOTE: 0183 from pilot/BUILDING-PRESENCE-2271 collides with pilot/WISKEY-ADOPT-2272 and must be renumbered at
-- integration (the content does not depend on the number; this file only needs presence_building_sensors to exist before it runs).
-- 1) a sensor can be placed in a room of the owner's choosing; 2) the transition history (N days, off when retention is 0 or the master switch is off).
ALTER TABLE presence_building_sensors ADD COLUMN area_override TEXT;
CREATE TABLE IF NOT EXISTS presence_building_history (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  at        TEXT NOT NULL,
  scope     TEXT NOT NULL,          -- 'building' | 'room'
  area_id   TEXT,                   -- NULL for the building and for sensors with no room
  area_name TEXT,
  status    TEXT NOT NULL           -- 'occupied' | 'clear' | 'unknown'; never a person, a phone or a picture
);
CREATE INDEX IF NOT EXISTS ix_presence_building_history_at ON presence_building_history(at);
