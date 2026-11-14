-- 0008: case items may be snapshots (a JPEG copied from the camera into the case, T046) and carry the stored
-- file's path and hash. SQLite cannot widen a CHECK in place, so the table is rebuilt.

CREATE TABLE case_items_v2 (
  id                TEXT PRIMARY KEY,
  case_id           TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  kind              TEXT NOT NULL CHECK (kind IN ('event', 'clip', 'note', 'snapshot')),
  camera_id         TEXT,
  event_id          TEXT,
  export_job_id     TEXT,
  from_at           TEXT,
  to_at             TEXT,
  note              TEXT NOT NULL DEFAULT '',
  added_by          TEXT NOT NULL,
  added_by_username TEXT NOT NULL DEFAULT '',
  created_at        TEXT NOT NULL,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  file_path         TEXT,                  -- relative to the data dir: cases/<case>/<item>.jpg
  file_sha256       TEXT
);
INSERT INTO case_items_v2 (id, case_id, kind, camera_id, event_id, export_job_id, from_at, to_at, note, added_by, added_by_username, created_at, sort_order)
  SELECT id, case_id, kind, camera_id, event_id, export_job_id, from_at, to_at, note, added_by, added_by_username, created_at, sort_order FROM case_items;
DROP TABLE case_items;
ALTER TABLE case_items_v2 RENAME TO case_items;
CREATE INDEX idx_case_items_case ON case_items (case_id, created_at);
CREATE INDEX idx_case_items_event ON case_items (event_id);
