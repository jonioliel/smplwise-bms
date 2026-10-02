-- CR-021 (docs/changes/CR-021-SELF-UPDATE.md section 7), slice S1: the self-update feature.
-- S1 only reads: the check results live in the existing `settings` key/value table (update.interval_hours, update.checked_at,
-- update.check_result, update.latest, update.permitted); no row is written here. The run table below is created now so that S3
-- (apply and platform restart) needs no second migration. Number 0050: 0049 is the last on integ/0153; Database.migrate() applies gaps.

CREATE TABLE IF NOT EXISTS update_runs (
  id               TEXT PRIMARY KEY,
  created_at       TEXT NOT NULL,
  finished_at      TEXT,
  actor_user_id    TEXT,
  from_version     TEXT NOT NULL,
  to_version       TEXT,
  backup           INTEGER NOT NULL DEFAULT 0,
  restart_platform INTEGER NOT NULL DEFAULT 0,
  state            TEXT NOT NULL CHECK (state IN ('requested', 'backing_up', 'updating', 'restarting', 'verifying', 'succeeded', 'failed', 'abandoned')),
  step             TEXT,
  error_code       TEXT,
  idempotency_key  TEXT UNIQUE,
  backup_ref       TEXT
);
CREATE INDEX IF NOT EXISTS update_runs_created ON update_runs(created_at);
