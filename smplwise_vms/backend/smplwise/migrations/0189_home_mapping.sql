-- MAPPING-ASSIST-2330 (owner approval 31.10, round 10 mapping mockup v3): the mapping assistant - "which home-system name belongs to which of
-- our buildings". Number 0189 is the next free after 0188 (MULTIBUILDING-HOME-2330); renumber at train integration if another branch took it.
--
-- 1. The area -> building rows of the home's site level: an area the assistant puts in a building where none of OUR floors fits (no platform
--    floor, or a building other than its floor's without a floor of the same level). The floor rows of 0187 stay the main mapping; this
--    table only adds what a floor row cannot say. Plain text ids like 0187: a dangling row is ignored on read.
CREATE TABLE IF NOT EXISTS home_area_buildings (
  area_id     TEXT PRIMARY KEY,         -- the platform area
  building_id TEXT NOT NULL,            -- our building (buildings.id)
  updated_at  TEXT NOT NULL,
  updated_by  TEXT
);
CREATE INDEX IF NOT EXISTS idx_home_area_buildings_building ON home_area_buildings(building_id);

-- 2. The assistant's working state per site: the mark (where the building is written in a name), the token table, the ordered rules and the
--    manual decisions (one JSON object, read back through frontend/src/api/mapping-engine.ts stateOf), the assistant's settings, and a
--    revision for the editor's conflict check. Nothing here touches the home system.
CREATE TABLE IF NOT EXISTS home_mapping_state (
  site_id       TEXT PRIMARY KEY,
  state_json    TEXT NOT NULL DEFAULT '{}',
  settings_json TEXT NOT NULL DEFAULT '{}',
  revision      INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT,
  updated_by    TEXT
);

-- 3. Every apply is a version: the state it was made from, the mapping rows before and after (all three row tables: 0187 floors / areas and
--    1. above), the item keys it saw (the health card's "new since the last apply") and a summary. "חזרה לגרסה זו" writes a NEW version with
--    that version's rows and state; nothing is deleted (buildings / floors an apply created stay).
CREATE TABLE IF NOT EXISTS home_mapping_versions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id          TEXT NOT NULL,
  number           INTEGER NOT NULL,
  kind             TEXT NOT NULL CHECK (kind IN ('apply', 'confirm', 'auto', 'restore')),
  restored_from    INTEGER,
  state_json       TEXT NOT NULL,
  rows_before_json TEXT NOT NULL,
  rows_after_json  TEXT NOT NULL,
  items_json       TEXT NOT NULL DEFAULT '[]',
  summary_json     TEXT NOT NULL DEFAULT '{}',
  note             TEXT NOT NULL DEFAULT '',
  created_at       TEXT NOT NULL,
  created_by       TEXT,
  UNIQUE (site_id, number)
);
