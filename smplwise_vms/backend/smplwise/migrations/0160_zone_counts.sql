-- PROVISIONAL number 0160 (ZONECOUNT107-295, docs/changes/CR-ZONECOUNT107.md): the final number is assigned at integration.
--
-- Presence COUNT per area derived from Frigate review items (read-only, counts only). Shipped OFF (`occupancy.enabled` is absent = off): nothing is
-- written to `zone_count_samples` while it is off, and switching it off through the API deletes the samples.
--
-- Kept: the mapping (Frigate camera key + optional Frigate zone name -> an Arx area id) and a time series of INTEGERS per area. NEVER a name, a
-- face, an identity, a snapshot, a plate, a Frigate object id or a review id. Every instant is ISO-8601 UTC text ending in Z (db.now_iso).
-- Rollback: additive only (two new tables); older code ignores them.

CREATE TABLE zone_count_map (
  id              TEXT PRIMARY KEY,
  recorder_id     TEXT NOT NULL,
  camera_key      TEXT NOT NULL,                       -- the camera's config key on that Frigate (cameras.source_ref)
  frigate_zone    TEXT NOT NULL DEFAULT '',            -- '' = the whole camera view; otherwise the Frigate zone name as seen in a review's zones
  area_id         TEXT NOT NULL,                       -- ha_areas.area_id (plain text, like plan rooms and energy meters)
  created_by      TEXT,
  created_at      TEXT NOT NULL,
  UNIQUE (recorder_id, camera_key, frigate_zone)
);
CREATE INDEX idx_zone_count_map_area ON zone_count_map (area_id);

CREATE TABLE zone_count_samples (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  area_id   TEXT NOT NULL,
  at        TEXT NOT NULL,
  count     INTEGER,                                   -- NULL = unknown (the event source was not fresh); never a guessed zero
  CHECK (count IS NULL OR (count >= 0 AND count <= 1000))
);
CREATE INDEX idx_zone_count_samples_area_time ON zone_count_samples (area_id, at);
