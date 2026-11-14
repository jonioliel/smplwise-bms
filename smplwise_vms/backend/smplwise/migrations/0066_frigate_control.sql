-- NN5-F2 (docs/changes/CR-029-FRIGATE-PROVIDER.md): runtime control of a Frigate recorder. Additive only (rollback = run the previous
-- version; these tables are ignored by it and F1 behaviour is untouched while every write class is off, which is the default).
-- Number 0066: 0064 is the F1 provider migration, 0065 is reserved for another branch.

-- Which write class may be used toward a recorder. A class is OFF until an administrator switches it on for that recorder: this row IS
-- the owner's "class approval". The per-action classes (record, profile, ptz) additionally need an explicit confirmation on every call.
CREATE TABLE frigate_write_policy (
  recorder_id TEXT NOT NULL,
  class       TEXT NOT NULL CHECK (class IN ('analytics', 'record', 'profile', 'review', 'events', 'ptz')),
  enabled     INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  changed_by  TEXT,
  changed_at  TEXT NOT NULL,
  PRIMARY KEY (recorder_id, class)
);

-- The change log of everything Arx wrote to a Frigate recorder, with the state read before and after and the inverse, so a change can
-- be undone from the log. `status`: applied (read back and equal) | unverified (written, the read-back could not confirm it) |
-- reverted | failed. `reverts_id` names the change an undo belongs to.
CREATE TABLE frigate_changes (
  id          TEXT PRIMARY KEY,
  recorder_id TEXT NOT NULL,
  camera_id   TEXT,                    -- Arx camera row (NULL for a recorder-wide change such as a profile)
  camera_key  TEXT,                    -- the camera's key on that Frigate (NULL or '*' for recorder-wide)
  class       TEXT NOT NULL,
  kind        TEXT NOT NULL,           -- feature | profile | event_retain | event_sub_label | ptz
  target      TEXT NOT NULL,           -- the feature / profile slot / event id
  before_json TEXT,
  after_json  TEXT,
  state_hash  TEXT,                    -- hash of the camera's feature state read immediately before the write
  status      TEXT NOT NULL,
  error_code  TEXT,
  reversible  INTEGER NOT NULL DEFAULT 1,
  reverts_id  TEXT,
  actor_id    TEXT,
  actor_name  TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX idx_frigate_changes_recorder ON frigate_changes (recorder_id, created_at DESC);
CREATE INDEX idx_frigate_changes_camera ON frigate_changes (camera_id, created_at DESC);

-- "Alarm state X selects Frigate profile Y". A mapping only: Arx never switches a profile by itself (a switch is a per-action write);
-- the screen asks for the suggested profile and the operator confirms it.
CREATE TABLE frigate_profile_rules (
  recorder_id TEXT NOT NULL,
  alarm_state TEXT NOT NULL,
  profile     TEXT NOT NULL,
  changed_by  TEXT,
  changed_at  TEXT NOT NULL,
  PRIMARY KEY (recorder_id, alarm_state)
);

-- The mirror of "reviewed" toward Frigate (its flag belongs to Frigate's single service account, so the mirror is shared state).
ALTER TABLE frigate_review_state ADD COLUMN mirrored_at TEXT;
ALTER TABLE frigate_review_state ADD COLUMN mirror_error TEXT;
