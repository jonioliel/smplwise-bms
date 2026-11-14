-- CR-022 (docs/changes/CR-022-NVR-CONNECTION-IN-ARX.md section 4): the NVR connection lives in Arx, not in the add-on options.
-- One row per recorder connection, keyed by recorder id (`nvr-1` today), so a second recorder (NN1 P5) reuses this table.
-- No foreign key to `recorders`: the row must survive a `recorders` replace (backup restore) - this table is never in an archive.
-- Only `password_enc` (and the reserved `secret_json_enc`) hold a secret, always as an AES-256-GCM `v1:` blob written by
-- services/connection_store.py with its own key file `<data>/keys/connections.key`; host and user are not secrets but are
-- returned only to system.configure holders. No back-fill here: the one-time import of the add-on options is code
-- (connection_store.import_legacy), so a key problem never blocks a migration. Older code ignores the table (rollback).

CREATE TABLE IF NOT EXISTS recorder_connections (
  recorder_id     TEXT PRIMARY KEY,
  vendor          TEXT NOT NULL CHECK (vendor IN ('hikvision', 'provision_isr', 'frigate', 'none')),
  host            TEXT,
  http_port       INTEGER CHECK (http_port IS NULL OR (http_port BETWEEN 1 AND 65535)),
  rtsp_port       INTEGER CHECK (rtsp_port IS NULL OR (rtsp_port BETWEEN 1 AND 65535)),
  username        TEXT,
  password_enc    TEXT,
  secret_json_enc TEXT,
  extra_json      TEXT NOT NULL DEFAULT '{}',
  enabled         INTEGER NOT NULL DEFAULT 1,
  state           TEXT NOT NULL DEFAULT 'ok' CHECK (state IN ('ok', 'incomplete')),
  revision        INTEGER NOT NULL DEFAULT 1,
  source          TEXT NOT NULL CHECK (source IN ('ui', 'addon_import')),
  updated_at      TEXT NOT NULL,
  updated_by      TEXT
);
