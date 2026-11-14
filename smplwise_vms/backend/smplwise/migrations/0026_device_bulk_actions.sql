-- CR-007 slice 3 (devices area): bulk actions - "turn off the lights / close the covers / turn off the climate /
-- turn off the screens / turn everything off" for a building, an HA floor or an HA area. One row per bulk request;
-- each entity it reaches is an ordinary ha_actions record (the same allow-list, signing and confirmation as a single
-- action) linked back through ha_actions.bulk_id. The audit log holds the attempt row (written and committed before
-- anything is sent) and one outcome row with the counts (services/device_bulk.py).
CREATE TABLE device_bulk_actions (
  id                 TEXT PRIMARY KEY,
  scope              TEXT NOT NULL,          -- building | floor | area
  scope_id           TEXT NOT NULL,          -- '*' for the building, else the HA floor / area id
  scope_name         TEXT,
  kind               TEXT NOT NULL,          -- lights_off | covers_close | climate_off | screens_off | all_off
  principal_user_id  TEXT NOT NULL,
  principal_username TEXT,
  client_request_id  TEXT NOT NULL,
  entity_count       INTEGER NOT NULL,
  status             TEXT NOT NULL,          -- sending | waiting | done
  requested_at       TEXT NOT NULL,
  not_after          TEXT NOT NULL,          -- nothing of this request is sent after this instant (server clock)
  sent_at            TEXT,                   -- the last per-entity call returned
  done_at            TEXT,
  outcome_at         TEXT,                   -- the outcome audit row was written (exactly once)
  counts_json        TEXT
);
CREATE UNIQUE INDEX idx_device_bulk_client ON device_bulk_actions (principal_user_id, client_request_id);

ALTER TABLE ha_actions ADD COLUMN bulk_id TEXT;
CREATE INDEX idx_ha_actions_bulk ON ha_actions (bulk_id);

-- A switch enters a bulk action only when positively safe (review round 1): the switch of a Plan Studio lighting
-- circuit, or one an administrator marked here (system.configure; PUT /devices/entities/{id}/bulk-safe). Off by default.
CREATE TABLE device_bulk_safe (
  entity_id          TEXT PRIMARY KEY,
  marked_by          TEXT,
  marked_by_username TEXT,
  marked_at          TEXT NOT NULL
);
