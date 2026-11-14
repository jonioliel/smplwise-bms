-- CR-014: schedules of the scheduler component. The component (HA storage) is the authority for definitions; these
-- tables hold Arx's read cache, Arx-only organisation, the 30-day trash, derived runs and write ops.
CREATE TABLE schedule_cache (
  schedule_id   TEXT PRIMARY KEY,
  entity_id     TEXT,
  revision      TEXT NOT NULL,
  item_json     TEXT NOT NULL,           -- the component's item, verbatim
  enabled       INTEGER NOT NULL DEFAULT 1,
  seen_at       TEXT NOT NULL,
  changed_at    TEXT NOT NULL
);
CREATE TABLE schedule_folders (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  position      INTEGER NOT NULL,
  created_at    TEXT NOT NULL,
  created_by    TEXT
);
CREATE TABLE schedule_meta (
  schedule_id          TEXT PRIMARY KEY,
  created_via          TEXT NOT NULL CHECK (created_via IN ('arx', 'external')),
  created_by           TEXT,
  created_by_username  TEXT,
  created_at           TEXT,
  updated_by           TEXT,
  updated_by_username  TEXT,
  updated_at           TEXT,
  folder_id            TEXT REFERENCES schedule_folders(id) ON DELETE SET NULL,
  sort_key             INTEGER,
  pinned               INTEGER NOT NULL DEFAULT 0,
  first_seen_at        TEXT NOT NULL,
  last_seen_at         TEXT NOT NULL,
  gone_at              TEXT
);
CREATE TABLE schedule_trash (
  id                   TEXT PRIMARY KEY,
  schedule_id          TEXT NOT NULL,
  name                 TEXT,
  item_json            TEXT NOT NULL,
  meta_json            TEXT,
  entities_json        TEXT NOT NULL,
  sensitive            INTEGER NOT NULL DEFAULT 0,
  deleted_by           TEXT,
  deleted_by_username  TEXT,
  deleted_at           TEXT NOT NULL,
  expires_at           TEXT NOT NULL,
  restored_at          TEXT,
  restored_schedule_id TEXT
);
CREATE INDEX idx_schedule_trash_expires ON schedule_trash (expires_at);
CREATE TABLE schedule_runs (
  id            TEXT PRIMARY KEY,
  schedule_id   TEXT NOT NULL,
  slot_index    INTEGER,
  started_at    TEXT NOT NULL,
  settled_at    TEXT,
  result        TEXT NOT NULL CHECK (result IN ('pending', 'confirmed', 'not_confirmed', 'skipped', 'unknown')),
  sensitive     INTEGER NOT NULL DEFAULT 0,
  via           TEXT NOT NULL DEFAULT 'component',
  detail_json   TEXT
);
CREATE INDEX idx_schedule_runs_schedule ON schedule_runs (schedule_id, started_at);
CREATE INDEX idx_schedule_runs_started ON schedule_runs (started_at);
CREATE TABLE schedule_ops (
  id                 TEXT PRIMARY KEY,
  principal_user_id  TEXT NOT NULL,
  principal_username TEXT,
  client_request_id  TEXT NOT NULL,
  op                 TEXT NOT NULL,
  schedule_id        TEXT,
  status             TEXT NOT NULL CHECK (status IN ('pending', 'ok', 'failed', 'unknown')),
  error              TEXT,
  requested_at       TEXT NOT NULL,
  responded_at       TEXT
);
CREATE UNIQUE INDEX idx_schedule_ops_client ON schedule_ops (principal_user_id, client_request_id);
