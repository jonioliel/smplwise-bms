-- 0033: CR-008 SmplWise Arx remote access. The per-user `remote.access` flag (owner decision D4): a row = this HA user
-- may sign in on the remote channel (/arx) while the setting remote.policy is `flag` (the default). No row = no remote
-- access. Changed only by a system administrator (system.configure) and audited; nothing is written to Home Assistant.
CREATE TABLE remote_access_users (
  user_id    TEXT PRIMARY KEY,  -- HA user id (users.id / ha_users.id)
  granted_by TEXT,
  granted_at TEXT NOT NULL
);
