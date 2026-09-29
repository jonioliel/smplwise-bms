-- CR-009 (T093, owner 2026-09-29): a shared space - one room (spatial zone) shown whole on a second floor of its
-- building, the double-height sports hall. The zone's own floor is the HOME floor: its plan document and its anchors keep
-- everything inside the room; the other floor stores nothing but this row. Every read of the other floor attaches the
-- home floor's subset (services/shared_spaces.py), and reach is computed from these rows on every request. An un-share
-- keeps the row (removed_at) for the historical map and the audit.
CREATE TABLE IF NOT EXISTS shared_spaces (
  id             TEXT PRIMARY KEY,
  zone_id        TEXT NOT NULL REFERENCES spatial_zones(id),
  home_floor_id  TEXT NOT NULL REFERENCES floors(id),
  floor_id       TEXT NOT NULL REFERENCES floors(id),
  other_zone_id  TEXT REFERENCES spatial_zones(id),            -- the other floor's own outline of the room (two-outline model)
  placement_json TEXT NOT NULL,
  revision       INTEGER NOT NULL DEFAULT 1,
  created_by     TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  removed_at     TEXT,
  removed_by     TEXT
);
-- Members (security review B1): the cameras and devices of the shared space, EXPLICITLY - reach follows this list,
-- never geometry. Set at share time and changed only by "הוסף לחלל המשותף / הסר", which needs the share rights.
-- Keyed by the room (its home zone): a member reaches every floor that shows the room, wherever it is anchored.
CREATE TABLE IF NOT EXISTS shared_space_members (
  id            TEXT PRIMARY KEY,
  zone_id       TEXT NOT NULL REFERENCES spatial_zones(id),
  resource_type TEXT NOT NULL CHECK (resource_type IN ('camera', 'ha_entity')),
  resource_id   TEXT NOT NULL,
  added_by      TEXT,
  added_at      TEXT NOT NULL,
  removed_at    TEXT,
  removed_by    TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_shared_members_active ON shared_space_members (zone_id, resource_type, resource_id) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_shared_members_resource ON shared_space_members (resource_type, resource_id, removed_at);
CREATE TRIGGER IF NOT EXISTS trg_cv_shared_members_ins AFTER INSERT ON shared_space_members BEGIN UPDATE cache_versions SET version = version + 1 WHERE name = 'structure'; END;
CREATE TRIGGER IF NOT EXISTS trg_cv_shared_members_upd AFTER UPDATE ON shared_space_members BEGIN UPDATE cache_versions SET version = version + 1 WHERE name = 'structure'; END;
CREATE TRIGGER IF NOT EXISTS trg_cv_shared_members_del AFTER DELETE ON shared_space_members BEGIN UPDATE cache_versions SET version = version + 1 WHERE name = 'structure'; END;
CREATE UNIQUE INDEX IF NOT EXISTS ux_shared_spaces_active ON shared_spaces (zone_id, floor_id) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_shared_spaces_floor ON shared_spaces (floor_id, removed_at);
CREATE INDEX IF NOT EXISTS idx_shared_spaces_home ON shared_spaces (home_floor_id, removed_at);

-- the events-list cache joins floors, zones and anchors (0031): a share changes which cameras a floor filter holds
CREATE TRIGGER IF NOT EXISTS trg_cv_shared_ins AFTER INSERT ON shared_spaces BEGIN UPDATE cache_versions SET version = version + 1 WHERE name = 'structure'; END;
CREATE TRIGGER IF NOT EXISTS trg_cv_shared_upd AFTER UPDATE ON shared_spaces BEGIN UPDATE cache_versions SET version = version + 1 WHERE name = 'structure'; END;
CREATE TRIGGER IF NOT EXISTS trg_cv_shared_del AFTER DELETE ON shared_spaces BEGIN UPDATE cache_versions SET version = version + 1 WHERE name = 'structure'; END;
