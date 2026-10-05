-- CR-027 (docs/changes/CR-027-MOBILE-PRESENCE-PUSH.md): the SmplWise Arx phone app - device registration, presence and
-- sensor reports, and push through the SmplWise relay. Additive only (rollback = run the previous version; the tables
-- are ignored by it). 0056 is taken by integ/201 (plan area links); this is the next free number after origin/main and
-- origin/integ/201.

-- One row per (user, phone install, server). The device token is a 256-bit secret shown once at registration: only its
-- SHA-256 is kept. `status_json` is what the phone last reported about itself ({location_auth, precise, sharing,
-- sensors: {key: on|off}}); `presence_json` is the CURRENT presence state the server derived from the events
-- ({inside, site_id, at, lat, lon, accuracy_m, source}) - one row, no history (the history is the retention-limited
-- event log below). Push: the opaque relay token the app obtained from the SmplWise relay (a capability the relay alone
-- can use, stored like a Web Push endpoint), the muted categories, and the delivery counters.
CREATE TABLE mobile_devices (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL,
  name               TEXT NOT NULL,
  platform           TEXT NOT NULL,               -- ios | android
  install_id         TEXT NOT NULL,
  app_version        TEXT,
  os_version         TEXT,
  model              TEXT,
  token_hash         TEXT NOT NULL UNIQUE,
  token_rotated_at   TEXT NOT NULL,
  channel            TEXT,                        -- where the registration was made: ingress | remote | dev
  created_at         TEXT NOT NULL,
  last_seen_at       TEXT NOT NULL,
  last_event_at      TEXT,
  notice_ack_version INTEGER NOT NULL DEFAULT 0,
  notice_ack_at      TEXT,
  status_json        TEXT NOT NULL DEFAULT '{}',
  presence_json      TEXT NOT NULL DEFAULT '{}',
  push_platform      TEXT,                        -- ios | android, set by POST notifications/devices
  push_relay_token   TEXT,                        -- the relay's opaque token; NULL = push not registered
  push_app_version   TEXT,
  push_registered_at TEXT,
  push_muted_json    TEXT NOT NULL DEFAULT '[]',  -- categories the user muted in the app
  push_failures      INTEGER NOT NULL DEFAULT 0,
  push_last_ok_at    TEXT,
  push_last_error    TEXT,
  revoked_at         TEXT                         -- NULL = registered; set by DELETE (the row is kept 30 days for the audit trail)
);
CREATE UNIQUE INDEX ux_mobile_devices_install ON mobile_devices (user_id, install_id);
CREATE INDEX idx_mobile_devices_user ON mobile_devices (user_id, revoked_at);
CREATE INDEX idx_mobile_devices_relay ON mobile_devices (push_relay_token) WHERE push_relay_token IS NOT NULL;

-- The presence / sensor event log: derived values only (one coordinate with its accuracy, an enter / exit, a sensor
-- value object). Idempotent per (device, client_event_id). Pruned by the janitor after `presence.retention_days`.
CREATE TABLE mobile_presence_events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id       TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  client_event_id TEXT NOT NULL,
  type            TEXT NOT NULL,                  -- fix | enter | exit | sensor
  sensor          TEXT,                           -- for type = sensor
  site_id         TEXT,
  lat             REAL,
  lon             REAL,
  accuracy_m      REAL,
  value_json      TEXT,                           -- for type = sensor
  source          TEXT,                           -- continuous | region | significant | foreground
  at              TEXT NOT NULL,                  -- the phone's UTC instant
  received_at     TEXT NOT NULL
);
CREATE UNIQUE INDEX ux_mobile_presence_events_client ON mobile_presence_events (device_id, client_event_id);
CREATE INDEX idx_mobile_presence_events_device ON mobile_presence_events (device_id, at);
CREATE INDEX idx_mobile_presence_events_at ON mobile_presence_events (at);

-- What the app's notification extension fetches with its device token after a generic push arrived: the real title and
-- body of ONE notification for ONE device. The id is a random per-device message id (never the inbox row id), single
-- use in spirit (fetched_at is recorded), expires after 24 hours. No person's name, image or token inside.
CREATE TABLE mobile_push_messages (
  id              TEXT PRIMARY KEY,
  device_id       TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  notification_id TEXT,                           -- the CR-018 inbox row (NULL for a test push)
  delivery_id     TEXT,                           -- the delivery-log row of this attempt
  mode            TEXT NOT NULL DEFAULT 'new',    -- new | renotify | escalate | resolved | test
  category        TEXT NOT NULL,
  severity        TEXT NOT NULL DEFAULT 'info',
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  deep_link       TEXT NOT NULL,
  at              TEXT NOT NULL,
  expires_at      TEXT NOT NULL,
  fetched_at      TEXT
);
CREATE INDEX idx_mobile_push_messages_device ON mobile_push_messages (device_id, expires_at);
CREATE INDEX idx_mobile_push_messages_expires ON mobile_push_messages (expires_at);
