-- NN5-F1A (docs/changes/CR-029-FRIGATE-PROVIDER.md): the Frigate recorder provider, phase F1 "see and play" (read-only
-- toward Frigate). Additive only (rollback = run the previous version; the tables are ignored by it). Number 0064: 0060 is the
-- released cast migration, 0061 (generator), 0062 (wall profiles) and 0063 (device activity) are in flight on other branches.

-- Review items of a Frigate recorder (Frigate's own unit of "something happened": alert | detection). One row per review id,
-- updated in place while Frigate extends it (end time, objects, zones). The severity LAYER is stored as Frigate reports it;
-- `motion` is a third layer that exists only as activity density (frigate_activity), so a stored row is alert or detection.
-- `event_id` is the mirrored row in `events` (one event per review item) so the event centre, rules and notifications see it.
CREATE TABLE frigate_reviews (
  recorder_id     TEXT NOT NULL,
  review_id       TEXT NOT NULL,                 -- Frigate's id, "<start epoch>-<6 chars>"
  source_ref      TEXT NOT NULL,                 -- the camera's config key on that Frigate
  camera_id       TEXT,                          -- Arx camera row (NULL when the camera is not imported yet)
  severity        TEXT NOT NULL CHECK (severity IN ('alert', 'detection', 'motion')),
  start_ts        REAL NOT NULL,                 -- epoch seconds, as Frigate sends them (UTC by definition)
  end_ts          REAL,                          -- NULL while the item is still open
  objects_json    TEXT NOT NULL DEFAULT '[]',
  zones_json      TEXT NOT NULL DEFAULT '[]',
  sub_labels_json TEXT NOT NULL DEFAULT '[]',
  detections_json TEXT NOT NULL DEFAULT '[]',    -- the tracked-object ids inside (drill-down)
  thumb_time      REAL,
  event_id        TEXT,                          -- events.id of the mirrored row
  last_seen_at    TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  PRIMARY KEY (recorder_id, review_id)
);
CREATE INDEX idx_frigate_reviews_time ON frigate_reviews (recorder_id, start_ts DESC);
CREATE INDEX idx_frigate_reviews_camera ON frigate_reviews (camera_id, start_ts DESC);

-- Per-user "reviewed": kept in Arx only. Frigate's own has_been_reviewed flag is never written (F1 writes nothing to Frigate).
CREATE TABLE frigate_review_state (
  user_id      TEXT NOT NULL,
  recorder_id  TEXT NOT NULL,
  review_id    TEXT NOT NULL,
  reviewed_at  TEXT NOT NULL,
  PRIMARY KEY (user_id, recorder_id, review_id)
);
CREATE INDEX idx_frigate_review_state_item ON frigate_review_state (recorder_id, review_id);

-- Per recorder: the polling cursor, the WebSocket state, and the last capability discovery (features, a SCRUBBED config
-- summary: no stream URL, no user name, no password).
CREATE TABLE frigate_sync_state (
  recorder_id     TEXT PRIMARY KEY,
  last_poll_ts    REAL,                          -- epoch of the newest review start the poll has seen
  last_poll_at    TEXT,
  last_poll_error TEXT,
  ws_state        TEXT NOT NULL DEFAULT 'off',   -- off | connected | down
  ws_changed_at   TEXT,
  ws_frames       INTEGER NOT NULL DEFAULT 0,
  features_json   TEXT NOT NULL DEFAULT '{}',
  summary_json    TEXT NOT NULL DEFAULT '{}',
  discovered_at   TEXT
);

-- "Same place" link between two camera rows of different recorders (the same physical camera on a Hikvision NVR and in
-- Frigate). The field only: no UI and no behaviour depends on it yet (owner decision: design the link, do not build it).
CREATE TABLE camera_links (
  camera_id        TEXT NOT NULL,
  linked_camera_id TEXT NOT NULL,
  kind             TEXT NOT NULL DEFAULT 'same_place',
  created_at       TEXT NOT NULL,
  created_by       TEXT,
  PRIMARY KEY (camera_id, linked_camera_id),
  CHECK (camera_id <> linked_camera_id)
);
CREATE INDEX idx_camera_links_linked ON camera_links (linked_camera_id);
