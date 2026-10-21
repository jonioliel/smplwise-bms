-- Final number 0136 (built as PROVISIONAL 0132 on pilot/DATASTORE-295; renumbered at the 2.10.2 integration, integ/2102: 0135 is the last on integ/2101).
-- The content does not depend on the number.
--
-- Off-box copies of the project backups (owner decision 2026-10-20: both S3-compatible and SFTP targets). Design:
-- docs/architecture/DATA_STORE_HARDENING.md. Installation-local: none of these tables is a backup table (services/backup.py lists
-- what an archive carries), so a restore never brings a target, a credential or a run history from another installation.
--  - backup_offbox_targets: the administrator's targets; `config_json` holds only NON-secret fields (endpoint, bucket, host, the
--    pinned host key ...) and `store:` references for the credentials.
--  - backup_offbox_secrets: the credential values, each sealed with the installation key (services/connection_store.seal_app_secret,
--    name `offbox_<target id>_<field>`); never returned by the API, never logged.
--  - backup_offbox_runs: one row per push / connection test / drill of a target (codes and counts only - never a credential).
-- Rollback: older code never reads these tables; dropping them loses only the targets' configuration (the copies stay at the targets
-- and the keyring stays in /data/keys).

CREATE TABLE backup_offbox_targets (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  kind           TEXT NOT NULL CHECK (kind IN ('s3', 'sftp', 'local')),
  enabled        INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  config_json    TEXT NOT NULL DEFAULT '{}',
  retention_json TEXT NOT NULL DEFAULT '{}',
  revision       INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL,
  created_by     TEXT,
  updated_at     TEXT NOT NULL,
  updated_by     TEXT
);

CREATE TABLE backup_offbox_secrets (
  target_id   TEXT NOT NULL REFERENCES backup_offbox_targets(id) ON DELETE CASCADE,
  field       TEXT NOT NULL CHECK (field IN ('access_key', 'secret_key', 'key')),
  value_enc   TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  updated_by  TEXT,
  PRIMARY KEY (target_id, field)
);

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
CREATE INDEX backup_offbox_runs_target ON backup_offbox_runs(target_id, id);
