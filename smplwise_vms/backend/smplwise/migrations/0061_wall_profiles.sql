-- 0061: wall display profiles (CR-030 v2, WDM). One row per wall user: a wall tablet is an ordinary user on the
-- `kiosk` role; this row holds its wall configuration. The camera allow list is the user's camera-scope kiosk
-- bindings (migration 0032); config_json holds the order and layout. No device registry, no token.
CREATE TABLE wall_profiles (
  user_id        TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  area_id        TEXT,
  floor_id       TEXT,
  enabled        INTEGER NOT NULL DEFAULT 1,
  remote_allowed INTEGER NOT NULL DEFAULT 0,
  version        INTEGER NOT NULL DEFAULT 1,
  config_json    TEXT NOT NULL,
  last_seen_at   TEXT,
  last_channel   TEXT,
  created_at     TEXT NOT NULL,
  created_by     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  updated_by     TEXT NOT NULL
);
