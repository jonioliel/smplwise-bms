-- CR-READY96 slice 1 (docs/changes/CR-READY96.md): the installation readiness score - the installer's attestation of what the system cannot measure,
-- and the score history. Final number 0159 (built as PLACEHOLDER 0152 on pilot/READYFLEET-295; renumbered at the 2.15.0 integration, release/2150).
-- Additive only: rollback = run the previous version, the tables are ignored by it. Neither table is a backup table (never written to an archive,
-- never restored): they describe THIS installation's hand-over, not the project.
CREATE TABLE readiness_attestations (
  check_id     TEXT PRIMARY KEY,             -- 'handover' (the only configured check in slice 1)
  done         INTEGER NOT NULL DEFAULT 0,
  note         TEXT,
  payload_json TEXT,                         -- customer_name, printed_guide, below_advice (the hand-over was recorded under the advised score)
  user_id      TEXT NOT NULL,                -- who attested (no foreign key: a dev / HA user id)
  updated_at   TEXT NOT NULL                 -- UTC ISO-8601 Z
);

CREATE TABLE readiness_history (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  at            TEXT NOT NULL,
  score         INTEGER NOT NULL,
  level         TEXT NOT NULL,
  blockers_json TEXT NOT NULL,               -- the critical check ids below 1.0
  checks_json   TEXT NOT NULL                -- {id: {status, fraction}} for the trend
);
CREATE INDEX idx_readiness_history_at ON readiness_history (at);
