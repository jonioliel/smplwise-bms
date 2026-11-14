-- 0001: catalogue, plans, anchors, cameras, identity/RBAC, audit (MASTER_SPEC ch. 9, security spec v1.1)

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE users (
  id            TEXT PRIMARY KEY,          -- HA user id (from Ingress) or dev id
  username      TEXT NOT NULL DEFAULT '',
  display_name  TEXT NOT NULL DEFAULT '',
  source        TEXT NOT NULL,             -- ingress | dev
  active        INTEGER NOT NULL DEFAULT 1,
  first_seen_at TEXT NOT NULL,
  last_seen_at  TEXT NOT NULL
);

CREATE TABLE groups (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT
);

CREATE TABLE group_members (
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE bindings (
  id                  TEXT PRIMARY KEY,
  subject_kind        TEXT NOT NULL CHECK (subject_kind IN ('user', 'group')),
  subject_id          TEXT NOT NULL,
  role_id             TEXT NOT NULL,
  scope_type          TEXT NOT NULL CHECK (scope_type IN ('installation', 'site', 'building', 'floor')),
  scope_id            TEXT NOT NULL,
  effect              TEXT NOT NULL DEFAULT 'allow' CHECK (effect IN ('allow', 'deny')),
  permission_revision INTEGER NOT NULL,
  assigned_by         TEXT,
  created_at          TEXT NOT NULL,
  expires_at          TEXT,
  revoked_at          TEXT
);
CREATE INDEX idx_bindings_subject ON bindings (subject_kind, subject_id, revoked_at);

CREATE TABLE sites (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  address    TEXT NOT NULL DEFAULT '',
  timezone   TEXT NOT NULL DEFAULT 'Asia/Jerusalem',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE buildings (
  id         TEXT PRIMARY KEY,
  site_id    TEXT NOT NULL REFERENCES sites(id),
  name       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX idx_buildings_site ON buildings (site_id, deleted_at);

CREATE TABLE floors (
  id          TEXT PRIMARY KEY,
  building_id TEXT NOT NULL REFERENCES buildings(id),
  name        TEXT NOT NULL,
  level       INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  ha_area_id  TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT
);
CREATE INDEX idx_floors_building ON floors (building_id, deleted_at);

-- Original upload, kept unchanged and addressed by hash (ch. 11).
CREATE TABLE plan_assets (
  id            TEXT PRIMARY KEY,
  floor_id      TEXT NOT NULL REFERENCES floors(id),
  original_name TEXT NOT NULL,
  mime          TEXT NOT NULL,
  sha256        TEXT NOT NULL,
  bytes         INTEGER NOT NULL,
  page_count    INTEGER NOT NULL,
  storage_path  TEXT NOT NULL,
  uploaded_by   TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX idx_plan_assets_floor ON plan_assets (floor_id);

-- Derived background: page + rotation + crop rendered once; draft → published → archived.
CREATE TABLE plan_versions (
  id             TEXT PRIMARY KEY,
  floor_id       TEXT NOT NULL REFERENCES floors(id),
  asset_id       TEXT NOT NULL REFERENCES plan_assets(id),
  page           INTEGER NOT NULL DEFAULT 1,
  rotation       INTEGER NOT NULL DEFAULT 0,
  crop_json      TEXT,
  width_px       INTEGER NOT NULL,
  height_px      INTEGER NOT NULL,
  image_path     TEXT NOT NULL,
  scale_m_per_px REAL,
  status         TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  revision       INTEGER NOT NULL DEFAULT 1,
  notes          TEXT NOT NULL DEFAULT '',
  created_by     TEXT,
  created_at     TEXT NOT NULL,
  published_by   TEXT,
  published_at   TEXT,
  archived_at    TEXT
);
CREATE INDEX idx_plan_versions_floor ON plan_versions (floor_id, status);

-- Placements: normalized coordinates in the plan's original top-left space (ch. 12), with the
-- version they were placed on and an effective period (tombstone on delete).
CREATE TABLE map_anchors (
  id                    TEXT PRIMARY KEY,
  floor_id              TEXT NOT NULL REFERENCES floors(id),
  plan_version_id       TEXT NOT NULL REFERENCES plan_versions(id),
  resource_type         TEXT NOT NULL CHECK (resource_type IN ('camera', 'ha_entity')),
  resource_id           TEXT NOT NULL,
  x                     REAL NOT NULL,
  y                     REAL NOT NULL,
  rotation_degrees      REAL NOT NULL DEFAULT 0,
  field_of_view_degrees REAL,
  layer_id              TEXT NOT NULL DEFAULT 'cameras',
  label                 TEXT,
  revision              INTEGER NOT NULL DEFAULT 1,
  effective_from        TEXT NOT NULL,
  effective_to          TEXT,
  created_by            TEXT,
  updated_by            TEXT,
  updated_at            TEXT NOT NULL
);
CREATE INDEX idx_anchors_floor ON map_anchors (floor_id, effective_to);

CREATE TABLE recorders (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  model        TEXT,
  firmware     TEXT,
  last_seen_at TEXT,
  created_at   TEXT NOT NULL
);

CREATE TABLE cameras (
  id                TEXT PRIMARY KEY,
  recorder_id       TEXT NOT NULL REFERENCES recorders(id),
  channel           INTEGER NOT NULL,
  name_source       TEXT NOT NULL DEFAULT '',
  alias             TEXT,
  enabled           INTEGER NOT NULL DEFAULT 1,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  main_track        INTEGER,
  sub_track         INTEGER,
  capabilities_json TEXT NOT NULL DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'unknown',
  last_seen_at      TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  UNIQUE (recorder_id, channel)
);

CREATE TABLE audit_log (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  at                  TEXT NOT NULL,
  actor_user_id       TEXT,
  actor_username      TEXT,
  action              TEXT NOT NULL,
  resource_type       TEXT,
  resource_id         TEXT,
  decision            TEXT NOT NULL,
  reason              TEXT,
  request_id          TEXT,
  permission_revision INTEGER,
  details_json        TEXT
);
CREATE INDEX idx_audit_at ON audit_log (at);

INSERT INTO settings (key, value) VALUES ('permission_revision', '1'), ('bootstrap_state', 'pending');
