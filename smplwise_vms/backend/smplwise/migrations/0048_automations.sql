-- CR-017: automations, scenes and scripts of Home Assistant, seen and edited through Arx (docs/architecture/AUTOMATIONS_API.md, CR §6.3).
-- Home Assistant's config files are the authority; these tables hold Arx's READ cache of each item (secret-like values masked before they are
-- stored: a code or a token typed in Home Assistant never reaches this database), Arx-only data around it, the version history, the 30-day trash,
-- the derived runs and the write operations (idempotency). No config is stored outside Home Assistant except these snapshots.
CREATE TABLE ha_config_items (
  kind          TEXT NOT NULL CHECK (kind IN ('automation', 'script', 'scene')),
  item_id       TEXT NOT NULL,           -- the config id, or 'entity:<entity_id>' for an item without one (YAML without id, an integration scene)
  config_id     TEXT,                    -- the id inside the file (NULL when there is none)
  entity_id     TEXT,
  source        TEXT NOT NULL CHECK (source IN ('ui', 'yaml', 'integration', 'dynamic')),
  revision      TEXT,                    -- 16 hex over the canonical stored config (NULL when no config is readable)
  config_json   TEXT,                    -- the stored config, secret-like values masked
  masked        INTEGER NOT NULL DEFAULT 0,
  reason        TEXT,                    -- why it is not editable (yaml_managed, no_config_id, integration_scene, ...)
  seen_at       TEXT NOT NULL,
  changed_at    TEXT NOT NULL,
  PRIMARY KEY (kind, item_id)
);
CREATE INDEX idx_ha_config_items_entity ON ha_config_items (entity_id);
CREATE TABLE automation_meta (
  kind                 TEXT NOT NULL,
  item_id              TEXT NOT NULL,
  created_via          TEXT NOT NULL CHECK (created_via IN ('arx', 'external')),
  created_by           TEXT,
  created_by_username  TEXT,
  created_at           TEXT,
  updated_by           TEXT,
  updated_by_username  TEXT,
  updated_at           TEXT,
  hidden               INTEGER NOT NULL DEFAULT 0,   -- integration scenes an administrator hid
  first_seen_at        TEXT NOT NULL,
  last_seen_at         TEXT NOT NULL,
  gone_at              TEXT,
  PRIMARY KEY (kind, item_id)
);
CREATE TABLE automation_prefs (
  user_id    TEXT NOT NULL,
  kind       TEXT NOT NULL,
  item_id    TEXT NOT NULL,
  pinned     INTEGER NOT NULL DEFAULT 0,
  favourite  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, kind, item_id)
);
CREATE TABLE automation_versions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  kind         TEXT NOT NULL,
  item_id      TEXT NOT NULL,
  revision     TEXT NOT NULL,
  config_json  TEXT NOT NULL,            -- secret-like values masked
  masked       INTEGER NOT NULL DEFAULT 0,
  seen_at      TEXT NOT NULL,
  via          TEXT NOT NULL CHECK (via IN ('arx', 'external')),
  actor        TEXT,
  actor_username TEXT
);
CREATE UNIQUE INDEX idx_automation_versions_rev ON automation_versions (kind, item_id, revision);
CREATE INDEX idx_automation_versions_item ON automation_versions (kind, item_id, id);
CREATE TABLE automation_trash (
  id                   TEXT PRIMARY KEY,
  kind                 TEXT NOT NULL,
  item_id              TEXT NOT NULL,
  name                 TEXT,
  config_json          TEXT NOT NULL,    -- secret-like values masked
  masked               INTEGER NOT NULL DEFAULT 0,
  meta_json            TEXT,
  entities_json        TEXT NOT NULL,
  sensitive            INTEGER NOT NULL DEFAULT 0,
  deleted_by           TEXT,
  deleted_by_username  TEXT,
  deleted_at           TEXT NOT NULL,
  expires_at           TEXT NOT NULL,
  restored_at          TEXT,
  restored_item_id     TEXT
);
CREATE INDEX idx_automation_trash_expires ON automation_trash (expires_at);
CREATE TABLE automation_ops (
  id                 TEXT PRIMARY KEY,
  principal_user_id  TEXT NOT NULL,
  principal_username TEXT,
  client_request_id  TEXT NOT NULL,
  op                 TEXT NOT NULL,
  kind               TEXT,
  item_id            TEXT,
  status             TEXT NOT NULL CHECK (status IN ('pending', 'ok', 'failed', 'unknown')),
  error              TEXT,
  requested_at       TEXT NOT NULL,
  responded_at       TEXT
);
CREATE UNIQUE INDEX idx_automation_ops_client ON automation_ops (principal_user_id, client_request_id);
CREATE TABLE automation_runs (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,
  item_id     TEXT NOT NULL,
  at          TEXT NOT NULL,
  source      TEXT NOT NULL CHECK (source IN ('event', 'trace')),
  result      TEXT,
  trigger_text TEXT
);
CREATE INDEX idx_automation_runs_item ON automation_runs (kind, item_id, at);
CREATE INDEX idx_automation_runs_at ON automation_runs (at);
