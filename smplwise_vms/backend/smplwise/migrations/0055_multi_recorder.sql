-- CR-024 (docs/changes/CR-024-MULTI-NVR.md section 2.1, NN1 P4/P5): more than one recorder per installation.
-- Additive only: older code ignores every new column (rollback = run the previous version). The connection of each
-- recorder stays in `recorder_connections` (CR-022, migration 0052), keyed by the same id; there is no `connection_ref`.

-- recorders: the vendor of the recorder row, enable / order / zone, its last declared capabilities, and the removal mark
-- (owner decision: a removed recorder keeps its rows and history; its cameras are disabled and left out of every list).
ALTER TABLE recorders ADD COLUMN vendor TEXT NOT NULL DEFAULT 'hikvision';
ALTER TABLE recorders ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE recorders ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE recorders ADD COLUMN time_zone TEXT;                                -- NULL = the installation's zone
ALTER TABLE recorders ADD COLUMN capabilities_json TEXT NOT NULL DEFAULT '{}';  -- the adapter's last RecorderCapabilities
ALTER TABLE recorders ADD COLUMN removed_at TEXT;                               -- NULL = active
ALTER TABLE recorders ADD COLUMN device_fingerprint TEXT;                       -- keyed hash of the recorder's model + serial (never the serial)

-- cameras: the vendor's own channel key (ADP section 3.2) and the keyed fingerprint of the physical camera (never the serial)
ALTER TABLE cameras ADD COLUMN source_ref TEXT;
UPDATE cameras SET source_ref = CAST(channel AS TEXT) WHERE source_ref IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_cameras_recorder_source ON cameras (recorder_id, source_ref);
ALTER TABLE cameras ADD COLUMN device_fingerprint TEXT;

-- events: which recorder an event came from (NULL = not a recorder event, e.g. Home Assistant); the multi-source event log
-- filters on it. Old rows: from their camera, and the device-level alert-stream rows of the only recorder there was.
ALTER TABLE events ADD COLUMN recorder_id TEXT;
UPDATE events SET recorder_id = (SELECT c.recorder_id FROM cameras c WHERE c.id = events.camera_id)
  WHERE recorder_id IS NULL AND camera_id IS NOT NULL AND source IN ('alertstream', 'recording');
UPDATE events SET recorder_id = 'nvr-1' WHERE recorder_id IS NULL AND camera_id IS NULL
  AND (source = 'alertstream' OR (source = 'system' AND raw_type = 'alertstream_disconnected'));
CREATE INDEX IF NOT EXISTS idx_events_recorder ON events (recorder_id, occurred_at);
