-- NN5-F2b (docs/changes/CR-029-FRIGATE-PROVIDER.md section 11): the F2 leftovers. Additive except the rebuild of frigate_write_policy,
-- whose CHECK list gains two classes (the rows are copied unchanged). Rollback = run the previous version: it ignores the new tables and
-- the two new class names are never written while the previous code runs. Every new class stays OFF until an administrator switches it on.
-- Number 0068: 0067 is MU2; 0069 is reserved for another branch.

CREATE TABLE frigate_write_policy_new (
  recorder_id TEXT NOT NULL,
  class       TEXT NOT NULL CHECK (class IN ('analytics', 'record', 'profile', 'review', 'events', 'ptz', 'exports', 'cases')),
  enabled     INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  changed_by  TEXT,
  changed_at  TEXT NOT NULL,
  PRIMARY KEY (recorder_id, class)
);
INSERT INTO frigate_write_policy_new (recorder_id, class, enabled, changed_by, changed_at)
  SELECT recorder_id, class, enabled, changed_by, changed_at FROM frigate_write_policy;
DROP TABLE frigate_write_policy;
ALTER TABLE frigate_write_policy_new RENAME TO frigate_write_policy;

-- Automatic profile switching on an alarm-state change: per recorder, off | suggest | apply (default off = no row). `apply` additionally
-- needs the explicit auto-apply consent (a separate flag, given by an administrator who understands that Arx will switch the profile by
-- itself) and the profile write class.
CREATE TABLE frigate_profile_auto_setting (
  recorder_id        TEXT PRIMARY KEY,
  mode               TEXT NOT NULL DEFAULT 'off' CHECK (mode IN ('off', 'suggest', 'apply')),
  auto_apply_consent INTEGER NOT NULL DEFAULT 0 CHECK (auto_apply_consent IN (0, 1)),
  consent_by         TEXT,
  consent_at         TEXT,
  changed_by         TEXT,
  changed_at         TEXT NOT NULL
);

-- One row per alarm-state change that the mapping answers (queued by the HA state hook, handled by the recorder's event loop, never on the
-- HA transaction). status: pending | suggested | applied | unverified | failed | skipped | superseded | expired | dismissed.
CREATE TABLE frigate_profile_auto (
  id           TEXT PRIMARY KEY,
  recorder_id  TEXT NOT NULL,
  alarm_state  TEXT NOT NULL,
  entity_id    TEXT,
  profile      TEXT NOT NULL,
  mode         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  reason       TEXT,
  change_id    TEXT,
  created_at   TEXT NOT NULL,
  processed_at TEXT
);
CREATE INDEX idx_frigate_profile_auto_open ON frigate_profile_auto (recorder_id, status, created_at);

-- "First supervised write": the wire shape of every new write kind is unverified against a real Frigate, so the first write of each kind
-- toward a recorder needs `supervised: true` from a system administrator who watches it; the row is stored after that write was accepted by
-- Frigate. Until it exists an automatic action of that kind never writes (it is left as a suggestion).
CREATE TABLE frigate_first_write (
  recorder_id  TEXT NOT NULL,
  kind         TEXT NOT NULL,
  confirmed_by TEXT,
  confirmed_at TEXT NOT NULL,
  PRIMARY KEY (recorder_id, kind)
);

-- What Arx created inside Frigate (exports and cases): only these may be renamed or deleted through Arx. `deleted_at` keeps the history.
CREATE TABLE frigate_native_objects (
  recorder_id TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('export', 'case')),
  object_id   TEXT NOT NULL,
  name        TEXT,
  camera_id   TEXT,
  camera_key  TEXT,
  start_ts    REAL,
  end_ts      REAL,
  created_by  TEXT,
  created_at  TEXT NOT NULL,
  deleted_at  TEXT,
  PRIMARY KEY (recorder_id, kind, object_id)
);
