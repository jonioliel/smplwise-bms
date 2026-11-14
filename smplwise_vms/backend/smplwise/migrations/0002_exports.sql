-- 0002: durable export jobs (MASTER_SPEC ch. 27, T048). Files live under /data/exports/<job id>/.

CREATE TABLE export_jobs (
  id             TEXT PRIMARY KEY,
  owner_user_id  TEXT NOT NULL,
  owner_username TEXT NOT NULL DEFAULT '',
  camera_id      TEXT NOT NULL,
  camera_name    TEXT NOT NULL DEFAULT '',
  requested_from TEXT NOT NULL,           -- UTC ISO
  requested_to   TEXT NOT NULL,
  state          TEXT NOT NULL,           -- queued | running | done | partial | failed | cancelled | interrupted
  progress       REAL NOT NULL DEFAULT 0, -- 0..1
  error          TEXT,
  payload_json   TEXT NOT NULL,           -- files, estimate, output, manifest (no URLs with credentials)
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX idx_export_jobs_owner ON export_jobs (owner_user_id, created_at);
CREATE INDEX idx_export_jobs_state ON export_jobs (state);
