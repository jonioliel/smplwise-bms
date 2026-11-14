-- 0034: Web Push (CR-008 P3). A browser's push subscription belongs to one HA user (the same user id whether it was
-- made inside Home Assistant through Ingress or on the remote /arx channel). The endpoint is a capability URL of the
-- browser's push service: it is unique, never logged in full and never exported. Per-user preferences say which
-- categories of alert reach that user's devices and when to stay quiet. The installation's VAPID key pair lives in a
-- table of its own so the private key is never part of a project backup (services/backup.py exports `settings`).
CREATE TABLE push_subscriptions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  endpoint     TEXT NOT NULL UNIQUE,
  p256dh       TEXT NOT NULL,
  auth         TEXT NOT NULL,
  user_agent   TEXT,
  channel      TEXT,
  created_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  last_ok_at   TEXT,
  failures     INTEGER NOT NULL DEFAULT 0,
  last_error   TEXT
);
CREATE INDEX idx_push_subscriptions_user ON push_subscriptions (user_id);

CREATE TABLE push_prefs (
  user_id         TEXT PRIMARY KEY,
  categories_json TEXT NOT NULL,
  quiet_json      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE push_vapid (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  private_pem TEXT NOT NULL,
  public_key  TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
