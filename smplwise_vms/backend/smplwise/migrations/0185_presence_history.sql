-- PRESENCE-2280 (building presence, release 2.28.0). Number 0185 (renumbered at integration into release/2280-train from the provisional 0195;
-- order 0184 -> 0185 must be kept: this file only needs presence_building_sensors to exist before it runs; the content does not depend on the number).
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
