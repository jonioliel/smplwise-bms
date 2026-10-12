-- 0077: the access control station scope (CR-033 slice D2, owner decision 14 = א). A binding may target one WisKey
-- station (scope_type = 'access_control_station', scope_id = the station's opaque config entry id, never a hardware
-- id) besides installation / site / building / floor / camera. SQLite cannot change a CHECK constraint in place, so
-- the table is rebuilt with the same columns and rows (the 0032 pattern; nothing references bindings by foreign key).
-- Number: 0073 (device types) and 0074-0076 are taken by other branches; final numbers are assigned at merge.
CREATE TABLE bindings_new (
  id                  TEXT PRIMARY KEY,
  subject_kind        TEXT NOT NULL CHECK (subject_kind IN ('user', 'group')),
  subject_id          TEXT NOT NULL,
  role_id             TEXT NOT NULL,
  scope_type          TEXT NOT NULL CHECK (scope_type IN ('installation', 'site', 'building', 'floor', 'camera', 'access_control_station')),
  scope_id            TEXT NOT NULL,
  effect              TEXT NOT NULL DEFAULT 'allow' CHECK (effect IN ('allow', 'deny')),
  permission_revision INTEGER NOT NULL,
  assigned_by         TEXT,
  created_at          TEXT NOT NULL,
  expires_at          TEXT,
  revoked_at          TEXT
);
INSERT INTO bindings_new (id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at, expires_at, revoked_at)
  SELECT id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at, expires_at, revoked_at FROM bindings;
DROP TABLE bindings;
ALTER TABLE bindings_new RENAME TO bindings;
CREATE INDEX idx_bindings_subject ON bindings (subject_kind, subject_id, revoked_at);
CREATE INDEX idx_bindings_scope ON bindings (scope_type, scope_id);

-- Where a station sits (Settings, system administrator; audited intercom.station.placed). An unplaced station hangs off
-- the installation alone: only installation bindings cover it. A station placed under a building is covered by that
-- building's and its site's bindings too; it never contains a floor, a camera or an entity.
CREATE TABLE intercom_station_placement (
  config_entry_id TEXT PRIMARY KEY,
  site_id         TEXT,
  building_id     TEXT,
  assigned_by     TEXT,
  assigned_at     TEXT NOT NULL,
  revision        INTEGER NOT NULL DEFAULT 1
);

-- CR-033 slice D3 (the "פתיחת דלתות" card): the door_opener bindings that card created, so switching a subject off
-- revokes exactly those and never a binding made elsewhere (ids only; the binding row itself stays the record).
CREATE TABLE door_grant_bindings (
  binding_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
