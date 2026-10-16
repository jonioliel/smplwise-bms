-- TKSECRETS2: the in-app secrets store (services/secrets_store.py; הגדרות › חיבורים › סודות). Final number 0093
-- (integ/263, release 2.6.3).
--
-- Home Assistant warned "Insecure secrets detected in app configuration" because add-on options of type `password` held secrets.
-- The remaining ones (go2rtc_api_password, wiskey_password, wiskey_background_token, openai_api_key, push_relay_key) leave
-- config.yaml and live here instead, one row per secret name:
-- - value_enc: AES-256-GCM with the per-install key of recorder_connections (keys/connections.key, never in a backup), associated
--   data "app_secret|<name>|value", stored as `v1:<base64>`; NULL = cleared by an administrator. A row - set or cleared - means
--   the store decides for that name from now on: a stale add-on option value is never read again.
-- - source: `ui` (saved in Settings) or `addon_import` (the one-time copy of a legacy add-on option at start-up).
-- - updated_by: the user id of the administrator (NULL for the start-up import). Never a value.
-- Not a backup table (services/backup.PROJECT_TABLES does not list it), like recorder_connections: a backup never carries a
-- secret, and a restore never overwrites one.

CREATE TABLE app_secrets (
  name        TEXT PRIMARY KEY,
  value_enc   TEXT,
  source      TEXT NOT NULL CHECK (source IN ('ui', 'addon_import')),
  updated_at  TEXT NOT NULL,
  updated_by  TEXT
);
