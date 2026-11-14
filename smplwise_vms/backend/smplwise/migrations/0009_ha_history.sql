-- 0009: local history of Home Assistant entity states (T041). One row per state the VMS learned of: the state, when
-- HA says it changed (UTC) and when the VMS recorded it. The historical map answers "known / unknown at t" from this
-- table only; nothing is forward-filled without a bound.

CREATE TABLE ha_state_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id   TEXT NOT NULL,
  state       TEXT,
  changed_at  TEXT NOT NULL,
  recorded_at TEXT NOT NULL
);
CREATE INDEX idx_ha_history_entity_time ON ha_state_history (entity_id, changed_at);
CREATE INDEX idx_ha_history_recorded ON ha_state_history (recorded_at);
