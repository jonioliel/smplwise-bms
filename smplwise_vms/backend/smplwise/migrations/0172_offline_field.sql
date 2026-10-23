-- OFFLINE110-295 slice 1 (server side of offline field work, task r110; owner answers 342-350, 24.10): the technician's work bundle, the
-- device lock / wipe state, the replayed offline changes with their outcome, manager review of held changes, the day-list receipt and the
-- round points whose signed QR / NFC tags are verified on the server. Final number 0172 (built as PROVISIONAL 0160; renumbered at the
-- 2.17.0 integration, release/2170). Additive only: rollback = run the previous version, the tables are ignored by it. No secret here (the tag key lives in
-- a file under the data directory, never in the database).
CREATE TABLE offline_devices (
  device_id         TEXT NOT NULL,
  user_id           TEXT NOT NULL,
  state             TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'locked', 'wipe_pending', 'wiped')),
  lock_reason       TEXT,
  bundle_issued_at  TEXT,
  valid_until       TEXT,
  last_seen_at      TEXT,
  wipe_requested_at TEXT,
  wipe_confirmed_at TEXT,
  created_at        TEXT NOT NULL,
  PRIMARY KEY (user_id, device_id)
);

CREATE TABLE offline_ops (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL,
  device_id         TEXT NOT NULL,
  client_request_id TEXT NOT NULL,
  ticket_id         TEXT,
  base_revision     INTEGER,
  op_type           TEXT NOT NULL,
  payload_json      TEXT NOT NULL DEFAULT '{}',
  claimed_at        TEXT,                      -- the phone's clock: metadata only, never trusted
  received_at       TEXT NOT NULL,             -- the server's clock
  outcome           TEXT NOT NULL CHECK (outcome IN ('applied', 'noted', 'held', 'rejected')),
  reason            TEXT,
  review_state      TEXT NOT NULL DEFAULT 'none' CHECK (review_state IN ('none', 'pending', 'approved', 'dismissed')),
  reviewed_by       TEXT,
  reviewed_at       TEXT,
  review_note       TEXT,
  UNIQUE (user_id, client_request_id)
);
CREATE INDEX idx_offline_ops_review ON offline_ops (review_state, received_at);

CREATE TABLE offline_day_acks (
  user_id    TEXT NOT NULL,
  day        TEXT NOT NULL,                    -- local date YYYY-MM-DD
  device_id  TEXT,
  acked_at   TEXT NOT NULL,
  PRIMARY KEY (user_id, day)
);

CREATE TABLE offline_round_points (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  entity_id  TEXT,
  place_text TEXT NOT NULL DEFAULT '',
  enabled    INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
