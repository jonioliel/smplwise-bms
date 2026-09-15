-- 0004: Home Assistant entities, actions and the bridge's user directory (MASTER_SPEC ch. 14/15, T023–T025).

CREATE TABLE ha_entities (
  entity_id          TEXT PRIMARY KEY,
  registry_id        TEXT,                 -- entity registry id (stable across renames) when the registry exposes it
  unique_id          TEXT,
  platform           TEXT,
  device_id          TEXT,
  area_id            TEXT,
  area_name          TEXT,
  ha_floor_id        TEXT,
  ha_floor_name      TEXT,
  name               TEXT NOT NULL DEFAULT '',
  original_name      TEXT,
  domain             TEXT NOT NULL,
  device_class       TEXT,
  unit               TEXT,
  icon               TEXT,
  entity_category    TEXT,
  disabled           INTEGER NOT NULL DEFAULT 0,
  hidden             INTEGER NOT NULL DEFAULT 0,
  supported_features INTEGER NOT NULL DEFAULT 0,
  state              TEXT,
  attributes_json    TEXT,                 -- trimmed allow-list, never secrets
  last_changed       TEXT,
  last_updated       TEXT,
  state_seen_at      TEXT,                 -- when this add-on last received a state for it
  available          INTEGER NOT NULL DEFAULT 1,
  removed_at         TEXT,                 -- tombstone: gone from HA, placement kept for repair
  first_seen_at      TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);
CREATE INDEX idx_ha_entities_domain ON ha_entities (domain);
CREATE INDEX idx_ha_entities_area ON ha_entities (area_id);

CREATE TABLE ha_actions (
  id                 TEXT PRIMARY KEY,
  entity_id          TEXT NOT NULL,
  action_id          TEXT NOT NULL,        -- allow-listed id, e.g. light.turn_on
  arguments_json     TEXT,
  principal_user_id  TEXT NOT NULL,
  principal_username TEXT,
  client_request_id  TEXT NOT NULL,
  status             TEXT NOT NULL,        -- pending | confirmed | unknown | failed | denied
  error              TEXT,
  requested_at       TEXT NOT NULL,
  responded_at       TEXT,
  confirmed_at       TEXT,
  expected_state     TEXT,
  observed_state     TEXT,
  via                TEXT NOT NULL DEFAULT 'bridge'
);
CREATE UNIQUE INDEX idx_ha_actions_client ON ha_actions (principal_user_id, client_request_id);
CREATE INDEX idx_ha_actions_entity ON ha_actions (entity_id, requested_at DESC);

CREATE TABLE ha_users (
  id             TEXT PRIMARY KEY,         -- HA user id
  name           TEXT,
  username       TEXT,
  is_active      INTEGER NOT NULL DEFAULT 1,
  is_admin       INTEGER NOT NULL DEFAULT 0,
  group_ids_json TEXT,
  synced_at      TEXT NOT NULL
);
