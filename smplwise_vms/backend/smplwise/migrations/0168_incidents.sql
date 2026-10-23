-- CR-LIVEEVENT100 (board r100) slice S1. Final number 0168 (built as PROVISIONAL 0190, then 0196; renumbered at the 2.16.0 integration,
-- release/2160).
-- The live event mode: one row per incident in progress (or closed, kept incidents.retention_days) and its chain of handling.
-- Default OFF: nothing writes here while the setting `incident.enabled` is not "true" (services/incidents.py).

CREATE TABLE incidents (
  id                TEXT PRIMARY KEY,
  status            TEXT NOT NULL CHECK (status IN ('open', 'closed')),
  source            TEXT NOT NULL CHECK (source IN ('alarm', 'event', 'notification', 'manual')),
  source_ref        TEXT,                    -- the event id, the alarm panel entity id, ...
  title             TEXT NOT NULL,
  building_id       TEXT,
  floor_id          TEXT,                    -- the permission scope of the incident (events.read at this floor); NULL = installation
  anchor_id         TEXT,                    -- the map anchor of the event's camera / sensor when there is one
  x                 REAL,                    -- the event point on the floor plan (normalized 0..1), when known
  y                 REAL,
  zone              TEXT,                    -- the smallest named room / zone containing the point
  opened_at         TEXT NOT NULL,
  opened_by         TEXT NOT NULL,           -- username, 'system' for an automatic opening
  opened_by_user_id TEXT,
  last_trigger_at   TEXT NOT NULL,           -- the merge window counts from the latest trigger attached
  acked_at          TEXT,
  acked_by          TEXT,
  closed_at         TEXT,
  closed_by         TEXT,
  close_note        TEXT,
  notification_id   TEXT,                    -- the "incident opened" notification (its deliveries and acknowledge feed the chain)
  facts_json        TEXT NOT NULL DEFAULT '{}'  -- snapshot at open time: event label, suggested cameras, doors (survives event pruning)
);
CREATE INDEX idx_incidents_status ON incidents (status, opened_at);
CREATE INDEX idx_incidents_floor ON incidents (floor_id, status);

CREATE TABLE incident_steps (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id   TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  at            TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('opened', 'notified', 'acked', 'door_open', 'door_state', 'note', 'event_added', 'closed')),
  actor         TEXT,                        -- display name / username; NULL for the system
  actor_user_id TEXT,
  actor_kind    TEXT NOT NULL CHECK (actor_kind IN ('user', 'system', 'access_control')),
  ref_type      TEXT,
  ref_id        TEXT,
  text          TEXT
);
CREATE INDEX idx_incident_steps_incident ON incident_steps (incident_id, at);
