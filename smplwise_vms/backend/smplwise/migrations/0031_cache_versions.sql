-- 0031: change counters for the in-process events-window cache (T068, services/events_cache.py). Triggers bump a counter in
-- the SAME transaction as the write, so a reader that reads the counter and the rows in one transaction always sees a
-- matching pair (no stale entry can be stored under a newer version), and every writer is covered - the alert stream,
-- the recording derivation, HA transitions, acks, pruning, a restore - without each one having to remember to call
-- the cache. Three counters:
--   events       any change to an event row (the list and the timeline show count / ended_at / acked_at)
--   events_rows  rows added or removed, or their facet columns changed (the facets count type / source / severity per
--                camera; a burst that only increments `count` leaves the facets cached)
--   structure    what the lists join or filter by: camera names, sites / buildings / floors, map anchors, zones, and the
--                installation's time zone (local-day bounds)
CREATE TABLE IF NOT EXISTS cache_versions (
  name    TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO cache_versions(name, version) VALUES ('events', 0), ('events_rows', 0), ('structure', 0);

CREATE TRIGGER IF NOT EXISTS trg_cv_events_ins AFTER INSERT ON events BEGIN
  UPDATE cache_versions SET version = version + 1 WHERE name IN ('events', 'events_rows');
END;
CREATE TRIGGER IF NOT EXISTS trg_cv_events_del AFTER DELETE ON events BEGIN
  UPDATE cache_versions SET version = version + 1 WHERE name IN ('events', 'events_rows');
END;
CREATE TRIGGER IF NOT EXISTS trg_cv_events_upd AFTER UPDATE ON events BEGIN
  UPDATE cache_versions SET version = version + 1 WHERE name = 'events';
END;
CREATE TRIGGER IF NOT EXISTS trg_cv_events_upd_facets AFTER UPDATE OF type, source, severity, camera_id, occurred_at ON events BEGIN
  UPDATE cache_versions SET version = version + 1 WHERE name = 'events_rows';
END;

CREATE TRIGGER IF NOT EXISTS trg_cv_cameras_ins AFTER INSERT ON cameras BEGIN
  UPDATE cache_versions SET version = version + 1 WHERE name = 'structure';
END;
CREATE TRIGGER IF NOT EXISTS trg_cv_cameras_del AFTER DELETE ON cameras BEGIN
  UPDATE cache_versions SET version = version + 1 WHERE name = 'structure';
END;
CREATE TRIGGER IF NOT EXISTS trg_cv_cameras_upd AFTER UPDATE OF id, alias, name_source, channel, enabled ON cameras BEGIN
  UPDATE cache_versions SET version = version + 1 WHERE name = 'structure';
END;

CREATE TRIGGER IF NOT EXISTS trg_cv_sites_ins AFTER INSERT ON sites BEGIN UPDATE cache_versions SET version = version + 1 WHERE name = 'structure'; END;
CREATE TRIGGER IF NOT EXISTS trg_cv_sites_upd AFTER UPDATE ON sites BEGIN UPDATE cache_versions SET version = version + 1 WHERE name = 'structure'; END;
CREATE TRIGGER IF NOT EXISTS trg_cv_sites_del AFTER DELETE ON sites BEGIN UPDATE cache_versions SET version = version + 1 WHERE name = 'structure'; END;
CREATE TRIGGER IF NOT EXISTS trg_cv_buildings_ins AFTER INSERT ON buildings BEGIN UPDATE cache_versions SET version = version + 1 WHERE name = 'structure'; END;
CREATE TRIGGER IF NOT EXISTS trg_cv_buildings_upd AFTER UPDATE ON buildings BEGIN UPDATE cache_versions SET version = version + 1 WHERE name = 'structure'; END;
CREATE TRIGGER IF NOT EXISTS trg_cv_buildings_del AFTER DELETE ON buildings BEGIN UPDATE cache_versions SET version = version + 1 WHERE name = 'structure'; END;
CREATE TRIGGER IF NOT EXISTS trg_cv_floors_ins AFTER INSERT ON floors BEGIN UPDATE cache_versions SET version = version + 1 WHERE name = 'structure'; END;
CREATE TRIGGER IF NOT EXISTS trg_cv_floors_upd AFTER UPDATE ON floors BEGIN UPDATE cache_versions SET version = version + 1 WHERE name = 'structure'; END;
CREATE TRIGGER IF NOT EXISTS trg_cv_floors_del AFTER DELETE ON floors BEGIN UPDATE cache_versions SET version = version + 1 WHERE name = 'structure'; END;
CREATE TRIGGER IF NOT EXISTS trg_cv_anchors_ins AFTER INSERT ON map_anchors BEGIN UPDATE cache_versions SET version = version + 1 WHERE name = 'structure'; END;
CREATE TRIGGER IF NOT EXISTS trg_cv_anchors_upd AFTER UPDATE ON map_anchors BEGIN UPDATE cache_versions SET version = version + 1 WHERE name = 'structure'; END;
CREATE TRIGGER IF NOT EXISTS trg_cv_anchors_del AFTER DELETE ON map_anchors BEGIN UPDATE cache_versions SET version = version + 1 WHERE name = 'structure'; END;
CREATE TRIGGER IF NOT EXISTS trg_cv_zones_ins AFTER INSERT ON spatial_zones BEGIN UPDATE cache_versions SET version = version + 1 WHERE name = 'structure'; END;
CREATE TRIGGER IF NOT EXISTS trg_cv_zones_upd AFTER UPDATE ON spatial_zones BEGIN UPDATE cache_versions SET version = version + 1 WHERE name = 'structure'; END;
CREATE TRIGGER IF NOT EXISTS trg_cv_zones_del AFTER DELETE ON spatial_zones BEGIN UPDATE cache_versions SET version = version + 1 WHERE name = 'structure'; END;

CREATE TRIGGER IF NOT EXISTS trg_cv_settings_ins AFTER INSERT ON settings WHEN NEW.key = 'time.zone' BEGIN
  UPDATE cache_versions SET version = version + 1 WHERE name = 'structure';
END;
CREATE TRIGGER IF NOT EXISTS trg_cv_settings_upd AFTER UPDATE ON settings WHEN NEW.key = 'time.zone' OR OLD.key = 'time.zone' BEGIN
  UPDATE cache_versions SET version = version + 1 WHERE name = 'structure';
END;
CREATE TRIGGER IF NOT EXISTS trg_cv_settings_del AFTER DELETE ON settings WHEN OLD.key = 'time.zone' BEGIN
  UPDATE cache_versions SET version = version + 1 WHERE name = 'structure';
END;
