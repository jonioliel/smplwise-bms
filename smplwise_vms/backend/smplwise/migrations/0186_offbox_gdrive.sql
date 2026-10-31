-- Number 0186 (the next free number on main at v2.29.0; built on pilot/GDRIVEBK-2310). Re-check at the integration.
-- GDRIVEBK-2310: Google Drive becomes one more off-box target kind. Design: docs/design/GDRIVE_BACKUP.md.
--  - backup_offbox_targets.kind gains 'gdrive' (the configuration holds the client id, the folder name and the transfer knobs - never a secret);
--  - backup_offbox_secrets.field gains 'client_secret' (typed by the administrator, write-only) and 'refresh_token' (only ever written by the
--    Google consent flow, never typed, never returned). Both are sealed with the installation key like the S3 / SFTP credentials.
-- SQLite cannot widen a CHECK, so the three tables are rebuilt with every row kept. The children are copied aside and dropped BEFORE the
-- parent: dropping backup_offbox_targets while backup_offbox_secrets / _runs still reference it would cascade-delete their rows
-- (foreign_keys is ON and cannot be switched off inside the migration's transaction).
-- Rollback: the previous version reads these tables unchanged; a 'gdrive' row would fail its kind CHECK only on a rebuild, which no older
-- migration does. To go back fully, delete the gdrive targets first (their copies stay in the Google Drive folder).

CREATE TABLE _offbox_targets_0186 AS SELECT * FROM backup_offbox_targets;
CREATE TABLE _offbox_secrets_0186 AS SELECT * FROM backup_offbox_secrets;
CREATE TABLE _offbox_runs_0186 AS SELECT * FROM backup_offbox_runs;
DROP TABLE backup_offbox_secrets;
DROP TABLE backup_offbox_runs;
DROP TABLE backup_offbox_targets;

CREATE TABLE backup_offbox_targets (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  kind           TEXT NOT NULL CHECK (kind IN ('s3', 'sftp', 'local', 'gdrive')),
  enabled        INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  config_json    TEXT NOT NULL DEFAULT '{}',
  retention_json TEXT NOT NULL DEFAULT '{}',
  revision       INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL,
  created_by     TEXT,
  updated_at     TEXT NOT NULL,
  updated_by     TEXT
);
INSERT INTO backup_offbox_targets(id, name, kind, enabled, config_json, retention_json, revision, created_at, created_by, updated_at, updated_by)
  SELECT id, name, kind, enabled, config_json, retention_json, revision, created_at, created_by, updated_at, updated_by FROM _offbox_targets_0186;

CREATE TABLE backup_offbox_secrets (
  target_id   TEXT NOT NULL REFERENCES backup_offbox_targets(id) ON DELETE CASCADE,
  field       TEXT NOT NULL CHECK (field IN ('access_key', 'secret_key', 'key', 'client_secret', 'refresh_token')),
  value_enc   TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  updated_by  TEXT,
  PRIMARY KEY (target_id, field)
);
INSERT INTO backup_offbox_secrets(target_id, field, value_enc, updated_at, updated_by)
  SELECT target_id, field, value_enc, updated_at, updated_by FROM _offbox_secrets_0186;

CREATE TABLE backup_offbox_runs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  target_id     TEXT NOT NULL REFERENCES backup_offbox_targets(id) ON DELETE CASCADE,
  action        TEXT NOT NULL CHECK (action IN ('push', 'test', 'drill', 'dry_run')),
  trigger       TEXT NOT NULL,
  started_at    TEXT NOT NULL,
  finished_at   TEXT,
  ok            INTEGER NOT NULL DEFAULT 0 CHECK (ok IN (0, 1)),
  error         TEXT,
  object        TEXT,
  key_id        TEXT,
  sealed_bytes  INTEGER,
  verified      INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0, 1)),
  deleted_count INTEGER NOT NULL DEFAULT 0,
  detail_json   TEXT NOT NULL DEFAULT '{}'
);
INSERT INTO backup_offbox_runs(id, target_id, action, trigger, started_at, finished_at, ok, error, object, key_id, sealed_bytes, verified,
                               deleted_count, detail_json)
  SELECT id, target_id, action, trigger, started_at, finished_at, ok, error, object, key_id, sealed_bytes, verified, deleted_count, detail_json
  FROM _offbox_runs_0186;
CREATE INDEX backup_offbox_runs_target ON backup_offbox_runs(target_id, id);

DROP TABLE _offbox_targets_0186;
DROP TABLE _offbox_secrets_0186;
DROP TABLE _offbox_runs_0186;
