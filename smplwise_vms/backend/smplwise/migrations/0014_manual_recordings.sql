-- Manual recordings started from the VMS (A1): the NVR does not report their state, so the VMS keeps its own and
-- stops them itself when the time is up (janitor, every 30 s).
CREATE TABLE manual_recordings (
  id              TEXT PRIMARY KEY,
  camera_id       TEXT NOT NULL,
  track_id        INTEGER NOT NULL,
  started_at      TEXT NOT NULL,
  stop_at         TEXT NOT NULL,            -- planned automatic stop
  stopped_at      TEXT,
  stop_reason     TEXT,                     -- user | expired | restart
  actor_id        TEXT,
  actor_username  TEXT
);
CREATE INDEX idx_manual_recordings_open ON manual_recordings (stopped_at, stop_at);
