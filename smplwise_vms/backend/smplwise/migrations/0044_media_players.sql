-- CR-016 (multimedia phase 2: players, speakers, groups; docs/changes/CR-016-MEDIA-PLAYERS.md section 9,
-- docs/architecture/MEDIA_PLAYERS_API.md). Speakers, players and receivers are shown after approval; the three NON-PHYSICAL kinds
-- (`session`, `virtual_group`, `service`) are detected but hidden by default; groups are saved as presets; the volume ceiling stays NULL
-- unless an administrator sets it (owner decision 7b: no default ceiling).

-- 1. `media_devices` gains the three non-physical kinds in its CHECK (SQLite cannot alter a CHECK: the table is rebuilt, rows kept as they
--    are) and three columns: the optional night-window ceiling, the derived music provider and the zones of a multi-zone receiver.
CREATE TABLE media_devices_v2 (
  device_key        TEXT PRIMARY KEY,
  kind              TEXT NOT NULL DEFAULT 'player' CHECK (kind IN ('screen', 'receiver', 'speaker', 'player', 'group', 'session', 'virtual_group', 'service')),
  kind_source       TEXT NOT NULL DEFAULT 'auto' CHECK (kind_source IN ('auto', 'manual')),
  display_name      TEXT,
  anchor_entity_id  TEXT,
  profile           TEXT,
  approved          INTEGER NOT NULL DEFAULT 0,
  is_public         INTEGER NOT NULL DEFAULT 0,
  audio_link_key    TEXT,
  audio_default     TEXT NOT NULL DEFAULT 'screen' CHECK (audio_default IN ('screen', 'linked')),
  volume_max        INTEGER,                              -- 0-100 ceiling, NULL = none (and NULL for every kind by default: 7b)
  model_keys_json   TEXT,
  primary_json      TEXT,
  sources_json      TEXT,
  apps_json         TEXT,
  remote_json       TEXT,
  recent_json       TEXT,
  confidence        TEXT NOT NULL DEFAULT 'exact' CHECK (confidence IN ('exact', 'strong', 'weak', 'manual')),
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  removed_at        TEXT,
  volume_night_json TEXT,                                 -- NULL, or {"from": "HH:MM", "to": "HH:MM", "max": 0-100}: a second ceiling inside the window
  music_provider    TEXT NOT NULL DEFAULT 'none' CHECK (music_provider IN ('ma', 'sonos', 'heos', 'vendor', 'none')),   -- derived, cached by the rebuild
  zones_json        TEXT                                  -- NULL, or [{"id", "endpoint_id", "name"}] of a multi-zone receiver
);
INSERT INTO media_devices_v2 (device_key, kind, kind_source, display_name, anchor_entity_id, profile, approved, is_public, audio_link_key, audio_default, volume_max, model_keys_json,
                              primary_json, sources_json, apps_json, remote_json, recent_json, confidence, created_at, updated_at, removed_at)
  SELECT device_key, kind, kind_source, display_name, anchor_entity_id, profile, approved, is_public, audio_link_key, audio_default, volume_max, model_keys_json,
         primary_json, sources_json, apps_json, remote_json, recent_json, confidence, created_at, updated_at, removed_at FROM media_devices;
DROP TABLE media_devices;
ALTER TABLE media_devices_v2 RENAME TO media_devices;
CREATE INDEX idx_media_devices_anchor ON media_devices (anchor_entity_id);

-- 2. Endpoints: the last `supported_features` mask seen while the endpoint was AVAILABLE (an unavailable / restored entity reports a degraded
--    mask: capabilities are never read from it), and the one layer that answers grouping for the device. The role value `mirror` (a poorer
--    cloud twin, never a primary) and `music` (the music layer) need no schema change.
ALTER TABLE media_device_endpoints ADD COLUMN last_features_json TEXT;
ALTER TABLE media_device_endpoints ADD COLUMN group_layer TEXT CHECK (group_layer IS NULL OR group_layer IN ('ma', 'vendor'));

-- 3. Saved groups ("סלון + מטבח", one tap): name, leader, members, optional per-member volume. Audited `media.group.preset`.
CREATE TABLE media_group_presets (
  preset_id    TEXT PRIMARY KEY,                           -- hex32
  name         TEXT NOT NULL,                              -- at most 40 characters
  leader_key   TEXT NOT NULL,
  members_json TEXT NOT NULL,                              -- device keys, at most 16
  volumes_json TEXT,                                       -- {device key: 0-100}, optional
  revision     INTEGER NOT NULL DEFAULT 1,
  created_by   TEXT,
  updated_by   TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

-- 4. Group operations (join, leave, group volume, floor "עצור מוזיקה") run on the devices area's bulk engine (device_bulk_actions, migration
--    0026) with kind group_join / group_leave / group_volume / players_pause and origin 'media'. One ha_actions record may act for several
--    members (a join is ONE call on the leader), so each DEVICE the operation names gets a row here: what it should become and, for a
--    volume, the level that was asked. The per-device outcome is computed from these rows and the live state when the bulk is read back.
CREATE TABLE device_bulk_members (
  bulk_id    TEXT NOT NULL,
  device_key TEXT NOT NULL,
  action_id  TEXT,                                         -- the ha_actions record that acts for this device (NULL: nothing is sent for it)
  volume_action_id TEXT,                                   -- a saved group's volume record for this device (its membership is action_id)
  role       TEXT NOT NULL,                                -- leader | member | target
  will       TEXT NOT NULL,                                -- join | leave | stay | skip | set | pause
  reason     TEXT,                                         -- for a skip: muted | off | unavailable | not_allowed | ceiling
  leader_key TEXT,                                         -- the group a join aims at
  level      INTEGER,                                      -- the volume asked for (group volume), after the clamp
  PRIMARY KEY (bulk_id, device_key)
);
CREATE INDEX idx_device_bulk_members_action ON device_bulk_members (action_id);
