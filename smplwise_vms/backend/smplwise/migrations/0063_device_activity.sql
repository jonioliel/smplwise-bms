-- DEVHIST S1 (docs/changes/CR-032-DEVICE-ACTIVITY.md): who changed an electrical device and when - the long-press popup's
-- "activity" tab. Additive only (rollback = run the previous version; the table is ignored by it).
-- Number 0063: 0057-0059 are in main; 0060 (cast), 0061 (generator) and 0062 (wall profiles) are on unmerged branches.
-- RENUMBER AT MERGE to the next free number.

-- Written by the HA sync path (services/ha_sync.handle_state_event) from the state_changed push that is already received:
-- no extra HA call. Only the electrical domains of the device cards (light, switch / input_boolean, climate / fan /
-- humidifier, cover) and only the watched attributes per domain (services/device_activity.py WATCHED); never a sensor.
CREATE TABLE device_activity (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id   TEXT NOT NULL,
  domain      TEXT NOT NULL,
  at_utc      TEXT NOT NULL,                 -- HA's own change time of the new state (UTC), else the receipt time
  kind        TEXT NOT NULL,                 -- power | value | availability
  actor_type  TEXT NOT NULL,                 -- person | automation | script | scene | schedule | device | system | unknown
  actor_ref   TEXT,                          -- HA user id (person) or the automation / script / scene entity id
  actor_name  TEXT,                          -- name snapshot, so a removed user or entity still reads
  source_type TEXT,                          -- automation | script | scene: the HA item whose run caused the change (NULL = none known)
  source_ref  TEXT,                          -- its entity id
  source_name TEXT,                          -- name snapshot
  via         TEXT NOT NULL,                 -- arx | ha | device | unknown
  confidence  TEXT NOT NULL,                 -- exact | inferred | unknown
  context_id  TEXT,                          -- HA context.id of the change
  parent_id   TEXT,                          -- HA context.parent_id
  from_json   TEXT NOT NULL,                 -- {"state": ..., <watched attributes>}
  to_json     TEXT NOT NULL
);
CREATE INDEX idx_device_activity_entity ON device_activity (entity_id, at_utc DESC, id DESC);
CREATE INDEX idx_device_activity_at ON device_activity (at_utc);
CREATE INDEX idx_device_activity_context ON device_activity (context_id) WHERE context_id IS NOT NULL;
CREATE INDEX idx_device_activity_parent ON device_activity (parent_id) WHERE parent_id IS NOT NULL;

-- Periods the log is known to be incomplete (the HA connection was down; a chatty entity was rate-limited): shown as a
-- coverage gap, never invented. entity_id NULL = every entity.
CREATE TABLE device_activity_gaps (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id  TEXT,
  started_at TEXT NOT NULL,
  ended_at   TEXT NOT NULL,
  reason     TEXT NOT NULL                    -- disconnected | rate_limit
);
CREATE INDEX idx_device_activity_gaps_at ON device_activity_gaps (ended_at);

-- The HA context id the bridge returned for a command made through Arx: links the HA state change back to the person
-- (and the exact action) behind it.
ALTER TABLE ha_actions ADD COLUMN context_id TEXT;
CREATE INDEX idx_ha_actions_context ON ha_actions (context_id) WHERE context_id IS NOT NULL;
