-- 0032: camera scope (T055). A binding may target a single camera (scope_type = 'camera', scope_id = cameras.id)
-- besides installation / site / building / floor. SQLite cannot change a CHECK constraint in place, so the table is
-- rebuilt with the same columns and rows (nothing references bindings by foreign key). Audit rows gain the scope,
-- role and binding an allowed decision was taken under (ids only; NULL for rows that predate this or name none).
CREATE TABLE bindings_new (
  id                  TEXT PRIMARY KEY,
  subject_kind        TEXT NOT NULL CHECK (subject_kind IN ('user', 'group')),
  subject_id          TEXT NOT NULL,
  role_id             TEXT NOT NULL,
  scope_type          TEXT NOT NULL CHECK (scope_type IN ('installation', 'site', 'building', 'floor', 'camera')),
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

ALTER TABLE audit_log ADD COLUMN scope_type TEXT;
ALTER TABLE audit_log ADD COLUMN scope_id TEXT;
ALTER TABLE audit_log ADD COLUMN role_id TEXT;
ALTER TABLE audit_log ADD COLUMN binding_id TEXT;
