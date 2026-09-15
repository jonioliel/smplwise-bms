-- 0003: events (MASTER_SPEC ch. 26, T031/T032). Raw type, normalized type, provenance, occurrence vs. receipt.

CREATE TABLE events (
  id            TEXT PRIMARY KEY,
  source        TEXT NOT NULL,             -- alertstream | recording | system
  raw_type      TEXT NOT NULL DEFAULT '',  -- device string (VMD, linedetection, videoloss, MOTION …)
  type          TEXT NOT NULL,             -- motion | person | vehicle | line | field | offline | door | coverage_gap | other
  camera_id     TEXT,                      -- NULL for device-level / system events
  channel       INTEGER,
  occurred_at   TEXT NOT NULL,             -- UTC ISO (device time converted)
  ended_at      TEXT,                      -- last repeat / inactive
  received_at   TEXT NOT NULL,
  state         TEXT NOT NULL DEFAULT 'none', -- active | inactive | none
  count         INTEGER NOT NULL DEFAULT 1,
  severity      TEXT NOT NULL DEFAULT 'info', -- info | alert | critical
  confidence    TEXT NOT NULL DEFAULT 'measured', -- measured (device said so) | inferred (derived, e.g. from recording metadata)
  details_json  TEXT,
  dedup_key     TEXT NOT NULL,
  acked_at      TEXT,
  acked_by      TEXT,
  acked_by_username TEXT,
  created_at    TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_events_dedup ON events (dedup_key);
CREATE INDEX idx_events_time ON events (occurred_at DESC);
CREATE INDEX idx_events_camera_time ON events (camera_id, occurred_at DESC);
