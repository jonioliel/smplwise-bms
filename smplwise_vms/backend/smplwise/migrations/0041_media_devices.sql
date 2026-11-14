-- CR-015 (multimedia, docs/architecture/MEDIA_API.md): the media device model. Screens (and, from 0.1.150, receivers, speakers
-- and players) are PHYSICAL devices, each made of several Home Assistant endpoints (a vendor media_player, its remote, a Cast
-- copy, a SmartThings copy, a Music Assistant copy ...). Everything but `media_layouts` and `media_commands` is derived: the
-- registry refresh rebuilds `media_device_endpoints` and the per-device facts; the administrator's curation (approval, public
-- flag, names, profile, audio link, volume ceiling, source / app curation, remote override) lives on `media_devices` and
-- survives the rebuilds (a device is matched to its row by its endpoints).

-- A minimal mirror of Home Assistant's device registry, filled by the registry refresh (services/ha_sync.py). PRIVATE:
-- `connections_json` (MACs, normalised: lower-case, no separators) and `identifiers_json` (normalised [domain, id] pairs)
-- exist only for the dedupe ladder and never reach an API field, a log line, an audit row or a fixture with real values.
CREATE TABLE ha_devices (
  device_id        TEXT PRIMARY KEY,
  name             TEXT,
  name_by_user     TEXT,
  manufacturer     TEXT,
  model            TEXT,
  via_device_id    TEXT,
  area_id          TEXT,
  connections_json TEXT NOT NULL DEFAULT '[]',
  identifiers_json TEXT NOT NULL DEFAULT '[]',
  updated_at       TEXT NOT NULL,
  removed_at       TEXT
);

CREATE TABLE media_devices (
  device_key       TEXT PRIMARY KEY,                     -- our uuid4 hex, stable across entity churn
  kind             TEXT NOT NULL DEFAULT 'player' CHECK (kind IN ('screen', 'receiver', 'speaker', 'player', 'group')),
  kind_source      TEXT NOT NULL DEFAULT 'auto' CHECK (kind_source IN ('auto', 'manual')),
  display_name     TEXT,                                 -- NULL = derived (HA device name, else the anchor's name)
  anchor_entity_id TEXT,                                 -- the device's home for name, area and SCOPE
  profile          TEXT,                                 -- NULL = detected from the vendor endpoint's platform
  approved         INTEGER NOT NULL DEFAULT 0,           -- decision 1b: only approved screens are listed
  is_public        INTEGER NOT NULL DEFAULT 0,           -- a screen in a shared space (media.public)
  audio_link_key   TEXT,                                 -- another device (a receiver) that carries this one's sound
  audio_default    TEXT NOT NULL DEFAULT 'screen' CHECK (audio_default IN ('screen', 'linked')),
  volume_max       INTEGER,                              -- 0-100 ceiling, NULL = none
  model_keys_json  TEXT,                                 -- extra keys enabled for this model in settings
  primary_json     TEXT,                                 -- per-control administrator override, NULL = automatic
  sources_json     TEXT,                                 -- curation: [{id, label, hidden, kind, glyph}]
  apps_json        TEXT,
  remote_json      TEXT,                                 -- per-screen remote override, NULL = the installation default
  recent_json      TEXT,                                 -- the last 6 confirmed source / app picks
  confidence       TEXT NOT NULL DEFAULT 'exact' CHECK (confidence IN ('exact', 'strong', 'weak', 'manual')),
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  removed_at       TEXT                                  -- tombstone: curation kept 30 days, then the janitor deletes it
);
CREATE INDEX idx_media_devices_anchor ON media_devices (anchor_entity_id);

CREATE TABLE media_device_endpoints (
  endpoint_id TEXT PRIMARY KEY,                          -- 'ha:<entity_id>' ('ma:<player_id>' is reserved for 0.1.150)
  source      TEXT NOT NULL DEFAULT 'ha' CHECK (source IN ('ha', 'ma')),
  ref         TEXT NOT NULL,                             -- the entity id / player id
  device_key  TEXT NOT NULL,
  role        TEXT NOT NULL,                             -- vendor remote cast dlna smartthings ma_export ma_import ma_native ma_universal other
  platform    TEXT,
  rule        TEXT NOT NULL,                             -- which rung joined it: device, ma, mac, identifier, manual, single
  link_source TEXT NOT NULL DEFAULT 'auto' CHECK (link_source IN ('auto', 'manual')),
  hidden      INTEGER NOT NULL DEFAULT 0,                -- a duplicate: listed only in the administrator's "connections"
  updated_at  TEXT NOT NULL
);
CREATE INDEX idx_media_endpoints_device ON media_device_endpoints (device_key);

-- The administrator's overrides, applied after the ladder. Audited (media.link).
CREATE TABLE media_link_rules (
  endpoint_id TEXT PRIMARY KEY,
  rule        TEXT NOT NULL CHECK (rule IN ('link', 'unlink', 'ignore')),
  device_key  TEXT,                                      -- for `link`
  set_by      TEXT,
  set_at      TEXT NOT NULL
);

-- The screens page layout (addition A). Personal overrides live in user_prefs (`multimedia.personal`).
CREATE TABLE media_layouts (
  scope       TEXT PRIMARY KEY,                          -- 'installation'
  layout_json TEXT NOT NULL,
  revision    INTEGER NOT NULL DEFAULT 1,
  updated_by  TEXT,
  updated_at  TEXT NOT NULL
);

-- One row per command a caller sent (keys and steps included): idempotency of `client_request_id` per user, the power rules
-- (one in flight per device, a minimum gap) and the audit window of key presses read from here. Never holds typed text.
CREATE TABLE media_commands (
  id                TEXT PRIMARY KEY,                    -- the command_id of the reply
  device_key        TEXT NOT NULL,
  principal_user_id TEXT NOT NULL,
  client_request_id TEXT NOT NULL,
  command           TEXT NOT NULL,
  status            TEXT NOT NULL,                       -- accepted | sent | refused
  action_id         TEXT,                                -- the ha_actions record of a confirmable command
  error             TEXT,
  recent_kind       TEXT,                                -- a source / app pick: noted in the screen's "recent" once its action is confirmed
  recent_id         TEXT,
  created_ms        INTEGER NOT NULL,
  created_at        TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_media_commands_client ON media_commands (principal_user_id, client_request_id);
CREATE INDEX idx_media_commands_device ON media_commands (device_key, created_ms DESC);

-- The floor / area "כבה מסכים" of the screens page runs on the devices area's bulk engine (services/device_bulk.py: the same records,
-- in-flight bound and honest per-device outcome); `origin` only tells the outcome audit row which action name to carry (media.bulk).
ALTER TABLE device_bulk_actions ADD COLUMN origin TEXT NOT NULL DEFAULT 'devices';
