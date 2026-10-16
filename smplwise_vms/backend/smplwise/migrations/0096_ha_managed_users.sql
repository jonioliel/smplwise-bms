-- 0096 (provisional, USR1, docs/design/USR1_HA_USERS_FROM_ARX.md): the home-system users Arx itself created. Only a user
-- listed here may be deactivated, activated or deleted from Arx - never the owner, an administrator or any other user.
-- No password is ever stored; rows are tombstoned (state 'deleted'), never removed, so the audit trail keeps the id.

CREATE TABLE ha_managed_users (
  id           TEXT PRIMARY KEY,
  request_key  TEXT UNIQUE,                 -- the client's idempotency key of the create call (optional)
  ha_user_id   TEXT UNIQUE,                 -- NULL only while the create call is in flight
  username     TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role_id      TEXT NOT NULL,
  scope_type   TEXT NOT NULL DEFAULT 'installation',
  scope_id     TEXT NOT NULL DEFAULT '*',
  binding_id   TEXT,
  person_id    TEXT,
  state        TEXT NOT NULL CHECK (state IN ('creating', 'active', 'inactive', 'needs_repair', 'deleted')),
  repair       TEXT,                        -- compensation_failed | binding_failed | cleanup_failed | person_missing | missing_in_ha
  created_by   TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  updated_by   TEXT,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT
);
CREATE INDEX idx_ha_managed_users_state ON ha_managed_users (state);
