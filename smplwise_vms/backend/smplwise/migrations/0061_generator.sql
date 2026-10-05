-- CR-031 GEN1 phase A: the generator control screen's backend. Number 0061 on purpose: 0057 (CR-027) is on main; 0058 (EL6), 0059 (map) and 0060
-- (cast) are taken by branches that are not merged yet. Renumber at integration if their order changes.
-- Live values are NOT stored here as rows of their own: the state mirror (ha_entities) is the source; `generator_samples*` hold only the
-- time series the history charts need (1-minute raw, 5-minute rollups), pruned by the janitor.

CREATE TABLE generator_devices (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  area_id            TEXT,
  source_kind        TEXT NOT NULL CHECK (source_kind IN ('integration', 'generic', 'manual')),
  source_domain      TEXT,                          -- the integration (platform) the entities belong to; never shown on operator screens
  source_device_ref  TEXT NOT NULL,                 -- the HA device id of the registry mirror (ha_devices.device_id)
  rated_kw           REAL,
  rated_kva          REAL,
  fuel_type          TEXT NOT NULL DEFAULT 'diesel',
  status             TEXT NOT NULL DEFAULT 'detected' CHECK (status IN ('detected', 'partial', 'removed')),
  detected_at        TEXT NOT NULL,
  last_seen_at       TEXT,
  revision           INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX idx_generator_devices_ref ON generator_devices (source_device_ref) WHERE status <> 'removed';

CREATE TABLE generator_roles (
  device_id   TEXT NOT NULL REFERENCES generator_devices(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,
  entity_ref  TEXT NOT NULL,                        -- the entity id; internal, never returned by the operator API
  unit        TEXT,
  invert      INTEGER NOT NULL DEFAULT 0,           -- a boolean source that says the opposite (a "mains failure" sensor for mains_available)
  mapped_by   TEXT NOT NULL DEFAULT 'auto' CHECK (mapped_by IN ('auto', 'manual')),
  confidence  REAL NOT NULL DEFAULT 1.0,
  core        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (device_id, role)
);

CREATE TABLE generator_alert_types (
  device_id   TEXT NOT NULL REFERENCES generator_devices(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  grp         TEXT NOT NULL,
  title_he    TEXT NOT NULL,
  title_en    TEXT NOT NULL,
  entity_ref  TEXT,                                 -- a controller alarm binary sensor, when the controller exposes one
  builtin     INTEGER NOT NULL DEFAULT 1,
  needs_json  TEXT NOT NULL DEFAULT '[]',           -- roles required; availability is derived at read time from generator_roles
  PRIMARY KEY (device_id, key)
);

-- Routing per alert type. A row exists only after an administrator saved one: routing starts EMPTY (owner 2026-10-05).
CREATE TABLE generator_alert_policies (
  device_id        TEXT NOT NULL REFERENCES generator_devices(id) ON DELETE CASCADE,
  alert_key        TEXT NOT NULL,
  enabled          INTEGER NOT NULL DEFAULT 1,
  severity         TEXT NOT NULL CHECK (severity IN ('critical', 'alert', 'info')),
  recipients_json  TEXT NOT NULL DEFAULT '{"roles":[],"users":[]}',
  channels_json    TEXT NOT NULL DEFAULT '[]',      -- push | app | email ; inbox is implicit
  quiet_mode       TEXT NOT NULL DEFAULT 'matrix' CHECK (quiet_mode IN ('pass', 'matrix', 'hold')),
  escalate         INTEGER NOT NULL DEFAULT 0,
  after_s          INTEGER NOT NULL DEFAULT 0,
  template_he      TEXT,                            -- custom Hebrew message body; NULL = the built-in template of the alert type
  row_version      INTEGER NOT NULL DEFAULT 1,
  updated_by       TEXT,
  updated_at       TEXT,
  PRIMARY KEY (device_id, alert_key)
);

CREATE TABLE generator_alerts (
  id               TEXT PRIMARY KEY,
  device_id        TEXT NOT NULL REFERENCES generator_devices(id) ON DELETE CASCADE,
  alert_key        TEXT NOT NULL,
  severity         TEXT NOT NULL CHECK (severity IN ('critical', 'alert', 'info')),
  raised_at        TEXT NOT NULL,
  cleared_at       TEXT,
  acked_by         TEXT,
  acked_at         TEXT,
  ack_note         TEXT,
  snapshot_json    TEXT NOT NULL DEFAULT '{}',      -- the role values at raise time
  notification_id  TEXT,                            -- the notification centre row (CR-018)
  count            INTEGER NOT NULL DEFAULT 1,
  last_at          TEXT NOT NULL
);
CREATE INDEX idx_generator_alerts_device ON generator_alerts (device_id, raised_at);
CREATE UNIQUE INDEX idx_generator_alerts_open ON generator_alerts (device_id, alert_key) WHERE cleared_at IS NULL;

-- "mute for N hours": a re-raise of the same type is recorded but notifies nobody until the mute ends
CREATE TABLE generator_mutes (
  device_id    TEXT NOT NULL REFERENCES generator_devices(id) ON DELETE CASCADE,
  alert_key    TEXT NOT NULL,
  until        TEXT NOT NULL,
  muted_by     TEXT,
  PRIMARY KEY (device_id, alert_key)
);

CREATE TABLE generator_samples (                    -- raw, one per minute, numeric roles only
  device_id  TEXT NOT NULL REFERENCES generator_devices(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,
  ts         INTEGER NOT NULL,                      -- epoch seconds, minute aligned
  v          REAL NOT NULL,
  PRIMARY KEY (device_id, role, ts)
) WITHOUT ROWID;

CREATE TABLE generator_samples_5m (                 -- rollup, five-minute buckets
  device_id  TEXT NOT NULL REFERENCES generator_devices(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,
  ts         INTEGER NOT NULL,                      -- bucket start, epoch seconds
  v_avg      REAL NOT NULL,
  v_min      REAL NOT NULL,
  v_max      REAL NOT NULL,
  n          INTEGER NOT NULL,
  PRIMARY KEY (device_id, role, ts)
) WITHOUT ROWID;

-- many generators: the retention deletes and the global history list must not scan
CREATE INDEX idx_generator_samples_ts ON generator_samples (ts);
CREATE INDEX idx_generator_samples_5m_ts ON generator_samples_5m (ts);
CREATE INDEX idx_generator_alerts_raised ON generator_alerts (raised_at);
CREATE INDEX idx_generator_alerts_cleared ON generator_alerts (cleared_at) WHERE cleared_at IS NOT NULL;
